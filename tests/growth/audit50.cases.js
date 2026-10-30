// Cases added 2026-10-30 for the developer's three reports on growth_v0.1:
//  1. A tracked personal event keeps its Edit button (Delete is already hidden)
//  2. A new Start shows the previous race's timer for 2-3 s
//  3. The distance counter moves in 100 m steps ("1.0 km") — show 1.23 km
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = ({ M, load, test, SRC }) => {
  const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\r/g, '');
  const walk = (n, out = []) => {
    if (!n || typeof n !== 'object') return out;
    if (Array.isArray(n)) { n.forEach((c) => walk(c, out)); return out; }
    out.push(n); walk(n.children || [], out); return out;
  };

  // ── 1. Edit hidden on a tracked personal event ───────────────────────────
  const ev = (o) => ({ participant_app_id: 1, id: 7, product_option_value_app_id: 0, name: 'Morning run',
    race_date_formatted: '30 October 2026', race_time: '10:00:00', event_source: 'custom', can_delete: 1, race_status: 'in_progress', ...o });
  const icons = (item, own = true) => {
    const mod = load('screens/ProfileScreen/EventCardLive');
    const C = mod.EventCard.type || mod.EventCard;
    return walk(C({ item, isOwnProfile: own, onDelete() {} })).map((n) => n.props && n.props.name).filter((x) => x && x !== 'calendar-month-outline');
  };

  test('Profile event card (rendered): personal event not tracked yet → Delete + Edit + View', () => {
    assert.deepStrictEqual(icons(ev({})), ['trash-outline', 'pencil-outline', 'eye-outline']);
  });
  test('…tracked personal event (server can_delete 0, > 10 min tracked) → Edit hidden like Delete, View stays', () => {
    assert.deepStrictEqual(icons(ev({ can_delete: 0 })), ['eye-outline']);
    assert.deepStrictEqual(icons(ev({ can_delete: 0, race_status: 'finished' })), ['eye-outline']);
    assert.deepStrictEqual(icons(ev({ can_delete: undefined })), ['eye-outline'], 'no flag = locked (as Delete)');
  });
  test('…partner events unchanged: Edit (event page) stays, greyed out once finished; never Delete', () => {
    assert.deepStrictEqual(icons(ev({ event_source: 'partner', can_delete: 0 })), ['pencil-outline', 'eye-outline']);
    const { showEditButton } = load('screens/ProfileScreen/EventCardLive');
    assert.strictEqual(showEditButton({ event_source: 'partner', can_delete: 0 }), true);
    assert.strictEqual(showEditButton({ event_source: 'custom', can_delete: 1 }), true);
    assert.strictEqual(showEditButton({ event_source: 'custom', can_delete: 0 }), false);
    const s = read('screens/ProfileScreen/EventCardLive.tsx');
    assert.ok(/disabled=\{isEditDisabled\}/.test(s), 'finished partner event: still disabled');
  });
  test('…the server lock reaches the user: edit screen names it (en/fr/nl); a refused delete no longer says "deleted", it refetches', () => {
    const e = read('screens/PersonalEventScreen/EditPersonalEvent.tsx');
    assert.ok(/case 'tracking_already_started':\s*toastError\(t\('common:errors\.generic'\), t\('personal:errors\.trackingStarted'\)\);/.test(e));
    for (const l of ['en', 'fr', 'nl']) {
      const j = JSON.parse(read(`i18n/PersonalEvent/${l}.json`));
      assert.ok(j.errors && typeof j.errors.trackingStarted === 'string' && j.errors.trackingStarted.length > 20, l);
    }
    const o = read('screens/ProfileScreen/OwnProfile.tsx');
    const branch = o.slice(o.indexOf("} else if (action === 'tracking_already_started') {"), o.indexOf('} catch (err) {', o.indexOf("action === 'tracking_already_started'")));
    assert.ok(/toastError\(t\('ownProfile:deleteEvent\.trackingStartedError'\)\);/.test(branch), 'says why');
    assert.ok(/await fetchProfile\(true\);/.test(branch), 'refetch: the card loses Delete and Edit');
    assert.ok(!/deleteSuccess/.test(branch) && !/handleApiError/.test(branch), 'no "Event deleted successfully", no error screen');
  });
  test('…someone else\'s profile: View only, as before', () => {
    assert.deepStrictEqual(icons(ev({}), false), ['eye-outline']);
  });

  // ── 2. Timer starts at 00:00:00 ──────────────────────────────────────────
  test('elapsed: no start stamped → 00:00:00; then counts from the stamp', () => {
    const { formatElapsed } = load('utils/sessionDisplay');
    assert.strictEqual(formatElapsed(null, 5e12), '00:00:00');
    assert.strictEqual(formatElapsed(1000, 1000 + 3723_000), '01:02:03');
    assert.strictEqual(formatElapsed(10_000, 9_000), '00:00:00', 'clock behind the stamp: never negative');
  });
  test('Home: Stop forgets the session stats, Start re-reads every second until the new start is stamped', () => {
    const s = read('screens/HomeScreen.tsx');
    const eff = s.slice(s.indexOf('const readStats = async'), s.indexOf('}, [isGPSActive]);'));
    const head = s.slice(s.lastIndexOf('useEffect(() => {', s.indexOf('const readStats = async')), s.indexOf('const readStats = async'));
    assert.ok(/if \(!isGPSActive\) \{\s*setSessionStats\(\{ startedAt: null, distanceKm: null, lastSentAt: null \}\);\s*return;/.test(head), 'reset on stop');
    assert.ok(/stamped = stats\.startedAt !== null;/.test(eff));
    assert.ok(/setNowTick\(Date\.now\(\)\);\s*if \(!stamped\) void readStats\(\);/.test(eff), 'fast re-read until stamped');
    assert.ok(/formatElapsed\(sessionStats\.startedAt, nowTick\)/.test(s));
  });

  // ── 3. Distance in 10 m steps ────────────────────────────────────────────
  test('distance: two decimals, rounded down (1.234 → 1.23, 2.359 → 2.35, 0.999 → 0.99); none / bad → 0.00', () => {
    const { formatSessionKm } = load('utils/sessionDisplay');
    const got = [1.234, 2.359, 0.999, 1, 1.23, 12.3456, 0, -1, NaN, Infinity].map(formatSessionKm);
    assert.deepStrictEqual(got, ['1.23', '2.35', '0.99', '1.00', '1.23', '12.34', '0.00', '0.00', '0.00', '0.00']);
    const s = read('screens/HomeScreen.tsx');
    assert.ok(/\$\{formatSessionKm\(sessionStats\.distanceKm\)\} \$\{t\('units\.km', 'km'\)\}/.test(s));
    assert.ok(!/distanceKm\.toFixed\(1\)/.test(s), 'no one-decimal counter left');
  });
};
