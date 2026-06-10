'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Wifi,
  WifiOff,
  Send,
  User,
  Atom,
  FlaskConical,
  Calculator,
  Zap,
  Clock,
  Target,
  LogIn,
  Hash,
  MessageSquare,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import type { SubjectId } from '@/types';
import { formatDistanceToNow } from 'date-fns';

// Generate stable user ID at module level to avoid impure function call during render
const MODULE_USER_ID = `user-${Math.floor(Math.random() * 1e9).toString(36)}`;

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PeerPresence {
  userId: string;
  name: string;
  subject: SubjectId | 'break';
  topic: string;
  studyStreak: number;
  lastSeen: string;
  status: 'studying' | 'break' | 'reviewing';
}

interface ChatMessage {
  id: string;
  userId: string;
  name: string;
  text: string;
  timestamp: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const SUBJECT_META: Record<SubjectId | 'break', { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  physics: { label: 'Physics', icon: <Atom className="size-3" />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  chemistry: { label: 'Chemistry', icon: <FlaskConical className="size-3" />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  mathematics: { label: 'Mathematics', icon: <Calculator className="size-3" />, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  break: { label: 'On Break', icon: <Clock className="size-3" />, color: 'text-muted-foreground', bg: 'bg-muted' },
};

const STATUS_COLORS = {
  studying: 'bg-emerald-500',
  break: 'bg-amber-500',
  reviewing: 'bg-blue-500',
};

const STATUS_LABELS = {
  studying: 'Studying',
  break: 'On Break',
  reviewing: 'Reviewing',
};

const ROOM_ID = 'jee-os-public-study-room';

// ─── Peer Card ─────────────────────────────────────────────────────────────────

function PeerCard({ peer }: { peer: PeerPresence }) {
  const meta = SUBJECT_META[peer.subject];
  const lastSeen = (() => {
    try { return formatDistanceToNow(new Date(peer.lastSeen), { addSuffix: true }); }
    catch { return 'just now'; }
  })();

  return (
    <Card className="border-border/40 bg-background/60 hover:bg-background/80 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted text-sm font-semibold">
              {peer.name.charAt(0).toUpperCase()}
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background ${STATUS_COLORS[peer.status]}`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-semibold truncate">{peer.name}</p>
              <Badge variant="secondary" className="text-[9px] shrink-0 px-1.5">{STATUS_LABELS[peer.status]}</Badge>
            </div>
            <div className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${meta.bg} ${meta.color} mb-1`}>
              {meta.icon} {meta.label}
            </div>
            {peer.topic && (
              <p className="text-xs text-muted-foreground truncate">{peer.topic}</p>
            )}
            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><Zap className="size-2.5 text-amber-400" />{peer.studyStreak}d streak</span>
              <span>{lastSeen}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Chat Bubble ───────────────────────────────────────────────────────────────

function ChatBubble({ msg, isOwn }: { msg: ChatMessage; isOwn: boolean }) {
  const time = (() => {
    try { return formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true }); }
    catch { return ''; }
  })();

  return (
    <div className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
      <div className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
        isOwn ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
      }`}>
        {msg.name.charAt(0).toUpperCase()}
      </div>
      <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {!isOwn && <p className="text-[10px] text-muted-foreground">{msg.name}</p>}
        <div className={`rounded-2xl px-3 py-2 text-sm ${
          isOwn ? 'bg-primary/20 text-foreground rounded-tr-sm' : 'bg-muted text-foreground rounded-tl-sm'
        }`}>
          {msg.text}
        </div>
        <p className="text-[9px] text-muted-foreground/60">{time}</p>
      </div>
    </div>
  );
}

// ─── Join Form ─────────────────────────────────────────────────────────────────

function JoinForm({ onJoin }: { onJoin: (name: string, subject: SubjectId, topic: string) => void }) {
  const { state } = useStore();
  const [name, setName] = useState(state.profile.name || '');
  const [subject, setSubject] = useState<SubjectId>('physics');
  const [topic, setTopic] = useState('');

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10">
        <Users className="size-8 text-primary" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-bold">Join Study Room</h2>
        <p className="text-sm text-muted-foreground mt-1">Study with peers in real-time</p>
      </div>
      <Card className="w-full max-w-sm border-border/50">
        <CardContent className="space-y-4 pt-6">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Your Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Currently Studying</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(SUBJECT_META).filter(([k]) => k !== 'break') as [SubjectId, typeof SUBJECT_META[SubjectId]][]).map(([id, meta]) => (
                <button
                  key={id}
                  onClick={() => setSubject(id)}
                  className={`flex items-center gap-1 rounded-lg px-2 py-2 text-[11px] font-medium transition-all ${
                    subject === id ? `${meta.bg} ${meta.color} ring-1 ring-current` : 'text-muted-foreground hover:bg-muted border border-border/40'
                  }`}
                >
                  {meta.icon} {meta.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Topic (optional)</label>
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Thermodynamics"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <Button
            className="w-full gap-2"
            onClick={() => name.trim() && onJoin(name.trim(), subject, topic.trim())}
            disabled={!name.trim()}
          >
            <LogIn className="size-4" />Join Room
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function PeersPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const { state } = useStore();
  const [joined, setJoined] = useState(false);
  const [myInfo, setMyInfo] = useState<PeerPresence | null>(null);
  const [peers, setPeers] = useState<PeerPresence[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [isSupabaseAvailable, setIsSupabaseAvailable] = useState(true);

  const channelRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Store myId as state (initialized from module-level constant) to avoid ref.current access in render
  const [myId] = useState<string>(MODULE_USER_ID);
  const myIdRef = useRef<string>(MODULE_USER_ID);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleJoin = useCallback((name: string, subject: SubjectId, topic: string) => {
    const me: PeerPresence = {
      userId: myIdRef.current,
      name,
      subject,
      topic,
      studyStreak: state.streaks.currentStudy,
      lastSeen: new Date().toISOString(),
      status: 'studying',
    };
    setMyInfo(me);
    setJoined(true);

    // Attempt Supabase Realtime connection
    try {
      const supabase = createClient();
      const channel = supabase.channel(ROOM_ID, {
        config: { presence: { key: myIdRef.current } },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState<PeerPresence>();
          const allPeers = Object.values(state)
            .flat()
            .filter(p => p.userId !== myIdRef.current);
          setPeers(allPeers as PeerPresence[]);
        })
        .on('broadcast', { event: 'chat' }, ({ payload }: { payload: ChatMessage }) => {
          setMessages(prev => [...prev, payload]);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            setConnected(true);
            await channel.track(me);
          } else if (status === 'CHANNEL_ERROR') {
            setConnected(false);
            setIsSupabaseAvailable(false);
          }
        });

      channelRef.current = channel;
    } catch {
      setIsSupabaseAvailable(false);
      setConnected(false);
    }
  }, [state.streaks.currentStudy]);

  const sendMessage = useCallback(() => {
    if (!chatInput.trim() || !myInfo) return;
    const msg: ChatMessage = {
      id: `${Date.now()}-${myIdRef.current}`,
      userId: myIdRef.current,
      name: myInfo.name,
      text: chatInput.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, msg]);
    setChatInput('');
    if (channelRef.current && connected) {
      channelRef.current.send({ type: 'broadcast', event: 'chat', payload: msg });
    }
  }, [chatInput, myInfo, connected]);

  useEffect(() => {
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
              <Users className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Peer Study Rooms</h1>
              <p className="text-sm text-muted-foreground">Real-time collaborative study spaces</p>
            </div>
          </div>
          <JoinForm onJoin={handleJoin} />
        </div>
      </div>
    );
  }

  const allPeersInRoom = myInfo ? [myInfo, ...peers] : peers;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
              <Users className="size-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Study Room</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <Hash className="size-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-mono">{ROOM_ID}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 text-xs ${connected ? 'text-emerald-400' : 'text-muted-foreground'}`}>
              {connected ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
              {connected ? 'Live' : isSupabaseAvailable ? 'Connecting…' : 'Local mode'}
            </div>
            <Badge variant="secondary" className="gap-1.5">
              <User className="size-3" />{allPeersInRoom.length} in room
            </Badge>
          </div>
        </div>

        {!isSupabaseAvailable && (
          <Card className="mb-4 border-amber-500/30 bg-amber-500/5">
            <CardContent className="flex items-center gap-2 py-3 px-4">
              <WifiOff className="size-4 text-amber-400 shrink-0" />
              <p className="text-xs text-amber-300">
                Supabase Realtime not configured — running in local demo mode. Peers won&apos;t sync across devices until Supabase environment variables are set.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Left: Peer grid + chat */}
          <div className="space-y-4">
            {/* Peers */}
            <Card className="border-border/40 bg-background/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="size-4 text-primary" />
                  Active Peers ({allPeersInRoom.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {allPeersInRoom.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-4">No one else is here yet. Share the room code!</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {allPeersInRoom.map(peer => (
                      <PeerCard key={peer.userId} peer={peer} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Chat */}
            <Card className="border-border/40 bg-background/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="size-4 text-primary" />
                  Room Chat
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ScrollArea className="h-64 pr-2">
                  {messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      No messages yet. Say hi!
                    </div>
                  ) : (
                    <div className="space-y-3 p-1">
                      {messages.map(msg => (
                        <ChatBubble key={msg.id} msg={msg} isOwn={msg.userId === myId} />
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>
                <div className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder="Type a message… (Enter to send)"
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Button size="icon" onClick={sendMessage} className="shrink-0" disabled={!chatInput.trim()}>
                    <Send className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Stats panel */}
          <div className="space-y-4">
            <Card className="border-border/40 bg-background/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="size-4 text-amber-400" />Your Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {myInfo && (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {myInfo.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{myInfo.name}</p>
                        <p className="text-xs text-muted-foreground">{myInfo.topic || 'General study'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-muted/40 p-3 text-center">
                        <p className="text-xl font-bold text-amber-400">{myInfo.studyStreak}</p>
                        <p className="text-[10px] text-muted-foreground">Day streak</p>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-3 text-center">
                        <p className="text-xl font-bold text-primary">{allPeersInRoom.length}</p>
                        <p className="text-[10px] text-muted-foreground">In room</p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/40 bg-background/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground font-normal">Room Code</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-xs text-primary break-all bg-primary/5 rounded px-2 py-1.5">{ROOM_ID}</p>
                <p className="text-[10px] text-muted-foreground mt-2">Share this with friends to study together</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
