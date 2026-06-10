'use client';

import React from 'react';
import { useStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { CalendarDays, RefreshCw, Sparkles, Clock, BookOpen, ClipboardCheck, Coffee } from 'lucide-react';
import { format } from 'date-fns';


const typeIcons: Record<string, React.ElementType> = {
  study: BookOpen,
  revision: RefreshCw,
  practice: ClipboardCheck,
  test: ClipboardCheck,
  break: Coffee,
};

const typeColors: Record<string, string> = {
  study: 'text-blue-400',
  revision: 'text-green-400',
  practice: 'text-amber-400',
  test: 'text-purple-400',
  break: 'text-muted-foreground',
};

export default function PlannerPage() {
  const { state, dispatch, generateDailyPlan } = useStore();

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayPlan = state.dailyPlans.find(p => p.date === today);

  const handleGenerate = () => {
    const plan = generateDailyPlan();
    dispatch({ type: 'UPDATE_DAILY_PLAN', payload: plan });
  };

  const handleToggleTask = (taskId: string) => {
    if (!todayPlan) return;
    dispatch({ type: 'COMPLETE_PLAN_TASK', payload: { planId: todayPlan.id, taskId } });
  };

  const completedCount = todayPlan?.tasks.filter(t => t.completed).length ?? 0;
  const totalCount = todayPlan?.tasks.length ?? 0;
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const totalMinutes = todayPlan?.tasks.reduce((s, t) => s + t.duration, 0) ?? 0;
  const completedMinutes = todayPlan?.tasks.filter(t => t.completed).reduce((s, t) => s + t.duration, 0) ?? 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
            <CalendarDays className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Daily Planner</h1>
            <p className="text-xs text-muted-foreground">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
          </div>
        </div>
        <Button onClick={handleGenerate} variant="outline" size="sm" className="gap-2">
          <Sparkles className="h-3.5 w-3.5" />
          {todayPlan ? 'Regenerate Plan' : 'Generate Plan'}
        </Button>
      </div>

      {!todayPlan ? (
        /* No Plan Yet */
        <Card className="bg-card border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CalendarDays className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-base font-medium mb-1">No plan for today</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
              Generate an AI-powered daily study plan based on your revision backlog, weak topics, and upcoming tests.
            </p>
            <Button onClick={handleGenerate} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Generate Today&apos;s Plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Progress Overview */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="bg-card border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Tasks</span>
                  <span className="text-xs font-medium">{completedCount}/{totalCount}</span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Study Time</span>
                </div>
                <p className="mt-1 text-xl font-bold">{Math.round(completedMinutes / 60 * 10) / 10}h <span className="text-sm text-muted-foreground font-normal">/ {Math.round(totalMinutes / 60 * 10) / 10}h</span></p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Progress</span>
                </div>
                <p className="mt-1 text-xl font-bold">{progressPercentage}%</p>
              </CardContent>
            </Card>
          </div>

          {/* Timeline */}
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Today&apos;s Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {todayPlan.tasks.map((task) => {
                  const Icon = typeIcons[task.type] || BookOpen;
                  return (
                    <div
                      key={task.id}
                      className={`flex items-start gap-3 rounded-lg px-3 py-3 transition-colors ${
                        task.completed ? 'opacity-50' : 'hover:bg-muted/30'
                      }`}
                    >
                      <Checkbox
                        checked={task.completed}
                        onCheckedChange={() => handleToggleTask(task.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground font-mono">{task.time}</span>
                          <Icon className={`h-3.5 w-3.5 ${typeColors[task.type]}`} />
                          <span className={`text-sm font-medium ${task.completed ? 'line-through' : ''}`}>
                            {task.title}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0 mt-1 sm:mt-0">
                        <Badge variant="outline" className="text-[10px]">{task.duration}min</Badge>
                        {task.subject && (
                          <Badge variant="outline" className="text-[10px] capitalize">{task.subject}</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
