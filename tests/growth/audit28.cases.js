// Cases added 2026-10-22 (round 3, re-check of every client point through the
// code): landscape side insets on notch phones, share text for a runner with
// no finish time, elevation-chart km labels at the bigger size, and where the
// Dutch "Results" labels actually appear.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { textWidth } = require('../../scripts/text-width.cjs');

module.exports = ({ M, load, test, SRC }) => {
  const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\r/g, '');
  const find = (n, f) => {
    if (!n || typeof n !== 'object') return null;
    if (f(n)) return n;
    for (const c of n.children || []) { const r = find(c, f); if (r) return r; }
    return null;
  };

  // ── 5. landscape: notch / Dynamic Island ───────────────────────────────
  test('landscape side insets: iPhone (gesture) landscape gets its notch insets; portrait and Android 3-button get 0 (no double padding)', () => {
    const { landscapeSideInsets } = load('utils/landscapeInsets');
    // iPhone 15 landscape: 59 / 59, home indicator 21
    assert.deepStrictEqual(landscapeSideInsets({ left: 59, right: 59, bottom: 21 }, 852, 393), { left: 59, right: 59 });
    // iPhone X-13 landscape: 47
    assert.deepStrictEqual(landscapeSideInsets({ left: 47, right: 47, bottom: 21 }, 844, 390), { left: 47, right: 47 });
    // portrait: never (the side insets are 0 there anyway, but do not rely on it)
    assert.deepStrictEqual(landscapeSideInsets({ left: 0, right: 0, bottom: 34 }, 393, 852), { left: 0, right: 0 });
    // Android 3-button landscape: bottom 0 → SafeAreaView already pads left/right
    assert.deepStrictEqual(landscapeSideInsets({ left: 0, right: 48, bottom: 0 }, 800, 360), { left: 0, right: 0 });
    // Android gesture nav landscape with a cutout: padded like the iPhone
    assert.deepStrictEqual(landscapeSideInsets({ left: 32, right: 0, bottom: 16 }, 800, 360), { left: 32, right: 0 });
  });

  test('landscape side insets reach the header row + band, the results list content and the result detail pages', () => {
    const h = read('components/common/AppHeader.tsx');
    assert.ok(/const side = landscapeSideInsets\(insets, width, height\);/.test(h));
    assert.ok(/style=\{\[headerStyles\.bar, \{ paddingTop: insets\.top \+ \(width > height \? 8 : 16\), paddingLeft: space\.xl \+ side\.left, paddingRight: space\.xl \+ side\.right \}, width > height && \{ paddingBottom: 8 \}\]\}/.test(h), 'icon row');
    assert.ok(/<View style=\{\[headerStyles\.band, \{ paddingLeft: space\.xl \+ side\.left, paddingRight: space\.xl \+ side\.right \}\]\}>/.test(h), 'band');
    // the header's own padding is still the 20pt gutter when side is 0
    assert.ok(/bar: \{\s*paddingHorizontal: space\.xl,/.test(read('styles/header.styles.ts')));

    const l = read('screens/ResultList/ResultList.tsx');
    assert.ok(/const side = landscapeSideInsets\(insets, width, height\);/.test(l));
    const wrap = l.indexOf('<View style={{ flex: 1, paddingLeft: side.left, paddingRight: side.right }}>');
    assert.ok(wrap > l.indexOf('<AppHeader') && wrap < l.indexOf('{!filtersInList && filterHeader}'), 'wraps filters + list, below the header');
    assert.ok(l.indexOf('</View>\n\n            {sectionType === \'follower\' ? (') > wrap, 'closes before the bottom bar (bar stays full width)');

    const d = read('screens/ResultDetailsScreen/ResultDetails.tsx');
    assert.ok(/const side = landscapeSideInsets\(insets, windowWidth, windowHeight\);/.test(d));
    // padding on a wrapper OUTSIDE the measured View → pages sized to the padded width
    assert.ok(/<View style=\{\{ flex: 1, paddingLeft: side\.left, paddingRight: side\.right \}\}>\n\s*<View\n\s*style=\{\{ flex: 1 \}\}\n\s*onLayout=\{\(e\) => setContainerWidth\(e\.nativeEvent\.layout\.width\)\}/.test(d));
  });

  // ── 11. share text for a runner with no finish time ───────────────────
  const share = async (raceInfo) => {
    const Tab = load('screens/ResultDetailsScreen/RaceInfoTab').default;
    const el = Tab({ raceInfo: { name: 'Ann Runner', bib: '12', position_total: '100', finishers: '80', ...raceInfo },
      event: { race_name: 'Trail', distance_name: '25km', product_app_id: 19, product_option_value_app_id: 78 }, checkpoints: [] });
    const btn = find(el, (n) => n.props && n.props.label === 'raceInfo.shareResult');
    M.shares.length = 0;
    await btn.props.onPress();
    return M.shares[0].message;
  };

  test('share result: a DNF / DNS runner shares the status instead of an empty time', async () => {
    const dnf = await share({ time: '', position: 'DNF', participant_status: 'DNF' });
    assert.ok(dnf.startsWith('raceInfo.shareBodyNoPosition{') && dnf.includes('"time":"status.DNF"'), dnf);
    assert.ok(dnf.endsWith('\nhttps://my.liviolive.com/livio_website/result_detail/?product_app_id=19&product_option_value_app_id=78&bib=12'), dnf);
    const odd = await share({ time: '', position: '', participant_status: 'OTL' });
    assert.ok(odd.includes('"time":"OTL"'), 'unknown feed code shown as sent: ' + odd);
    const fin = await share({ time: '02:10:00', position: '5', participant_status: 'finished' });
    assert.ok(fin.includes('"time":"02:10:00"') && fin.includes('"position":"5 / 100"'), fin);
  });

  test('share result: the button is there for any finished field (finishers > 0), not only when pace is known', () => {
    const s = read('screens/ResultDetailsScreen/RaceInfoTab.tsx');
    assert.ok(/\{\(!!raceInfo\?\.average_pace \|\| !!raceInfo\?\.finishers \|\| !!raceInfo\?\.elevation_gain\) && \(/.test(s));
  });

  // ── 4. elevation chart km labels at 11pt ──────────────────────────────
  test('elevation chart: km labels at 11pt (+4pt offset, 3pt background each side) stay inside the 1 cm grid spacing — no overlap', () => {
    const s = read('components/ElevationProfile/LiveElevationProfile.tsx');
    const perCm = 160 / 2.54;
    assert.ok(/const DP_PER_CM\s+= 160 \/ 2\.54;/.test(s));
    assert.ok(/text=\{`\$\{distance\} km`\}\s*style=\{\{\s*fontFamily: fonts\.bodySemi,\s*fontSize: 11,/.test(s));
    assert.ok(/backgroundPadding=\{3\}/.test(s) && /x=\{\(distance \/ totalDistance\) \* chartWidth \+ 4\}/.test(s));
    // widest labels the NICE_STEPS (0.5, 1, 2, 5, 10 km per cm) can produce on real routes
    for (const label of ['4.5 km', '9.5 km', '48 km', '170 km', '330 km']) {
      const w = 4 + 3 + textWidth(label, 'fonts.bodySemi', 11) + 3;
      assert.ok(w < perCm, `${label}: ${w.toFixed(1)}pt ≥ ${perCm.toFixed(1)}pt`);
    }
  });

  // ── 2. where the Dutch "Results" labels appear ────────────────────────
  test('Dutch "Results" labels: bottom tab only once the race day is past, distance button from race day, past-race "Result", participant card for RaceResult entries', () => {
    for (const f of ['components/common/BottomNavigation.tsx', 'components/common/BottomNavigationFollower.tsx']) {
      assert.ok(/const resultsLabel = raceIsPast \? t\('nav\.results'\) : t\('nav\.participants'\);/.test(read(f)), f);
    }
    assert.ok(/distanceButtonKind\(item\.race_date, item\.countdown\?\.status\) === 'participants'\s*\? 'button\.participants'\s*: 'button\.results'/.test(read('screens/FollowerDetailsList/DistanceTab.tsx')));
    assert.ok(/\{t\('button\.result'\)\}/.test(read('screens/ParticipantEvent/RaceResultScreen.tsx')));
    assert.ok(/const primaryLabel\s+= isResultSource\s*\? t\('details:participant\.results'\)/.test(read('screens/EventDetails/ParticipantCard.tsx')));
    assert.ok(/label: "allrace:filter\.results"/.test(read('hooks/useResultList.ts')), 'results / live type filter');
  });
};
