import { Loader2 } from 'lucide-react';

/** Shared loading fallback used by per-route loading.tsx files. */
export function RouteLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
