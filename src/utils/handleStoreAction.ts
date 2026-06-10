import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import type { AppState, DailyPlan, SubjectId, TopicStatus, PlanTask } from '@/types';

type Dispatch = (action: any) => void;

export interface StoreActionDeps {
  dispatch: Dispatch;
  getTopicById: (topicId: string) => { topic: any; chapter: any; subject: any } | null;
  completeTopicWithRevisions: (topicId: string, chapterId: string, subject: SubjectId, topicName: string, chapterName: string, status?: TopicStatus) => void;
  logStudy: (description: string, topicId: string, chapterId: string, subject: SubjectId, duration: number, type: 'study' | 'revision' | 'practice' | 'test' | 'school') => void;
  state: AppState;
  generateDailyPlan: () => DailyPlan;
  router: any;
}

function tokenSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return Math.min(a.length, b.length) / Math.max(a.length, b.length);
  const maxLen = Math.max(a.length, b.length);
  let dist = 0;
  for (let i = 0; i < maxLen; i++) {
    if (a[i] !== b[i]) dist++;
    if (dist > maxLen) break;
  }
  return (maxLen - dist) / maxLen;
}

function findTopicByName(state: AppState, input: string): { topic: any; chapter: any; subject: any } | null {
  if (!input) return null;
  const clean = input.toLowerCase().trim();
  if (clean.length < 2) return null;
  const STOP = new Set(['it', 'the', 'a', 'an', 'is', 'are', 'my', 'your', 'this', 'that', 'topic', 'chapter', 'subject', 'all', 'every', 'each']);

  for (const sub of state.syllabus) {
    for (const ch of sub.chapters) {
      for (const t of ch.topics) {
        const tname = t.name.toLowerCase();
        if (tname === clean) return { topic: t, chapter: ch, subject: sub };
        if (tname.includes(clean) || clean.includes(tname)) {
          return { topic: t, chapter: ch, subject: sub };
        }
      }
    }
  }
  // Fuzzy token match
  let best: { topic: any; chapter: any; subject: any } | null = null;
  let bestScore = 0;
  const inputTokens = clean.split(/[\s,&]+/).filter(w => w.length >= 3 && !STOP.has(w));
  if (inputTokens.length === 0) return null;
  for (const sub of state.syllabus) {
    for (const ch of sub.chapters) {
      for (const t of ch.topics) {
        const topicTokens = t.name.toLowerCase().split(/[\s,&]+/).filter(w => w.length >= 3);
        if (topicTokens.length === 0) continue;
        let matchedScore = 0;
        for (const it of inputTokens) {
          let tb = 0;
          for (const tt of topicTokens) {
            const s = tokenSimilarity(it, tt);
            if (s > tb) tb = s;
          }
          if (tb >= 0.55) matchedScore += tb;
        }
        const total = matchedScore / inputTokens.length;
        if (total > bestScore && total >= 0.55) {
          best = { topic: t, chapter: ch, subject: sub };
          bestScore = total;
        }
      }
    }
  }
  return best;
}

function findChapterByName(state: AppState, input: string): { chapter: any; subject: any } | null {
  if (!input) return null;
  const clean = input.toLowerCase().trim();
  for (const sub of state.syllabus) {
    for (const ch of sub.chapters) {
      if (ch.name.toLowerCase() === clean) return { chapter: ch, subject: sub };
      if (ch.name.toLowerCase().includes(clean) || clean.includes(ch.name.toLowerCase())) {
        return { chapter: ch, subject: sub };
      }
    }
  }
  return null;
}

function resolveTopicNamesToIds(state: AppState, names: string[]): { topicIds: string[]; resolved: { name: string; id: string }[] } {
  const topicIds: string[] = [];
  const resolved: { name: string; id: string }[] = [];
  for (const n of names) {
    const r = findTopicByName(state, n);
    if (r) {
      topicIds.push(r.topic.id);
      resolved.push({ name: r.topic.name, id: r.topic.id });
    }
  }
  return { topicIds, resolved };
}

function resolveChapterNamesToIds(state: AppState, names: string[]): string[] {
  const ids: string[] = [];
  for (const n of names) {
    const r = findChapterByName(state, n);
    if (r) ids.push(r.chapter.id);
  }
  return ids;
}

export function handleStoreAction(action: string, args: any, deps: StoreActionDeps): void {
  const { dispatch, completeTopicWithRevisions, logStudy, state, generateDailyPlan, router } = deps;

  switch (action) {

    case 'reset_syllabus': {
      if (!args.confirmation) {
        console.warn('[AI Action] reset_syllabus called without confirmation');
        return;
      }

      const scope = (args.scope as 'all' | 'subject' | 'chapter' | 'topic' | undefined) ?? 'all';
      let subjectIds: SubjectId[] = [];
      let chapterIds: string[] = [];
      let topicIds: string[] = [];

      if (scope === 'subject') {
        if (Array.isArray(args.subjects)) {
          subjectIds = args.subjects.filter((s: string) => s === 'physics' || s === 'chemistry' || s === 'mathematics');
        }
        if (subjectIds.length === 0) {
          console.warn('[AI Action] reset_syllabus scope=subject but no subjects provided');
          return;
        }
      } else if (scope === 'chapter') {
        if (Array.isArray(args.chapterIds)) {
          chapterIds = args.chapterIds.filter((c: unknown): c is string => typeof c === 'string');
        }
        if (Array.isArray(args.chapterNames)) {
          chapterIds.push(...resolveChapterNamesToIds(state, args.chapterNames));
        }
        if (chapterIds.length === 0) {
          console.warn('[AI Action] reset_syllabus scope=chapter but no chapterIds/names provided');
          return;
        }
      } else if (scope === 'topic') {
        if (Array.isArray(args.topicIds)) {
          topicIds = args.topicIds.filter((t: unknown): t is string => typeof t === 'string');
        }
        if (Array.isArray(args.topicNames)) {
          topicIds.push(...resolveTopicNamesToIds(state, args.topicNames).topicIds);
        }
        if (topicIds.length === 0) {
          console.warn('[AI Action] reset_syllabus scope=topic but no topicIds/names provided');
          return;
        }
      }

      dispatch({ type: 'RESET_SYLLABUS_PROGRESS', payload: { scope, subjectIds, chapterIds, topicIds } });
      break;
    }

    case 'bulk_update_topics': {
      const status = args.status as TopicStatus;
      let topicIds: string[] = [];
      const validStatus: TopicStatus[] = ['learning', 'completed', 'revised', 'mastered', 'not_started'];
      if (!validStatus.includes(status)) {
        console.warn('[AI Action] bulk_update_topics invalid status:', status);
        return;
      }

      if (Array.isArray(args.topicNames)) {
        topicIds.push(...resolveTopicNamesToIds(state, args.topicNames).topicIds);
      }

      let pool = state.syllabus;
      if (args.subject) {
        pool = pool.filter(s => s.id === args.subject);
      }
      if (args.chapterId) {
        pool = pool.map(s => ({ ...s, chapters: s.chapters.filter(c => c.id === args.chapterId) })).filter(s => s.chapters.length > 0);
      } else if (args.chapterName) {
        pool = pool.map(s => ({ ...s, chapters: s.chapters.filter(c => c.name.toLowerCase() === args.chapterName.toLowerCase()) })).filter(s => s.chapters.length > 0);
      }

      for (const sub of pool) {
        for (const ch of sub.chapters) {
          for (const t of ch.topics) {
            if (args.onlyWeak && t.accuracy >= 60 && t.confidence >= 3) continue;
            if (args.onlyUnstarted && t.status !== 'not_started') continue;
            if (topicIds.length > 0 && !topicIds.includes(t.id)) continue;
            topicIds.push(t.id);
          }
        }
      }

      topicIds = Array.from(new Set(topicIds));
      if (topicIds.length === 0) {
        console.warn('[AI Action] bulk_update_topics: no topics matched filters');
        return;
      }

      dispatch({
        type: 'BULK_UPDATE_TOPICS',
        payload: {
          topicIds,
          status,
          confidence: typeof args.confidence === 'number' ? args.confidence : undefined,
          accuracy: typeof args.accuracy === 'number' ? args.accuracy : undefined,
          source: 'ai_tutor',
        }
      });
      break;
    }

    case 'generate_flashcards': {
      if (Array.isArray(args.flashcards)) {
        args.flashcards.forEach((fc: any) => {
          dispatch({
            type: 'ADD_FLASHCARD',
            payload: {
              id: `fc-ai-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              front: fc.front || 'Unknown Question',
              back: fc.back || 'Unknown Answer',
              subject: args.subject || 'physics',
              chapterId: '',
              chapterName: args.chapterName || '',
              topicId: '',
              topicName: args.topicName || '',
              tags: Array.isArray(fc.tags) ? fc.tags : [],
              createdAt: new Date().toISOString(),
              lastReviewedAt: null,
              nextReviewAt: null,
              easeFactor: 2.5,
              intervalDays: 0,
              repetitions: 0,
              isPinned: false,
              isLatex: !!fc.isLatex,
            }
          });
        });
      }
      router.push('/flashcards');
      break;
    }

    case 'generate_mock_test': {
      const params = new URLSearchParams();
      const subjects = Array.isArray(args.subjects)
        ? args.subjects.filter((s: string) => s === 'physics' || s === 'chemistry' || s === 'mathematics')
        : (typeof args.subjects === 'string' && args.subjects.length > 0 ? [args.subjects] : []);
      if (subjects.length > 0) {
        params.set('subjects', subjects.join(','));
      }
      if (args.difficulty) {
        params.set('difficulty', String(args.difficulty));
      }
      if (args.questionCount) {
        params.set('count', String(args.questionCount));
      }
      if (args.testType) {
        params.set('type', String(args.testType));
      }
      if (Array.isArray(args.topicNames) && args.topicNames.length > 0) {
        const { topicIds } = resolveTopicNamesToIds(state, args.topicNames);
        if (topicIds.length > 0) {
          params.set('topics', topicIds.join(','));
          params.set('topicNames', args.topicNames.join(','));
        }
      }
      if (Array.isArray(args.chapterNames) && args.chapterNames.length > 0) {
        const chapterIds = resolveChapterNamesToIds(state, args.chapterNames);
        if (chapterIds.length > 0) {
          params.set('chapters', chapterIds.join(','));
        }
      }
      if (args.durationMinutes) {
        params.set('duration', String(args.durationMinutes));
      }
      if (args.aiAdaptive) {
        params.set('adaptive', '1');
      }
      if (args.title) {
        params.set('title', String(args.title));
      }
      if (args.dqKey) {
        params.set('dqKey', String(args.dqKey));
      }
      const query = params.toString();
      router.push(query ? `/tests?${query}` : '/tests');
      break;
    }

    case 'mark_topic_confidence': {
      const r = findTopicByName(state, args.topicName);
      if (!r) {
        console.warn('[AI Action] mark_topic_confidence: topic not found:', args.topicName);
        return;
      }
      dispatch({
        type: 'UPDATE_TOPIC_STATUS',
        payload: {
          topicId: r.topic.id,
          status: r.topic.status,
          confidence: Math.max(0, Math.min(5, Number(args.confidence) || 0)),
          accuracy: Math.max(0, Math.min(100, Number(args.accuracy) || 0)),
          source: 'ai_tutor',
        }
      });
      break;
    }

    case 'navigate': {
      let path = String(args.path);
      if (!path.startsWith('/')) path = '/' + path;
      if (args.params && typeof args.params === 'object') {
        const qp = new URLSearchParams();
        for (const [k, v] of Object.entries(args.params)) {
          if (typeof v === 'string') qp.set(k, v);
          else if (typeof v === 'number' || typeof v === 'boolean') qp.set(k, String(v));
        }
        const qs = qp.toString();
        if (qs) path += (path.includes('?') ? '&' : '?') + qs;
      }
      if (args.tab) {
        path += (path.includes('?') ? '&' : '#') + String(args.tab);
      }
      router.push(path);
      break;
    }

    case 'schedule_revision':
      if (args.topicName) {
        const r = findTopicByName(state, args.topicName);
        if (r) {
          const daysAhead = Math.max(0, Number(args.daysAhead) || 1);
          dispatch({
            type: 'ADD_REVISION',
            payload: {
              id: uuidv4(),
              topicId: r.topic.id,
              chapterId: r.chapter.id,
              subject: r.subject.id as SubjectId,
              topicName: r.topic.name,
              chapterName: r.chapter.name,
              dueDate: format(new Date(Date.now() + daysAhead * 86400000), 'yyyy-MM-dd'),
              completedDate: null,
              revisionNumber: 1,
            },
          });
        }
      }
      break;

    case 'add_insight': {
      const allowedTypes = ['revision_reminder', 'weakness_alert', 'accuracy_drop', 'priority_suggestion', 'achievement', 'study_pattern', 'forgetting_alert'];
      const insightType = allowedTypes.includes(args.type) ? args.type : 'study_pattern';
      dispatch({
        type: 'ADD_INSIGHT',
        payload: {
          id: uuidv4(),
          type: insightType as any,
          message: String(args.message || 'Insight'),
          priority: ['high', 'medium', 'low'].includes(args.priority) ? args.priority : 'medium',
          date: new Date().toISOString(),
          actionable: true,
          dismissed: false,
          relatedTopicId: args.relatedTopicId,
          relatedSubject: args.relatedSubject,
        },
      });
      break;
    }

    case 'update_topic_status': {
      const r = findTopicByName(state, args.topicName);
      if (!r) {
        console.warn('[AI Action] update_topic_status: topic not found:', args.topicName);
        return;
      }
      const validStatus: TopicStatus[] = ['learning', 'completed', 'revised', 'mastered', 'not_started'];
      if (!validStatus.includes(args.status)) {
        console.warn('[AI Action] update_topic_status: invalid status:', args.status);
        return;
      }
      const scheduleRevisions = args.scheduleRevisions !== false;
      dispatch({
        type: 'UPDATE_TOPIC_STATUS',
        payload: {
          topicId: r.topic.id,
          status: args.status,
          confidence: typeof args.confidence === 'number' ? Math.max(0, Math.min(5, args.confidence)) : undefined,
          accuracy: typeof args.accuracy === 'number' ? Math.max(0, Math.min(100, args.accuracy)) : undefined,
          source: 'ai_tutor',
        }
      });
      if (args.note && typeof args.note === 'string') {
        // Note is attached to the topic; we don't have a separate action for this,
        // so the reducer is responsible for accepting it. We log a console hint
        // for the future. For now, store it as a coach insight.
        dispatch({
          type: 'ADD_INSIGHT',
          payload: {
            id: uuidv4(),
            type: 'study_pattern',
            message: `Note for "${r.topic.name}": ${args.note}`,
            priority: 'low',
            date: new Date().toISOString(),
            actionable: false,
            dismissed: false,
            relatedTopicId: r.topic.id,
            relatedSubject: r.subject.id,
          }
        });
      }
      if (scheduleRevisions && (args.status === 'completed' || args.status === 'revised' || args.status === 'mastered')) {
        completeTopicWithRevisions(
          r.topic.id,
          r.chapter.id,
          r.subject.id as SubjectId,
          r.topic.name,
          r.chapter.name,
          args.status,
        );
      }
      break;
    }

    case 'log_study': {
      const r = findTopicByName(state, args.topicName);
      if (!r) {
        console.warn('[AI Action] log_study: topic not found:', args.topicName);
        return;
      }
      const validTypes = ['study', 'revision', 'practice', 'test', 'school'] as const;
      const sessionType = (validTypes as readonly string[]).includes(args.type) ? args.type : 'study';
      logStudy(
        args.note || args.description || `Studied ${r.topic.name}`,
        r.topic.id,
        r.chapter.id,
        r.subject.id as SubjectId,
        Math.max(1, Number(args.durationMinutes) || 30),
        sessionType as any,
      );
      break;
    }

    case 'update_profile': {
      // Pass the entire args to the reducer so it can partition standard vs custom keys
      dispatch({ type: 'UPDATE_PROFILE', payload: args as any });
      break;
    }

    case 'set_weekly_goals': {
      const payload: any = {};
      const keys = ['studyHours', 'topicsToComplete', 'testsToTake', 'revisionsToComplete'];
      for (const k of keys) {
        if (typeof args[k] === 'number') payload[k] = Math.max(0, args[k]);
      }
      if (Object.keys(payload).length > 0) {
        dispatch({ type: 'UPDATE_WEEKLY_GOALS', payload });
      }
      break;
    }

    case 'add_resource': {
      if (!args.name || !args.url) {
        console.warn('[AI Action] add_resource missing name or url');
        return;
      }
      const validTypes = ['pdf', 'notes', 'formula_sheet', 'dpp', 'reference'] as const;
      const rtype = (validTypes as readonly string[]).includes(args.type) ? args.type : 'reference';
      const sub = ['physics', 'chemistry', 'mathematics', 'general'].includes(args.subject) ? args.subject : 'general';
      dispatch({
        type: 'ADD_RESOURCE',
        payload: {
          id: uuidv4(),
          name: String(args.name),
          type: rtype as any,
          subject: sub as any,
          description: args.description || '',
          url: String(args.url),
          addedDate: new Date().toISOString().split('T')[0],
          source: 'ai_tutor',
        }
      });
      break;
    }

    case 'remove_resource': {
      if (!args.name) return;
      const lower = String(args.name).toLowerCase();
      const target = state.resources.find(r =>
        r.name.toLowerCase().includes(lower) || lower.includes(r.name.toLowerCase())
      );
      if (target) {
        dispatch({ type: 'REMOVE_RESOURCE', payload: target.id });
      } else {
        console.warn('[AI Action] remove_resource: not found:', args.name);
      }
      break;
    }

    case 'create_plan_task': {
      const todayStr = args.date && /^\d{4}-\d{2}-\d{2}$/.test(args.date) ? args.date : format(new Date(), 'yyyy-MM-dd');
      let plan = state.dailyPlans.find((p) => p.date === todayStr);
      if (!plan) {
        if (todayStr === format(new Date(), 'yyyy-MM-dd')) {
          plan = generateDailyPlan();
        } else {
          plan = {
            id: uuidv4(),
            date: todayStr,
            tasks: [],
            completed: false,
          };
        }
      }
      const validTypes = ['study', 'revision', 'practice', 'test', 'break'] as const;
      const taskType = (validTypes as readonly string[]).includes(args.type) ? args.type : 'study';
      const newTask: PlanTask = {
        id: uuidv4(),
        time: args.time || '18:00',
        title: String(args.title || 'Study task'),
        description: String(args.description || ''),
        type: taskType as any,
        duration: Math.max(5, Number(args.duration) || 60),
        completed: false,
        topicId: args.topicId,
        subject: args.subject,
      };
      const updatedPlan = {
        ...plan,
        tasks: [...plan.tasks, newTask].sort((a, b) => a.time.localeCompare(b.time)),
      };
      dispatch({ type: 'UPDATE_DAILY_PLAN', payload: updatedPlan });
      break;
    }

    case 'add_mistake': {
      const r = findTopicByName(state, args.topicName);
      if (!r) {
        console.warn('[AI Action] add_mistake: topic not found:', args.topicName);
        return;
      }
      dispatch({
        type: 'ADD_MISTAKE',
        payload: {
          id: uuidv4(),
          questionId: `ai-mistake-${Date.now()}`,
          questionText: args.questionText,
          options: args.options || [],
          correctAnswer: typeof args.correctAnswer === 'number' ? args.correctAnswer : 0,
          userAnswer: typeof args.userAnswer === 'number' ? args.userAnswer : 0,
          explanation: args.explanation || '',
          topicId: r.topic.id,
          topicName: r.topic.name,
          chapterName: r.chapter.name,
          subject: r.subject.id as SubjectId,
          timestamp: new Date().toISOString(),
          status: 'pending',
          nextReplayDate: new Date(Date.now() + 24 * 3600000).toISOString(),
        }
      });
      break;
    }

    case 'resolve_mistake': {
      dispatch({
        type: 'RESOLVE_MISTAKE',
        payload: { mistakeId: args.mistakeId }
      });
      break;
    }

    default:
      console.warn('[AI Action] Unknown action:', action);
  }
}
