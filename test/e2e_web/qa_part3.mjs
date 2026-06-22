/**
 * QA Part 3: Messages (F9/FIX-12), Settings (F10/F11), Reservation + Review flows
 * Each section uses its own browser context (fresh login) to avoid navigation state pollution
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SDIR = 'C:/Projects/Zupurb/test/e2e_web/screenshots_qa_final';
fs.mkdirSync(SDIR, { recursive: true });
const results = [], errors = [];
let sc = 50;

const pass = (id, d) => { results.push({ id, s: 'PASS', d }); console.log('PASS   [' + id + '] ' + d); };
const fail = (id, d, det, sev) => { results.push({ id, s: 'FAIL', d, det: det || '', sev: sev || 'P1' }); console.log('FAIL   [' + id + '][' + (sev || 'P1') + '] ' + d + (det ? ' -- ' + det : '')); };
const partial = (id, d, det) => { results.push({ id, s: 'PARTIAL', d, det: det || '' }); console.log('PARTIAL[' + id + '] ' + d + (det ? ' -- ' + det : '')); };
const shot = async (p, n) => { const f = path.join(SDIR, String(++sc).padStart(3, '0') + '_' + n + '.png'); await p.screenshot({ path: f }).catch(() => {}); };
const getN = async (p, w = 800) => { if (w > 0) await p.waitForTimeout(w); return p.evaluate(() => Array.from(document.querySelectorAll('flt-semantics')).map(n => { const r = n.getBoundingClientRect(); return { label: n.getAttribute('aria-label') || '', role: n.getAttribute('role') || '', checked: n.getAttribute('aria-checked'), x: Math.round(r.left), y: Math.round(r.top), cx: Math.round(r.left + r.width / 2), cy: Math.round(r.top + r.height / 2), w: Math.round(r.width), h: Math.round(r.height) }; }).filter(n => n.w > 0 && n.h > 0)); };
const tap = async (p, cx, cy, w) => { await p.mouse.click(cx, cy); if (w) await p.waitForTimeout(w); };
const ltext = ns => ns.map(n => n.label).join(' ').toLowerCase();
const bkBtn = ns => ns.find(n => n.role === 'button' && n.x < 100 && n.y < 100);

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

async function freshLogin() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', err => errors.push('PE:' + err.message.substring(0, 60)));
  await page.goto('https://zupurb-dev.web.app', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(8000);
  await page.evaluate(() => document.querySelector('flt-semantics-placeholder')?.click());
  await page.waitForTimeout(2000);
  await tap(page, 195, 652);
  for (let i = 0; i < 25; i++) { await page.waitForTimeout(1000); if (!page.url().includes('login')) break; }
  let n = await page.evaluate(() => document.querySelectorAll('flt-semantics').length);
  while (n < 20) { await page.waitForTimeout(300); n = await page.evaluate(() => document.querySelectorAll('flt-semantics').length); }
  console.log('Logged in:', page.url(), 'nodes:', n);
  return { page, ctx };
}

async function goToEst(page) {
  await tap(page, 195, 812, 2000);
  const dn = await getN(page, 0);
  console.log('Discover nodes:', dn.length, 'URL:', page.url());
  const venueBtn = dn.find(n => n.role === 'button' && n.y > 200 && n.y < 500 && n.w > 100 && n.h > 80) || { cx: 100, cy: 270 };
  console.log('Venue tap at:', venueBtn.cx, venueBtn.cy, 'lbl:', venueBtn.label);
  await tap(page, venueBtn.cx, venueBtn.cy, 3000);
  const ag = await getN(page, 0);
  console.log('After venue tap:', ag.length, 'nodes, URL:', page.url(), 'text:', ltext(ag).substring(0, 100));
  if (ltext(ag).includes('18') || ltext(ag).includes('older') || ltext(ag).includes('age')) {
    const cb = ag.filter(n => n.role === 'button').find(n => n.label.includes('18') || n.label.toLowerCase().includes('older')) || { cx: 195, cy: 734 };
    console.log('Age gate: tapping', cb.cx, cb.cy, cb.label);
    await tap(page, cb.cx, cb.cy, 4000);
  }
  const estN = await getN(page, 500);
  console.log('Est final:', estN.length, 'URL:', page.url(), 'text:', ltext(estN).substring(0, 150));
  return estN;
}

try {

  // ==============================
  // SECTION 1: MESSAGES (F9/FIX-12)
  // ==============================
  console.log('\n=== MESSAGES (F9/FIX-12) ===');
  {
    const { page, ctx } = await freshLogin();
    // Navigate to Messages tab
    await tap(page, 273, 812, 2000);
    const mn = await getN(page, 0);
    await shot(page, 'msg_01_list');
    console.log('Messages:', mn.length, 'nodes, URL:', page.url());
    mn.length > 5 ? pass('MESSAGES-LOAD', 'Messages loaded (' + mn.length + ' nodes)') : fail('MESSAGES-LOAD', 'Messages empty', mn.length + ' nodes', 'P1');

    if (mn.length > 5) {
      const convBtns = mn.filter(n => n.role === 'button' && n.y > 100 && n.y < 700 && n.w > 200 && n.h > 40);
      console.log('Conv buttons:', convBtns.map(n => '(' + n.cx + ',' + n.cy + ') y=' + n.y + ' lbl="' + n.label.substring(0, 30) + '"').join(', '));
      const conv = convBtns[0] || { cx: 195, cy: 206 };

      await tap(page, conv.cx, conv.cy, 3000);
      await shot(page, 'msg_02_chat');
      const cn = await getN(page, 0);
      const cText = ltext(cn);
      const cTBs = cn.filter(n => ['textbox', 'searchbox', 'combobox'].includes(n.role));
      console.log('Chat:', cn.length, 'nodes, URL:', page.url(), 'textboxes:', cTBs.length);
      console.log('Chat text:', cText.substring(0, 200));

      const onChat = cn.length !== mn.length || cTBs.length > 0 || page.url().includes('chat') || page.url().includes('conversation') || cText.includes('send') || cText.includes('type') || cText.includes('message');
      if (onChat) {
        pass('F9-MESSAGES', 'Chat opened (' + cn.length + ' nodes, URL: ' + page.url() + ')');
        cTBs.length > 0 ? pass('MESSAGES-INPUT', 'Chat text input (' + cTBs[0].role + ')') : fail('MESSAGES-INPUT', 'No text input in chat', cText.substring(0, 60), 'P1');
        const cBk = bkBtn(cn);
        if (cBk) {
          pass('MESSAGES-BACK', 'Chat back at (' + cBk.cx + ',' + cBk.cy + ')');
          await tap(page, cBk.cx, cBk.cy, 1500);
          const bkN = await getN(page, 0);
          (bkN.length >= mn.length - 5 || page.url().includes('messages'))
            ? pass('MESSAGES-BACK-WORKS', 'Back → messages list (' + page.url() + ')')
            : partial('MESSAGES-BACK-WORKS', 'Back pressed, URL: ' + page.url() + ' nodes:' + bkN.length);
        } else { fail('MESSAGES-BACK', 'No back button in chat', '', 'P1'); }
      } else {
        // Different node count might mean it opened. Check URL or screenshot.
        await shot(page, 'msg_03_debug');
        fail('F9-MESSAGES', 'Conv tap did not open chat', 'URL:' + page.url() + ' nodes:' + cn.length + ' vs ' + mn.length, 'P1');
      }
    }
    await ctx.close();
  }

  // ==============================
  // SECTION 2: ESTABLISHMENT + RESERVATION FLOW
  // ==============================
  console.log('\n=== ESTABLISHMENT + RESERVATION FLOW ===');
  {
    const { page, ctx } = await freshLogin();
    const estN = await goToEst(page);
    const estText = ltext(estN);
    await shot(page, 'est_01_main');

    const estBtns = estN.filter(n => n.role === 'button' && n.y > 300);
    const reserveBtn = estN.find(n => n.role === 'button' && n.label.toLowerCase().includes('reserve')) ||
      estBtns.find(n => n.cx > 250 && n.w > 100);
    const writeBtn = estN.find(n => n.role === 'button' && (n.label.toLowerCase().includes('write') || n.label.toLowerCase().includes('review'))) ||
      estBtns.find(n => n.cx < 200 && n.cx > 50);
    console.log('Reserve btn:', reserveBtn ? '(' + reserveBtn.cx + ',' + reserveBtn.cy + ') "' + reserveBtn.label + '"' : 'none');
    console.log('Write btn:', writeBtn ? '(' + writeBtn.cx + ',' + writeBtn.cy + ') "' + writeBtn.label + '"' : 'none');
    console.log('All btns below 300:', estBtns.map(n => '(' + n.cx + ',' + n.cy + ') w=' + n.w + ' lbl="' + n.label.substring(0, 30) + '"').join(', '));

    const onEst = estText.includes('reserve') || estText.includes('write') || estText.includes('social') || estText.includes('rooftop') || estText.includes('lounge') || (estN.length > 10 && !page.url().includes('discover') && !page.url().includes('home') && !page.url().includes('messages'));
    if (onEst) {
      pass('EST-LOAD', 'Establishment loaded (' + estN.length + ' nodes)');
      const estBk = bkBtn(estN);
      if (estBk) {
        pass('F6-EST-BACK', 'Back on Establishment at (' + estBk.cx + ',' + estBk.cy + ')');
        await tap(page, estBk.cx, estBk.cy, 1500);
        const afterBk = await getN(page, 0);
        console.log('After est back:', afterBk.length, 'URL:', page.url());
        // Go back to establishment
        const estN2 = await goToEst(page);
        const estBtns2 = estN2.filter(n => n.role === 'button' && n.y > 300);
        const reserveBtn2 = estN2.find(n => n.role === 'button' && n.label.toLowerCase().includes('reserve')) ||
          estBtns2.find(n => n.cx > 250 && n.w > 100);
        if (reserveBtn2) {
          await tap(page, reserveBtn2.cx, reserveBtn2.cy, 3000);
          await shot(page, 'res_01_timeslot');
          const tsN = await getN(page, 0);
          const tsText = ltext(tsN);
          console.log('TimeSlot:', tsN.length, 'nodes, URL:', page.url(), 'text:', tsText.substring(0, 200));

          const onTS = tsText.includes('time') || tsText.includes('party') || tsText.includes('guest') || tsText.includes('slot') || tsText.includes('reservation') || tsText.includes('date') || tsText.includes('pick');
          if (onTS) {
            pass('RES-TIMESLOT', 'Time Slot loaded (' + tsN.length + ' nodes)');
            const tsBack = bkBtn(tsN);
            tsBack ? pass('F6-TIMESLOT', 'Back on Time Slot at (' + tsBack.cx + ',' + tsBack.cy + ')') : fail('F6-TIMESLOT', 'No back on Time Slot', '', 'P1');

            const tsCont = tsN.find(n => n.role === 'button' && (n.label.toLowerCase().includes('continue') || n.label.toLowerCase().includes('save') || n.label.toLowerCase().includes('next'))) ||
              tsN.filter(n => n.role === 'button' && n.y > 650 && n.w > 150)[0];
            console.log('TS Continue:', tsCont ? '(' + tsCont.cx + ',' + tsCont.cy + ') "' + tsCont.label + '"' : 'none');

            if (tsCont) {
              await tap(page, tsCont.cx, tsCont.cy, 3000);
              await shot(page, 'res_02_confirm');
              const cbN = await getN(page, 0);
              const cbText = ltext(cbN);
              console.log('ConfirmBooking:', cbN.length, 'nodes, URL:', page.url(), 'text:', cbText.substring(0, 200));

              const onCB = cbText.includes('confirm') || cbText.includes('booking') || cbText.includes('guest') || cbText.includes('change') || cbText.includes('reservation');
              if (onCB) {
                pass('RES-CONFIRM', 'Confirm Booking loaded (' + cbN.length + ' nodes)');
                const cbBack = bkBtn(cbN);
                cbBack ? pass('F6-CONFIRM', 'Back on Confirm Booking at (' + cbBack.cx + ',' + cbBack.cy + ')') : fail('F6-CONFIRM', 'No back on Confirm Booking', '', 'P1');
                cbText.includes('change') ? pass('RES-CHANGE', '"Change Time" present') : partial('RES-CHANGE', '"Change Time" not confirmed in: ' + cbText.substring(0, 60));

                const finalBtn = cbN.find(n => n.role === 'button' && (n.label.toLowerCase().includes('confirm') || n.label.toLowerCase().includes('book'))) ||
                  cbN.filter(n => n.role === 'button' && n.y > 600 && n.w > 150)[0];
                if (finalBtn) {
                  await tap(page, finalBtn.cx, finalBtn.cy, 4000);
                  await shot(page, 'res_03_pass');
                  const passN = await getN(page, 0);
                  const passText = ltext(passN);
                  console.log('ResPass:', passN.length, 'nodes, URL:', page.url(), 'text:', passText.substring(0, 200));
                  const onPass = passText.includes('pass') || passText.includes('qr') || passText.includes('confirmed') || passText.includes('booking') || passText.includes('check-in') || passText.includes('reservation');
                  onPass ? pass('RES-PASS', 'Reservation Pass/confirmation loaded') : partial('RES-PASS', 'After confirm state unclear', passText.substring(0, 80));
                } else { partial('RES-FINAL', 'No final confirm btn found', cbText.substring(0, 80)); }
              } else { fail('RES-CONFIRM', 'Confirm Booking not reached', cbText.substring(0, 80), 'P1'); }
            } else { partial('RES-CONT', 'No Continue btn on Time Slot', tsText.substring(0, 80)); }
          } else { fail('RES-TIMESLOT', 'Time Slot not loaded after tapping Reserve', tsText.substring(0, 80), 'P1'); }
        } else { fail('EST-RESERVE', 'Reserve button not found on return to Establishment', ltext(estN2).substring(0, 80), 'P1'); }
      } else { fail('F6-EST-BACK', 'No back on Establishment', '', 'P1'); }
    } else {
      fail('EST-LOAD', 'Establishment not reached via Discover', estText.substring(0, 80), 'P1');
    }
    await ctx.close();
  }

  // ==============================
  // SECTION 3: REVIEW FLOW
  // ==============================
  console.log('\n=== REVIEW FLOW ===');
  {
    const { page, ctx } = await freshLogin();
    const estN = await goToEst(page);
    const estRText = ltext(estN);
    const estRBtns = estN.filter(n => n.role === 'button' && n.y > 300 && n.w > 100);
    const writeBtn = estN.find(n => n.role === 'button' && (n.label.toLowerCase().includes('write') || n.label.toLowerCase().includes('review'))) ||
      estRBtns.find(n => n.cx < 220 && n.cx > 50);
    console.log('Write review:', writeBtn ? '(' + writeBtn.cx + ',' + writeBtn.cy + ') "' + writeBtn.label + '"' : 'none');
    console.log('Est btns:', estRBtns.map(n => '(' + n.cx + ',' + n.cy + ') lbl="' + n.label.substring(0, 30) + '"').join(', '));
    await shot(page, 'review_est');

    if (writeBtn) {
      await tap(page, writeBtn.cx, writeBtn.cy, 3000);
      await shot(page, 'review_01_verify');
      const vvN = await getN(page, 0);
      const vvText = ltext(vvN);
      console.log('VerifyVisit:', vvN.length, 'URL:', page.url(), 'text:', vvText.substring(0, 200));

      const onVV = vvText.includes('verify') || vvText.includes('visit') || vvText.includes('photo') || vvText.includes('location') || vvText.includes('continue') || vvText.includes('receipt') || vvText.includes('check');
      if (onVV) {
        pass('REVIEW-VERIFY', 'Verify Visit loaded (' + vvN.length + ' nodes)');
        bkBtn(vvN) ? pass('F6-VV', 'Back on Verify Visit') : fail('F6-VV', 'No back on Verify Visit', '', 'P1');

        const vvCont = vvN.find(n => n.role === 'button' && (n.label.toLowerCase().includes('continue') || n.label.toLowerCase().includes('skip') || n.label.toLowerCase().includes('next'))) ||
          vvN.filter(n => n.role === 'button' && n.y > 650 && n.w > 150)[0];
        console.log('VV continue:', vvCont ? '(' + vvCont.cx + ',' + vvCont.cy + ') "' + vvCont.label + '"' : 'none');
        if (vvCont) {
          await tap(page, vvCont.cx, vvCont.cy, 2500);
          await shot(page, 'review_02_rate');
          const reN = await getN(page, 0);
          const reText = ltext(reN);
          console.log('RateExp:', reN.length, 'URL:', page.url(), 'text:', reText.substring(0, 200));

          const onRate = reText.includes('rate') || reText.includes('experience') || reText.includes('food') || reText.includes('service') || reText.includes('atmosphere') || reText.includes('star') || reText.includes('thumb');
          if (onRate) {
            pass('REVIEW-RATE', 'Rate Experience loaded (' + reN.length + ' nodes)');
            bkBtn(reN) ? pass('F6-RATE', 'Back on Rate Experience') : fail('F6-RATE', 'No back on Rate Experience', '', 'P1');

            const reCont = reN.find(n => n.role === 'button' && (n.label.toLowerCase().includes('continue') || n.label.toLowerCase().includes('next'))) ||
              reN.filter(n => n.role === 'button' && n.y > 650 && n.w > 150)[0];
            console.log('Rate continue:', reCont ? '(' + reCont.cx + ',' + reCont.cy + ') "' + reCont.label + '"' : 'none');
            if (reCont) {
              await tap(page, reCont.cx, reCont.cy, 2500);
              await shot(page, 'review_03_disclosure');
              const cdN = await getN(page, 0);
              const cdText = ltext(cdN);
              console.log('Disclosure:', cdN.length, 'URL:', page.url(), 'text:', cdText.substring(0, 200));

              const onCD = cdText.includes('creator') || cdText.includes('disclosure') || cdText.includes('affiliated') || cdText.includes('partner') || cdText.includes('brand');
              if (onCD) {
                pass('REVIEW-DISCLOSURE', 'Creator Disclosure loaded');
                bkBtn(cdN) ? pass('F6-DISCLOSURE', 'Back on Disclosure') : fail('F6-DISCLOSURE', 'No back on Disclosure', '', 'P1');

                const cdCont = cdN.find(n => n.role === 'button' && (n.label.toLowerCase().includes('confirm') || n.label.toLowerCase().includes('continue') || n.label.toLowerCase().includes('none') || n.label.toLowerCase().includes('no'))) ||
                  cdN.filter(n => n.role === 'button' && n.y > 650 && n.w > 150)[0];
                console.log('Disclosure continue:', cdCont ? '(' + cdCont.cx + ',' + cdCont.cy + ') "' + cdCont.label + '"' : 'none');
                if (cdCont) {
                  await tap(page, cdCont.cx, cdCont.cy, 2500);
                  await shot(page, 'review_04_written');
                  const wrN = await getN(page, 0);
                  const wrTBs = wrN.filter(n => ['textbox', 'searchbox', 'combobox'].includes(n.role));
                  const wrText = ltext(wrN);
                  console.log('WrittenReview:', wrN.length, 'tbs:', wrTBs.length, 'URL:', page.url(), 'text:', wrText.substring(0, 200));

                  const onWR = wrTBs.length > 0 || wrText.includes('review') || wrText.includes('write') || wrText.includes('describe') || wrText.includes('tell');
                  if (onWR) {
                    pass('REVIEW-WRITTEN', 'Written Review loaded (' + wrN.length + ' nodes)');
                    wrTBs.length > 0 ? pass('REVIEW-TEXTAREA', 'Text area: ' + wrTBs[0].role) : partial('REVIEW-TEXTAREA', 'No textbox role found');
                    bkBtn(wrN) ? pass('F6-WRITTEN', 'Back on Written Review') : fail('F6-WRITTEN', 'No back on Written Review', '', 'P1');
                    if (wrTBs.length > 0) { await tap(page, wrTBs[0].cx, wrTBs[0].cy, 300); await page.keyboard.type('Great atmosphere!'); await page.waitForTimeout(300); }
                    const subBtn = wrN.find(n => n.role === 'button' && (n.label.toLowerCase().includes('submit') || n.label.toLowerCase().includes('publish') || n.label.toLowerCase().includes('post'))) ||
                      wrN.filter(n => n.role === 'button' && n.y > 650 && n.w > 150)[0];
                    console.log('Submit btn:', subBtn ? '(' + subBtn.cx + ',' + subBtn.cy + ') "' + subBtn.label + '"' : 'none');
                    if (subBtn) {
                      await tap(page, subBtn.cx, subBtn.cy, 4000);
                      await shot(page, 'review_05_submitted');
                      const rsN = await getN(page, 0);
                      const rsText = ltext(rsN);
                      console.log('Submitted:', rsN.length, 'URL:', page.url(), 'text:', rsText.substring(0, 250));
                      const onRS = rsText.includes('pts') || rsText.includes('points') || rsText.includes('badge') || rsText.includes('taster') || rsText.includes('earned') || rsText.includes('congratulation') || rsText.includes('thank') || rsText.includes('submitted') || rsText.includes('review');
                      onRS ? pass('REVIEW-SUBMITTED', 'Review Submitted loaded') : partial('REVIEW-SUBMITTED', 'Submitted state unclear', rsText.substring(0, 80));
                      rsText.includes('share') ? pass('F9-SHARE', '"Share Your Review" present') : fail('F9-SHARE', '"Share Your Review" not found', rsText.substring(0, 60), 'P2');
                      rsText.includes('explore') ? pass('REVIEW-EXPLORE', '"Explore More Spots" present') : partial('REVIEW-EXPLORE', 'Not confirmed: ' + rsText.substring(0, 60));
                    } else { partial('REVIEW-SUB', 'Submit btn not found', wrText.substring(0, 80)); }
                  } else { partial('REVIEW-WRITTEN', 'Written Review state unclear', wrText.substring(0, 80)); }
                } else { partial('REVIEW-CD-CONT', 'No Continue on Disclosure', cdText.substring(0, 80)); }
              } else { partial('REVIEW-DISCLOSURE', 'Disclosure state unclear', cdText.substring(0, 80)); }
            } else { partial('REVIEW-RATE-CONT', 'No Continue on Rate Exp', reText.substring(0, 80)); }
          } else { partial('REVIEW-RATE', 'Rate Exp state unclear', reText.substring(0, 80)); }
        } else { partial('REVIEW-VV-CONT', 'No Continue on Verify Visit', vvText.substring(0, 80)); }
      } else { fail('REVIEW-VERIFY', 'Verify Visit not loaded after Write Review tap', vvText.substring(0, 80), 'P1'); }
    } else { fail('REVIEW-NO-BTN', 'Write Review button not found on Establishment', estRText.substring(0, 60), 'P1'); }
    await ctx.close();
  }

  // ==============================
  // SECTION 4: SETTINGS (F10/F11)
  // ==============================
  console.log('\n=== SETTINGS (F10/F11) ===');
  {
    const { page, ctx } = await freshLogin();
    // Navigate to Profile tab first
    await tap(page, 351, 812, 2000);
    const pN = await getN(page, 0);
    await shot(page, 'settings_profile');
    console.log('Profile:', pN.length, 'nodes, URL:', page.url());
    console.log('Profile btns:', pN.filter(n => n.role === 'button').map(n => '(' + n.cx + ',' + n.cy + ') y=' + n.y + ' lbl="' + n.label.substring(0, 30) + '"').join(', '));

    // Try settings icon at top-right (should be around cx=351-370, y=12-50)
    const settingsIconBtn = pN.filter(n => n.role === 'button').find(n => n.cx > 300 && n.y < 60);
    console.log('Settings icon candidate:', settingsIconBtn ? '(' + settingsIconBtn.cx + ',' + settingsIconBtn.cy + ') lbl="' + settingsIconBtn.label + '"' : 'none');
    if (settingsIconBtn) {
      await tap(page, settingsIconBtn.cx, settingsIconBtn.cy, 2500);
    } else {
      await tap(page, 351, 32, 2500);
    }
    await shot(page, 'settings_attempt1');
    const s1N = await getN(page, 0);
    const s1Text = ltext(s1N);
    console.log('After icon tap:', s1N.length, 'URL:', page.url(), 'text:', s1Text.substring(0, 100));

    // If it's notifications (not settings), go back and try hash nav
    if (!s1Text.includes('settings') && !s1Text.includes('personal') && !s1Text.includes('privacy') && !s1Text.includes('delete') && !s1Text.includes('logout')) {
      const bk = bkBtn(s1N);
      if (bk) await tap(page, bk.cx, bk.cy, 1000);
    }

    // Use hash navigation to settings (most reliable)
    await page.evaluate(() => { window.location.hash = '/settings'; });
    await page.waitForTimeout(3000);
    await shot(page, 'settings_hash');

    const sN = await getN(page, 0);
    const sText = ltext(sN);
    const sBtns = sN.filter(n => n.role === 'button');
    console.log('Settings:', sN.length, 'URL:', page.url(), 'text:', sText.substring(0, 300));
    console.log('Settings btns:', sBtns.map(n => '(' + n.cx + ',' + n.cy + ') y=' + n.y + ' lbl="' + n.label.substring(0, 40) + '"').join(', '));

    const onSettings = sN.length > 5 && page.url().includes('settings');
    if (onSettings) {
      pass('SETTINGS-LOAD', 'Settings loaded (' + sN.length + ' nodes)');

      // F10-PERSONAL INFO
      const piBtn = sBtns.find(n => n.label.toLowerCase().includes('personal')) || sBtns.find(n => n.y > 80 && n.y < 200 && n.x > 30);
      if (piBtn) {
        await tap(page, piBtn.cx, piBtn.cy, 2000);
        await shot(page, 'settings_personal');
        const piN = await getN(page, 0);
        const piText = ltext(piN);
        console.log('Personal Info:', piN.length, 'URL:', page.url(), 'text:', piText.substring(0, 150));
        piText.includes('coming') ? pass('F10-PERSONAL', '"Coming soon" on Personal Info') :
          partial('F10-PERSONAL', 'Personal Info result: ' + piText.substring(0, 80));
      } else { partial('F10-PERSONAL', 'Personal Info btn not found in: ' + sText.substring(0, 80)); }

      await page.evaluate(() => { window.location.hash = '/settings'; });
      await page.waitForTimeout(2500);
      const sN2 = await getN(page, 0);
      const sBtns2 = sN2.filter(n => n.role === 'button');

      // F10-EMAIL PREFS
      const epBtn = sBtns2.find(n => n.label.toLowerCase().includes('email') || n.label.toLowerCase().includes('notification') || n.label.toLowerCase().includes('marketing'));
      if (epBtn) {
        await tap(page, epBtn.cx, epBtn.cy, 2000);
        await shot(page, 'settings_email');
        const epN = await getN(page, 0);
        const epText = ltext(epN);
        console.log('Email Prefs:', epN.length, 'URL:', page.url(), 'text:', epText.substring(0, 150));
        epText.includes('coming') ? pass('F10-EMAIL', '"Coming soon" on Email Prefs') :
          partial('F10-EMAIL', 'Email Prefs result: ' + epText.substring(0, 80));
      } else { partial('F10-EMAIL', 'Email Prefs btn not found'); }

      await page.evaluate(() => { window.location.hash = '/settings'; });
      await page.waitForTimeout(2500);
      const sN3 = await getN(page, 0);
      const sBtns3 = sN3.filter(n => n.role === 'button');

      // PRIVACY SETTINGS
      const privBtn = sBtns3.find(n => n.label.toLowerCase().includes('privacy') || n.label.toLowerCase().includes('data'));
      if (privBtn) {
        await tap(page, privBtn.cx, privBtn.cy, 2500);
        await shot(page, 'settings_privacy');
        const privN = await getN(page, 0);
        const privText = ltext(privN);
        console.log('Privacy:', privN.length, 'URL:', page.url(), 'text:', privText.substring(0, 150));
        const onPriv = privText.includes('privacy') || privText.includes('data') || privText.includes('location') || privText.includes('who can') || !page.url().includes('/settings');
        if (onPriv) {
          pass('SETTINGS-PRIVACY', 'Privacy Settings opened (' + privN.length + ' nodes)');
          const privBk = bkBtn(privN);
          privBk ? pass('SETTINGS-PRIVACY-BACK', 'Back on Privacy Settings') : fail('SETTINGS-PRIVACY-BACK', 'No back on Privacy Settings', '', 'P1');
          if (privBk) await tap(page, privBk.cx, privBk.cy, 1500);
        } else { fail('SETTINGS-PRIVACY', 'Privacy Settings did not open', privText.substring(0, 60), 'P1'); }
      } else { partial('SETTINGS-PRIVACY', 'Privacy btn not found'); }

      await page.evaluate(() => { window.location.hash = '/settings'; });
      await page.waitForTimeout(2500);
      const sN4 = await getN(page, 0);
      const sBtns4 = sN4.filter(n => n.role === 'button');

      // F10-DELETE ACCOUNT
      const delBtn = sBtns4.find(n => n.label.toLowerCase().includes('delete'));
      console.log('Delete btn:', delBtn ? '(' + delBtn.cx + ',' + delBtn.cy + ') "' + delBtn.label + '"' : 'not found');
      if (delBtn) {
        await tap(page, delBtn.cx, delBtn.cy, 2000);
        await shot(page, 'settings_delete');
        const dlgN = await getN(page, 0);
        const dlgText = ltext(dlgN);
        const dlgBtns = dlgN.filter(n => n.role === 'button');
        console.log('Delete result:', dlgN.length, 'btns:', dlgBtns.length, 'text:', dlgText.substring(0, 150));
        const hasDialog = dlgText.includes('delete') && (dlgText.includes('confirm') || dlgText.includes('cancel') || dlgText.includes('sure') || dlgBtns.length >= 2);
        hasDialog ? pass('F10-DELETE', 'Delete Account → confirmation dialog (' + dlgBtns.length + ' btns)') :
          partial('F10-DELETE', 'Delete tap result: ' + dlgText.substring(0, 80));
        const cancelBtn = dlgBtns.find(n => n.label.toLowerCase().includes('cancel') || n.label.toLowerCase().includes('no') || n.label.toLowerCase().includes('keep'));
        if (cancelBtn) await tap(page, cancelBtn.cx, cancelBtn.cy, 500);
      } else { fail('F10-DELETE', 'Delete Account btn not found', ltext(sN4).substring(0, 80), 'P1'); }

      await page.evaluate(() => { window.location.hash = '/settings'; });
      await page.waitForTimeout(2500);
      const sN5 = await getN(page, 0);
      const sBtns5 = sN5.filter(n => n.role === 'button');
      console.log('Logout search in:', sBtns5.map(n => '"' + n.label.substring(0, 30) + '"').join(', '));
      const logBtn = sBtns5.find(n => n.label.toLowerCase().includes('log out') || n.label.toLowerCase().includes('logout') || n.label.toLowerCase().includes('sign out'));
      logBtn ? pass('SETTINGS-LOGOUT', 'Logout button: "' + logBtn.label + '"') : partial('SETTINGS-LOGOUT', 'Logout not found by label, checking position...');

      if (!logBtn) {
        // Logout is typically the last button, check bottom of settings
        const bottomBtns = sBtns5.filter(n => n.y > 700).sort((a, b) => b.y - a.y);
        console.log('Bottom btns:', bottomBtns.map(n => '(' + n.cx + ',' + n.cy + ') lbl="' + n.label + '"').join(', '));
      }

    } else {
      fail('SETTINGS-LOAD', 'Settings not loaded', sN.length + ' nodes, URL: ' + page.url(), 'P1');
    }
    await ctx.close();
  }

} catch (err) {
  console.error('FATAL:', err.message);
  console.error(err.stack ? err.stack.split('\n').slice(0, 5).join('\n') : '');
} finally {
  await browser.close().catch(() => {});
}

fs.writeFileSync('C:/Projects/Zupurb/test/e2e_web/results_part3.json', JSON.stringify({ results, errors }, null, 2));

const passed = results.filter(r => r.s === 'PASS');
const failed = results.filter(r => r.s === 'FAIL');
const partials = results.filter(r => r.s === 'PARTIAL');
console.log('\n====== PART 3 RESULTS ======');
console.log('PASS:' + passed.length + ' FAIL:' + failed.length + ' PARTIAL:' + partials.length + ' TOTAL:' + results.length);
failed.forEach(r => console.log('FAIL [' + r.sev + '][' + r.id + '] ' + r.d + (r.det ? ' -- ' + r.det : '')));
partials.forEach(r => console.log('PARTIAL [' + r.id + '] ' + r.d + (r.det ? ' -- ' + r.det : '')));
passed.forEach(r => console.log('PASS [' + r.id + '] ' + r.d));
console.log('Results: C:/Projects/Zupurb/test/e2e_web/results_part3.json');
