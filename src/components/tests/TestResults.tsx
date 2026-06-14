'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trophy, Sparkles, Brain, RotateCcw, Check, X } from 'lucide-react';
import { cleanMathText } from '@/utils/math-cleaner';
import { renderInlineMath as renderInlineMathShared } from '@/utils/rendering';
import type { TestQuestion, ErrorType } from '@/types';

function renderInlineMath(text: string): React.ReactNode {
  if (typeof text !== 'string') return text;
  return renderInlineMathShared(cleanMathText(text));
}

const ERROR_TYPES: { value: ErrorType; label: string }[] = [
  { value: 'concept_gap', label: 'Concept Gap' },
  { value: 'formula_forgotten', label: 'Formula Forgotten' },
  { value: 'calculation_mistake', label: 'Calculation Mistake' },
  { value: 'time_pressure', label: 'Time Pressure' },
  { value: 'misread_question', label: 'Misread Question' },
  { value: 'guessing_error', label: 'Guessing Error' },
];

export interface ScoreSummary {
  correct: number;
  wrong: number;
  unanswered: number;
  marks: number;
  total: number;
}

interface TestResultsProps {
  score: ScoreSummary;
  timer: number;
  formatTime: (seconds: number) => string;
  questions: TestQuestion[];
  answers: (number | null)[];
  errors: { questionIndex: number; errorType: ErrorType }[];
  reportText: string;
  isGeneratingReport: boolean;
  onGenerateReport: () => void;
  onClassifyError: (questionIndex: number, errorType: ErrorType) => void;
  onSave: () => void;
  onNewTest: () => void;
}

// The post-test results screen: score card, AI strategist diagnostic, per-
// question review with error classification, and save / new-test actions.
// Purely presentational — all state and handlers come from the parent.
export function TestResults({
  score,
  timer,
  formatTime,
  questions,
  answers,
  errors,
  reportText,
  isGeneratingReport,
  onGenerateReport,
  onClassifyError,
  onSave,
  onNewTest,
}: TestResultsProps) {
  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Score Card */}
      <Card className="bg-card border-border/50">
        <CardContent className="p-6 text-center">
          <Trophy className="h-10 w-10 mx-auto mb-3 text-amber-400" />
          <h2 className="text-2xl font-bold">{score.marks}/{score.total}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {score.total > 0
              ? Math.round((Math.max(score.marks, 0) / score.total) * 100)
              : 0}% accuracy • {formatTime(timer)}
          </p>
          <div className="flex justify-center gap-4 mt-4">
            <div className="text-center">
              <p className="text-lg font-bold text-green-400">{score.correct}</p>
              <p className="text-[10px] text-muted-foreground">Correct (+4)</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-red-400">{score.wrong}</p>
              <p className="text-[10px] text-muted-foreground">Wrong (-1)</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-muted-foreground">{score.unanswered}</p>
              <p className="text-[10px] text-muted-foreground">Skipped (0)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Test Strategist Diagnostic */}
      <Card className="bg-card border-border/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-3 opacity-15">
          <Sparkles className="size-16 text-primary animate-pulse" />
        </div>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-[18px] w-[18px] text-primary animate-pulse" />
            <CardTitle className="text-sm font-semibold">AI Test Strategist Diagnostic</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Generate a personalized strategic review of this test attempt to improve your next score
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!reportText && !isGeneratingReport ? (
            <div className="flex flex-col items-center justify-center p-6 text-center border border-dashed border-border/40 rounded-lg bg-muted/10">
              <Sparkles className="h-8 w-8 text-primary/40 mb-2" />
              <p className="text-xs text-muted-foreground">Ready to analyze your attempt strategy, accuracy speed ratio, and cognitive error profiles.</p>
              <Button size="sm" onClick={onGenerateReport} className="mt-3 gap-1.5 cursor-pointer">
                <Brain className="h-3.5 w-3.5" /> Generate AI Strategy Report
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg bg-zinc-950/70 border border-border/60 p-4 min-h-[120px] text-xs leading-relaxed font-sans text-zinc-300 whitespace-pre-line">
                {renderInlineMath(reportText)}
                {isGeneratingReport && (
                  <span className="inline-block w-1.5 h-3.5 ml-1 bg-primary animate-pulse align-middle" />
                )}
              </div>
              {isGeneratingReport && (
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping"></span>
                  Streaming strategist recommendations...
                </div>
              )}
              {!isGeneratingReport && (
                <div className="flex justify-end">
                  <Button size="xs" variant="outline" onClick={onGenerateReport} className="gap-1 cursor-pointer">
                    <RotateCcw className="h-3 w-3" /> Regenerate Report
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Question Review */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Question Review</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {questions.map((q, i) => {
            const isCorrect = answers[i] === q.correctAnswer;
            const isUnanswered = answers[i] === null;
            return (
              <div key={q.id} className={`rounded-lg border p-4 ${isCorrect ? 'border-green-500/30 bg-green-500/5' : isUnanswered ? 'border-border/50' : 'border-red-500/30 bg-red-500/5'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">Q{i + 1}</span>
                    {isCorrect ? (
                      <Check className="h-4 w-4 text-green-400" />
                    ) : isUnanswered ? (
                      <span className="text-xs text-muted-foreground">Skipped</span>
                    ) : (
                      <X className="h-4 w-4 text-red-400" />
                    )}
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize">{q.subject}</Badge>
                </div>
                <p className="text-sm mb-2">{renderInlineMath(q.question)}</p>
                <div className="space-y-1 mb-2">
                  {q.options.map((opt, oi) => (
                    <div key={oi} className={`text-xs px-2 py-1 rounded ${
                      oi === q.correctAnswer ? 'text-green-400 bg-green-500/10' :
                      oi === answers[i] && oi !== q.correctAnswer ? 'text-red-400 bg-red-500/10' :
                      'text-muted-foreground'
                    }`}>
                      {String.fromCharCode(65 + oi)}. {renderInlineMath(opt)}
                      {oi === q.correctAnswer && ' ✓'}
                      {oi === answers[i] && oi !== q.correctAnswer && ' (your answer)'}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground italic mb-2">{renderInlineMath(q.explanation)}</p>

                {/* Error Classification */}
                {!isCorrect && !isUnanswered && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/30">
                    <span className="text-[10px] text-muted-foreground">Error type:</span>
                    <Select
                      value={errors.find(e => e.questionIndex === i)?.errorType || ''}
                      onValueChange={(v) => v && onClassifyError(i, v as ErrorType)}
                    >
                      <SelectTrigger className="h-7 text-[10px] w-40">
                        <SelectValue placeholder="Classify..." />
                      </SelectTrigger>
                      <SelectContent>
                        {ERROR_TYPES.map(et => (
                          <SelectItem key={et.value} value={et.value} className="text-xs">{et.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={onSave} className="flex-1 gap-2">
          <Check className="h-4 w-4" /> Save Results
        </Button>
        <Button variant="outline" onClick={onNewTest} className="gap-2">
          <RotateCcw className="h-4 w-4" /> New Test
        </Button>
      </div>
    </div>
  );
}
