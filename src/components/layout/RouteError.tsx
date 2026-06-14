'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { reportError } from '@/lib/observability';

/**
 * Shared error-boundary UI used by per-route error.tsx files. Keeps the markup
 * and reporting in one place so each route boundary is a one-line wrapper.
 */
export function RouteError({
  error,
  reset,
  area,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  area: string;
}) {
  useEffect(() => {
    reportError(error, { scope: 'route-boundary', tags: { area, digest: error.digest } });
  }, [error, area]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        An unexpected error occurred on the {area} page. Your study data is saved
        locally and is not affected.
      </p>
      <Button onClick={reset} className="mt-2">Try again</Button>
    </div>
  );
}
