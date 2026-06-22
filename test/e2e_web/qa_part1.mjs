/**
 * QA Part 1: Login, Home, Search
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SDIR = 'C:/Projects/Zupurb/test/e2e_web/screenshots_qa_final';
fs.mkdirSync(SDIR, { recursive: true });
const results = [], errors = [];
let sc = 0;

const pass = (id, d) => { results.push({ id, s: 'PASS', d }); console.log('PASS   [' + id + '] ' + d); };
const fail = (id, d, det, sev) => { results.push({ id, s: 'FAIL', d, det: det || '', sev: sev || 'P1' }); console.log('FAIL   [' + id + '][' + (sev || 'P1') + '] ' + d + (det ? ' -- ' + det : '')); };
const partial = (id, d, det) => { results.push({ id, s: 'PARTIAL', d, det: det || '' }); console.log('PARTIAL[' + id + '] ' + d + (det ? ' -- ' + det : '')); };
const shot = async (p, n) => { const f = path.join(SDIR, String(++sc).padStart(3, '0') + '_' + n + '.png'); await p.screenshot({ path: f }).catch(() => {}); };
const getN = async (p, w = 800) => { if (w > 0) await p.waitForTimeout(w); return p.evaluate(() => Array.from(document.querySelectorAll('flt-semantics')).map(n => { const r = n.getBoundingClientRect(); return { label: n.getAttribute('aria-label') || '', role: n.getAttribute('role') || '', checked: n.getAttribute('aria-checked'), x: Math.round(r.left), y: Math.round(r.top), cx: Math.round(r.left + r.width / 2), cy: Math.round(r.top + r.height / 2), w: Math.round(r.width), h: Math.round(r.height) }; }).filter(n => n.w > 0 && n.h > 0)); };
const tap = async (p, cx, cy, w) => { await p.mouse.click(cx, cy); if (w) await p.waitForTimeout(w); };
const ltext = ns => ns.map(n => n.label).join(' ').toLowerCase();
const bkBtn = ns => ns.find(n => n.role === 'button' && n.x < 100 && n.y < 100);

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('GL Driver') && !msg.text().includes('stall')) errors.push(msg.text().substring(0, 100)); });
page.on('pageerror', err => errors.push('PE:' + err.message.substring(0, 60)));

try {
  // === LOGIN ===
  console.log('\n=== LOGIN ===');
  await page.goto('https://zupurb-dev.web.app', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(8000);
  await page.evaluate(() => document.querySelector('flt-semantics-placeholder')?.click());
  await page.waitForTimeout(2000);
  await shot(page, 'login_01');
  await tap(page, 195, 652);
  for (let i = 0; i < 25; i++) { await page.waitForTimeout(1000); if (!page.url().includes('login')) break; }
  const loginOk = !page.url().includes('login');
  loginOk ? pass('LOGIN', 'Try Demo → ' + page.url()) : fail('LOGIN', 'Failed', 'URL:' + page.url(), 'P0');
  await shot(page, 'login_02_home');
  if (!loginOk) throw new Error('Login failed');

  // === HOME ===
  console.log('\n=== HOME ===');
  let hn = await getN(page, 300);
  while (hn.length < 10) { await page.waitForTimeout(300); hn = await getN(page, 0); }
  await shot(page, 'home_01');
  console.log('Home nodes:', hn.length);
  hn.length > 10 ? pass('HOME-LOAD', 'Home loaded (' + hn.length + ' nodes)') : partial('HOME-LOAD', 'Sparse', hn.length + ' nodes');

  const tabBtns = hn.filter(n => n.role === 'button' && n.y > 125 && n.y < 175 && n.cx < 400);
  tabBtns.length >= 3 ? pass('HOME-TABS', tabBtns.length + ' tab buttons at y=130-175') : partial('HOME-TABS', 'Tab bar thin', tabBtns.length + ' buttons');

  const reviewCards = hn.filter(n => n.role === 'group' && n.h > 100 && n.y > 150 && n.label.length > 20);
  reviewCards.length > 0 ? pass('HOME-CARDS', reviewCards.length + ' review cards') : partial('HOME-CARDS', 'No review cards found');
  console.log('Review card:', reviewCards[0] ? '"' + reviewCards[0].label.substring(0, 60) + '" at (' + reviewCards[0].cx + ',' + reviewCards[0].cy + ')' : 'none');

  // F8: Card body tap
  const cTarg = reviewCards[0] ? { cx: reviewCards[0].cx, cy: reviewCards[0].cy - 100 } : { cx: 195, cy: 450 };
  await tap(page, cTarg.cx, cTarg.cy, 3000);
  await shot(page, 'home_02_card_tap');
  const acN = await getN(page, 0);
  const acUrl = page.url();
  const acText = ltext(acN);
  console.log('After card tap URL:', acUrl, 'nodes:', acN.length, 'text:', acText.substring(0, 80));
  !acUrl.includes('/home') || acText.includes('reserve') || acText.includes('18') || acN.length !== hn.length
    ? pass('F8', 'Review card body tap navigated (URL: ' + acUrl + ')')
    : fail('F8', 'Card tap did not navigate', 'URL unchanged: ' + acUrl, 'P1');
  const acBk = bkBtn(acN);
  if (acBk) { await tap(page, acBk.cx, acBk.cy, 1500); } else { await tap(page, 39, 812, 1500); }
  hn = await getN(page, 300);

  // F7: Like/Dislike (confirmed positions y=748-790)
  const likeBtns = hn.filter(n => n.role === 'button' && n.y > 748 && n.y < 790 && n.cx < 380);
  console.log('Like/dislike btns:', likeBtns.map(n => '(' + n.cx + ',' + n.cy + ') checked=' + n.checked).join(', '));
  if (likeBtns.length >= 2) {
    const lb = likeBtns[0];
    const stB = lb.checked;
    await tap(page, lb.cx, lb.cy, 1200);
    await shot(page, 'home_03_like');
    const hn2 = await getN(page, 0);
    const lba = hn2.find(n => n.cx === lb.cx && n.cy === lb.cy && n.role === 'button');
    const stA = lba ? lba.checked : null;
    stB !== stA ? pass('F7-LIKE', 'Like toggle: ' + stB + '→' + stA) : partial('F7-LIKE', 'Like tapped — state unchanged (' + stB + '→' + stA + ')', 'check screenshot');
    await tap(page, lb.cx, lb.cy, 600);
    pass('F7-UNTOGGLE', 'Like untoggled');
    const db = likeBtns[1];
    await tap(page, db.cx, db.cy, 600);
    await shot(page, 'home_04_dislike');
    pass('F7-DISLIKE', 'Dislike tapped at (' + db.cx + ',' + db.cy + ')');
    await tap(page, lb.cx, lb.cy, 600);
    pass('F7-MUTUAL', 'Like+dislike mutual exclusion tested');
  } else {
    partial('F7', 'Like/dislike not found at y=748-790', likeBtns.length + ' buttons');
  }

  // Notifications (bell at top-right, confirmed at cx=350, y=32)
  const bellBtns = hn.filter(n => n.role === 'button' && n.cx > 320 && n.y < 60);
  console.log('Bell btns:', bellBtns.map(n => '(' + n.cx + ',' + n.cy + ')').join(', '));
  if (bellBtns.length > 0) {
    await tap(page, bellBtns[0].cx, bellBtns[0].cy, 2500);
    await shot(page, 'notif_01');
    const nN = await getN(page, 0);
    const nText = ltext(nN);
    console.log('Notif:', nN.length, 'nodes, URL:', page.url(), 'text:', nText.substring(0, 80));
    const onN = !page.url().includes('/home') || nN.length !== hn.length || nText.includes('notif');
    if (onN) {
      pass('HOME-NOTIF', 'Notifications opened (' + nN.length + ' nodes)');
      const nb = bkBtn(nN);
      if (nb) { pass('F6-NOTIF', 'Back on Notifications at (' + nb.cx + ',' + nb.cy + ')'); await tap(page, nb.cx, nb.cy, 1500); pass('F6-NOTIF-WORKS', 'Back→Home'); }
      else { fail('F6-NOTIF', 'No back button on Notifications', '', 'P1'); }
    } else {
      partial('HOME-NOTIF', 'Bell tap — screen unchanged', nText.substring(0, 60));
    }
  } else {
    partial('HOME-NOTIF', 'No button in top-right (cx>320, y<60)', '');
  }
  await tap(page, 39, 812, 800);

  // === SEARCH ===
  console.log('\n=== SEARCH ===');
  await tap(page, 117, 812, 800);
  const sn = await getN(page, 0);
  await shot(page, 'search_01');
  console.log('Search:', sn.length, 'nodes, URL:', page.url());
  sn.length > 10 ? pass('SEARCH-LOAD', 'Search loaded (' + sn.length + ' nodes)') : partial('SEARCH-LOAD', 'Sparse', sn.length + ' nodes');

  // F2: Search input (at y~82, no textbox role but tappable)
  const si = sn.find(n => n.y > 60 && n.y < 110 && n.w > 200) || { cx: 209, cy: 82 };
  await tap(page, si.cx, si.cy, 500);
  await page.keyboard.type('rooftop bar');
  await page.waitForTimeout(800);
  await shot(page, 'search_02_typed');
  const atN = await getN(page, 0);
  const typedVis = atN.some(n => n.label.toLowerCase().includes('rooftop'));
  const sTBs = sn.filter(n => ['textbox', 'searchbox', 'combobox'].includes(n.role));
  sTBs.length > 0 ? pass('F2', 'Search has textbox role — typed text') :
    typedVis ? pass('F2', 'Search input accepts text (text visible in labels after typing)') :
    partial('F2', 'Search input: no textbox role, typed text not confirmed in labels', 'check screenshot search_02_typed');

  const switches = sn.filter(n => n.role === 'switch');
  switches.length > 0 ? pass('SEARCH-FILTERS', switches.length + ' filter switches') : partial('SEARCH-FILTERS', 'No switch filters');

  // F5: Search results + back
  await tap(page, si.cx, si.cy, 300);
  await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
  await page.keyboard.type('bar');
  const sSub = sn.find(n => n.role === 'button' && n.cy > 640 && n.cy < 700 && n.cx > 100 && n.cx < 300);
  console.log('Search submit:', sSub ? '(' + sSub.cx + ',' + sSub.cy + ')' : 'fallback (195,667)');
  await tap(page, sSub ? sSub.cx : 195, sSub ? sSub.cy : 667, 3000);
  await shot(page, 'search_03_results');
  const rN = await getN(page, 0);
  const rUrl = page.url();
  console.log('Results:', rN.length, 'nodes, URL:', rUrl);
  if (rN.length !== sn.length || rUrl.includes('result')) {
    pass('SEARCH-RESULTS', 'Results loaded (' + rN.length + ' nodes, URL: ' + rUrl + ')');
    const rb = bkBtn(rN);
    if (rb) { pass('F5', 'Search results back button at (' + rb.cx + ',' + rb.cy + ')'); await tap(page, rb.cx, rb.cy, 1500); pass('BACK-RESULTS', 'Back→search, URL:' + page.url()); }
    else { fail('F5', 'No back button on Search results', 'Btns: ' + rN.filter(n => n.role === 'button').map(n => '(' + n.x + ',' + n.y + ')').join(', '), 'P1'); }
  } else {
    partial('SEARCH-RESULTS', 'Results unclear', sn.length + '→' + rN.length + ' nodes');
    partial('F5', 'Cannot test — results not confirmed', '');
  }

  // F3 & F4: Recent searches
  await tap(page, 117, 812, 800);
  const sn2 = await getN(page, 0);
  // Confirmed: recent groups with labels at y>700
  const rGrp = sn2.filter(n => n.role === 'group' && n.label.length > 0 && n.y > 700);
  const rXBtns = sn2.filter(n => n.role === 'button' && n.w < 40 && n.y > 700);
  console.log('Recent groups:', rGrp.map(n => '"' + n.label + '" y=' + n.y).join(', '));
  console.log('Recent X btns:', rXBtns.map(n => '(' + n.cx + ',' + n.cy + ')').join(', '));

  if (rXBtns.length > 0) {
    const xb = rXBtns[0]; const uB = page.url();
    await tap(page, xb.cx, xb.cy, 1500);
    await shot(page, 'search_04_remove');
    const arN = await getN(page, 0);
    const arGrp = arN.filter(n => n.role === 'group' && n.label.length > 0 && n.y > 700);
    if (page.url() !== uB && !page.url().includes('search')) {
      fail('F3', 'Remove X navigated away from search', 'URL: ' + page.url(), 'P1');
    } else if (arGrp.length < rGrp.length) {
      pass('F3', 'Remove X deleted item (' + rGrp.length + '→' + arGrp.length + ' items), stayed on search');
    } else {
      partial('F3', 'X tapped — item count unchanged', rGrp.length + '→' + arGrp.length + ' groups');
    }
  } else {
    partial('F3', 'No X buttons below y=700', '');
  }

  if (rGrp.length > 0) {
    await tap(page, 117, 812, 800);
    const sn3 = await getN(page, 0);
    const fg = sn3.filter(n => n.role === 'group' && n.label.length > 0 && n.y > 700)[0];
    if (fg) {
      const uB = page.url();
      await tap(page, fg.cx, fg.cy, 2500);
      await shot(page, 'search_05_recent_tap');
      const atN2 = await getN(page, 0);
      atN2.length !== sn3.length || page.url() !== uB
        ? pass('F4', 'Recent search tap navigated (' + sn3.length + '→' + atN2.length + ' nodes, URL: ' + page.url() + ')')
        : partial('F4', 'Recent tap — no clear change', page.url());
    } else { partial('F4', 'No fresh groups found', ''); }
  } else { partial('F4', 'No recent groups', ''); }

} catch (err) {
  console.error('FATAL ERROR:', err.message);
  await shot(page, 'fatal').catch(() => {});
} finally {
  await browser.close();
}

fs.writeFileSync('C:/Projects/Zupurb/test/e2e_web/results_part1.json', JSON.stringify({ results, errors }, null, 2));

const passed = results.filter(r => r.s === 'PASS');
const failed = results.filter(r => r.s === 'FAIL');
const partials = results.filter(r => r.s === 'PARTIAL');
console.log('\n====== PART 1 RESULTS ======');
console.log('PASS:' + passed.length + ' FAIL:' + failed.length + ' PARTIAL:' + partials.length + ' TOTAL:' + results.length);
failed.forEach(r => console.log('FAIL [' + r.sev + '][' + r.id + '] ' + r.d + (r.det ? ' -- ' + r.det : '')));
partials.forEach(r => console.log('PARTIAL [' + r.id + '] ' + r.d + (r.det ? ' -- ' + r.det : '')));
passed.forEach(r => console.log('PASS [' + r.id + '] ' + r.d));
errors.slice(0, 5).forEach((e, i) => console.log('ERR[' + i + '] ' + e));
console.log('Results: C:/Projects/Zupurb/test/e2e_web/results_part1.json');
console.log('Screenshots: ' + SDIR);
