'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Play,
  Clock,
  Trophy,
  Target,
  BarChart3,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { SubjectId } from '@/types';

const SUBJECT_COLORS: Record<string, string> = {
  physics: '#6366f1',
  chemistry: '#22c55e',
  mathematics: '#f59e0b',
};

interface MockTemplate {
  id: string;
  title: string;
  type: 'mock_main' | 'mock_advanced';
  description: string;
  duration: string;
  questions: number;
  marks: number;
  subjects: SubjectId[];
  params?: string;
}

const mockTemplates: MockTemplate[] = [
  {
    id: 'mock-main-full',
    title: 'JEE Main Full Mock',
    type: 'mock_main',
    description: 'Complete JEE Main pattern with Physics, Chemistry & Mathematics',
    duration: '3 hours',
    questions: 75,
    marks: 300,
    subjects: ['physics', 'chemistry', 'mathematics'],
  },
  {
    id: 'mock-adv-full',
    title: 'JEE Advanced Full Mock',
    type: 'mock_advanced',
    description: 'Complete JEE Advanced pattern with Paper 1 format',
    duration: '3 hours',
    questions: 54,
    marks: 186,
    subjects: ['physics', 'chemistry', 'mathematics'],
  },
  {
    id: 'mock-main-phy',
    title: 'Physics Section Mock',
    type: 'mock_main',
    description: 'JEE Main Physics section only',
    duration: '1 hour',
    questions: 25,
    marks: 100,
    subjects: ['physics'],
  },
  {
    id: 'mock-main-chem',
    title: 'Chemistry Section Mock',
    type: 'mock_main',
    description: 'JEE Main Chemistry section only',
    duration: '1 hour',
    questions: 25,
    marks: 100,
    subjects: ['chemistry'],
  },
  {
    id: 'mock-main-math',
    title: 'Mathematics Section Mock',
    type: 'mock_main',
    description: 'JEE Main Mathematics section only',
    duration: '1 hour',
    questions: 25,
    marks: 100,
    subjects: ['mathematics'],
  },
  {
    id: 'mock-ch5-linear-inequalities',
    title: 'Linear Inequalities (Ch 5)',
    type: 'mock_main',
    description: 'Class 11 NCERT Chapter 5 - Linear Inequalities Exercise 6.1',
    duration: '30 min',
    questions: 15,
    marks: 60,
    subjects: ['mathematics'],
    params: 'subjects=mathematics&topics=math-alg-inequalities&count=15&difficulty=medium&type=chapter&title=Linear%20Inequalities%20-%20Ch%205',
  },
];

export default function MocksPage() {
  const { state } = useStore();
  // Bug 8 fix: use Next.js router instead of window.location so navigation
  // doesn't trigger a full page reload (which would reset ephemeral state).
  const router = useRouter();

  // Filter mock test attempts
  const mockAttempts = state.testAttempts.filter(
    t => t.type === 'mock_main' || t.type === 'mock_advanced'
  );

  // Stats
  const totalMocks = mockAttempts.length;
  const bestScore = mockAttempts.length > 0
    ? Math.max(...mockAttempts.map(t => Math.round((t.score / Math.max(t.maxScore, 1)) * 100)))
    : 0;
  const avgScore = mockAttempts.length > 0
    ? Math.round(mockAttempts.reduce((s, t) => s + (t.score / Math.max(t.maxScore, 1)) * 100, 0) / mockAttempts.length)
    : 0;
  const totalTime = mockAttempts.reduce((s, t) => s + t.timeSpent, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Mock Tests</h1>
          <p className="text-xs text-muted-foreground">Full-length JEE Main & Advanced mock tests</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="bg-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Mocks Taken</span>
            </div>
            <p className="text-2xl font-bold">{totalMocks}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="h-4 w-4 text-amber-400" />
              <span className="text-xs text-muted-foreground">Best Score</span>
            </div>
            <p className="text-2xl font-bold">{bestScore}%</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-green-400" />
              <span className="text-xs text-muted-foreground">Avg Score</span>
            </div>
            <p className="text-2xl font-bold">{avgScore}%</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-blue-400" />
              <span className="text-xs text-muted-foreground">Total Time</span>
            </div>
            <p className="text-2xl font-bold">{Math.round(totalTime / 3600)}h</p>
          </CardContent>
        </Card>
      </div>

      {/* Available Mocks */}
      <div>
        <h2 className="text-sm font-medium mb-3">Available Mock Tests</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {mockTemplates.map(mock => (
            <Card key={mock.id} className="bg-card border-border/50 hover:border-border transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-medium">{mock.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{mock.description}</p>
                  </div>
                  <Badge variant={mock.type === 'mock_advanced' ? 'destructive' : 'default'} className="text-[10px] shrink-0">
                    {mock.type === 'mock_advanced' ? 'Advanced' : 'Main'}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mb-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{mock.duration}</span>
                  <span>{mock.questions} Qs</span>
                  <span>{mock.marks} marks</span>
                </div>
                <div className="flex items-center gap-1.5 mb-3">
                  {mock.subjects.map(s => (
                    <div key={s} className="h-2 flex-1 rounded-full" style={{ backgroundColor: `${SUBJECT_COLORS[s]}40` }}>
                      <div className="h-full rounded-full" style={{ backgroundColor: SUBJECT_COLORS[s], width: '100%' }} />
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={() => router.push(mock.params ? `/tests?${mock.params}` : '/tests')}
                >
                  <Play className="h-3.5 w-3.5" />
                  Start Mock
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Previous Attempts */}
      {mockAttempts.length > 0 && (
        <div>
          <h2 className="text-sm font-medium mb-3">Previous Attempts</h2>
          <div className="space-y-2">
            {mockAttempts.map(attempt => {
              const percentage = Math.round((attempt.score / Math.max(attempt.maxScore, 1)) * 100);
              return (
                <Card key={attempt.id} className="bg-card border-border/50">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${percentage >= 70 ? 'bg-green-500/15' : percentage >= 40 ? 'bg-amber-500/15' : 'bg-red-500/15'}`}>
                        <span className={`text-sm font-bold ${percentage >= 70 ? 'text-green-400' : percentage >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                          {percentage}%
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{attempt.title}</p>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span>{format(parseISO(attempt.date), 'MMM dd, yyyy')}</span>
                          <span>{attempt.score}/{attempt.maxScore} marks</span>
                          <span>{Math.round(attempt.timeSpent / 60)} min</span>
                        </div>
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-3">
                      {attempt.subjectBreakdown.map(sb => (
                        <div key={sb.subject} className="text-center">
                          <p className="text-xs font-medium capitalize" style={{ color: SUBJECT_COLORS[sb.subject] }}>
                            {Math.round((sb.correct / Math.max(sb.total, 1)) * 100)}%
                          </p>
                          <p className="text-[9px] text-muted-foreground capitalize">{sb.subject}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {mockAttempts.length === 0 && (
        <Card className="bg-card border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <h3 className="text-sm font-medium mb-1">No mock tests taken yet</h3>
            <p className="text-xs text-muted-foreground text-center max-w-sm">
              Take full-length mock tests to simulate the real JEE exam experience and track your performance.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
