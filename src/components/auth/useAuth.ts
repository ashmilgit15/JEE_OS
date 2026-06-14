'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  type AuthUser,
  getAuthUser,
  onAuthChange,
  signInWithGoogle,
  signOut as signOutHelper,
} from '@/utils/supabase/auth';

// React binding over the Supabase auth helpers. Tracks the current user and
// keeps it in sync with auth-state changes (sign-in, sign-out, token refresh).
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getAuthUser().then(u => {
      if (active) {
        setUser(u);
        setLoading(false);
      }
    });
    const unsub = onAuthChange(u => {
      if (active) setUser(u);
    });
    return () => {
      active = false;
      unsub();
    };
  }, []);

  const signIn = useCallback(async () => {
    return signInWithGoogle();
  }, []);

  const signOut = useCallback(async () => {
    await signOutHelper();
    setUser(null);
    // Full reload so the store re-inits a fresh anonymous session cleanly.
    if (typeof window !== 'undefined') window.location.reload();
  }, []);

  // A user is "signed in" (vs anonymous) when they have a linked identity/email.
  const isSignedIn = Boolean(user && !user.isAnonymous);

  return { user, loading, isSignedIn, signIn, signOut };
}
