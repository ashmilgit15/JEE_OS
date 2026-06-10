'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ClipboardCheck,
  Clock,
  Play,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Trophy,
  RotateCcw,
  Sparkles,
  Brain,
  Paintbrush,
  Eraser,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { questionBank } from '@/data/questions';
import { TestQuestion, TestAttempt, SubjectId, Difficulty, ErrorType } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { format, addDays } from 'date-fns';
import katex from 'katex';

type TestMode = 'setup' | 'taking' | 'results';
type TestType = 'topic' | 'chapter' | 'mixed' | 'daily';

function renderInlineMath(text: string): React.ReactNode {
  if (typeof text !== 'string') return text;
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

const ERROR_TYPES: { value: ErrorType; label: string }[] = [
  { value: 'concept_gap', label: 'Concept Gap' },
  { value: 'formula_forgotten', label: 'Formula Forgotten' },
  { value: 'calculation_mistake', label: 'Calculation Mistake' },
  { value: 'time_pressure', label: 'Time Pressure' },
  { value: 'misread_question', label: 'Misread Question' },
  { value: 'guessing_error', label: 'Guessing Error' },
];

function Scratchpad({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const color = '#a78bfa'; // Primary color (violet-400)
  const lineWidth = 3;
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const lastX = useRef(0);
  const lastY = useRef(0);

  // Initialize canvas size and scale for high-DPI screens
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.strokeStyle = color;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = lineWidth;
  }, [color, lineWidth]);

  // Handle drawing events
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    lastX.current = clientX - rect.left;
    lastY.current = clientY - rect.top;
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      if (e.cancelable) e.preventDefault();
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const currentX = clientX - rect.left;
    const currentY = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(lastX.current, lastY.current);
    ctx.lineTo(currentX, currentY);
    
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = 20;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
    }
    
    ctx.stroke();

    lastX.current = currentX;
    lastY.current = currentY;
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <Card className="fixed bottom-4 right-4 z-40 w-80 h-96 bg-zinc-900/95 border border-border shadow-2xl flex flex-col">
      <CardHeader className="p-3 border-b border-border/50 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
          <Paintbrush className="h-3.5 w-3.5 text-primary" /> Scratchpad
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            size="icon-xs"
            variant={tool === 'pen' ? 'default' : 'ghost'}
            onClick={() => setTool('pen')}
            title="Pen"
          >
            <Paintbrush className="h-3 w-3" />
          </Button>
          <Button
            size="icon-xs"
            variant={tool === 'eraser' ? 'default' : 'ghost'}
            onClick={() => setTool('eraser')}
            title="Eraser"
          >
            <Eraser className="h-3 w-3" />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={clearCanvas}
            title="Clear All"
            className="text-red-400 hover:text-red-300"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={onClose}
            title="Close"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 relative overflow-hidden bg-zinc-950/40">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
        />
      </CardContent>
    </Card>
  );
}

export default function TestsPage() {
  // useSearchParams() requires a Suspense boundary so the page can be prerendered.
  // TestsPageInner reads query params (e.g. ?subjects=physics,mathematics&count=25)
  // when the AI tool navigates here.
  return (
    <Suspense fallback={null}>
      <TestsPageInner />
    </Suspense>
  );
}

function TestsPageInner() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const { state, dispatch, getWeakTopics, getMistakeReplayQuestions } = useStore();
  const [mode, setMode] = useState<TestMode>('setup');

  // Setup state
  const [testType, setTestType] = useState<TestType>('mixed');
  const [difficulty, setDifficulty] = useState<Difficulty>('jee_main');
  const [subject, setSubject] = useState<SubjectId | 'all'>('all');
  const [subjects, setSubjects] = useState<SubjectId[]>([]);
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [chapterIds, setChapterIds] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState(10);
  const [aiAdaptiveMode, setAiAdaptiveMode] = useState(false);
  const [customTitle, setCustomTitle] = useState<string | null>(null);
  const [dynamicQuestions, setDynamicQuestions] = useState<TestQuestion[]>([]);
  const [dynamicSource, setDynamicSource] = useState<string | null>(null);
  const [isGeneratingAIQuestions, setIsGeneratingAIQuestions] = useState(false);

  // Test state
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [timer, setTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [showScratchpad, setShowScratchpad] = useState(false);

  // Results state
  const [errors, setErrors] = useState<{ questionIndex: number; errorType: ErrorType }[]>([]);
  const [reportText, setReportText] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const resumeTest = useCallback(() => {
    if (!state.activeTest) return;
    setQuestions(state.activeTest.questions);
    setAnswers(state.activeTest.answers);
    setErrors([]);
    const pendingIdx = state.activeTest.answers.findIndex(a => a === null);
    setCurrentQ(pendingIdx === -1 ? 0 : pendingIdx);
    setTimer(state.activeTest.elapsedTime);
    setTestType(state.activeTest.type as TestType);
    setDifficulty(state.activeTest.difficulty);
    setTimerActive(true);
    setMode('taking');
  }, [state.activeTest]);

  const discardActiveTest = useCallback(() => {
    dispatch({ type: 'CLEAR_ACTIVE_TEST' });
  }, [dispatch]);

  // Periodic active test sync
  useEffect(() => {
    if (mode !== 'taking') return;
    const interval = setInterval(() => {
      dispatch({
        type: 'UPDATE_ACTIVE_TEST',
        payload: {
          answers,
          elapsedTime: timer
        }
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [answers, timer, mode, dispatch]);



  // Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive) {
      interval = setInterval(() => setTimer(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive]);



  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Read URL query params (e.g. ?subjects=physics,mathematics&difficulty=jee_main&count=25)
  // so the AI tutor's generate_mock_test tool can launch directly into the arena.
  const searchParams = useSearchParams();
  const urlParamsConsumed = useRef(false);
  // Becomes true once the URL-param effect has applied its setState batch.
  // A separate effect (the auto-starter) waits for this AND the next render
  // so startTest sees the URL-driven state, not the initial defaults.
  const [pendingAutoStart, setPendingAutoStart] = useState(false);

  // Generate test
  const startTest = useCallback(() => {
    setReportText('');
    setIsGeneratingReport(false);
    setStartError(null);

    // 1. Dynamic (web-extracted) questions take priority when present.
    // Use up to questionCount dynamic questions, but never exceed the
    // count the user (or AI) requested. Previously this used Math.max,
    // which let the test inflate past questionCount whenever the dynamic
    // cache had more than the requested amount.
    const dynamicCap = Math.min(questionCount, dynamicQuestions.length);
    const dynamicQs = dynamicQuestions.slice(0, dynamicCap);

    let pool = [...questionBank];

    // Filter by subject — multi-subject array takes priority (used by AI tool),
    // falls back to the single-subject UI control.
    if (subjects.length > 0) {
      pool = pool.filter(q => subjects.includes(q.subject));
    } else if (subject !== 'all') {
      pool = pool.filter(q => q.subject === subject);
    }

    // Filter by specific topic IDs (used by AI tool's generate_mock_test)
    if (topicIds.length > 0) {
      pool = pool.filter(q => q.topicId && topicIds.includes(q.topicId));
    }

    // Filter by chapter IDs
    if (chapterIds.length > 0) {
      pool = pool.filter(q => q.chapterId && chapterIds.includes(q.chapterId));
    }

    // Filter by difficulty
    if (difficulty !== 'jee_main') {
      const difficultyPool = pool.filter(q => q.difficulty === difficulty);
      if (difficultyPool.length > 0) pool = difficultyPool;
    }

    // Adaptive weighting - add more questions from weak topics
    const weakTopics = getWeakTopics(5);
    if (weakTopics.length > 0 && testType === 'mixed') {
      const weakTopicIds = weakTopics.map(w => w.topicId);
      const weakQs = pool.filter(q => weakTopicIds.includes(q.topicId));
      // Add weak questions multiple times for higher probability
      pool = [...pool, ...weakQs, ...weakQs];
    }

    // Shuffle
    const shuffled = pool.sort(() => Math.random() - 0.5);

    // AI Adaptive Replay Integration
    let replayTestQs: TestQuestion[] = [];
    if (aiAdaptiveMode) {
      const replayQs = getMistakeReplayQuestions(3);
      replayTestQs = replayQs.map(m => ({
        id: m.questionId,
        question: m.questionText,
        options: m.options,
        correctAnswer: m.correctAnswer,
        explanation: m.explanation,
        topicId: m.topicId,
        chapterId: '',
        subject: m.subject,
        difficulty: 'medium',
        type: 'mcq',
        mistakePath: `${m.subject.toUpperCase()} → ${m.chapterName} → ${m.topicName}`,
      }));
    }

    // Build the final test list: dynamic → replays → local fillers
    const fillersNeeded = Math.max(0, questionCount - dynamicQs.length - replayTestQs.length);
    const selected = shuffled.slice(0, Math.min(fillersNeeded, shuffled.length));

    // Ensure unique questions by id
    const unique = Array.from(new Map([...dynamicQs, ...replayTestQs, ...selected].map(q => [q.id, q])).values());

    // Bug 7 fix: bail out with a friendly warning if the filtered pool is empty
    // (e.g. subject + difficulty combo with no questions) instead of rendering
    // a blank screen with no exit button.
    if (unique.length === 0) {
      const filterNote = topicIds.length > 0 || chapterIds.length > 0
        ? 'Try removing the topic/chapter filter or switching subjects.'
        : 'Try changing the subject or difficulty.';
      setStartError(`No questions match the selected filters. ${filterNote}`);
      return;
    }

    setQuestions(unique);
    setAnswers(new Array(unique.length).fill(null));
    setErrors([]);
    setCurrentQ(0);
    setTimer(0);
    setTimerActive(true);
    setMode('taking');

    dispatch({
      type: 'START_ACTIVE_TEST',
      payload: {
        id: uuidv4(),
        title: customTitle || `${testType.charAt(0).toUpperCase() + testType.slice(1)} Test`,
        type: testType,
        questions: unique,
        answers: new Array(unique.length).fill(null),
        elapsedTime: 0,
        difficulty,
        startedAt: new Date().toISOString()
      }
    });
  }, [subject, subjects, topicIds, chapterIds, difficulty, questionCount, testType, getWeakTopics, aiAdaptiveMode, getMistakeReplayQuestions, dynamicQuestions, customTitle, dispatch]);

  // ── AI Question Generation ─────────────────────────────────────────
  const generateAIQuestions = useCallback(async () => {
    setIsGeneratingAIQuestions(true);
    setStartError(null);
    try {
      const subjectLabel = subject === 'all' ? 'Physics, Chemistry, Mathematics' : subject;
      const difficultyLabel = difficulty.replace('_', ' ').toUpperCase();
      const topicLabels = topicIds.length > 0 ? ` on topics: ${topicIds.join(', ')}` : '';
      const chapterLabel = chapterIds.length > 0 ? ` from chapters: ${chapterIds.join(', ')}` : '';

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Generate exactly ${questionCount} unique JEE-level MCQ questions for ${subjectLabel} at ${difficultyLabel} level${topicLabels}${chapterLabel}. 

Return ONLY a JSON array (no markdown, no code blocks) where each object has:
{
  "id": "ai-q-1",
  "question": "question text",
  "options": ["option A", "option B", "option C", "option D"],
  "correctAnswer": 0,
  "explanation": "step-by-step solution",
  "topicId": "${topicIds[0] || 'math-alg-inequalities'}",
  "chapterId": "${chapterIds[0] || 'math-algebra'}",
  "subject": "${subject === 'all' ? 'mathematics' : subject}",
  "difficulty": "${difficulty}",
  "type": "mcq",
  "source": "AI Generated"
}

Make questions that test conceptual understanding, not just formula recall. Include a mix of easy and medium difficulty. Ensure all 4 options are plausible but only one is correct.`
          }],
          systemPrompt: 'You are a JEE question paper generator. Output ONLY valid JSON arrays. No explanations, no markdown, no code fences — just raw JSON.',
        }),
      });

      if (!response.ok || !response.body) throw new Error('API request failed');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === 'text') fullText += event.content;
          } catch {}
        }
      }

      // Extract JSON array from the response
      const jsonMatch = fullText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No valid JSON found in response');
      const parsed = JSON.parse(jsonMatch[0]) as TestQuestion[];
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('No questions generated');

      setDynamicQuestions(parsed);
      setDynamicSource('AI Generated');
    } catch (err) {
      console.error('AI question generation error:', err);
      setStartError('Failed to generate questions with AI. Try using the question bank instead.');
    } finally {
      setIsGeneratingAIQuestions(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, subjects, topicIds, chapterIds, difficulty, questionCount]);

  // Read URL query params and auto-start the test when configured by the AI tool
  useEffect(() => {
    if (urlParamsConsumed.current) return;

    const subjectsParam = searchParams.get('subjects');
    const subjectParam = searchParams.get('subject');
    const difficultyParam = searchParams.get('difficulty');
    const countParam = searchParams.get('count');
    const typeParam = searchParams.get('type');
    const topicsParam = searchParams.get('topics');
    const chaptersParam = searchParams.get('chapters');
    const adaptiveParam = searchParams.get('adaptive');
    const titleParam = searchParams.get('title');
    const dqKeyParam = searchParams.get('dqKey');

    let didApply = false;
    const validDifficulties: Difficulty[] = ['easy', 'medium', 'jee_main', 'jee_advanced'];
    const validTestTypes: TestType[] = ['topic', 'chapter', 'mixed', 'daily'];

    if (subjectsParam) {
      const arr = subjectsParam.split(',').map(s => s.trim()).filter(Boolean) as SubjectId[];
      const filtered = arr.filter(s => s === 'physics' || s === 'chemistry' || s === 'mathematics');
      if (filtered.length > 0) {
        setSubjects(filtered);
        setSubject(filtered.length === 1 ? filtered[0] : 'all');
        didApply = true;
      }
    } else if (subjectParam) {
      if (subjectParam === 'all') {
        setSubjects([]);
        setSubject('all');
      } else if (subjectParam === 'physics' || subjectParam === 'chemistry' || subjectParam === 'mathematics') {
        setSubjects([subjectParam]);
        setSubject(subjectParam);
      }
      didApply = true;
    }

    if (difficultyParam && validDifficulties.includes(difficultyParam as Difficulty)) {
      setDifficulty(difficultyParam as Difficulty);
      didApply = true;
    }

    if (countParam) {
      const n = parseInt(countParam, 10);
      if (!isNaN(n) && n > 0 && n <= 200) {
        setQuestionCount(n);
        didApply = true;
      }
    }

    if (typeParam) {
      const mapped: Record<string, TestType> = {
        topic: 'topic',
        chapter: 'chapter',
        mixed: 'mixed',
        daily: 'daily',
        mock_main: 'mixed',
        mock_advanced: 'mixed',
      };
      const t = mapped[typeParam];
      if (t && validTestTypes.includes(t)) {
        setTestType(t);
        didApply = true;
      }
    }

    if (topicsParam) {
      const arr = topicsParam.split(',').map(s => s.trim()).filter(Boolean);
      if (arr.length > 0) {
        setTopicIds(arr);
        if (validTestTypes.includes('topic') && testType === 'mixed') {
          setTestType('topic');
        }
        didApply = true;
      }
    }

    if (chaptersParam) {
      const arr = chaptersParam.split(',').map(s => s.trim()).filter(Boolean);
      if (arr.length > 0) {
        setChapterIds(arr);
        if (validTestTypes.includes('chapter') && testType === 'mixed') {
          setTestType('chapter');
        }
        didApply = true;
      }
    }

    if (adaptiveParam === '1' || adaptiveParam === 'true') {
      setAiAdaptiveMode(true);
      didApply = true;
    }

    if (titleParam) {
      setCustomTitle(titleParam.slice(0, 80));
      didApply = true;
    }

    if (dqKeyParam) {
      try {
        const raw = sessionStorage.getItem(dqKeyParam);
        if (raw) {
          const parsed = JSON.parse(raw) as { questions: TestQuestion[]; source?: string; title?: string };
          if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
            setDynamicQuestions(parsed.questions);
            if (parsed.source) setDynamicSource(parsed.source);
            if (parsed.title && !titleParam) setCustomTitle(parsed.title.slice(0, 80));
            sessionStorage.removeItem(dqKeyParam);
            didApply = true;
          }
        }
      } catch (e) {
        console.warn('Failed to load dynamic questions from sessionStorage:', e);
      }
    }

    if (didApply) {
      urlParamsConsumed.current = true;
      // Defer the auto-start signal to the NEXT render. The setState calls
      // above are batched; by the time setPendingAutoStart is processed
      // and the auto-start effect runs, the new state values (subjects,
      // questionCount, dynamicQuestions, etc.) will have been flushed.
      // This avoids the timing bug where startTest used to fire in the
      // same commit as the URL-param effect and saw stale defaults.
      setPendingAutoStart(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Auto-start: runs once when the URL effect has set pendingAutoStart.
  // Depending on pendingAutoStart (not the state setters) means this
  // effect runs in the render AFTER the URL-driven state has flushed,
  // so startTest sees subjects=mathematics, count=5, etc. — not the
  // default 10-question mixed-everything test.
  useEffect(() => {
    if (!pendingAutoStart) return;
    setPendingAutoStart(false);
    startTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAutoStart]);

  // Select answer
  const selectAnswer = useCallback((optionIndex: number | null) => {
    setAnswers(prev => {
      const newAnswers = [...prev];
      newAnswers[currentQ] = optionIndex;
      return newAnswers;
    });
  }, [currentQ]);

  // Submit test
  const submitTest = useCallback(() => {
    setTimerActive(false);
    setMode('results');
  }, []);

  // Keyboard navigation and shortcuts inside test-taking mode
  useEffect(() => {
    if (mode !== 'taking') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      const key = e.key.toLowerCase();

      if (key === 'n' || e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentQ(prev => Math.min(questions.length - 1, prev + 1));
      } else if (key === 'p' || e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentQ(prev => Math.max(0, prev - 1));
      } else if (key === '1' || key === 'a') {
        e.preventDefault();
        selectAnswer(0);
      } else if (key === '2' || key === 'b') {
        e.preventDefault();
        selectAnswer(1);
      } else if (key === '3' || key === 'c') {
        e.preventDefault();
        selectAnswer(2);
      } else if (key === '4' || key === 'd') {
        e.preventDefault();
        selectAnswer(3);
      } else if (key === 'escape' || key === 'backspace' || key === 'x') {
        e.preventDefault();
        setAnswers(prev => {
          const newAnswers = [...prev];
          newAnswers[currentQ] = null;
          return newAnswers;
        });
      } else if (key === 's') {
        // Confirm before submit
        e.preventDefault();
        if (confirm('Are you sure you want to submit the test?')) {
          submitTest();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, questions.length, currentQ, selectAnswer, submitTest]);

  // Classify error
  const classifyError = (questionIndex: number, errorType: ErrorType) => {
    setErrors(prev => {
      const filtered = prev.filter(e => e.questionIndex !== questionIndex);
      return [...filtered, { questionIndex, errorType }];
    });
  };

  // Save results
  const saveResults = () => {
    const score = questions.reduce((s, q, i) => s + (answers[i] === q.correctAnswer ? 4 : answers[i] !== null ? -1 : 0), 0);
    const maxScore = questions.length * 4;

    // Subject breakdown
    const subjectMap: Record<string, { correct: number; total: number; timeSpent: number }> = {};
    questions.forEach((q, i) => {
      if (!subjectMap[q.subject]) subjectMap[q.subject] = { correct: 0, total: 0, timeSpent: 0 };
      subjectMap[q.subject].total++;
      if (answers[i] === q.correctAnswer) subjectMap[q.subject].correct++;
      subjectMap[q.subject].timeSpent += timer / questions.length;
    });

    const attempt: TestAttempt = {
      id: uuidv4(),
      date: new Date().toISOString(),
      type: testType,
      title: customTitle || `${testType.charAt(0).toUpperCase() + testType.slice(1)} Test - ${format(new Date(), 'MMM dd')}`,
      questions,
      answers,
      timeSpent: timer,
      score: Math.max(score, 0),
      maxScore,
      errors,
      subjectBreakdown: Object.entries(subjectMap).map(([s, data]) => ({
        subject: s as SubjectId,
        ...data,
      })),
    };

    dispatch({ type: 'ADD_TEST_ATTEMPT', payload: attempt });
    dispatch({ type: 'CLEAR_ACTIVE_TEST' });

    // Auto-dispatch ADD_MISTAKE for each wrong answer so the Replay Board gets populated
    for (let i = 0; i < questions.length; i++) {
      if (answers[i] !== null && answers[i] !== questions[i].correctAnswer) {
        const q = questions[i];
        const syllabusTopic = (() => {
          for (const sub of state.syllabus) {
            for (const ch of sub.chapters) {
              const t = ch.topics.find(x => x.id === q.topicId);
              if (t) return { topicName: t.name, chapterName: ch.name, subject: sub.id as SubjectId };
            }
          }
          return null;
        })();
        const topicName = syllabusTopic?.topicName || q.topicId;
        const chapterName = syllabusTopic?.chapterName || q.chapterId;
        const subject = syllabusTopic?.subject || q.subject;
        dispatch({
          type: 'ADD_MISTAKE',
          payload: {
            id: uuidv4(),
            questionId: q.id,
            questionText: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            userAnswer: answers[i]!,
            explanation: q.explanation,
            topicId: q.topicId,
            topicName,
            chapterName,
            subject,
            timestamp: new Date().toISOString(),
            status: 'pending',
            nextReplayDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
          },
        });
      }
    }

    setMode('setup');
  };

  // Calculate score
  const score = useMemo(() => {
    if (mode !== 'results') return { correct: 0, wrong: 0, unanswered: 0, marks: 0, total: 0 };
    let correct = 0, wrong = 0, unanswered = 0;
    questions.forEach((q, i) => {
      if (answers[i] === null) unanswered++;
      else if (answers[i] === q.correctAnswer) correct++;
      else wrong++;
    });
    return {
      correct,
      wrong,
      unanswered,
      marks: correct * 4 - wrong * 1,
      total: questions.length * 4,
    };
  }, [mode, questions, answers]);

  const generateStrategyReport = async () => {
    setIsGeneratingReport(true);
    setReportText('');

    try {
      const correctCount = score.correct;
      const wrongCount = score.wrong;
      const skippedCount = score.unanswered;
      const totalMarks = score.marks;
      const maxPossibleMarks = score.total;
      // Bug 7 fix: guard against division-by-zero when maxPossibleMarks is 0
      // (test with no questions). Falls back to 0% accuracy.
      const percent = maxPossibleMarks > 0
        ? Math.round((Math.max(totalMarks, 0) / maxPossibleMarks) * 100)
        : 0;
      const timeSpent = formatTime(timer);

      const errorSummaries = errors.map(e => {
        const typeLabel = ERROR_TYPES.find(et => et.value === e.errorType)?.label || e.errorType;
        const qText = questions[e.questionIndex]?.question.substring(0, 50) + '...';
        return `Question ${e.questionIndex + 1} (${questions[e.questionIndex]?.subject}): Tagged as [${typeLabel}] for "${qText}"`;
      }).join('\n');

      const systemPrompt = `You are the ultimate JEE Advanced & Main Test Strategist and AI Coach. 
Your task is to analyze the student's test performance and provide a sharp, highly tactical, actionable, and motivating diagnostic report.
Break down their attempt pattern and outline what concrete adjustment they must make for their next mock exam.
Format using LaTeX for math symbols if any, and use clean markdown formatting with bullets.`;

      const userMessage = `Please provide a strategic mock diagnostic analysis based on these test stats:
- Score obtained: ${totalMarks} / ${maxPossibleMarks} marks
- Correct answers: ${correctCount}
- Incorrect answers (Negative marking penalty): ${wrongCount}
- Unanswered (skipped): ${skippedCount}
- Test Duration: ${timeSpent}
- Overall attempt accuracy: ${percent}%

Detailed list of mistakes and their tagged cognitive error categories:
${errorSummaries || 'No mistakes tagged yet. All correct or skipped.'}

Provide:
1. **Attempt Efficiency Verdict**: A 1-2 sentence diagnostic on their speed and accuracy ratio.
2. **Mistake Pattern Analysis**: Explain why they made their tagged errors (e.g. calculation vs formula forgotten) and what this tells us about their prep.
3. **Actionable Recovery Plan**: Exactly 2 concrete advice points for their next mock test.`;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: userMessage }],
          systemPrompt,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('API returned an empty body or error status');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedReport = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === 'text') {
              accumulatedReport += event.content;
              setReportText(accumulatedReport);
            }
          } catch {
            // Ignore malformed lines
          }
        }
      }
    } catch (err) {
      console.error('Failed to generate AI Strategy Report:', err);
      setReportText('Could not connect to the AI Strategy server. Please review your tagged mistakes above: focus on practicing these weak concepts and re-solving them in the Replay Board!');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-xs text-muted-foreground">Loading testing arena...</p>
        </div>
      </div>
    );
  }

  // ======== SETUP MODE ========
  if (mode === 'setup') {
    return (
      <div className="p-6 space-y-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
            <ClipboardCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Test Engine</h1>
            <p className="text-xs text-muted-foreground">Practice with adaptive JEE-level questions</p>
          </div>
        </div>

        {state.activeTest && (
          <Card className="border-amber-500/30 bg-amber-500/5 animate-in fade-in-0 slide-in-from-top-2 duration-300">
            <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <p className="text-sm font-semibold flex items-center gap-1.5 justify-center sm:justify-start text-amber-400">
                  <AlertTriangle className="size-4" /> Ongoing Test Detected
                </p>
                <p className="text-xs text-muted-foreground">
                  You have an active session for <strong>{state.activeTest.title}</strong> ({state.activeTest.questions.length} questions, {formatTime(state.activeTest.elapsedTime)} elapsed).
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="ghost" size="sm" onClick={discardActiveTest} className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10">
                  Discard
                </Button>
                <Button size="sm" onClick={resumeTest} className="text-xs bg-amber-500 hover:bg-amber-600 text-black font-semibold gap-1.5">
                  <Play className="size-3.5 fill-current" /> Resume Test
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Configure Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Test Type</Label>
                <Select value={testType} onValueChange={(v) => v && setTestType(v as TestType)}>
                  <SelectTrigger className="bg-muted/30 border-border/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="topic">Topic Test</SelectItem>
                    <SelectItem value="chapter">Chapter Test</SelectItem>
                    <SelectItem value="mixed">Mixed Test</SelectItem>
                    <SelectItem value="daily">Daily Quiz</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Difficulty</Label>
                <Select value={difficulty} onValueChange={(v) => v && setDifficulty(v as Difficulty)}>
                  <SelectTrigger className="bg-muted/30 border-border/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="jee_main">JEE Main</SelectItem>
                    <SelectItem value="jee_advanced">JEE Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Subject</Label>
                <Select
                  value={subject}
                  onValueChange={(v) => {
                    if (!v) return;
                    setSubject(v as SubjectId | 'all');
                    setSubjects(v === 'all' ? [] : [v as SubjectId]);
                  }}
                >
                  <SelectTrigger className="bg-muted/30 border-border/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    <SelectItem value="physics">Physics</SelectItem>
                    <SelectItem value="chemistry">Chemistry</SelectItem>
                    <SelectItem value="mathematics">Mathematics</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Questions</Label>
                <Select value={String(questionCount)} onValueChange={v => v && setQuestionCount(Number(v))}>
                  <SelectTrigger className="bg-muted/30 border-border/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 Questions</SelectItem>
                    <SelectItem value="10">10 Questions</SelectItem>
                    <SelectItem value="15">15 Questions</SelectItem>
                    <SelectItem value="20">20 Questions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold text-purple-400">AI Adaptive Prep Mode</Label>
                <p className="text-[10px] text-muted-foreground">Injects pending mistake-replay questions and weights low-accuracy topics.</p>
              </div>
              <Switch 
                checked={aiAdaptiveMode} 
                onCheckedChange={setAiAdaptiveMode} 
                className="cursor-pointer"
              />
            </div>

            <Button onClick={startTest} className="w-full gap-2">
              <Play className="h-4 w-4" />
              Start Test
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
              onClick={generateAIQuestions}
              disabled={isGeneratingAIQuestions}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {isGeneratingAIQuestions ? 'Generating...' : '✨ Generate Questions with AI'}
            </Button>

            {dynamicQuestions.length > 0 && (
              <div className="text-xs text-emerald-400 text-center space-y-0.5">
                <p>📥 {dynamicQuestions.length} AI-generated question(s) will lead the test</p>
                {dynamicSource && <p className="text-muted-foreground">Source: {dynamicSource}</p>}
              </div>
            )}

            {startError && (
              <p className="text-xs text-red-400 text-center" role="alert">{startError}</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Attempts */}
        {state.testAttempts.length > 0 && (
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Recent Tests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {state.testAttempts.slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-center justify-between rounded-md bg-muted/20 px-3 py-2">
                    <div>
                      <p className="text-xs font-medium">{t.title}</p>
                      <p className="text-[10px] text-muted-foreground">{format(new Date(t.date), 'MMM dd, yyyy • hh:mm a')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono">{t.score}/{t.maxScore}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {Math.round((t.score / Math.max(t.maxScore, 1)) * 100)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ======== TEST TAKING MODE ========
  if (mode === 'taking') {
    const q = questions[currentQ];
    // Bug 7 fix: render a recovery screen (with Back to Setup button) if the
    // questions array is empty or current index points past the end. Previously
    // this branch returned `null`, producing a blank screen with no exit.
    if (!q) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
          <p className="text-sm text-muted-foreground">No question available for this test.</p>
          <Button variant="outline" onClick={() => setMode('setup')}>Back to Setup</Button>
        </div>
      );
    }
    const answered = answers.filter(a => a !== null).length;

    return (
      <div className="flex h-[calc(100dvh-3.5rem)] md:h-screen flex-col">
        {/* Test Header */}
        <div className="border-b border-border/50 px-4 py-3 flex flex-wrap gap-2 items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="outline">Q {currentQ + 1}/{questions.length}</Badge>
            <Progress value={(answered / questions.length) * 100} className="hidden xs:block w-24 sm:w-32 h-2" />
            {(customTitle || dynamicSource) && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                {customTitle && <span className="font-medium">{customTitle}</span>}
                {dynamicSource && <span className="opacity-70">· {dynamicSource}</span>}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowScratchpad(prev => !prev)}
              className={showScratchpad ? 'bg-primary/10 border-primary text-primary gap-1.5' : 'gap-1.5'}
            >
              <Paintbrush className="h-3.5 w-3.5" /> Scratchpad
            </Button>
            <div className="flex items-center gap-1.5 text-sm font-mono">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {formatTime(timer)}
            </div>
            <Button variant="destructive" size="sm" onClick={submitTest}>Submit</Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Question Area */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center gap-2 mb-4">
                <Badge className="capitalize" variant="outline">{q.subject}</Badge>
                <Badge variant="outline" className="capitalize">{q.difficulty.replace('_', ' ')}</Badge>
              </div>

              <h2 className="text-base font-medium mb-6 leading-relaxed">{renderInlineMath(q.question)}</h2>

              <div className="space-y-3">
                {q.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => selectAnswer(i)}
                    className={`w-full text-left rounded-lg border px-4 py-3 text-sm transition-all ${
                      answers[currentQ] === i
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border/50 bg-card hover:border-border hover:bg-muted/30'
                    }`}
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current mr-3 text-xs">
                      {String.fromCharCode(65 + i)}
                    </span>
                    {renderInlineMath(opt)}
                  </button>
                ))}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
                  disabled={currentQ === 0}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentQ(Math.min(questions.length - 1, currentQ + 1))}
                  disabled={currentQ === questions.length - 1}
                  className="gap-1"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Question Palette */}
          <div className="hidden md:block w-48 border-l border-border/50 p-4">
            <h3 className="text-xs font-medium text-muted-foreground mb-3">Questions</h3>
            <div className="grid grid-cols-5 gap-1.5">
              {questions.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentQ(i)}
                  className={`h-8 w-8 rounded text-xs font-medium transition-colors ${
                    i === currentQ
                      ? 'bg-primary text-primary-foreground'
                      : answers[i] !== null
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-1.5 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-sm bg-green-500/20 border border-green-500/30" />
                <span>Answered ({answered})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-sm bg-muted/30" />
                <span>Unanswered ({questions.length - answered})</span>
              </div>
            </div>
          </div>
        </div>
        {showScratchpad && <Scratchpad onClose={() => setShowScratchpad(false)} />}
      </div>
    );
  }

  // ======== RESULTS MODE ========
  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Score Card */}
      <Card className="bg-card border-border/50">
        <CardContent className="p-6 text-center">
          <Trophy className="h-10 w-10 mx-auto mb-3 text-amber-400" />
          <h2 className="text-2xl font-bold">{score.marks}/{score.total}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {score.total > 0
              ? Math.round((Math.max(score.marks, 0) / score.total) * 100)
              : 0}% accuracy • {formatTime(timer)}
          </p>
          <div className="flex justify-center gap-4 mt-4">
            <div className="text-center">
              <p className="text-lg font-bold text-green-400">{score.correct}</p>
              <p className="text-[10px] text-muted-foreground">Correct (+4)</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-red-400">{score.wrong}</p>
              <p className="text-[10px] text-muted-foreground">Wrong (-1)</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-muted-foreground">{score.unanswered}</p>
              <p className="text-[10px] text-muted-foreground">Skipped (0)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Test Strategist Diagnostic */}
      <Card className="bg-card border-border/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-3 opacity-15">
          <Sparkles className="size-16 text-primary animate-pulse" />
        </div>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-[18px] w-[18px] text-primary animate-pulse" />
            <CardTitle className="text-sm font-semibold">AI Test Strategist Diagnostic</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Generate a personalized strategic review of this test attempt to improve your next score
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!reportText && !isGeneratingReport ? (
            <div className="flex flex-col items-center justify-center p-6 text-center border border-dashed border-border/40 rounded-lg bg-muted/10">
              <Sparkles className="h-8 w-8 text-primary/40 mb-2" />
              <p className="text-xs text-muted-foreground">Ready to analyze your attempt strategy, accuracy speed ratio, and cognitive error profiles.</p>
              <Button size="sm" onClick={generateStrategyReport} className="mt-3 gap-1.5 cursor-pointer">
                <Brain className="h-3.5 w-3.5" /> Generate AI Strategy Report
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg bg-zinc-950/70 border border-border/60 p-4 min-h-[120px] text-xs leading-relaxed font-sans text-zinc-300 whitespace-pre-line">
                {renderInlineMath(reportText)}
                {isGeneratingReport && (
                  <span className="inline-block w-1.5 h-3.5 ml-1 bg-primary animate-pulse align-middle" />
                )}
              </div>
              {isGeneratingReport && (
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping"></span>
                  Streaming strategist recommendations...
                </div>
              )}
              {!isGeneratingReport && (
                <div className="flex justify-end">
                  <Button size="xs" variant="outline" onClick={generateStrategyReport} className="gap-1 cursor-pointer">
                    <RotateCcw className="h-3 w-3" /> Regenerate Report
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Question Review */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Question Review</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {questions.map((q, i) => {
            const isCorrect = answers[i] === q.correctAnswer;
            const isUnanswered = answers[i] === null;
            return (
              <div key={q.id} className={`rounded-lg border p-4 ${isCorrect ? 'border-green-500/30 bg-green-500/5' : isUnanswered ? 'border-border/50' : 'border-red-500/30 bg-red-500/5'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">Q{i + 1}</span>
                    {isCorrect ? (
                      <Check className="h-4 w-4 text-green-400" />
                    ) : isUnanswered ? (
                      <span className="text-xs text-muted-foreground">Skipped</span>
                    ) : (
                      <X className="h-4 w-4 text-red-400" />
                    )}
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize">{q.subject}</Badge>
                </div>
                <p className="text-sm mb-2">{renderInlineMath(q.question)}</p>
                <div className="space-y-1 mb-2">
                  {q.options.map((opt, oi) => (
                    <div key={oi} className={`text-xs px-2 py-1 rounded ${
                      oi === q.correctAnswer ? 'text-green-400 bg-green-500/10' :
                      oi === answers[i] && oi !== q.correctAnswer ? 'text-red-400 bg-red-500/10' :
                      'text-muted-foreground'
                    }`}>
                      {String.fromCharCode(65 + oi)}. {renderInlineMath(opt)}
                      {oi === q.correctAnswer && ' ✓'}
                      {oi === answers[i] && oi !== q.correctAnswer && ' (your answer)'}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground italic mb-2">{renderInlineMath(q.explanation)}</p>

                {/* Error Classification */}
                {!isCorrect && !isUnanswered && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/30">
                    <span className="text-[10px] text-muted-foreground">Error type:</span>
                    <Select
                      value={errors.find(e => e.questionIndex === i)?.errorType || ''}
                      onValueChange={(v) => v && classifyError(i, v as ErrorType)}
                    >
                      <SelectTrigger className="h-7 text-[10px] w-40">
                        <SelectValue placeholder="Classify..." />
                      </SelectTrigger>
                      <SelectContent>
                        {ERROR_TYPES.map(et => (
                          <SelectItem key={et.value} value={et.value} className="text-xs">{et.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={saveResults} className="flex-1 gap-2">
          <Check className="h-4 w-4" /> Save Results
        </Button>
        <Button variant="outline" onClick={() => setMode('setup')} className="gap-2">
          <RotateCcw className="h-4 w-4" /> New Test
        </Button>
      </div>
    </div>
  );
}
