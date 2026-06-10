'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Plus,
  Trash2,
  Star,
  Download,
  Copy,
  CheckCheck,
  Atom,
  FlaskConical,
  Calculator,
  Sigma,
  Pin,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import katex from 'katex';
import type { FormulaCard, SubjectId } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const SUBJECT_META: Record<SubjectId, { label: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
  physics: { label: 'Physics', icon: <Atom className="size-3.5" />, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  chemistry: { label: 'Chemistry', icon: <FlaskConical className="size-3.5" />, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  mathematics: { label: 'Mathematics', icon: <Calculator className="size-3.5" />, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
};

// Starter formula packs
const STARTER_FORMULAS: Omit<FormulaCard, 'id' | 'addedAt'>[] = [
  {
    title: "Newton's Second Law",
    latex: "F = ma",
    subject: 'physics',
    chapterName: 'Laws of Motion',
    tags: ['mechanics', 'force'],
    isPinned: false,
    derivation: "From Newton's second law, the rate of change of momentum is directly proportional to the applied force:\n\n$$F \\propto \\frac{dp}{dt} = \\frac{d(mv)}{dt}$$\n\nFor constant mass $m$:\n\n$$F = m \\frac{dv}{dt} = ma$$"
  },
  {
    title: "Kinematic Equation",
    latex: "v^2 = u^2 + 2as",
    subject: 'physics',
    chapterName: 'Kinematics',
    tags: ['kinematics', 'motion'],
    isPinned: false,
    derivation: "From definition of acceleration:\n\n$$a = v \\frac{dv}{dx}$$\n\nIntegrating both sides from $x=0$ (velocity $u$) to $x=s$ (velocity $v$):\n\n$$\\int_{0}^{s} a \\, dx = \\int_{u}^{v} v \\, dv$$\n\n$$as = \\left[ \\frac{v^2}{2} \\right]_u^v = \\frac{v^2 - u^2}{2}$$\n\n$$\\Rightarrow v^2 = u^2 + 2as$$"
  },
  {
    title: "Ohm's Law",
    latex: "V = IR",
    subject: 'physics',
    chapterName: 'Current Electricity',
    tags: ['electricity'],
    isPinned: false,
    derivation: "Drift velocity of electrons is given by:\n\n$$v_d = \\frac{eE\\tau}{m} = \\frac{eV\\tau}{mL}$$\n\nCurrent is:\n\n$$I = n A e v_d = n A e \\left(\\frac{eV\\tau}{mL}\\right) = \\left(\\frac{n A e^2 \\tau}{mL}\\right) V$$\n\nLet resistance $R = \\frac{mL}{ne^2A\\tau}$:\n\n$$\\Rightarrow I = \\frac{V}{R} \\Rightarrow V = IR$$"
  },
  {
    title: "Einstein Mass-Energy",
    latex: "E = mc^2",
    subject: 'physics',
    chapterName: 'Modern Physics',
    tags: ['nuclear', 'modern'],
    isPinned: false,
    derivation: "From relativistic momentum definition:\n\n$$p = \\gamma m_0 v = \\frac{m_0 v}{\\sqrt{1 - v^2/c^2}}$$\n\nRelativistic force is $F = \\frac{dp}{dt}$. The change in kinetic energy is:\n\n$$dE_k = F \\, dx = \\frac{dp}{dt} \\, dx = v \\, dp$$\n\nIntegrating from zero velocity to $v$ yields the mass-energy equivalence relation:\n\n$$E = m c^2$$"
  },
  {
    title: "Quadratic Formula",
    latex: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}",
    subject: 'mathematics',
    chapterName: 'Quadratic Equations',
    tags: ['algebra'],
    isPinned: false,
    derivation: "Complete the square for the standard quadratic equation $ax^2 + bx + c = 0$:\n\n$$x^2 + \\frac{b}{a}x + \\frac{c}{a} = 0$$\n\n$$\\left(x + \\frac{b}{2a}\\right)^2 - \\frac{b^2}{4a^2} + \\frac{c}{a} = 0$$\n\n$$\\left(x + \\frac{b}{2a}\\right)^2 = \\frac{b^2 - 4ac}{4a^2}$$\n\n$$x + \\frac{b}{2a} = \\frac{\\pm\\sqrt{b^2 - 4ac}}{2a}$$\n\n$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$"
  },
  {
    title: "Binomial Theorem",
    latex: "(a+b)^n = \\sum_{k=0}^{n} \\binom{n}{k} a^{n-k} b^k",
    subject: 'mathematics',
    chapterName: 'Binomial Theorem',
    tags: ['algebra', 'series'],
    isPinned: false,
    derivation: "By mathematical induction:\n\nFor $n=1$: $(a+b)^1 = a + b$, which holds.\n\nAssume it holds for $n=k$:\n\n$$(a+b)^k = \\sum_{j=0}^{k} \\binom{k}{j} a^{k-j} b^j$$\n\nMultiplying both sides by $(a+b)$ and using Pascal's Identity $\\binom{k}{j-1} + \\binom{k}{j} = \\binom{k+1}{j}$ proves the case for $n=k+1$."
  },
  {
    title: "Ideal Gas Law",
    latex: "PV = nRT",
    subject: 'chemistry',
    chapterName: 'States of Matter',
    tags: ['gas laws', 'thermodynamics'],
    isPinned: false,
    derivation: "Combine Boyle's Law ($V \\propto 1/P$), Charles's Law ($V \\propto T$), and Avogadro's Law ($V \\propto n$):\n\n$$V \\propto \\frac{nT}{P}$$\n\n$$\\Rightarrow V = R \\frac{nT}{P}$$\n\n$$\\Rightarrow PV = nRT$$\n\nwhere $R$ is the universal gas constant."
  },
  {
    title: "Gibbs Free Energy",
    latex: "\\Delta G = \\Delta H - T\\Delta S",
    subject: 'chemistry',
    chapterName: 'Thermodynamics',
    tags: ['thermodynamics', 'equilibrium'],
    isPinned: false,
    derivation: "From Clausius Inequality for a system at constant temperature and pressure:\n\n$$dS_{univ} = dS_{sys} + dS_{surr} \\ge 0$$\n\nSince $dQ_{surr} = -dH_{sys}$, we have $dS_{surr} = -\\frac{dH_{sys}}{T}$:\n\n$$dS_{univ} = dS_{sys} - \\frac{dH_{sys}}{T} \\ge 0$$\n\nMultiplying by $-T$:\n\n$$dH_{sys} - T dS_{sys} \\le 0$$\n\nDefine Gibbs function $G = H - TS$:\n\n$$\\Rightarrow \\Delta G = \\Delta H - T\\Delta S$$"
  },
];

// ─── LaTeX Text Renderer ───────────────────────────────────────────────────────
function LatexText({ text, className }: { text: string; className?: string }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  const regex = /\$\$(.+?)\$\$|\$(.+?)\$/gs;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const mathContent = match[1] || match[2];
    const displayMode = !!match[1];
    let html = '';
    let success = false;
    try {
      html = katex.renderToString(mathContent, { displayMode, throwOnError: false });
      success = true;
    } catch {
      // ignore
    }
    if (success) {
      parts.push(<span key={key++} dangerouslySetInnerHTML={{ __html: html }} />);
    } else {
      parts.push(match[0]);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  if (parts.length === 0) {
    return <span className={className}>{text}</span>;
  }

  return <div className={className} style={{ whiteSpace: 'pre-wrap' }}>{parts}</div>;
}

// ─── Highlight Search Text ─────────────────────────────────────────────────────
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <span>{text}</span>;
  const regex = new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-primary/35 text-foreground rounded px-0.5 font-semibold">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
}

// ─── LaTeX Preview ─────────────────────────────────────────────────────────────
// We use katex to render the LaTeX visually, while allowing copy-on-click for the raw string.

function LaTeXDisplay({ latex, className }: { latex: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(latex).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [latex]);

  // Clean the latex string: remove leading/trailing $ or $$ if present
  let cleanLatex = latex.trim();
  if (cleanLatex.startsWith('$$') && cleanLatex.endsWith('$$')) {
    cleanLatex = cleanLatex.substring(2, cleanLatex.length - 2).trim();
  } else if (cleanLatex.startsWith('$') && cleanLatex.endsWith('$')) {
    cleanLatex = cleanLatex.substring(1, cleanLatex.length - 1).trim();
  }

  let html = '';
  try {
    html = katex.renderToString(cleanLatex, { displayMode: true, throwOnError: false });
  } catch {
    html = `<span class="text-red-400">Invalid LaTeX</span>`;
  }

  return (
    <div
      className={`group relative flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-4 py-3 cursor-pointer hover:bg-muted transition-colors ${className ?? ''}`}
      onClick={handleCopy}
      title="Click to copy raw LaTeX"
    >
      <div 
        className="flex-1 overflow-x-auto overflow-y-hidden text-center flex items-center justify-center text-primary/90"
        dangerouslySetInnerHTML={{ __html: html }} 
      />
      <span className="shrink-0 text-muted-foreground group-hover:text-foreground transition-colors p-1">
        {copied ? <CheckCheck className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
      </span>
    </div>
  );
}

// ─── Formula Card Component ────────────────────────────────────────────────────

function FormulaCardItem({ card, searchQuery }: { card: FormulaCard; searchQuery: string }) {
  const { dispatch } = useStore();
  const meta = SUBJECT_META[card.subject];
  const [showDerivation, setShowDerivation] = useState(false);

  return (
    <Card className={`border ${meta.border} bg-background/60 hover:bg-background/80 transition-colors group`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              <HighlightText text={card.title} query={searchQuery} />
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              <HighlightText text={card.chapterName} query={searchQuery} />
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
              {meta.icon}
            </span>
            <button
              onClick={() => dispatch({ type: 'TOGGLE_FORMULA_PIN', payload: card.id })}
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              <Star className={`size-3.5 ${card.isPinned ? 'fill-primary text-primary' : ''}`} />
            </button>
            <button
              onClick={() => dispatch({ type: 'DELETE_FORMULA_CARD', payload: card.id })}
              className="text-muted-foreground hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
        <LaTeXDisplay latex={card.latex} />
        {card.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {card.tags.map(tag => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                <HighlightText text={tag} query={searchQuery} />
              </span>
            ))}
          </div>
        )}

        {card.derivation && (
          <div className="mt-3 border-t border-border/30 pt-3">
            <button
              onClick={() => setShowDerivation(!showDerivation)}
              className="flex items-center justify-between w-full text-xs font-semibold text-primary/80 hover:text-primary transition-colors"
            >
              <span>{showDerivation ? 'Hide Derivation' : 'View Derivation'}</span>
              <span className={`transform transition-transform duration-200 ${showDerivation ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>
            {showDerivation && (
              <div className="mt-2 text-xs leading-relaxed text-muted-foreground bg-muted/30 rounded-lg p-3 border border-border/20 space-y-2 animate-in slide-in-from-top-1 duration-200">
                <LatexText text={card.derivation} />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Add Formula Form ──────────────────────────────────────────────────────────

function AddFormulaForm({ onClose }: { onClose: () => void }) {
  const { dispatch } = useStore();
  const [title, setTitle] = useState('');
  const [latex, setLatex] = useState('');
  const [subject, setSubject] = useState<SubjectId>('physics');
  const [chapterName, setChapterName] = useState('');
  const [tags, setTags] = useState('');
  const [derivation, setDerivation] = useState('');

  const handleSubmit = useCallback(() => {
    if (!title.trim() || !latex.trim()) return;
    const card: FormulaCard = {
      id: uuidv4(),
      title: title.trim(),
      latex: latex.trim(),
      subject,
      chapterName: chapterName.trim() || 'General',
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      isPinned: false,
      addedAt: new Date().toISOString(),
      derivation: derivation.trim() || undefined,
    };
    dispatch({ type: 'ADD_FORMULA_CARD', payload: card });
    onClose();
  }, [title, latex, subject, chapterName, tags, derivation, dispatch, onClose]);

  return (
    <Card className="border-primary/30 bg-card/80 backdrop-blur-sm mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Plus className="size-4 text-primary" />Add Formula
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(SUBJECT_META) as [SubjectId, typeof SUBJECT_META[SubjectId]][]).map(([id, meta]) => (
            <button
              key={id}
              onClick={() => setSubject(id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                subject === id ? `${meta.bg} ${meta.color} ring-1 ring-current` : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {meta.icon}{meta.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Ohm's Law"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Chapter</label>
            <input
              value={chapterName}
              onChange={e => setChapterName(e.target.value)}
              placeholder="e.g. Current Electricity"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">LaTeX Formula</label>
          <input
            value={latex}
            onChange={e => setLatex(e.target.value)}
            placeholder="e.g. V = IR"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-primary placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Derivation / Proof (LaTeX supported)</label>
          <textarea
            value={derivation}
            onChange={e => setDerivation(e.target.value)}
            rows={3}
            placeholder="e.g. Integrate F.dx from 0 to x: $$W = \int F dx = \int kx dx = \frac{1}{2}kx^2$$"
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Tags (comma-separated)</label>
          <input
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="e.g. electricity, important"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!title.trim() || !latex.trim()} className="gap-1.5 text-xs">
            <Plus className="size-3.5" />Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function FormulasPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const { state, dispatch } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [filterSubject, setFilterSubject] = useState<SubjectId | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const allFormulas = useMemo(() => state.formulaCards || [], [state.formulaCards]);

  // Seed starter formulas once if empty
  useEffect(() => {
    if (mounted && allFormulas.length === 0) {
      STARTER_FORMULAS.forEach(f => {
        dispatch({
          type: 'ADD_FORMULA_CARD',
          payload: { ...f, id: uuidv4(), addedAt: new Date().toISOString() },
        });
      });
    }
  }, [mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    let list = filterSubject === 'all' ? allFormulas : allFormulas.filter(f => f.subject === filterSubject);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(f =>
        f.title.toLowerCase().includes(q) ||
        f.chapterName.toLowerCase().includes(q) ||
        f.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [allFormulas, filterSubject, searchQuery]);

  const pinned = filtered.filter(f => f.isPinned);
  const rest = filtered.filter(f => !f.isPinned);

  const exportMarkdown = useCallback(() => {
    const lines = [
      '# JEE Formula Sheet\n',
      ...allFormulas.map(f => `## ${f.title}\n**Chapter:** ${f.chapterName}  \n\`\`\`latex\n${f.latex}\n\`\`\`\n`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jee-formula-sheet.md';
    a.click();
    URL.revokeObjectURL(url);
  }, [allFormulas]);

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
              <Sigma className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Formula Sheet</h1>
              <p className="text-sm text-muted-foreground">LaTeX cheat sheet compiler · {allFormulas.length} formulas</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportMarkdown} className="gap-1.5 text-xs">
              <Download className="size-3.5" />Export .md
            </Button>
            <Button size="sm" onClick={() => setShowForm(!showForm)} className="gap-1.5 text-xs">
              <Plus className="size-4" />{showForm ? 'Cancel' : 'Add Formula'}
            </Button>
          </div>
        </div>

        {showForm && <AddFormulaForm onClose={() => setShowForm(false)} />}

        {/* Search input */}
        <div className="mb-6">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search formulas by title, chapter, or tags..."
            className="w-full rounded-lg border border-border bg-background/60 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary backdrop-blur-sm"
          />
        </div>

        {/* Subject filter */}
        <div className="mb-6 flex gap-2 flex-wrap">
          {(['all', 'physics', 'chemistry', 'mathematics'] as const).map(s => {
            const meta = s !== 'all' ? SUBJECT_META[s] : null;
            return (
              <button
                key={s}
                onClick={() => setFilterSubject(s)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all border ${
                  filterSubject === s
                    ? s === 'all'
                      ? 'bg-primary/10 text-primary border-primary/30'
                      : `${meta!.bg} ${meta!.color} ${meta!.border}`
                    : 'text-muted-foreground border-border/40 hover:bg-muted'
                }`}
              >
                {meta ? <>{meta.icon}{meta.label}</> : 'All Subjects'}
              </button>
            );
          })}
        </div>

        <Tabs defaultValue="grid">
          <div className="mb-4 flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="grid">Grid</TabsTrigger>
              <TabsTrigger value="pinned"><Pin className="size-3.5" />Pinned ({pinned.length})</TabsTrigger>
            </TabsList>
            <p className="text-xs text-muted-foreground">{filtered.length} formula{filtered.length !== 1 ? 's' : ''}</p>
          </div>

          <TabsContent value="grid">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16">
                <Sigma className="size-10 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">No formulas yet</p>
                <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
                  <Plus className="size-3.5" />Add first formula
                </Button>
              </div>
            ) : (
              <ScrollArea className="max-h-[700px]">
                <div className="grid gap-3 sm:grid-cols-2 pr-3">
                  {[...pinned, ...rest].map(card => (
                    <FormulaCardItem key={card.id} card={card} searchQuery={searchQuery} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="pinned">
            {pinned.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16">
                <Star className="size-10 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">No pinned formulas</p>
                <p className="text-xs text-muted-foreground/70">Star any formula card to pin it here.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {pinned.map(card => <FormulaCardItem key={card.id} card={card} searchQuery={searchQuery} />)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
