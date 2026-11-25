import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

export const createClient = async (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Local-only mode: when Supabase is not configured there is no session to
  // refresh. Bypass auth work entirely instead of constructing an invalid
  // client, which throws and turns every route into a 500.
  if (!env.supabaseConfigured) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    env.supabaseUrl,
    env.supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    },
  );

  // Refresh session / validate auth. The app signs users in anonymously on the
  // client, so an invalid session is not a hard failure here — but it should be
  // visible in logs instead of silently producing confusing RLS errors later.
  const { error } = await supabase.auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError') {
    console.warn('Session refresh failed in proxy:', error.message);
  }

  return supabaseResponse
};
