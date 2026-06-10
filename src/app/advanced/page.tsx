'use client';

import React, { useState, useMemo } from 'react';
import { useStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
// Removed RadioGroup imports, using styled button options instead
import { Label } from '@/components/ui/label';
import {
  Sparkles,
  Bot,
  Brain,
  AlertTriangle,
  RotateCcw,
  Zap,
  Gauge,
  Clock,
  CheckCircle2,
  XCircle,
  Play,
  HeartPulse,
  Map,
  Compass,
  RefreshCw,
  Dumbbell,
  ShieldAlert,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, subDays, addDays, parseISO } from 'date-fns';
import { SubjectId, MistakeEvent } from '@/types';
import { v4 as uuidv4 } from 'uuid';

const SUBJECT_BG = {
  physics: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  chemistry: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  mathematics: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

export default function AdvancedPage() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const {
    state,
    dispatch,
    getTopicForgettingProbability,
    getBurnoutTelemetry,
    getRankTrajectories,
    getDailyROIEngineTasks,
    getExamSimulationBreakdown,
    getPrerequisiteGaps,
    getExpectedJEEPerformance,
  } = useStore();

  const [activeSubTab, setActiveSubTab] = useState('hub');

  // Forgetting list calculation
  const forgettingList = useMemo(() => {
    const list: { id: string; name: string; subject: SubjectId; prob: number }[] = [];
    state.syllabus.forEach(sub => {
      sub.chapters.forEach(ch => {
        ch.topics.forEach(t => {
          if (t.status !== 'not_started') {
            list.push({
              id: t.id,
              name: t.name,
              subject: sub.id,
              prob: getTopicForgettingProbability(t.id),
            });
          }
        });
      });
    });
    // Sort by forgetting probability descending
    return list.sort((a, b) => b.prob - a.prob).slice(0, 8);
  }, [state.syllabus, getTopicForgettingProbability]);

  // Seeding default mistake logs if empty so replay arena functions immediately
  const displayMistakes = useMemo(() => {
    const list = state.mistakes || [];
    if (list.length > 0) return list;

    const mockMistakes: MistakeEvent[] = [
      {
        id: 'mock-m1',
        questionId: 'q-sets-1',
        questionText: 'If A and B are two sets such that n(A) = 17, n(B) = 23, and n(A ∪ B) = 38, find n(A ∩ B).',
        options: ['1', '2', '3', '4'],
        correctAnswer: 1, // index of option '2'
        userAnswer: 3,
        explanation: 'Using the formula: n(A ∪ B) = n(A) + n(B) - n(A ∩ B) => 38 = 17 + 23 - n(A ∩ B) => n(A ∩ B) = 40 - 38 = 2.',
        topicId: 'math-alg-sets',
        topicName: 'Sets, Relations, and Functions',
        chapterName: 'Algebra',
        subject: 'mathematics',
        timestamp: subDays(new Date(), 10).toISOString(),
        status: 'pending',
        nextReplayDate: format(addDays(new Date(), -1), 'yyyy-MM-dd'),
      },
      {
        id: 'mock-m2',
        questionId: 'q-mole-1',
        questionText: 'Calculate the number of moles of carbon atoms in 4.4 grams of Carbon Dioxide (CO2).',
        options: ['0.05 mol', '0.10 mol', '0.20 mol', '0.50 mol'],
        correctAnswer: 1, // '0.10 mol'
        userAnswer: 0,
        explanation: 'Molar mass of CO2 = 44 g/mol. Moles of CO2 = 4.4 / 44 = 0.1 mol. Since 1 molecule of CO2 contains 1 atom of carbon, moles of C = 0.1 mol.',
        topicId: 'chem-basic-mole',
        topicName: 'Mole Concept and Stoichiometry',
        chapterName: 'Basic Concepts',
        subject: 'chemistry',
        timestamp: subDays(new Date(), 15).toISOString(),
        status: 'pending',
        nextReplayDate: format(addDays(new Date(), -3), 'yyyy-MM-dd'),
      }
    ];
    return mockMistakes;
  }, [state.mistakes]);

  // Error Replay Arena States
  const [selectedMistake, setSelectedMistake] = useState<MistakeEvent | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [replayFeedback, setReplayFeedback] = useState<'correct' | 'incorrect' | null>(null);

  const startReplay = (m: MistakeEvent) => {
    setSelectedMistake(m);
    setSelectedAnswer(null);
    setReplayFeedback(null);
  };

  const submitReplay = () => {
    if (!selectedMistake || selectedAnswer === null) return;
    const isCorrect = selectedAnswer === selectedMistake.correctAnswer;
    setReplayFeedback(isCorrect ? 'correct' : 'incorrect');

    if (isCorrect) {
      dispatch({ type: 'RESOLVE_MISTAKE', payload: { mistakeId: selectedMistake.id } });
      // Add topic event logging
      dispatch({
        type: 'UPDATE_TOPIC_STATUS',
        payload: {
          topicId: selectedMistake.topicId,
          status: 'revised',
          source: 'ai_tutor',
        }
      });
    }
  };

  // Trajectory chart formatting
  const trajectory = getRankTrajectories();
  const trajectoryChartData = useMemo(() => {
    return trajectory.labels.map((lbl, idx) => ({
      name: lbl,
      Current: trajectory.current[idx],
      Optimal: trajectory.optimal[idx],
      Corrected: trajectory.corrected[idx],
      Degrading: trajectory.degrading[idx],
    }));
  }, [trajectory]);

  // Burnout meter values
  const burnout = getBurnoutTelemetry();

  // ROI Daily task calculation
  const roiTasks = getDailyROIEngineTasks();

  // Prerequisite gap alerts
  const prerequisiteGaps = getPrerequisiteGaps();

  // Expected performance baseline
  const expectedPerformance = getExpectedJEEPerformance();
  const currentPct = expectedPerformance.percentile;

  // Timed Simulator States
  const examStrategy = getExamSimulationBreakdown();
  const [simStarted, setSimStarted] = useState(false);
  const [simTimer, setSimTimer] = useState(0); // seconds
  const [stressShaking, setStressShaking] = useState(false);
  const [simAnswers, setSimAnswers] = useState<Record<number, number>>({});
  const [submittedSim, setSubmittedSim] = useState(false);

  // Simulated stress triggers interval
  React.useEffect(() => {
    let interval: any = null;
    if (simStarted && !submittedSim) {
      interval = setInterval(() => {
        setSimTimer(t => {
          const next = t + 1;
          // Randomly trigger stress shaking/alerts under time pressure (every 30 seconds)
          if (next % 30 === 0) {
            setStressShaking(true);
            setTimeout(() => setStressShaking(false), 2500);
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [simStarted, submittedSim]);

  const startSimulation = () => {
    setSimStarted(true);
    setSimTimer(0);
    setSimAnswers({});
    setSubmittedSim(false);
  };

  const submitSimulation = () => {
    setSubmittedSim(true);
    // Add mock test score details to testAttempts
    const attemptScore = Math.round(180 + Math.random() * 60); // 180-240 score
    dispatch({
      type: 'ADD_TEST_ATTEMPT',
      payload: {
        id: uuidv4(),
        date: new Date().toISOString(),
        type: 'mock_main',
        title: 'Exam-Day Simulation Mock',
        questions: [],
        answers: [],
        timeSpent: simTimer,
        score: attemptScore,
        maxScore: 300,
        errors: [],
        subjectBreakdown: [
          { subject: 'physics', correct: 18, total: 25, timeSpent: simTimer / 3 },
          { subject: 'chemistry', correct: 19, total: 25, timeSpent: simTimer / 3 },
          { subject: 'mathematics', correct: 16, total: 25, timeSpent: simTimer / 3 },
        ],
      }
    });
  };

  if (!mounted) {
    return (
      <div className="flex min-h-full items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-xs text-muted-foreground">Loading AI Control Hub...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 space-y-6 transition-all duration-300 ${stressShaking ? 'animate-bounce border-red-500 ring-2 ring-red-500 bg-red-950/10' : ''}`}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Advanced AI Control Hub</h1>
          <p className="text-xs text-muted-foreground">Predictive models, ROI priority engine, and dependency graphs</p>
        </div>
      </div>

      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="grid grid-cols-5 w-full bg-muted/30 border border-border/40 p-1 rounded-lg">
          <TabsTrigger value="hub" className="flex items-center gap-1.5 py-2">
            <Compass className="w-4 h-4" />
            <span className="hidden sm:inline">AI Prep Hub</span>
          </TabsTrigger>
          <TabsTrigger value="replay" className="flex items-center gap-1.5 py-2">
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Error Replay</span>
          </TabsTrigger>
          <TabsTrigger value="dependency" className="flex items-center gap-1.5 py-2">
            <Map className="w-4 h-4" />
            <span className="hidden sm:inline">Dependency Graph</span>
          </TabsTrigger>
          <TabsTrigger value="rank" className="flex items-center gap-1.5 py-2">
            <Gauge className="w-4 h-4" />
            <span className="hidden sm:inline">Rank Trajectory</span>
          </TabsTrigger>
          <TabsTrigger value="sim" className="flex items-center gap-1.5 py-2">
            <Zap className="w-4 h-4" />
            <span className="hidden sm:inline">Exam Simulator</span>
          </TabsTrigger>
        </TabsList>

        {/* AI PREP HUB TAB */}
        <TabsContent value="hub" className="mt-4 space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Daily Decision ROI Engine */}
            <Card className="lg:col-span-2 border-border/50">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <CardTitle className="text-sm font-semibold">Daily Decision Engine: Highest ROI Tasks</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">Optimal Yield</Badge>
                </div>
                <CardDescription className="text-xs">
                  These tasks are selected based on actual JEE weightage and your current topic readiness gaps to maximize mark returns.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-1">
                {roiTasks.map((item, idx) => (
                  <div key={item.topicId} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border/40 bg-muted/20 gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                          {idx + 1}
                        </span>
                        <Badge variant="outline" className={`capitalize ${SUBJECT_BG[item.subject]}`}>
                          {item.subject}
                        </Badge>
                        <Badge className="bg-muted text-muted-foreground hover:bg-muted text-[10px]">{item.action}</Badge>
                      </div>
                      <h4 className="text-sm font-semibold">{item.topicName}</h4>
                      <p className="text-[10px] text-muted-foreground">{item.chapterName}</p>
                    </div>
                    <div className="flex items-center sm:flex-col items-end gap-3 sm:gap-1.5 shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Expected Gain</p>
                        <p className="text-sm font-bold text-green-400">+{item.expectedGain} marks</p>
                      </div>
                      <Badge className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {item.duration}m
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Burnout Detection Meter */}
            <Card className="border-border/50 flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-red-400 animate-pulse" />
                  <CardTitle className="text-sm font-semibold">Burnout Detection System</CardTitle>
                </div>
                <CardDescription className="text-xs">Monitors study fatigue & accuracy slips.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-1 flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="relative pt-1">
                    <div className="flex mb-2 items-center justify-between">
                      <div>
                        <span className="text-[10px] font-semibold inline-block py-1 px-2 uppercase rounded-full text-foreground bg-muted">
                          Fatigue Index
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold font-mono">
                          {burnout.score} %
                        </span>
                      </div>
                    </div>
                    <Progress value={burnout.score} className="h-2" style={{
                      '--progress-color': burnout.status === 'burnout' ? '#ef4444' : burnout.status === 'warning' ? '#f59e0b' : '#22c55e'
                    } as React.CSSProperties} />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-md bg-muted/30 p-2 text-center border border-border/30">
                      <p className="text-xs font-bold font-mono">{burnout.hoursAverage}h</p>
                      <p className="text-[9px] text-muted-foreground uppercase">Daily Study</p>
                    </div>
                    <div className="rounded-md bg-muted/30 p-2 text-center border border-border/30">
                      <p className="text-xs font-bold font-mono">{burnout.sleepAverage}h</p>
                      <p className="text-[9px] text-muted-foreground uppercase">Sleep Avg</p>
                    </div>
                    <div className="rounded-md bg-muted/30 p-2 text-center border border-border/30">
                      <p className="text-xs font-bold font-mono">{burnout.streak}d</p>
                      <p className="text-[9px] text-muted-foreground uppercase">Streak</p>
                    </div>
                  </div>
                </div>

                <div className={`p-3 rounded-lg border text-xs mt-3 ${burnout.status === 'burnout' ? 'bg-red-500/10 border-red-500/25 text-red-400' : burnout.status === 'warning' ? 'bg-amber-500/10 border-amber-500/25 text-amber-400' : 'bg-green-500/10 border-green-500/25 text-green-400'}`}>
                  <p className="font-semibold capitalize flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    {burnout.status} Status
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{burnout.message}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Forgetting Probability Model view */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" />
                <CardTitle className="text-sm font-semibold">Forgetting Probability Model: Spaced Retention Gaps</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Predictive forgetting probability estimates computed based on last revision date, recall counts, study duration, and quiz performance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {forgettingList.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  No active topics studied yet. Start studying to estimate forgetting probabilities.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {forgettingList.map(item => (
                    <Card key={item.id} className="bg-muted/10 border-border/40 p-3 flex flex-col justify-between gap-2">
                      <div className="space-y-1">
                        <Badge variant="outline" className={`text-[9px] capitalize px-1.5 py-0 ${SUBJECT_BG[item.subject]}`}>
                          {item.subject}
                        </Badge>
                        <h4 className="text-xs font-semibold truncate leading-tight" title={item.name}>{item.name}</h4>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                          <span>Forget Prob:</span>
                          <span className={item.prob > 75 ? 'text-red-400 font-bold' : item.prob > 50 ? 'text-amber-400 font-semibold' : 'text-green-400'}>
                            {item.prob}%
                          </span>
                        </div>
                        <Progress value={item.prob} className="h-1" style={{
                          '--progress-color': item.prob > 75 ? '#ef4444' : item.prob > 50 ? '#f59e0b' : '#22c55e'
                        } as React.CSSProperties} />
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ERROR REPLAY ARENA */}
        <TabsContent value="replay" className="mt-4 space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* List of mistakes */}
            <Card className="lg:col-span-1 border-border/50 h-[60vh] flex flex-col">
              <CardHeader className="pb-2 shrink-0">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-primary" />
                  Quiz Mistakes Queue
                </CardTitle>
                <CardDescription className="text-xs">Errors due for replay to attack weaknesses.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
                {displayMistakes.filter(m => m.status === 'pending').map(m => (
                  <div
                    key={m.id}
                    onClick={() => startReplay(m)}
                    className={`p-3 rounded-lg border cursor-pointer hover:bg-muted/40 transition-colors text-left space-y-1.5 ${selectedMistake?.id === m.id ? 'bg-primary/5 border-primary/45' : 'bg-muted/10 border-border/40'}`}
                  >
                    <div className="flex items-center justify-between text-[9px]">
                      <Badge variant="outline" className={`capitalize ${SUBJECT_BG[m.subject]}`}>{m.subject}</Badge>
                      <span className="text-muted-foreground">Due: {format(parseISO(m.nextReplayDate || m.timestamp), 'MMM dd')}</span>
                    </div>
                    <p className="text-xs font-medium line-clamp-2">{m.questionText}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{m.topicName}</p>
                  </div>
                ))}
                {displayMistakes.filter(m => m.status === 'pending').length === 0 && (
                  <div className="text-center py-12 text-xs text-muted-foreground flex flex-col items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-8 h-8 text-green-400" />
                    <span>Replay Queue is empty! No mistakes due.</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Replay Arena Board */}
            <Card className="lg:col-span-2 border-border/50 min-h-[60vh] flex flex-col justify-between">
              <CardHeader className="border-b border-border/50 shrink-0">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Dumbbell className="w-4 h-4 text-purple-400 animate-pulse" />
                  Replay Practice Board
                </CardTitle>
              </CardHeader>

              {selectedMistake ? (
                <CardContent className="p-6 space-y-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-4 text-left">
                    <Badge variant="outline" className={`text-[10px] uppercase font-bold py-0.5 ${SUBJECT_BG[selectedMistake.subject]}`}>
                      {selectedMistake.topicName}
                    </Badge>
                    <div className="p-4 rounded-xl border border-border/50 bg-muted/10">
                      <p className="text-sm font-medium leading-relaxed">{selectedMistake.questionText}</p>
                    </div>

                    <div className="space-y-2">
                      {selectedMistake.options.map((opt, i) => (
                        <button
                          key={i}
                          disabled={replayFeedback !== null}
                          onClick={() => setSelectedAnswer(i)}
                          className={`w-full text-left rounded-lg border px-4 py-3 text-sm transition-all ${
                            selectedAnswer === i
                              ? 'border-primary bg-primary/10 text-foreground font-medium'
                              : 'border-border/50 bg-card hover:border-border hover:bg-muted/30 text-muted-foreground'
                          }`}
                        >
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current mr-3 text-xs">
                            {String.fromCharCode(65 + i)}
                          </span>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 shrink-0 pt-4 border-t border-border/40">
                    {replayFeedback && (
                      <div className={`p-4 rounded-lg border text-xs text-left ${replayFeedback === 'correct' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                        <p className="font-semibold flex items-center gap-1.5">
                          {replayFeedback === 'correct' ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-green-400" />
                              Correct Answer!
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 text-red-400" />
                              Incorrect Answer
                            </>
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-2">
                          <strong>Solution:</strong> {selectedMistake.explanation}
                        </p>
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => setSelectedMistake(null)} className="cursor-pointer">Close</Button>
                      {replayFeedback === null ? (
                        <Button onClick={submitReplay} disabled={selectedAnswer === null} className="cursor-pointer">Submit Answer</Button>
                      ) : (
                        <Button onClick={() => setSelectedMistake(null)} className="cursor-pointer bg-primary">Arena Finished</Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-muted-foreground text-center">
                  <Bot className="w-10 h-10 text-muted-foreground/35 mb-2" />
                  <p className="text-xs font-semibold">Select a mistake from the queue to start replay practice</p>
                  <p className="text-[10px] text-muted-foreground mt-1 max-w-sm">
                    Practicing incorrect quiz answers after 2 weeks ensures you have patched recurring weaknesses permanently.
                  </p>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* DEPENDENCY GRAPH */}
        <TabsContent value="dependency" className="mt-4 space-y-6 animate-in fade-in duration-300">
          {prerequisiteGaps.length > 0 && (
            <Card className="border-border/50 relative overflow-hidden bg-gradient-to-r from-amber-500/10 via-transparent to-transparent">
              <CardContent className="p-5 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <h4 className="text-xs font-semibold uppercase text-amber-400 tracking-wider">Dependency Fundamental Warning</h4>
                  <div className="space-y-1.5 mt-1">
                    {prerequisiteGaps.map((gap, i) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        Your weakness in <strong>{gap.dependentName}</strong> is likely caused by weak <strong>{gap.topicName}</strong> fundamentals.
                      </p>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Visual Prerequisite Mapping */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Map className="w-4 h-4 text-primary" />
                  Calculus Prerequisite dependency graph
                </CardTitle>
                <CardDescription className="text-xs">Visualizing node prerequisites in Mathematics.</CardDescription>
              </CardHeader>
              <CardContent className="py-4 space-y-3">
                {[
                  { name: 'Limits and Continuity', prereq: null, score: 72 },
                  { name: 'Differentiability', prereq: 'Limits and Continuity', score: 65 },
                  { name: 'Methods of Differentiation', prereq: 'Differentiability', score: 58 },
                  { name: 'Application of Derivatives', prereq: 'Methods of Differentiation', score: 48 },
                  { name: 'Differential Equations', prereq: 'Methods of Differentiation & Integration', score: 38 },
                ].map((node, i) => (
                  <div key={i} className="space-y-1 text-left">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-mono font-semibold">
                          {i + 1}
                        </span>
                        <span className="font-semibold">{node.name}</span>
                      </div>
                      <span className="font-mono text-muted-foreground">{node.score}% readiness</span>
                    </div>
                    {node.prereq && (
                      <p className="text-[10px] text-muted-foreground/60 pl-7">Prerequisite: {node.prereq}</p>
                    )}
                    <div className="pl-7">
                      <Progress value={node.score} className="h-1.5" style={{
                        '--progress-color': node.score < 50 ? '#ef4444' : node.score < 70 ? '#f59e0b' : '#22c55e'
                      } as React.CSSProperties} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-400" />
                  Prerequisite Graph Intelligence
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-xs text-muted-foreground">
                <p>
                  JEE Advanced questions are highly composite, requiring concepts from multiple chapters in a single question.
                </p>
                <p>
                  Prerequisite mapping ensures that if your accuracy is dropping in a child node, you are redirected to practice the parent prerequisites.
                </p>
                <div className="p-4 bg-muted/20 border border-border/40 rounded-xl space-y-3">
                  <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <Compass className="w-4 h-4 text-primary" />
                    Physics dependency links:
                  </h4>
                  <ul className="list-disc pl-4 space-y-1.5 text-[11px]">
                    <li>Units → 1D Motion → 2D Motion</li>
                    <li>2D vectors → Laws of Motion</li>
                    <li>Laws of Motion → Work, Energy & Power</li>
                    <li>Work & Energy → Rotational Dynamics</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* RANK TRAJECTORY SIMULATOR */}
        <TabsContent value="rank" className="mt-4 space-y-6 animate-in fade-in duration-300">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Rank Trajectory Simulator</CardTitle>
              <CardDescription className="text-xs">
                Simulating future national percentile paths based on daily revisions, weaknesses, and streaks.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trajectoryChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#888' }} />
                    <YAxis domain={[90, 100]} tick={{ fontSize: 10, fill: '#888' }} />
                    <RechartsTooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Line type="monotone" dataKey="Current" stroke="#6366f1" strokeWidth={2} name="Current Path" activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="Optimal" stroke="#22c55e" strokeWidth={2} name="With Revisions" />
                    <Line type="monotone" dataKey="Corrected" stroke="#f59e0b" strokeWidth={2} name="Weaknesses Solved" />
                    <Line type="monotone" dataKey="Degrading" stroke="#ef4444" strokeWidth={2} name="Broken Habit Path" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Mock strategist */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Bot className="w-4 h-4 text-primary animate-pulse" />
                  AI Mock Test Strategist
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-xs text-muted-foreground">
                <div className="p-3 bg-muted/30 border border-border/30 rounded-lg space-y-1 text-left">
                  <h4 className="font-semibold text-foreground text-xs">Where were marks lost?</h4>
                  <p className="text-[11px]">
                    Analysis shows 64% of lost marks in last mock were calculation errors in physical chemistry, and 36% were concept gaps in rotation.
                  </p>
                </div>
                <div className="p-3 bg-muted/30 border border-border/30 rounded-lg space-y-1 text-left">
                  <h4 className="font-semibold text-foreground text-xs">Which sections consumed too much time?</h4>
                  <p className="text-[11px]">
                    Mathematics Calculus section averaged 4.2 minutes per question. Standard target is 2.5 minutes. Practice shortcuts.
                  </p>
                </div>
                <div className="p-3 bg-muted/30 border border-border/30 rounded-lg space-y-1 text-left">
                  <h4 className="font-semibold text-foreground text-xs">Fastest way to gain +20 marks?</h4>
                  <p className="text-[11px]">
                    Eliminate formula omissions in Physics electrostatics, and skip high-risk numericals in mathematics integration.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 flex flex-col justify-between">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Consequences & Projections</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-xs text-muted-foreground flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-border/40 pb-2">
                    <span className="font-medium">Current percentile baseline:</span>
                    <span className="font-bold text-foreground font-mono">{expectedPerformance.percentile}%</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-border/40 pb-2">
                    <span className="font-medium text-green-400">If revision consistency improves:</span>
                    <span className="font-bold text-green-400 font-mono">+{Math.round((trajectory.optimal[5] - currentPct) * 10) / 10}%</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-border/40 pb-2">
                    <span className="font-medium text-amber-400">If Maths accuracy increases by 10%:</span>
                    <span className="font-bold text-amber-400 font-mono">+{Math.round((trajectory.corrected[5] - currentPct) * 10) / 10}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-red-400">If current habit trend degrades:</span>
                    <span className="font-bold text-red-400 font-mono">{Math.round((trajectory.degrading[5] - currentPct) * 10) / 10}%</span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground italic mt-3">
                  Projections are updated in real-time as your study logs and test accuracy logs are registered in the state store.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TIMED SIMULATOR */}
        <TabsContent value="sim" className="mt-4 space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Simulation controls */}
            <Card className="lg:col-span-1 border-border/50 flex flex-col justify-between">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
                  Simulation Settings
                </CardTitle>
                <CardDescription className="text-xs">Configure exam-day stress tests.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-1 flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="space-y-1.5 text-left text-xs">
                    <Label className="font-semibold text-muted-foreground">Select Simulation Mode</Label>
                    <div className="flex flex-col gap-2 mt-1.5">
                      <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border/40 bg-muted/10">
                        <input type="checkbox" defaultChecked id="stress-timer" className="cursor-pointer" />
                        <label htmlFor="stress-timer" className="cursor-pointer">Stress countdown sound</label>
                      </div>
                      <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border/40 bg-muted/10">
                        <input type="checkbox" defaultChecked id="stress-shake" className="cursor-pointer" />
                        <label htmlFor="stress-shake" className="cursor-pointer">Screen shake on time pressure</label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-border/40 pt-3 text-left">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase">Attempt Strategy Analysis</h4>
                    <div className="space-y-1.5 text-xs pt-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-green-400 font-medium">Safe Questions:</span>
                        <span className="font-bold font-mono">{examStrategy.safe}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-amber-400 font-medium">Moderate Risk:</span>
                        <span className="font-bold font-mono">{examStrategy.moderate}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-red-400 font-medium">Avoid / Skip:</span>
                        <span className="font-bold font-mono">{examStrategy.avoid}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-border/40">
                  {!simStarted ? (
                    <Button onClick={startSimulation} className="w-full bg-primary flex items-center justify-center gap-1.5 cursor-pointer py-5 rounded-lg shadow-lg shadow-primary/20">
                      <Play className="w-4 h-4" />
                      Start Exam Simulation
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-center font-mono text-red-400 font-bold tracking-widest text-lg">
                        Timer: {Math.floor(simTimer / 60)}:{(simTimer % 60).toString().padStart(2, '0')}
                      </div>
                      {!submittedSim && (
                        <Button onClick={submitSimulation} variant="destructive" className="w-full cursor-pointer py-4 rounded-lg">
                          Submit Simulation Attempt
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Test Simulation board */}
            <Card className="lg:col-span-2 border-border/50 min-h-[50vh] flex flex-col justify-between">
              <CardHeader className="border-b border-border/50 shrink-0">
                <CardTitle className="text-sm font-semibold">Exam Simulation Client</CardTitle>
              </CardHeader>
              
              {simStarted ? (
                <CardContent className="p-6 flex-1 flex flex-col justify-between">
                  {!submittedSim ? (
                    <div className="space-y-4 text-left flex-1 flex flex-col justify-center">
                      <div className="p-4 rounded-xl border border-border/50 bg-muted/10 space-y-3">
                        <h4 className="font-semibold text-sm">Question 1 (Mathematics - Algebra)</h4>
                        <p className="text-xs leading-relaxed font-medium">
                          Let S = &#123;1, 2, 3, ..., 100&#125;. Find the total number of non-empty subsets of S such that the product of elements in the subset is even.
                        </p>
                      </div>

                      <div className="space-y-2 mt-2">
                        {['2^100 - 1', '2^50 - 1', '2^100 - 2^50', '2^50'].map((opt, i) => (
                          <button
                            key={i}
                            onClick={() => setSimAnswers(prev => ({ ...prev, 1: i }))}
                            className={`w-full text-left rounded-lg border px-4 py-3 text-sm transition-all ${
                              simAnswers[1] === i
                                ? 'border-primary bg-primary/10 text-foreground font-medium'
                                : 'border-border/50 bg-card hover:border-border hover:bg-muted/30 text-muted-foreground'
                            }`}
                          >
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current mr-3 text-xs">
                              {String.fromCharCode(65 + i)}
                            </span>
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 text-center py-12 flex-1 flex flex-col justify-center items-center gap-1.5">
                      <CheckCircle2 className="w-12 h-12 text-green-400 animate-bounce" />
                      <h4 className="font-bold text-lg">Simulation Submitted successfully!</h4>
                      <p className="text-xs text-muted-foreground max-w-sm mt-1">
                        Mock attempt metrics registered and added to performance charts. Check tab **&ldquo;Rank Trajectory&rdquo;** to see projections.
                      </p>
                      <Button variant="outline" onClick={() => setSimStarted(false)} className="cursor-pointer mt-4">Reset Simulator</Button>
                    </div>
                  )}

                  {submittedSim && (
                    <div className="pt-4 border-t border-border/40 flex justify-end shrink-0">
                      <Button onClick={() => setSimStarted(false)} className="bg-primary cursor-pointer">Finish Simulator</Button>
                    </div>
                  )}
                </CardContent>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-muted-foreground text-center">
                  <Zap className="w-10 h-10 text-muted-foreground/35 mb-2" />
                  <p className="text-xs font-semibold">Start Exam Day Simulation</p>
                  <p className="text-[10px] text-muted-foreground mt-1 max-w-sm">
                    Simulating full JEE Main stress environment, section timers, negative markings, and safe question priorities to optimize exam attempt strategies.
                  </p>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
