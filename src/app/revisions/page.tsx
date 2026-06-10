'use client';

import { useState, useMemo, useEffect } from 'react';
import { useStore } from '@/store';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  RefreshCw,
  Check,
  Clock,
  AlertTriangle,
  Calendar,
  Zap,
  Atom,
  FlaskConical,
  Calculator,
  CheckCircle2,
} from 'lucide-react';
import type { RevisionItem, SubjectId } from '@/types';
import {
  format,
  parseISO,
  isToday,
  differenceInDays,
  addDays,
  startOfWeek,
  endOfWeek,
  startOfDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isBefore,
  isAfter,
} from 'date-fns';

// ---------- constants ----------

const SUBJECT_COLORS: Record<SubjectId, { bg: string; text: string; border: string; dot: string }> = {
  physics: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
    dot: 'bg-blue-400',
  },
  chemistry: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    dot: 'bg-emerald-400',
  },
  mathematics: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    dot: 'bg-amber-400',
  },
};

const SUBJECT_ICONS: Record<SubjectId, React.ReactNode> = {
  physics: <Atom className="size-3.5" />,
  chemistry: <FlaskConical className="size-3.5" />,
  mathematics: <Calculator className="size-3.5" />,
};

const REVISION_LABELS: Record<number, { label: string; interval: string }> = {
  1: { label: '1st', interval: 'Day 1' },
  2: { label: '2nd', interval: 'Day 7' },
  3: { label: '3rd', interval: 'Day 30' },
};

// ---------- helpers ----------

function getRevisionLabel(revisionNumber: number): string {
  return REVISION_LABELS[revisionNumber]?.label ?? `${revisionNumber}th`;
}

function getIntervalLabel(revisionNumber: number): string {
  return REVISION_LABELS[revisionNumber]?.interval ?? `Day ?`;
}

function getDaysOverdue(dueDate: string): number {
  const today = new Date();
  const due = parseISO(dueDate);
  const diff = differenceInDays(today, due);
  return Math.max(0, diff);
}

function formatDueDate(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    if (isToday(d)) return 'Today';
    const diff = differenceInDays(d, new Date());
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    return format(d, 'EEE, MMM d');
  } catch {
    return dateStr;
  }
}

// ---------- sub-components ----------

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <Card className="relative overflow-hidden border-border/40 bg-background/60">
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${accent}`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums leading-none">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SubjectBadge({ subject }: { subject: SubjectId }) {
  const colors = SUBJECT_COLORS[subject];
  const label = subject.charAt(0).toUpperCase() + subject.slice(1);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${colors.bg} ${colors.text}`}
    >
      {SUBJECT_ICONS[subject]}
      {label === 'Mathematics' ? 'Maths' : label}
    </span>
  );
}

function RevisionCard({
  revision,
  variant = 'default',
  onComplete,
}: {
  revision: RevisionItem;
  variant?: 'default' | 'overdue' | 'completed';
  onComplete?: () => void;
}) {
  const daysOverdue = variant === 'overdue' ? getDaysOverdue(revision.dueDate) : 0;

  return (
    <div
      className={`group flex flex-col gap-3 rounded-lg border p-3.5 transition-all sm:flex-row sm:items-center sm:justify-between ${
        variant === 'overdue'
          ? 'border-l-2 border-red-500/30 border-l-red-500 bg-red-500/5 hover:bg-red-500/10'
          : variant === 'completed'
            ? 'border-border/30 bg-background/30 opacity-70'
            : 'border-border/40 bg-background/50 hover:border-border/60 hover:bg-background/70'
      }`}
    >
      {/* Left section */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium leading-snug">{revision.topicName}</span>
            <SubjectBadge subject={revision.subject} />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{revision.chapterName}</span>
            <span className="hidden sm:inline text-border">·</span>
            <span className="flex items-center gap-1">
              <RefreshCw className="size-3" />
              {getRevisionLabel(revision.revisionNumber)} revision
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
                {getIntervalLabel(revision.revisionNumber)}
              </span>
            </span>
            {variant === 'overdue' && (
              <>
                <span className="hidden sm:inline text-border">·</span>
                <span className="flex items-center gap-1 text-red-400">
                  <AlertTriangle className="size-3" />
                  {daysOverdue} {daysOverdue === 1 ? 'day' : 'days'} overdue
                </span>
              </>
            )}
            {variant === 'completed' && revision.completedDate && (
              <>
                <span className="hidden sm:inline text-border">·</span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <Check className="size-3" />
                  Completed {format(parseISO(revision.completedDate), 'MMM d')}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right section */}
      {variant !== 'completed' && onComplete && (
        <div className="flex items-center gap-2 sm:ml-4">
          <Button
            variant={variant === 'overdue' ? 'destructive' : 'outline'}
            size="sm"
            onClick={onComplete}
            className="gap-1.5 text-xs"
          >
            <Check className="size-3.5" />
            {variant === 'overdue' ? 'Complete Now' : 'Complete'}
          </Button>
        </div>
      )}
    </div>
  );
}

function RevisionCalendar({ revisions }: { revisions: RevisionItem[] }) {
  const today = useMemo(() => new Date(), []);
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad to start on Monday
  const startDay = monthStart.getDay();
  const paddingDays = startDay === 0 ? 6 : startDay - 1;

  // Build a map of dates to revision counts
  const revisionMap = useMemo(() => {
    const map = new Map<string, { total: number; completed: number; overdue: number }>();
    for (const rev of revisions) {
      const key = rev.dueDate;
      const existing = map.get(key) || { total: 0, completed: 0, overdue: 0 };
      existing.total++;
      if (rev.completedDate) existing.completed++;
      else if (isBefore(parseISO(rev.dueDate), startOfDay(today)) && !isToday(parseISO(rev.dueDate))) existing.overdue++;
      map.set(key, existing);
    }
    return map;
  }, [revisions, today]);

  return (
    <Card className="border-border/40 bg-background/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Calendar className="size-4 text-primary" />
          {format(today, 'MMMM yyyy')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Day headers */}
        <div className="mb-2 grid grid-cols-7 gap-1">
          {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
            <div key={d} className="text-center text-[10px] font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Padding cells */}
          {Array.from({ length: paddingDays }).map((_, i) => (
            <div key={`pad-${i}`} className="aspect-square" />
          ))}

          {/* Day cells */}
          {calendarDays.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const info = revisionMap.get(key);
            const isCurrentDay = isToday(day);

            return (
              <div
                key={key}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-md text-xs transition-colors ${
                  isCurrentDay
                    ? 'bg-primary/20 font-bold text-primary ring-1 ring-primary/30'
                    : 'text-muted-foreground hover:bg-muted/30'
                }`}
              >
                <span className="tabular-nums">{format(day, 'd')}</span>
                {info && info.total > 0 && (
                  <div className="mt-0.5 flex items-center gap-0.5">
                    {info.overdue > 0 && <span className="size-1.5 rounded-full bg-red-400" />}
                    {info.total - info.completed - info.overdue > 0 && (
                      <span className="size-1.5 rounded-full bg-blue-400" />
                    )}
                    {info.completed > 0 && <span className="size-1.5 rounded-full bg-emerald-400" />}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-blue-400" /> Pending
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-emerald-400" /> Completed
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-red-400" /> Overdue
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 text-muted-foreground/30">{icon}</div>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground/70">{description}</p>
    </div>
  );
}

// ---------- main page ----------

export default function RevisionsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const { state, dispatch, getTodaysRevisions, getOverdueRevisions } = useStore();

  const todaysRevisions = getTodaysRevisions();
  const overdueRevisions = getOverdueRevisions();
  // Completed this week
  const completedThisWeek = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    return state.revisions.filter((r) => {
      if (!r.completedDate) return false;
      const completed = parseISO(r.completedDate);
      return !isBefore(completed, weekStart) && !isAfter(completed, weekEnd);
    });
  }, [state.revisions]);

  // Upcoming revisions (next 7 days, excluding today)
  const upcomingRevisions = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const next7 = format(addDays(new Date(), 7), 'yyyy-MM-dd');
    return state.revisions
      .filter((r) => !r.completedDate && r.dueDate > today && r.dueDate <= next7)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [state.revisions]);

  // Group upcoming by date
  const upcomingGrouped = useMemo(() => {
    const groups = new Map<string, RevisionItem[]>();
    for (const rev of upcomingRevisions) {
      const existing = groups.get(rev.dueDate) || [];
      existing.push(rev);
      groups.set(rev.dueDate, existing);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [upcomingRevisions]);

  // Recently completed (last 20)
  const recentlyCompleted = useMemo(() => {
    return state.revisions
      .filter((r) => r.completedDate)
      .sort((a, b) => (b.completedDate ?? '').localeCompare(a.completedDate ?? ''))
      .slice(0, 20);
  }, [state.revisions]);

  if (!mounted) {
    return (
      <div className="flex min-h-full items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-xs text-muted-foreground">Loading revision engine...</p>
        </div>
      </div>
    );
  }

  // Handlers
  const handleComplete = (revision: RevisionItem) => {
    dispatch({
      type: 'COMPLETE_REVISION',
      payload: { topicId: revision.topicId, revisionNumber: revision.revisionNumber },
    });
    dispatch({
      type: 'UPDATE_TOPIC_STATUS',
      payload: { topicId: revision.topicId, status: 'revised' },
    });
  };

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 space-y-1">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
              <RefreshCw className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Revision Engine</h1>
              <p className="text-sm text-muted-foreground">
                Spaced repetition to lock in your knowledge · Day 1 → Day 7 → Day 30
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Pending today"
            value={todaysRevisions.length}
            icon={<Clock className="size-5 text-blue-400" />}
            accent="bg-blue-500/10"
          />
          <StatCard
            label="Overdue"
            value={overdueRevisions.length}
            icon={<AlertTriangle className="size-5 text-red-400" />}
            accent="bg-red-500/10"
          />
          <StatCard
            label="Completed this week"
            value={completedThisWeek.length}
            icon={<CheckCircle2 className="size-5 text-emerald-400" />}
            accent="bg-emerald-500/10"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          {/* Main content */}
          <div>
            <Tabs defaultValue="today">
            <div className="w-full overflow-x-auto pb-1 scrollbar-none mb-6">
              <TabsList className="flex w-max min-w-full mb-0">
                <TabsTrigger value="today">
                  <Clock className="size-3.5" />
                  Today
                  {todaysRevisions.length > 0 && (
                    <span className="ml-1 flex size-5 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold tabular-nums text-primary">
                      {todaysRevisions.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="upcoming">
                  <Calendar className="size-3.5" />
                  Upcoming
                </TabsTrigger>
                <TabsTrigger value="overdue">
                  <AlertTriangle className="size-3.5" />
                  Overdue
                  {overdueRevisions.length > 0 && (
                    <span className="ml-1 flex size-5 items-center justify-center rounded-full bg-red-500/20 text-[10px] font-bold tabular-nums text-red-400">
                      {overdueRevisions.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="completed">
                  <Check className="size-3.5" />
                  Completed
                </TabsTrigger>
              </TabsList>
            </div>

              {/* Today Tab */}
              <TabsContent value="today">
                {todaysRevisions.length > 0 ? (
                  <div className="space-y-2">
                    {todaysRevisions.map((rev) => (
                      <RevisionCard
                        key={`${rev.topicId}-${rev.revisionNumber}`}
                        revision={rev}
                        variant="default"
                        onComplete={() => handleComplete(rev)}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<CheckCircle2 className="size-10" />}
                    title="All caught up!"
                    description="No revisions scheduled for today. Complete topics to generate revision schedules."
                  />
                )}
              </TabsContent>

              {/* Upcoming Tab */}
              <TabsContent value="upcoming">
                {upcomingGrouped.length > 0 ? (
                  <div className="space-y-6">
                    {upcomingGrouped.map(([date, revisions]) => (
                      <div key={date}>
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {formatDueDate(date)}
                          </span>
                          <div className="h-px flex-1 bg-border/30" />
                          <Badge variant="secondary" className="text-[10px] tabular-nums">
                            {revisions.length}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          {revisions.map((rev) => (
                            <RevisionCard
                              key={`${rev.topicId}-${rev.revisionNumber}`}
                              revision={rev}
                              variant="default"
                              onComplete={() => handleComplete(rev)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Calendar className="size-10" />}
                    title="No upcoming revisions"
                    description="Revisions will appear here once you complete topics in the syllabus tracker."
                  />
                )}
              </TabsContent>

              {/* Overdue Tab */}
              <TabsContent value="overdue">
                {overdueRevisions.length > 0 ? (
                  <div className="space-y-2">
                    {overdueRevisions
                      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                      .map((rev) => (
                        <RevisionCard
                          key={`${rev.topicId}-${rev.revisionNumber}`}
                          revision={rev}
                          variant="overdue"
                          onComplete={() => handleComplete(rev)}
                        />
                      ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<Zap className="size-10" />}
                    title="No overdue revisions"
                    description="Great work! You're staying on top of your revision schedule."
                  />
                )}
              </TabsContent>

              {/* Completed Tab */}
              <TabsContent value="completed">
                {recentlyCompleted.length > 0 ? (
                  <ScrollArea className="max-h-[600px]">
                    <div className="space-y-2 pr-3">
                      {recentlyCompleted.map((rev) => (
                        <RevisionCard
                          key={`${rev.topicId}-${rev.revisionNumber}-completed`}
                          revision={rev}
                          variant="completed"
                        />
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <EmptyState
                    icon={<Check className="size-10" />}
                    title="No completed revisions yet"
                    description="Complete your scheduled revisions and they'll appear here."
                  />
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar — Calendar */}
          <div className="space-y-4">
            <RevisionCalendar revisions={state.revisions} />

            {/* Quick summary card */}
            <Card className="border-border/40 bg-background/60">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Zap className="size-4 text-amber-400" />
                  How it works
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-xs text-muted-foreground">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-[10px] font-bold text-blue-400">
                    1
                  </span>
                  <p>
                    <span className="font-medium text-foreground">Day 1</span> — Quick recall test right after
                    learning
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-indigo-500/10 text-[10px] font-bold text-indigo-400">
                    2
                  </span>
                  <p>
                    <span className="font-medium text-foreground">Day 7</span> — Reinforce before the forgetting
                    curve kicks in
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-purple-500/10 text-[10px] font-bold text-purple-400">
                    3
                  </span>
                  <p>
                    <span className="font-medium text-foreground">Day 30</span> — Lock it into long-term memory
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
