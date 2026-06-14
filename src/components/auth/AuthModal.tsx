'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { signInWithGoogle } from '@/utils/supabase/auth';
import { Loader2 } from 'lucide-react';

// Google-mark SVG (official multi-color glyph). Inline so it works under the
// app's CSP without an external <img> fetch.
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    const { error } = await signInWithGoogle();
    // On success the browser redirects to Google, so we only reach here on error.
    if (error) {
      setError(error);
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Save your progress</DialogTitle>
          <DialogDescription>
            Sign in with Google to back up your study data to the cloud and access
            it from any device. Your current progress will be carried over.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex flex-col gap-3">
          <Button
            variant="outline"
            className="w-full justify-center gap-2"
            onClick={handleGoogle}
            disabled={loading}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <GoogleIcon />}
            {loading ? 'Redirecting…' : 'Continue with Google'}
          </Button>

          {error && (
            <p className="text-xs text-destructive text-center">{error}</p>
          )}

          <p className="text-[11px] text-muted-foreground text-center">
            We only use your Google account to identify you. We never post or read
            anything on your behalf.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
