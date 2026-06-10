import type { TestQuestion, SubjectId, Difficulty } from '@/types';

export interface ExtractedQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  type: 'mcq' | 'numerical';
  answerText?: string;
}

interface QuestionBlock {
  raw: string;
  number?: number;
  options: string[];
  answer?: number;
  answerText?: string;
  type: 'mcq' | 'numerical';
}

function isOptionLine(line: string): { idx: number; text: string } | null {
  const m = line.match(/^\s*[\(\[]?([a-dA-D1-4])[\)\].:\-]\s+(.+?)\s*$/);
  if (!m) return null;
  const letter = m[1].toLowerCase();
  const order = ['a', 'b', 'c', 'd', '1', '2', '3', '4'];
  return { idx: order.indexOf(letter), text: m[2].trim() };
}

function isQuestionStart(line: string): { num?: number; text: string } | null {
  // "1. ..." or "Q1." or "Q. 1" or "Question 1:" or "1) ..."
  let m = line.match(/^\s*(?:Q\.?\s*|Question\s*)?(\d+)\s*[\.\)\:]\s*(.+?)\s*$/i);
  if (m) return { num: parseInt(m[1], 10), text: m[2].trim() };
  m = line.match(/^\s*(\d+)\s*[\.\)]\s*(.+?)\s*$/);
  if (m) return { num: parseInt(m[1], 10), text: m[2].trim() };
  return null;
}

function looksLikeAnswer(line: string): number | null {
  // "Ans. (a)", "Answer: (b)", "Ans: 3", "Solution: ..."
  const m = line.match(/^\s*(?:Ans(?:wer)?\.?|Solution\.?)\s*[\:\.]?\s*[\(\[]?([a-dA-D1-4])[\)\]]?/i);
  if (!m) return null;
  const letter = m[1].toLowerCase();
  const order = ['a', 'b', 'c', 'd', '1', '2', '3', '4'];
  const idx = order.indexOf(letter);
  return idx >= 0 ? idx : null;
}

export function extractQuestionsFromText(raw: string, maxQuestions = 5): ExtractedQuestion[] {
  if (!raw || raw.length < 50) return [];

  const lines = raw
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const blocks: QuestionBlock[] = [];
  let current: QuestionBlock | null = null;

  for (const line of lines) {
    if (line.length < 3) {
      if (current) current.raw += '\n';
      continue;
    }

    const qStart = isQuestionStart(line);
    if (qStart && (!current || current.options.length >= 2)) {
      if (current && current.raw.trim().length > 0) {
        blocks.push(current);
      }
      current = {
        raw: qStart.text,
        number: qStart.num,
        options: [],
        type: 'mcq',
      };
      continue;
    }

    if (current) {
      // Heuristic: if we already have an answer line, don't keep adding
      if (current.answer !== undefined && current.raw.length > 200) {
        // continue
      }

      const opt = isOptionLine(line);
      if (opt && opt.idx >= 0 && current.options.length <= 4) {
        // Replace if same index, otherwise append
        if (opt.idx < current.options.length) {
          current.options[opt.idx] = opt.text;
        } else {
          current.options.push(opt.text);
        }
        current.raw += '\n' + line;
        continue;
      }

      const ans = looksLikeAnswer(line);
      if (ans !== null) {
        current.answer = ans;
        current.answerText = line.replace(/^\s*(?:Ans(?:wer)?\.?|Solution\.?)\s*[\:\.]?\s*[\(\[]?[a-dA-D1-4][\)\]]?\s*[\.\:]?\s*/i, '').trim();
        current.raw += '\n' + line;
        continue;
      }

      // Continuation of question text
      if (current.options.length === 0 && current.raw.length < 600) {
        current.raw += ' ' + line;
      } else {
        current.raw += '\n' + line;
      }
    }
  }

  if (current && current.raw.trim().length > 0) blocks.push(current);

  // Filter to high-quality blocks
  const questions: ExtractedQuestion[] = [];
  for (const b of blocks) {
    const qText = b.raw
      .split('\n')
      .shift()
      ?.trim() || b.raw.trim();

    if (qText.length < 12) continue;
    if (qText.length > 800) continue;
    if (b.options.length >= 2 && b.options.length <= 4) {
      questions.push({
        question: qText,
        options: b.options.slice(0, 4),
        correctAnswer: typeof b.answer === 'number' && b.answer < b.options.length ? b.answer : 0,
        explanation: b.answerText || '',
        type: 'mcq',
      });
    } else if (b.options.length === 0 && /^\s*\d*[\.\)]?\s*(?:find|compute|calculate|evaluate|prove|show|determine|simplify|solve)/i.test(qText)) {
      // numerical style question
      questions.push({
        question: qText,
        options: [],
        correctAnswer: 0,
        explanation: b.answerText || '',
        type: 'numerical',
      });
    }

    if (questions.length >= maxQuestions) break;
  }

  // De-duplicate similar questions
  const unique: ExtractedQuestion[] = [];
  const seen = new Set<string>();
  for (const q of questions) {
    const key = q.question.toLowerCase().replace(/\s+/g, ' ').slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(q);
  }
  return unique;
}

export function extractedToTestQuestions(
  extracted: ExtractedQuestion[],
  meta: { subject: SubjectId; difficulty: Difficulty; chapterId: string; chapterName: string; topicId: string; source: string },
): TestQuestion[] {
  return extracted.map((q, i) => ({
    id: `ext-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
    question: q.question,
    options: q.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation || 'Extracted from source material.',
    topicId: meta.topicId,
    chapterId: meta.chapterId,
    subject: meta.subject,
    difficulty: meta.difficulty,
    type: q.type,
    source: meta.source,
    mistakePath: `${meta.subject.toUpperCase()} → ${meta.chapterName}`,
  }));
}

export function detectTextbookReference(query: string): {
  class?: '11' | '12' | 'dropper';
  subject?: SubjectId;
  chapterNumber?: number;
  chapterName?: string;
  exerciseNumber?: string;
  book?: string;
  questionCount?: number;
  difficulty?: Difficulty;
  rawQuery: string;
} | null {
  const cleaned = query.toLowerCase().trim();
  const result: ReturnType<typeof detectTextbookReference> = { rawQuery: query };

  const classMatch = cleaned.match(/\b(?:class|grade)\s*(\d+)\b/i) || cleaned.match(/\b(?:xi|xii)\b/i);
  if (classMatch) {
    const raw = classMatch[1] ? classMatch[1] : classMatch[0].toLowerCase();
    if (raw === 'xi') result.class = '11';
    else if (raw === 'xii') result.class = '12';
    else if (raw === '11') result.class = '11';
    else if (raw === '12') result.class = '12';
  }
  if (/\bdropper\b/i.test(cleaned)) result.class = 'dropper';

  if (/\b(?:physics|phy|mechanics|electricity|magnetism|optics|modern\s+physics)\b/i.test(cleaned)) {
    result.subject = 'physics';
  } else if (/\b(?:chem(?:istry)?|organic|inorganic|physical\s+chem|mole|atomic\s+structure)\b/i.test(cleaned)) {
    result.subject = 'chemistry';
  } else if (/\b(?:math(?:s|ematics)?|calculus|algebra|trigonometry|coordinate\s+geometry|linear\s+algebra)\b/i.test(cleaned)) {
    result.subject = 'mathematics';
  }

  const chapterMatch = cleaned.match(/\bchapter\s*(\d+)\b/i);
  if (chapterMatch) {
    result.chapterNumber = parseInt(chapterMatch[1], 10);
    // Extract chapter name: words after "chapter N" up to "exercise" or end of phrase
    const afterChapter = cleaned
      .substring(cleaned.indexOf(chapterMatch[0]) + chapterMatch[0].length)
      .replace(/^[\s,:]+/, '')
      .split(/[\s,]+(?=exercise\s|ex\.|$)/i)[0]
      .trim();
    if (afterChapter && afterChapter.length >= 3 && afterChapter.length < 60) {
      // Capitalize each word for matching
      result.chapterName = afterChapter
        .split(/\s+/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    }
  }

  const exerciseMatch = cleaned.match(/\bexercise\s*(\d+\.?\d*)\b/i)
    || cleaned.match(/\bex\.?\s*(\d+\.?\d*)\b/i);
  if (exerciseMatch) result.exerciseNumber = exerciseMatch[1];

  if (/\bncert\b/i.test(cleaned)) result.book = 'ncert';
  else if (/\bhc\s*verma\b/i.test(cleaned)) result.book = 'hc_verma';
  else if (/\bcengage\b/i.test(cleaned)) result.book = 'cengage';
  else if (/\bdc\s*pandey\b/i.test(cleaned)) result.book = 'dc_pandey';
  else if (/\brd\s*sharma\b/i.test(cleaned)) result.book = 'rd_sharma';
  else if (/\brs\s*aggarwal\b/i.test(cleaned)) result.book = 'rs_aggarwal';
  else if (/\bms\s*chauhan\b/i.test(cleaned)) result.book = 'ms_chauhan';
  else if (/\bop\s*tandon\b/i.test(cleaned)) result.book = 'op_tandon';
  else if (/\brirodov\b/i.test(cleaned)) result.book = 'any';
  else if (/\barihant\b/i.test(cleaned)) result.book = 'arihant';

  const countMatch = cleaned.match(/\b(\d+)\s*(?:question|q|qs|problems?)\b/i);
  if (countMatch) {
    const n = parseInt(countMatch[1], 10);
    if (n > 0 && n <= 50) result.questionCount = n;
  }

  if (/\b(easy|simple|basic)\b/i.test(cleaned)) result.difficulty = 'easy';
  else if (/\b(hard|advanced|jee\s*advanced|tough)\b/i.test(cleaned)) result.difficulty = 'jee_advanced';
  else if (/\b(jee\s*main|medium|moderate)\b/i.test(cleaned)) result.difficulty = 'jee_main';

  if (!result.class && !result.subject && !result.chapterNumber && !result.book) {
    return null;
  }
  return result;
}

export function buildTextbookSearchQuery(ref: NonNullable<ReturnType<typeof detectTextbookReference>>): string {
  const parts: string[] = [];
  if (ref.book && ref.book !== 'any') {
    const bookNames: Record<string, string> = {
      ncert: 'NCERT',
      hc_verma: 'HC Verma',
      cengage: 'Cengage',
      dc_pandey: 'DC Pandey',
      rd_sharma: 'RD Sharma',
      rs_aggarwal: 'RS Aggarwal',
      ms_chauhan: 'MS Chauhan',
      op_tandon: 'OP Tandon',
      arihant: 'Arihant',
    };
    parts.push(bookNames[ref.book] || ref.book);
  }
  if (ref.class) parts.push(`class ${ref.class}`);
  if (ref.subject) {
    const subjectNames: Record<string, string> = {
      physics: 'physics',
      chemistry: 'chemistry',
      mathematics: 'mathematics',
    };
    parts.push(subjectNames[ref.subject] || ref.subject);
  }
  if (ref.chapterNumber) parts.push(`chapter ${ref.chapterNumber}`);
  if (ref.exerciseNumber) parts.push(`exercise ${ref.exerciseNumber}`);
  if (ref.chapterName) parts.push(ref.chapterName);
  parts.push('questions with solutions');
  return parts.join(' ');
}

export async function executeTavilyExtract(
  query: string,
  apiKey: string,
): Promise<{ results: Array<{ raw_content?: string; content?: string; title?: string; url?: string }> }> {
  if (!apiKey) throw new Error('TAVILY_API_KEY not configured');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'advanced',
        max_results: 6,
        include_answer: false,
        include_raw_content: true,
        include_domains: [
          'ncert.nic.in',
          'learncbse.in',
          'examside.com',
          'vedantu.com',
          'byjus.com',
          'toppr.com',
          'askfilo.com',
          'brainly.in',
          'doubtnut.com',
          'jeemain.guru',
          'physicsandmathstutor.com',
          'exammate.in',
          'jeebooks.in',
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) throw new Error(`Tavily extract error: ${res.statusText}`);
    const data = await res.json();
    return data;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}
