// src/utils/deepLink.ts
//
// ✅ Shared parsing + timing for livio:// links (App.tsx).
//
// Kept pure so it can be unit-tested (tests/growth). Two things the inline
// parsers got wrong: a "+" in a form-encoded value (mail clients write spaces
// that way) stayed a "+", and a value containing "=" was cut at it.

import { navigationRef } from '../navigation/navigationRef';

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
  return n > 0 ? n : null;
}

/** livio://event?product_app_id=..&event_name=..&pov=.. */
export function parseEventLink(url: string): { product_app_id: number; event_name: string; preselect_pov_id: number | null } | null {
  const p = parseQuery(url);
  const product_app_id = positiveInt(p.product_app_id);
  if (!product_app_id) return null;
  return { product_app_id, event_name: p.event_name ?? '', preselect_pov_id: positiveInt(p.pov) };
}

/**
 * Run `fn` once the navigator is mounted. On a cold start from a link,
 * getInitialURL() resolves while App still shows its loader and AppNavigator
 * is still reading the token — a navigate() then does nothing at all.
 */
export function whenNavigatorReady(fn: () => void, timeoutMs = 10000): void {
  if (navigationRef.isReady()) { fn(); return; }
  // Counted in polls, not wall-clock: immune to clock changes mid-wait.
  let polls = Math.ceil(timeoutMs / 100);
  const timer = setInterval(() => {
    if (navigationRef.isReady()) {
      clearInterval(timer);
      fn();
    } else if (--polls <= 0) {
      clearInterval(timer);
    }
  }, 100);
}
