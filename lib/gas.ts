import type { GasResponse } from './types';

/**
 * Server-side fetch of the GAS web app. Called from an API route so the
 * browser never contacts script.google.com directly (avoids CORS pain and
 * hides the URL from the client bundle).
 *
 * Uses `cache: 'no-store'` so every request bypasses Vercel's Data Cache —
 * data should always reflect the latest sheet state. The dashboard auto-
 * refreshes every 2 min and only ~1 person watches at a time, so hitting
 * GAS directly on each call is fine.
 */
export async function fetchTickets(): Promise<GasResponse> {
  const url = process.env.GAS_WEBAPP_URL;
  if (!url) {
    return { ok: false, error: 'GAS_WEBAPP_URL not configured' };
  }
  const token = process.env.GAS_SHARED_TOKEN;
  const full = token ? `${url}?token=${encodeURIComponent(token)}` : url;
  try {
    const res = await fetch(full, { cache: 'no-store' });
    if (!res.ok) {
      return { ok: false, error: `GAS HTTP ${res.status}` };
    }
    const data = (await res.json()) as GasResponse;
    return data;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
