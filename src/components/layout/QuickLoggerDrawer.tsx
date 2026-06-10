'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStore } from '@/store';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Atom,
  FlaskConical,
  Calculator,
  BookOpen,
  RotateCcw,
  Target,
  FileText,
  School,
  Send,
  Sparkles,
  Search,
} from 'lucide-react';
import type { SubjectId, StudyLog } from '@/types';



const TYPE_CONFIG: Record<StudyLog['type'], { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
  study: { label: 'Study', icon: <BookOpen className="size-3" />, color: 'text-blue-300', bgColor: 'bg-blue-500/10' },
  revision: { label: 'Revision', icon: <RotateCcw className="size-3" />, color: 'text-violet-300', bgColor: 'bg-violet-500/10' },
  practice: { label: 'Practice', icon: <Target className="size-3" />, color: 'text-green-300', bgColor: 'bg-green-500/10' },
  test: { label: 'Test', icon: <FileText className="size-3" />, color: 'text-rose-300', bgColor: 'bg-rose-500/10' },
  school: { label: 'School', icon: <School className="size-3" />, color: 'text-cyan-300', bgColor: 'bg-cyan-500/10' },
};

const STUDY_TYPES: StudyLog['type'][] = ['study', 'revision', 'practice', 'test', 'school'];

export default function QuickLoggerDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const { state, logStudy } = useStore();

  // Form state
  const [description, setDescription] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<SubjectId>('physics');
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [duration, setDuration] = useState(60);
  const [studyType, setStudyType] = useState<StudyLog['type']>('study');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Focus ref for text input
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Listen to global open event and keyboard shortcut
  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      setTimeout(() => textareaRef.current?.focus(), 100);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt+L shortcut to trigger quick log
      if (e.altKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener('open-quick-log', handleOpen);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('open-quick-log', handleOpen);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Autocomplete matching logic
  const autocompleteSuggestions = useMemo(() => {
    if (!description.trim() || description.length < 3) return [];

    const query = description.toLowerCase();
    const suggestions: Array<{
      type: 'topic' | 'chapter';
      subject: SubjectId;
      chapterId: string;
      chapterName: string;
      topicId?: string;
      topicName?: string;
      displayText: string;
    }> = [];

    for (const subject of state.syllabus) {
      for (const chapter of subject.chapters) {
        if (chapter.name.toLowerCase().includes(query)) {
          suggestions.push({
            type: 'chapter',
            subject: subject.id,
            chapterId: chapter.id,
            chapterName: chapter.name,
            displayText: `📂 ${subject.name} - ${chapter.name}`
          });
        }
        for (const topic of chapter.topics) {
          if (topic.name.toLowerCase().includes(query)) {
            suggestions.push({
              type: 'topic',
              subject: subject.id,
              chapterId: chapter.id,
              chapterName: chapter.name,
              topicId: topic.id,
              topicName: topic.name,
              displayText: `🎯 ${chapter.name} → ${topic.name}`
            });
          }
        }
      }
    }
    return suggestions.slice(0, 5);
  }, [description, state.syllabus]);

  const selectedSubjectData = useMemo(
    () => state.syllabus.find((s) => s.id === selectedSubject),
    [state.syllabus, selectedSubject]
  );

  const selectedChapterData = useMemo(
    () => selectedSubjectData?.chapters.find((c) => c.id === selectedChapterId),
    [selectedSubjectData, selectedChapterId]
  );

  const handleSubjectChange = (subjectId: SubjectId) => {
    setSelectedSubject(subjectId);
    setSelectedChapterId('');
    setSelectedTopicId('');
  };

  const handleChapterChange = (chapterId: string | null) => {
    setSelectedChapterId(chapterId ?? '');
    setSelectedTopicId('');
  };

  const selectSuggestion = (s: typeof autocompleteSuggestions[0]) => {
    setSelectedSubject(s.subject);
    setSelectedChapterId(s.chapterId);
    if (s.type === 'topic' && s.topicId) {
      setSelectedTopicId(s.topicId);
      // Auto-set session type based on description hints
      const text = description.toLowerCase();
      if (text.includes('rev') || text.includes('formula')) setStudyType('revision');
      else if (text.includes('test') || text.includes('quiz')) setStudyType('test');
      else if (text.includes('prac') || text.includes('dpp') || text.includes('solve')) setStudyType('practice');
      else if (text.includes('school') || text.includes('class')) setStudyType('school');
    }
    setShowSuggestions(false);
  };

  const handleAIAutoFill = async () => {
    if (!description.trim()) return;
    setIsParsing(true);

    try {
      const syllabusOutline = state.syllabus.map(s => ({
        id: s.id,
        name: s.name,
        chapters: s.chapters.map(c => ({
          id: c.id,
          name: c.name,
          topics: c.topics.map(t => ({ id: t.id, name: t.name }))
        }))
      }));

      const systemPrompt = `You are an AI parser for JEE OS. Match the user's description of what they studied to a single topic in the syllabus database.
Syllabus Database:
${JSON.stringify(syllabusOutline)}

Return ONLY a JSON object (no explanations, no markdown code block wrapper, just raw JSON) matching this interface:
{
  "subject": "physics" | "chemistry" | "mathematics",
  "chapterId": "matched chapter ID",
  "topicId": "matched topic ID",
  "duration": estimated minutes (default 60),
  "type": "study" | "revision" | "practice" | "test" | "school" (default "study")
}`;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: description }],
          systemPrompt,
        }),
      });

      if (!response.ok || !response.body) throw new Error('AI parse request failed');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === 'text') {
              accumulatedText += event.content;
            }
          } catch {
            // ignore
          }
        }
      }

      let reply = accumulatedText.trim();
      if (reply.startsWith('```')) {
        reply = reply.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
      }

      const result = JSON.parse(reply);
      if (result) {
        if (result.topicId && (!result.subject || !result.chapterId)) {
          for (const sub of state.syllabus) {
            for (const ch of sub.chapters) {
              const matchedTopic = ch.topics.find(t => t.id === result.topicId);
              if (matchedTopic) {
                result.subject = sub.id;
                result.chapterId = ch.id;
                break;
              }
            }
          }
        }

        if (result.subject) setSelectedSubject(result.subject as SubjectId);
        if (result.chapterId) setSelectedChapterId(result.chapterId);
        if (result.topicId) setSelectedTopicId(result.topicId);
        if (result.duration) setDuration(Number(result.duration));
        if (result.type) setStudyType(result.type as StudyLog['type']);
      }
    } catch (e) {
      console.error('Quick logger AI autofill failed:', e);
    } finally {
      setIsParsing(false);
    }
  };

  const handleSubmit = () => {
    if (!description.trim() || !selectedTopicId || !selectedChapterId) return;

    setIsSubmitting(true);
    logStudy(description.trim(), selectedTopicId, selectedChapterId, selectedSubject, duration, studyType);

    // Reset form
    setDescription('');
    setSelectedTopicId('');
    setDuration(60);
    setStudyType('study');

    setTimeout(() => {
      setIsSubmitting(false);
      setIsOpen(false);
    }, 300);
  };

  const canSubmit = description.trim() && selectedTopicId && selectedChapterId && duration > 0;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent side="right" className="w-[calc(100vw-32px)] sm:max-w-md bg-[#0a0a10]/95 border-l border-white/10 backdrop-blur-xl flex flex-col p-0 text-white">
        <SheetHeader className="p-5 border-b border-white/5 bg-[#101018]/90 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400">
              <BookOpen className="size-4" />
            </div>
            <div>
              <SheetTitle className="text-sm font-semibold text-zinc-100">Quick Study Log</SheetTitle>
              <SheetDescription className="text-[11px] text-zinc-500">
                Log study sessions from anywhere. Press <kbd className="bg-zinc-800 text-zinc-400 px-1 py-0.5 rounded text-[10px] font-mono font-semibold">Alt + L</kbd> to toggle.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Natural Language Input */}
          <div className="space-y-2 relative">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-zinc-300">What did you study?</label>
              <Button
                onClick={handleAIAutoFill}
                disabled={!description.trim() || isParsing}
                variant="outline"
                size="xs"
                className="text-[10px] gap-1 px-2 py-0.5 h-6 bg-purple-500/5 hover:bg-purple-500/10 border-purple-500/20 text-purple-300 cursor-pointer"
              >
                <Sparkles className="size-3 animate-pulse text-purple-400" />
                {isParsing ? 'Autofilling...' : 'AI Autofill'}
              </Button>
            </div>

            <Textarea
              ref={textareaRef}
              placeholder="e.g. Spent 1 hour reviewing laws of motion and solving coefficient of friction problems"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              className="min-h-[72px] resize-none text-xs bg-zinc-900 border-white/5 text-white placeholder:text-zinc-600 focus-visible:ring-purple-500"
            />

            {/* Autocomplete suggestions dropdown */}
            {showSuggestions && autocompleteSuggestions.length > 0 && (
              <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-[#12121e] border border-white/10 rounded-lg shadow-xl divide-y divide-white/5 overflow-hidden animate-in fade-in duration-100">
                <div className="px-2.5 py-1 text-[9px] text-zinc-500 font-semibold bg-zinc-950/40 flex items-center gap-1 font-mono uppercase tracking-wider">
                  <Search className="size-2.5" /> Quick Link Syllabus Topics
                </div>
                {autocompleteSuggestions.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={() => selectSuggestion(s)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition-colors flex items-center justify-between text-zinc-300"
                  >
                    <span>{s.displayText}</span>
                    <span className="text-[10px] text-zinc-600 font-mono">link</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Topic Details Tracker */}
          <div className="space-y-4 rounded-xl border border-white/5 bg-zinc-950/40 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">Syllabus Link</span>
            </div>

            {/* Subject Tabs */}
            <Tabs value={selectedSubject} onValueChange={(val) => handleSubjectChange(val as SubjectId)}>
              <TabsList className="w-full bg-zinc-900 border border-white/5 p-0.5 rounded-lg h-9">
                <TabsTrigger value="physics" className="flex-1 text-xs gap-1 rounded-md h-8 py-0">
                  <Atom className="size-3.5" />
                  Physics
                </TabsTrigger>
                <TabsTrigger value="chemistry" className="flex-1 text-xs gap-1 rounded-md h-8 py-0">
                  <FlaskConical className="size-3.5" />
                  Chemistry
                </TabsTrigger>
                <TabsTrigger value="mathematics" className="flex-1 text-xs gap-1 rounded-md h-8 py-0">
                  <Calculator className="size-3.5" />
                  Maths
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Chapter Select */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-zinc-400">Chapter</label>
              <Select value={selectedChapterId} onValueChange={handleChapterChange}>
                <SelectTrigger className="w-full h-9 bg-zinc-900 border-white/5 text-xs text-white">
                  <SelectValue placeholder="Select chapter" />
                </SelectTrigger>
                <SelectContent className="bg-[#0f0f18] border-white/10 text-white text-xs">
                  {selectedSubjectData?.chapters.map((chapter) => (
                    <SelectItem key={chapter.id} value={chapter.id} className="focus:bg-white/5">
                      <span className="mr-1.5">{chapter.icon}</span>
                      {chapter.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Topic Select */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-zinc-400">Topic</label>
              <Select
                value={selectedTopicId}
                onValueChange={(v) => { if (v) setSelectedTopicId(v); }}
                disabled={!selectedChapterId}
              >
                <SelectTrigger className="w-full h-9 bg-zinc-900 border-white/5 text-xs text-white">
                  <SelectValue placeholder={selectedChapterId ? 'Select topic' : 'Select chapter first'} />
                </SelectTrigger>
                <SelectContent className="bg-[#0f0f18] border-white/10 text-white text-xs">
                  {selectedChapterData?.topics.map((topic) => (
                    <SelectItem key={topic.id} value={topic.id} className="focus:bg-white/5">
                      {topic.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Duration & Presets */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300">Study Duration</label>
            <div className="flex gap-3 items-center">
              <Input
                type="number"
                min={1}
                max={480}
                value={duration}
                onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value) || 0))}
                className="w-24 h-9 bg-zinc-900 border-white/5 text-xs text-center tabular-nums text-white"
              />
              <div className="flex gap-1.5 flex-1 justify-end">
                {[15, 30, 60, 120].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDuration(preset)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold font-mono transition-colors ${
                      duration === preset
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-white/5'
                    }`}
                  >
                    {preset >= 60 ? `${preset / 60}h` : `${preset}m`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Session Type selectors */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300">Session Type</label>
            <div className="flex flex-wrap gap-1.5">
              {STUDY_TYPES.map((type) => {
                const cfg = TYPE_CONFIG[type];
                const isSelected = studyType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setStudyType(type)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
                      isSelected
                        ? `${cfg.bgColor} ${cfg.color} border-current/25 shadow-md`
                        : 'border-white/5 bg-zinc-900 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {cfg.icon}
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-5 border-t border-white/5 bg-[#0a0a10]/80 shrink-0">
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className="w-full gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold cursor-pointer h-10 rounded-xl"
          >
            <Send className="size-4" />
            {isSubmitting ? 'Logging session...' : 'Log Study Session'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
