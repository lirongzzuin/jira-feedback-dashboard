import { NextResponse } from 'next/server';
import { fetchTickets } from '@/lib/gas';

// Always re-run on every request — no Next.js runtime cache, no ISR.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const data = await fetchTickets();
  return NextResponse.json(data, {
    headers: {
      // Tell Vercel Edge + browser NOT to cache this response.
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'CDN-Cache-Control': 'no-store',
      'Vercel-CDN-Cache-Control': 'no-store',
    },
  });
}
