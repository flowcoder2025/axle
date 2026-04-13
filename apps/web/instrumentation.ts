export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { setupEventHandlers } = await import("./lib/events/setup");
    setupEventHandlers();
  }
}
