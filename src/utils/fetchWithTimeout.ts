// ✅ fetch() with a deadline (app audit 2026-11-26).
//
// React Native's Android OkHttp client has NO connect / read / call timeout by
// default (OkHttpClientProvider: "No timeouts by default"), so a plain fetch()
// on a half-open socket — a race-venue Wi-Fi that drops mid-request — never
// settles. On the live map that meant a first load spinning forever with no
// retry, or the "Loading participants" overlay stuck over the map for good.
//
// The request is aborted (AbortController) AND the promise is rejected by a
// timer, so the caller is freed even on a platform where abort is ignored.
// The rejection is a TimeoutError the callers map to a network error.

export class FetchTimeoutError extends Error {
  constructor(public ms: number) {
    super(`request timed out after ${ms}ms`);
    this.name = 'FetchTimeoutError';
  }
}

export function fetchWithTimeout(url: string, init: RequestInit = {}, ms: number): Promise<Response> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  return new Promise<Response>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { controller?.abort(); } catch { /* nothing to abort */ }
      reject(new FetchTimeoutError(ms));
    }, ms);
    fetch(url, controller ? { ...init, signal: controller.signal } : init).then(
      (res) => { if (settled) return; settled = true; clearTimeout(timer); resolve(res); },
      (err) => { if (settled) return; settled = true; clearTimeout(timer); reject(err); },
    );
  });
}

/** Seconds from a Retry-After header (delta-seconds form; the API sends that). */
export function parseRetryAfter(value: string | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(String(value).trim());
  return Number.isFinite(n) && n > 0 ? Math.min(Math.ceil(n), 600) : null;
}
