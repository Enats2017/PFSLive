// Cases added 2026-10-22 (full layout audit: every .tsx read against one
// checklist at 320-430pt, landscape, ×1.35 text, fr / nl). App-wide scans so a
// new screen with the same class of problem fails here, plus the specific fixes.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

module.exports = ({ M, load, test, SRC }) => {
  const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\r/g, '');
  const block = (src, name) => {
    const m = src.match(new RegExp('\\n\\s*' + name + ': ?\\{([^}]*)\\}'));
    assert.ok(m, 'style ' + name);
    return m[1];
  };
  const files = {};
  (function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(f) && !/\.test\./.test(f)) files[path.relative(SRC, p).split(path.sep).join('/')] = fs.readFileSync(p, 'utf8').replace(/\r/g, '');
    }
  })(SRC);
  const tsx = Object.entries(files).filter(([p]) => /\.tsx$/.test(p));

  // ── landscape: the notch and the Android navigation bar ────────────────
  test('no screen decides landscape from the width alone (`isLandscape = width` was always true; FanScreen used width > 600)', () => {
    const bad = tsx.filter(([, s]) => /const isLandscape = (?:width|windowWidth|SCREEN_WIDTH)(?:\s*>\s*\d+)?\s*;/.test(s)).map(([p]) => p);
    assert.deepStrictEqual(bad, []);
  });

  test('every screen with AppHeader keeps its body clear of the notch in landscape (side padding hook or landscapeSideInsets)', () => {
    const bad = tsx.filter(([p, s]) => /<AppHeader\b/.test(s) && /<SafeAreaView\b/.test(s) && !/useLandscapeSidePadding\(\)|landscapeSideInsets\(/.test(s)).map(([p]) => p);
    assert.deepStrictEqual(bad, []);
  });

  test('screens using the side padding pair it with the standard edges — no plain edges={[\'bottom\']} (content under the Android nav bar in landscape)', () => {
    const bad = tsx.filter(([, s]) => /useLandscapeSidePadding\(\)/.test(s) && /edges=\{\['bottom'\]\}/.test(s)).map(([p]) => p);
    assert.deepStrictEqual(bad, []);
  });

  test('side padding + edges (rendered hooks): portrait 0 / bottom; iPhone landscape → notch insets + bottom; Android 3-button landscape → 0 + left/right (no double padding)', () => {
    const { useLandscapeSidePadding, useSafeAreaEdges } = load('hooks/useLandscapeSidePadding');
    const prev = [M.window, M.insets];
    try {
      M.window = { width: 393, height: 852 }; M.insets = { top: 59, bottom: 34, left: 0, right: 0 };
      assert.deepStrictEqual(useLandscapeSidePadding(), { paddingLeft: 0, paddingRight: 0 });
      assert.deepStrictEqual(useSafeAreaEdges(), ['bottom']);
      M.window = { width: 852, height: 393 }; M.insets = { top: 0, bottom: 21, left: 59, right: 59 };
      assert.deepStrictEqual(useLandscapeSidePadding(), { paddingLeft: 59, paddingRight: 59 });
      assert.deepStrictEqual(useSafeAreaEdges(), ['bottom']);
      M.window = { width: 800, height: 360 }; M.insets = { top: 24, bottom: 0, left: 0, right: 48 };
      assert.deepStrictEqual(useLandscapeSidePadding(), { paddingLeft: 0, paddingRight: 0 });
      assert.deepStrictEqual(useSafeAreaEdges(), ['left', 'right']);
    } finally { [M.window, M.insets] = prev; }
  });

  // ── popups taller than a landscape screen ──────────────────────────────
  test('every modal can scroll when taller than the screen (ModalScroll / its own ScrollView / Dialog); the only exception is the short follow-prompt sheet', () => {
    const bad = tsx.filter(([p, s]) => /<Modal\s/.test(s) && !/<ModalScroll\b|<ScrollView\b|<FlatList\b|<Dialog\b/.test(s)).map(([p]) => p);
    assert.deepStrictEqual(bad, []);   // the follow-prompt sheet scrolls too since the landscape fix (audit38)
    const ms = files['components/ui/ModalScroll.tsx'];
    assert.ok(/flexGrow: 0, flexShrink: 1, maxHeight: maxBoxHeight, width: '100%', maxWidth: 400, alignSelf: 'center'/.test(ms), 'only as tall as the card, never taller than the screen (explicit cap, audit38); no wider than a card');
    assert.ok(/flexGrow: 1, justifyContent: 'center'/.test(ms), 'short cards stay centred');
    assert.ok(/<ModalScroll\b/.test(files['components/ui/Dialog.tsx']), 'Dialog (device transfer, e-mail change) through the shared component');
    const home = files['screens/HomeScreen.tsx'];
    assert.strictEqual((home.match(/<ModalScroll style=\{\[homeStyles\.notifScroll, compactPopups && homeStyles\.notifScrollCompact\]\}[^>]*>/g) || []).length, 9, 'all 9 Home popups (compact in landscape)');
  });

  test('tap outside closes: the full-screen wrappers let touches through to their backdrop (pointerEvents box-none)', () => {
    assert.ok(/pointerEvents: 'box-none'/.test(block(files['components/ui/Dialog.tsx'], 'wrapper')), 'Dialog wrapper');
    assert.ok(/<View style=\{(?:styles\.wrapper|\[styles\.wrapper, cd\.s\.wrapper\])\} pointerEvents="box-none">/.test(files['components/ErrorModal.tsx']), 'ErrorModal');
    assert.ok(/pointerEvents="box-none"/.test(files['screens/HomeScreen.tsx']), 'Home foreground notification');
  });

  test('"Is this you?" sheet: the details scroll, Confirm / Cancel stay in a footer outside the scroll (always on screen)', () => {
    const s = files['screens/EventDetails/ConfirmRaceResultModal.tsx'];
    const end = s.indexOf('</ScrollView>');
    assert.ok(end > 0);
    assert.ok(s.indexOf("t('confirmModal:fields.email')") < end, 'rows inside the scroll');
    assert.ok(s.indexOf('onPress={onConfirm}') > end && s.indexOf("t('confirmModal:buttons.cancel')") > end, 'buttons after it');
  });

  // ── names and labels cut with "…" ──────────────────────────────────────
  test('no event / athlete / distance / checkpoint name is limited to one line anywhere (file names cut in the middle)', () => {
    const bad = [];
    for (const [p, s] of tsx) {
      for (const m of s.matchAll(/<Text\b([^>]*?)numberOfLines=\{1\}([^>]*)>([\s\S]*?)<\/Text>/g)) {
        if (!/event_name|eventName|\.name\b|fullName|distance_name|firstname|lastname|\{name\}/.test(m[3])) continue;
        if (/ellipsizeMode="middle"/.test(m[1] + m[2])) continue;
        bad.push(`${p}:${s.slice(0, m.index).split('\n').length}`);
      }
    }
    // RaceInfoTab: a checkpoint's km or name as the LABEL of a value row (reviewed in audit32)
    assert.deepStrictEqual(bad, ['screens/ResultDetailsScreen/RaceInfoTab.tsx:263']);
  });

  test('header band (often the only place the event name shows) and bottom-bar labels: 2 lines / one line that shrinks — never cut or split mid-word', () => {
    assert.ok(/numberOfLines=\{2\}/.test(files['components/common/AppHeader.tsx'].match(/<Text[^>]*bandText[^>]*>/)[0]));
    for (const f of ['components/common/BottomNavigation.tsx', 'components/common/BottomNavigationFollower.tsx']) {
      assert.ok(/numberOfLines=\{1\}[\s\S]{0,80}adjustsFontSizeToFit/.test(files[f]), f);
    }
  });

  // ── text beside an icon / button that could run past the edge ──────────
  test('row texts next to an icon or a second text can shrink (flexShrink 1) — they ran past the card edge in fr / at 320pt', () => {
    const cases = [
      ['styles/home.styles.ts', ['sendText', 'activeStatusText']],
      ['styles/readiness.styles.ts', ['allSetText', 'shareButtonText']],
      ['styles/fan.styles.ts', ['eventDate', 'nextEventsTitle']],
      ['styles/liveTracking.styles.ts', ['dropdownButtonText', 'dropdownItemText']],
      ['styles/ResultList.styles.ts', ['popupRowText']],
    ];
    const bad = [];
    for (const [f, names] of cases) for (const n of names) if (!/flexShrink: 1/.test(block(files[f], n))) bad.push(`${f} ${n}`);
    assert.deepStrictEqual(bad, []);
    assert.ok(/flexShrink: 0/.test(block(files['styles/fan.styles.ts'], 'viewAllBtn')), '"View all" keeps its size');
  });

  // ── specific fixes ─────────────────────────────────────────────────────
  test('live map: the elevation panel fits the map area (capped, hidden when no room) and its toggle sits on the panel, inside the map', () => {
    const s = files['screens/LiveTrackingScreen.tsx'];
    assert.ok(/const showElevationProfile = hasGpx && panelHeight >= MIN_PANEL;/.test(s));
    assert.ok(/const collapseBtnBottom = profileCollapsed \? 16 : panelHeight \+ 8;/.test(s));
    assert.ok(!/TAB_BAR_HEIGHT \+ insets\.bottom/.test(s), 'no tab-bar / inset maths for the button');
    assert.ok(/useState\(false\)/.test(s.slice(s.indexOf('const [profileCollapsed'), s.indexOf('const [profileCollapsed') + 80)), 'not forced collapsed');
  });

  test('elevation chart: tapping a GPX aid station works (it read data.checkpoint, undefined → TypeError) and taps match the drawn chart padding', () => {
    const s = files['components/ElevationProfile/LiveElevationProfile.tsx'];
    assert.ok(/data\.station\.description/.test(s));
    assert.ok(!/PAD_TOP = 20/.test(s) && !/PAD_BOTTOM = 20/.test(s));
  });

  test('keyboard: no extra 60-80pt KeyboardAvoidingView offset (the view already starts at the screen top) — the form had ~0pt left in landscape', () => {
    const bad = tsx.filter(([, s]) => /keyboardVerticalOffset=\{[^}]*\b(?:60|80)\b[^}]*\}/.test(s)).map(([p]) => p);
    assert.deepStrictEqual(bad, []);
  });

  test('FloatingLabelInput keeps its own focus handling when a screen passes onFocus (the contact form label never floated)', () => {
    const s = files['components/FloatingLabelInput.tsx'];
    assert.ok(/onFocus\?\.\(/.test(s) || /props\.onFocus|onFocusProp/.test(s), 'caller handler chained');
  });

  test('result card repaints when the name / club / category change (memo compared only bib, status, …)', () => {
    const s = files['screens/ResultList/ResultCard.tsx'];
    const cmp = s.slice(s.lastIndexOf('(prev'));
    for (const k of ['name', 'club', 'category_name']) assert.ok(new RegExp('prev\\w*\\.item\\.' + k + ' === next\\w*\\.item\\.' + k).test(cmp), k);
  });

  test('translations: result details "Bib" exists in en / fr / nl; the participant list paging text and "Searching…" are translated', () => {
    for (const l of ['en', 'fr', 'nl']) {
      assert.ok(JSON.parse(files[`i18n/Resultdetails/${l}.json`] || fs.readFileSync(path.join(SRC, 'i18n/Resultdetails', l + '.json'), 'utf8')).raceInfo.bib, l);
      const ed = JSON.parse(fs.readFileSync(path.join(SRC, 'i18n/EventDetails', l + '.json'), 'utf8'));
      assert.ok(ed.participant.loadingMore && ed.participant.scrollForMore, l);
    }
    for (const f of ['components/SuggestionDropdown.tsx', 'components/AthleteSuggestionDropdown.tsx']) assert.ok(!/>\s*Searching…\s*</.test(files[f]), f);
    assert.ok(!/Loading more…|Scroll for more/.test(files['screens/EventDetails/ParticipantTab.tsx']));
  });

  test('portrait unchanged where the fix is only for landscape / narrow: profile tab height floor, favourites button spot, ranking headings, participant names', () => {
    assert.ok(/const TAB_CONTENT_HEIGHT = windowWidth > height\n\s*\? Math\.max/.test(files['screens/ProfileScreen/ProfileScreen.tsx']));
    assert.ok(/const fabBottom = isLandscape \? space\.lg : FAB_BOTTOM_PORTRAIT;/.test(files['screens/FavouriteScreen/FavouriteList.tsx']));
    assert.ok(/narrow && resultInfoStyles\.rankingLabelSmall/.test(files['screens/ResultDetailsScreen/RaceLive.tsx']));
    for (const f of ['screens/FavouriteScreen/AllParticipantCard.tsx', 'screens/ResultList/ParticipantCard.tsx']) {
      assert.ok(/isNarrowWidth\(width\) \? favstyle\.runnerName : commonStyles\.title/.test(files[f]), f);
    }
  });
};
