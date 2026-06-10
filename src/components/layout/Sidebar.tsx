'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BookOpen,
  Brain,
  GraduationCap,
  PenLine,
  RefreshCw,
  ClipboardCheck,
  FileText,
  BarChart3,
  CalendarDays,
  User,
  FolderOpen,
  Menu,
  Sparkles,
  ChevronLeft,
  Settings,
  Sigma,
  Users2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useStore } from '@/store';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Syllabus', href: '/syllabus', icon: BookOpen },
  { name: 'AI Coach', href: '/coach', icon: Brain },
  { name: 'AI Tutor', href: '/tutor', icon: GraduationCap },
  { name: 'Study Log', href: '/log', icon: PenLine },
  { name: 'Revisions', href: '/revisions', icon: RefreshCw },
  { name: 'Flashcards', href: '/flashcards', icon: Brain },
  { name: 'Formulas', href: '/formulas', icon: Sigma },
  { name: 'Tests', href: '/tests', icon: ClipboardCheck },
  { name: 'Mock Tests', href: '/mocks', icon: FileText },
  { name: 'Peer Rooms', href: '/peers', icon: Users2 },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Planner', href: '/planner', icon: CalendarDays },
  { name: 'Profile', href: '/profile', icon: User },
  { name: 'Resources', href: '/resources', icon: FolderOpen },
  { name: 'Advanced AI', href: '/advanced', icon: Sparkles },
  { name: 'Settings', href: '/settings', icon: Settings },
];

function SidebarContent({ collapsed, onCollapse }: { collapsed: boolean; onCollapse?: () => void }) {
  const pathname = usePathname();
  const { state, getOverdueRevisions, getPendingRevisions, getWeakTopics } = useStore();

  const badgeCounts = useMemo(() => {
    const overdue = getOverdueRevisions().length;
    const pending = getPendingRevisions().length;
    const weakTopics = getWeakTopics(5).length;
    const activeInsights = state.insights.filter(i => !i.dismissed).length;
    const activeMistakes = (state.mistakes || []).filter(m => m.status === 'pending').length;
    return {
      revisions: overdue > 0 ? overdue : pending > 0 ? pending : 0,
      coach: activeInsights,
      syllabus: weakTopics,
      tests: activeMistakes,
    };
  }, [state.insights, state.mistakes, getOverdueRevisions, getPendingRevisions, getWeakTopics]);

  const badgeMap: Record<string, number> = {
    '/revisions': badgeCounts.revisions,
    '/coach': badgeCounts.coach,
    '/syllabus': badgeCounts.syllabus,
    '/tests': badgeCounts.tests,
    '/advanced': badgeCounts.revisions + badgeCounts.coach,
  };

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight text-foreground">JEE OS</span>
            <span className="text-[10px] text-muted-foreground">AI Preparation System</span>
          </div>
        )}
      </div>
      <Separator className="opacity-50" />

      {/* Quick Log Action Button */}
      <div className="px-3 py-2 shrink-0">
        <Button
          onClick={() => window.dispatchEvent(new CustomEvent('open-quick-log'))}
          className={cn(
            "w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold flex items-center justify-center cursor-pointer shadow-md transition-all duration-200",
            collapsed ? "h-10 w-10 p-0 rounded-full mx-auto" : "h-9 rounded-lg gap-2 text-xs"
          )}
          title="Log study session (Alt + L)"
        >
          <PenLine className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Quick Log</span>}
        </Button>
      </div>

      <Separator className="opacity-30" />

      {/* Navigation */}
      <ScrollArea className="flex-1 py-3">
        <nav className="flex flex-col gap-0.5 px-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const badge = badgeMap[item.href] || 0;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
                title={collapsed ? item.name : undefined}
              >
                <div className="relative">
                  <item.icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary' : '')} />
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-500 px-[3px] text-[8px] font-bold text-white leading-none">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </div>
                {!collapsed && <span className="flex-1">{item.name}</span>}
                {badge > 0 && collapsed && (
                  <span className="absolute -top-1 -right-1 flex h-3 min-w-[12px] items-center justify-center rounded-full bg-red-500 px-[2px] text-[7px] font-bold text-white leading-none">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
                {isActive && !collapsed && badge === 0 && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Collapse button */}
      {onCollapse && (
        <div className="border-t border-border/50 p-2">
          <button
            onClick={onCollapse}
            data-testid="collapse-sidebar-btn"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex w-full items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="flex h-14 w-full items-center justify-between border-b border-border/50 bg-sidebar px-4 md:hidden shrink-0">
        <span className="text-sm font-semibold tracking-tight text-foreground">JEE OS</span>
        <Sheet>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <Menu className="h-5 w-5" />
              </Button>
            }
          />
          <SheetContent side="left" className="w-64 p-0 bg-sidebar border-r border-sidebar-border">
            <SidebarContent collapsed={false} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r border-border/50 bg-sidebar transition-all duration-200',
          collapsed ? 'w-16' : 'w-56'
        )}
      >
        <SidebarContent collapsed={collapsed} onCollapse={() => setCollapsed(!collapsed)} />
      </aside>
    </>
  );
}
