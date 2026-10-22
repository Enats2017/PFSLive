import { APP_CONFIG } from '../constants/config';

// ✅ Public page of one runner's result on the follower webapp (livio_web):
//   {WEB_BASE_URL}/result_detail/?product_app_id&product_option_value_app_id&bib
// The same route and query the webapp's own result tables link to, and the
// page anyone can open without the app or an account — so "Share result" sends
// a link people can tap, not only a line of text (client 2026-10-22).
// Same id rules as ShareTrackingLink: ids may arrive as strings, '0' is the
// server default for "none", and an empty / '0' bib is never a real bib.
// Returns null when a working link cannot be built.
export const buildResultLink = (
  productAppId?: string | number | null,
  povId?: string | number | null,
  bib?: string | number | null,
): string | null => {
  const bibStr = bib != null ? String(bib).trim() : '';
  if (!(Number(productAppId) > 0) || !(Number(povId) > 0) || bibStr === '' || bibStr === '0') return null;
  return `${APP_CONFIG.WEB_BASE_URL}/result_detail/?product_app_id=${encodeURIComponent(String(productAppId))}` +
    `&product_option_value_app_id=${encodeURIComponent(String(povId))}` +
    `&bib=${encodeURIComponent(bibStr)}`;
};
