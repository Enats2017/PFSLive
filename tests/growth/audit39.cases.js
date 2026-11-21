// Cases added 2026-10-22 (confirmation of the landscape popup fix): EVERY Home
// popup variant measured in its compact landscape layout, and every popup
// button label measured in its button — en / fr / nl, from the real styles.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { textWidth } = require('../../scripts/text-width.cjs');

const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

module.exports = ({ test, SRC }) => {
  const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\r/g, '');
  const lang = (ns, l) => JSON.parse(fs.readFileSync(path.join(SRC, 'i18n', ns, `${l}.json`), 'utf8'));
  const st = read('styles/home.styles.ts');
  const cs = read('styles/common.styles.ts');
  const block = (src, name) => {
    const m = src.match(new RegExp('\\n\\s*' + name + ': ?\\{([^}]*)\\}'));
    assert.ok(m, 'style ' + name);
    return m[1];
  };
  const num = (b, prop) => {
    const m = b.match(new RegExp('(?:^|[\\s,{])' + prop + ':\\s*(-?)(spacing\\.\\w+|space\\.\\w+|[\\d.]+)'));
    if (!m) return null;
    const v = /^spac/.test(m[2]) ? SPACE[m[2].split('.')[1]] : Number(m[2]);
    return m[1] ? -v : v;
  };
  const lines = (t, W, f, size) => {
    let n = 0;
    for (const para of String(t).split('\n')) {
      n++;
      let cur = '';
      // iOS and Android also break after a hyphen ("Batterij-" / "instellingen")
      for (const x of para.split(/\s+|(?<=-)/).filter(Boolean)) {
        if (textWidth(x, f, size) > W) return Infinity;              // a word wider than the box: split mid-word
        const nx = cur ? (cur.endsWith('-') ? cur + x : cur + ' ' + x) : x;
        if (textWidth(nx, f, size) <= W) cur = nx; else { n++; cur = x; }
      }
    }
    return n;
  };
  // Every variant of the 9 Home popups (title, paragraphs, amber box, buttons)
  const variants = (l) => {
    const h = lang('HomeScreen', l);
    const c = lang('common', l).buttons;
    const g = h.gpsHealth;
    const a = h.alerts;
    return {
      'battery (Android start)': [h.battery.title, [h.battery.message], null, [h.battery.allow, h.battery.startAnyway]],
      'start confirmation': [h.startConfirm.title, [h.startConfirm.message], h.startConfirm.keepOpen, [h.startConfirm.yes, h.startConfirm.no]],
      'stop before the gun': [a.stopBeforeStartTitle, [a.stopBeforeStartMessage], null, [a.keepTracking, a.stopAnyway]],
      'stop after the gun': [a.stopAfterStartTitle, [a.stopAfterStartMessage], null, [a.keepTracking, a.stopAnyway]],
      'manual start': [a.overrideTitle, [a.overrideMessage], null, [a.startNow, a.cancel]],
      'early tracking': [h.earlyTracking.title, [h.earlyTracking.message], null, [h.earlyTracking.yes, h.earlyTracking.no]],
      'location iOS': [g.title, [g.blockedBody, g.stepsIos], null, [g.openSettings, c.close]],
      'location Android': [g.title, [g.blockedBodyDenied, g.stepsAndroidSettings], null, [g.openSettings, c.close]],
      'location off': [g.title, [g.blockedBodyLocationOff, g.stepsLocationOffIos], null, [g.openSettings, c.close]],
      'precise Android': [g.titlePrecise, [g.blockedBodyPrecise, g.stepsPreciseAndroid], null, [g.openSettings, g.startAnyway, c.close]],
      'precise iOS': [g.titlePrecise, [g.blockedBodyPrecise, g.stepsPreciseIos], null, [g.openSettings, g.startAnyway, c.close]],
      'mid-race': [g.titleMidRace, [g.blockedBody], null, [g.openSettings, c.close]],
      'no GPS fix': [g.titleNoFix, [g.blockedBodyNoFix], null, [c.close]],
      'power saving iOS': [h.powerSaving.title, [h.powerSaving.messageIos], null, [c.gotIt]],
      'power saving Android': [h.powerSaving.title, [h.powerSaving.messageAndroid], null, [h.powerSaving.disable, c.close]],
      'notification': ['Your athlete just passed CP 3 — Col du Haut-Jacques', ['Ann Runner passed checkpoint 3 at 10:42, 2 h 12 min into the race.'], null, [c.view, c.close]],
    };
  };

  const card = block(st, 'notifCard');
  // compact styles read softly: on code without them each test fails (not the whole suite)
  const soft = (src, name) => { try { return block(src, name); } catch (e) { return ''; } };
  const cardC = soft(st, 'notifCardCompact');
  const title = block(st, 'notifTitle');
  const body = block(st, 'notifBody');
  const bodyC = soft(st, 'notifBodyCompact');
  const keep = block(st, 'notifKeepOpenBox');
  const keepC = soft(st, 'notifKeepOpenCompact');
  const keepT = block(st, 'notifKeepOpenText');
  const btn = block(cs, 'primaryButton');
  const btnT = block(cs, 'primaryButtonText');
  const GAP = num(block(st, 'notifButtonContainer'), 'gap');
  const BASIS = num(soft(st, 'notifButtonCompact'), 'flexBasis');
  const INNER = num(cardC, 'maxWidth') - 2 * num(card, 'paddingHorizontal');
  const rowsOf = (buttons) => {                                       // flexWrap with flexBasis: how many fit a row
    const per = Math.max(1, Math.floor((INNER + GAP) / (BASIS + GAP)));
    const rows = [];
    for (let i = 0; i < buttons.length; i += per) rows.push(buttons.slice(i, i + per));
    return rows;
  };
  const buttonWidth = (n) => (INNER - (n - 1) * GAP) / n;
  const labelH = (label, bw, s) => {
    const n = lines(label, bw - 2 * num(btn, 'paddingHorizontal'), 'fonts.display', num(btnT, 'fontSize') * s);
    return Math.max(num(btn, 'minHeight'), 2 * num(btn, 'paddingVertical') + n * Math.ceil(num(btnT, 'fontSize') * s * 1.35));
  };
  const heightOf = ([t, bodies, k, buttons]) => {
    let h = 2 * num(cardC, 'paddingVertical');
    h += lines(t, INNER - 80, 'fonts.bodySemi', num(title, 'fontSize')) * Math.ceil(num(title, 'fontSize') * 1.35) + num(title, 'marginBottom');
    for (const b of bodies) h += lines(b, INNER, 'fonts.body', num(body, 'fontSize')) * num(body, 'lineHeight') + num(bodyC, 'marginBottom');
    if (k) {
      h += num(keepC, 'marginTop') + 2 * num(keepC, 'paddingVertical') + num(keepC, 'marginBottom')
        + lines(k, INNER - 2 * num(keep, 'paddingHorizontal') - 2, 'fonts.bodySemi', num(keepT, 'fontSize')) * num(keepT, 'lineHeight');
    }
    rowsOf(buttons).forEach((r, i) => { h += Math.max(...r.map((x) => labelH(x, buttonWidth(r.length), 1))) + (i ? GAP : 0); });
    return h;
  };
  // ModalScroll cap − its 8 + 8 content padding (compact reserve 16)
  const capOf = (H, top, bottom) => H - 2 * Math.max(top, bottom) - 16 - 16;
  const LANDSCAPE = {
    'iPhone 15 / 16 (852×393)': [393, 0, 21],
    'iPhone X-11 Pro (812×375)': [375, 0, 21],
    'iPhone 14 Plus / Pro Max (932×430)': [430, 0, 21],
    'Pixel / Galaxy 411dp gesture': [411, 24, 16],
    'Android 360dp 3-button': [360, 24, 0],
    'Android 360dp gesture': [360, 24, 16],
  };

  test('every Home popup variant fits a landscape iPhone and a 411dp Android WITHOUT scrolling in compact mode (en / fr / nl) — 16 variants × 3 languages', () => {
    const bad = [];
    for (const l of ['en', 'fr', 'nl']) {
      for (const [name, v] of Object.entries(variants(l))) {
        const h = heightOf(v);
        for (const [phone, [H, top, bottom]] of Object.entries(LANDSCAPE)) {
          if (/360dp/.test(phone)) continue;
          if (h > capOf(H, top, bottom)) bad.push(`${l} ${name} on ${phone}: ${h} > ${capOf(H, top, bottom)}`);
        }
      }
    }
    assert.deepStrictEqual(bad, []);
  });

  test('on a 360dp-tall Android only the 3-button precise-location popup is taller than the space — it scrolls (scroll bar shown), by at most ~30pt', () => {
    const over = new Set();
    for (const l of ['en', 'fr', 'nl']) {
      for (const [name, v] of Object.entries(variants(l))) {
        for (const [phone, [H, top, bottom]] of Object.entries(LANDSCAPE).filter(([p]) => /360dp/.test(p))) {
          const extra = heightOf(v) - capOf(H, top, bottom);
          if (extra > 0) { over.add(name); assert.ok(extra <= 30, `${l} ${name} ${phone} +${extra}`); }
        }
      }
    }
    assert.deepStrictEqual([...over].sort().filter((n) => !/^precise/.test(n)), []);
    assert.ok(/showsVerticalScrollIndicator=\{overflows\}/.test(read('components/ui/ModalScroll.tsx')));
  });

  test('compact buttons: two share a row, a third wraps to its own full-width row (flexBasis vs the 472pt card)', () => {
    assert.deepStrictEqual(rowsOf(['a', 'b']).map((r) => r.length), [2]);
    assert.deepStrictEqual(rowsOf(['a', 'b', 'c']).map((r) => r.length), [2, 1]);
    assert.ok(3 * BASIS + 2 * GAP > INNER && 2 * BASIS + GAP <= INNER);
  });

  test('every popup button label fits its button without splitting a word — compact half-width and portrait full-width buttons, 100-135% text (en / fr / nl)', () => {
    const bad = [];
    for (const l of ['en', 'fr', 'nl']) {
      for (const [name, [, , , buttons]] of Object.entries(variants(l))) {
        for (const s of [1, 1.12, 1.24, 1.35]) {
          rowsOf(buttons).forEach((r) => {
            for (const x of r) if (labelH(x, buttonWidth(r.length), s) === Infinity) bad.push(`${l} ${name} compact ×${s} "${x}"`);
          });
          for (const W of [320, 375, 430]) {
            const full = Math.min(400, W - 2 * SPACE.xl) - 2 * num(card, 'paddingHorizontal');
            for (const x of buttons) if (labelH(x, full, s) === Infinity) bad.push(`${l} ${name} ${W}pt ×${s} "${x}"`);
          }
        }
      }
    }
    assert.deepStrictEqual(bad, []);
  });

  test('compact gaps: the amber box sits 4pt under the body (it touched it), the body gap is 8', () => {
    assert.strictEqual(num(bodyC, 'marginBottom') + num(keepC, 'marginTop'), 4);
    assert.strictEqual(num(body, 'marginBottom') + num(keep, 'marginTop'), 12, 'portrait unchanged');
  });
};
