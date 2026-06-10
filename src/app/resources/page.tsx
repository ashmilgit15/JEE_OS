'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '@/store';
import { useRouter, usePathname } from 'next/navigation';
import { handleStoreAction } from '@/utils/handleStoreAction';
import { getDeviceId, getContextSummaryFromState, formatContextSummary } from '@/utils/supabase/conversations';
import { getDOMSummary } from '@/utils/domSummarizer';
import { MemoryStore } from '@/utils/ai/memory';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FolderOpen,
  FileText,
  BookOpen,
  Calculator,
  Search,
  File,
  Plus,
  Send,
  Sparkles,
  User,
  Brain,
  ExternalLink,
  Trash2,
  Download,
} from 'lucide-react';
const typeIcons: Record<string, React.ElementType> = {
  pdf: FileText,
  notes: BookOpen,
  formula_sheet: Calculator,
  dpp: File,
  reference: BookOpen,
};

const typeLabels: Record<string, string> = {
  pdf: 'PDF',
  notes: 'Notes',
  formula_sheet: 'Formula Sheet',
  dpp: 'DPP',
  reference: 'Reference',
};

const subjectColors: Record<string, string> = {
  physics: '#6366f1',
  chemistry: '#22c55e',
  mathematics: '#f59e0b',
  general: '#8b5cf6',
};

export default function ResourcesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { state, dispatch, getTopicById, completeTopicWithRevisions, logStudy, generateDailyPlan } = useStore();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [pageViewTab, setPageViewTab] = useState('library');

  const resources = state.resources;

  const [messages, setMessages] = useState<any[]>([
    {
      id: 'res-1',
      role: 'assistant',
      content: `Hello! I'm your Resource AI Assistant. 📚

I can search the web for textbooks, reference books, and study materials using Tavily search. Just tell me what you need!

Try asking:
- *"I need HC Verma Physics PDF"*
- *"Find DC Pandey Electricity PDF"*
- *"Search for Organic Chemistry by OP Tandon"*
- *"Get me NCERT Maths Class 12 PDF"*`,
      timestamp: new Date(),
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    const text = chatInput.trim();
    if (!text) return;

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsTyping(true);

    try {
      const systemPrompt = `You are the Resource Assistant for JEE OS. You help students find, download, and manage study materials.

Capabilities:
1. Search for textbooks and resources using the built-in textbook search tool. When a student asks for a specific book, the tool automatically searches the web.
2. When resources are found, they are sent as resource_result events and automatically added to the Material Library.
3. You can reference the student's current resources if they ask about them.`;

      const chatHistory = messages
        .filter(m => m.id !== 'res-1')
        .map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content
        }));
      chatHistory.push({ role: 'user', content: text });

      const deviceId = getDeviceId();
      const contextSummaryState = getContextSummaryFromState(state, pathname);
      const contextSummary = formatContextSummary(contextSummaryState);
      const pageContent = getDOMSummary(pathname);
      const memory = new MemoryStore(deviceId);
      const memoryContext = await memory.getContextString(text, 8);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: chatHistory,
          systemPrompt,
          deviceId,
          agentType: 'resource',
          contextSummary,
          pageContent,
          memoryContext,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('API request failed');
      }

      const resMsgId = `res-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: resMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date()
      }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantText = '';
      let hasReceivedContent = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (assistantText) {
            setMessages(prev => prev.map(m => m.id === resMsgId ? { ...m, content: assistantText } : m));
          } else if (!hasReceivedContent) {
            setMessages(prev => prev.map(m => m.id === resMsgId ? { ...m, content: 'I searched but could not find any resources matching your request. Try being more specific (e.g., include the author name or "PDF").' } : m));
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === 'text') {
              assistantText += event.content;
              hasReceivedContent = true;
              setIsTyping(false);
              setMessages(prev => prev.map(m => m.id === resMsgId ? { ...m, content: assistantText } : m));
            }
            if (event.type === 'status') {
              setIsTyping(true);
              setMessages(prev => prev.map(m => m.id === resMsgId ? { ...m, content: event.message } : m));
            }
            if (event.type === 'resource_result' && event.payload) {
              dispatch({ type: 'ADD_RESOURCE', payload: event.payload });
            }
            if (event.type === 'remember') {
              try {
                const memStore = new MemoryStore(deviceId);
                await memStore.add(event.observation, 'observation', 'ai_tutor', event.tags || []);
              } catch (e) {
                console.warn('Failed to save remember event to client MemoryStore:', e);
              }
            }
            if (event.type === 'client_action') {
              handleStoreAction(event.action, event.args, { dispatch, getTopicById, completeTopicWithRevisions, logStudy, state, generateDailyPlan, router });
              const actionDesc = event.args.topicName
                ? `✅ **${event.args.topicName}** marked as **${event.args.status}** in your syllabus tracker!`
                : `✅ Action completed: ${event.action}`;
              assistantText += `\n\n${actionDesc}`;
              hasReceivedContent = true;
              setIsTyping(false);
              setMessages(prev => prev.map(m => m.id === resMsgId ? { ...m, content: assistantText } : m));
            }
            if (event.type === 'error') {
              hasReceivedContent = true;
              setIsTyping(false);
              setMessages(prev => prev.map(m => m.id === resMsgId ? { ...m, content: `Error: ${event.message}. Please try again.` } : m));
            }
          } catch {
            // Ignore malformed lines
          }
        }
      }
      setIsTyping(false);

      // Run Hermes reflection synchronously
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
              await memStore.add(reflectData.userPersonaInsight, 'preference', 'ai_tutor', ['hermes', 'persona'], 0.85);
            }
            if (Array.isArray(reflectData.adaptationNotes)) {
              for (const note of reflectData.adaptationNotes) {
                if (note.length > 10) {
                  await memStore.add(note, 'observation', 'ai_tutor', ['hermes', 'adaptation'], 0.7);
                }
              }
            }
          }
        } catch (reflectErr) {
          console.warn('Hermes reflection call failed:', reflectErr);
        }
      }
    } catch (err) {
      console.warn('Resource AI assistant error:', err);
      setMessages(prev => [...prev, {
        id: `res-err-${Date.now()}`,
        role: 'assistant',
        content: `I couldn't reach the search service right now. Please check your internet connection or configure the API key.`,
        timestamp: new Date()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const filtered = resources.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === 'all' || r.subject === activeTab || r.type === activeTab;
    return matchesSearch && matchesTab;
  });

  const stats = {
    total: resources.length,
    pdfs: resources.filter(r => r.type === 'pdf').length,
    notes: resources.filter(r => r.type === 'notes').length,
    formulas: resources.filter(r => r.type === 'formula_sheet').length,
    dpps: resources.filter(r => r.type === 'dpp').length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
            <FolderOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Resources</h1>
            <p className="text-xs text-muted-foreground">Study materials, notes, and formula sheets</p>
          </div>
        </div>
      </div>

      <Tabs value={pageViewTab} onValueChange={setPageViewTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-6 bg-muted/30 p-1 rounded-lg">
          <TabsTrigger value="library">Material Library</TabsTrigger>
          <TabsTrigger value="ai-query" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Resource AI Assistant
          </TabsTrigger>
        </TabsList>

        {/* Material Library Tab */}
        <TabsContent value="library" className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Card className="bg-card border-border/50">
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold">{stats.total}</p>
                <p className="text-[10px] text-muted-foreground">Total</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50">
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-blue-400">{stats.pdfs}</p>
                <p className="text-[10px] text-muted-foreground">PDFs</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50">
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-green-400">{stats.notes}</p>
                <p className="text-[10px] text-muted-foreground">Notes</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50">
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-amber-400">{stats.formulas}</p>
                <p className="text-[10px] text-muted-foreground">Formulas</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border/50">
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-purple-400">{stats.dpps}</p>
                <p className="text-[10px] text-muted-foreground">DPPs</p>
              </CardContent>
            </Card>
          </div>

          {/* Search & Filter */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search resources..."
                className="pl-9 bg-card border-border/50"
              />
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-muted/30">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="physics">Physics</TabsTrigger>
              <TabsTrigger value="chemistry">Chemistry</TabsTrigger>
              <TabsTrigger value="mathematics">Math</TabsTrigger>
              <TabsTrigger value="formula_sheet">Formulas</TabsTrigger>
              <TabsTrigger value="dpp">DPPs</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map(resource => {
                  const Icon = typeIcons[resource.type] || File;
                  const hasUrl = !!resource.url;
                  return (
                    <Card key={resource.id} className="bg-card border-border/50 hover:border-border transition-colors group">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                            style={{ backgroundColor: `${subjectColors[resource.subject]}15` }}
                          >
                            <Icon className="h-5 w-5" style={{ color: subjectColors[resource.subject] }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="text-sm font-medium truncate">{resource.name}</h3>
                              <button
                                onClick={() => dispatch({ type: 'REMOVE_RESOURCE', payload: resource.id })}
                                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-500/10"
                                title="Remove resource"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-red-400" />
                              </button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{resource.description}</p>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Badge variant="outline" className="text-[10px]">{typeLabels[resource.type] || resource.type}</Badge>
                              <Badge variant="outline" className="text-[10px] capitalize" style={{ borderColor: subjectColors[resource.subject], color: subjectColors[resource.subject] }}>
                                {resource.subject}
                              </Badge>
                              {resource.size && <span className="text-[10px] text-muted-foreground">{resource.size}</span>}
                            </div>
                            {hasUrl && (
                              <div className="mt-2 flex gap-2">
                                <a
                                  href={resource.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors"
                                >
                                  <Download className="h-3 w-3" />
                                  Download
                                </a>
                                <a
                                  href={resource.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Open
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <FolderOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No resources found</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Try asking the AI assistant to search for textbooks</p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Upload Prompt - only shown when no resources exist */}
          {resources.length === 0 && (
            <Card className="bg-card border-border/50 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/30 mb-3">
                  <Plus className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-medium mb-1">Add Study Resources</h3>
                <p className="text-xs text-muted-foreground text-center max-w-sm mb-3">
                  Use the AI Resource Assistant to search and add textbooks automatically, or upload your own files.
                </p>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setPageViewTab('ai-query')}>
                  <Sparkles className="h-3.5 w-3.5" />
                  Search with AI
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* AI Resource Assistant Tab */}
        <TabsContent value="ai-query">
          <Card className="bg-card border-border/50 flex flex-col h-[580px]">
            <CardHeader className="border-b border-border/50 pb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-medium text-foreground">Search & Add Textbooks</CardTitle>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                Ask me to find any textbook or reference book. I&apos;ll search the web and add it to your library automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col overflow-hidden p-0 bg-card">
              {/* Messages scroll area */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {message.role !== 'user' && (
                      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <Brain className="h-3.5 w-3.5" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/30 border border-border/50 text-foreground'
                      }`}
                    >
                      <div className="prose prose-invert prose-sm max-w-none [&>h2]:text-sm [&>h2]:font-semibold [&>h2]:mt-2 [&>h2]:mb-1 [&>h3]:text-xs [&>h3]:font-semibold [&>h3]:mt-2 [&>h3]:mb-1 [&>ul]:my-1 [&>ol]:my-1 [&>p]:my-1">
                        {message.content.split('\n').map((line: string, i: number) => {
                          if (line.startsWith('## ')) return <h2 key={i}>{line.replace('## ', '')}</h2>;
                          if (line.startsWith('### ')) return <h3 key={i}>{line.replace('### ', '')}</h3>;
                          if (line.startsWith('- **')) {
                            const match = line.match(/^- \*\*(.+?)\*\*(.*)$/);
                            if (match) return <p key={i}>• <strong>{match[1]}</strong>{match[2]}</p>;
                          }
                          if (line.startsWith('- ')) return <p key={i}>• {line.replace('- ', '')}</p>;
                          if (line.startsWith('1. ') || line.startsWith('2. ') || line.startsWith('3. ') || line.startsWith('4. ')) {
                            const match = line.match(/^(\d+)\. \*\*(.+?)\*\*(.*)$/);
                            if (match) return <p key={i}>{match[1]}. <strong>{match[2]}</strong>{match[3]}</p>;
                            return <p key={i}>{line}</p>;
                          }
                          if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
                            return <p key={i} className="italic text-muted-foreground">{line.replace(/^\*|\*$/g, '')}</p>;
                          }
                          if (line === '') return <br key={i} />;
                          return <p key={i}>{line}</p>;
                        })}
                      </div>
                    </div>
                    {message.role === 'user' && (
                      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <User className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </div>
                ))}

                {isTyping && (
                  <div className="flex gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                      <Brain className="h-3.5 w-3.5" />
                    </div>
                    <div className="rounded-xl bg-muted/30 border border-border/50 px-4 py-3">
                      <div className="flex gap-1">
                        <div className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: '0ms' }} />
                        <div className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: '150ms' }} />
                        <div className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div className="border-t border-border/50 p-4 bg-[#0a0a0f] rounded-b-xl">
                <div className="flex items-center gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder='e.g. "I need HC Verma Physics PDF" or "Find DC Pandey Electricity"'
                    className="flex-1 bg-muted/30 border-border/50 text-foreground"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!chatInput.trim() || isTyping}
                    className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/95"
                    size="icon"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Resources count indicator */}
      {resources.length > 0 && (
        <p className="text-[10px] text-muted-foreground text-center">
          {resources.length} resource{resources.length !== 1 ? 's' : ''} in your library
          {resources.filter(r => r.url).length > 0 && ` • ${resources.filter(r => r.url).length} with download links`}
        </p>
      )}
    </div>
  );
}
