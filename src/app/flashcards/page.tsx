'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Brain,
  Plus,
  RotateCcw,
  Star,
  Trash2,
  Atom,
  FlaskConical,
  Calculator,
  BookOpen,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Zap,
  Clock,
  Target,
  Pin,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { Flashcard, FlashcardRating, SubjectId } from '@/types';
import { format, parseISO, isAfter, startOfDay } from 'date-fns';
import katex from 'katex';

// ─── LaTeX Renderer ───────────────────────────────────────────────────────────

function LatexText({ text, className }: { text: string; className?: string }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  const regex = /\$\$(.+?)\$\$|\$(.+?)\$/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const mathContent = match[1] || match[2];
    const displayMode = !!match[1];
    let html = '';
    let success = false;
    try {
      html = katex.renderToString(mathContent, { displayMode, throwOnError: false });
      success = true;
    } catch {
      // ignore
    }
    if (success) {
      parts.push(<span key={key++} dangerouslySetInnerHTML={{ __html: html }} />);
    } else {
      parts.push(match[0]);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  if (parts.length === 0) {
    return <span className={className}>{text}</span>;
  }

  return <div className={className}>{parts}</div>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SUBJECT_META: Record<SubjectId, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  physics: { label: 'Physics', icon: <Atom className="size-3.5" />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  chemistry: { label: 'Chemistry', icon: <FlaskConical className="size-3.5" />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  mathematics: { label: 'Mathematics', icon: <Calculator className="size-3.5" />, color: 'text-amber-400', bg: 'bg-amber-500/10' },
};

// ─── Flip Card ────────────────────────────────────────────────────────────────

function FlipCard({
  card,
  flipped,
  setFlipped,
  onRating,
}: {
  card: Flashcard;
  flipped: boolean;
  setFlipped: React.Dispatch<React.SetStateAction<boolean>>;
  onRating: (r: FlashcardRating) => void;
}) {
  const meta = SUBJECT_META[card.subject];

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-xl mx-auto">
      {/* Card */}
      <div
        className="relative w-full cursor-pointer"
        style={{ perspective: '1200px', minHeight: '240px' }}
        onClick={() => setFlipped(f => !f)}
      >
        <div
          className="relative w-full transition-all duration-500"
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            minHeight: '240px',
          }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 rounded-2xl border border-border/50 bg-card p-6 flex flex-col justify-between"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${meta.bg} ${meta.color}`}>
                {meta.icon}{meta.label}
              </span>
              <span className="text-xs text-muted-foreground">{card.chapterName}</span>
            </div>
            <div className="flex-1 flex items-center justify-center">
              {card.isLatex ? (
                <LatexText text={card.front} className="text-center text-lg font-semibold leading-relaxed" />
              ) : (
                <p className="text-center text-lg font-semibold leading-relaxed">{card.front}</p>
              )}
            </div>
            <p className="text-center text-xs text-muted-foreground mt-4">Tap to reveal answer</p>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 rounded-2xl border border-primary/30 bg-primary/5 p-6 flex flex-col justify-between"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground">Answer</span>
              <span className="text-xs text-muted-foreground">{card.topicName}</span>
            </div>
            <div className="flex-1 flex items-center justify-center">
              {card.isLatex ? (
                <LatexText text={card.back} className="text-center text-base leading-relaxed" />
              ) : (
                <p className="text-center text-base leading-relaxed whitespace-pre-wrap">{card.back}</p>
              )}
            </div>
            <p className="text-center text-xs text-primary/70 mt-4">How well did you recall this?</p>
          </div>
        </div>
      </div>

      {/* Rating buttons */}
      {flipped && (
        <div className="flex gap-3 w-full justify-center animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          <Button
            size="sm"
            onClick={(e) => { e.stopPropagation(); onRating('again'); }}
            className="gap-1.5 flex-1 max-w-[110px] bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30"
          >
            <XCircle className="size-3.5" />Again
          </Button>
          <Button
            size="sm"
            onClick={(e) => { e.stopPropagation(); onRating('hard'); }}
            className="gap-1.5 flex-1 max-w-[110px] bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/30"
          >
            <Clock className="size-3.5" />Hard
          </Button>
          <Button
            size="sm"
            onClick={(e) => { e.stopPropagation(); onRating('good'); }}
            className="gap-1.5 flex-1 max-w-[110px] bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30"
          >
            <CheckCircle2 className="size-3.5" />Good
          </Button>
          <Button
            size="sm"
            onClick={(e) => { e.stopPropagation(); onRating('easy'); }}
            className="gap-1.5 flex-1 max-w-[110px] bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30"
          >
            <Zap className="size-3.5" />Easy
          </Button>
        </div>
      )}

      {!flipped && (
        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setFlipped(true); }} className="gap-1.5">
          <RotateCcw className="size-3.5" />Reveal
        </Button>
      )}
    </div>
  );
}

// ─── Create Card Form ─────────────────────────────────────────────────────────

function CreateCardForm({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [subject, setSubject] = useState<SubjectId>('physics');
  const [chapterId, setChapterId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [tags, setTags] = useState('');
  const [isLatex, setIsLatex] = useState(false);

  const subjectData = useMemo(() => state.syllabus.find(s => s.id === subject), [state.syllabus, subject]);
  const chapters = useMemo(() => subjectData?.chapters ?? [], [subjectData]);
  const topics = useMemo(() => chapters.find(c => c.id === chapterId)?.topics ?? [], [chapters, chapterId]);

  const handleSubmit = useCallback(() => {
    if (!front.trim() || !back.trim() || !chapterId || !topicId) return;
    const chapter = chapters.find(c => c.id === chapterId);
    const topic = topics.find(t => t.id === topicId);
    if (!chapter || !topic) return;

    const card: Flashcard = {
      id: uuidv4(),
      front: front.trim(),
      back: back.trim(),
      subject,
      chapterId,
      chapterName: chapter.name,
      topicId,
      topicName: topic.name,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      createdAt: new Date().toISOString(),
      lastReviewedAt: null,
      nextReviewAt: format(new Date(), 'yyyy-MM-dd'),
      easeFactor: 2.5,
      intervalDays: 1,
      repetitions: 0,
      isPinned: false,
      isLatex,
    };
    dispatch({ type: 'ADD_FLASHCARD', payload: card });
    onClose();
  }, [front, back, subject, chapterId, topicId, tags, isLatex, chapters, topics, dispatch, onClose]);

  return (
    <Card className="border-primary/30 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Plus className="size-4 text-primary" />New Flashcard
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(SUBJECT_META) as [SubjectId, typeof SUBJECT_META[SubjectId]][]).map(([id, meta]) => (
            <button
              key={id}
              onClick={() => { setSubject(id); setChapterId(''); setTopicId(''); }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                subject === id ? `${meta.bg} ${meta.color} ring-1 ring-current` : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {meta.icon}{meta.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Chapter</label>
            <select
              value={chapterId}
              onChange={e => { setChapterId(e.target.value); setTopicId(''); }}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Select chapter…</option>
              {chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Topic</label>
            <select
              value={topicId}
              onChange={e => setTopicId(e.target.value)}
              disabled={!chapterId}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-40"
            >
              <option value="">Select topic…</option>
              {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Front (Question / Term)</label>
          <textarea
            value={front}
            onChange={e => setFront(e.target.value)}
            rows={2}
            placeholder="e.g. State Newton's Second Law"
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 flex items-center gap-2 justify-between">
            <span>Back (Answer / Formula)</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={isLatex} onChange={e => setIsLatex(e.target.checked)} className="size-3" />
              <span>LaTeX formula</span>
            </label>
          </label>
          <textarea
            value={back}
            onChange={e => setBack(e.target.value)}
            rows={3}
            placeholder={isLatex ? 'e.g. F = ma \\Rightarrow a = \\frac{F}{m}' : 'e.g. The net force on an object equals mass × acceleration (F = ma)'}
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono text-xs"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Tags (comma-separated)</label>
          <input
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="e.g. formula, derivation, important"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">Cancel</Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!front.trim() || !back.trim() || !chapterId || !topicId}
            className="gap-1.5 text-xs"
          >
            <Plus className="size-3.5" />Add Card
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Card Row ─────────────────────────────────────────────────────────────────

function CardRow({ card }: { card: Flashcard }) {
  const { dispatch } = useStore();
  const meta = SUBJECT_META[card.subject];
  const isDue = !card.nextReviewAt || !isAfter(parseISO(card.nextReviewAt), startOfDay(new Date()));

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-background/50 px-4 py-3 hover:bg-background/70 transition-colors">
      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${meta.bg} ${meta.color}`}>
        {meta.icon}
      </span>
      <div className="min-w-0 flex-1">
        {card.isLatex ? (
          <div className="text-sm font-medium truncate"><LatexText text={card.front} /></div>
        ) : (
          <p className="text-sm font-medium truncate">{card.front}</p>
        )}
        <p className="text-xs text-muted-foreground truncate">{card.chapterName} · {card.topicName}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isDue && <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">Due</span>}
        {card.isPinned && <Pin className="size-3 text-primary" />}
        <button
          onClick={() => dispatch({ type: 'TOGGLE_FLASHCARD_PIN', payload: card.id })}
          className="text-muted-foreground hover:text-primary transition-colors"
        >
          <Star className={`size-3.5 ${card.isPinned ? 'fill-primary text-primary' : ''}`} />
        </button>
        <button
          onClick={() => dispatch({ type: 'DELETE_FLASHCARD', payload: card.id })}
          className="text-muted-foreground hover:text-red-400 transition-colors"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FlashcardsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const { state, dispatch } = useStore();
  const [showCreate, setShowCreate] = useState(false);
  const [sessionIndex, setSessionIndex] = useState(0);
  const [sessionDone, setSessionDone] = useState(false);
  const [sessionResults, setSessionResults] = useState<{ id: string; rating: FlashcardRating }[]>([]);
  const [flipped, setFlipped] = useState(false);

  const dueCards = useMemo(() => {
    const today = startOfDay(new Date());
    return (state.flashcards || []).filter(c =>
      !c.nextReviewAt || !isAfter(parseISO(c.nextReviewAt), today)
    );
  }, [state.flashcards]);

  const [sessionCards, setSessionCards] = useState<Flashcard[]>([]);

  // Initialize session cards when dueCards are loaded or changed, but only if no active session is in progress
  useEffect(() => {
    if (sessionResults.length === 0 && !sessionDone && sessionIndex === 0) {
      setSessionCards(dueCards.slice(0, 20));
    }
  }, [dueCards, sessionResults.length, sessionDone, sessionIndex]);

  const currentCard = sessionCards[sessionIndex];

  // Reset flipped state when card changes
  useEffect(() => {
    setFlipped(false);
  }, [sessionIndex, currentCard?.id]);

  const handleRating = useCallback((rating: FlashcardRating) => {
    if (!currentCard) return;

    // Prevent double rating the same card due to race conditions or fast double clicks/keypresses
    setSessionResults(prev => {
      if (prev.some(r => r.id === currentCard.id)) {
        return prev;
      }

      dispatch({ type: 'REVIEW_FLASHCARD', payload: { id: currentCard.id, rating } });

      const nextResults = [...prev, { id: currentCard.id, rating }];
      if (nextResults.length >= sessionCards.length) {
        setSessionDone(true);
      } else {
        setSessionIndex(nextResults.length);
      }
      return nextResults;
    });
  }, [currentCard, dispatch, sessionCards.length]);

  const restartSession = useCallback(() => {
    setSessionIndex(0);
    setSessionDone(false);
    setSessionResults([]);
    setFlipped(false);
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const allCards = state.flashcards || [];
  const doneCount = sessionResults.filter(r => r.rating === 'good' || r.rating === 'easy').length;
  const againCount = sessionResults.filter(r => r.rating === 'again' || r.rating === 'hard').length;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
              <Brain className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Active Recall</h1>
              <p className="text-sm text-muted-foreground">SM-2 Spaced Repetition Flashcards</p>
            </div>
          </div>
          <Button onClick={() => setShowCreate(!showCreate)} size="sm" className="gap-1.5">
            <Plus className="size-4" />{showCreate ? 'Cancel' : 'New Card'}
          </Button>
        </div>

        {/* Create Form */}
        {showCreate && (
          <div className="mb-6 animate-in fade-in-0 slide-in-from-top-2 duration-300">
            <CreateCardForm onClose={() => setShowCreate(false)} />
          </div>
        )}

        {/* Stats Row */}
        <div className="mb-8 grid gap-4 grid-cols-2 sm:grid-cols-4">
          {[
            { label: 'Total Cards', value: allCards.length, icon: <BookOpen className="size-4 text-blue-400" />, bg: 'bg-blue-500/10' },
            { label: 'Due Today', value: dueCards.length, icon: <Clock className="size-4 text-amber-400" />, bg: 'bg-amber-500/10' },
            { label: 'Pinned', value: allCards.filter(c => c.isPinned).length, icon: <Star className="size-4 text-primary" />, bg: 'bg-primary/10' },
            { label: 'Mastered', value: allCards.filter(c => c.repetitions >= 3).length, icon: <Target className="size-4 text-emerald-400" />, bg: 'bg-emerald-500/10' },
          ].map(stat => (
            <Card key={stat.label} className="border-border/40 bg-background/60">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex size-9 items-center justify-center rounded-xl ${stat.bg}`}>{stat.icon}</div>
                <div>
                  <p className="text-xl font-bold tabular-nums">{stat.value}</p>
                  <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="session">
          <div className="w-full overflow-x-auto pb-1 scrollbar-none mb-6">
            <TabsList className="flex w-max min-w-full">
              <TabsTrigger value="session">
                <Brain className="size-3.5" />Study Session
                {dueCards.length > 0 && (
                  <span className="ml-1 flex size-5 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                    {Math.min(dueCards.length, 20)}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="all"><BookOpen className="size-3.5" />All Cards</TabsTrigger>
              <TabsTrigger value="pinned"><Star className="size-3.5" />Pinned</TabsTrigger>
            </TabsList>
          </div>

          {/* Session Tab */}
          <TabsContent value="session">
            {sessionCards.length === 0 ? (
              <Card className="border-border/40 bg-background/60">
                <CardContent className="flex flex-col items-center gap-3 py-16">
                  <CheckCircle2 className="size-10 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-muted-foreground">No cards due today!</p>
                  <p className="text-xs text-muted-foreground/70">Create new cards or check back tomorrow.</p>
                  <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5 mt-2">
                    <Plus className="size-3.5" />Create a card
                  </Button>
                </CardContent>
              </Card>
            ) : (sessionDone || sessionIndex >= sessionCards.length) ? (
              <Card className="border-emerald-500/30 bg-emerald-500/5">
                <CardContent className="flex flex-col items-center gap-4 py-12">
                  <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10">
                    <CheckCircle2 className="size-7 text-emerald-400" />
                  </div>
                  <div className="text-center">
                    <h2 className="text-xl font-bold">Session Complete!</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      You reviewed {sessionCards.length} cards
                    </p>
                  </div>
                  <div className="flex gap-6 text-center">
                    <div>
                      <p className="text-2xl font-bold text-emerald-400">{doneCount}</p>
                      <p className="text-xs text-muted-foreground">Good / Easy</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-400">{againCount}</p>
                      <p className="text-xs text-muted-foreground">Again / Hard</p>
                    </div>
                  </div>
                  <Button onClick={restartSession} variant="outline" className="gap-2 mt-2">
                    <RotateCcw className="size-4" />Start Another Session
                  </Button>
                </CardContent>
              </Card>
            ) : currentCard ? (
              <div className="space-y-4">
                {/* Progress */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Card {sessionIndex + 1} of {sessionCards.length}</span>
                  <span>{Math.round(((sessionIndex) / sessionCards.length) * 100)}% complete</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${(sessionIndex / sessionCards.length) * 100}%` }}
                  />
                </div>
                <FlipCard card={currentCard} flipped={flipped} setFlipped={setFlipped} onRating={handleRating} />
                <p className="text-center text-xs text-muted-foreground">
                  Keyboard: <kbd className="rounded bg-muted px-1 py-0.5 font-mono">Space</kbd> to flip ·
                  <kbd className="rounded bg-muted px-1 py-0.5 font-mono ml-1">1</kbd>Again ·
                  <kbd className="rounded bg-muted px-1 py-0.5 font-mono ml-1">2</kbd>Hard ·
                  <kbd className="rounded bg-muted px-1 py-0.5 font-mono ml-1">3</kbd>Good ·
                  <kbd className="rounded bg-muted px-1 py-0.5 font-mono ml-1">4</kbd>Easy
                </p>
              </div>
            ) : null}
          </TabsContent>

          {/* All Cards Tab */}
          <TabsContent value="all">
            {allCards.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16">
                <Brain className="size-10 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">No flashcards yet</p>
                <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
                  <Plus className="size-3.5" />Create your first card
                </Button>
              </div>
            ) : (
              <ScrollArea className="max-h-[600px]">
                <div className="space-y-2 pr-3">
                  {allCards.map(card => <CardRow key={card.id} card={card} />)}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          {/* Pinned Tab */}
          <TabsContent value="pinned">
            {allCards.filter(c => c.isPinned).length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16">
                <Star className="size-10 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">No pinned cards</p>
                <p className="text-xs text-muted-foreground/70">Star any card to pin it here for quick access.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {allCards.filter(c => c.isPinned).map(card => <CardRow key={card.id} card={card} />)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Keyboard shortcuts */}
      <KeyboardHandler
        onFlip={() => setFlipped(f => !f)}
        onRate={handleRating}
        enabled={!sessionDone && sessionCards.length > 0 && sessionIndex < sessionCards.length}
        flipped={flipped}
      />
    </div>
  );
}

// Keyboard handler
function KeyboardHandler({
  onFlip,
  onRate,
  enabled,
  flipped,
}: {
  onFlip: () => void;
  onRate: (r: FlashcardRating) => void;
  enabled: boolean;
  flipped: boolean;
}) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === ' ') {
        e.preventDefault();
        onFlip();
      }
      if (flipped) {
        if (e.key === '1') onRate('again');
        if (e.key === '2') onRate('hard');
        if (e.key === '3') onRate('good');
        if (e.key === '4') onRate('easy');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, flipped, onFlip, onRate]);

  return null;
}

// Missing icon polyfill
function ChevronRight_({ className }: { className?: string }) {
  return <ChevronRight className={className} />;
}
void ChevronRight_;
