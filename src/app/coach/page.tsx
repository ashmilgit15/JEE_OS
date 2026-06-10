'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '@/store';
import { CoachInsight, SubjectId } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { extractGraphReferences, FunctionGraph } from '@/app/tutor/page';
import {
  Brain,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Target,
  Trophy,
  BarChart3,
  RefreshCw,
  Clock,
  X,
  ArrowRight,
  Send,
  User,
  Sparkles,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { startOfWeek, isAfter, parseISO } from 'date-fns';
import Link from 'next/link';
import katex from 'katex';
import { createClient } from '@/utils/supabase/client';
import { getDeviceId, getContextSummaryFromState, formatContextSummary, saveMessage } from '@/utils/supabase/conversations';
import { getDOMSummary } from '@/utils/domSummarizer';
import { MemoryStore } from '@/utils/ai/memory';
import { handleStoreAction } from '@/utils/handleStoreAction';

// ── Helpers ─────────────────────────────────────────────────────────

function renderInlineMath(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  const regex = /\$\$(.+?)\$\$|\$(.+?)\$/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const mathContent = match[1] || match[2];
    const displayMode = !!match[1];
    try {
      const html = katex.renderToString(mathContent, { displayMode, throwOnError: false });
      parts.push(<span key={key++} dangerouslySetInnerHTML={{ __html: html }} />);
    } catch {
      parts.push(match[0]);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  if (parts.length === 0) return text;
  if (parts.length === 1 && typeof parts[0] === 'string') return parts[0];
  return <>{parts}</>;
}

const insightIcon: Record<CoachInsight['type'], string> = {
  revision_reminder: '🔄',
  weakness_alert: '⚠️',
  accuracy_drop: '📉',
  priority_suggestion: '🎯',
  achievement: '🏆',
  study_pattern: '📊',
  forgetting_alert: '⏳',
};

const insightActionLink: Record<CoachInsight['type'], string> = {
  revision_reminder: '/revisions',
  weakness_alert: '/syllabus',
  accuracy_drop: '/tests',
  priority_suggestion: '/syllabus',
  achievement: '/profile',
  study_pattern: '/planner',
  forgetting_alert: '/advanced',
};

const subjectLabel: Record<SubjectId, string> = {
  physics: 'Physics',
  chemistry: 'Chemistry',
  mathematics: 'Mathematics',
};

const subjectColor: Record<SubjectId, string> = {
  physics: 'text-blue-400',
  chemistry: 'text-emerald-400',
  mathematics: 'text-amber-400',
};

const subjectBarColor: Record<SubjectId, string> = {
  physics: 'bg-blue-500',
  chemistry: 'bg-emerald-500',
  mathematics: 'bg-amber-500',
};

const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

function priorityBadge(priority: CoachInsight['priority']) {
  switch (priority) {
    case 'high':
      return <Badge className="bg-red-500/15 text-red-400 border-red-500/30">High</Badge>;
    case 'medium':
      return <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30">Medium</Badge>;
    case 'low':
      return <Badge className="bg-green-500/15 text-green-400 border-green-500/30">Low</Badge>;
  }
}

function priorityBorder(priority: CoachInsight['priority']) {
  switch (priority) {
    case 'high':
      return 'border-l-red-500';
    case 'medium':
      return 'border-l-yellow-500';
    case 'low':
      return 'border-l-green-500';
  }
}

function parseStreamEvents(line: string): any[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  try {
    return [JSON.parse(trimmed)];
  } catch {
    try {
      const objects: any[] = [];
      let braceCount = 0;
      let startIdx = -1;

      for (let i = 0; i < trimmed.length; i++) {
        if (trimmed[i] === '{') {
          if (braceCount === 0) startIdx = i;
          braceCount++;
        } else if (trimmed[i] === '}') {
          braceCount--;
          if (braceCount === 0 && startIdx !== -1) {
            const potentialJSON = trimmed.substring(startIdx, i + 1);
            try {
              objects.push(JSON.parse(potentialJSON));
            } catch {
              // Ignore invalid sub-blocks
            }
            startIdx = -1;
          }
        }
      }
      return objects;
    } catch {
      return [];
    }
  }
}

// ── Component ───────────────────────────────────────────────────────

export default function CoachPage() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    state,
    dispatch,
    generateInsights,
    getWeakTopics,
    getReadinessScore,
    getPendingRevisions,
    getOverdueRevisions,
    getTodayStudyHours,
    getTopicById,
    completeTopicWithRevisions,
    logStudy,
    generateDailyPlan,
    getExpectedJEEPerformance,
    getStudyTimeEfficiency,
    getWhatToStudyNext,
  } = useStore();

  const prediction = getExpectedJEEPerformance();
  const studyEfficiencies = getStudyTimeEfficiency();
  const nextSteps = getWhatToStudyNext();

  const [messages, setMessages] = useState<any[]>([
    {
      id: 'coach-1',
      role: 'assistant',
      content: `Hello! I'm your AI Coach and JEE mentor. 🧠

I've analyzed your current preparation state. I can help you with:
- Strategic planning for Physics, Chemistry, and Mathematics
- Overcoming performance bottlenecks (like calculation errors vs concept gaps)
- Structuring your daily study and revision plans
- Motivation and consistency tips

What guidance do you need today?`,
      timestamp: new Date(),
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Load conversation history from Supabase on mount — no longer restores
  // visible messages; kept for future use by the LLM context API.
  useEffect(() => {
    // Future: could use this for a "recent conversations" sidebar
  }, []);

  const handleSend = async () => {
    const text = chatInput.trim();
    if (!text) return;

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsTyping(true);

    try {
      const allErrors = state.testAttempts.flatMap(t => t.errors);
      const errorMap: Record<string, number> = {};
      allErrors.forEach(e => { errorMap[e.errorType] = (errorMap[e.errorType] || 0) + 1; });
      const errorsString = Object.entries(errorMap)
        .map(([type, count]) => `- ${type.replace('_', ' ')}: ${count} times`)
        .join('\n');

      const systemPrompt = `You are the Head Mentor and AI Coach of JEE OS.
Student Name: ${state.profile.name || 'Student'}
Target Year: ${state.profile.targetYear}
Class: ${state.profile.class}
Coaching: ${state.profile.coaching || 'Self Study'}
Preferred Study Time: ${state.profile.preferredStudyTime}
Learning Style: ${state.profile.studyStyle}

Current Performance Statistics:
- Physics Readiness: ${readiness.physics}%
- Chemistry Readiness: ${readiness.chemistry}%
- Mathematics Readiness: ${readiness.mathematics}%
- Study Hours Today: ${getTodayStudyHours()} hours
- Current Study Streak: ${state.streaks.currentStudy} days
- Pending Revisions: ${pendingRevisions.length} (Overdue: ${overdueRevisions.length})
- Completed Revisions: ${completedRevisions.length}
- Weakest Topics: ${weakTopics.map(t => `${t.topicName} (${t.accuracy}% acc)`).join(', ') || 'None logged yet'}

Recent Test Mistakes Analysis:
${errorsString || 'No test mistakes logged yet.'}

Provide strategic and motivational guidance. Advise on study strategies, test taking tactics, overcoming specific error types, balancing school vs coaching, and maintaining consistency. Do NOT solve individual subject questions (refer them to AI Tutor for that). Maintain a mentor-like, inspiring, and actionable tone. Use Markdown formatting.

Search & Web Tooling Guidelines:
- If search results are provided under a \`### 🌐 Web Search Results\` heading, treat them as ground truth and cite sources.
- If the heading is absent, you do NOT have real-time web access, so do not claim to have searched. For queries about real-time news or events, explicitly state you cannot browse the internet.`;

      const chatHistory = messages
        .filter(m => m.id !== 'coach-1')
        .map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content
        }));
      chatHistory.push({ role: 'user', content: text });

      const deviceId = getDeviceId();
      const contextSummaryState = getContextSummaryFromState(state, pathname);
      const contextSummary = formatContextSummary(contextSummaryState);
      const pageContent = getDOMSummary(pathname);
      const memory = new MemoryStore(deviceId);
      const memoryContext = await memory.getContextString(text, 8);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: chatHistory,
          systemPrompt,
          deviceId,
          agentType: 'coach',
          contextSummary,
          pageContent,
          memoryContext,
        }),
      });

      // Save user message to Supabase
      try {
        const supabase = createClient();
        await saveMessage(supabase, deviceId, 'coach', 'user', text);
      } catch (e) {
        console.warn('Failed to save coach user message:', e);
      }

      if (!response.ok || !response.body) {
        throw new Error('API request failed');
      }

      const coachMsgId = `coach-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: coachMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date()
      }]);
      setIsTyping(false);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const events = parseStreamEvents(line);
          for (const event of events) {
            try {
              if (event.type === 'text') {
                assistantText += event.content;
                setMessages(prev => prev.map(m => m.id === coachMsgId ? { ...m, content: assistantText } : m));
              }
              if (event.type === 'status') {
                setMessages(prev => prev.map(m => m.id === coachMsgId ? { ...m, content: event.message } : m));
              }
              if (event.type === 'resource_result' && event.payload) {
                dispatch({ type: 'ADD_RESOURCE', payload: event.payload });
              }
              if (event.type === 'client_action') {
                if (event.action === 'generate_mock_test') {
                  try {
                    const pendingDqKey = sessionStorage.getItem('pendingDqKey');
                    if (pendingDqKey) {
                      event.args = { ...event.args, dqKey: pendingDqKey };
                      sessionStorage.removeItem('pendingDqKey');
                    }
                  } catch {
                    // sessionStorage may not be available; fall through
                  }
                }
                handleStoreAction(event.action, event.args, { dispatch, getTopicById, completeTopicWithRevisions, logStudy, state, generateDailyPlan, router });
                const actionDesc = event.args.topicName
                  ? `\n\n✅ **${event.args.topicName}** marked as **${event.args.status}** in your syllabus tracker!`
                  : `\n\n✅ Action completed: ${event.action}`;
                assistantText += actionDesc;
                setMessages(prev => prev.map(m => m.id === coachMsgId ? { ...m, content: assistantText } : m));
              }
              if (event.type === 'dynamic_questions') {
                if (Array.isArray(event.questions) && event.questions.length > 0) {
                  const dqKey = `dq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                  try {
                    sessionStorage.setItem(dqKey, JSON.stringify({
                      questions: event.questions,
                      title: event.title,
                      chapterId: event.chapterId,
                      chapterName: event.chapterName,
                      subject: event.subject,
                      source: event.source,
                    }));
                    sessionStorage.setItem('pendingDqKey', dqKey);
                  } catch (e) {
                    console.warn('Failed to cache dynamic questions:', e);
                  }
                }
              }
              if (event.type === 'remember') {
                try {
                  const memStore = new MemoryStore(deviceId);
                  await memStore.add(event.observation, 'observation', 'ai_coach', event.tags || []);
                } catch (e) {
                  console.warn('Failed to save remember event in Coach:', e);
                }
              }
              if (event.type === 'error') {
                assistantText += `\n\n⚠️ ${event.message}`;
                setMessages(prev => prev.map(m => m.id === coachMsgId ? { ...m, content: assistantText } : m));
              }
            } catch {
              // Ignore event processing errors
            }
          }
        }
      }

      // Safety net: if streaming ended but we got no content at all, show a fallback
      if (!assistantText) {
        assistantText = `I'm here to support you! Let's keep working on your JEE goals.`;
        setMessages(prev => prev.map(m => m.id === coachMsgId ? { ...m, content: assistantText } : m));
      } else {
        setMessages(prev => prev.map(m => m.id === coachMsgId ? { ...m, content: assistantText } : m));
      }

      // Save assistant message to Supabase
      if (assistantText) {
        try {
          const supabase = createClient();
          await saveMessage(supabase, deviceId, 'coach', 'assistant', assistantText);
        } catch (e) {
          console.warn('Failed to save coach assistant message:', e);
        }
      }

      // Run Hermes reflection synchronously (client-driven)
      if (assistantText) {
        try {
          const context = formatContextSummary(getContextSummaryFromState(state, pathname));
          const reflectRes = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'reflect',
              query: text,
              response: assistantText,
              context: context
            })
          });
          if (reflectRes.ok) {
            const reflectData = await reflectRes.json();
            const memStore = new MemoryStore(deviceId);
            if (reflectData.userPersonaInsight && reflectData.userPersonaInsight.length > 10) {
              await memStore.add(reflectData.userPersonaInsight, 'preference', 'ai_coach', ['hermes', 'persona'], 0.85);
            }
            if (Array.isArray(reflectData.adaptationNotes)) {
              for (const note of reflectData.adaptationNotes) {
                if (note.length > 10) {
                  await memStore.add(note, 'observation', 'ai_coach', ['hermes', 'adaptation'], 0.7);
                }
              }
            }
          }
        } catch (reflectErr) {
          console.warn('Hermes reflection call failed:', reflectErr);
        }
      }
    } catch (err) {
      console.warn('AI Coach chat error:', err);
      setMessages(prev => [...prev, {
        id: `coach-err-${Date.now()}`,
        role: 'assistant',
        content: `I'm currently unable to connect to the cloud server, but based on your performance, my top recommendation is to focus on revising **${weakTopics[0]?.topicName || 'Trigonometry'}** where your accuracy is lowest, and ensure you clear your revision debt of ${overdueRevisions.length} topics. Let's keep working hard!`,
        timestamp: new Date()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  // Generate insights once per render cycle
  const insights = useMemo(() => generateInsights(), [generateInsights]);

  const activeInsights = useMemo(
    () =>
      insights
        .filter((i) => !i.dismissed)
        .sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)),
    [insights],
  );

  const dailyPriority = activeInsights.find((i) => i.type === 'priority_suggestion') ?? activeInsights[0] ?? null;

  // Readiness scores
  const readiness = useMemo(
    () => ({
      physics: getReadinessScore('physics'),
      chemistry: getReadinessScore('chemistry'),
      mathematics: getReadinessScore('mathematics'),
    }),
    [getReadinessScore],
  );

  // Weak topics
  const weakTopics = useMemo(() => getWeakTopics(5), [getWeakTopics]);

  // Revision stats
  const pendingRevisions = useMemo(() => getPendingRevisions(), [getPendingRevisions]);
  const overdueRevisions = useMemo(() => getOverdueRevisions(), [getOverdueRevisions]);
  const completedRevisions = useMemo(
    () => state.revisions.filter((r) => r.completedDate !== null),
    [state.revisions],
  );

  // Study pattern analysis (this week)
  const studyPattern = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const thisWeekLogs = state.studyLogs.filter((l) => {
      try {
        return isAfter(parseISO(l.date), weekStart);
      } catch {
        return false;
      }
    });

    const totalMinutes = thisWeekLogs.reduce((sum, l) => sum + l.duration, 0);
    const totalHours = totalMinutes / 60;

    // Days since week start (at least 1)
    const now = new Date();
    const daysSinceStart = Math.max(1, Math.ceil((now.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)));
    const avgDaily = totalHours / daysSinceStart;

    // Most studied subject
    const subjectMinutes: Record<SubjectId, number> = { physics: 0, chemistry: 0, mathematics: 0 };
    thisWeekLogs.forEach((l) => {
      if (l.subject in subjectMinutes) {
        subjectMinutes[l.subject] += l.duration;
      }
    });
    const mostStudied = (Object.entries(subjectMinutes) as [SubjectId, number][]).sort(
      (a, b) => b[1] - a[1],
    )[0];

    return {
      totalHours: Math.round(totalHours * 10) / 10,
      avgDaily: Math.round(avgDaily * 10) / 10,
      mostStudiedSubject: mostStudied?.[0] as SubjectId,
      mostStudiedMinutes: mostStudied?.[1] ?? 0,
    };
  }, [state.studyLogs]);

  const handleDismiss = (insightId: string) => {
    dispatch({ type: 'DISMISS_INSIGHT', payload: insightId });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/15 text-purple-400">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">AI Coach</h1>
              <p className="text-sm text-zinc-400">Your personal JEE preparation mentor</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="insights" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-8 bg-[#12121a] border border-white/5 p-1 rounded-lg">
            <TabsTrigger value="insights" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">Insights & Action</TabsTrigger>
            <TabsTrigger value="consult" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">Consult AI Coach</TabsTrigger>
          </TabsList>

          {/* Insights Dashboard Tab */}
          <TabsContent value="insights" className="space-y-6">
            {/* ── Daily Priority ─────────────────────────────────────── */}
            {dailyPriority && (
              <Card className="mb-8 border-0 bg-gradient-to-br from-purple-500/10 via-[#12121a] to-[#12121a] ring-purple-500/20">
                <CardHeader>
                  <CardDescription className="text-xs uppercase tracking-widest text-purple-400">
                    Today&apos;s Priority
                  </CardDescription>
                  <CardTitle className="text-lg text-white">
                    <span className="mr-2">{insightIcon[dailyPriority.type]}</span>
                    {dailyPriority.message}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-2">
                    {priorityBadge(dailyPriority.priority)}
                    {dailyPriority.relatedSubject && (
                      <Badge className="bg-white/5 text-zinc-300 border-white/10">
                        {subjectLabel[dailyPriority.relatedSubject]}
                      </Badge>
                    )}
                    <Link href={insightActionLink[dailyPriority.type]} className="ml-auto">
                      <Button variant="ghost" size="sm" className="text-purple-400 hover:text-purple-300">
                        Take Action <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
              {/* ── Left Column: Insights ─────────────────────────────── */}
              <div className="lg:col-span-2 space-y-6">
                {/* Strategic High-Yield Study Path */}
                <Card className="border-0 bg-[#12121a] ring-white/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                      <Target className="h-4 w-4 text-purple-400" />
                      Strategic High-Yield Study Path
                    </CardTitle>
                    <CardDescription className="text-xs text-zinc-500">
                      Next actionable steps prioritized by memory retention, practice gaps, and syllabus flow
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {nextSteps.length === 0 ? (
                      <p className="text-sm text-zinc-500 py-4 text-center">
                        No actionable steps. Maintain your syllabus progress to populate recommendations!
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {nextSteps.slice(0, 3).map((step, idx) => {
                          const actionColors = {
                            revise: 'bg-purple-500/15 text-purple-400 border-purple-500/20 hover:bg-purple-500/25',
                            practice: 'bg-blue-500/15 text-blue-400 border-blue-500/20 hover:bg-blue-500/25',
                            study: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/25',
                          };
                          
                          const actionUrl = step.action === 'revise' 
                            ? '/revisions' 
                            : step.action === 'practice'
                              ? `/tests?subject=${step.subject}&topics=${step.topicId}&type=topic`
                              : `/syllabus?subject=${step.subject}&search=${step.topicName}`;

                          return (
                            <div key={idx} className="flex items-start justify-between gap-4 p-3.5 rounded-lg bg-zinc-900/40 border border-white/5 transition-all hover:bg-zinc-900/60">
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold font-mono text-zinc-500">#{idx + 1}</span>
                                  <Badge className={`capitalize text-[10px] leading-none py-0.5 px-1.5 ${
                                    step.subject === 'physics' 
                                      ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' 
                                      : step.subject === 'chemistry'
                                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                        : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                  }`}>
                                    {step.subject}
                                  </Badge>
                                </div>
                                <p className="text-sm font-semibold text-white leading-normal">{step.topicName}</p>
                                <p className="text-xs text-zinc-400 leading-normal">{step.reason}</p>
                              </div>
                              <Link href={actionUrl} className="shrink-0 mt-1">
                                <Button size="sm" variant="outline" className={`text-xs gap-1.5 py-1.5 px-3 h-auto border ${actionColors[step.action]}`}>
                                  {step.action === 'revise' ? 'Revise' : step.action === 'practice' ? 'Practice' : 'Study'}
                                  <ArrowRight className="h-3 w-3" />
                                </Button>
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Active Insights */}
                <div>
                  <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-zinc-200">
                    <AlertTriangle className="h-4 w-4 text-zinc-500" />
                    Active Insights
                    <Badge className="ml-1 bg-white/5 text-zinc-400 border-white/10">{activeInsights.length}</Badge>
                  </h2>

                  {activeInsights.length === 0 ? (
                    <Card className="border-0 bg-[#12121a] ring-white/5">
                      <CardContent className="py-12 text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                          <Trophy className="h-6 w-6 text-green-400" />
                        </div>
                        <p className="text-sm text-zinc-400">
                          No active insights. You&apos;re on track — keep up the great work!
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <ScrollArea className="max-h-[540px]">
                      <div className="space-y-3 pr-2">
                        {activeInsights.map((insight) => (
                          <Card
                            key={insight.id}
                            className={`border-0 border-l-[3px] ${priorityBorder(insight.priority)} bg-[#12121a] ring-white/5`}
                          >
                            <CardContent className="py-4">
                              <div className="flex items-start gap-3">
                                <span className="mt-0.5 text-lg leading-none">{insightIcon[insight.type]}</span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm leading-relaxed text-zinc-200">{insight.message}</p>
                                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                    {priorityBadge(insight.priority)}
                                    {insight.relatedSubject && (
                                      <Badge className="bg-white/5 text-zinc-400 border-white/10">
                                        {subjectLabel[insight.relatedSubject]}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-3">
                                  <Link href={insightActionLink[insight.type]}>
                                    <Button variant="ghost" size="icon-xs" className="text-zinc-500 hover:text-purple-400">
                                      <ArrowRight className="h-3.5 w-3.5" />
                                    </Button>
                                  </Link>
                                  <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    className="text-zinc-600 hover:text-zinc-300"
                                    onClick={() => handleDismiss(insight.id)}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>

                {/* ── Weak Areas ──────────────────────────────────────── */}
                <div>
                  <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-zinc-200">
                    <TrendingDown className="h-4 w-4 text-zinc-500" />
                    Weak Areas
                  </h2>

                  {weakTopics.length === 0 ? (
                    <Card className="border-0 bg-[#12121a] ring-white/5">
                      <CardContent className="py-8 text-center">
                        <p className="text-sm text-zinc-500">No weak areas detected yet. Start practicing to get insights.</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border-0 bg-[#12121a] ring-white/5">
                      <CardContent className="divide-y divide-white/5 py-0">
                        {weakTopics.map((topic) => (
                          <div key={topic.topicId} className="flex items-center justify-between gap-4 py-3.5">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-zinc-200">{topic.topicName}</p>
                              <p className="mt-0.5 text-xs text-zinc-500">
                                {topic.chapterName} ·{' '}
                                <span className={subjectColor[topic.subject]}>{subjectLabel[topic.subject]}</span>
                              </p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <p className="text-sm font-semibold tabular-nums text-red-400">{topic.accuracy}%</p>
                                <p className="text-[10px] uppercase tracking-wide text-zinc-600">Accuracy</p>
                              </div>
                              <div className="h-8 w-px bg-white/5" />
                              <div className="text-right">
                                <p className="text-sm font-semibold tabular-nums text-zinc-400">{topic.confidence}/5</p>
                                <p className="text-[10px] uppercase tracking-wide text-zinc-600">Confidence</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>

              {/* ── Right Column: Summary ─────────────────────────────── */}
              <div className="space-y-6">
                {/* Expected JEE Score & Percentile Rank Predictor */}
                <Card className="border-0 bg-gradient-to-br from-purple-900/10 via-[#12121a] to-[#12121a] ring-1 ring-purple-500/15">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                      <Trophy className="h-4 w-4 text-purple-400" />
                      JEE Performance Predictor
                    </CardTitle>
                    <CardDescription className="text-xs text-zinc-500">
                      Telemetry based on mock tests & syllabus status
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-zinc-900/40 p-2.5 border border-white/5">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Expected Score</p>
                        <p className="text-lg font-bold text-white font-mono mt-0.5">
                          {prediction.expectedScore} <span className="text-xs text-zinc-500 font-normal">±{prediction.variance}</span>
                        </p>
                        <p className="text-[9px] text-zinc-500 mt-0.5">
                          Range: {prediction.worstCase.score} - {prediction.bestCase.score}
                        </p>
                      </div>
                      <div className="rounded-lg bg-zinc-900/40 p-2.5 border border-white/5">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Est. Percentile</p>
                        <p className="text-lg font-bold text-purple-400 font-mono mt-0.5">
                          {prediction.percentile}%
                        </p>
                        <p className="text-[9px] text-zinc-500 mt-0.5">
                          Best: {prediction.bestCase.percentile}%
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500">CSE NIT Trichy Cutoff (240)</span>
                        <span className={`text-[10px] font-semibold ${prediction.expectedScore >= 240 ? "text-emerald-400" : "text-amber-400"}`}>
                          {prediction.expectedScore >= 240 ? "Target Met!" : prediction.targetDiff}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${prediction.expectedScore >= 240 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          style={{ width: `${Math.min(100, (prediction.expectedScore / 240) * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs">
                      <span className="text-zinc-400">Confidence:</span>
                      <Badge className={`text-[9px] uppercase leading-none py-0.5 px-1.5 rounded ${
                        prediction.confidenceLevel === 'high' 
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                          : prediction.confidenceLevel === 'medium'
                            ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                            : 'bg-red-500/15 text-red-400 border-red-500/30'
                      }`}>
                        {prediction.confidenceLevel}
                      </Badge>
                      {prediction.confidenceLevel === 'low' && (
                        <span className="text-[9px] text-zinc-500 leading-tight">Need 2+ tests to calibrate</span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Performance Summary */}
                <Card className="border-0 bg-[#12121a] ring-white/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                      <Target className="h-4 w-4 text-zinc-500" />
                      Readiness Scores
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {(['physics', 'chemistry', 'mathematics'] as SubjectId[]).map((subjectId) => (
                      <div key={subjectId}>
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className={`text-sm font-medium ${subjectColor[subjectId]}`}>
                            {subjectLabel[subjectId]}
                          </span>
                          <span className="text-sm font-semibold tabular-nums text-zinc-300">
                            {readiness[subjectId]}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${subjectBarColor[subjectId]}`}
                            style={{ width: `${readiness[subjectId]}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Revision Status */}
                <Card className="border-0 bg-[#12121a] ring-white/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                      <RefreshCw className="h-4 w-4 text-zinc-500" />
                      Revision Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg bg-yellow-500/5 p-3 text-center">
                        <p className="text-xl font-bold tabular-nums text-yellow-400">{pendingRevisions.length}</p>
                        <p className="mt-0.5 text-[10px] uppercase tracking-wide text-zinc-500">Pending</p>
                      </div>
                      <div className="rounded-lg bg-red-500/5 p-3 text-center">
                        <p className="text-xl font-bold tabular-nums text-red-400">{overdueRevisions.length}</p>
                        <p className="mt-0.5 text-[10px] uppercase tracking-wide text-zinc-500">Overdue</p>
                      </div>
                      <div className="rounded-lg bg-green-500/5 p-3 text-center">
                        <p className="text-xl font-bold tabular-nums text-green-400">{completedRevisions.length}</p>
                        <p className="mt-0.5 text-[10px] uppercase tracking-wide text-zinc-500">Done</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Study Pattern Analysis */}
                <Card className="border-0 bg-[#12121a] ring-white/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                      <BarChart3 className="h-4 w-4 text-zinc-500" />
                      Study Pattern
                    </CardTitle>
                    <CardDescription className="text-xs text-zinc-500">This week</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-zinc-600" />
                        <span className="text-sm text-zinc-400">Total Study</span>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-zinc-200">
                        {studyPattern.totalHours}h
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-3.5 w-3.5 text-zinc-600" />
                        <span className="text-sm text-zinc-400">Daily Average</span>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-zinc-200">
                        {studyPattern.avgDaily}h
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Target className="h-3.5 w-3.5 text-zinc-600" />
                        <span className="text-sm text-zinc-400">Most Studied</span>
                      </div>
                      <span
                        className={`text-sm font-semibold ${
                          studyPattern.mostStudiedMinutes > 0
                            ? subjectColor[studyPattern.mostStudiedSubject]
                            : 'text-zinc-600'
                        }`}
                      >
                        {studyPattern.mostStudiedMinutes > 0
                          ? subjectLabel[studyPattern.mostStudiedSubject]
                          : '—'}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Study Time Efficiency & Marks Yield */}
                <Card className="border-0 bg-[#12121a] ring-white/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                      <TrendingUp className="h-4 w-4 text-purple-400" />
                      Study Time Efficiency
                    </CardTitle>
                    <CardDescription className="text-xs text-zinc-500">
                      Estimated marks improvement yield per hour of study
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {studyEfficiencies.map((eff) => {
                      const trendIcon = eff.trend === 'increasing' 
                        ? '📈' 
                        : eff.trend === 'decreasing'
                          ? '📉'
                          : '➡️';
                      return (
                        <div key={eff.subject} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className={`font-medium ${subjectColor[eff.subject]}`}>
                              {subjectLabel[eff.subject]} <span className="text-[10px] text-zinc-500 font-normal">({eff.studyHours}h studied)</span>
                            </span>
                            <span className="text-zinc-300 font-mono flex items-center gap-1">
                              {eff.marksYield.toFixed(2)} pts/h <span className="text-xs">{trendIcon}</span>
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${subjectBarColor[eff.subject]}`}
                              style={{ width: `${Math.min(100, eff.marksYield * 20)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Interactive Chat Tab */}
          <TabsContent value="consult">
            <Card className="border-0 bg-[#12121a] ring-white/5 flex flex-col h-[calc(100dvh-12rem)] md:h-[600px]">
              <CardHeader className="border-b border-white/5 pb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  <CardTitle className="text-sm font-medium text-zinc-200">Live Mentorship Session</CardTitle>
                </div>
                <CardDescription className="text-xs text-zinc-500">
                  Ask your coach about schedules, time management, subject balance, or specific revision plans.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col overflow-hidden p-0 bg-[#12121a]">
                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {message.role !== 'user' && (
                        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-500/15 text-purple-400">
                          <Brain className="h-3.5 w-3.5" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                          message.role === 'user'
                            ? 'bg-purple-600 text-white'
                            : 'bg-zinc-900 border border-white/5 text-zinc-100'
                        }`}
                      >
                        <div className="prose prose-invert prose-sm max-w-none [&>h2]:text-sm [&>h2]:font-semibold [&>h2]:mt-2 [&>h2]:mb-1 [&>h3]:text-xs [&>h3]:font-semibold [&>h3]:mt-2 [&>h3]:mb-1 [&>ul]:my-1 [&>ol]:my-1 [&>p]:my-1">
                          {(() => {
                            const graphData = extractGraphReferences(message.content);
                            const merged = graphData.cleanText.replace(/([^\\])\n(?!\n|#|\s*[-*]\s|```|\||\d+\.\s)/g, '$1 ');
                            const elements = merged.split('\n').map((line: string, i: number) => {
                              if (line.startsWith('## ')) return <h2 key={i}>{renderInlineMath(line.replace('## ', ''))}</h2>;
                              if (line.startsWith('### ')) return <h3 key={i}>{renderInlineMath(line.replace('### ', ''))}</h3>;
                              if (line.startsWith('- **')) {
                                const match = line.match(/^- \*\*(.+?)\*\*(.*)$/);
                                if (match) return <p key={i}>• <strong>{renderInlineMath(match[1])}</strong>{renderInlineMath(match[2])}</p>;
                              }
                              if (line.startsWith('- ')) return <p key={i}>• {renderInlineMath(line.replace('- ', ''))}</p>;
                              if (line.startsWith('1. ') || line.startsWith('2. ') || line.startsWith('3. ') || line.startsWith('4. ')) {
                                const match = line.match(/^(\d+)\. \*\*(.+?)\*\*(.*)$/);
                                if (match) return <p key={i}>{match[1]}. <strong>{renderInlineMath(match[2])}</strong>{renderInlineMath(match[3])}</p>;
                                return <p key={i}>{renderInlineMath(line)}</p>;
                              }
                              if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
                                return <p key={i} className="italic text-zinc-400">{renderInlineMath(line.replace(/^\*|\*$/g, ''))}</p>;
                              }
                              if (line === '') return <br key={i} />;
                              return <p key={i} style={{ whiteSpace: 'pre-wrap' }}>{renderInlineMath(line)}</p>;
                            });

                            return (
                              <>
                                {elements}
                                {graphData.graphs.length > 0 && (
                                  <div className="mt-4 flex flex-col gap-4">
                                    {graphData.graphs.map((graph, idx) => (
                                      <FunctionGraph key={`graph-${idx}`} expression={graph.expression} label={graph.label} />
                                    ))}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                      {message.role === 'user' && (
                        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-400">
                          <User className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </div>
                  ))}

                  {isTyping && (
                    <div className="flex gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-500/15 text-purple-400">
                        <Brain className="h-3.5 w-3.5" />
                      </div>
                      <div className="rounded-xl bg-zinc-900 border border-white/5 px-4 py-3">
                        <div className="flex gap-1">
                          <div className="h-2 w-2 rounded-full bg-zinc-600 animate-pulse" style={{ animationDelay: '0ms' }} />
                          <div className="h-2 w-2 rounded-full bg-zinc-600 animate-pulse" style={{ animationDelay: '150ms' }} />
                          <div className="h-2 w-2 rounded-full bg-zinc-600 animate-pulse" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="border-t border-white/5 p-4 bg-[#0a0a0f] rounded-b-xl">
                  <div className="flex items-center gap-2">
                    <Input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                      placeholder="Ask your Coach (e.g. 'How can I fix my chemistry calculation mistakes?')..."
                      className="flex-1 bg-zinc-900 border-white/5 text-white"
                    />
                    <Button
                      onClick={handleSend}
                      disabled={!chatInput.trim() || isTyping}
                      className="shrink-0 bg-purple-600 hover:bg-purple-700 text-white"
                      size="icon"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
