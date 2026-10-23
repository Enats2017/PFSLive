// Cases added 2026-10-22 (confirmation pass 2): the full-audit fixes that had
// no test yet — one assertion per fix, each failing on the code before the audit.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { textWidth } = require('../../scripts/text-width.cjs');

module.exports = ({ test, SRC }) => {
  const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\r/g, '');
  const block = (src, name) => {
    const m = src.match(new RegExp('\\n\\s*' + name + ': ?\\{([^}]*)\\}'));
    assert.ok(m, 'style ' + name);
    return m[1];
  };

  // ── result details ─────────────────────────────────────────────────────
  test('result details rows: the label keeps its size, the value shrinks and right-aligns (live / upcoming / race info) — the value crushed "Distance" to one letter per line', () => {
    const st = read('styles/resultDetails.styles.ts');
    assert.ok(/flexShrink: 0/.test(block(st, 'rowLabelFixed')) && /maxWidth: ['"]50%['"]/.test(block(st, 'rowLabelFixed')));
    assert.ok(/flexShrink: 1/.test(block(st, 'rowValueEnd')) && /textAlign: ['"]right['"]/.test(block(st, 'rowValueEnd')));
    for (const f of ['RaceLive', 'UpcomingRace', 'RaceInfoTab']) {
      const s = read(`screens/ResultDetailsScreen/${f}.tsx`);
      assert.ok((s.match(/resultInfoStyles\.rowValueEnd/g) || []).length >= 2, f);
    }
    // the runner / distance values take 2 lines on the live tab
    const live = read('screens/ResultDetailsScreen/RaceLive.tsx');
    assert.ok((live.match(/resultInfoStyles\.rowValueEnd\]\} numberOfLines=\{2\}/g) || []).length >= 2);
  });

  test('result details: next / previous timing point are a column (label, then name, then time) — as a row their 4 texts ran past the card on every phone', () => {
    const st = read('styles/resultDetails.styles.ts');
    assert.ok(!/flexDirection: ['"]row['"]/.test(block(st, 'timingBlock')));
    const live = read('screens/ResultDetailsScreen/RaceLive.tsx');
    assert.ok((live.match(/resultInfoStyles\.timingBlock/g) || []).length >= 2, 'both blocks');
    // why: at 390pt the row had ~7pt left for the label
    assert.ok(textWidth('Point de chronométrage précédent', 'fonts.body', 14) > 200);
  });

  test('result details rankings: values on one baseline, shrink inside 2 lines; columns stretch (values were at different heights)', () => {
    const st = read('styles/resultDetails.styles.ts');
    assert.ok(/justifyContent: "space-between"/.test(block(st, 'rankingCol')));
    assert.ok(/<Text style=\{resultInfoStyles\.rankingValue\} numberOfLines=\{2\} adjustsFontSizeToFit minimumFontScale=\{0\.6\}>/.test(read('screens/ResultDetailsScreen/RaceLive.tsx')));
  });

  test('upcoming race: the athlete name beside the bib is flex 1, right-aligned, 2 lines (it ran past the card at 320pt)', () => {
    const s = read('screens/ResultDetailsScreen/UpcomingRace.tsx');
    assert.ok(/resultInfoStyles\.rowValueEnd, \{ flex: 1 \}\]\} numberOfLines=\{2\}>\{raceInfo\?\.name/.test(s));
  });

  test('result details: bib · distance line and live timing-point names take 2 lines', () => {
    assert.ok(/numberOfLines=\{2\}/.test(read('screens/ResultDetailsScreen/ResultDetails.tsx').match(/<Text[^>]*>\s*\{[^}]*bib[\s\S]{0,200}/i)?.[0] || read('screens/ResultDetailsScreen/ResultDetails.tsx')));
    assert.ok(/<Text style=\{resultInfoStyles\.cpName\} numberOfLines=\{2\}>/.test(read('screens/ResultDetailsScreen/LiveTimingPoint.tsx')));
  });

  // ── lists and cards ────────────────────────────────────────────────────
  test('event list card: the status badge sits on its own line above the name (nl "BINNENKORT" left the name 22pt at 320); name 3 lines, date / place 2', () => {
    const s = read('components/EventListCard.tsx');
    const badge = s.indexOf('<View style={styles.badgeRow}>');
    const name = s.indexOf('<Text style={styles.name} numberOfLines={3}>{name}</Text>');
    assert.ok(badge > 0 && name > badge, 'badge before the name');
    assert.ok((s.match(/numberOfLines=\{2\}/g) || []).length >= 2, 'date and place');
    assert.ok(textWidth('BINNENKORT', 'fonts.bodySemi', 11, { upper: true }) > 60);
  });

  test('"This is me" list: the 20pt name and the bib · distance · wave line take 2 lines; the notice scrolls with the list (left ~77pt for the list in landscape)', () => {
    const s = read('screens/EventDetails/ParticipantResult.tsx');
    assert.ok((s.match(/numberOfLines=\{2\}/g) || []).length >= 2);
    const header = s.match(/ListHeaderComponent=\{([\s\S]{0,400})/);
    assert.ok(header && /NoticeCard|renderNotice|notice/i.test(header[1]), 'notice in the list header');
  });

  test('city · country beside a flag can shrink (follower cards); the avatar fills its circle (was 65 in a 60 circle)', () => {
    assert.ok(/flexShrink: 1/.test(read('screens/ProfileScreen/FollowerListCard.tsx')));
    assert.ok(/flexShrink: 1/.test(read('screens/FollowerEventList/FollowerCard.tsx')));
    const av = block(read('styles/details.styles.ts'), 'avatarImage');
    assert.ok(/width: '100%'/.test(av) && /height: '100%'/.test(av));
  });

  test('Home idle "upcoming events" tiles: name 3 lines, meta pinned to the bottom (tiles stretch to one height)', () => {
    assert.ok(/numberOfLines=\{3\}/.test(read('components/Home/IdleHome.tsx')));
    const b = block(read('styles/readiness.styles.ts'), 'eventTileBody');
    assert.ok(/flex: 1,/.test(b) && /justifyContent: 'space-between'/.test(b));
  });

  // ── profile ────────────────────────────────────────────────────────────
  test('profile: the tab pager measures its real width (onLayout — setContainerWidth was never called); item renderers re-run when the profile loads', () => {
    assert.ok(/onLayout=\{\(e\) => setContainerWidth\(e\.nativeEvent\.layout\.width\)\}/.test(read('screens/ProfileScreen/ProfileScreen.tsx')));
    assert.ok(/\[profile\?\.is_own_profile, onDeleteEvent\]/.test(read('screens/ProfileScreen/TrainingContent.tsx')));
    assert.ok(/\[profile\?\.is_own_profile\]/.test(read('screens/ProfileScreen/PastTab.tsx')));
  });

  test('profile buttons: "Create personal event" and the iOS plans button label shrink inside their button; the follower counts row wraps', () => {
    const own = read('styles/ownProfile.styles.ts');
    const ok = (src, name) => /flexShrink: 1/.test(block(src, name));
    const tc = read('screens/ProfileScreen/TrainingContent.tsx');
    assert.ok(/flexShrink: 1/.test(tc.match(/createBtnText: \{[^}]*\}/)?.[0] || '') || ok(own, 'createBtnText'), 'createBtnText');
    assert.ok(ok(own, 'iosbuttonText') || /iosbuttonText[^}]*flexShrink: 1/.test(read('styles/Profile.styles.ts')), 'iosbuttonText');
    assert.ok(/flexWrap: ['"]wrap['"]/.test(block(own, 'statsRow')) || /statsRow[\s\S]{0,200}flexWrap/.test(read('screens/ProfileScreen/OwnProfile.tsx')), 'statsRow wraps');
    assert.ok(textWidth('Créer un événement personnel', 'fonts.display', 15) * 1.2 > 280 - 28 - 32);
  });

  test('own event cards: the buttons always get their own bottom-right line (every width, device test 2026-10-23); membership plans: below 400pt or with larger text the sessions badge does', () => {
    assert.ok(/const actionsBelow = isOwnProfile;/.test(read('screens/ProfileScreen/EventCardLive.tsx')));
    const m = read('screens/ProfileScreen/MembershipPlansScreen.tsx');
    assert.ok(/const badgeOwnLine = windowWidth < 400 \|\| fontScale > 1;/.test(m));
    assert.ok(/\{!badgeOwnLine && sessionsBadge\}/.test(m) && /\{badgeOwnLine && <View style=\{styles\.sessionsBadgeLine\}>\{sessionsBadge\}<\/View>\}/.test(m));
    // why: at 375pt the info column beside three 48pt buttons is ~143pt; "Transmontagne" at 20pt is wider
    assert.ok(textWidth('Transmontagne', 'fonts.display', 20) > 143);
  });

  // ── forms ──────────────────────────────────────────────────────────────
  test('register / edit profile: the name and birth-date pairs stack below 360pt or from ×1.2 text; the label never runs under the right icon (measured width)', () => {
    for (const [f, w] of [['screens/AuthScreens/RegisterScreen.tsx', 'width'], ['screens/AuthScreens/EditProfileScreen.tsx', 'winWidth']]) {
      assert.ok(new RegExp('const stackPairs = ' + w + ' < 360 \\|\\| \\(fontScale \\?\\? 1\\) >= 1\\.2').test(read(f)), f);
    }
    const fl = read('components/FloatingLabelInput.tsx');
    assert.ok((fl.match(/onLayout=\{handleFieldLayout\}/g) || []).length >= 4, 'every variant measures itself');
    assert.ok(!/maxWidth: '75%'/.test(fl.replace(/\/\/[^\n]*/g, '')) || /fieldWidth|containerWidth/.test(fl), 'no flat 75% label width');
  });

  test('register: the terms label takes the rest of the row (flex 1) and tapping it ticks the box; edit profile: the pending e-mail actions wrap', () => {
    const r = read('screens/AuthScreens/RegisterScreen.tsx');
    const terms = r.slice(r.search(/terms/i));
    assert.ok(/style=\{\{ flex: 1 \}\}/.test(terms));
    assert.ok(/pendingEmailActions, \{ flexWrap: 'wrap', rowGap: space\.sm \}/.test(read('screens/AuthScreens/EditProfileScreen.tsx')));
    assert.ok(/i18n=\{\{/.test(read('screens/AuthScreens/EditProfileScreen.tsx')), 'country picker translated');
  });

  test('OTP rows wrap ("Mauvaise adresse ?" + "Changer d\'e-mail" = 259pt in 240 at 320); error text shrinks beside its icon', () => {
    assert.ok(/flexWrap: 'wrap'/.test(block(read('styles/OtpScreen.styles.ts'), 'notArrivedRow')));
    const fp = read('styles/forgetPassword.styles.ts');
    assert.ok(/flexWrap: 'wrap'/.test(block(fp, 'resendRow')));
    assert.ok(/flexShrink: 1/.test(block(fp, 'errorText')));
  });

  test('language buttons size to their word and wrap ("Nederland/s" split in three equal pills at 320-360pt)', () => {
    const s = read('screens/SettingScreen/LanguageSelector.tsx');
    assert.ok(/flexWrap: 'wrap'/.test(s) && /flexGrow: 1, flexShrink: 0, flexBasis: 'auto'/.test(s));
    assert.ok(textWidth('Nederlands', 'fonts.bodySemi', 15) > 67);
  });

  test('follower search: the page is no longer moved up by the keyboard (translateY) — the list scrolls the field into view; the list header is an element, not a function (remounted the field)', () => {
    const s = read('screens/FollowerScreen/FollowerScreen.tsx');
    assert.ok(!/translateY/.test(s));
    assert.ok(/ListHeaderComponent=\{renderContent\(\)\}/.test(s));
  });

  test('contact form scrolls to the message field it measured (not a fixed y 260 only)', () => {
    const s = read('screens/ProfileScreen/ContactFeedbackScreen.tsx');
    assert.ok(/scrollTo\(\{[^}]*y:/.test(s) && /onLayout/.test(s));
  });

  // ── event screens ──────────────────────────────────────────────────────
  test('distance cards: the distance name has its own full-width line, no line limit (nl "Recreatieloop" split beside the buttons)', () => {
    for (const f of ['screens/EventDetails/DistanceTab.tsx', 'screens/FollowerDetailsList/DistanceTab.tsx', 'screens/ParticipantEvent/RaceResultScreen.tsx']) {
      const s = read(f);
      const name = s.indexOf('{item.distance_name}');
      const row = s.indexOf('detailsStyles.distance, buttonsBelow');
      assert.ok(name > 0 && row > name, f + ': name above the details / buttons row');
      assert.ok(!/numberOfLines=\{2\}>\s*\{item\.distance_name\}/.test(s), f + ': no limit');
    }
    assert.ok(textWidth('Recreatieloop', 'fonts.display', 20) > 130);
  });

  test('header images are capped in landscape (45% of the screen height) — full width × 612/428 was taller than the screen', () => {
    for (const f of ['screens/EventDetails/DistanceTab.tsx', 'screens/EventDetails/ParticipantTab.tsx', 'screens/FollowerDetailsList/DistanceTab.tsx', 'screens/ParticipantEvent/RaceResultScreen.tsx']) {
      assert.ok(/0\.45/.test(read(f)), f);
    }
  });

  test('past races: the divider only draws next to a button; notifications card scrolls with the tracking settings', () => {
    const r = read('screens/ParticipantEvent/RaceResultScreen.tsx');
    const show = r.indexOf('{showResults && (');
    assert.ok(show > 0 && r.indexOf('detailsStyles.verticalDivider') > show);
    const lt = read('screens/SettingScreen/LiveTrackingSettingsScreen.tsx');
    assert.ok(/<ScrollView/.test(lt));
  });

  test('event tab bar: the pager fills the screen (flex 1) so the tab lists can scroll to their end', () => {
    for (const f of ['screens/FollowerEventList/FollowerEvent.tsx', 'screens/ParticipantEvent/ParticipantEvent.tsx']) {
      assert.ok(/<View style=\{\[\{ flex: 1 \}, sidePadding\]\}>|<View style=\{\{ flex: 1 \}\}>/.test(read(f)), f);
    }
  });

  test('error / empty screens scroll when taller than the space (Retry was outside its parent in landscape)', () => {
    const s = read('components/ui/EmptyState.tsx');
    assert.ok(/<ScrollView/.test(s) && /flexGrow: 1/.test(s));
  });
};
