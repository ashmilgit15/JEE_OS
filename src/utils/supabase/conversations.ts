import type { SupabaseClient } from '@supabase/supabase-js';

function computeReadiness(state: any) {
  const syllabus = state.syllabus || [];

  const getSubjectStats = (subjectId: string) => {
    const subject = syllabus.find((s: any) => s.id === subjectId);
    if (!subject) return { total: 0, completed: 0, mastered: 0, avgConfidence: 0, avgAccuracy: 0 };
    let total = 0, completed = 0, mastered = 0, totalConfidence = 0, totalAccuracy = 0, ratedCount = 0;
    for (const ch of subject.chapters || []) {
      for (const t of ch.topics || []) {
        total++;
        if (t.status === 'completed' || t.status === 'revised' || t.status === 'mastered') completed++;
        if (t.status === 'mastered') mastered++;
        if (t.confidence > 0) { totalConfidence += t.confidence; ratedCount++; }
        if (t.accuracy > 0) totalAccuracy += t.accuracy;
      }
    }
    return { total, completed, mastered, avgConfidence: ratedCount > 0 ? totalConfidence / ratedCount : 0, avgAccuracy: ratedCount > 0 ? totalAccuracy / ratedCount : 0 };
  };

  const getReadinessScore = (subjectId: string) => {
    const stats = getSubjectStats(subjectId);
    if (stats.total === 0) return 0;
    const completionScore = (stats.completed / stats.total) * 100;
    const confidenceScore = (stats.avgConfidence / 5) * 100;
    const subjectTests = (state.testAttempts || []).filter((t: any) =>
      t.subjectBreakdown?.some((s: any) => s.subject === subjectId)
    );
    let testAccuracy = 0;
    if (subjectTests.length > 0) {
      const totalCorrect = subjectTests.reduce((sum: number, t: any) => {
        const sb = t.subjectBreakdown?.find((s: any) => s.subject === subjectId);
        return sum + (sb?.correct ?? 0);
      }, 0);
      const totalQ = subjectTests.reduce((sum: number, t: any) => {
        const sb = t.subjectBreakdown?.find((s: any) => s.subject === subjectId);
        return sum + (sb?.total ?? 0);
      }, 0);
      testAccuracy = totalQ > 0 ? (totalCorrect / totalQ) * 100 : 0;
    }
    const subjectRevisions = (state.revisions || []).filter((r: any) => r.subject === subjectId);
    const completedRevisions = subjectRevisions.filter((r: any) => r.completedDate);
    const revisionConsistency = subjectRevisions.length > 0 ? (completedRevisions.length / subjectRevisions.length) * 100 : 0;
    return Math.round(Math.min(
      completionScore * 0.30 + confidenceScore * 0.20 + testAccuracy * 0.25 + revisionConsistency * 0.15 + (stats.mastered / Math.max(stats.total, 1)) * 100 * 0.10,
      100
    ));
  };

  const p = getReadinessScore('physics');
  const c = getReadinessScore('chemistry');
  const m = getReadinessScore('mathematics');
  return { physics: p, chemistry: c, mathematics: m, overall: Math.round((p + c + m) / 3) };
}

export function getContextSummaryFromState(state: any, pathname: string = '/') {
  const studyLogs = state.studyLogs || [];
  const syllabus = state.syllabus || [];
  const dailyPlans = state.dailyPlans || [];
  const revisions = state.revisions || [];

  const weakAreas: string[] = [];
  const learningTopics: string[] = [];
  for (const sub of syllabus) {
    for (const ch of sub.chapters || []) {
      for (const t of ch.topics || []) {
        if (t.status !== 'not_started' && (t.accuracy < 60 || t.confidence < 3)) {
          weakAreas.push(`${t.name}`);
        }
        if (t.status === 'learning' || t.status === 'in_progress') {
          learningTopics.push(t.name);
        }
      }
    }
  }

  const recentTopicNames: string[] = [];
  for (const log of studyLogs.slice(0, 15)) {
    const name = log.topicName || log.description?.split(' ').slice(0, 3).join(' ') || '';
    if (name && !recentTopicNames.includes(name)) {
      recentTopicNames.push(name);
    }
  }

  const readiness = computeReadiness(state);

  const tests = state.testAttempts || [];
  const recentTestScore = tests.length > 0
    ? Math.round((tests[0].score / Math.max(tests[0].maxScore, 1)) * 100)
    : null;

  const streak = state.streaks?.currentStudy || 0;

  const today = new Date().toISOString().slice(0, 10);
  const todayLogs = studyLogs.filter((l: any) => (l.date || '').startsWith(today));
  const studyHoursToday = Math.round((todayLogs.reduce((s: number, l: any) => s + (l.duration || 0), 0) / 60) * 10) / 10;

  const todayPlan = dailyPlans.find((p: any) => p.date === today);
  const todayTasks = todayPlan ? todayPlan.tasks.map((t:any) => t.title).join(', ') : 'None scheduled';

  let pageContext = 'Global context';
  if (pathname === '/revisions') {
    const overdue = revisions.filter((r:any) => !r.completedDate && r.dueDate < today).map((r:any) => r.topicName);
    pageContext = `User is looking at Revisions. Overdue: ${overdue.slice(0, 10).join(', ')}`;
  } else if (pathname === '/planner') {
    pageContext = `User is looking at Planner. Today's Tasks: ${todayTasks}`;
  } else if (pathname === '/syllabus') {
    pageContext = `User is looking at Syllabus. Currently learning: ${learningTopics.slice(0, 10).join(', ')}`;
  }

  return {
    recentTopics: recentTopicNames.slice(0, 5),
    weakAreas: weakAreas.slice(0, 5),
    readiness,
    recentTestScore,
    streak,
    studyHoursToday,
    pageContext,
    loadedFromStorage: true,
  };
}

export function formatContextSummary(summary: {
  recentTopics: string[];
  weakAreas: string[];
  readiness: { physics: number; chemistry: number; mathematics: number; overall: number };
  recentTestScore: number | null;
  streak: number;
  studyHoursToday: number;
  pageContext?: string;
  loadedFromStorage: boolean;
}): string {
  const parts: string[] = [];
  if (summary.readiness.overall > 0) {
    parts.push(`Overall readiness ${summary.readiness.overall}% (Physics ${summary.readiness.physics}%, Chemistry ${summary.readiness.chemistry}%, Mathematics ${summary.readiness.mathematics}%)`);
  }
  if (summary.weakAreas.length > 0) {
    parts.push(`Weak areas: ${summary.weakAreas.join(', ')}`);
  }
  if (summary.streak > 0) {
    parts.push(`Study streak: ${summary.streak} days`);
  }
  if (summary.studyHoursToday > 0) {
    parts.push(`Studied ${summary.studyHoursToday}h today`);
  }
  if (summary.recentTestScore !== null) {
    parts.push(`Last test: ${summary.recentTestScore}%`);
  }
  if (summary.recentTopics.length > 0) {
    parts.push(`Recently studied: ${summary.recentTopics.join(', ')}`);
  }
  if (summary.pageContext) {
    parts.push(`Page Context: ${summary.pageContext}`);
  }
  return parts.join('. ') + '.';
}

async function getContextSummaryFromStorage() {
  const defaultResult = {
    recentTopics: [] as string[],
    weakAreas: [] as string[],
    readiness: { physics: 0, chemistry: 0, mathematics: 0, overall: 0 },
    recentTestScore: null as number | null,
    streak: 0,
    studyHoursToday: 0,
    loadedFromStorage: false,
  };

  if (typeof window === 'undefined') return defaultResult;

  try {
    const saved = localStorage.getItem('jee-os-state');
    if (!saved) return defaultResult;
    const state = JSON.parse(saved);
    return getContextSummaryFromState(state);
  } catch {
    return defaultResult;
  }
}

export async function getContextSummary() {
  return getContextSummaryFromStorage();
}

export async function saveMessage(
  supabase: SupabaseClient | any,
  deviceId: string,
  agentType: string,
  role: string,
  content: string,
) {
  const { data: existing } = await supabase
    .from('ai_conversations')
    .select('id, messages')
    .eq('user_id', deviceId)
    .eq('agent_type', agentType)
    .maybeSingle();

  const newMessage = { role, content, timestamp: new Date().toISOString() };

  if (existing) {
    const messages = [...((existing.messages as any[]) || []), newMessage];
    await supabase.from('ai_conversations').update({ messages }).eq('id', existing.id);
  } else {
    await supabase.from('ai_conversations').insert({
      user_id: deviceId,
      agent_type: agentType,
      messages: [newMessage],
    });
  }
}

export async function loadConversationHistory(
  supabase: SupabaseClient | any,
  deviceId: string,
  agentType: string,
  maxMessages: number = 20,
): Promise<{ role: string; content: string }[]> {
  const { data } = await supabase
    .from('ai_conversations')
    .select('messages')
    .eq('user_id', deviceId)
    .eq('agent_type', agentType)
    .maybeSingle();

  if (!data?.messages) return [];

  const msgs = data.messages as any[];
  const nonSystem = msgs.filter((m: any) => m.role !== 'system');
  return nonSystem.slice(-maxMessages).map((m: any) => ({ role: m.role, content: m.content }));
}

export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    let id = localStorage.getItem('jee-os-device-id');
    if (!id) {
      id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem('jee-os-device-id', id);
    }
    return id;
  } catch {
    return 'fallback-device-id';
  }
}
