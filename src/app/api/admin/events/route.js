import { subscribeAdminEvents } from '../../../../lib/adminEvents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Server-Sent Events stream for instant admin/distributor UI refresh.
 */
export async function GET(req) {
  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let heartbeat = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (obj) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          cleanup();
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        try {
          unsubscribe();
        } catch {
          /* ignore */
        }
        if (heartbeat) {
          clearInterval(heartbeat);
          heartbeat = null;
        }
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      };

      send({ type: 'connected', ts: Date.now() });

      unsubscribe = subscribeAdminEvents((event) => {
        send(event);
      });

      heartbeat = setInterval(() => {
        send({ type: 'ping', ts: Date.now() });
      }, 15000);

      req.signal?.addEventListener?.('abort', cleanup);
    },
    cancel() {
      closed = true;
      try {
        unsubscribe();
      } catch {
        /* ignore */
      }
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
}
