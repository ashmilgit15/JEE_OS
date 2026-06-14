// Parse one NDJSON line from the /api/chat stream into event objects.
// Handles the common case (one JSON object per line) plus malformed lines
// where multiple objects got concatenated, via brace counting.
// Shared by the tutor page, coach page and FloatingAICopilot.
export function parseStreamEvents(line: string): any[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  try {
    return [JSON.parse(trimmed)];
  } catch {
    // Attempt to extract multiple JSON objects using brace counting
    try {
      const objects: any[] = [];
      let braceCount = 0;
      let startIdx = -1;

      for (let i = 0; i < trimmed.length; i++) {
        if (trimmed[i] === '{') {
          if (braceCount === 0) startIdx = i;
          braceCount++;
        } else if (trimmed[i] === '}') {
          braceCount--;
          if (braceCount === 0 && startIdx !== -1) {
            const potentialJSON = trimmed.substring(startIdx, i + 1);
            try {
              objects.push(JSON.parse(potentialJSON));
            } catch {
              // Ignore invalid sub-blocks
            }
            startIdx = -1;
          }
        }
      }

      return objects;
    } catch {
      return [];
    }
  }
}

// Read an /api/chat NDJSON response stream to completion, invoking `onEvent` for
// every parsed event. Owns the transport boilerplate that was previously copy-
// pasted byte-for-byte across the tutor page, coach page and FloatingAICopilot:
// the reader, the UTF-8 decoder, line buffering across chunk boundaries, and the
// per-line parse. Each caller keeps its own event-handling switch in `onEvent`
// (their message shapes differ); `onEvent` may be async — it is awaited so
// handlers that persist memory/resources complete in order.
export async function readChatStream(
  response: Response,
  onEvent: (event: any) => void | Promise<void>,
): Promise<void> {
  if (!response.ok || !response.body) {
    throw new Error('Chat completions request failed or returned empty body.');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // keep the trailing (possibly partial) segment

    for (const line of lines) {
      for (const event of parseStreamEvents(line)) {
        await onEvent(event);
      }
    }
  }

  // Flush any final line the server didn't terminate with a newline. With the
  // current protocol (every event ends in '\n') this is a no-op, but it makes
  // the reader robust to an unterminated trailing event.
  if (buffer.trim()) {
    for (const event of parseStreamEvents(buffer)) {
      await onEvent(event);
    }
  }
}
