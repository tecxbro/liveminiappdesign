/** Integration-facing data contract. The HTTP boundary also performs runtime validation. */
export type Template = 'dots' | 'segments' | 'stages';
export type Status = 'queued' | 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled';
export interface Content {
  template: Template;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  status: Status;
  header?: 'none' | 'study' | 'hands';
  stages: Array<{ id: string; label: string; state: 'pending' | 'active' | 'done' | 'blocked' }>;
  detail: { title: string; subtitle?: string };
  progress?: { completed: number; total: number; unit: string } | null;
}
export interface CreateRequest { requestId: string; taskId: string; conversationRef: string; content: Content; }
export interface UpdateRequest { requestId: string; expectedRevision: number; content: Content; }
export interface CardRecord {
  id: string; slot: string; taskId: string; conversationRef: string; revision: number;
  createdAt: string; updatedAt: string; archivedAt: string | null; content: Content; viewUrl: string;
  delivery: { messageRef: string | null; presentedRevision: number; lastAttempt: object | null };
  activeAttempt: { id: string; revision: number; kind: 'send' | 'update'; state: 'in_flight' | 'unknown' } | null;
}
export interface OriginalTargetStore<Message, Space> {
  get(id: string): Promise<{ message: Message; space: Space } | null>;
  set(id: string, value: { message: Message; space: Space }): Promise<void>;
}
