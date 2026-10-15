// src/utils/deepLink.ts
//
// ✅ Shared parsing + timing for livio:// links (App.tsx).
//
// Kept pure so it can be unit-tested (tests/growth). Two things the inline
// parsers got wrong: a "+" in a form-encoded value (mail clients write spaces
// that way) stayed a "+", and a value containing "=" was cut at it.

import { navigationRef } from '../navigation/navigationRef';
import { API_CONFIG } from '../constants/config';

/** Query params of a URL. '+' → space, split on the FIRST '=', bad escapes kept raw. */
export function parseQuery(url: string): Record<string, string> {
  const q = url.includes('?') ? url.slice(url.indexOf('?') + 1).split('#')[0] : '';
  const out: Record<string, string> = {};
  for (const part of q.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const rawKey = eq < 0 ? part : part.slice(0, eq);
    const rawVal = eq < 0 ? '' : part.slice(eq + 1);
    const decode = (v: string) => {
      const spaced = v.replace(/\+/g, ' ');
      try { return decodeURIComponent(spaced); } catch { return spaced; }
    };
    out[decode(rawKey)] = decode(rawVal);
  }
  return out;
}

/** Positive integer or null ("0", "abc", "-3", "" → null). */
export function positiveInt(v: string | undefined): number | null {
  if (!v || !/^\d+$/.test(v.trim())) return null;
  const n = Number(v);
  return n > 0 && Number.isSafeInteger(n) ? n : null;
}

/** livio://event?product_app_id=..&event_name=..&pov=.. */
export function parseEventLink(url: string): { product_app_id: number; event_name: string; preselect_pov_id: number | null } | null {
  const p = parseQuery(url);
  const product_app_id = positiveInt(p.product_app_id);
  if (!product_app_id) return null;
  // Any page can open this link: the name is display-only text, keep it short.
  return { product_app_id, event_name: (p.event_name ?? '').slice(0, 120), preselect_pov_id: positiveInt(p.pov) };
}

let lastLink: { url: string; at: number } | null = null;

/** True when the same URL was already handled within the last `windowMs`. */
export function isRepeatLink(url: string, windowMs = 2000): boolean {
  const now = Date.now();
  const repeat = !!lastLink && lastLink.url === url && now - lastLink.at < windowMs;
  lastLink = { url, at: now };
  return repeat;
}

/**
 * Run `fn` once the navigator is mounted. On a cold start from a link,
 * getInitialURL() resolves while App still shows its loader and AppNavigator
 * is still reading the token — a navigate() then does nothing at all.
 * 20 s: a slow cold start (old phone, token read + fonts) took longer than 10.
 */
export function whenNavigatorReady(fn: () => void, timeoutMs = 20000): void {
  if (navigationRef.isReady()) { fn(); return; }
  // Counted in polls, not wall-clock: immune to clock changes mid-wait.
  let polls = Math.ceil(timeoutMs / 100);
  const timer = setInterval(() => {
    if (navigationRef.isReady()) {
      clearInterval(timer);
      fn();
    } else if (--polls <= 0) {
      clearInterval(timer);
      // Dropped link — otherwise silent (see App.tsx's ErrorUtils note).
      if (API_CONFIG.DEBUG) console.log('⏱️ Deep link dropped: navigator not ready after', timeoutMs, 'ms');
    }
  }, 100);
}
