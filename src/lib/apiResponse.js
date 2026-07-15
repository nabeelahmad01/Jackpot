import { NextResponse } from 'next/server';

export function jsonOk(body, { cacheSeconds = 0, status = 200 } = {}) {
  const headers = {};
  if (cacheSeconds > 0) {
    headers['Cache-Control'] = `private, max-age=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`;
  }
  return NextResponse.json(body, { status, headers });
}
