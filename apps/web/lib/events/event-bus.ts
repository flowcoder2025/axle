/**
 * TypedEventEmitter — in-process event bus with full type safety (WI-054)
 *
 * All 14 business events are declared in EventMap. Callers receive typed
 * payloads when subscribing, and type errors at the emit call-site when the
 * wrong shape is passed.
 */

// ── Event payload types ───────────────────────────────────────────────────────

export type EventMap = {
  DOC_UPLOADED: {
    documentId: string;
    clientId: string;
    uploaderId: string;
    /** Optional: project assignee to notify instead of the uploader. */
    assigneeId?: string;
  };
  DOC_REQUESTED: {
    checklistItemId: string;
    clientId: string;
  };
  DOC_EXPIRING: {
    documentId: string;
    clientId: string;
    expiresAt: Date;
  };
  DEADLINE_APPROACHING: {
    projectId: string;
    deadlineAt: Date;
    assigneeIds: string[];
  };
  MEETING_SCHEDULED: {
    meetingId: string;
    projectId: string;
    attendeeIds: string[];
    scheduledAt: Date;
  };
  JOURNAL_DUE: {
    journalId: string;
    clientId: string;
    dueAt: Date;
  };
  ACTION_ITEM_CREATED: {
    actionItemId: string;
    projectId: string;
    assigneeId: string;
  };
  ACTION_ITEM_DUE: {
    actionItemId: string;
    projectId: string;
    assigneeId: string;
    dueAt: Date;
  };
  PROJECT_ASSIGNED: {
    projectId: string;
    userId: string;
  };
  MATCHING_RESULT: {
    matchingId: string;
    assigneeId: string;
    score: number;
  };
  AI_JOB_COMPLETE: {
    jobId: string;
    jobType: string;
    assigneeId: string;
    resultUrl?: string;
  };
  AI_JOB_FAILED: {
    jobId: string;
    jobType: string;
    assigneeId: string;
    errorMessage: string;
  };
  PORTAL_COMPLETE: {
    portalId: string;
    clientId: string;
    assigneeId: string;
  };
  HANDOFF: {
    projectId: string;
    fromUserId: string;
    toUserId: string;
  };
};

export type BusinessEventKey = keyof EventMap;

// ── TypedEventEmitter ─────────────────────────────────────────────────────────

type Handler<T> = (payload: T) => void | Promise<void>;

export class TypedEventEmitter {
  private readonly listeners = new Map<string, Set<Handler<unknown>>>();

  /**
   * Subscribe to an event. The handler receives a fully-typed payload.
   */
  on<K extends BusinessEventKey>(
    event: K,
    handler: Handler<EventMap[K]>
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as Handler<unknown>);
  }

  /**
   * Unsubscribe a previously registered handler.
   */
  off<K extends BusinessEventKey>(
    event: K,
    handler: Handler<EventMap[K]>
  ): void {
    this.listeners.get(event)?.delete(handler as Handler<unknown>);
  }

  /**
   * Emit an event. All registered handlers are called in registration order.
   * Async handlers are awaited sequentially; errors are caught and logged
   * so that one failing handler never blocks the rest.
   */
  async emit<K extends BusinessEventKey>(
    event: K,
    payload: EventMap[K]
  ): Promise<void> {
    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) return;

    for (const handler of handlers) {
      try {
        await (handler as Handler<EventMap[K]>)(payload);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.error(`[event-bus] handler error for event=${event}: ${reason}`);
      }
    }
  }

  /**
   * Remove all handlers for a given event (or all events when called without args).
   * Primarily useful in tests.
   */
  removeAllListeners(event?: BusinessEventKey): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

/** Singleton event bus shared across the web app. */
export const eventBus = new TypedEventEmitter();
