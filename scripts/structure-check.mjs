#!/usr/bin/env node
// Structural conformance: does each screen have the BLOCKS its artboard has?
//
//   node scripts/structure-check.mjs
//   node scripts/structure-check.mjs --selftest
//
// Tokens can be perfect while the structure is still the old app: right colours
// and fonts, wrong layout. This reads each artboard, extracts the blocks the
// deck specifies, and looks for the equivalent in the screen's code.
//
// It is a HEURISTIC. A miss means "look at this screen", not "this is broken" —
// but a screen with several misses has not been restructured.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const DECK = 'D:/temp_chrome_download/livio/Livio_UI_source';

// artboard -> the screen file(s) that must realise it
// An artboard with no screen behind it yet. Scoring it against a lookalike
// screen manufactures a pass, so it is reported as unbuilt instead.
const NO_SCREEN = '(no screen in the app)';

const MAP = {
  Home: ['screens/HomeScreen.tsx', 'styles/home.styles.ts', 'screens/FollowingLiveEventsSection.tsx'],
  Login: ['screens/AuthScreens/LoginScreen.tsx', 'styles/login.styles.ts'],
  Register: ['screens/AuthScreens/RegisterScreen.tsx', 'styles/Register.styles.ts'],
  OTP: ['screens/AuthScreens/OTPVerificationScreen.tsx', 'styles/OtpScreen.styles.ts'],
  ForgotPassword: ['screens/AuthScreens/ForgotPasswordScreen/ForgotPassword.tsx',
                   'screens/AuthScreens/ForgotPasswordScreen/EmailStep.tsx',
                   'styles/forgetPassword.styles.ts'],
  EditProfile: ['screens/AuthScreens/EditProfileScreen.tsx'],
  Profile: ['screens/ProfileScreen/OwnProfile.tsx', 'styles/ownProfile.styles.ts',
            'screens/ProfileScreen/MenuContent.tsx'],
  OtherProfile: ['components/ProfileCard.tsx', 'styles/Profile.styles.ts',
                 'screens/ProfileScreen/ProfileScreen.tsx', 'styles/details.styles.ts'],
  FollowersList: ['screens/ProfileScreen/FollowersList.tsx', 'screens/ProfileScreen/FollowerListCard.tsx',
                  'styles/followerScreen.styles.ts'],
  YourEvents: ['screens/ProfileScreen/EventsContent.tsx', 'screens/ProfileScreen/EventCardLive.tsx',
               'styles/ownProfile.styles.ts'],
  TrainingSessions: ['screens/ProfileScreen/TrainingContent.tsx'],
  Membership: ['screens/ProfileScreen/MembershipPlansScreen.tsx', 'styles/membershipPlans.styles.ts'],
  ContactFeedback: ['screens/ProfileScreen/ContactFeedbackScreen.tsx'],
  Settings: ['screens/SettingScreen/LiveTrackingSettingsScreen.tsx',
             'screens/SettingScreen/UserTrackingSettings.tsx', 'styles/liveTrackingSettings.styles.ts'],
  TrackingSettings: [NO_SCREEN],
  EventList: ['screens/FollowerEventList/FollowerEvent.tsx', 'screens/FollowerEventList/LiveTab.tsx',
              'components/EventListCard.tsx', 'styles/event.ts'],
  EventDetail: ['screens/FollowerDetailsList/FollowerDetails.tsx', 'screens/EventDetails/DistanceTab.tsx',
                'styles/details.styles.ts'],
  ParticipantList: ['screens/EventDetails/ParticipantTab.tsx', 'screens/EventDetails/ParticipantCard.tsx',
                    'screens/FollowerDetailsList/FollowerDetails.tsx', 'styles/details.styles.ts'],
  ParticipantSearch: ['screens/ResultList/SearchParticipant.tsx', 'styles/ResultList.styles.ts'],
  ResultList: ['screens/ResultList/ResultList.tsx', 'screens/ResultList/ResultCard.tsx',
               'styles/ResultList.styles.ts'],
  RaceInfo: ['screens/ResultDetailsScreen/RaceInfoTab.tsx', 'screens/ResultDetailsScreen/ResultDetails.tsx',
             'styles/resultDetails.styles.ts'],
  CheckpointHistory: ['screens/ResultDetailsScreen/LiveTimingPoint.tsx',
                      'screens/ResultDetailsScreen/ResultDetails.tsx', 'styles/resultDetails.styles.ts'],
  RunnerInfo: ['screens/ResultDetailsScreen/RunnerInfoTab.tsx',
               'screens/ResultDetailsScreen/ResultDetails.tsx', 'styles/resultDetails.styles.ts'],
  Favourites: ['screens/FavouriteScreen/FavouriteList.tsx', 'screens/FavouriteScreen/FavouriteCard.tsx',
               'styles/favourite.style.ts'],
  FavouriteAthletes: ['screens/FollowerScreen/UserFavouriteList.tsx', 'components/ProfileCard.tsx',
                      'styles/followerScreen.styles.ts'],
  AthleteSearch: ['screens/FollowerScreen/AthleteSearchScreen.tsx', 'styles/followerScreen.styles.ts'],
  FollowerHub: ['screens/FollowerScreen/FollowerScreen.tsx', 'styles/followerScreen.styles.ts'],
  FanHub: ['screens/FollowerScreen/FanScreen.tsx', 'styles/fan.styles.ts'],
  ParticipantHub: ['screens/ParticipantScreen/ParticipantScreen.tsx', 'styles/participantscreen.styles.ts'],
  MapView: ['screens/LiveTrackingScreen.tsx', 'components/DistanceDropdown.tsx',
            'components/ElevationProfile/LiveElevationProfile.tsx', 'styles/liveTracking.styles.ts'],
  CreateEvent: ['screens/PersonalEventScreen/CreatePersonalEvent.tsx', 'styles/personalEvent.styles.ts'],

  // These five artboards had no entry and so were never checked at all.
  // `Main` and `EmptyStates` are pattern sheets, not screens, and stay out.
  ClaimBib: ['screens/EventDetails/ParticipantResult.tsx', 'styles/details.styles.ts'],
  MembershipTerms: ['screens/ProfileScreen/MembershipPlansScreen.tsx', 'styles/membershipPlans.styles.ts'],
  RegistrationModal: ['components/RegistrationModal.tsx', 'styles/details.styles.ts'],
  ResultDetails: ['screens/ResultDetailsScreen/ResultDetails.tsx', 'styles/resultDetails.styles.ts',
                  'screens/ResultList/ResultCard.tsx'],
  TrackingActive: ['screens/HomeScreen.tsx', 'styles/home.styles.ts'],
};

// A deck block, how to spot it in the artboard, and what counts as it in code.
const BLOCKS = [
  {
    id: 'sub-header',
    deck: (h) => /background: #fff; padding: 16px 20px; border-bottom: 1px solid #E4EAF0/.test(h),
    code: (c) => /(headerSection|subHeader|tabBarUnderline|dropdownContainer|profileRow|identityRow|tabStrip|filterRow|pageTitleRow|cardscetion|SearchInput|s\.header)/.test(c),
  },
  {
    id: 'hero-heading',
    // 26px is also the avatar-initials size ("AF", "HD"), so a block only
    // counts as a heading when it actually holds words.
    deck: (h) => [...h.matchAll(/font: 600 26px Poppins[^"]*">([^<]{2,60})/g)]
      .some((m) => /\s/.test(m[1].trim())),
    code: (c) => /(styles\.title|homeStyles\.title|loginStyles\.title|headerTitle|identityName|pageTitle|type\.h1)/.test(c),
  },
  {
    id: 'pill-filters',
    deck: (h) => /border-radius: 20px; padding: 4px/.test(h),
    code: (c) => /(SegmentedFilter|tabItemActive|segmentItemActive)/.test(c),
  },
  {
    id: 'underline-tabs',
    deck: (h) => /border-bottom: 2\.5px solid #C7D92C/.test(h),
    code: (c) => /(tabItemActive|tabItemUnderlineActive|borderBottomColor)/.test(c),
  },
  {
    id: 'thumb-card',
    deck: (h) => /class="thumb"|width: 104px/.test(h),
    code: (c) => /(EventListCard|thumb|eventImg)/.test(c),
  },
  {
    id: 'lime-row-accent',
    deck: (h) => /border-left: 3px solid #C7D92C/.test(h),
    code: (c) => /(rowAccent|borderLeftColor|cardWithLeftBorder)/.test(c),
  },
  {
    id: 'divided-stats',
    deck: (h) => /width: 1px; background: #E4EAF0/.test(h),
    code: (c) => /(statsRow|statCol|verticalDivider|statisticsContainer|twoColRow)/.test(c),
  },
  {
    id: 'section-label',
    deck: (h) => /class="meta"/.test(h),
    // The deck's `.meta` covers stat-column labels too ("Race time", "Started").
    code: (c) => /(sectionLabel|type\.label|cardLabel|statLabel|rowLabel|eventLabel|\.meta\b)/.test(c),
  },
  {
    id: 'rank-circle',
    deck: (h) => /border-radius: 17px; background: #C7D92C/.test(h),
    code: (c) => /(rankCircle|RankBadge|rank\b)/.test(c),
  },
  {
    id: 'form-fields',
    deck: (h) => /class="fld"/.test(h),
    code: (c) => /FloatingLabelInput/.test(c),
  },
];

if (process.argv.includes('--selftest')) {
  const b = BLOCKS.find((x) => x.id === 'section-label');
  const ok1 = b.deck('<div class="meta">Race result</div>') === true;
  const ok2 = b.code('<Text style={resultInfoStyles.sectionLabel}>') === true;
  const ok3 = b.code('<Text style={foo.bar}>') === false;
  for (const [l, v] of [['deck detects a block', ok1], ['code detects it', ok2], ['code stays quiet', ok3]]) {
    console.log(`  ${v ? 'PASS' : 'FAIL'}  ${l}`);
  }
  const ok = ok1 && ok2 && ok3;
  console.log(ok ? '\nself-test passed' : '\nSELF-TEST FAILED');
  process.exit(ok ? 0 : 1);
}

const rows = [];
const unbuilt = [];
for (const [board, files] of Object.entries(MAP)) {
  const art = join(DECK, `${board}.dc.html`);
  if (!existsSync(art)) { rows.push([board, 'ARTBOARD MISSING', []]); continue; }
  // Strip <helmet>: every artboard carries the same CSS boilerplate, so
  // matching against it finds classes the artboard never actually uses.
  const raw = readFileSync(art, 'utf8');
  const html = raw.slice(raw.indexOf('</helmet>') + 1);
  const code = files
    .map((f) => (existsSync(join(ROOT, 'src', f)) ? readFileSync(join(ROOT, 'src', f), 'utf8') : ''))
    .join('\n');
  if (files[0] === NO_SCREEN) { rows.push([board, 'NOT BUILT', []]); unbuilt.push(board); continue; }
  if (!code) { rows.push([board, 'SCREEN MISSING', []]); continue; }

  const expected = BLOCKS.filter((b) => b.deck(html));
  const missing = expected.filter((b) => !b.code(code)).map((b) => b.id);
  rows.push([board, `${expected.length - missing.length}/${expected.length}`, missing]);
}

console.log('\nStructure vs artboard');
console.log('─────────────────────');
console.log('  A miss = the deck has this block, the screen has no equivalent.\n');
let gaps = 0;
for (const [board, score, missing] of rows) {
  const flag = missing.length ? '  <-- ' + missing.join(', ') : '';
  console.log(`  ${board.padEnd(20)} ${String(score).padEnd(8)}${flag}`);
  gaps += missing.length;
}
console.log(`\n  ${gaps} structural gap(s) across ${rows.length - unbuilt.length} screens.`);
if (unbuilt.length) {
  console.log(`  ${unbuilt.length} artboard(s) with no screen in the app yet: ${unbuilt.join(', ')}`);
}
