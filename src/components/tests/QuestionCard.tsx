'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cleanMathText } from '@/utils/math-cleaner';
import { renderInlineMath as renderInlineMathShared } from '@/utils/rendering';
import type { TestQuestion } from '@/types';

// Test questions come from scraped/AI sources — normalize the math text first.
function renderInlineMath(text: string): React.ReactNode {
  if (typeof text !== 'string') return text;
  return renderInlineMathShared(cleanMathText(text));
}

interface QuestionCardProps {
  question: TestQuestion;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
  isFirst: boolean;
  isLast: boolean;
}

// The active-question panel during a test: subject/difficulty badges, the
// question stem, the four answer options, and prev/next navigation. Purely
// presentational — all state lives in the parent test page.
export function QuestionCard({ question, selectedIndex, onSelect, onPrev, onNext, isFirst, isLast }: QuestionCardProps) {
  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <Badge className="capitalize" variant="outline">{question.subject}</Badge>
        <Badge variant="outline" className="capitalize">{question.difficulty.replace('_', ' ')}</Badge>
      </div>

      <h2 className="text-base font-medium mb-6 leading-relaxed">{renderInlineMath(question.question)}</h2>

      <div className="space-y-3">
        {question.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={`w-full text-left rounded-lg border px-4 py-3 text-sm transition-all ${
              selectedIndex === i
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border/50 bg-card hover:border-border hover:bg-muted/30'
            }`}
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current mr-3 text-xs">
              {String.fromCharCode(65 + i)}
            </span>
            {renderInlineMath(opt)}
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrev}
          disabled={isFirst}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={isLast}
          className="gap-1"
        >
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
}
