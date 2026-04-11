import { NextRequest } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { notificationEmitter } from "@/lib/notification-emitter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const userId = user.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(": heartbeat\n\n"));

      const onNotify = () => {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "NEW_NOTIFICATION" })}\n\n`
            )
          );
        } catch {
          /* stream closed */
        }
      };

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30_000);

      notificationEmitter.on(`notify:${userId}`, onNotify);

      req.signal.addEventListener("abort", () => {
        notificationEmitter.off(`notify:${userId}`, onNotify);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
