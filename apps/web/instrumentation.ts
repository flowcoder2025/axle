import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    const { setupEventHandlers } = await import("./lib/events/setup");
    setupEventHandlers();
    const { registerAnalyticsSubscriber } = await import("./lib/analytics/event-bus-subscriber");
    registerAnalyticsSubscriber();
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
