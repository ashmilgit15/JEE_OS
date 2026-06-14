'use client';

import { useState } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { LogIn, LogOut, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from './useAuth';
import { AuthModal } from './AuthModal';

function initials(name: string | null, email: string | null): string {
  const src = name || email || '';
  const parts = src.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (src.slice(0, 2) || '?').toUpperCase();
}

// Account footer for the sidebar: shows the signed-in Google user's avatar /
// name / email with a sign-out control, or a "Sign in" button that opens the
// AuthModal for anonymous users.
export function SidebarAccount({ collapsed }: { collapsed: boolean }) {
  const { user, loading, isSignedIn, signOut } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  if (loading) {
    return (
      <div className={cn('border-t border-border/50 p-2', collapsed && 'flex justify-center')}>
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="border-t border-border/50 p-2">
        <Button
          variant="ghost"
          onClick={() => setModalOpen(true)}
          title="Sign in to save your progress"
          className={cn(
            'text-muted-foreground hover:text-foreground',
            collapsed ? 'h-10 w-10 p-0 rounded-full mx-auto' : 'w-full justify-start gap-2 text-xs',
          )}
        >
          <LogIn className="size-4" aria-hidden="true" />
          {!collapsed && <span>Sign in</span>}
        </Button>
        <AuthModal open={modalOpen} onOpenChange={setModalOpen} />
      </div>
    );
  }

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  return (
    <div className="border-t border-border/50 p-2">
      <div className={cn('flex items-center gap-2', collapsed && 'justify-center')}>
        <Avatar className="size-8 shrink-0">
          {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user?.name ?? 'User'} />}
          <AvatarFallback className="text-[10px]">{initials(user?.name ?? null, user?.email ?? null)}</AvatarFallback>
        </Avatar>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">{user?.name ?? 'Signed in'}</p>
            {user?.email && <p className="truncate text-[10px] text-muted-foreground">{user.email}</p>}
          </div>
        )}
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleSignOut}
            disabled={signingOut}
            title="Sign out"
            aria-label="Sign out"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            {signingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" aria-hidden="true" />}
          </Button>
        )}
      </div>
    </div>
  );
}
