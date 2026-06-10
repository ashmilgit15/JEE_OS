'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useStore } from '@/store';
import { usePathname, useRouter } from 'next/navigation';
import { getDeviceId, getContextSummaryFromState, formatContextSummary } from '@/utils/supabase/conversations';
import katex from 'katex';
import DOMPurify from 'isomorphic-dompurify';
import { getDOMSummary } from '@/utils/domSummarizer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { extractGraphReferences, FunctionGraph } from '@/app/tutor/page';
import {
  Bot,
  Send,
  X,
  Brain,
  User,
  Image as ImageIcon,
  Upload,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  statusLogs?: string[];
}

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
      const cleanMath = DOMPurify.sanitize(mathContent);
      const html = katex.renderToString(cleanMath, { displayMode, throwOnError: false });
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

// Helper to parse stream line robustly, handling multiple or malformed JSON blocks
function parseStreamEvents(line: string): any[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  try {
    return [JSON.parse(trimmed)];
  } catch {
    // Attempt to extract multiple JSON objects using brace counting
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
              // Ignore
            }
            startIdx = -1;
          }
        }
      }

      if (objects.length > 0) {
        return objects;
      }
            } catch {
      // Ignore fallback failure
    }
    return [];
  }
}

import { handleStoreAction } from '@/utils/handleStoreAction';
import { MemoryStore } from '@/utils/ai/memory';

export default function FloatingAICopilot() {
  const [isOpen, setIsOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [initialized, setInitialized] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'copilot-1',
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentLogs, setCurrentLogs] = useState<string[]>([]);

  const [isDragging, setIsDragging] = useState(false);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Draggable FAB State ────────────────────────────────────────────────────
  const [fabPos, setFabPos] = useState<{ x: number; y: number } | null>(null);
  const fabRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const didDrag = useRef(false);

  const processMockOCR = (file: File) => {
    setIsOcrProcessing(true);
    const steps = [
      `Uploading ${file.name}...`,
      "Analyzing layout & structure...",
      "Detecting LaTeX equations...",
      "OCR complete! Equation extracted."
    ];
    let stepIdx = 0;
    setCurrentLogs([steps[0]]);
    
    const interval = setInterval(() => {
      stepIdx++;
      if (stepIdx < steps.length) {
        setCurrentLogs([steps[stepIdx]]);
      } else {
        clearInterval(interval);
        setIsOcrProcessing(false);
        setCurrentLogs([]);
        const mockEquations = [
          "\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}",
          "\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1",
          "\\vec{F} = \\frac{d\\vec{p}}{dt} = m\\vec{a}",
          "H\\psi = E\\psi",
          "PV = nRT"
        ];
        const randomEquation = mockEquations[Math.floor(Math.random() * mockEquations.length)];
        const promptText = `[OCR Extracted: $${randomEquation}$] Can you explain the concept behind this equation and show its step-by-step derivation or application for JEE?`;
        setChatInput(promptText);
      }
    }, 600);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processMockOCR(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processMockOCR(files[0]);
    }
  };

  const router = useRouter();
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const {
    state,
    dispatch,
    getReadinessScore,
    getOverallReadiness,
    getTodayStudyHours,
    getPendingRevisions,
    getOverdueRevisions,
    getWeakTopics,
    getBurnoutTelemetry,
    getTopicById,
    completeTopicWithRevisions,
    logStudy,
    generateDailyPlan,
  } = useStore();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, currentLogs]);

  // Derived user context
  const statsContext = useMemo(() => {
    const readiness = {
      physics: getReadinessScore('physics'),
      chemistry: getReadinessScore('chemistry'),
      mathematics: getReadinessScore('mathematics'),
    };
    const overall = getOverallReadiness();
    const studyHoursToday = getTodayStudyHours();
    const weakTopics = getWeakTopics(3).map(w => `${w.topicName} (${w.accuracy}% accuracy)`).join(', ');
    const pending = getPendingRevisions().length;
    const overdue = getOverdueRevisions().length;
    const streak = state.streaks.currentStudy;
    const burnout = getBurnoutTelemetry();

    return {
      readiness,
      overall,
      studyHoursToday,
      weakTopics,
      pending,
      overdue,
      streak,
      burnout,
    };
  }, [state, getReadinessScore, getOverallReadiness, getTodayStudyHours, getPendingRevisions, getOverdueRevisions, getWeakTopics, getBurnoutTelemetry]);

  const getPageContextLabel = useCallback(() => {
    if (pathname === '/') return 'Dashboard';
    if (pathname === '/syllabus') return 'Syllabus';
    if (pathname === '/log') return 'Study Log';
    if (pathname === '/revisions') return 'Revision Engine';
    if (pathname === '/tests') return 'Test Arena';
    if (pathname === '/coach') return 'AI Coach';
    if (pathname === '/resources') return 'Study Vault';
    return 'JEE OS';
  }, [pathname]);

  // ── Proactive welcome message builder ─────────────────────────────
  const buildWelcomeMessage = useCallback(() => {
    const pageName = getPageContextLabel();
    const parts: string[] = [`Hi! I'm your AI Co-Pilot. ⚡ I can see you're on the **${pageName}** page.\n`];
    const overdueRevisions = getOverdueRevisions().length;
    const weakTopics = getWeakTopics(3);

    if (overdueRevisions > 0) {
      parts.push(`⏰ **${overdueRevisions}** revision${overdueRevisions > 1 ? 's are' : ' is'} overdue! Type \`/study-plan\` to reschedule.`);
    }
    if (weakTopics.length > 0) {
      parts.push(`🎯 **${weakTopics[0].topicName}** needs attention (${weakTopics[0].accuracy}% accuracy). Let's fix it!`);
    }
    if (getTodayStudyHours() === 0) {
      parts.push('📚 You haven\'t studied today yet. Start a session from the Study Log!');
    }

    const pageTips: Record<string, string> = {
      'Dashboard': 'Try \`/burnout\` to check your study health, or \`/formulas kinematics\` for equation sheets.',
      'Syllabus': 'Mark topics as complete to auto-schedule revisions. Need help prioritizing? Just ask!',
      'Study Log': 'Logging consistent hours builds your streak. I can help you plan your study blocks.',
      'Revision Engine': `Clear those ${overdueRevisions} overdue items first — they have the highest forgetting risk.`,
      'Test Arena': 'Review your mistakes after each test. Use \`/study-plan\` to target weak areas.',
      'AI Coach': 'I can help you interpret your coach insights and build an action plan.',
      'Study Vault': 'Upload your own PDFs and worksheets. I can help organize them by topic.',
      'Analytics': 'Your performance trends tell a story. Want me to analyze your recent trajectory?',
      'Planner': 'Let me help you build an optimal daily schedule based on your priorities.',
      'Mock Tests': 'Full-length mocks simulate real exam pressure. Review mistakes thoroughly afterward.',
      'Advanced AI': 'Explore forgetting curves, burnout telemetry, and rank predictions here.',
      'Profile': 'Keep your target year and study preferences updated for personalized advice.',
      'Settings': 'Export your data or reset progress here.',
    };
    if (pageTips[pageName]) {
      parts.push(`💡 ${pageTips[pageName]}`);
    }
    parts.push('\nTry shortcuts: \`/burnout\` · \`/study-plan\` · \`/formulas <topic>\`');
    return parts.join('\n\n');
  }, [getOverdueRevisions, getWeakTopics, getTodayStudyHours, getPageContextLabel]);

  const prevPathname = useRef(pathname);
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      setMessages([{ id: 'copilot-1', role: 'assistant', content: buildWelcomeMessage(), timestamp: new Date() }]);
      setInitialized(true);
    }
  }, [pathname, initialized, buildWelcomeMessage]);

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText || chatInput).trim();
    if (!text) return;

    if (!overrideText) {
      setChatInput('');
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    setCurrentLogs(['Initializing AI Co-Pilot...']);

    try {
      let queryContent = text;
      // Expand shortcuts if matching
      if (text.startsWith('/burnout')) {
        queryContent = `[Trigger Shortcut: /burnout] Analyze my current study patterns and tell me if I am at risk of burnout. Here are my metrics: Sleep Average is ${statsContext.burnout.sleepAverage}h, Study Hours Today is ${statsContext.studyHoursToday}h, current streak is ${statsContext.streak} days, and burnout score is ${statsContext.burnout.score}%.`;
      } else if (text.startsWith('/study-plan')) {
        queryContent = `[Trigger Shortcut: /study-plan] Outline today's highest yield study focus topics. Here are my weak areas: ${statsContext.weakTopics}. Revisions overdue: ${statsContext.overdue}. Revisions pending: ${statsContext.pending}.`;
      } else if (text.startsWith('/formulas')) {
        const topic = text.replace('/formulas', '').trim();
        queryContent = `[Trigger Shortcut: /formulas] Synthesize a rigorous and detailed JEE Main & Advanced formula summary sheet for the topic: ${topic || 'Kinematics'}. Format all equations using LaTeX notation ($...$).`;
      }

      const systemPrompt = `You are the site-wide JEE OS AI Co-Pilot. You are a brilliant IIT-JEE mentor.
Current User Context:
- Active Route: ${pathname}
- Student Name: ${state.profile.name || 'Student'}
- Class: ${state.profile.class}
- Overall Readiness Score: ${statsContext.overall}%
- Subject Readiness: Physics (${statsContext.readiness.physics}%), Chemistry (${statsContext.readiness.chemistry}%), Mathematics (${statsContext.readiness.mathematics}%)
- Weakest Topics: ${statsContext.weakTopics || 'None logged yet'}
- Study Hours Today: ${statsContext.studyHoursToday}h (Streak: ${statsContext.streak} days)
- Overdue Revisions: ${statsContext.overdue}
- Burnout risk assessment: ${statsContext.burnout.message} (Score: ${statsContext.burnout.score}%)

Guidelines:
1. Provide rigorous, conceptual, and strategic answers.
2. Ground your advice on the current page location if relevant.
3. Keep answers compact but rich (use lists, bold text, markdown headings).
4. Use standard LaTeX block or inline notation (e.g. $F=ma$) for formula expressions.
5. IMPORTANT: Do NOT call tools unless explicitly requested. For simple greetings like 'hi', just respond conversationally.
6. If search results are provided under a \`### 🌐 Web Search Results\` heading, treat them as ground truth and cite sources. If the heading is absent, you do NOT have real-time web access, so do not claim to have searched.`;

      const chatHistory = messages
        .filter(m => m.id !== 'copilot-1')
        .map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        }));
      chatHistory.push({ role: 'user', content: queryContent });

      const deviceId = getDeviceId();
      const contextSummaryState = getContextSummaryFromState(state, pathname);
      const contextSummary = formatContextSummary(contextSummaryState);
      const pageContent = getDOMSummary(pathname);
      const memory = new MemoryStore(deviceId);
      const memoryContext = await memory.getContextString(text, 8);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatHistory,
          systemPrompt,
          deviceId,
          agentType: 'copilot',
          contextSummary,
          pageContent,
          memoryContext,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('API request failed');
      }

      const copilotMsgId = `copilot-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: copilotMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        statusLogs: [],
      }]);
      setIsTyping(false);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantText = '';
      let streamLogs: string[] = [];

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
                setMessages(prev => prev.map(m => m.id === copilotMsgId ? { ...m, content: assistantText } : m));
              } else if (event.type === 'status') {
                streamLogs = [...streamLogs, event.message];
                setCurrentLogs(streamLogs);
                setMessages(prev => prev.map(m => m.id === copilotMsgId ? { ...m, statusLogs: streamLogs } : m));
              } else if (event.type === 'tool_start') {
                const logMsg = `🔍 Running: ${event.name}...`;
                streamLogs = [...streamLogs, logMsg];
                setCurrentLogs(streamLogs);
                setMessages(prev => prev.map(m => m.id === copilotMsgId ? { ...m, statusLogs: streamLogs } : m));
              } else if (event.type === 'tool_end') {
                const logMsg = `✅ Completed: ${event.name}`;
                streamLogs = [...streamLogs, logMsg];
                setCurrentLogs(streamLogs);
                setMessages(prev => prev.map(m => m.id === copilotMsgId ? { ...m, statusLogs: streamLogs } : m));
              } else if (event.type === 'resource_result' && event.payload) {
                dispatch({ type: 'ADD_RESOURCE', payload: event.payload });
              } else if (event.type === 'dynamic_questions') {
                const dqKey = `dq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                try {
                  sessionStorage.setItem(dqKey, JSON.stringify({
                    questions: event.questions,
                    title: event.title,
                    chapterId: event.chapterId,
                    chapterName: event.chapterName,
                    subject: event.subject,
                    source: event.title || 'AI Generated',
                  }));
                  sessionStorage.setItem('pendingDqKey', dqKey);
                } catch {
                  // sessionStorage unavailable
                }
                assistantText += `\n\n🧪 **${event.questions?.length || 0} questions cached.** Launching test...`;
                setMessages(prev => prev.map(m => m.id === copilotMsgId ? { ...m, content: assistantText } : m));
              } else if (event.type === 'remember') {
                try {
                  const memStore = new MemoryStore(deviceId);
                  await memStore.add(event.observation, 'observation', 'ai_copilot', event.tags || []);
                  const logMsg = `🧠 Logged: "${event.observation.substring(0, 30)}..."`;
                  streamLogs = [...streamLogs, logMsg];
                  setCurrentLogs(streamLogs);
                  setMessages(prev => prev.map(m => m.id === copilotMsgId ? { ...m, statusLogs: streamLogs } : m));
                } catch (e) {
                  console.warn('Failed to save remember event in Copilot:', e);
                }
              } else if (event.type === 'client_action') {
                if (event.action === 'generate_mock_test') {
                  try {
                    const pendingDqKey = sessionStorage.getItem('pendingDqKey');
                    if (pendingDqKey) {
                      event.args = { ...event.args, dqKey: pendingDqKey };
                      sessionStorage.removeItem('pendingDqKey');
                    }
                  } catch {
                    // sessionStorage unavailable
                  }
                }
                handleStoreAction(event.action, event.args, { dispatch, getTopicById, completeTopicWithRevisions, logStudy, state, generateDailyPlan, router });
                let actionDesc = `✅ Action completed: ${event.action}`;
                if (event.action === 'update_topic_status' && event.args.topicName) {
                  actionDesc = `✅ **${event.args.topicName}** marked as **${event.args.status}** in your syllabus tracker!`;
                } else if (event.action === 'generate_flashcards') {
                  actionDesc = `✅ Created ${event.args.flashcards?.length || 0} flashcards and launching deck!`;
                }
                assistantText += `\n\n${actionDesc}`;
                setMessages(prev => prev.map(m => m.id === copilotMsgId ? { ...m, content: assistantText } : m));
              } else if (event.type === 'error') {
                assistantText += `\n\n⚠️ ${event.message}`;
                setMessages(prev => prev.map(m => m.id === copilotMsgId ? { ...m, content: assistantText } : m));
              }
            } catch {
              // Ignore event processing errors
            }
          }
        }
      }
      setCurrentLogs([]);

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
              await memStore.add(reflectData.userPersonaInsight, 'preference', 'ai_copilot', ['hermes', 'persona'], 0.85);
            }
            if (Array.isArray(reflectData.adaptationNotes)) {
              for (const note of reflectData.adaptationNotes) {
                if (note.length > 10) {
                  await memStore.add(note, 'observation', 'ai_copilot', ['hermes', 'adaptation'], 0.7);
                }
              }
            }
          }
        } catch (reflectErr) {
          console.warn('Hermes reflection call failed in Copilot:', reflectErr);
        }
      }
    } catch (err) {
      console.warn('AI Co-Pilot chat error:', err);
      setMessages(prev => [...prev, {
        id: `copilot-err-${Date.now()}`,
        role: 'assistant',
        content: `I ran into an issue connecting to the server. But here is a tip: focus on your revision queue of ${statsContext.overdue} overdue items to minimize forgetting!`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsTyping(false);
      setCurrentLogs([]);
    }
  };

  // ─── Draggable FAB Handlers ─────────────────────────────────────────────────
  const DRAG_THRESHOLD = 8;
  const handleFabPointerDown = useCallback((e: React.PointerEvent) => {
    const el = fabRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    dragStart.current = { x: e.clientX, y: e.clientY, px: rect.left, py: rect.top };
    didDrag.current = false;
  }, []);

  const handleFabPointerMove = useCallback((e: React.PointerEvent) => {
    const s = dragStart.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!didDrag.current && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
    didDrag.current = true;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const btnW = 56;
    const btnH = 56;
    const newX = Math.max(0, Math.min(vw - btnW, s.px + dx));
    const newY = Math.max(0, Math.min(vh - btnH, s.py + dy));
    setFabPos({ x: newX, y: newY });
  }, []);

  const handleFabPointerUp = useCallback(() => {
    dragStart.current = null;
  }, []);

  const fabStyle: React.CSSProperties = fabPos
    ? { position: 'fixed', left: fabPos.x, top: fabPos.y, bottom: 'auto', right: 'auto', zIndex: 40 }
    : { position: 'fixed', bottom: 24, right: 24, zIndex: 40 };

  return (
    <>
      {/* ─── Floating Trigger Button (Ambient Widget Pill when collapsed) ─── */}
      <div
        ref={fabRef}
        className="z-40 touch-none select-none"
        style={fabStyle}
        onPointerDown={handleFabPointerDown}
        onPointerMove={handleFabPointerMove}
        onPointerUp={handleFabPointerUp}
      >
        <Button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            if (!didDrag.current) setIsOpen(!isOpen);
          }}
          className={`relative shadow-2xl hover:scale-105 transition-all duration-300 border border-white/10 group cursor-pointer ${
            isOpen 
              ? "h-14 w-14 rounded-full bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 p-0" 
              : "h-12 px-4 rounded-full bg-zinc-950/90 hover:bg-zinc-900/90 text-white flex items-center gap-2.5 backdrop-blur-md"
          }`}
          title="Ask AI Co-Pilot"
        >
          {isOpen ? (
            <X className="h-6 w-6 text-white mx-auto" />
          ) : (
            <>
              <div className="flex items-center justify-center h-7 w-7 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500">
                <Bot className="h-4 w-4 text-white group-hover:rotate-12 transition-transform" />
              </div>
              <span className="text-xs font-semibold font-mono tracking-tight text-zinc-300">
                ⏱️ {statsContext.studyHoursToday.toFixed(1)}h
              </span>
              <span className="h-3 w-px bg-zinc-800" />
              <span className="text-xs font-semibold font-mono tracking-tight text-zinc-300">
                🔥 {statsContext.streak}
              </span>
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 text-[10px] items-center justify-center font-bold text-black font-sans">AI</span>
              </span>
            </>
          )}
        </Button>
      </div>

      {/* ─── Slide-up Glass Chat Panel ─── */}
      {isOpen && (
        <Card className="fixed bottom-20 right-4 left-4 sm:left-auto sm:right-6 z-40 w-[calc(100vw-32px)] sm:w-[380px] h-[500px] sm:h-[520px] max-h-[calc(100vh-120px)] border border-white/10 bg-[#0d0d15]/85 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
          <CardHeader className="bg-[#12121e]/90 border-b border-white/5 p-4 flex flex-row items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-purple-500 to-indigo-500 text-white shadow-md">
                <Brain className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-zinc-200">AI Co-Pilot</CardTitle>
                <CardDescription className="text-[10px] text-zinc-500 flex items-center gap-1 mt-0.5">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Context: <span className="text-zinc-400 font-medium">{getPageContextLabel()}</span>
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-zinc-500 hover:text-white rounded-md"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          {/* Quick Actions Header */}
          <div className="bg-[#101018]/50 border-b border-white/5 px-4 py-2 flex gap-1.5 shrink-0 overflow-x-auto scrollbar-none">
            <Button
              onClick={() => handleSend('/burnout')}
              variant="outline"
              size="xs"
              className="text-[10px] bg-red-500/5 hover:bg-red-500/10 border-red-500/10 text-red-400 font-semibold cursor-pointer shrink-0"
            >
              ⚡ Burnout Analyze
            </Button>
            <Button
              onClick={() => handleSend('/study-plan')}
              variant="outline"
              size="xs"
              className="text-[10px] bg-indigo-500/5 hover:bg-indigo-500/10 border-indigo-500/10 text-indigo-400 font-semibold cursor-pointer shrink-0"
            >
              🎯 Daily Priorities
            </Button>
            <Button
              onClick={() => handleSend('/formulas ')}
              variant="outline"
              size="xs"
              className="text-[10px] bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/10 text-amber-400 font-semibold cursor-pointer shrink-0"
            >
              📚 Formula Guide
            </Button>
          </div>

          <CardContent 
            className="flex-1 flex flex-col overflow-hidden p-0 bg-[#0d0d15]/50 relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isDragging && (
              <div className="absolute inset-0 bg-[#0d0d15]/95 backdrop-blur-sm border-2 border-dashed border-purple-500/40 rounded-b-xl z-50 flex flex-col items-center justify-center gap-3 animate-in fade-in duration-150">
                <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400">
                  <Upload className="h-6 w-6 animate-bounce" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-zinc-200">Drop equation or diagram here</p>
                  <p className="text-[10px] text-zinc-500 mt-1">Accepts any study screenshot for scanning</p>
                </div>
              </div>
            )}

            {/* Messages Scroll Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-2.5 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role !== 'user' && (
                    <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-purple-500/15 text-purple-400">
                      <Brain className="h-3 w-3" />
                    </div>
                  )}
                  <div className="flex flex-col max-w-[82%] gap-1">
                    <div
                      className={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                        message.role === 'user'
                          ? 'bg-purple-600 text-white rounded-tr-none'
                          : 'bg-zinc-900 border border-white/5 text-zinc-200 rounded-tl-none'
                      }`}
                    >
                      <div className="prose prose-invert prose-xs max-w-none space-y-1" translate="no">
                        {(() => {
                          const graphData = extractGraphReferences(message.content);
                          const merged = graphData.cleanText.replace(/([^\\])\n(?!\n|#|\s*[-*]\s|```|\|)/g, '$1 ');
                          const elements = merged.split('\n').map((line, i) => {
                            const repairedLine = line
                              .replace(/\\yec/g, '\\vec')
                              .replace(/dyec/g, 'd\\vec')
                              .replace(/miyec/g, 'm\\vec')
                              .replace(/yec/g, 'vec');
                            if (repairedLine.startsWith('## ')) return <h4 key={i} className="text-zinc-200 font-bold text-xs mt-2 mb-1">{renderInlineMath(repairedLine.replace('## ', ''))}</h4>;
                            if (repairedLine.startsWith('### ')) return <h5 key={i} className="text-zinc-300 font-bold text-[11px] mt-1.5 mb-1">{renderInlineMath(repairedLine.replace('### ', ''))}</h5>;
                            if (repairedLine.startsWith('- ')) return <p key={i} className="pl-2 relative before:content-['•'] before:absolute before:left-0 before:text-zinc-500">• {renderInlineMath(repairedLine.replace('- ', ''))}</p>;
                            if (repairedLine.trim() === '') return <br key={i} />;
                            return <p key={i} style={{ whiteSpace: 'pre-wrap' }}>{renderInlineMath(repairedLine)}</p>;
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

                    {/* Intermediate stream search/status logs */}
                    {message.role !== 'user' && message.statusLogs && message.statusLogs.length > 0 && (
                      <div className="mt-1 pl-1 space-y-0.5 border-l border-zinc-800">
                        {message.statusLogs.map((log, li) => (
                          <div key={li} className="text-[9px] text-zinc-500 font-medium font-mono">
                            {log}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {message.role === 'user' && (
                    <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-400">
                      <User className="h-3 w-3" />
                    </div>
                  )}
                </div>
              ))}

              {(isTyping || isOcrProcessing) && (
                <div className="flex gap-2.5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-purple-500/15 text-purple-400">
                    <Brain className="h-3 w-3" />
                  </div>
                  <div className="flex flex-col gap-1.5 max-w-[80%]">
                    {currentLogs.length > 0 && (
                      <div className="rounded-xl bg-zinc-900 border border-white/5 px-3 py-2 text-[10px] text-zinc-400 space-y-1">
                        {currentLogs.map((log, li) => (
                          <div key={li} className="flex items-center gap-1.5 font-mono">
                            <span className="h-1 w-1 rounded-full bg-indigo-400 animate-ping" />
                            {log}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="rounded-2xl bg-zinc-900 border border-white/5 px-3.5 py-2.5 rounded-tl-none w-fit">
                      <div className="flex gap-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input Area */}
            <div className="border-t border-white/5 p-3 bg-[#0a0a10] flex flex-col gap-2 shrink-0">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0 bg-zinc-900 border-white/5 text-zinc-400 hover:text-white rounded-lg p-0 cursor-pointer"
                  title="Upload image for OCR scan"
                >
                  <ImageIcon className="h-4 w-4" />
                </Button>
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask Co-Pilot or drop an equation..."
                  className="flex-1 h-9 bg-zinc-900 border-white/5 text-xs text-white"
                  disabled={isOcrProcessing}
                />
                <Button
                  onClick={() => handleSend()}
                  disabled={!chatInput.trim() || isTyping || isOcrProcessing}
                  className="h-9 w-9 shrink-0 bg-purple-600 hover:bg-purple-700 text-white rounded-lg p-0 cursor-pointer"
                  size="icon"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
