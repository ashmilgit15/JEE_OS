'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  RotateCcw,
  CheckCircle2,
  XCircle,
  Brain,
  ArrowRight,
  Play,
  Award,
  HelpCircle,
  Clock,
  BookOpen
} from 'lucide-react';
import type { SubjectId } from '@/types';
import { format, parseISO } from 'date-fns';

const SUBJECT_META: Record<SubjectId, { label: string; color: string; bg: string; border: string }> = {
  physics: { label: 'Physics', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  chemistry: { label: 'Chemistry', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  mathematics: { label: 'Mathematics', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
};

export default function ReplayArenaPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const { state, dispatch } = useStore();
  const [quizMode, setQuizMode] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  const pendingMistakes = useMemo(() => {
    return (state.mistakes || []).filter(m => m.status === 'pending');
  }, [state.mistakes]);

  // Statistics breakdown
  const subjectStats = useMemo(() => {
    const counts = { physics: 0, chemistry: 0, mathematics: 0 };
    pendingMistakes.forEach(m => {
      if (m.subject in counts) {
        counts[m.subject]++;
      }
    });
    return counts;
  }, [pendingMistakes]);

  const handleStartQuiz = useCallback(() => {
    if (pendingMistakes.length === 0) return;
    setQuizMode(true);
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setSubmitted(false);
    setCorrectCount(0);
    setIncorrectCount(0);
    setQuizFinished(false);
  }, [pendingMistakes]);

  const handleSubmitAnswer = useCallback(() => {
    if (selectedOption === null || submitted) return;
    const currentMistake = pendingMistakes[currentQuestionIndex];
    if (!currentMistake) return;

    setSubmitted(true);
    const isCorrect = selectedOption === currentMistake.correctAnswer;
    if (isCorrect) {
      setCorrectCount(c => c + 1);
      dispatch({ type: 'RESOLVE_MISTAKE', payload: { mistakeId: currentMistake.id } });
    } else {
      setIncorrectCount(c => c + 1);
    }
  }, [selectedOption, submitted, currentQuestionIndex, pendingMistakes, dispatch]);

  const handleNextQuestion = useCallback(() => {
    if (currentQuestionIndex + 1 >= pendingMistakes.length) {
      setQuizFinished(true);
    } else {
      setCurrentQuestionIndex(idx => idx + 1);
      setSelectedOption(null);
      setSubmitted(false);
    }
  }, [currentQuestionIndex, pendingMistakes.length]);

  const handleExitQuiz = useCallback(() => {
    setQuizMode(false);
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-red-500/10">
              <RotateCcw className="size-5 text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Replay Arena</h1>
              <p className="text-sm text-muted-foreground">Error Vault & Adaptive Mistake Replaying</p>
            </div>
          </div>
          {!quizMode && pendingMistakes.length > 0 && (
            <Button onClick={handleStartQuiz} className="gap-1.5 bg-red-500 hover:bg-red-600 text-white font-semibold">
              <Play className="size-4 fill-current" />Start Replay Quiz
            </Button>
          )}
        </div>

        {quizMode ? (
          // Quiz interface
          <div>
            {quizFinished ? (
              // Quiz Finished Screen
              <Card className="border-emerald-500/30 bg-emerald-500/5 max-w-xl mx-auto">
                <CardContent className="flex flex-col items-center gap-4 py-12">
                  <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10 animate-bounce">
                    <Award className="size-7 text-emerald-400" />
                  </div>
                  <div className="text-center">
                    <h2 className="text-xl font-bold">Replay Session Finished!</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      You replayed {correctCount + incorrectCount} mistake question(s).
                    </p>
                  </div>
                  <div className="flex gap-8 text-center mt-2">
                    <div>
                      <p className="text-3xl font-extrabold text-emerald-400">{correctCount}</p>
                      <p className="text-xs text-muted-foreground mt-1">Resolved (Cleared)</p>
                    </div>
                    <div>
                      <p className="text-3xl font-extrabold text-red-400">{incorrectCount}</p>
                      <p className="text-xs text-muted-foreground mt-1">Still Pending</p>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <Button onClick={handleExitQuiz} variant="outline" className="gap-2">
                      <BookOpen className="size-4" />Exit to Vault
                    </Button>
                    {pendingMistakes.length > 0 && (
                      <Button onClick={handleStartQuiz} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/95">
                        <RotateCcw className="size-4" />Replay Remaining
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              // Active Quiz Question Card
              <div className="max-w-2xl mx-auto space-y-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <Button onClick={handleExitQuiz} variant="ghost" size="sm" className="hover:bg-muted/50 text-xs text-muted-foreground">
                    Exit Quiz
                  </Button>
                  <span>Question {currentQuestionIndex + 1} of {pendingMistakes.length}</span>
                </div>

                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full bg-red-500 transition-all duration-500"
                    style={{ width: `${((currentQuestionIndex) / pendingMistakes.length) * 100}%` }}
                  />
                </div>

                {(() => {
                  const m = pendingMistakes[currentQuestionIndex];
                  if (!m) return null;
                  const meta = SUBJECT_META[m.subject];
                  return (
                    <Card className="border-border/60 bg-background/50 backdrop-blur-sm">
                      <CardContent className="p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-border/20 pb-3">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${meta.bg} ${meta.color}`}>
                            {meta.label}
                          </span>
                          <span className="text-xs text-muted-foreground">{m.chapterName} · {m.topicName}</span>
                        </div>

                        {/* Question Text */}
                        <div className="text-base font-semibold leading-relaxed whitespace-pre-wrap py-2">
                          {m.questionText}
                        </div>

                        {/* Options */}
                        <div className="grid gap-2 pt-2">
                          {m.options.map((option, oIdx) => {
                            const isSelected = selectedOption === oIdx;
                            const isCorrect = oIdx === m.correctAnswer;
                            const isWrongSelection = isSelected && !isCorrect;

                            let optionStyle = "border-border/60 bg-muted/20 hover:bg-muted/40 text-foreground";
                            if (submitted) {
                              if (isCorrect) {
                                optionStyle = "border-emerald-500/50 bg-emerald-500/10 text-emerald-400 font-medium";
                              } else if (isWrongSelection) {
                                optionStyle = "border-red-500/50 bg-red-500/10 text-red-400";
                              } else {
                                optionStyle = "border-border/30 bg-muted/10 text-muted-foreground opacity-50";
                              }
                            } else if (isSelected) {
                              optionStyle = "border-primary/50 bg-primary/10 text-primary font-medium ring-1 ring-primary/30";
                            }

                            return (
                              <button
                                key={oIdx}
                                disabled={submitted}
                                onClick={() => setSelectedOption(oIdx)}
                                className={`flex items-start gap-3 w-full rounded-xl border p-4 text-left text-sm transition-all ${optionStyle}`}
                              >
                                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted/40 text-xs font-semibold">
                                  {String.fromCharCode(65 + oIdx)}
                                </span>
                                <span className="flex-1">{option}</span>
                                {submitted && isCorrect && <CheckCircle2 className="size-4.5 text-emerald-400 shrink-0 mt-0.5" />}
                                {submitted && isWrongSelection && <XCircle className="size-4.5 text-red-400 shrink-0 mt-0.5" />}
                              </button>
                            );
                          })}
                        </div>

                        {/* Explanation section */}
                        {submitted && (
                          <div className="mt-4 rounded-xl bg-muted/20 border border-border/20 p-4 space-y-2 animate-in fade-in-50 duration-300">
                            <p className="text-xs font-bold text-primary flex items-center gap-1.5">
                              <Brain className="size-3.5" /> Explanation & Solution
                            </p>
                            <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
                              {m.explanation || "No explanation provided for this question."}
                            </p>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex justify-end pt-3">
                          {!submitted ? (
                            <Button
                              onClick={handleSubmitAnswer}
                              disabled={selectedOption === null}
                              className="w-full sm:w-auto px-6 bg-red-500 hover:bg-red-600 text-white font-semibold"
                            >
                              Submit Answer
                            </Button>
                          ) : (
                            <Button onClick={handleNextQuestion} className="w-full sm:w-auto px-6 gap-1.5">
                              {currentQuestionIndex + 1 >= pendingMistakes.length ? 'Finish Quiz' : 'Next Question'}
                              <ArrowRight className="size-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}
              </div>
            )}
          </div>
        ) : (
          // Main Replay Arena dashboard
          <div className="space-y-6">
            
            {/* Stats Overview */}
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
              {[
                { label: 'Total Errors', value: state.mistakes.length, icon: <RotateCcw className="size-4 text-red-400" />, bg: 'bg-red-500/10' },
                { label: 'Pending Replays', value: pendingMistakes.length, icon: <Clock className="size-4 text-amber-400" />, bg: 'bg-amber-500/10' },
                { label: 'Physics Errors', value: subjectStats.physics, icon: <HelpCircle className="size-4 text-blue-400" />, bg: 'bg-blue-500/10' },
                { label: 'Maths Errors', value: subjectStats.mathematics, icon: <HelpCircle className="size-4 text-amber-400" />, bg: 'bg-amber-500/10' },
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

            {/* Error breakdown card & explanation */}
            <Card className="border-border/40 bg-background/60">
              <CardContent className="p-4 sm:p-6 flex flex-col md:flex-row items-center gap-6 justify-between">
                <div className="space-y-2 text-center md:text-left">
                  <h3 className="text-sm font-semibold flex items-center gap-2 justify-center md:justify-start">
                    <Brain className="size-4 text-red-400" /> Error Vault Science
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-xl">
                    Every incorrect answer you submit during practice tests is logged here automatically. Retrying questions you previously failed is the fastest way to plug conceptual holes and raise your JEE percentile.
                  </p>
                </div>
                {pendingMistakes.length > 0 && (
                  <Button onClick={handleStartQuiz} className="w-full md:w-auto bg-red-500 hover:bg-red-600 text-white font-semibold gap-1.5 shrink-0 py-5">
                    <Play className="size-4 fill-current" />Start Replaying {pendingMistakes.length} Errors
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Mistake Items list */}
            <div>
              <h2 className="text-sm font-semibold mb-3">Pending Mistakes ({pendingMistakes.length})</h2>
              {pendingMistakes.length === 0 ? (
                <Card className="border-border/40 bg-background/60">
                  <CardContent className="flex flex-col items-center gap-3 py-16">
                    <CheckCircle2 className="size-10 text-emerald-400/30" />
                    <p className="text-sm font-medium text-muted-foreground">Error Vault Empty!</p>
                    <p className="text-xs text-muted-foreground/70">Take custom practice tests or daily quizzes to build your prep profile.</p>
                  </CardContent>
                </Card>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <div className="space-y-2 pr-3">
                    {pendingMistakes.map(m => {
                      const meta = SUBJECT_META[m.subject];
                      return (
                        <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border/40 bg-background/50 px-4 py-3 hover:bg-background/70 transition-colors">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${meta.bg} ${meta.color}`}>
                            {meta.label}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{m.questionText}</p>
                            <p className="text-xs text-muted-foreground truncate">{m.chapterName} · {m.topicName}</p>
                          </div>
                          <div className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                            {format(parseISO(m.timestamp), 'MMM d, h:mm a')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>
            
          </div>
        )}

      </div>
    </div>
  );
}
