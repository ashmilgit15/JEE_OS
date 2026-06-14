// ──────────────────────────────────────────────────────────────────────────
// Chat stream event protocol
// ──────────────────────────────────────────────────────────────────────────
//
// The /api/chat route streams newline-delimited JSON events. This discriminated
// union is the single contract for those events, shared by the server emitter
// and the client parsers (tutor/coach/copilot). It turns a stray `type: 'tex'`
// from a runtime mystery into a compile-time error.

export interface DynamicQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  topicId: string;
  chapterId: string;
  subject: string;
  difficulty: string;
  type: string;
  source: string;
}

export type ChatEvent =
  | { type: 'text'; content: string }
  | { type: 'status'; message: string }
  | { type: 'step_start'; step: string }
  | { type: 'step_end'; step: string; result?: unknown }
  | { type: 'tool_start'; id: string; name: string }
  | { type: 'tool_end'; id: string; name: string; result?: unknown; error?: boolean }
  | { type: 'resource_result'; payload: unknown }
  | { type: 'remember'; observation: string; tags: string[] }
  | { type: 'dynamic_questions'; questions: DynamicQuestion[]; title: string; subject: string; source: string }
  | { type: 'client_action'; action: string; args: Record<string, unknown> }
  | { type: 'error'; message: string };

export type ChatEventType = ChatEvent['type'];
