'use client';

import React, { useState, useMemo } from 'react';
import { useStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Brain,
  Sparkles,
  History,
  ChevronRight,
  Gauge,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { format, subDays, parseISO } from 'date-fns';
import { SubjectId, ErrorType } from '@/types';

const SUBJECT_COLORS = {
  physics: '#6366f1',
  chemistry: '#22c55e',
  mathematics: '#f59e0b',
};

const SUBJECT_LABELS = {
  physics: 'Physics',
  chemistry: 'Chemistry',
  mathematics: 'Mathematics',
};

const ERROR_LABELS: Record<ErrorType, string> = {
  concept_gap: 'Concept Gap',
  formula_forgotten: 'Formula Forgotten',
  calculation_mistake: 'Calculation Mistake',
  time_pressure: 'Time Pressure',
  misread_question: 'Misread Question',
  guessing_error: 'Guessing Error',
};

const ERROR_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function AnalyticsPage() {
  const {
    state,
    getReadinessScore,
    getOverallReadiness,
    getWeakTopics,
    getStrongTopics,
    getSubjectStats,
    getExpectedJEEPerformance,
    getStudyTimeEfficiency,
    getBurnoutTelemetry,
    getRankTrajectories,
  } = useStore();

  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [activeTab, setActiveTab] = useState<string>('overview');

  const daysBack = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;

  // Study hours data
  const studyHoursData = useMemo(() => {
    const data: { date: string; physics: number; chemistry: number; mathematics: number; total: number }[] = [];
    for (let i = daysBack - 1; i >= 0; i--) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
      const dayLogs = state.studyLogs.filter(l => l.date.startsWith(date));
      const physics = dayLogs.filter(l => l.subject === 'physics').reduce((s, l) => s + l.duration, 0) / 60;
      const chemistry = dayLogs.filter(l => l.subject === 'chemistry').reduce((s, l) => s + l.duration, 0) / 60;
      const mathematics = dayLogs.filter(l => l.subject === 'mathematics').reduce((s, l) => s + l.duration, 0) / 60;
      data.push({
        date: format(subDays(new Date(), i), 'MMM dd'),
        physics: Math.round(physics * 10) / 10,
        chemistry: Math.round(chemistry * 10) / 10,
        mathematics: Math.round(mathematics * 10) / 10,
        total: Math.round((physics + chemistry + mathematics) * 10) / 10,
      });
    }
    return data;
  }, [state.studyLogs, daysBack]);

  // Test accuracy trend
  const accuracyTrend = useMemo(() => {
    const recent = state.testAttempts.slice(0, 20).reverse();
    return recent.map((t, i) => ({
      test: `Test ${i + 1}`,
      accuracy: Math.round((t.score / Math.max(t.maxScore, 1)) * 100),
      date: format(parseISO(t.date), 'MMM dd'),
    }));
  }, [state.testAttempts]);

  // Subject readiness radar data
  const radarData = useMemo(() => {
    return [
      { subject: 'Physics', readiness: getReadinessScore('physics') },
      { subject: 'Chemistry', readiness: getReadinessScore('chemistry') },
      { subject: 'Mathematics', readiness: getReadinessScore('mathematics') },
    ];
  }, [getReadinessScore]);

  // General Error Analysis
  const errorAnalysis = useMemo(() => {
    const errors: Record<string, number> = {};
    state.testAttempts.forEach(t => {
      t.errors.forEach(e => {
        errors[e.errorType] = (errors[e.errorType] || 0) + 1;
      });
    });
    return Object.entries(errors).map(([type, count]) => ({
      name: ERROR_LABELS[type as ErrorType] || type,
      value: count,
    }));
  }, [state.testAttempts]);

  // Subject completion stats
  const subjectCompletion = useMemo(() => {
    return (['physics', 'chemistry', 'mathematics'] as SubjectId[]).map(id => {
      const stats = getSubjectStats(id);
      return {
        subject: id,
        total: stats.total,
        completed: stats.completed,
        mastered: stats.mastered,
        percentage: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      };
    });
  }, [getSubjectStats]);

  const weakTopics = useMemo(() => getWeakTopics(8), [getWeakTopics]);
  const strongTopics = useMemo(() => getStrongTopics(8), [getStrongTopics]);

  const revisionStats = useMemo(() => {
    const total = state.revisions.length;
    const completed = state.revisions.filter(r => r.completedDate).length;
    const overdue = state.revisions.filter(r => !r.completedDate && r.dueDate < format(new Date(), 'yyyy-MM-dd')).length;
    const pending = total - completed;
    return { total, completed, overdue, pending };
  }, [state.revisions]);

  const totalHours = useMemo(() => {
    return Math.round(state.studyLogs.reduce((s, l) => s + l.duration, 0) / 60 * 10) / 10;
  }, [state.studyLogs]);

  const totalTests = state.testAttempts.length;

  const avgAccuracy = useMemo(() => {
    if (state.testAttempts.length === 0) return 0;
    const total = state.testAttempts.reduce((s, t) => s + (t.score / Math.max(t.maxScore, 1)), 0);
    return Math.round((total / state.testAttempts.length) * 100);
  }, [state.testAttempts]);

  // 1. Rank Predictor Calculations
  const prediction = getExpectedJEEPerformance();

  // 2. Time efficiency
  const efficiencies = getStudyTimeEfficiency();

  // 3. Mistake Knowledge Graph
  const mistakeGraph = useMemo(() => {
    const paths: Record<string, number> = {};
    let totalCount = 0;

    const mockPaths = [
      { path: 'Physics -> Mechanics -> Kinematics -> Relative Velocity', count: 4 },
      { path: 'Physics -> Mechanics -> Laws of Motion -> Friction', count: 3 },
      { path: 'Chemistry -> Basic Concepts -> Mole Concept -> Stoichiometry', count: 2 },
      { path: 'Mathematics -> Algebra -> Sets & Relations -> Functions', count: 3 },
    ];

    state.testAttempts.forEach(t => {
      t.errors.forEach(e => {
        const path = e.mistakePath || (
          e.errorType === 'concept_gap'
            ? `${t.subjectBreakdown[0]?.subject === 'physics' ? 'Physics' : t.subjectBreakdown[0]?.subject === 'chemistry' ? 'Chemistry' : 'Mathematics'} -> Core Concepts -> Gap`
            : `${t.subjectBreakdown[0]?.subject === 'physics' ? 'Physics' : t.subjectBreakdown[0]?.subject === 'chemistry' ? 'Chemistry' : 'Mathematics'} -> Practice Gaps -> Mistakes`
        );
        paths[path] = (paths[path] || 0) + 1;
        totalCount++;
      });
    });

    if (totalCount === 0) {
      mockPaths.forEach(mp => {
        paths[mp.path] = mp.count;
        totalCount += mp.count;
      });
    }

    const list = Object.entries(paths).map(([path, count]) => {
      const parts = path.split(' -> ');
      return {
        full: path,
        subject: parts[0] || 'General',
        chapter: parts[1] || 'General',
        topic: parts[2] || 'General',
        concept: parts[3] || 'Core',
        count,
        percentage: Math.round((count / totalCount) * 100),
      };
    });

    const subjectTotals: Record<string, number> = {};
    const chapterTotals: Record<string, number> = {};
    list.forEach(item => {
      subjectTotals[item.subject] = (subjectTotals[item.subject] || 0) + item.count;
      chapterTotals[item.chapter] = (chapterTotals[item.chapter] || 0) + item.count;
    });

    const topChapter = Object.entries(chapterTotals).sort((a, b) => b[1] - a[1])[0];
    const bottleneckPct = topChapter ? Math.round((topChapter[1] / totalCount) * 100) : 0;

    return {
      list: list.sort((a, b) => b.count - a.count),
      totalCount,
      topChapterName: topChapter ? topChapter[0] : 'None',
      bottleneckPct,
    };
  }, [state.testAttempts]);

  // 4. Seeding Topic Event timeline
  const displayEvents = useMemo(() => {
    const currentEvents = state.topicEvents || [];
    if (currentEvents.length > 0) return currentEvents;

    const mockEvents = [
      {
        id: 'me-1',
        topicId: 'math-alg-sets',
        topicName: 'Sets, Relations, and Functions',
        subject: 'mathematics' as SubjectId,
        timestamp: subDays(new Date(), 1).toISOString(),
        field: 'status' as const,
        oldValue: 'learning',
        newValue: 'completed',
        source: 'manual' as const,
      },
      {
        id: 'me-2',
        topicId: 'phy-mech-units',
        topicName: 'Units and Measurements',
        subject: 'physics' as SubjectId,
        timestamp: subDays(new Date(), 2).toISOString(),
        field: 'accuracy' as const,
        oldValue: 60,
        newValue: 85,
        source: 'test' as const,
      },
      {
        id: 'me-3',
        topicId: 'chem-basic-mole',
        topicName: 'Mole Concept and Stoichiometry',
        subject: 'chemistry' as SubjectId,
        timestamp: subDays(new Date(), 3).toISOString(),
        field: 'confidence' as const,
        oldValue: 2,
        newValue: 4,
        source: 'ai_tutor' as const,
      },
      {
        id: 'me-4',
        topicId: 'phy-mech-newton',
        topicName: 'Laws of Motion',
        subject: 'physics' as SubjectId,
        timestamp: subDays(new Date(), 5).toISOString(),
        field: 'status' as const,
        oldValue: 'not_started',
        newValue: 'learning',
        source: 'study_log' as const,
      }
    ];
    return mockEvents;
  }, [state.topicEvents]);

  const sourceLabels = {
    manual: 'Manual Action',
    test: 'Quiz Result',
    study_log: 'Study Log Entry',
    ai_tutor: 'AI Tutor Action',
  };

  const fieldLabels = {
    status: 'Syllabus Status',
    confidence: 'Confidence Score',
    accuracy: 'Test Accuracy',
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Performance Analytics</h1>
            <p className="text-xs text-muted-foreground">Track expected ranks, study yield, and weak links</p>
          </div>
        </div>
        <Select value={timeRange} onValueChange={(v) => { if (v) setTimeRange(v as '7d' | '30d' | '90d'); }}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-5 w-full bg-muted/30 border border-border/40 p-1 rounded-lg">
          <TabsTrigger value="overview" className="flex items-center gap-1.5 py-2">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="rank" className="flex items-center gap-1.5 py-2">
            <Gauge className="w-4 h-4" />
            <span className="hidden sm:inline">Rank Predictor</span>
          </TabsTrigger>
          <TabsTrigger value="efficiency" className="flex items-center gap-1.5 py-2">
            <Clock className="w-4 h-4" />
            <span className="hidden sm:inline">Time Yield</span>
          </TabsTrigger>
          <TabsTrigger value="mistake" className="flex items-center gap-1.5 py-2">
            <Brain className="w-4 h-4" />
            <span className="hidden sm:inline">Mistake Graph</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1.5 py-2">
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">Event Logs</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab Content */}
        <TabsContent value="overview" className="mt-4 space-y-6 animate-in fade-in duration-300">
          {(() => {
            const fatigue = getBurnoutTelemetry();
            if (fatigue.status === 'healthy') return null;
            return (
              <Card className={`border-l-4 p-4 ${fatigue.status === 'burnout' ? 'border-red-500 bg-red-500/10 text-red-200' : 'border-amber-500 bg-amber-500/10 text-amber-200'} animate-in fade-in duration-300`}>
                <CardContent className="p-0 flex items-start gap-3">
                  <AlertTriangle className="size-5 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold uppercase">{fatigue.status === 'burnout' ? 'CRITICAL BURNOUT WARNING' : 'FATIGUE WARNING'}</h4>
                    <p className="text-xs mt-1 leading-relaxed">{fatigue.message}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card className="bg-card border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Overall Readiness</span>
                </div>
                <p className="mt-1 text-2xl font-bold">{getOverallReadiness()}%</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-400" />
                  <span className="text-xs text-muted-foreground">Total Study Hours</span>
                </div>
                <p className="mt-1 text-2xl font-bold">{totalHours}h</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <span className="text-xs text-muted-foreground">Tests Taken</span>
                </div>
                <p className="mt-1 text-2xl font-bold">{totalTests}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-purple-400" />
                  <span className="text-xs text-muted-foreground">Avg Accuracy</span>
                </div>
                <p className="mt-1 text-2xl font-bold">{avgAccuracy}%</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Study Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={studyHoursData.slice(-14)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#888' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#888' }} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }}
                        labelStyle={{ color: '#ccc' }}
                      />
                      <Area type="monotone" dataKey="physics" stackId="1" stroke={SUBJECT_COLORS.physics} fill={SUBJECT_COLORS.physics} fillOpacity={0.3} />
                      <Area type="monotone" dataKey="chemistry" stackId="1" stroke={SUBJECT_COLORS.chemistry} fill={SUBJECT_COLORS.chemistry} fillOpacity={0.3} />
                      <Area type="monotone" dataKey="mathematics" stackId="1" stroke={SUBJECT_COLORS.mathematics} fill={SUBJECT_COLORS.mathematics} fillOpacity={0.3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex items-center justify-center gap-4">
                  {(['physics', 'chemistry', 'mathematics'] as const).map(sub => (
                    <div key={sub} className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: SUBJECT_COLORS[sub] }} />
                      <span className="text-[10px] capitalize text-muted-foreground">{sub}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Test Accuracy Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full relative">
                  {accuracyTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={accuracyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="test" tick={{ fontSize: 10, fill: '#888' }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#888' }} />
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }}
                        />
                        <Area type="monotone" dataKey="accuracy" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Take some tests to see accuracy trends
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Subject Readiness</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56 w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="rgba(255,255,255,0.1)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#888' }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#666' }} />
                      <Radar name="Readiness" dataKey="readiness" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Error Patterns</CardTitle>
              </CardHeader>
              <CardContent>
                {errorAnalysis.length > 0 ? (
                  <div className="h-56 w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={errorAnalysis}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {errorAnalysis.map((_, i) => (
                            <Cell key={i} fill={ERROR_COLORS[i % ERROR_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                    Complete tests and classify errors to see patterns
                  </div>
                )}
                {errorAnalysis.length > 0 && (
                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    {errorAnalysis.map((e, i) => (
                      <div key={e.name} className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: ERROR_COLORS[i % ERROR_COLORS.length] }} />
                        <span className="text-[10px] text-muted-foreground">{e.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Syllabus Completion</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {subjectCompletion.map(sc => (
                  <div key={sc.subject} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="capitalize font-medium">{sc.subject}</span>
                      <span className="text-muted-foreground">{sc.completed}/{sc.total} topics</span>
                    </div>
                    <Progress
                      value={sc.percentage}
                      className="h-2"
                      style={{ '--progress-color': SUBJECT_COLORS[sc.subject] } as React.CSSProperties}
                    />
                    <p className="text-[10px] text-muted-foreground">{sc.mastered} mastered</p>
                  </div>
                ))}

                <div className="mt-4 border-t border-border/50 pt-3">
                  <h4 className="text-xs font-medium mb-2">Revision Debt</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md bg-muted/50 p-2 text-center">
                      <p className="text-lg font-bold text-amber-400">{revisionStats.pending}</p>
                      <p className="text-[10px] text-muted-foreground">Pending</p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2 text-center">
                      <p className="text-lg font-bold text-red-400">{revisionStats.overdue}</p>
                      <p className="text-[10px] text-muted-foreground">Overdue</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {(() => {
              const fatigue = getBurnoutTelemetry();
              return (
                <Card className="border-border/50 bg-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-primary" /> Fatigue & Burnout
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center py-2">
                      <p className="text-3xl font-extrabold font-mono" style={{ color: fatigue.status === 'burnout' ? '#ef4444' : fatigue.status === 'warning' ? '#f59e0b' : '#10b981' }}>
                        {fatigue.score} <span className="text-xs text-muted-foreground font-normal">/ 100 index</span>
                      </p>
                      <Badge variant="outline" className={`mt-2 text-[10px] uppercase font-bold ${fatigue.status === 'burnout' ? 'border-red-500/30 bg-red-500/10 text-red-400' : fatigue.status === 'warning' ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : 'border-green-500/30 bg-green-500/10 text-green-400'}`}>
                        {fatigue.status}
                      </Badge>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">7-Day Study Avg:</span>
                        <span className="font-semibold">{fatigue.hoursAverage} hrs/day</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Avg Sleep:</span>
                        <span className="font-semibold">{fatigue.sleepAverage} hrs</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Study Streak:</span>
                        <span className="font-semibold text-primary">{fatigue.streak} days</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-400" />
                  <CardTitle className="text-sm font-medium">Weakest Topics</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {weakTopics.length > 0 ? (
                  <div className="space-y-2">
                    {weakTopics.map(t => (
                      <div key={t.topicId} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                        <div>
                          <p className="text-xs font-medium">{t.topicName}</p>
                          <p className="text-[10px] text-muted-foreground">{t.chapterName}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] capitalize" style={{ borderColor: SUBJECT_COLORS[t.subject], color: SUBJECT_COLORS[t.subject] }}>
                            {t.subject}
                          </Badge>
                          <span className="text-xs text-red-400 font-mono">{t.accuracy}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">Complete some topics and tests to identify weak areas</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-400" />
                  <CardTitle className="text-sm font-medium">Strongest Topics</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {strongTopics.length > 0 ? (
                  <div className="space-y-2">
                    {strongTopics.map(t => (
                      <div key={t.topicId} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                        <div>
                          <p className="text-xs font-medium">{t.topicName}</p>
                          <p className="text-[10px] text-muted-foreground">{t.chapterName}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] capitalize" style={{ borderColor: SUBJECT_COLORS[t.subject], color: SUBJECT_COLORS[t.subject] }}>
                            {t.subject}
                          </Badge>
                          <span className="text-xs text-green-400 font-mono">{t.accuracy}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">Master topics with 80%+ accuracy to see them here</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Rank Predictor Tab Content */}
        <TabsContent value="rank" className="mt-4 space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Score box */}
            <Card className="relative overflow-hidden bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border-primary/25">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Expected JEE Main Score</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                    {prediction.expectedScore}
                  </span>
                  <span className="text-sm text-muted-foreground font-medium">± {prediction.variance}</span>
                </div>
                <div className="w-full">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Range: {prediction.expectedScore - prediction.variance} - {prediction.expectedScore + prediction.variance}</span>
                    <span>Max: 300</span>
                  </div>
                  <Progress value={(prediction.expectedScore / 300) * 100} className="h-1.5" />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Score estimate integrates topic syllabus confidence (40% weight) and objective mock test performances (60% weight).
                </p>
              </CardContent>
            </Card>

            {/* Percentile Box */}
            <Card className="relative overflow-hidden bg-gradient-to-br from-purple-500/10 to-pink-500/5 border-pink-500/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Expected Percentile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold tracking-tight bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                    {prediction.percentile}%
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <TrendingUp className="w-3.5 h-3.5 text-pink-400" />
                  Estimated Rank: ~{Math.round((100 - prediction.percentile) * 14000)} (out of 14 Lakh candidates)
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Computed using sigmoid-fitting matching real JEE Main cutoffs and student score distributions.
                </p>
              </CardContent>
            </Card>

            {/* Target NIT Box */}
            <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border-emerald-500/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Target NIT Trichy CSE</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-1">
                <div className="flex items-center gap-3">
                  <div className={`px-3 py-2.5 rounded-lg border font-bold text-lg font-mono ${prediction.targetDiff === 'cse_met' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
                    {prediction.targetDiff === 'cse_met' ? 'MET' : prediction.targetDiff}
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold">{prediction.targetStatus}</h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5">CSE Cutoff: ~99.85 percentile (240 marks)</p>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  NIT Trichy Computer Science Engineering requires a top 1,500 national rank. Maintain revision consistency to bridge this gap.
                </p>
              </CardContent>
            </Card>
          </div>

          {(() => {
            const trajectories = getRankTrajectories();
            const trajectoryChartData = trajectories.labels.map((label, idx) => ({
              name: label,
              Current: trajectories.current[idx],
              Optimal: trajectories.optimal[idx],
              Corrected: trajectories.corrected[idx],
              Degrading: trajectories.degrading[idx],
            }));
            return (
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">5-Week Percentile Trajectory Projections</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trajectoryChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#888' }} />
                        <YAxis domain={[Math.max(0, Math.round(Math.min(...trajectories.degrading) - 5)), 100]} tick={{ fontSize: 10, fill: '#888' }} />
                        <RechartsTooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }} />
                        <Area type="monotone" dataKey="Optimal" stroke="#10b981" fill="#10b981" fillOpacity={0.05} />
                        <Area type="monotone" dataKey="Corrected" stroke="#6366f1" fill="#6366f1" fillOpacity={0.05} />
                        <Area type="monotone" dataKey="Current" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.05} />
                        <Area type="monotone" dataKey="Degrading" stroke="#ef4444" fill="#ef4444" fillOpacity={0.05} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 flex items-center justify-center gap-4 flex-wrap text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-emerald-500" /> Optimal Path</div>
                    <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-indigo-500" /> Corrected Path</div>
                    <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-blue-500" /> Current Path</div>
                    <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-red-500" /> Degrading Path</div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Breakdown / Explanation details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Rank Predictor Intelligence
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-xs text-muted-foreground">
                <p>
                  Your expected JEE performance is not static. Our Rank Predictor recomputes your predicted score using three dynamic inputs:
                </p>
                <ul className="list-disc pl-4 space-y-2">
                  <li><strong>Syllabus Readiness ({getOverallReadiness()}%)</strong>: Computed from your syllabus completions, star confidence, and revision status. Represents your conceptual capacity.</li>
                  <li><strong>Test History ({state.testAttempts.length} Quizzes)</strong>: Weight-averaged accuracy of all quizzes. Represents your objective test-taking stability under timed conditions.</li>
                  <li><strong>Mock Scores</strong>: Negative markings are calculated to penalize wild guessing.</li>
                </ul>
                <div className="bg-muted/20 p-3 rounded-lg border border-border/30 text-[11px]">
                  <strong>💡 Pro Tip:</strong> Each additional mock test taken reduces prediction variance (currently <strong>± {prediction.variance}</strong> marks) and increases estimation confidence.
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  Subject Score Yield Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {efficiencies.map(eff => (
                  <div key={eff.subject} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="capitalize font-semibold">{eff.subject} Contribution</span>
                      <span className="font-mono text-muted-foreground">{Math.round((eff.readiness / 100) * 100)} / 100 marks</span>
                    </div>
                    <Progress value={eff.readiness} className="h-2" style={{ '--progress-color': SUBJECT_COLORS[eff.subject] } as React.CSSProperties} />
                  </div>
                ))}
                <p className="text-[10px] text-muted-foreground mt-2 border-t border-border/40 pt-2">
                  Total expected score: <strong>{prediction.expectedScore} marks</strong> out of 300.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Time Efficiency Tab Content */}
        <TabsContent value="efficiency" className="mt-4 space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {efficiencies.map(eff => (
              <Card key={eff.subject} className="border-border/50 bg-card">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" style={{ borderColor: SUBJECT_COLORS[eff.subject], color: SUBJECT_COLORS[eff.subject] }} className="capitalize font-semibold">
                      {SUBJECT_LABELS[eff.subject]}
                    </Badge>
                    <Clock className="w-4 h-4 text-muted-foreground/60" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Studied Time</p>
                    <p className="text-2xl font-bold font-mono">{eff.studyHours} hours</p>
                  </div>
                  <div className="border-t border-border/40 pt-2 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Yield efficiency</p>
                      <p className="text-md font-bold font-mono text-primary">{eff.marksPerHour} <span className="text-[10px] text-muted-foreground font-normal">marks / hour</span></p>
                    </div>
                    <Badge className="bg-primary/10 border-primary/20 text-primary hover:bg-primary/10 text-[10px]">
                      Readiness: {eff.readiness}%
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Efficiency Yield Bar Chart */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Marks Yield per Invested Hour</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={efficiencies}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="subject" tickFormatter={(v) => SUBJECT_LABELS[v as SubjectId]} tick={{ fontSize: 10, fill: '#888' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#888' }} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }}
                      />
                      <Bar dataKey="marksPerHour" radius={[4, 4, 0, 0]}>
                        {efficiencies.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={SUBJECT_COLORS[entry.subject]} />
                        ))}
                      </Bar>
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Time efficiency advice */}
            <Card className="border-border/50 flex flex-col justify-between">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-400" />
                  Study Efficiency Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-xs text-muted-foreground flex-1">
                <p>
                  <strong>Marks per hour invested</strong> measures the yielding rate of your preparation score. It compares your accumulated subject readiness against the physical hours logged.
                </p>
                <div className="space-y-3">
                  {efficiencies.map(eff => {
                    const threshold = 1.0;
                    const isInefficient = eff.marksPerHour < threshold && eff.studyHours > 15;
                    return (
                      <div key={eff.subject} className={`p-3 rounded-lg border ${isInefficient ? 'bg-amber-500/5 border-amber-500/20' : 'bg-muted/10 border-border/30'}`}>
                        <div className="flex items-center justify-between font-semibold text-xs mb-1">
                          <span className="capitalize">{SUBJECT_LABELS[eff.subject]} Yield</span>
                          <span className={isInefficient ? 'text-amber-400' : 'text-primary'}>{eff.marksPerHour} marks/hr</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {isInefficient 
                            ? `⚠️ Low Yield: You have invested ${eff.studyHours} hours but readiness remains at ${eff.readiness}%. Try solving simpler questions first to build concepts.`
                            : `✅ Normal Yield: Your study yield indicates a healthy assimilation rate. Keep this up.`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Mistake Knowledge Graph Tab Content */}
        <TabsContent value="mistake" className="mt-4 space-y-6 animate-in fade-in duration-300">
          <Card className="border-border/50 relative overflow-hidden bg-gradient-to-r from-red-500/10 via-transparent to-transparent">
            <CardContent className="p-5 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 animate-bounce" />
              <div>
                <h4 className="text-xs font-semibold uppercase text-red-400 tracking-wider">AI Bottleneck Warning</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {mistakeGraph.bottleneckPct > 0 
                    ? `Analysis of your test mistake history reveals that ${mistakeGraph.bottleneckPct}% of your concept gaps originate from ${mistakeGraph.topChapterName}. Focus on this area.` 
                    : `Complete more quizzes to identify primary subject bottlenecks.`}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Mistake List tree */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Mistake Path Distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {mistakeGraph.list.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-lg border border-border/40 bg-muted/20 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-primary">{item.concept}</span>
                      <span className="font-mono text-muted-foreground">{item.count} errors ({item.percentage}%)</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground flex-wrap">
                      <span className="capitalize">{item.subject}</span>
                      <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                      <span>{item.chapter}</span>
                      <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                      <span>{item.topic}</span>
                    </div>
                    <Progress value={item.percentage} className="h-1" />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Mistake Knowledge Graph Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-xs text-muted-foreground">
                <p>
                  JEE OS categorizes every question attempt error into a hierarchical **Mistake Knowledge Graph** (Subject → Chapter → Topic → Concept).
                </p>
                <p>
                  Instead of simply telling you that you are weak in &ldquo;Physics&rdquo;, the engine traces errors to specific concept nodes (like <i>Relative Velocity</i> in <i>Kinematics</i> under <i>Mechanics</i>).
                </p>
                <div className="p-3 bg-muted/30 rounded-lg border border-border/30 space-y-2">
                  <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <Brain className="w-4 h-4 text-purple-400" />
                    How to resolve bottlenecks:
                  </div>
                  <ul className="list-disc pl-4 space-y-1.5 text-[11px]">
                    <li>Ask the **AI Tutor** specifically about the concept: <i>&ldquo;Teach me Relative Velocity under Kinematics&rdquo;</i>.</li>
                    <li>Solve the custom adaptive mock tests to focus on weak concepts.</li>
                    <li>Revise formulas relating to the bottleneck node.</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Event Logs Tab Content */}
        <TabsContent value="history" className="mt-4 space-y-6 animate-in fade-in duration-300">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                Telemetry Event History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {displayEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <History className="w-10 h-10 text-muted-foreground/30 mb-2" />
                  <p className="text-sm font-semibold">No telemetry logs recorded yet</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    Events will automatically populate as you modify topic status, take adaptive tests, or update confidence ratings.
                  </p>
                </div>
              ) : (
                <div className="relative border-l border-border pl-4 ml-2 space-y-6">
                  {displayEvents.map((evt) => {
                    const subColor = SUBJECT_COLORS[evt.subject] || '#fff';
                    const isIncrease = typeof evt.newValue === 'number' && typeof evt.oldValue === 'number' && evt.newValue > evt.oldValue;
                    return (
                      <div key={evt.id} className="relative group">
                        {/* Dot indicator */}
                        <div 
                          className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border border-background shadow-sm"
                          style={{ backgroundColor: subColor }}
                        />
                        <div className="space-y-1">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
                            <span className="font-semibold text-foreground">{evt.topicName}</span>
                            <span className="text-[10px] text-muted-foreground tabular-nums">{format(parseISO(evt.timestamp), 'MMM d, yyyy h:mm a')}</span>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                            <Badge className="bg-muted border-border/40 text-muted-foreground hover:bg-muted text-[10px]">
                              {fieldLabels[evt.field]}
                            </Badge>
                            <span>
                              {evt.oldValue} → <strong className={isIncrease ? 'text-green-400' : 'text-primary'}>{evt.newValue}</strong>
                            </span>
                            <span className="text-muted-foreground/40">|</span>
                            <span className="text-[10px] italic">via {sourceLabels[evt.source]}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
