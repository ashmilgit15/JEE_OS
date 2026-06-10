'use client';

import { useState, useMemo } from 'react';
import { useStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PenLine,
  Clock,
  BookOpen,
  RotateCcw,
  Target,
  FileText,
  School,
  Atom,
  FlaskConical,
  Calculator,
  Send,
  CalendarDays,
  TrendingUp,
  Layers,
  Sparkles,
  Search,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { SubjectId, StudyLog } from '@/types';

// ---------- constants ----------

const SUBJECT_CONFIG: Record<SubjectId, { label: string; icon: React.ReactNode; color: string; bgColor: string; borderColor: string; dotColor: string }> = {
  physics: {
    label: 'Physics',
    icon: <Atom className="size-3.5" />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    dotColor: 'bg-blue-400',
  },
  chemistry: {
    label: 'Chemistry',
    icon: <FlaskConical className="size-3.5" />,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    dotColor: 'bg-emerald-400',
  },
  mathematics: {
    label: 'Mathematics',
    icon: <Calculator className="size-3.5" />,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    dotColor: 'bg-amber-400',
  },
};

const TYPE_CONFIG: Record<StudyLog['type'], { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
  study: {
    label: 'Study',
    icon: <BookOpen className="size-3" />,
    color: 'text-blue-300',
    bgColor: 'bg-blue-500/10',
  },
  revision: {
    label: 'Revision',
    icon: <RotateCcw className="size-3" />,
    color: 'text-violet-300',
    bgColor: 'bg-violet-500/10',
  },
  practice: {
    label: 'Practice',
    icon: <Target className="size-3" />,
    color: 'text-green-300',
    bgColor: 'bg-green-500/10',
  },
  test: {
    label: 'Test',
    icon: <FileText className="size-3" />,
    color: 'text-rose-300',
    bgColor: 'bg-rose-500/10',
  },
  school: {
    label: 'School',
    icon: <School className="size-3" />,
    color: 'text-cyan-300',
    bgColor: 'bg-cyan-500/10',
  },
};

const STUDY_TYPES: StudyLog['type'][] = ['study', 'revision', 'practice', 'test', 'school'];

// ---------- helpers ----------

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatLogDate(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    return format(d, 'h:mm a');
  } catch {
    return '';
  }
}

function groupLogsByDate(logs: StudyLog[]): { date: string; label: string; logs: StudyLog[] }[] {
  const groups: Record<string, StudyLog[]> = {};
  for (const log of logs) {
    const dateKey = format(parseISO(log.date), 'yyyy-MM-dd');
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(log);
  }

  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');

  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, logs]) => ({
      date: dateKey,
      label:
        dateKey === today
          ? 'Today'
          : dateKey === yesterday
            ? 'Yesterday'
            : format(parseISO(dateKey), 'EEEE, MMM d'),
      logs: logs.sort((a, b) => b.date.localeCompare(a.date)),
    }));
}

// ---------- sub-components ----------

function SubjectBadge({ subject }: { subject: SubjectId }) {
  const cfg = SUBJECT_CONFIG[subject];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.bgColor} ${cfg.color} ${cfg.borderColor}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function TypeBadge({ type }: { type: StudyLog['type'] }) {
  const cfg = TYPE_CONFIG[type];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.bgColor} ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function LogEntry({ log, getTopicById }: { log: StudyLog; getTopicById: (id: string) => any }) {
  const topicInfo = getTopicById(log.topicId);
  const subjectCfg = SUBJECT_CONFIG[log.subject];

  return (
    <div className="group/entry relative flex gap-4 py-3">
      {/* Timeline dot + line */}
      <div className="relative flex flex-col items-center">
        <div className={`mt-1.5 size-2.5 rounded-full ${subjectCfg.dotColor} ring-2 ring-background`} />
        <div className="mt-1 flex-1 w-px bg-border/40 group-last/entry:hidden" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1 min-w-0">
            <p className="text-sm font-medium leading-snug text-foreground">{log.description}</p>
            {topicInfo && (
              <p className="text-xs text-muted-foreground truncate">
                {topicInfo.chapter.name} → {topicInfo.topic.name}
              </p>
            )}
          </div>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {formatLogDate(log.date)}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <SubjectBadge subject={log.subject} />
          <TypeBadge type={log.type} />
          <span className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">
            <Clock className="size-3" />
            {formatDuration(log.duration)}
          </span>
        </div>
      </div>
    </div>
  );
}

function TodaySummaryCard({
  studyLogs,
  getTodayStudyHours,
}: {
  studyLogs: StudyLog[];
  getTodayStudyHours: () => number;
}) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayLogs = studyLogs.filter((l) => l.date.startsWith(todayStr));
  const totalHours = getTodayStudyHours();

  const topicsCovered = new Set(todayLogs.map((l) => l.topicId)).size;

  const subjectBreakdown = useMemo(() => {
    const breakdown: Record<SubjectId, number> = { physics: 0, chemistry: 0, mathematics: 0 };
    for (const log of todayLogs) {
      breakdown[log.subject] += log.duration;
    }
    return breakdown;
  }, [todayLogs]);

  const totalMinutes = todayLogs.reduce((sum, l) => sum + l.duration, 0);

  return (
    <Card className="border-border/50 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
            <TrendingUp className="size-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">Today&apos;s Summary</CardTitle>
            <CardDescription className="text-xs">{format(new Date(), 'EEEE, MMM d')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-background/60 p-3 text-center">
            <p className="text-xl font-bold tabular-nums leading-none text-foreground">
              {totalHours.toFixed(1)}
            </p>
            <p className="mt-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Hours</p>
          </div>
          <div className="rounded-lg bg-background/60 p-3 text-center">
            <p className="text-xl font-bold tabular-nums leading-none text-foreground">
              {topicsCovered}
            </p>
            <p className="mt-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Topics</p>
          </div>
          <div className="rounded-lg bg-background/60 p-3 text-center">
            <p className="text-xl font-bold tabular-nums leading-none text-foreground">
              {todayLogs.length}
            </p>
            <p className="mt-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Sessions</p>
          </div>
        </div>

        {/* Subject breakdown */}
        {totalMinutes > 0 && (
          <div className="space-y-2.5">
            <p className="text-xs font-medium text-muted-foreground">Subject Breakdown</p>
            {(['physics', 'chemistry', 'mathematics'] as SubjectId[]).map((subjectId) => {
              const minutes = subjectBreakdown[subjectId];
              if (minutes === 0) return null;
              const percent = Math.round((minutes / totalMinutes) * 100);
              const cfg = SUBJECT_CONFIG[subjectId];
              return (
                <div key={subjectId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className={`flex items-center gap-1.5 font-medium ${cfg.color}`}>
                      {cfg.icon}
                      {cfg.label}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{formatDuration(minutes)} · {percent}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
                    <div
                      className={`h-full rounded-full transition-all ${cfg.dotColor}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {todayLogs.length === 0 && (
          <div className="flex flex-col items-center py-4 text-center">
            <Sparkles className="mb-2 size-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No study sessions logged today</p>
            <p className="mt-1 text-[10px] text-muted-foreground/60">Log your first session above!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- skill-based tracker ----------

const SKILL_TYPES = [
  { id: 'conceptual', label: 'Conceptual', description: 'Theory, understanding, explanations', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: '🧠' },
  { id: 'numerical', label: 'Numerical', description: 'Problem solving, calculations', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: '🔢' },
  { id: 'speed', label: 'Calculative Speed', description: 'Timed drills, speed practice', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: '⚡' },
  { id: 'retention', label: 'Retention', description: 'Memory, recall, flashcards', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: '🔁' },
] as const;

type SkillType = typeof SKILL_TYPES[number]['id'];

function SkillTrackerCard({
  studyLogs,
  onLog,
  syllabus,
}: {
  studyLogs: StudyLog[];
  onLog: (description: string, topicId: string, chapterId: string, subject: SubjectId, duration: number, type: StudyLog['type']) => void;
  syllabus: { id: SubjectId; chapters: { id: string; name: string; topics: { id: string; name: string }[] }[] }[];
}) {
  const [open, setOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<SkillType>('conceptual');
  const [skillDuration, setSkillDuration] = useState(30);
  const [skillSubject, setSkillSubject] = useState<SubjectId>('physics');
  const [skillTopic, setSkillTopic] = useState('');

  // Compute skill minutes from study logs (using description heuristic)
  const skillBreakdown = useMemo(() => {
    const map: Record<SkillType, number> = { conceptual: 0, numerical: 0, speed: 0, retention: 0 };
    for (const log of studyLogs) {
      const desc = log.description.toLowerCase();
      if (desc.includes('concept') || desc.includes('theory') || desc.includes('understand') || log.type === 'study') map.conceptual += log.duration;
      if (desc.includes('numer') || desc.includes('problem') || desc.includes('solve') || log.type === 'practice') map.numerical += log.duration;
      if (desc.includes('speed') || desc.includes('drill') || desc.includes('timed') || desc.includes('fast')) map.speed += log.duration;
      if (desc.includes('recall') || desc.includes('flash') || desc.includes('retention') || desc.includes('formula') || log.type === 'revision') map.retention += log.duration;
    }
    return map;
  }, [studyLogs]);

  const totalSkillMinutes = Object.values(skillBreakdown).reduce((a, b) => a + b, 0);

  const handleSkillLog = () => {
    const subjectData = syllabus.find(s => s.id === skillSubject);
    const firstChapter = subjectData?.chapters[0];
    const firstTopic = firstChapter?.topics[0];
    if (!firstChapter || !firstTopic) return;
    const skill = SKILL_TYPES.find(s => s.id === selectedSkill);
    const desc = `[${skill?.label}] ${skillTopic || skill?.description} — ${formatDuration(skillDuration)} session`;
    const logType: StudyLog['type'] = selectedSkill === 'retention' ? 'revision' : selectedSkill === 'speed' ? 'practice' : 'study';
    onLog(desc, firstTopic.id, firstChapter.id, skillSubject, skillDuration, logType);
    setSkillTopic('');
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setOpen(o => !o)}
        >
          <div className="flex items-center gap-2">
            <Target className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Skill-Based Tracker</CardTitle>
            <Badge variant="secondary" className="text-[10px]">Alternative Mode</Badge>
          </div>
          <span className="text-xs text-muted-foreground">{open ? '▲' : '▼'}</span>
        </div>
        <CardDescription className="text-xs">
          Track by skill type: Conceptual, Numerical, Speed & Retention
        </CardDescription>
      </CardHeader>

      {/* Skill breakdown bars — always visible */}
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {SKILL_TYPES.map(skill => {
            const mins = skillBreakdown[skill.id];
            const pct = totalSkillMinutes > 0 ? Math.round((mins / totalSkillMinutes) * 100) : 0;
            return (
              <div key={skill.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className={`flex items-center gap-1.5 font-medium ${skill.color}`}>
                    <span>{skill.icon}</span>{skill.label}
                  </span>
                  <span className="text-muted-foreground tabular-nums">{formatDuration(mins)} · {pct}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
                  <div className={`h-full rounded-full transition-all ${skill.bg.replace('/10', '/60')}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Expandable log form */}
        {open && (
          <div className="pt-2 space-y-3 border-t border-border/30 animate-in fade-in-0 slide-in-from-top-2 duration-200">
            <p className="text-xs text-muted-foreground">Log a session by skill type:</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SKILL_TYPES.map(skill => (
                <button
                  key={skill.id}
                  onClick={() => setSelectedSkill(skill.id)}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition-all ${
                    selectedSkill === skill.id
                      ? `${skill.bg} ${skill.color} ${skill.border}`
                      : 'border-border/40 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <span className="text-base">{skill.icon}</span>
                  <span>{skill.label}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Subject</label>
                <select
                  value={skillSubject}
                  onChange={e => setSkillSubject(e.target.value as SubjectId)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="physics">Physics</option>
                  <option value="chemistry">Chemistry</option>
                  <option value="mathematics">Mathematics</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Duration (min)</label>
                <input
                  type="number"
                  value={skillDuration}
                  onChange={e => setSkillDuration(Number(e.target.value))}
                  min={5}
                  max={300}
                  step={5}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Notes (optional)</label>
              <input
                value={skillTopic}
                onChange={e => setSkillTopic(e.target.value)}
                placeholder={`e.g. Practiced ${SKILL_TYPES.find(s => s.id === selectedSkill)?.description}`}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <Button onClick={handleSkillLog} size="sm" className="w-full gap-1.5">
              <Send className="size-3.5" />Log Skill Session
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- main page ----------

// Helper to parse JSON robustly from LLM response
function parseJSONRobust(str: string): any {
  const trimmed = str.trim();
  try {
    return JSON.parse(trimmed);
  } catch (firstError) {
    // Attempt 1: Extract block using brace counting
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
      
      if (objects.length > 0) {
        return objects.reduce((acc, curr) => ({ ...acc, ...curr }), {});
      }
    } catch {
      // Ignore fallback failure
    }

    // Attempt 2: Extract using regex matching curly braces
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // Ignore
      }
    }
    
    throw firstError;
  }
}

export default function StudyLogPage() {
  const { state, logStudy, getTodayStudyHours, getTopicById } = useStore();

  // Form state
  const [description, setDescription] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<SubjectId>('physics');
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [duration, setDuration] = useState(60);
  const [studyType, setStudyType] = useState<StudyLog['type']>('study');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Autocomplete matching logic
  const autocompleteSuggestions = useMemo(() => {
    if (!description.trim() || description.length < 3) return [];

    const query = description.toLowerCase();
    const suggestions: Array<{
      type: 'topic' | 'chapter';
      subject: SubjectId;
      chapterId: string;
      chapterName: string;
      topicId?: string;
      topicName?: string;
      displayText: string;
    }> = [];

    for (const subject of state.syllabus) {
      for (const chapter of subject.chapters) {
        if (chapter.name.toLowerCase().includes(query)) {
          suggestions.push({
            type: 'chapter',
            subject: subject.id,
            chapterId: chapter.id,
            chapterName: chapter.name,
            displayText: `📂 ${subject.name} - ${chapter.name}`
          });
        }
        for (const topic of chapter.topics) {
          if (topic.name.toLowerCase().includes(query)) {
            suggestions.push({
              type: 'topic',
              subject: subject.id,
              chapterId: chapter.id,
              chapterName: chapter.name,
              topicId: topic.id,
              topicName: topic.name,
              displayText: `🎯 ${chapter.name} → ${topic.name}`
            });
          }
        }
      }
    }
    return suggestions.slice(0, 5);
  }, [description, state.syllabus]);

  const selectSuggestion = (s: typeof autocompleteSuggestions[0]) => {
    setSelectedSubject(s.subject);
    setSelectedChapterId(s.chapterId);
    if (s.type === 'topic' && s.topicId) {
      setSelectedTopicId(s.topicId);
      const text = description.toLowerCase();
      if (text.includes('rev') || text.includes('formula')) setStudyType('revision');
      else if (text.includes('test') || text.includes('quiz')) setStudyType('test');
      else if (text.includes('prac') || text.includes('dpp') || text.includes('solve')) setStudyType('practice');
      else if (text.includes('school') || text.includes('class')) setStudyType('school');
    }
    setShowSuggestions(false);
  };

  const handleAIAutoFill = async () => {
    if (!description.trim()) return;
    setIsParsing(true);

    try {
      const syllabusOutline = state.syllabus.map(s => ({
        id: s.id,
        name: s.name,
        chapters: s.chapters.map(c => ({
          id: c.id,
          name: c.name,
          topics: c.topics.map(t => ({ id: t.id, name: t.name }))
        }))
      }));

      const systemPrompt = `You are an AI parser for JEE OS. Match the user's description of what they studied to a single topic in the syllabus database.
Syllabus Database:
${JSON.stringify(syllabusOutline)}

Return ONLY a JSON object (no explanations, no markdown code block wrapper, just raw JSON) matching this interface:
{
  "subject": "physics" | "chemistry" | "mathematics",
  "chapterId": "matched chapter ID",
  "topicId": "matched topic ID",
  "duration": estimated minutes (default 60),
  "type": "study" | "revision" | "practice" | "test" | "school" (default "study")
}`;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: description }],
          systemPrompt,
        }),
      });

      if (!response.ok || !response.body) throw new Error('Failed to fetch parsing results or empty body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';
      let clientActionArgs: any = null;

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
              accumulatedText += event.content;
            } else if (event.type === 'client_action') {
              clientActionArgs = event.args;
            }
          } catch {
            // Quietly ignore malformed/incomplete JSON lines
          }
        }
      }

      let result: any = null;
      if (clientActionArgs) {
        result = clientActionArgs;
      } else {
        let reply = accumulatedText.trim();
        
        // Clean up markdown block format if LLM includes it
        if (reply.startsWith('```')) {
          reply = reply.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
        }

        try {
          result = parseJSONRobust(reply);
        } catch (err) {
          console.warn('Robust JSON parse failed, trying heuristic extraction:', err);
        }
      }

      if (result) {
        // Resolve subject and chapter if missing but topicId is present
        if (result.topicId && (!result.subject || !result.chapterId)) {
          for (const sub of state.syllabus) {
            for (const ch of sub.chapters) {
              const matchedTopic = ch.topics.find(t => t.id === result.topicId);
              if (matchedTopic) {
                result.subject = sub.id;
                result.chapterId = ch.id;
                break;
              }
            }
          }
        }

        if (result.subject) setSelectedSubject(result.subject as SubjectId);
        if (result.chapterId) setSelectedChapterId(result.chapterId);
        if (result.topicId) setSelectedTopicId(result.topicId);
        if (result.duration) setDuration(Number(result.duration));
        if (result.type) setStudyType(result.type as StudyLog['type']);
      }
    } catch (e) {
      console.error('Error parsing natural language with AI:', e);
    } finally {
      setIsParsing(false);
    }
  };

  // Derived data for dropdowns
  const selectedSubjectData = useMemo(
    () => state.syllabus.find((s) => s.id === selectedSubject),
    [state.syllabus, selectedSubject],
  );

  const selectedChapterData = useMemo(
    () => selectedSubjectData?.chapters.find((c) => c.id === selectedChapterId),
    [selectedSubjectData, selectedChapterId],
  );

  // Grouped logs
  const groupedLogs = useMemo(() => groupLogsByDate(state.studyLogs), [state.studyLogs]);

  // Handlers
  const handleSubjectChange = (subjectId: SubjectId) => {
    setSelectedSubject(subjectId);
    setSelectedChapterId('');
    setSelectedTopicId('');
  };

  const handleChapterChange = (chapterId: string | null) => {
    setSelectedChapterId(chapterId ?? '');
    setSelectedTopicId('');
  };

  const handleSubmit = () => {
    if (!description.trim() || !selectedTopicId || !selectedChapterId) return;

    setIsSubmitting(true);
    logStudy(description.trim(), selectedTopicId, selectedChapterId, selectedSubject, duration, studyType);

    // Reset form
    setDescription('');
    setSelectedTopicId('');
    setDuration(60);
    setStudyType('study');

    setTimeout(() => setIsSubmitting(false), 300);
  };

  const canSubmit = description.trim() && selectedTopicId && selectedChapterId && duration > 0;

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 space-y-1">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
              <PenLine className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Study Log</h1>
              <p className="text-sm text-muted-foreground">
                Track your daily study sessions and monitor progress
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Main column */}
          <div className="space-y-6">
            {/* Quick Log Form */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="size-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-semibold">Quick Log</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Describe what you studied in natural language
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Description textarea */}
                <div className="relative">
                  <Textarea
                    placeholder="e.g. Today I completed Sets: Union, Intersection and Venn Diagrams..."
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    className="min-h-20 resize-none text-sm"
                    rows={3}
                  />

                  {/* Autocomplete suggestions dropdown */}
                  {showSuggestions && autocompleteSuggestions.length > 0 && (
                    <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-[#12121e] border border-white/10 rounded-lg shadow-xl divide-y divide-white/5 overflow-hidden animate-in fade-in duration-100 text-white">
                      <div className="px-2.5 py-1 text-[9px] text-zinc-500 font-semibold bg-zinc-950/40 flex items-center gap-1 font-mono uppercase tracking-wider">
                        <Search className="size-2.5" /> Quick Link Syllabus Topics
                      </div>
                      {autocompleteSuggestions.map((s, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onMouseDown={() => selectSuggestion(s)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition-colors flex items-center justify-between text-zinc-300 cursor-pointer"
                        >
                          <span>{s.displayText}</span>
                          <span className="text-[10px] text-zinc-600 font-mono">link</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAIAutoFill}
                    disabled={!description.trim() || isParsing}
                    className="text-xs gap-1.5 border-primary/20 hover:bg-primary/5 hover:text-primary transition-all duration-200"
                  >
                    <Sparkles className="size-3 text-primary animate-pulse" />
                    {isParsing ? 'AI Parsing...' : 'AI Auto-Fill Details'}
                  </Button>
                </div>

                {/* Smart Topic Selector */}
                <div className="space-y-3 rounded-lg border border-border/40 bg-muted/20 p-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Topic Details</p>

                  {/* Subject tabs */}
                  <Tabs value={selectedSubject} onValueChange={(val) => handleSubjectChange(val as SubjectId)}>
                    <TabsList className="w-full">
                      <TabsTrigger value="physics" className="flex-1 gap-1">
                        <Atom className="size-3.5" />
                        <span className="hidden sm:inline">Physics</span>
                        <span className="sm:hidden">Phy</span>
                      </TabsTrigger>
                      <TabsTrigger value="chemistry" className="flex-1 gap-1">
                        <FlaskConical className="size-3.5" />
                        <span className="hidden sm:inline">Chemistry</span>
                        <span className="sm:hidden">Chem</span>
                      </TabsTrigger>
                      <TabsTrigger value="mathematics" className="flex-1 gap-1">
                        <Calculator className="size-3.5" />
                        <span className="hidden sm:inline">Maths</span>
                        <span className="sm:hidden">Math</span>
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {/* Chapter & Topic selectors */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* Chapter select */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-muted-foreground">Chapter</label>
                      <Select
                        value={selectedChapterId}
                        onValueChange={handleChapterChange}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select chapter" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedSubjectData?.chapters.map((chapter) => (
                            <SelectItem key={chapter.id} value={chapter.id}>
                              <span className="mr-1.5">{chapter.icon}</span>
                              {chapter.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Topic select */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-muted-foreground">Topic</label>
                      <Select
                        value={selectedTopicId}
                        onValueChange={(v) => { if (v) setSelectedTopicId(v); }}
                        disabled={!selectedChapterId}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={selectedChapterId ? 'Select topic' : 'Select chapter first'} />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedChapterData?.topics.map((topic) => (
                            <SelectItem key={topic.id} value={topic.id}>
                              {topic.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Duration & Type */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* Duration */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-muted-foreground">Duration (minutes)</label>
                      <div className="flex flex-col gap-2 min-[400px]:flex-row min-[400px]:items-center">
                        <Input
                          type="number"
                          min={1}
                          max={480}
                          value={duration}
                          onChange={(e) => setDuration(Math.max(1, parseInt((e.target as HTMLInputElement).value) || 0))}
                          className="w-full tabular-nums"
                        />
                        <div className="flex items-center gap-1 shrink-0 justify-end">
                          {[15, 30, 60, 120].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setDuration(preset)}
                              className={`rounded-md px-1.5 py-1 text-[10px] font-medium transition-colors ${
                                duration === preset
                                  ? 'bg-primary/20 text-primary'
                                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                              }`}
                            >
                              {preset >= 60 ? `${preset / 60}h` : `${preset}m`}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Type */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-muted-foreground">Session Type</label>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {STUDY_TYPES.map((type) => {
                          const cfg = TYPE_CONFIG[type];
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setStudyType(type)}
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-[11px] font-medium transition-all ${
                                studyType === type
                                  ? `${cfg.bgColor} ${cfg.color} border-current/20`
                                  : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
                              }`}
                            >
                              {cfg.icon}
                              {cfg.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit button */}
                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit || isSubmitting}
                  className="w-full gap-2"
                  size="lg"
                >
                  <Send className="size-4" />
                  {isSubmitting ? 'Logging...' : 'Log Study Session'}
                </Button>
              </CardContent>
            </Card>

            {/* Skill-Based Tracker */}
            <SkillTrackerCard studyLogs={state.studyLogs} onLog={logStudy} syllabus={state.syllabus} />

            {/* Study History Timeline */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-4">
                <CalendarDays className="size-4 text-muted-foreground" />
                <h2 className="text-base font-semibold">Study History</h2>
                <Badge variant="secondary" className="text-[10px] tabular-nums">
                  {state.studyLogs.length} sessions
                </Badge>
              </div>

              {groupedLogs.length === 0 ? (
                <Card className="border-border/50">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <PenLine className="mb-3 size-10 text-muted-foreground/20" />
                    <p className="text-sm font-medium text-muted-foreground">No study sessions yet</p>
                    <p className="mt-1 text-xs text-muted-foreground/60">
                      Log your first study session using the form above
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  {groupedLogs.map((group) => (
                    <div key={group.date}>
                      {/* Date header */}
                      <div className="mb-3 flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">{group.label}</span>
                        <div className="h-px flex-1 bg-border/40" />
                        <span className="text-[10px] tabular-nums text-muted-foreground">
                          {group.logs.length} session{group.logs.length !== 1 ? 's' : ''} ·{' '}
                          {formatDuration(group.logs.reduce((s, l) => s + l.duration, 0))}
                        </span>
                      </div>

                      {/* Timeline entries */}
                      <div className="ml-1">
                        {group.logs.map((log) => (
                          <LogEntry key={log.id} log={log} getTopicById={getTopicById} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6 lg:sticky lg:top-8 lg:self-start">
            <TodaySummaryCard
              studyLogs={state.studyLogs}
              getTodayStudyHours={getTodayStudyHours}
            />

            {/* Quick stats card */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">All Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(['physics', 'chemistry', 'mathematics'] as SubjectId[]).map((subjectId) => {
                    const cfg = SUBJECT_CONFIG[subjectId];
                    const subjectLogs = state.studyLogs.filter((l) => l.subject === subjectId);
                    const totalMinutes = subjectLogs.reduce((s, l) => s + l.duration, 0);
                    const sessionCount = subjectLogs.length;

                    return (
                      <div key={subjectId} className="flex items-center justify-between">
                        <span className={`flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}>
                          {cfg.icon}
                          {cfg.label}
                        </span>
                        <div className="text-right">
                          <span className="text-xs font-semibold tabular-nums">{formatDuration(totalMinutes)}</span>
                          <span className="ml-1.5 text-[10px] text-muted-foreground">{sessionCount} sessions</span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="border-t border-border/40 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">Total</span>
                      <span className="text-xs font-bold tabular-nums text-foreground">
                        {formatDuration(state.studyLogs.reduce((s, l) => s + l.duration, 0))}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
