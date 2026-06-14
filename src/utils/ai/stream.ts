// NDJSON stream protocol for the AI chat route.
//
// The chat endpoint streams newline-delimited JSON `ChatEvent` objects to the
// client. This helper owns the two invariants that every branch of the route
// must respect:
//   1. The stream closes EXACTLY once, no matter which branch (fallback, LLM,
//      error) finishes the response.
//   2. Writing after close, or to a disconnected client, is a silent no-op
//      rather than a throw that would crash the request.
//
// Usage inside a ReadableStream `start(controller)`:
//   const writer = createNdjsonWriter(controller);
//   writer.send({ type: 'status', message: '...' });
//   writer.close();

import type { ChatEvent } from '@/types/chatEvents';

export interface NdjsonWriter {
  /** Enqueue one event as a JSON line. No-op once the stream is closed. */
  send: (event: ChatEvent) => void;
  /** Close the stream. Idempotent — safe to call from every finishing branch. */
  close: () => void;
  /** Whether the stream has already been closed. */
  readonly closed: boolean;
}

export function createNdjsonWriter(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder = new TextEncoder(),
): NdjsonWriter {
  let streamClosed = false;

  return {
    get closed() {
      return streamClosed;
    },
    close() {
      if (streamClosed) return;
      streamClosed = true;
      try { controller.close(); } catch { /* already closed by the runtime */ }
    },
    send(event: ChatEvent) {
      if (streamClosed) return;
      try {
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      } catch { /* client disconnected mid-stream */ }
    },
  };
}
