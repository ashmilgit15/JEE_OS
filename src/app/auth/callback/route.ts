import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';

// OAuth callback — exchanges the authorization code (PKCE flow) for a session
// and writes the session cookies, then redirects back into the app. Both the
// Google sign-in and the anonymous→Google account-link flows land here.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Code missing or exchange failed — surface a flag the UI can react to.
  return NextResponse.redirect(`${origin}/?auth_error=1`);
}
