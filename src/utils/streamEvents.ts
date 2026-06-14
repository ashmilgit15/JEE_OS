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
