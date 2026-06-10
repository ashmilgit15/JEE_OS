'use client';

import { useState, useMemo, useEffect } from 'react';
import { useStore } from '@/store';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  Search,
  Star,
  Check,
  Atom,
  FlaskConical,
  Calculator,
  Eye,
  EyeOff,
  Sparkles,
  GraduationCap,
  Clock,
  Target,
  Brain,
} from 'lucide-react';
import type { SubjectId, TopicStatus, Topic, Chapter, Subject } from '@/types';

// ---------- constants ----------

const STATUS_CONFIG: Record<TopicStatus, { label: string; color: string; bgColor: string; dotColor: string }> = {
  not_started: {
    label: 'Not Started',
    color: 'status-not-started',
    bgColor: 'bg-status-not-started',
    dotColor: 'bg-[oklch(0.55_0.02_270)]',
  },
  learning: {
    label: 'Learning',
    color: 'status-learning',
    bgColor: 'bg-status-learning',
    dotColor: 'bg-[oklch(0.75_0.15_50)]',
  },
  completed: {
    label: 'Completed',
    color: 'status-completed',
    bgColor: 'bg-status-completed',
    dotColor: 'bg-[oklch(0.65_0.18_260)]',
  },
  revised: {
    label: 'Revised',
    color: 'status-revised',
    bgColor: 'bg-status-revised',
    dotColor: 'bg-[oklch(0.70_0.15_150)]',
  },
  mastered: {
    label: 'Mastered',
    color: 'status-mastered',
    bgColor: 'bg-status-mastered',
    dotColor: 'bg-[oklch(0.75_0.14_330)]',
  },
};

const SUBJECT_META: Record<SubjectId, { icon: React.ReactNode; gradient: string; ring: string }> = {
  physics: {
    icon: <Atom className="size-5" />,
    gradient: 'from-blue-500/20 to-indigo-500/10',
    ring: 'ring-blue-500/20',
  },
  chemistry: {
    icon: <FlaskConical className="size-5" />,
    gradient: 'from-emerald-500/20 to-teal-500/10',
    ring: 'ring-emerald-500/20',
  },
  mathematics: {
    icon: <Calculator className="size-5" />,
    gradient: 'from-amber-500/20 to-orange-500/10',
    ring: 'ring-amber-500/20',
  },
};

// ---------- helpers ----------

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
  } catch {
    return '—';
  }
}

function getChapterProgress(chapter: Chapter) {
  const total = chapter.topics.length;
  const completed = chapter.topics.filter(
    (t) => t.status === 'completed' || t.status === 'revised' || t.status === 'mastered',
  ).length;
  return { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
}

// ---------- sub-components ----------

function ConfidenceStars({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="group/star p-0.5 transition-transform hover:scale-110 focus:outline-none"
          aria-label={`Set confidence to ${star}`}
        >
          <Star
            className={`size-3.5 transition-colors ${
              star <= value
                ? 'fill-amber-400 text-amber-400'
                : 'fill-transparent text-muted-foreground/40 group-hover/star:text-amber-400/50'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: TopicStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${cfg.bgColor} ${cfg.color}`}
    >
      <span className={`inline-block size-1.5 rounded-full ${cfg.dotColor}`} />
      {cfg.label}
    </span>
  );
}

function SubjectProgressCard({
  subject,
  stats,
}: {
  subject: Subject;
  stats: { total: number; completed: number; mastered: number; avgConfidence: number; avgAccuracy: number };
}) {
  const meta = SUBJECT_META[subject.id as SubjectId];
  const percent = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <Card className={`relative overflow-hidden bg-gradient-to-br ${meta.gradient} ring-1 ${meta.ring}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-background/60 backdrop-blur-sm">
            {meta.icon}
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">{subject.name}</CardTitle>
            <CardDescription className="text-xs">
              {stats.completed}/{stats.total} topics
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Completion</span>
            <span className="font-semibold tabular-nums">{percent}%</span>
          </div>
          <Progress value={percent} />
        </div>
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="text-center">
            <p className="text-lg font-bold tabular-nums leading-none">{stats.mastered}</p>
            <p className="mt-1 text-[9px] min-[370px]:text-[10px] text-muted-foreground">Mastered</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold tabular-nums leading-none">
              {stats.avgConfidence > 0 ? stats.avgConfidence.toFixed(1) : '—'}
            </p>
            <p className="mt-1 text-[9px] min-[370px]:text-[10px] text-muted-foreground">Avg Confidence</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold tabular-nums leading-none">
              {stats.avgAccuracy > 0 ? `${Math.round(stats.avgAccuracy)}%` : '—'}
            </p>
            <p className="mt-1 text-[9px] min-[370px]:text-[10px] text-muted-foreground">Avg Accuracy</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TopicRow({
  topic,
  onStatusChange,
  onConfidenceChange,
  onExcludeToggle,
  activeGap,
  isHighlighted,
}: {
  topic: Topic;
  chapter: Chapter;
  subject: Subject;
  onStatusChange: (topicId: string, status: TopicStatus) => void;
  onConfidenceChange: (topicId: string, confidence: number) => void;
  onExcludeToggle: (topicId: string) => void;
  activeGap?: { topicId: string; topicName: string; dependentId: string; dependentName: string; reason: string };
  isHighlighted?: boolean;
}) {
  const nextActions: { status: TopicStatus; label: string; icon: React.ReactNode }[] = [];

  if (topic.status === 'not_started') {
    nextActions.push({ status: 'learning', label: 'Start Learning', icon: <BookOpen className="size-3" /> });
  }
  if (topic.status === 'learning') {
    nextActions.push({ status: 'completed', label: 'Mark Completed', icon: <Check className="size-3" /> });
  }
  if (topic.status === 'completed') {
    nextActions.push({ status: 'revised', label: 'Mark Revised', icon: <Eye className="size-3" /> });
  }
  if (topic.status === 'revised') {
    nextActions.push({ status: 'mastered', label: 'Mark Mastered', icon: <Sparkles className="size-3" /> });
  }
  // Always allow going back to learning if not not_started
  if (topic.status !== 'not_started' && topic.status !== 'learning') {
    nextActions.push({ status: 'learning', label: 'Reset to Learning', icon: <BookOpen className="size-3" /> });
  }

  return (
    <div
      id={`topic-${topic.id}`}
      className={`group/topic flex flex-col gap-3 rounded-lg border p-3 transition-colors sm:flex-row sm:items-center sm:gap-4 ${topic.excluded ? 'opacity-50 border-dashed border-red-950/40 bg-red-950/5' : 'border-border/50 bg-background/40 hover:border-border hover:bg-background/70'} ${isHighlighted ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/30' : ''}`}
    >
      {/* Topic info */}
      <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          <span className="text-sm font-medium leading-snug">{topic.name}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={topic.status} />
            {topic.excluded && (
              <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 text-[9px] py-0 px-2 flex items-center">
                <span>Excluded from Scope</span>
              </Badge>
            )}
            {activeGap && (
              <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px] py-0 px-2 flex items-center gap-1">
                <span>⚠️ Gap: Needs {activeGap.topicName}</span>
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Metrics row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground sm:gap-x-5">
        {/* Confidence stars */}
        <div className="flex items-center gap-1.5">
          <span className="hidden sm:inline">Confidence</span>
          <ConfidenceStars value={topic.confidence} onChange={(v) => onConfidenceChange(topic.id, v)} />
        </div>

        {/* Accuracy */}
        <div className="flex items-center gap-1">
          <Target className="size-3" />
          <span className="tabular-nums">{topic.accuracy > 0 ? `${topic.accuracy}%` : '—'}</span>
        </div>

        {/* Last revision */}
        <div className="flex items-center gap-1">
          <Clock className="size-3" />
          <span className="tabular-nums">{formatDate(topic.lastRevision)}</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-1.5">
        {nextActions.map((action) => (
          <Button
            key={action.status + action.label}
            variant="outline"
            size="xs"
            onClick={() => onStatusChange(topic.id, action.status)}
            className="gap-1 text-xs sm:text-[11px] h-8 sm:h-6 py-1.5 sm:py-1 px-3 sm:px-2 cursor-pointer"
            disabled={topic.excluded}
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
        <Button
          variant="outline"
          size="xs"
          onClick={() => onExcludeToggle(topic.id)}
          className={`h-8 sm:h-6 w-8 sm:w-6 p-0 rounded cursor-pointer ${
            topic.excluded
              ? "text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border-red-500/30"
              : "text-zinc-500 hover:text-zinc-300 bg-zinc-900/50 hover:bg-zinc-800 border-zinc-800"
          }`}
          title={topic.excluded ? "Include in readiness score" : "Exclude from readiness score"}
        >
          {topic.excluded ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
        </Button>
      </div>
    </div>
  );
}

function ChapterAccordionItem({
  chapter,
  subject,
  searchQuery,
  onStatusChange,
  onConfidenceChange,
  onExcludeToggle,
  prereqGaps,
  locatedTopicId,
}: {
  chapter: Chapter;
  subject: Subject;
  searchQuery: string;
  onStatusChange: (topicId: string, status: TopicStatus) => void;
  onConfidenceChange: (topicId: string, confidence: number) => void;
  onExcludeToggle: (topicId: string) => void;
  prereqGaps: any[];
  locatedTopicId: string | null;
}) {
  const prog = getChapterProgress(chapter);
  const query = searchQuery.toLowerCase().trim();
  const filteredTopics = query
    ? chapter.topics.filter((t) => t.name.toLowerCase().includes(query))
    : chapter.topics;

  if (query && filteredTopics.length === 0) return null;

  return (
    <AccordionItem value={chapter.id} className="border-border/40">
      <AccordionTrigger className="px-1 hover:no-underline">
        <div className="flex w-full flex-col gap-2 pr-2 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-center gap-2.5">
            <span className="text-lg leading-none">{chapter.icon}</span>
            <span className="text-sm font-semibold">{chapter.name}</span>
          </div>
          <div className="flex flex-1 items-center gap-3 sm:ml-auto sm:justify-end">
            <div className="hidden w-32 sm:block">
              <Progress value={prog.percent} />
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">
              {prog.completed}/{prog.total} topics
            </span>
            <Badge variant="secondary" className="text-[10px] tabular-nums">
              {prog.percent}%
            </Badge>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-1">
        <div className="space-y-2 pb-2 pt-1">
          {filteredTopics.map((topic) => (
            <TopicRow
              key={topic.id}
              topic={topic}
              chapter={chapter}
              subject={subject}
              onStatusChange={onStatusChange}
              onConfidenceChange={onConfidenceChange}
              onExcludeToggle={onExcludeToggle}
              activeGap={prereqGaps.find((g) => g.dependentId === topic.id)}
              isHighlighted={locatedTopicId === topic.id}
            />
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

// ---------- main page ----------

export default function SyllabusPage() {
  const {
    state,
    dispatch,
    getSubjectStats,
    completeTopicWithRevisions,
    getTopicById,
    getPrerequisiteGaps,
    getOverdueRevisions,
    toggleTopicExclusion,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'all' | SubjectId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBySubject, setExpandedBySubject] = useState<Record<string, string[]>>({});
  const [locateTarget, setLocateTarget] = useState<{ subjectId: string; chapterId: string; topicId: string } | null>(null);

  // Compute subject stats
  const physicsStats = getSubjectStats('physics');
  const chemistryStats = getSubjectStats('chemistry');
  const mathematicsStats = getSubjectStats('mathematics');

  // Get filtered subjects
  const filteredSubjects = useMemo(() => {
    if (activeTab === 'all') return state.syllabus;
    return state.syllabus.filter((s) => s.id === activeTab);
  }, [activeTab, state.syllabus]);

  // Compute overall stats
  const overallStats = useMemo(() => {
    const total = physicsStats.total + chemistryStats.total + mathematicsStats.total;
    const completed = physicsStats.completed + chemistryStats.completed + mathematicsStats.completed;
    return { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [physicsStats, chemistryStats, mathematicsStats]);

  // Get prerequisite gaps list
  const prereqGaps = useMemo(() => {
    return getPrerequisiteGaps ? getPrerequisiteGaps() : [];
  }, [getPrerequisiteGaps]);

  // AI Strategy Recommender Engine
  const recommendedTopic = useMemo(() => {
    const subjectsToSearch = activeTab === 'all' 
      ? state.syllabus 
      : state.syllabus.filter(s => s.id === activeTab);

    const allTopics: { topic: Topic; chapter: Chapter; subject: Subject }[] = [];
    subjectsToSearch.forEach(sub => {
      sub.chapters.forEach(ch => {
        ch.topics.forEach(t => {
          allTopics.push({ topic: t, chapter: ch, subject: sub });
        });
      });
    });

    // Priority A: Prerequisite gaps for the active subject scope
    const activeGapsForActiveTab = prereqGaps.filter(g => {
      const depInfo = getTopicById(g.dependentId);
      return depInfo && (activeTab === 'all' || depInfo.subject.id === activeTab);
    });

    if (activeGapsForActiveTab.length > 0) {
      const gap = activeGapsForActiveTab[0];
      const prereqInfo = getTopicById(gap.topicId);
      if (prereqInfo) {
        return {
          topic: prereqInfo.topic,
          chapter: prereqInfo.chapter,
          subject: prereqInfo.subject,
          reason: `Prerequisite Gap: You have started study on "${gap.dependentName}", but its prerequisite "${prereqInfo.topic.name}" is weak or unstarted. Master this fundamental topic first to secure your concepts.`,
          priority: 'Critical Fundamental'
        };
      }
    }

    // Priority B: Overdue revisions
    const overdueRevisions = getOverdueRevisions ? getOverdueRevisions() : [];
    const activeOverdueRevisions = overdueRevisions.filter(r => activeTab === 'all' || r.subject === activeTab);
    if (activeOverdueRevisions.length > 0) {
      const rev = activeOverdueRevisions[0];
      const topicInfo = getTopicById(rev.topicId);
      if (topicInfo) {
        return {
          topic: topicInfo.topic,
          chapter: topicInfo.chapter,
          subject: topicInfo.subject,
          reason: `Forgetting Curve Alert: Scheduled Revision #${rev.revisionNumber} is overdue for "${topicInfo.topic.name}". Revise now to prevent knowledge decay and reinforce spaced retention.`,
          priority: 'High Priority Revision'
        };
      }
    }

    // Priority C: Weakest topics in progress or completed
    const weakTopics = allTopics.filter(x => 
      x.topic.status !== 'not_started' && 
      (x.topic.accuracy < 65 || x.topic.confidence < 3)
    ).sort((a, b) => a.topic.accuracy - b.topic.accuracy);

    if (weakTopics.length > 0) {
      const wt = weakTopics[0];
      return {
        topic: wt.topic,
        chapter: wt.chapter,
        subject: wt.subject,
        reason: `Targeted Improvement: Your accuracy in "${wt.topic.name}" is low (${wt.topic.accuracy}% accuracy, ${wt.topic.confidence} stars confidence). Spend some time reviewing formulas and re-solving incorrect questions to boost score yield.`,
        priority: 'Improvement Required'
      };
    }

    // Priority D: First unstarted topic
    const unstarted = allTopics.find(x => x.topic.status === 'not_started');
    if (unstarted) {
      return {
        topic: unstarted.topic,
        chapter: unstarted.chapter,
        subject: unstarted.subject,
        reason: `Syllabus Completion: You haven't started "${unstarted.topic.name}" yet. Begin studying this new topic to expand your syllabus coverage.`,
        priority: 'Next Syllabus Topic'
      };
    }

    return null;
  }, [activeTab, state.syllabus, prereqGaps, getTopicById, getOverdueRevisions]);

  // Scroll + highlight when locate is triggered
  useEffect(() => {
    if (!locateTarget) return;
    const { topicId } = locateTarget;
    const timer = setTimeout(() => {
      document.getElementById(`topic-${topicId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setLocateTarget(null);
    }, 400);
    return () => clearTimeout(timer);
  }, [locateTarget]);

  // Handlers
  const handleStatusChange = (topicId: string, status: TopicStatus) => {
    if (status === 'completed') {
      const info = getTopicById(topicId);
      if (info) {
        completeTopicWithRevisions(topicId, info.chapter.id, info.subject.id, info.topic.name, info.chapter.name);
      }
    } else {
      dispatch({ type: 'UPDATE_TOPIC_STATUS', payload: { topicId, status } });
    }
  };

  const handleConfidenceChange = (topicId: string, confidence: number) => {
    const info = getTopicById(topicId);
    if (info) {
      dispatch({
        type: 'UPDATE_TOPIC_STATUS',
        payload: { topicId, status: info.topic.status, confidence },
      });
    }
  };

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 space-y-1">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
              <GraduationCap className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Syllabus Tracker</h1>
              <p className="text-sm text-muted-foreground">
                {overallStats.completed}/{overallStats.total} topics completed · {overallStats.percent}% overall
              </p>
            </div>
          </div>
        </div>

        {/* Subject Progress Overview */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          {state.syllabus.map((subject) => {
            const stats =
              subject.id === 'physics'
                ? physicsStats
                : subject.id === 'chemistry'
                  ? chemistryStats
                  : mathematicsStats;
            return <SubjectProgressCard key={subject.id} subject={subject} stats={stats} />;
          })}
        </div>

        {/* AI Strategy Advisor Panel */}
        {recommendedTopic && (
          <Card className="mb-8 border border-primary/20 bg-primary/5 shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.05)] backdrop-blur-sm relative overflow-hidden">
            <div className="pointer-events-none absolute top-0 right-0 p-3 opacity-10">
              <Sparkles className="size-20 text-primary" />
            </div>
            <CardContent className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1.5 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-primary/10 text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 flex items-center gap-1 animate-pulse">
                    <Brain className="size-3" />
                    AI Strategy Advisor
                  </Badge>
                  <Badge variant="outline" className="text-[10px] uppercase font-semibold text-muted-foreground border-border/40">
                    Priority: {recommendedTopic.priority}
                  </Badge>
                </div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  Recommended focus: <span className="text-primary font-bold">{recommendedTopic.topic.name}</span> 
                  <span className="text-muted-foreground text-xs font-normal">({recommendedTopic.chapter.name} · {recommendedTopic.subject.name})</span>
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {recommendedTopic.reason}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
                <Button 
                  size="sm"
                  onClick={() => {
                    setSearchQuery(recommendedTopic.topic.name);
                    const subId = recommendedTopic.subject.id;
                    setExpandedBySubject(prev => ({
                      ...prev,
                      [subId]: [...new Set([...(prev[subId] || []), recommendedTopic.chapter.id])],
                    }));
                    setLocateTarget({ subjectId: subId, chapterId: recommendedTopic.chapter.id, topicId: recommendedTopic.topic.id });
                  }}
                  className="w-full md:w-auto text-xs cursor-pointer"
                >
                  Locate Topic
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs + Search */}
        <Tabs defaultValue="all" onValueChange={(val) => setActiveTab(val as 'all' | SubjectId)}>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full overflow-x-auto pb-1 scrollbar-none">
              <TabsList className="flex w-max min-w-full">
                <TabsTrigger value="all">
                  <BookOpen className="size-3.5" />
                  All
                </TabsTrigger>
                <TabsTrigger value="physics">
                  <Atom className="size-3.5" />
                  Physics
                </TabsTrigger>
                <TabsTrigger value="chemistry">
                  <FlaskConical className="size-3.5" />
                  Chemistry
                </TabsTrigger>
                <TabsTrigger value="mathematics">
                  <Calculator className="size-3.5" />
                  Maths
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Content — shared across all tabs since we filter with useMemo */}
          <div className="space-y-6">
            {filteredSubjects.map((subject) => {
              const subjectMeta = SUBJECT_META[subject.id as SubjectId];
              const hasVisibleChapters = searchQuery.trim()
                ? subject.chapters.some((ch) =>
                    ch.topics.some((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase().trim())),
                  )
                : true;

              if (!hasVisibleChapters) return null;

              return (
                <div key={subject.id} className="space-y-3">
                  {/* Subject header (only in "all" tab) */}
                  {activeTab === 'all' && (
                    <div className="flex items-center gap-2 border-b border-border/30 pb-2">
                      {subjectMeta.icon}
                      <h2 className="text-base font-semibold">{subject.name}</h2>
                    </div>
                  )}

                  <Accordion
                    value={expandedBySubject[subject.id] || []}
                    onValueChange={(val) => setExpandedBySubject(prev => ({ ...prev, [subject.id]: val }))}
                  >
                    {subject.chapters.map((chapter) => (
                      <ChapterAccordionItem
                        key={chapter.id}
                        chapter={chapter}
                        subject={subject}
                        searchQuery={searchQuery}
                        onStatusChange={handleStatusChange}
                        onConfidenceChange={handleConfidenceChange}
                        onExcludeToggle={toggleTopicExclusion}
                        prereqGaps={prereqGaps}
                        locatedTopicId={locateTarget?.topicId ?? null}
                      />
                    ))}
                  </Accordion>
                </div>
              );
            })}

            {/* Empty search state */}
            {searchQuery.trim() &&
              filteredSubjects.every((s) =>
                s.chapters.every(
                  (ch) => !ch.topics.some((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase().trim())),
                ),
              ) && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Search className="mb-3 size-10 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-muted-foreground">No topics found</p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    Try a different search term or clear the filter
                  </p>
                </div>
              )}
          </div>
        </Tabs>
      </div>
    </div>
  );
}
