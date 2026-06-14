import { createClient } from './client';
import type { TestQuestion } from '@/types';

// Seed the shared `questions` table from the static bank in src/data/questions.ts.
//
// Idempotent: returns early if the table already has rows, and upserts by primary
// key (ignoreDuplicates) so a re-run never duplicates or clobbers. Runs from the
// browser using the anon/publishable key — the table's "Anyone can insert" RLS
// policy permits the seed; there is no update/delete policy, so the bank is
// effectively read-only once populated.
//
// Validation: every row must have exactly 4 options and a correct_answer in
// range, mirroring the import-pipeline contract in the AGY plan. Malformed
// questions are skipped (with a warning) rather than written.

let supabaseClient: ReturnType<typeof createClient> | null = null;
function getClient() {
  if (!supabaseClient) supabaseClient = createClient();
  return supabaseClient;
}

interface QuestionRow {
  id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  topic_id: string | null;
  chapter_id: string | null;
  subject: string;
  difficulty: string;
  type: string;
}

function toRow(q: TestQuestion): QuestionRow | null {
  if (!q.id || !q.question) return null;
  if (!Array.isArray(q.options) || q.options.length !== 4) return null;
  if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3) return null;
  return {
    id: q.id,
    question: q.question,
    options: q.options,
    correct_answer: q.correctAnswer,
    explanation: q.explanation ?? '',
    topic_id: q.topicId ?? null,
    chapter_id: q.chapterId ?? null,
    subject: q.subject,
    difficulty: q.difficulty ?? 'medium',
    type: q.type ?? 'mcq',
  };
}

export async function seedQuestionsTable(): Promise<void> {
  try {
    const supabase = getClient();
    const { data: existing, error: selectErr } = await supabase.from('questions').select('id').limit(1);
    if (selectErr) {
      console.warn('Cannot check questions table — skipping seed. Run supabase_schema.sql:', selectErr.message);
      return;
    }
    if (existing && existing.length > 0) return;

    // Pull the static bank only when we actually need to seed.
    const { questionBank } = await import('@/data/questions');

    const rows: QuestionRow[] = [];
    let skipped = 0;
    for (const q of questionBank) {
      const row = toRow(q);
      if (row) rows.push(row);
      else skipped++;
    }
    if (skipped > 0) {
      console.warn(`seedQuestionsTable: skipped ${skipped} malformed question(s) (need 4 options + valid answer index)`);
    }

    // 100-row chunks to stay under Supabase request size limits
    const chunkSize = 100;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase
        .from('questions')
        .upsert(chunk, { onConflict: 'id', ignoreDuplicates: true });
      if (error) {
        console.warn('seedQuestionsTable chunk failed (missing RLS policy?):', error.message || error);
        break;
      }
    }
  } catch (e) {
    console.error('seedQuestionsTable error:', e);
  }
}
