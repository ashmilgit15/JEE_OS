'use client';

import { createClient } from './client';
import type { StudyLog, RevisionItem, TestAttempt, TopicEvent, StudentProfile, Subject, MistakeEvent } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { defaultSyllabus } from '@/data/syllabus';

const DEVICE_ID_KEY = 'jee-os-device-id';

let supabaseClient: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!supabaseClient) supabaseClient = createClient();
  return supabaseClient;
}

type AgentType = 'tutor' | 'coach';

export async function initSession(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const cachedId = localStorage.getItem(DEVICE_ID_KEY);

  try {
    const supabase = getClient();

    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.user?.id) {
      const userId = sessionData.session.user.id;
      if (!cachedId) localStorage.setItem(DEVICE_ID_KEY, userId);
      await seedTopicsTable();
      return userId;
    }

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.user) {
      if (cachedId) return cachedId;
      return null;
    }

    const userId = data.user.id;
    localStorage.setItem(DEVICE_ID_KEY, userId);

    await supabase.from('users').upsert({
      id: userId,
      name: 'Anonymous User',
      class: '11',
      target_year: 2027,
      study_hours_per_day: 6,
      preferred_study_time: 'evening',
      study_style: 'visual',
    }, { onConflict: 'id', ignoreDuplicates: false });

    await seedTopicsTable();

    return userId;
  } catch {
    return cachedId || null;
  }
}

// ─── Topic Seeding (Bug 5 fix) ─────────────────────────────────────────
// Populates the `topics` table from defaultSyllabus if it's empty.
// Runs on session init so FK constraints on user_topic_status don't fail.
async function seedTopicsTable(): Promise<void> {
  try {
    const supabase = getClient();
    const { data: existing } = await supabase.from('topics').select('id').limit(1);
    if (existing && existing.length > 0) return;

    const records: { id: string; name: string; subject: string; chapter_id: string; chapter_name: string }[] = [];
    for (const sub of defaultSyllabus) {
      for (const ch of sub.chapters) {
        for (const t of ch.topics) {
          records.push({
            id: t.id,
            name: t.name,
            subject: sub.id,
            chapter_id: ch.id,
            chapter_name: ch.name,
          });
        }
      }
    }

    if (records.length > 0) {
      // 100-row chunks to stay under Supabase request size limits
      const chunkSize = 100;
      for (let i = 0; i < records.length; i += chunkSize) {
        const chunk = records.slice(i, i + chunkSize);
        const { error } = await supabase
          .from('topics')
          .upsert(chunk, { onConflict: 'id', ignoreDuplicates: true });
        if (error) {
          console.error('Failed to seed topics chunk:', error);
          break;
        }
      }
    }
  } catch (e) {
    console.error('seedTopicsTable error:', e);
  }
}

// ─── Topic Status ───────────────────────────────────────────────────────

// Bug 2 fix: single batch upsert instead of sequential per-topic network calls.
export async function syncTopicStatus(syllabus: Subject[], userId: string): Promise<void> {
  const supabase = getClient();
  try {
    const records: {
      user_id: string;
      topic_id: string;
      status: string;
      confidence: number;
      accuracy: number;
      last_studied_at: string | null;
      completed_at: string | null;
      last_revision_at: string | null;
    }[] = [];

    for (const sub of syllabus) {
      for (const ch of sub.chapters) {
        for (const t of ch.topics) {
          const rawConfidence = t.confidence !== undefined && t.confidence !== null ? Number(t.confidence) : 0;
          const confidence = isNaN(rawConfidence) ? 0 : Math.max(0, Math.min(5, rawConfidence));

          const rawAccuracy = t.accuracy !== undefined && t.accuracy !== null ? Number(t.accuracy) : 0.00;
          const accuracy = isNaN(rawAccuracy) ? 0.00 : Math.max(0.00, Math.min(100.00, rawAccuracy));

          records.push({
            user_id: userId,
            topic_id: t.id,
            status: t.status,
            confidence: confidence,
            accuracy: accuracy,
            last_studied_at: t.completedDate || null,
            completed_at: t.status === 'completed' || t.status === 'revised' || t.status === 'mastered' ? t.completedDate : null,
            last_revision_at: t.lastRevision || null,
          });
        }
      }
    }

    if (records.length === 0) return;

    // Single batch upsert — server processes the entire array in one round trip.
    const { error } = await supabase
      .from('user_topic_status')
      .upsert(records, { onConflict: 'user_id,topic_id', ignoreDuplicates: false });
    if (error) throw error;
  } catch (e) {
    console.error('Failed to sync topic status:', e);
  }
}

export async function loadUserTopicStatus(userId: string): Promise<{ topic_id: string; status: string; confidence: number; accuracy: number }[]> {
  const supabase = getClient();
  try {
    const { data } = await supabase
      .from('user_topic_status')
      .select('topic_id, status, confidence, accuracy')
      .eq('user_id', userId);

    return (data as { topic_id: string; status: string; confidence: number; accuracy: number }[]) || [];
  } catch {
    return [];
  }
}

// ─── Study Logs ─────────────────────────────────────────────────────────

// Bug 3 fix: upsert by primary key instead of delete-then-insert (data-loss safe).
// Bug 4 fix: persists subject + chapter_id and reads them back.
export async function syncStudyLogs(logs: StudyLog[], userId: string): Promise<void> {
  const supabase = getClient();
  try {
    // Delete any study logs that are not in the local list
    const localIds = logs.map(l => l.id).filter(Boolean);
    if (localIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('study_logs')
        .delete()
        .eq('user_id', userId)
        .not('id', 'in', `(${localIds.join(',')})`);
      if (deleteError) throw deleteError;
    } else {
      const { error: deleteError } = await supabase
        .from('study_logs')
        .delete()
        .eq('user_id', userId);
      if (deleteError) throw deleteError;
    }

    if (logs.length === 0) return;

    // Ensure every record has a stable id for upsert onConflict
    const records = logs.map(log => ({
      id: log.id || uuidv4(),
      user_id: userId,
      date: log.date,
      description: log.description,
      topic_id: log.topicId || null,
      chapter_id: log.chapterId || null,
      subject: log.subject || null,
      duration: log.duration,
      log_type: log.type,
    }));

    // Batch upsert — single network call per chunk
    const chunkSize = 50;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const { error } = await supabase
        .from('study_logs')
        .upsert(chunk, { onConflict: 'id', ignoreDuplicates: false });
      if (error) throw error;
    }
  } catch (e) {
    console.error('Failed to sync study logs:', e);
  }
}

export async function loadStudyLogs(userId: string): Promise<StudyLog[]> {
  const supabase = getClient();
  try {
    const { data } = await supabase
      .from('study_logs')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (!data) return [];

    return data.map((r: any) => ({
      id: r.id || uuidv4(),
      date: r.date,
      description: r.description,
      topicId: r.topic_id || '',
      chapterId: r.chapter_id || '',
      subject: (r.subject || 'physics') as StudyLog['subject'],
      duration: r.duration,
      type: r.log_type as StudyLog['type'],
    }));
  } catch {
    return [];
  }
}

// ─── Revisions ──────────────────────────────────────────────────────────

let revisionTableConfigured = false;
let revisionTableOk = false;

// Known columns from supabase_schema.sql — used as the base set.
// If an upsert fails with PGRST204 (column missing) we remove that column
// from future syncs so it stops failing.
const KNOWN_REVISION_COLUMNS: (keyof RevisionRecord)[] = [
  'id', 'user_id', 'topic_id', 'chapter_id', 'subject',
  'topic_name', 'chapter_name', 'revision_number', 'due_date', 'completed_at',
  'ease_factor', 'interval_days', 'repetitions',
];
const activeRevisionColumns = new Set(KNOWN_REVISION_COLUMNS);

interface RevisionRecord {
  id: string;
  user_id: string;
  topic_id: string;
  chapter_id: string | null;
  subject: string;
  topic_name: string | null;
  chapter_name: string | null;
  revision_number: number;
  due_date: string;
  completed_at: string | null;
  ease_factor?: number;
  interval_days?: number;
  repetitions?: number;
}

// Drop a column from future syncs after a PGRST204 error.
// This handles tables created via the Supabase dashboard with a different schema.
function dropRevisionColumn(colName: string) {
  activeRevisionColumns.delete(colName as keyof RevisionRecord);
  console.warn(
    `Column "${colName}" does not exist on revision_tasks in Supabase — ` +
    `dropping from future syncs. Run \`ALTER TABLE public.revision_tasks ADD COLUMN ${colName} text;\` to restore it.`
  );
}

// One-time check whether revision_tasks exists.
async function ensureRevisionTable(supabase: ReturnType<typeof createClient>): Promise<boolean> {
  if (revisionTableConfigured) return revisionTableOk;
  revisionTableConfigured = true;

  const { error } = await supabase.from('revision_tasks').select('id').limit(1);
  if (error) {
    console.warn(
      'revision_tasks table not found in Supabase — revisions are saved locally only. ' +
      'Run the SQL from supabase_schema.sql in your Supabase SQL editor to create it.'
    );
    return false;
  }

  revisionTableOk = true;
  return true;
}// Bug 3 fix: upsert by primary key. Bug 4 fix: persists subject + names.
export async function syncRevisions(revisions: RevisionItem[], userId: string): Promise<void> {
  const supabase = getClient();
  try {
    if (!(await ensureRevisionTable(supabase))) return;

    // Delete any revision tasks that are not in the local list
    const localIds = revisions.map(r => r.id).filter(Boolean);
    if (localIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('revision_tasks')
        .delete()
        .eq('user_id', userId)
        .not('id', 'in', `(${localIds.join(',')})`);
      if (deleteError) throw deleteError;
    } else {
      const { error: deleteError } = await supabase
        .from('revision_tasks')
        .delete()
        .eq('user_id', userId);
      if (deleteError) throw deleteError;
    }

    if (revisions.length === 0) return;
    function buildRecords() {
      return revisions.map(rev => {
        const rec: Record<string, unknown> = {};
        for (const col of activeRevisionColumns) {
          switch (col) {
            case 'id':            rec.id = rev.id || uuidv4(); break;
            case 'user_id':       rec.user_id = userId; break;
            case 'topic_id':      rec.topic_id = rev.topicId; break;
            case 'chapter_id':    rec.chapter_id = rev.chapterId || null; break;
            case 'subject':       rec.subject = rev.subject; break;
            case 'topic_name':    rec.topic_name = rev.topicName || null; break;
            case 'chapter_name':  rec.chapter_name = rev.chapterName || null; break;
            case 'revision_number': rec.revision_number = rev.revisionNumber; break;
            case 'due_date':      rec.due_date = rev.dueDate; break;
            case 'completed_at':  rec.completed_at = rev.completedDate; break;
            case 'ease_factor':   rec.ease_factor = rev.easeFactor ?? 2.5; break;
            case 'interval_days': rec.interval_days = rev.intervalDays ?? 1; break;
            case 'repetitions':   rec.repetitions = rev.repetitions ?? 0; break;
          }
        }
        return rec;
      });
    }

    let records = buildRecords();
    let retries = 5;

    while (retries > 0) {
      const { error } = await supabase
        .from('revision_tasks')
        .upsert(records, { onConflict: 'id', ignoreDuplicates: false });

      if (!error) return; // Success!

      const err = error as any;
      // PGRST204 = column referenced in request doesn't exist in the live table.
      if (err.code === 'PGRST204' && err.message) {
        const match = err.message.match(/'([^']+)'/);
        if (match && match[1]) {
          dropRevisionColumn(match[1]); // Remove the offending column
          records = buildRecords(); // Rebuild records without it
          retries--;
          continue; // Try again
        }
      }

      // If it's not a missing column error, or we can't parse it, log and stop
      console.error('Failed to sync revisions:', {
        message: err.message,
        details: err.details,
        code: err.code,
      });
      break;
    }
  } catch (e) {
    console.error('Failed to sync revisions:', (e as any)?.message ?? e);
  }
}

export async function loadRevisions(userId: string): Promise<RevisionItem[]> {
  const supabase = getClient();
  try {
    const { data } = await supabase
      .from('revision_tasks')
      .select('*')
      .eq('user_id', userId)
      .order('due_date', { ascending: true });

    if (!data) return [];

    return data.map((r: any) => ({
      id: r.id,
      topicId: r.topic_id,
      chapterId: r.chapter_id || '',
      subject: (r.subject || 'physics') as RevisionItem['subject'],
      topicName: r.topic_name || '',
      chapterName: r.chapter_name || '',
      dueDate: r.due_date,
      completedDate: r.completed_at,
      revisionNumber: r.revision_number,
      easeFactor: r.ease_factor !== undefined && r.ease_factor !== null ? Number(r.ease_factor) : 2.5,
      intervalDays: r.interval_days !== undefined && r.interval_days !== null ? Number(r.interval_days) : 1,
      repetitions: r.repetitions !== undefined && r.repetitions !== null ? Number(r.repetitions) : 0,
    }));
  } catch {
    return [];
  }
}

// ─── Test Attempts ────────────────────────────────────────────────────
// Bug 3 fix: upsert by primary key.
export async function syncTestAttempts(attempts: TestAttempt[], userId: string): Promise<void> {
  const supabase = getClient();
  try {
    // Delete any test attempts that are not in the local list
    const localIds = attempts.map(a => a.id).filter(Boolean);
    if (localIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('test_attempts')
        .delete()
        .eq('user_id', userId)
        .not('id', 'in', `(${localIds.join(',')})`);
      if (deleteError) throw deleteError;
    } else {
      const { error: deleteError } = await supabase
        .from('test_attempts')
        .delete()
        .eq('user_id', userId);
      if (deleteError) throw deleteError;
    }

    if (attempts.length === 0) return;
    const records = attempts.map(a => ({
      id: a.id,
      user_id: userId,
      date: a.date,
      test_type: a.type,
      title: a.title,
      time_spent: a.timeSpent,
      score: a.score,
      max_score: a.maxScore,
      questions_json: JSON.parse(JSON.stringify(a.questions)),
      answers_json: JSON.parse(JSON.stringify(a.answers)),
      subject_breakdown: JSON.parse(JSON.stringify(a.subjectBreakdown)),
    }));

    const chunkSize = 20;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const { error } = await supabase
        .from('test_attempts')
        .upsert(chunk, { onConflict: 'id', ignoreDuplicates: false });
      if (error) throw error;
    }
  } catch (e) {
    console.error('Failed to sync test attempts:', e);
  }
}

export async function loadTestAttempts(userId: string): Promise<TestAttempt[]> {
  const supabase = getClient();
  try {
    const { data } = await supabase
      .from('test_attempts')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (!data) return [];

    return data.map((r: any) => ({
      id: r.id,
      date: r.date,
      type: r.test_type,
      title: r.title,
      timeSpent: r.time_spent,
      score: r.score,
      maxScore: r.max_score,
      questions: r.questions_json || [],
      answers: r.answers_json || [],
      errors: [],
      subjectBreakdown: r.subject_breakdown || [],
    }));
  } catch {
    return [];
  }
}

// ─── Topic Events ──────────────────────────────────────────────────────

export async function syncTopicEvents(events: TopicEvent[], userId: string): Promise<void> {
  const supabase = getClient();
  try {
    if (events.length === 0) return;

    const records = events.slice(0, 200).map(e => ({
      user_id: userId,
      topic_id: e.topicId,
      timestamp: e.timestamp,
      field: e.field,
      old_value: String(e.oldValue),
      new_value: String(e.newValue),
      source: e.source,
    }));

    await supabase.from('topic_events').insert(records);
  } catch (e) {
    console.error('Failed to sync topic events:', e);
  }
}

export async function loadTopicEvents(userId: string): Promise<TopicEvent[]> {
  const supabase = getClient();
  try {
    const { data } = await supabase
      .from('topic_events')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(200);

    if (!data) return [];

    return data.map((r: any) => ({
      id: uuidv4(),
      topicId: r.topic_id,
      topicName: '',
      subject: 'physics' as const,
      timestamp: r.timestamp,
      field: r.field as TopicEvent['field'],
      oldValue: r.old_value,
      newValue: r.new_value,
      source: r.source as TopicEvent['source'],
    }));
  } catch {
    return [];
  }
}

// ─── AI Conversations ─────────────────────────────────────────────────

export async function syncConversation(userId: string, agentType: AgentType, messages: any[]): Promise<void> {
  const supabase = getClient();
  try {
    const existing = await supabase
      .from('ai_conversations')
      .select('id')
      .eq('user_id', userId)
      .eq('agent_type', agentType)
      .maybeSingle();

    if (existing?.data?.id) {
      await supabase
        .from('ai_conversations')
        .update({ messages })
        .eq('id', existing.data.id);
    } else {
      await supabase
        .from('ai_conversations')
        .insert({ user_id: userId, agent_type: agentType, messages });
    }
  } catch (e) {
    console.error('Failed to sync conversation:', e);
  }
}

export async function loadConversation(userId: string, agentType: AgentType): Promise<any[]> {
  const supabase = getClient();
  try {
    const { data } = await supabase
      .from('ai_conversations')
      .select('messages')
      .eq('user_id', userId)
      .eq('agent_type', agentType)
      .maybeSingle();

    return data?.messages || [];
  } catch {
    return [];
  }
}

// ─── Profile ──────────────────────────────────────────────────────────

export async function syncProfile(profile: StudentProfile, userId: string): Promise<void> {
  const supabase = getClient();
  try {
    // 1. Sanitize 'class' -> must be ('11', '12', 'dropper')
    let dbClass = '11';
    if (profile.class) {
      const cls = String(profile.class).toLowerCase();
      if (cls.includes('12')) dbClass = '12';
      else if (cls.includes('drop')) dbClass = 'dropper';
      else dbClass = '11';
    }

    // 2. Sanitize 'preferred_study_time' -> must be ('morning', 'afternoon', 'evening', 'night')
    let dbPreferredTime = 'evening';
    if (profile.preferredStudyTime) {
      const time = String(profile.preferredStudyTime).toLowerCase();
      if (time.includes('morn')) dbPreferredTime = 'morning';
      else if (time.includes('after')) dbPreferredTime = 'afternoon';
      else if (time.includes('eve') || time.includes('day')) dbPreferredTime = 'evening';
      else if (time.includes('night') || time.includes('late')) dbPreferredTime = 'night';
    }

    // 3. Sanitize 'study_style' -> must be ('visual', 'auditory', 'reading', 'kinesthetic')
    let dbStudyStyle = 'visual';
    if (profile.studyStyle) {
      const style = String(profile.studyStyle).toLowerCase();
      if (style.includes('vis') || style.includes('graph')) dbStudyStyle = 'visual';
      else if (style.includes('aud') || style.includes('listen') || style.includes('lecture')) dbStudyStyle = 'auditory';
      else if (style.includes('read') || style.includes('writ') || style.includes('note')) dbStudyStyle = 'reading';
      else if (style.includes('kin') || style.includes('prac') || style.includes('solve') || style.includes('question') || style.includes('exerc')) dbStudyStyle = 'kinesthetic';
    }

    const rawTargetYear = profile.targetYear !== undefined && profile.targetYear !== null ? Number(profile.targetYear) : 2027;
    const targetYear = isNaN(rawTargetYear) ? 2027 : rawTargetYear;

    const rawStudyHours = profile.studyHoursPerDay !== undefined && profile.studyHoursPerDay !== null ? Number(profile.studyHoursPerDay) : 6.0;
    const studyHours = isNaN(rawStudyHours) ? 6.0 : Math.max(0, Math.min(24, rawStudyHours));

    await supabase.from('users').upsert({
      id: userId,
      name: profile.name || 'Anonymous User',
      class: dbClass,
      target_year: targetYear,
      coaching: profile.coaching || null,
      school: profile.school || null,
      study_hours_per_day: studyHours,
      preferred_study_time: dbPreferredTime,
      study_style: dbStudyStyle,
    }, { onConflict: 'id', ignoreDuplicates: false });
  } catch (e) {
    console.error('Failed to sync profile:', e);
  }
}

export async function loadProfile(userId: string): Promise<Partial<StudentProfile> | null> {
  const supabase = getClient();
  try {
    const { data } = await supabase
      .from('users')
      .select('name, class, target_year, coaching, school, study_hours_per_day, preferred_study_time, study_style')
      .eq('id', userId)
      .single();

    if (!data) return null;

    return {
      name: data.name || '',
      class: data.class,
      targetYear: data.target_year,
      coaching: data.coaching || '',
      school: data.school || '',
      studyHoursPerDay: data.study_hours_per_day,
      preferredStudyTime: data.preferred_study_time || 'evening',
      studyStyle: data.study_style || 'visual',
    };
  } catch (e) {
    console.error('Failed to load profile:', e);
    return null;
  }
}

export async function syncMistakes(mistakes: MistakeEvent[], userId: string): Promise<void> {
  const supabase = getClient();
  try {
    const localIds = mistakes.map(m => m.id).filter(Boolean);
    if (localIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('mistake_events')
        .delete()
        .eq('user_id', userId)
        .not('id', 'in', `(${localIds.join(',')})`);
      if (deleteError) throw deleteError;
    } else {
      const { error: deleteError } = await supabase
        .from('mistake_events')
        .delete()
        .eq('user_id', userId);
      if (deleteError) throw deleteError;
    }

    if (mistakes.length === 0) return;

    const records = mistakes.map(m => ({
      id: m.id || uuidv4(),
      user_id: userId,
      topic_id: m.topicId || null,
      question_text: m.questionText,
      options: JSON.parse(JSON.stringify(m.options || [])),
      correct_answer: m.correctAnswer,
      user_answer: m.userAnswer,
      explanation: m.explanation || '',
      status: m.status || 'pending',
      next_replay_date: m.nextReplayDate,
      error_type: 'concept_gap',
      mistake_path: `${m.subject || 'physics'} -> ${m.chapterName || 'General'} -> ${m.topicName || 'General'}`,
    }));

    const chunkSize = 50;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const { error } = await supabase
        .from('mistake_events')
        .upsert(chunk, { onConflict: 'id', ignoreDuplicates: false });
      if (error) throw error;
    }
  } catch (e) {
    console.error('Failed to sync mistakes:', e);
  }
}

export async function loadMistakes(userId: string): Promise<MistakeEvent[]> {
  const supabase = getClient();
  try {
    const { data } = await supabase
      .from('mistake_events')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!data) return [];

    return data.map((r: any) => {
      const pathParts = (r.mistake_path || '').split(' -> ');
      const subject = (pathParts[0] || 'physics') as any;
      const chapterName = pathParts[1] || '';
      const topicName = pathParts[2] || '';

      return {
        id: r.id,
        questionId: r.id,
        questionText: r.question_text,
        options: r.options || [],
        correctAnswer: r.correct_answer,
        userAnswer: r.user_answer,
        explanation: r.explanation,
        topicId: r.topic_id || '',
        topicName,
        chapterName,
        subject,
        timestamp: r.created_at,
        status: r.status as 'pending' | 'resolved',
        nextReplayDate: r.next_replay_date,
      };
    });
  } catch (e) {
    console.error('Failed to load mistakes:', e);
    return [];
  }
}
