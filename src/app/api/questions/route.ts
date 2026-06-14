import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { env } from '@/lib/env';
import { reportError } from '@/lib/observability';
import type { TestQuestion } from '@/types';

// GET /api/questions — serve the shared question bank from the DB, filtered and
// paginated, so the client never has to bundle the full static file.
//
// Query params (all optional):
//   subject     physics | chemistry | mathematics
//   topicId     comma-separated topic ids
//   chapterId   comma-separated chapter ids
//   difficulty  easy | medium | hard | jee_main (jee_main = no filter)
//   limit       page size (default 50, max 200)
//   offset      pagination offset (default 0)
//
// Caching: responses are immutable reference data, so we set a long
// stale-while-revalidate Cache-Control header for CDN/SWR-style client caching.
// If the table is missing/unseeded, we degrade to the static bank so tests keep
// working exactly as before.

export const dynamic = 'force-dynamic';

function rowToQuestion(r: Record<string, unknown>): TestQuestion {
  return {
    id: String(r.id),
    question: String(r.question),
    options: (r.options as string[]) ?? [],
    correctAnswer: Number(r.correct_answer),
    explanation: String(r.explanation ?? ''),
    topicId: (r.topic_id as string) ?? undefined,
    chapterId: (r.chapter_id as string) ?? undefined,
    subject: r.subject as TestQuestion['subject'],
    difficulty: r.difficulty as TestQuestion['difficulty'],
    type: (r.type as TestQuestion['type']) ?? 'mcq',
  };
}

function csv(param: string | null): string[] {
  return param ? param.split(',').map(s => s.trim()).filter(Boolean) : [];
}

async function staticFallback(): Promise<TestQuestion[]> {
  const { questionBank } = await import('@/data/questions');
  return questionBank;
}

function applyFilters(
  pool: TestQuestion[],
  opts: { subject?: string | null; topicIds: string[]; chapterIds: string[]; difficulty?: string | null },
): TestQuestion[] {
  let out = pool;
  if (opts.subject && opts.subject !== 'all') out = out.filter(q => q.subject === opts.subject);
  if (opts.topicIds.length) out = out.filter(q => q.topicId && opts.topicIds.includes(q.topicId));
  if (opts.chapterIds.length) out = out.filter(q => q.chapterId && opts.chapterIds.includes(q.chapterId));
  if (opts.difficulty && opts.difficulty !== 'jee_main') out = out.filter(q => q.difficulty === opts.difficulty);
  return out;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const subject = url.searchParams.get('subject');
  const topicIds = csv(url.searchParams.get('topicId'));
  const chapterIds = csv(url.searchParams.get('chapterId'));
  const difficulty = url.searchParams.get('difficulty');
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 200);
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);

  const cacheHeaders = {
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
  };

  let questions: TestQuestion[] | null = null;

  if (env.supabaseConfigured) {
    try {
      const cookieStore = await cookies();
      const supabase = createClient(cookieStore);
      let query = supabase.from('questions').select('*');
      if (subject && subject !== 'all') query = query.eq('subject', subject);
      if (topicIds.length) query = query.in('topic_id', topicIds);
      if (chapterIds.length) query = query.in('chapter_id', chapterIds);
      if (difficulty && difficulty !== 'jee_main') query = query.eq('difficulty', difficulty);
      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        questions = data.map(rowToQuestion);
      }
    } catch (err) {
      reportError(err, { scope: 'api/questions' });
    }
  }

  // Degrade to the static bank if the DB is unconfigured, unseeded, or errored.
  if (!questions) {
    const filtered = applyFilters(await staticFallback(), { subject, topicIds, chapterIds, difficulty });
    questions = filtered.slice(offset, offset + limit);
  }

  return NextResponse.json(
    { questions, count: questions.length, offset, limit },
    { headers: cacheHeaders },
  );
}
