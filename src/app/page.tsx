'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Clock,
  Flame,
  BookOpen,
  CheckCircle2,
  Play,
  FileQuestion,
  RotateCcw,
  Bot,
  ArrowRight,
  Calendar,
  Sparkles,
  TrendingUp,
  Atom,
  FlaskConical,
  Calculator,
  Brain,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';

// Stat card component
function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtitle?: string;
  color: string;
}) {
  const colorMap: Record<string, { icon: string; bg: string }> = {
    blue: { icon: 'text-blue-400', bg: 'bg-blue-500/10' },
    green: { icon: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    orange: { icon: 'text-orange-400', bg: 'bg-orange-500/10' },
    purple: { icon: 'text-purple-400', bg: 'bg-purple-500/10' },
    pink: { icon: 'text-pink-400', bg: 'bg-pink-500/10' },
    cyan: { icon: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  };

  const colors = colorMap[color] || colorMap.blue;

  return (
    <Card className="group hover:ring-foreground/20 transition-all duration-200">
      <CardContent className="pt-1">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {label}
            </p>
            <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className={`p-2 rounded-lg ${colors.bg}`}>
            <Icon className={`w-4 h-4 ${colors.icon}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Motivational messages
const motivationalMessages = [
  "Every hour of focused study brings you closer to IIT.",
  "Consistency beats intensity. Keep showing up.",
  "Small daily improvements lead to stunning results.",
  "Your future self will thank you for studying today.",
  "The difference between ordinary and extraordinary is practice.",
  "Focus on progress, not perfection.",
  "Champions are made in the hours nobody is watching.",
  "Discipline is choosing between what you want now and what you want most.",
];

function getMotivationalMessage() {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return motivationalMessages[dayOfYear % motivationalMessages.length];
}

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    state,
    dispatch,
    getReadinessScore,
    getOverallReadiness,
    getTodayStudyHours,
    getPendingRevisions,
    getWhatToStudyNext,
    getExpectedJEEPerformance,
    getBurnoutTelemetry,
    getOverdueRevisions,
    getWeakTopics,
  } = useStore();

  const [showRecommendationModal, setShowRecommendationModal] = useState(false);
  const priorities = getWhatToStudyNext();
  const prediction = getExpectedJEEPerformance() as any;
  const burnout = getBurnoutTelemetry();
  const overdueCount = getOverdueRevisions().length;
  const weakest = getWeakTopics(1);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-xs text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const studentName = state.profile.name || 'Student';
  const todayFormatted = format(new Date(), 'EEEE, MMMM d, yyyy');
  const studyHoursToday = getTodayStudyHours();
  const pendingRevisions = getPendingRevisions();
  const motivationalMsg = getMotivationalMessage();

  // Count completed topics across all subjects
  const completedTopicsCount = state.syllabus.reduce((acc, subject) => {
    return (
      acc +
      subject.chapters.reduce((chAcc, chapter) => {
        return (
          chAcc +
          chapter.topics.filter(
            (t) =>
              t.status === 'completed' ||
              t.status === 'revised' ||
              t.status === 'mastered'
          ).length
        );
      }, 0)
    );
  }, 0);

  // Total topics
  const totalTopicsCount = state.syllabus.reduce((acc, subject) => {
    return acc + subject.chapters.reduce((chAcc, ch) => chAcc + ch.topics.length, 0);
  }, 0);

  const todayDate = format(new Date(), 'yyyy-MM-dd');

  // Readiness scores
  const physicsReadiness = getReadinessScore('physics');
  const chemistryReadiness = getReadinessScore('chemistry');
  const mathReadiness = getReadinessScore('mathematics');
  const overallReadiness = getOverallReadiness();

  // Recent study logs (last 5)
  const recentLogs = state.studyLogs.slice(0, 5);

  // Upcoming revisions (next 5 pending, sorted by due date)
  const upcomingRevisions = [...state.revisions]
    .filter((r) => !r.completedDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);

  // Greeting based on time of day
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Subject icon + color mapping for logs/revisions
  const subjectMeta: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    physics: { icon: Atom, color: 'text-blue-400', label: 'Physics' },
    chemistry: { icon: FlaskConical, color: 'text-emerald-400', label: 'Chemistry' },
    mathematics: { icon: Calculator, color: 'text-orange-400', label: 'Mathematics' },
  };

  const logTypeLabels: Record<string, string> = {
    study: 'Studied',
    revision: 'Revised',
    practice: 'Practiced',
    test: 'Tested',
    school: 'School',
  };

  return (
    <div className="min-h-screen animate-in fade-in duration-500">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-5">
        {/* ─── Header ─── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div className="space-y-0.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              {greeting},{' '}
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                {studentName}
              </span>
            </h1>
            <div className="flex items-center gap-2">
              <Calendar className="size-3.5 text-muted-foreground" />
              <p className="text-xs sm:text-sm text-muted-foreground">{todayFormatted}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 max-w-md sm:text-right">
            <Sparkles className="size-4 text-amber-400 mt-0.5 shrink-0 hidden sm:block" />
            <p className="text-xs sm:text-sm text-muted-foreground italic leading-snug">
              &ldquo;{motivationalMsg}&rdquo;
            </p>
          </div>
        </div>

        {/* ─── AI Strategy HUD & Burnout Predictor ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Card className="lg:col-span-2 relative overflow-hidden bg-gradient-to-br from-indigo-950/20 via-background to-background border-indigo-500/20 backdrop-blur-md flex flex-col justify-between p-4 sm:p-5">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Brain className="size-4 sm:size-5 text-indigo-400 animate-pulse" />
                <span className="text-[10px] sm:text-xs font-semibold text-indigo-400 uppercase tracking-wider">AI Strategy</span>
              </div>
              
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                {overdueCount > 0 ? (
                  <span className="text-amber-400 font-medium">
                    ⚠️ Clear {overdueCount} overdue revisions to protect memory score.
                  </span>
                ) : weakest.length > 0 ? (
                  <span>
                    🎯 Focus on <strong className="text-zinc-200">{weakest[0].topicName}</strong> ({weakest[0].accuracy}% accuracy).
                  </span>
                ) : (
                  <span>
                    🚀 Status Green: Use adaptive quizzes to test retention.
                  </span>
                )}
              </p>

              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 rounded-lg bg-red-950/15 border border-red-500/10 text-center space-y-0.5">
                  <span className="text-[9px] text-red-400 uppercase font-semibold">Low</span>
                  <p className="text-sm sm:text-base font-bold text-red-200 tabular-nums">{prediction.worstCase?.score || 0}</p>
                </div>
                <div className="p-2 rounded-lg bg-purple-950/15 border border-purple-500/10 text-center space-y-0.5">
                  <span className="text-[9px] text-purple-400 uppercase font-semibold">Target</span>
                  <p className="text-sm sm:text-base font-bold text-purple-200 tabular-nums">{prediction.likelyCase?.score || 0}</p>
                </div>
                <div className="p-2 rounded-lg bg-emerald-950/15 border border-emerald-500/10 text-center space-y-0.5">
                  <span className="text-[9px] text-emerald-400 uppercase font-semibold">Peak</span>
                  <p className="text-sm sm:text-base font-bold text-emerald-200 tabular-nums">{prediction.bestCase?.score || 0}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
              <span className="text-[10px] text-zinc-500 italic hidden sm:block">
                Based on {state.testAttempts.length} mocks
              </span>
              <Button 
                onClick={() => setShowRecommendationModal(true)} 
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-3 py-2 rounded-lg flex items-center justify-center gap-2 cursor-pointer"
                size="sm"
              >
                <Bot className="size-3.5" />
                Priorities
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </Card>
          
          <Card className="relative overflow-hidden bg-gradient-to-br from-zinc-950 to-zinc-900/40 border-white/5 p-4 sm:p-5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Flame className={`size-4 sm:size-5 ${burnout.status === 'healthy' ? 'text-emerald-400' : burnout.status === 'warning' ? 'text-amber-400 animate-pulse' : 'text-red-500 animate-bounce'}`} />
                <span className="text-[10px] sm:text-xs font-semibold text-zinc-300 uppercase tracking-wider">Fatigue Index</span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-end">
                  <span className="text-xs text-muted-foreground">Load</span>
                  <span className={`text-lg font-bold tabular-nums ${burnout.score > 70 ? 'text-red-400' : burnout.score > 40 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {burnout.score}%
                  </span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${burnout.score > 70 ? 'bg-red-500' : burnout.score > 40 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                    style={{ width: `${burnout.score}%` }} 
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>Avg Study:</span>
                  <strong className="text-zinc-200 tabular-nums">{burnout.hoursAverage}h/d</strong>
                </div>
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>Sleep:</span>
                  <strong className="text-zinc-200 tabular-nums">{burnout.sleepAverage}h</strong>
                </div>
              </div>
            </div>

            <p className="text-[10px] leading-relaxed text-muted-foreground mt-3 border-t border-white/5 pt-3 line-clamp-2">
              {burnout.message}
            </p>
          </Card>
        </div>

        {/* ─── Recommendation Modal ─── */}
        {showRecommendationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card border border-border/80 rounded-xl max-w-2xl w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
              <div className="p-3 sm:p-4 border-b border-border/50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Bot className="size-4 text-primary" />
                  <h3 className="text-sm font-semibold">Study Priorities</h3>
                </div>
                <button 
                  onClick={() => setShowRecommendationModal(false)}
                  className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="p-3 sm:p-4 space-y-3 overflow-y-auto">
                <p className="text-[11px] text-muted-foreground">
                  High-leverage topics based on your performance.
                </p>
                
                <div className="space-y-2">
                  {priorities.map((item, idx) => {
                    const actionColors = {
                      study: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Study' },
                      practice: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Practice' },
                      revise: { bg: 'bg-orange-500/10', text: 'text-orange-400', label: 'Revise' },
                    };
                    const act = actionColors[item.action] || actionColors.study;
                    
                    return (
                      <div key={item.topicId} className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg border border-border/50 bg-muted/20 gap-2">
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="flex size-4 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                              {idx + 1}
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${act.bg} ${act.text} font-medium`}>
                              {act.label}
                            </span>
                            <span className="text-[9px] text-muted-foreground capitalize">{item.subject}</span>
                          </div>
                          <h4 className="text-xs font-medium truncate">{item.topicName}</h4>
                        </div>
                        
                        <Link 
                          href={item.action === 'revise' ? '/revisions' : item.action === 'practice' ? '/tests' : `/syllabus`}
                          onClick={() => setShowRecommendationModal(false)}
                          className="shrink-0"
                        >
                          <Button size="sm" className="h-7 text-[10px] px-2 cursor-pointer">
                            Go
                            <ArrowRight className="size-3 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="p-3 bg-muted/30 border-t border-border/30 flex justify-end shrink-0">
                <Button variant="ghost" size="sm" onClick={() => setShowRecommendationModal(false)} className="text-xs cursor-pointer h-7">
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ─── AI Insight Feed ─── */}
        {state.insights.filter(i => !i.dismissed).length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="size-3.5 text-amber-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                AI Insights
              </h2>
              <span className="text-[9px] bg-amber-500/10 text-amber-400 border-amber-500/20 border px-1.5 py-0.5 rounded-full">
                {state.insights.filter(i => !i.dismissed).length}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {state.insights.filter(i => !i.dismissed).slice(0, 4).map((insight) => {
                const priorityStyles = {
                  high: { border: 'border-red-500/20', bg: 'bg-red-500/5', icon: '🔴', text: 'text-red-400' },
                  medium: { border: 'border-amber-500/20', bg: 'bg-amber-500/5', icon: '🟡', text: 'text-amber-400' },
                  low: { border: 'border-blue-500/20', bg: 'bg-blue-500/5', icon: '🔵', text: 'text-blue-400' },
                };
                const style = priorityStyles[insight.priority] || priorityStyles.medium;
                const typeLabels: Record<string, string> = {
                  revision_reminder: 'Revision',
                  weakness_alert: 'Weakness',
                  accuracy_drop: 'Accuracy',
                  priority_suggestion: 'Priority',
                  achievement: 'Achievement',
                  study_pattern: 'Pattern',
                  forgetting_alert: 'Memory',
                };
                return (
                  <div key={insight.id} className={`p-3 rounded-xl border ${style.border} ${style.bg} space-y-1 relative group transition-all duration-200`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-1">
                        <span className="text-[10px]">{style.icon}</span>
                        <span className={`text-[9px] font-medium ${style.text}`}>
                          {typeLabels[insight.type] || insight.type}
                        </span>
                      </div>
                      <button
                        onClick={() => dispatch({ type: 'DISMISS_INSIGHT', payload: insight.id })}
                        className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-300 transition-all p-0.5 rounded"
                      >
                        <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-[11px] text-zinc-300 leading-snug line-clamp-2">{insight.message}</p>
                  </div>
                );
              })}
            </div>
            {state.insights.filter(i => !i.dismissed).length > 4 && (
              <Link href="/coach" className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
                View all
                <ArrowRight className="size-3" />
              </Link>
            )}
          </section>
        )}

        {/* ─── Today&apos;s Overview — Stat Cards ─── */}
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-3.5 text-muted-foreground" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Today
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
            <Card className="bg-background/60 border-border/40 col-span-2 sm:col-span-3 lg:col-span-2">
               <CardContent className="p-3 sm:p-4">
                 <div className="flex items-center justify-between mb-2">
                   <div className="flex items-center gap-2">
                     <div className="p-1.5 rounded-md bg-indigo-500/10">
                       <Brain className="size-3.5 text-indigo-400" />
                     </div>
                     <span className="text-xs font-medium text-muted-foreground">Readiness</span>
                   </div>
                   <span className="text-lg font-bold text-indigo-200">{overallReadiness}%</span>
                 </div>
                 <div className="flex gap-1.5 h-2">
                   <div className="flex-1 bg-blue-500/20 rounded-full overflow-hidden relative">
                     <div className="absolute inset-y-0 left-0 bg-blue-500" style={{width: `${physicsReadiness}%`}} />
                   </div>
                   <div className="flex-1 bg-emerald-500/20 rounded-full overflow-hidden relative">
                     <div className="absolute inset-y-0 left-0 bg-emerald-500" style={{width: `${chemistryReadiness}%`}} />
                   </div>
                   <div className="flex-1 bg-orange-500/20 rounded-full overflow-hidden relative">
                     <div className="absolute inset-y-0 left-0 bg-orange-500" style={{width: `${mathReadiness}%`}} />
                   </div>
                 </div>
                 <div className="flex justify-between mt-1.5">
                   <span className="text-[9px] text-blue-400">PHY {physicsReadiness}%</span>
                   <span className="text-[9px] text-emerald-400">CHM {chemistryReadiness}%</span>
                   <span className="text-[9px] text-orange-400">MTH {mathReadiness}%</span>
                 </div>
               </CardContent>
            </Card>
            <StatCard
              icon={Clock}
              label="Study"
              value={`${studyHoursToday.toFixed(1)}h`}
              subtitle={`of ${state.profile.studyHoursPerDay}h`}
              color="blue"
            />
            <StatCard
              icon={Flame}
              label="Streak"
              value={state.streaks.currentStudy}
              subtitle="days"
              color="pink"
            />
            <StatCard
              icon={CheckCircle2}
              label="Done"
              value={completedTopicsCount}
              subtitle={`of ${totalTopicsCount}`}
              color="green"
            />
            <StatCard
              icon={RotateCcw}
              label="Revisions"
              value={pendingRevisions.length}
              subtitle={pendingRevisions.length > 0 ? 'Due' : 'Clear'}
              color="orange"
            />
          </div>
        </section>

        {/* ─── Quick Actions ─── */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Quick Actions
          </h2>
          <div className="grid grid-cols-4 sm:grid-cols-4 gap-2 sm:gap-3">
            <Link href="/tutor">
              <Button
                variant="outline"
                size="lg"
                className="w-full h-auto py-3 sm:py-4 flex flex-col items-center gap-1.5 sm:gap-2 hover:bg-blue-500/10 hover:border-blue-500/30 transition-colors"
              >
                <Play className="size-4 sm:size-5 text-blue-400" />
                <span className="text-[10px] sm:text-xs font-medium">Study</span>
              </Button>
            </Link>
            <Link href="/tests">
              <Button
                variant="outline"
                size="lg"
                className="w-full h-auto py-3 sm:py-4 flex flex-col items-center gap-1.5 sm:gap-2 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-colors"
              >
                <FileQuestion className="size-4 sm:size-5 text-emerald-400" />
                <span className="text-[10px] sm:text-xs font-medium">Test</span>
              </Button>
            </Link>
            <Link href="/revisions">
              <Button
                variant="outline"
                size="lg"
                className="w-full h-auto py-3 sm:py-4 flex flex-col items-center gap-1.5 sm:gap-2 hover:bg-orange-500/10 hover:border-orange-500/30 transition-colors"
              >
                <RotateCcw className="size-4 sm:size-5 text-orange-400" />
                <span className="text-[10px] sm:text-xs font-medium">Revise</span>
              </Button>
            </Link>
            <Link href="/coach">
              <Button
                variant="outline"
                size="lg"
                className="w-full h-auto py-3 sm:py-4 flex flex-col items-center gap-1.5 sm:gap-2 hover:bg-purple-500/10 hover:border-purple-500/30 transition-colors"
              >
                <Bot className="size-4 sm:size-5 text-purple-400" />
                <span className="text-[10px] sm:text-xs font-medium">Coach</span>
              </Button>
            </Link>
          </div>
        </section>

        {/* ─── Bottom Grid: Recent Activity + Upcoming Revisions ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {/* Recent Activity */}
          <Card className="bg-background/60 border-border/40">
            <CardHeader className="p-3 pb-0 sm:p-4 sm:pb-0">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <BookOpen className="size-3.5 text-muted-foreground" />
                  Recent Activity
                </CardTitle>
                {recentLogs.length > 0 && (
                  <Link href="/analytics">
                    <Button variant="ghost" size="xs" className="text-muted-foreground h-6 px-2 text-[10px]">
                      All
                      <ArrowRight className="size-3 ml-1" />
                    </Button>
                  </Link>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-2 sm:p-3">
              {recentLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <BookOpen className="size-6 text-muted-foreground/40 mb-1.5" />
                  <p className="text-xs text-muted-foreground">No sessions yet</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {recentLogs.map((log) => {
                    const meta = subjectMeta[log.subject] || subjectMeta.physics;
                    const SubjectIcon = meta.icon;
                    return (
                      <div
                        key={log.id}
                        className="flex items-center gap-3 py-2 px-1.5 rounded-md hover:bg-muted/30 transition-colors group"
                      >
                        <div className="p-1 rounded bg-muted/50">
                          <SubjectIcon className={`size-3 ${meta.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
                            {log.description}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {logTypeLabels[log.type] || log.type} · {log.duration}m
                          </p>
                        </div>
                        <div className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                          {format(parseISO(log.date), 'MMM d')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Revisions */}
          <Card className="bg-background/60 border-border/40">
            <CardHeader className="p-3 pb-0 sm:p-4 sm:pb-0">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <RotateCcw className="size-3.5 text-muted-foreground" />
                  Upcoming Revisions
                </CardTitle>
                {upcomingRevisions.length > 0 && (
                  <Link href="/revisions">
                    <Button variant="ghost" size="xs" className="text-muted-foreground h-6 px-2 text-[10px]">
                      All
                      <ArrowRight className="size-3 ml-1" />
                    </Button>
                  </Link>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-2 sm:p-3">
              {upcomingRevisions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <RotateCcw className="size-6 text-muted-foreground/40 mb-1.5" />
                  <p className="text-xs text-muted-foreground">No pending revisions</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {upcomingRevisions.map((rev, idx) => {
                    const meta = subjectMeta[rev.subject] || subjectMeta.physics;
                    const SubjectIcon = meta.icon;
                    const isOverdue = rev.dueDate < todayDate;
                    const isDueToday = rev.dueDate === todayDate;
                    return (
                      <div
                        key={`${rev.topicId}-${rev.revisionNumber}-${idx}`}
                        className="flex items-center gap-3 py-2 px-1.5 rounded-md hover:bg-muted/30 transition-colors group"
                      >
                        <div className="p-1 rounded bg-muted/50">
                          <SubjectIcon className={`size-3 ${meta.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
                            {rev.topicName}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {rev.chapterName} · R{rev.revisionNumber}
                          </p>
                        </div>
                        <div className="shrink-0">
                          {isOverdue ? (
                            <span className="text-[9px] text-red-400 font-medium">Overdue</span>
                          ) : isDueToday ? (
                            <span className="text-[9px] text-amber-400 font-medium">Today</span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground tabular-nums">
                              {format(parseISO(rev.dueDate), 'MMM d')}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ─── Study Progress Bar ─── */}
        {totalTopicsCount > 0 && (
          <Card className="bg-background/60 border-border/40">
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Syllabus Progress
                </span>
                <span className="text-xs font-bold tabular-nums">
                  {Math.round((completedTopicsCount / totalTopicsCount) * 100)}%
                </span>
              </div>
              <Progress value={(completedTopicsCount / totalTopicsCount) * 100} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {completedTopicsCount} of {totalTopicsCount} topics
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
