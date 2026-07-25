import { NextResponse } from 'next/server';
import { isSseEnabled } from '../../../../lib/realtimeConfig';
import { subscribeAdminEvents } from '../../../../lib/adminEvents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SSE stream — only when NEXT_PUBLIC_ENABLE_SSE=true (VPS).
 * On Hostinger Business this returns 204 so clients never hang on a stream.
 */
export async function GET(req) {
  if (!isSseEnabled()) {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Cache-Control': 'no-store',
        'X-SSE-Enabled': '0'
      }
    });
  }

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
      'X-Accel-Buffering': 'no',
      'X-SSE-Enabled': '1'
    }
  });
}
