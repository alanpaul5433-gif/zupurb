/**
 * QA Part 2: Discover/Age Gate, Establishment, Reservation, Review, Messages, Profile, Settings, Routes
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SDIR = 'C:/Projects/Zupurb/test/e2e_web/screenshots_qa_final';
fs.mkdirSync(SDIR, { recursive: true });
const results = [], errors = [];
let sc = 30; // continue numbering from part1

const pass = (id, d) => { results.push({ id, s: 'PASS', d }); console.log('PASS   [' + id + '] ' + d); };
const fail = (id, d, det, sev) => { results.push({ id, s: 'FAIL', d, det: det || '', sev: sev || 'P1' }); console.log('FAIL   [' + id + '][' + (sev || 'P1') + '] ' + d + (det ? ' -- ' + det : '')); };
const partial = (id, d, det) => { results.push({ id, s: 'PARTIAL', d, det: det || '' }); console.log('PARTIAL[' + id + '] ' + d + (det ? ' -- ' + det : '')); };
const shot = async (p, n) => { const f = path.join(SDIR, String(++sc).padStart(3, '0') + '_' + n + '.png'); await p.screenshot({ path: f }).catch(() => {}); };
const getN = async (p, w = 800) => { if (w > 0) await p.waitForTimeout(w); return p.evaluate(() => Array.from(document.querySelectorAll('flt-semantics')).map(n => { const r = n.getBoundingClientRect(); return { label: n.getAttribute('aria-label') || '', role: n.getAttribute('role') || '', checked: n.getAttribute('aria-checked'), x: Math.round(r.left), y: Math.round(r.top), cx: Math.round(r.left + r.width / 2), cy: Math.round(r.top + r.height / 2), w: Math.round(r.width), h: Math.round(r.height) }; }).filter(n => n.w > 0 && n.h > 0)); };
const tap = async (p, cx, cy, w) => { await p.mouse.click(cx, cy); if (w) await p.waitForTimeout(w); };
const ltext = ns => ns.map(n => n.label).join(' ').toLowerCase();
const bkBtn = ns => ns.find(n => n.role === 'button' && n.x < 100 && n.y < 100);

/** Navigate to establishment by tapping venue on discover screen */
async function goToEstablishment(page) {
  await tap(page, 195, 812, 800); // Discover tab
  const dn = await getN(page, 0);
  // Venue button at y~270 in Discover (confirmed)
  const venueBtn = dn.find(n => n.role === 'button' && n.y > 200 && n.y < 450 && n.w > 100 && n.h > 100) || { cx: 100, cy: 270 };
  await tap(page, venueBtn.cx, venueBtn.cy, 2500);
  const ag = await getN(page, 0);
  const agText = ltext(ag);
  if (agText.includes('18') || agText.includes('older')) {
    // Click 'I am 18 or older' (confirmed label)
    const confirmBtn = ag.filter(n => n.role === 'button').find(n => n.label.includes('18') || n.label.toLowerCase().includes('older')) || { cx: 195, cy: 734 };
    await tap(page, confirmBtn.cx, confirmBtn.cy, 3500);
  }
  return getN(page, 300);
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('GL Driver') && !msg.text().includes('stall')) errors.push(msg.text().substring(0, 100)); });
page.on('pageerror', err => errors.push('PE:' + err.message.substring(0, 60)));

try {
  // === LOGIN ===
  await page.goto('https://zupurb-dev.web.app', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(8000);
  await page.evaluate(() => document.querySelector('flt-semantics-placeholder')?.click());
  await page.waitForTimeout(2000);
  await tap(page, 195, 652);
  for (let i = 0; i < 25; i++) { await page.waitForTimeout(1000); if (!page.url().includes('login')) break; }
  if (page.url().includes('login')) throw new Error('Login failed');
  console.log('Logged in:', page.url());
  let hn = await getN(page, 300);
  while (hn.length < 10) { await page.waitForTimeout(300); hn = await getN(page, 0); }
  console.log('Home nodes:', hn.length);

  // === DISCOVER + F1 AGE GATE ===
  console.log('\n=== DISCOVER + AGE GATE (F1) ===');
  await tap(page, 195, 812, 800);
  const dn = await getN(page, 0);
  await shot(page, 'discover_01');
  console.log('Discover:', dn.length, 'nodes, URL:', page.url());
  dn.length > 5 ? pass('DISCOVER-LOAD', 'Discover loaded (' + dn.length + ' nodes)') : partial('DISCOVER-LOAD', 'Sparse', dn.length + ' nodes');

  const venueBtn = dn.find(n => n.role === 'button' && n.y > 200 && n.y < 450 && n.w > 100 && n.h > 100) || { cx: 100, cy: 270 };
  console.log('Venue btn:', venueBtn.cx, venueBtn.cy);
  await tap(page, venueBtn.cx, venueBtn.cy, 2500);
  await shot(page, 'discover_02_tap');
  const ageN = await getN(page, 0);
  const ageText = ltext(ageN);
  console.log('Age gate:', ageN.length, 'nodes, text:', ageText.substring(0, 200));
  const ageBtns = ageN.filter(n => n.role === 'button');
  console.log('Age gate buttons:', ageBtns.map(n => '"' + n.label + '" (' + n.cx + ',' + n.cy + ')').join(', '));

  const confirmBtn = ageBtns.find(n => n.label.includes('18') || n.label.toLowerCase().includes('older'));
  const goBackBtn = ageBtns.find(n => n.label.toLowerCase().includes('go back') || n.label.toLowerCase().includes('without confirming'));

  if (confirmBtn || ageText.includes('18') || ageText.includes('age verif')) {
    pass('DISCOVER-AGE-GATE', 'Age gate appeared with labeled buttons');

    // Test "Go back without confirming age"
    if (goBackBtn) {
      await tap(page, goBackBtn.cx, goBackBtn.cy, 1500);
      await shot(page, 'discover_03_go_back');
      const afterGB = await getN(page, 0);
      const gbText = ltext(afterGB);
      !gbText.includes('older') || page.url().includes('discover')
        ? pass('F1-GO-BACK', '"Go back without confirming age" dismissed gate')
        : fail('F1-GO-BACK', '"Go Back" did not dismiss', '', 'P1');
      // Re-tap venue
      await tap(page, venueBtn.cx, venueBtn.cy, 2500);
      await getN(page, 0);
    }

    // Test "I am 18 or older, continue"
    const ageN2 = await getN(page, 0);
    const confirmBtn2 = ageN2.filter(n => n.role === 'button').find(n => n.label.includes('18') || n.label.toLowerCase().includes('older')) || { cx: 195, cy: 734 };
    console.log('Clicking 18+ at:', confirmBtn2.cx, confirmBtn2.cy, '"' + confirmBtn2.label + '"');
    await tap(page, confirmBtn2.cx, confirmBtn2.cy, 4000);
    await shot(page, 'discover_04_after_18');
    const estN = await getN(page, 0);
    const estText = ltext(estN);
    const estUrl = page.url();
    console.log('After 18+:', estN.length, 'nodes, URL:', estUrl, 'text:', estText.substring(0, 200));

    const ageGoneCleared = !estN.some(n => n.label.includes('18') && n.label.toLowerCase().includes('older'));
    const hasEstContent = estText.includes('reserve') || estText.includes('write') || estText.includes('social lounge') || estText.includes('rooftop');

    if (ageGoneCleared && hasEstContent) {
      pass('F1', '"I am 18+" — gate closed, establishment loaded');
    } else if (ageGoneCleared) {
      partial('F1', 'Age gate closed but establishment content unclear', estText.substring(0, 80));
    } else {
      fail('F1', '"I am 18+" did NOT close age gate', estText.substring(0, 80), 'P0');
    }

    // === ESTABLISHMENT ===
    console.log('\n=== ESTABLISHMENT ===');
    await shot(page, 'est_01');
    const onEst = hasEstContent || (!estUrl.includes('discover') && !estUrl.includes('login'));
    if (onEst) {
      pass('EST-LOAD', 'Establishment loaded (' + estN.length + ' nodes, URL: ' + estUrl + ')');
      const estBk = bkBtn(estN);
      estBk ? pass('EST-BACK', 'Back button at (' + estBk.cx + ',' + estBk.cy + ')') : fail('EST-BACK', 'No back on Establishment', '', 'P1');

      const estBtns = estN.filter(n => n.role === 'button' && n.y > 400);
      console.log('Est buttons:', estBtns.map(n => '(' + n.cx + ',' + n.cy + ') y=' + n.y + ' w=' + n.w + ' lbl="' + n.label.substring(0, 30) + '"').join(', '));

      // === RESERVATION FLOW ===
      console.log('\n=== RESERVATION FLOW ===');
      const reserveBtn = estN.find(n => n.role === 'button' && n.label.toLowerCase().includes('reserve')) ||
        estBtns.find(n => n.w > 100 && n.cx > 250); // Reserve is right CTA
      console.log('Reserve btn:', reserveBtn ? '(' + reserveBtn.cx + ',' + reserveBtn.cy + ') "' + reserveBtn.label + '"' : 'none');

      if (reserveBtn) {
        await tap(page, reserveBtn.cx, reserveBtn.cy, 3000);
        await shot(page, 'res_01_timeslot');
        const tsN = await getN(page, 0);
        const tsText = ltext(tsN);
        const tsUrl = page.url();
        console.log('TimeSlot:', tsN.length, 'nodes, URL:', tsUrl, 'text:', tsText.substring(0, 200));

        const onTS = tsText.includes('time') || tsText.includes('party') || tsText.includes('guest') || tsText.includes('slot') || tsText.includes('date');
        if (onTS) {
          pass('RES-TIMESLOT', 'Time Slot loaded (' + tsN.length + ' nodes)');
          const tsBack = bkBtn(tsN);
          tsBack ? pass('F6-TIMESLOT', 'Back on Time Slot at (' + tsBack.cx + ',' + tsBack.cy + ')') : fail('F6-TIMESLOT', 'No back on Time Slot', '', 'P1');

          const tsBtns = tsN.filter(n => n.role === 'button');
          const tsCont = tsN.find(n => n.role === 'button' && n.label.toLowerCase().includes('continue')) ||
            tsN.find(n => n.role === 'button' && n.label.toLowerCase().includes('save')) ||
            tsBtns.filter(n => n.y > 650 && n.w > 150)[0];
          console.log('TS Continue:', tsCont ? '(' + tsCont.cx + ',' + tsCont.cy + ') "' + tsCont.label + '"' : 'none');

          if (tsCont) {
            await tap(page, tsCont.cx, tsCont.cy, 3000);
            await shot(page, 'res_02_confirm');
            const cbN = await getN(page, 0);
            const cbText = ltext(cbN);
            console.log('ConfirmBooking:', cbN.length, 'nodes, URL:', page.url(), 'text:', cbText.substring(0, 200));

            const onCB = cbText.includes('confirm') || cbText.includes('booking') || cbText.includes('guest') || cbText.includes('change');
            if (onCB) {
              pass('RES-CONFIRM', 'Confirm Booking loaded (' + cbN.length + ' nodes)');
              const cbBack = bkBtn(cbN);
              cbBack ? pass('F6-CONFIRM', 'Back on Confirm Booking') : fail('F6-CONFIRM', 'No back on Confirm Booking', '', 'P1');
              cbText.includes('change') ? pass('RES-CHANGE', '"Change Time" present') : partial('RES-CHANGE', '"Change Time" not confirmed');

              const finalBtns = cbN.filter(n => n.role === 'button' && n.y > 600 && n.w > 150);
              const finalBtn = cbN.find(n => n.role === 'button' && n.label.toLowerCase().includes('confirm')) || finalBtns[0];
              console.log('Final confirm:', finalBtn ? '(' + finalBtn.cx + ',' + finalBtn.cy + ') "' + finalBtn.label + '"' : 'none');

              if (finalBtn) {
                await tap(page, finalBtn.cx, finalBtn.cy, 4000);
                await shot(page, 'res_03_pass');
                const passN = await getN(page, 0);
                const passText = ltext(passN);
                console.log('ResPass:', passN.length, 'nodes, text:', passText.substring(0, 200));
                const onPass = passText.includes('pass') || passText.includes('qr') || passText.includes('check-in') || passText.includes('confirmed') || passText.includes('booking');
                onPass ? pass('RES-PASS', 'Reservation Pass/confirmation loaded') : partial('RES-PASS', 'After confirm unclear', passText.substring(0, 80));
              } else {
                partial('RES-FINAL', 'No final confirm btn', cbText.substring(0, 80));
              }
            } else {
              fail('RES-CONFIRM', 'Confirm Booking not reached', cbText.substring(0, 80), 'P1');
            }
          } else {
            partial('RES-CONT', 'No Continue on Time Slot', tsText.substring(0, 80));
          }
        } else {
          fail('RES-TIMESLOT', 'Time Slot not loaded', tsText.substring(0, 80), 'P1');
        }
      } else {
        fail('EST-RESERVE', 'Reserve button not found', estText.substring(0, 60), 'P1');
      }

      // === REVIEW FLOW ===
      console.log('\n=== REVIEW FLOW ===');
      const estR = await goToEstablishment(page);
      await shot(page, 'est_for_review');
      const estRText = ltext(estR);
      const estRBtns = estR.filter(n => n.role === 'button' && n.y > 400 && n.w > 100);
      const writeBtn = estR.find(n => n.role === 'button' && (n.label.toLowerCase().includes('write') || n.label.toLowerCase().includes('review'))) ||
        estRBtns.find(n => n.cx < 200); // Write a Review is left CTA
      console.log('Write review:', writeBtn ? '(' + writeBtn.cx + ',' + writeBtn.cy + ') "' + writeBtn.label + '"' : 'none');
      console.log('Est buttons:', estRBtns.map(n => '(' + n.cx + ',' + n.cy + ') lbl="' + n.label.substring(0, 30) + '"').join(', '));

      if (writeBtn) {
        await tap(page, writeBtn.cx, writeBtn.cy, 3000);
        await shot(page, 'review_01_verify');
        const vvN = await getN(page, 0);
        const vvText = ltext(vvN);
        console.log('VerifyVisit:', vvN.length, 'nodes, text:', vvText.substring(0, 200));

        const onVV = vvText.includes('verify') || vvText.includes('visit') || vvText.includes('photo') || vvText.includes('location') || vvText.includes('continue');
        if (onVV) {
          pass('REVIEW-VERIFY', 'Verify Visit loaded (' + vvN.length + ' nodes)');
          const vvBk = bkBtn(vvN);
          vvBk ? pass('F6-VV', 'Back on Verify Visit') : fail('F6-VV', 'No back on Verify Visit', '', 'P1');

          const vvCont = vvN.find(n => n.role === 'button' && n.label.toLowerCase().includes('continue')) ||
            vvN.find(n => n.role === 'button' && n.label.toLowerCase().includes('skip')) ||
            vvN.filter(n => n.role === 'button' && n.y > 650 && n.w > 150)[0];
          if (vvCont) {
            await tap(page, vvCont.cx, vvCont.cy, 2500);
            await shot(page, 'review_02_rate');
            const reN = await getN(page, 0);
            const reText = ltext(reN);
            console.log('RateExp:', reN.length, 'nodes, text:', reText.substring(0, 200));

            const onRate = reText.includes('rate') || reText.includes('experience') || reText.includes('food') || reText.includes('service') || reText.includes('atmosphere') || reText.includes('quality');
            if (onRate) {
              pass('REVIEW-RATE', 'Rate Experience loaded (' + reN.length + ' nodes)');
              const reBk = bkBtn(reN);
              reBk ? pass('F6-RATE', 'Back on Rate Experience') : fail('F6-RATE', 'No back on Rate Experience', '', 'P1');

              const reCont = reN.find(n => n.role === 'button' && n.label.toLowerCase().includes('continue')) ||
                reN.filter(n => n.role === 'button' && n.y > 650 && n.w > 150)[0];
              if (reCont) {
                await tap(page, reCont.cx, reCont.cy, 2500);
                await shot(page, 'review_03_disclosure');
                const cdN = await getN(page, 0);
                const cdText = ltext(cdN);
                console.log('Disclosure:', cdN.length, 'nodes, text:', cdText.substring(0, 200));

                const onCD = cdText.includes('creator') || cdText.includes('disclosure') || cdText.includes('affiliated') || cdText.includes('partner');
                if (onCD) {
                  pass('REVIEW-DISCLOSURE', 'Creator Disclosure loaded (' + cdN.length + ' nodes)');
                  const cdBk = bkBtn(cdN);
                  cdBk ? pass('F6-DISCLOSURE', 'Back on Creator Disclosure') : fail('F6-DISCLOSURE', 'No back on Disclosure', '', 'P1');

                  const cdCont = cdN.find(n => n.role === 'button' && n.label.toLowerCase().includes('confirm')) ||
                    cdN.find(n => n.role === 'button' && n.label.toLowerCase().includes('continue')) ||
                    cdN.filter(n => n.role === 'button' && n.y > 650 && n.w > 150)[0];
                  if (cdCont) {
                    await tap(page, cdCont.cx, cdCont.cy, 2500);
                    await shot(page, 'review_04_written');
                    const wrN = await getN(page, 0);
                    const wrTBs = wrN.filter(n => ['textbox', 'searchbox', 'combobox'].includes(n.role));
                    const wrText = ltext(wrN);
                    console.log('WrittenReview:', wrN.length, 'nodes, textboxes:', wrTBs.length, 'text:', wrText.substring(0, 200));

                    const onWR = wrTBs.length > 0 || wrText.includes('review') || wrText.includes('write') || wrText.includes('describe');
                    if (onWR) {
                      pass('REVIEW-WRITTEN', 'Written Review loaded (' + wrN.length + ' nodes)');
                      wrTBs.length > 0
                        ? pass('REVIEW-TEXTAREA', 'Text area has semantic role (' + wrTBs[0].role + ')')
                        : partial('REVIEW-TEXTAREA', 'No textbox role — textarea may be visual-only');
                      const wrBk = bkBtn(wrN);
                      wrBk ? pass('F6-WRITTEN', 'Back on Written Review') : fail('F6-WRITTEN', 'No back on Written Review', '', 'P1');

                      if (wrTBs.length > 0) {
                        await tap(page, wrTBs[0].cx, wrTBs[0].cy, 300);
                        await page.keyboard.type('Great atmosphere and excellent service!');
                        await page.waitForTimeout(300);
                      }

                      const subBtn = wrN.find(n => n.role === 'button' && (n.label.toLowerCase().includes('submit') || n.label.toLowerCase().includes('publish') || n.label.toLowerCase().includes('post'))) ||
                        wrN.filter(n => n.role === 'button' && n.y > 650 && n.w > 150)[0];
                      if (subBtn) {
                        await tap(page, subBtn.cx, subBtn.cy, 4000);
                        await shot(page, 'review_05_submitted');
                        const rsN = await getN(page, 0);
                        const rsText = ltext(rsN);
                        console.log('Submitted:', rsN.length, 'nodes, text:', rsText.substring(0, 250));
                        const onRS = rsText.includes('pts') || rsText.includes('points') || rsText.includes('badge') || rsText.includes('taster') || rsText.includes('earned') || rsText.includes('congratulation') || rsText.includes('thank') || rsText.includes('review');
                        onRS ? pass('REVIEW-SUBMITTED', 'Review Submitted screen loaded') : partial('REVIEW-SUBMITTED', 'After submit unclear', rsText.substring(0, 80));
                        rsText.includes('share') ? pass('F9', '"Share Your Review" present') : fail('F9', '"Share Your Review" not found', '', 'P2');
                        rsText.includes('explore') ? pass('REVIEW-EXPLORE', '"Explore More Spots" present') : partial('REVIEW-EXPLORE', '"Explore More Spots" not confirmed');
                      } else {
                        partial('REVIEW-SUB', 'Submit button not found', wrText.substring(0, 80));
                      }
                    } else { partial('REVIEW-WRITTEN', 'Written Review unclear', wrText.substring(0, 80)); }
                  } else { partial('REVIEW-CD-CONT', 'No Continue on Disclosure', cdText.substring(0, 80)); }
                } else { partial('REVIEW-DISCLOSURE', 'Disclosure unclear', cdText.substring(0, 80)); }
              } else { partial('REVIEW-RATE-CONT', 'No Continue on Rate Exp', reText.substring(0, 80)); }
            } else { partial('REVIEW-RATE', 'Rate Experience unclear', reText.substring(0, 80)); }
          } else { partial('REVIEW-VV-CONT', 'No Continue on Verify Visit', vvText.substring(0, 80)); }
        } else { fail('REVIEW-VERIFY', 'Verify Visit not loaded', vvText.substring(0, 80), 'P1'); }
      } else {
        fail('REVIEW-NO-BTN', 'Write Review button not found', estRText.substring(0, 60), 'P1');
      }
    } else {
      fail('EST-LOAD', 'Establishment not reached', estText.substring(0, 80), 'P1');
    }
  } else {
    partial('DISCOVER-AGE-GATE', 'Age gate not shown', ageText.substring(0, 80));
    partial('F1', 'Age gate not shown — venue may not be age-gated', '');
  }

  // === MESSAGES ===
  console.log('\n=== MESSAGES ===');
  await tap(page, 273, 812, 800);
  const mn = await getN(page, 0);
  await shot(page, 'msg_01');
  console.log('Messages:', mn.length, 'nodes, URL:', page.url());
  mn.length > 5 ? pass('MESSAGES-LOAD', 'Messages loaded (' + mn.length + ' nodes)') : fail('MESSAGES-LOAD', 'Messages not loaded', mn.length + ' nodes', 'P1');

  if (mn.length > 5) {
    // Confirmed: conversation buttons at cx=195, y=206,288,371,448,601
    const convBtns = mn.filter(n => n.role === 'button' && n.y > 100 && n.y < 700 && n.w > 200 && n.h > 40);
    console.log('Conv buttons:', convBtns.map(n => '(' + n.cx + ',' + n.cy + ') lbl="' + n.label.substring(0, 30) + '"').join(', '));
    const convTarget = convBtns[0] || { cx: 195, cy: 206 };

    await tap(page, convTarget.cx, convTarget.cy, 3000);
    await shot(page, 'msg_02_chat');
    const cn = await getN(page, 0);
    const cText = ltext(cn);
    console.log('Chat:', cn.length, 'nodes, URL:', page.url(), 'text:', cText.substring(0, 200));
    const cTBs = cn.filter(n => ['textbox', 'searchbox', 'combobox'].includes(n.role));

    const onChat = cn.length !== mn.length || cText.includes('send') || cTBs.length > 0 || !page.url().includes('messages');
    if (onChat) {
      pass('F9-MESSAGES', 'Conversation tap opened chat (' + cn.length + ' nodes)');
      cTBs.length > 0 ? pass('MESSAGES-INPUT', 'Chat text input present (' + cTBs[0].role + ')') : fail('MESSAGES-INPUT', 'No text input in chat', '', 'P1');
      const cBk = bkBtn(cn);
      if (cBk) {
        pass('MESSAGES-BACK', 'Chat back button at (' + cBk.cx + ',' + cBk.cy + ')');
        await tap(page, cBk.cx, cBk.cy, 1500);
        const afterBk = await getN(page, 0);
        afterBk.length === mn.length || page.url().includes('messages')
          ? pass('MESSAGES-BACK-WORKS', 'Back from chat → messages list')
          : partial('MESSAGES-BACK-WORKS', 'Back pressed, URL: ' + page.url());
      } else { fail('MESSAGES-BACK', 'No back button in chat', '', 'P1'); }
    } else {
      fail('F9-MESSAGES', 'Conversation tap did not open chat', cText.substring(0, 80), 'P1');
    }
  }

  // === PROFILE ===
  console.log('\n=== PROFILE ===');
  await tap(page, 351, 812, 800);
  const pn = await getN(page, 0);
  await shot(page, 'profile_01');
  const pText = ltext(pn);
  console.log('Profile:', pn.length, 'nodes, URL:', page.url(), 'text:', pText.substring(0, 200));
  pn.length > 5 ? pass('PROFILE-LOAD', 'Profile loaded (' + pn.length + ' nodes)') : partial('PROFILE-LOAD', 'Profile sparse', pn.length + ' nodes');
  // Check known labels from map: "Alan Paul", "@alanpaul"
  pText.includes('alan') || pText.includes('alanpaul') || pText.includes('my profile')
    ? pass('PROFILE-INFO', 'User info visible (Alan Paul/@alanpaul)')
    : partial('PROFILE-INFO', 'User info not in labels');
  // Profile tabs (Posts/Reels/Reviews/Places) at y=553
  const profileTabs = pn.filter(n => n.role === 'button' && n.y > 530 && n.y < 580);
  profileTabs.length >= 3 ? pass('PROFILE-TABS', profileTabs.length + ' content tabs at y~553') : partial('PROFILE-TABS', 'Content tabs not found', profileTabs.length + ' buttons');
  // Rewards visible
  pText.includes('pts') || pText.includes('points') || pText.includes('rewards')
    ? pass('PROFILE-REWARDS', 'Rewards balance visible') : partial('PROFILE-REWARDS', 'Rewards not confirmed in labels');

  // === SETTINGS ===
  console.log('\n=== SETTINGS ===');
  // Settings accessible from profile top-right icon at (351, 32)
  const settingsIcon = pn.find(n => n.role === 'button' && n.cx > 330 && n.y < 50);
  console.log('Settings icon from profile:', settingsIcon ? '(' + settingsIcon.cx + ',' + settingsIcon.cy + ')' : 'not found');
  if (settingsIcon) {
    await tap(page, settingsIcon.cx, settingsIcon.cy, 2500);
  } else {
    await page.evaluate(() => { window.location.hash = '/settings'; });
    await page.waitForTimeout(3000);
  }
  await shot(page, 'settings_01');
  const sn = await getN(page, 0);
  const sText = ltext(sn);
  const sBtns = sn.filter(n => n.role === 'button');
  console.log('Settings:', sn.length, 'nodes, URL:', page.url(), 'text:', sText.substring(0, 300));
  console.log('Settings btns:', sBtns.map(n => '(' + n.cx + ',' + n.cy + ') y=' + n.y + ' lbl="' + n.label.substring(0, 30) + '"').join(', '));

  const onSettings = sText.includes('settings') || sText.includes('personal') || sText.includes('privacy') || sText.includes('delete') || sText.includes('logout') || sText.includes('account') || sn.length > 5;
  if (onSettings) {
    pass('SETTINGS-LOAD', 'Settings loaded (' + sn.length + ' nodes, URL: ' + page.url() + ')');

    // F10-PERSONAL
    const piBtn = sBtns.find(n => n.label.toLowerCase().includes('personal')) || sBtns.find(n => n.y > 80 && n.y < 200);
    if (piBtn) {
      await tap(page, piBtn.cx, piBtn.cy, 2000);
      await shot(page, 'settings_02_personal');
      const piN = await getN(page, 0);
      const piText = ltext(piN);
      piText.includes('coming') ? pass('F10-PERSONAL', '"Coming soon" snackbar on Personal Info') :
        partial('F10-PERSONAL', 'Personal Info tapped — coming soon not confirmed', piText.substring(0, 60));
      await page.waitForTimeout(1000);
      if (!page.url().includes('settings')) {
        const bk = bkBtn(piN);
        if (bk) await tap(page, bk.cx, bk.cy, 1000);
      }
    } else { partial('F10-PERSONAL', 'Personal Info button not found'); }

    await page.evaluate(() => { window.location.hash = '/settings'; });
    await page.waitForTimeout(2500);
    const sn2 = await getN(page, 0);
    const sb2 = sn2.filter(n => n.role === 'button');

    // F10-EMAIL
    const epBtn = sb2.find(n => n.label.toLowerCase().includes('email')) || sb2.find(n => n.y > 150 && n.y < 300);
    if (epBtn) {
      await tap(page, epBtn.cx, epBtn.cy, 2000);
      await shot(page, 'settings_03_email');
      const epN = await getN(page, 0);
      const epText = ltext(epN);
      epText.includes('coming') ? pass('F10-EMAIL', '"Coming soon" snackbar on Email Prefs') :
        partial('F10-EMAIL', 'Email Prefs — coming soon not confirmed', epText.substring(0, 60));
    } else { partial('F10-EMAIL', 'Email Prefs button not found'); }

    await page.evaluate(() => { window.location.hash = '/settings'; });
    await page.waitForTimeout(2500);
    const sn3 = await getN(page, 0);
    const sb3 = sn3.filter(n => n.role === 'button');

    // PRIVACY SETTINGS
    const privBtn = sb3.find(n => n.label.toLowerCase().includes('privacy'));
    if (privBtn) {
      await tap(page, privBtn.cx, privBtn.cy, 2500);
      await shot(page, 'settings_04_privacy');
      const privN = await getN(page, 0);
      const privText = ltext(privN);
      console.log('Privacy:', privN.length, 'nodes, URL:', page.url(), 'text:', privText.substring(0, 150));
      const onPriv = privText.includes('privacy') || privText.includes('data') || privText.includes('location') || privText.includes('who can') || !page.url().includes('settings');
      if (onPriv) {
        pass('SETTINGS-PRIVACY', 'Privacy Settings opened (' + privN.length + ' nodes)');
        const privBk = bkBtn(privN);
        if (privBk) { pass('SETTINGS-PRIVACY-BACK', 'Back on Privacy Settings'); await tap(page, privBk.cx, privBk.cy, 1500); }
        else { fail('SETTINGS-PRIVACY-BACK', 'No back on Privacy Settings', '', 'P1'); }
      } else { fail('SETTINGS-PRIVACY', 'Privacy Settings did not open', privText.substring(0, 60), 'P1'); }
    } else { partial('SETTINGS-PRIVACY', 'Privacy button not found by label'); }

    await page.evaluate(() => { window.location.hash = '/settings'; });
    await page.waitForTimeout(2500);
    const sn4 = await getN(page, 0);
    const sb4 = sn4.filter(n => n.role === 'button');

    // F10-DELETE
    const delBtn = sb4.find(n => n.label.toLowerCase().includes('delete'));
    if (delBtn) {
      await tap(page, delBtn.cx, delBtn.cy, 2000);
      await shot(page, 'settings_05_delete');
      const dlgN = await getN(page, 0);
      const dlgText = ltext(dlgN);
      const dlgBtns = dlgN.filter(n => n.role === 'button');
      console.log('Delete dialog:', dlgN.length, 'nodes, text:', dlgText.substring(0, 150), 'btns:', dlgBtns.length);
      const hasDialog = dlgText.includes('delete') && (dlgText.includes('confirm') || dlgText.includes('cancel') || dlgText.includes('sure') || dlgBtns.length >= 2);
      hasDialog ? pass('F10-DELETE', 'Delete Account → dialog (' + dlgBtns.length + ' buttons)') :
        partial('F10-DELETE', 'Delete Account — dialog unclear', dlgText.substring(0, 60));
      const cancelBtn = dlgBtns.find(n => n.label.toLowerCase().includes('cancel') || n.label.toLowerCase().includes('no') || n.label.toLowerCase().includes('keep'));
      if (cancelBtn) await tap(page, cancelBtn.cx, cancelBtn.cy, 500);
    } else { fail('F10-DELETE', 'Delete Account button not found', sText.substring(0, 80), 'P1'); }

    await page.evaluate(() => { window.location.hash = '/settings'; });
    await page.waitForTimeout(2500);
    const sn5 = await getN(page, 0);
    const logBtn = sn5.filter(n => n.role === 'button').find(n => n.label.toLowerCase().includes('log out') || n.label.toLowerCase().includes('logout') || n.label.toLowerCase().includes('sign out'));
    logBtn ? pass('SETTINGS-LOGOUT', 'Logout found: "' + logBtn.label + '"') : partial('SETTINGS-LOGOUT', 'Logout not found by label');

  } else {
    fail('SETTINGS-LOAD', 'Settings not loaded', sn.length + ' nodes, URL: ' + page.url(), 'P1');
  }

  // === POINTS / BADGES / REDEEM ===
  console.log('\n=== POINTS / BADGES / REDEEM ===');
  for (const [h, name] of [['points', 'points'], ['badges', 'badges'], ['redeem', 'redeem']]) {
    await page.evaluate((hash) => { window.location.hash = '/' + hash; }, h);
    await page.waitForTimeout(3000);
    await shot(page, 'reward_' + name);
    const rn = await getN(page, 0);
    const rt = ltext(rn);
    console.log('/' + h + ':', rn.length, 'nodes, URL:', page.url(), 'text:', rt.substring(0, 80));
    rn.length > 3 ? pass('ROUTE-' + name.toUpperCase(), '/' + h + ' loaded (' + rn.length + ' nodes)') :
      partial('ROUTE-' + name.toUpperCase(), '/' + h + ' sparse', rn.length + ' nodes');
  }

} catch (err) {
  console.error('FATAL ERROR:', err.message);
  console.error(err.stack ? err.stack.split('\n').slice(0, 5).join('\n') : '');
  await shot(page, 'fatal').catch(() => {});
} finally {
  await browser.close();
}

fs.writeFileSync('C:/Projects/Zupurb/test/e2e_web/results_part2.json', JSON.stringify({ results, errors }, null, 2));

const passed = results.filter(r => r.s === 'PASS');
const failed = results.filter(r => r.s === 'FAIL');
const partials = results.filter(r => r.s === 'PARTIAL');
console.log('\n====== PART 2 RESULTS ======');
console.log('PASS:' + passed.length + ' FAIL:' + failed.length + ' PARTIAL:' + partials.length + ' TOTAL:' + results.length);
failed.forEach(r => console.log('FAIL [' + r.sev + '][' + r.id + '] ' + r.d + (r.det ? ' -- ' + r.det : '')));
partials.forEach(r => console.log('PARTIAL [' + r.id + '] ' + r.d + (r.det ? ' -- ' + r.det : '')));
passed.forEach(r => console.log('PASS [' + r.id + '] ' + r.d));
errors.slice(0, 5).forEach((e, i) => console.log('ERR[' + i + '] ' + e));
console.log('Results: C:/Projects/Zupurb/test/e2e_web/results_part2.json');
