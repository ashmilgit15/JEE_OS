'use client';

import { createClient } from './client';
import type { User } from '@supabase/supabase-js';

// Google OAuth + session helpers for the browser.
//
// Migration strategy: the app signs users in anonymously on first load. When an
// anonymous user signs in with Google we call `linkIdentity`, which upgrades the
// SAME user account in place — the user id is preserved, so every existing row
// (study logs, revisions, tests, mistakes, profile) keeps its owner and no data
// movement is needed. If linking is unavailable (e.g. the Google account is
// already attached to another user), we fall back to a full `signInWithOAuth`;
// the store's existing local→server sync then re-populates the new account from
// localStorage on the next state change.

const DEVICE_ID_KEY = 'jee-os-device-id';

let supabaseClient: ReturnType<typeof createClient> | null = null;
function getClient() {
  if (!supabaseClient) supabaseClient = createClient();
  return supabaseClient;
}

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  isAnonymous: boolean;
}

export function toAuthUser(user: User | null): AuthUser | null {
  if (!user) return null;
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    email: user.email ?? null,
    name: (meta.full_name as string) ?? (meta.name as string) ?? null,
    avatarUrl: (meta.avatar_url as string) ?? (meta.picture as string) ?? null,
    // Supabase marks anonymous sessions with is_anonymous; treat "no email and
    // no linked identities" as anonymous too for older sessions.
    isAnonymous: Boolean((user as User & { is_anonymous?: boolean }).is_anonymous)
      || (!user.email && (user.identities?.length ?? 0) === 0),
  };
}

export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const { data } = await getClient().auth.getUser();
    return toAuthUser(data.user ?? null);
  } catch {
    return null;
  }
}

// Subscribe to auth changes. Returns an unsubscribe function.
export function onAuthChange(cb: (user: AuthUser | null) => void): () => void {
  const { data } = getClient().auth.onAuthStateChange((_event, session) => {
    cb(toAuthUser(session?.user ?? null));
  });
  return () => data.subscription.unsubscribe();
}

// Kick off Google sign-in. Triggers a browser redirect to Google and back to
// /auth/callback. Resolves with an error message only if the request could not
// be initiated (the happy path navigates away before resolving).
export async function signInWithGoogle(): Promise<{ error?: string }> {
  const supabase = getClient();
  const redirectTo = `${window.location.origin}/auth/callback`;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const isAnon = Boolean((session?.user as (User & { is_anonymous?: boolean }) | undefined)?.is_anonymous);

    if (isAnon) {
      // Upgrade the anonymous account in place — preserves user id + all data.
      const { error } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: { redirectTo },
      });
      if (!error) return {};
      // Linking disabled or identity already in use — fall back to full OAuth.
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) return { error: error.message };
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Sign-in failed' };
  }
}

// Sign out and clear the cached device id so the next load starts a fresh
// anonymous session rather than reusing the signed-out user's id.
export async function signOut(): Promise<void> {
  try {
    await getClient().auth.signOut();
  } finally {
    try { localStorage.removeItem(DEVICE_ID_KEY); } catch { /* SSR / storage disabled */ }
  }
}
