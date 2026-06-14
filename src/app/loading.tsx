import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 p-4" role="status" aria-live="polite">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}
