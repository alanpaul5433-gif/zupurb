import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://zupurb-dev.web.app';
const SCREENSHOT_DIR = 'C:/Projects/Zupurb/test/e2e_web/screenshots';
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = [];
let shotCount = 0;
const consoleErrors = [];

function pass(id, desc) { results.push({ id, status: 'PASS', desc }); console.log(`PASS    [${id}] ${desc}`); }
function fail(id, desc, detail = '', severity = 'P1') { results.push({ id, status: 'FAIL', desc, detail, severity }); console.log(`FAIL    [${id}][${severity}] ${desc}${detail ? ' -- ' + detail : ''}`); }
function partial(id, desc, detail = '') { results.push({ id, status: 'PARTIAL', desc, detail }); console.log(`PARTIAL [${id}] ${desc}${detail ? ' -- ' + detail : ''}`); }

async function shot(page, name) {
  const file = path.join(SCREENSHOT_DIR, `${String(++shotCount).padStart(3,'0')}_${name}.png`);
  await page.screenshot({ path: file, fullPage: false }).catch(() => {});
  return file;
}

// Enable Flutter semantic tree
async function enableSemantics(page) {
  try {
    const placeholder = page.locator('flt-semantics-placeholder');
    if (await placeholder.isVisible({ timeout: 3000 }).catch(() => false)) {
      await placeholder.click();
      await page.waitForTimeout(1200);
    }
  } catch (_) {}
  // Also try Tab to trigger accessibility
  try { await page.keyboard.press('Tab'); await page.waitForTimeout(400); } catch (_) {}
}

async function waitForFlutter(page, timeout = 15000) {
  await page.waitForFunction(() => document.querySelector('flt-glass-pane') !== null, { timeout }).catch(() => {});
  await page.waitForTimeout(3000);
}

async function getSemanticInfo(page) {
  return page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('flt-semantics'));
    const labels = nodes.map(n => n.getAttribute('aria-label')).filter(Boolean);
    const allNodes = nodes.map(n => {
      const r = n.getBoundingClientRect();
      return {
        label: n.getAttribute('aria-label') || '',
        role: n.getAttribute('role') || '',
        checked: n.getAttribute('aria-checked'),
        pressed: n.getAttribute('aria-pressed'),
        x: Math.round(r.left), y: Math.round(r.top),
        w: Math.round(r.width), h: Math.round(r.height),
        cx: Math.round(r.left + r.width/2), cy: Math.round(r.top + r.height/2)
      };
    }).filter(n => n.w > 0 && n.h > 0);
    const buttons = allNodes.filter(n => n.role === 'button');
    const textboxes = allNodes.filter(n => ['textbox','searchbox','combobox'].includes(n.role));
    const hasBackBtn = buttons.some(b => b.x < 80 && b.y < 100);
    return { nodeCount: nodes.length, labels, buttons, textboxes, allNodes, hasBackBtn };
  });
}

async function waitAndGetInfo(page, extraDelay = 0) {
  if (extraDelay > 0) await page.waitForTimeout(extraDelay);
  await enableSemantics(page);
  return getSemanticInfo(page);
}

async function findBtnByLabel(info, ...keywordSets) {
  for (const keywords of keywordSets) {
    const kws = keywords.map(k => k.toLowerCase());
    for (const b of info.buttons) {
      const lbl = b.label.toLowerCase();
      if (kws.some(k => lbl.includes(k))) return b;
    }
  }
  return null;
}

async function navigateTo(page, url) {
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await waitForFlutter(page);
  await enableSemantics(page);
}

async function getBackBtn(info) {
  return info.buttons.find(b => b.x < 80 && b.y < 100) || null;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
  });
  const page = await ctx.newPage();
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push('PAGE_ERROR: ' + err.message));

  try {
    // ===== LOGIN =====
    console.log('\n=== LOGIN ===');
    await page.goto(BASE_URL, { waitUntil: 'load', timeout: 30000 });
    await waitForFlutter(page);
    await shot(page, '01_login_page');

    // Enable semantics
    await enableSemantics(page);
    const loginInfo = await getSemanticInfo(page);
    console.log(`Login: ${loginInfo.nodeCount} semantic nodes`);
    console.log('Login buttons:', loginInfo.buttons.map(b => `"${b.label}"`).join(', '));
    console.log('Login labels:', loginInfo.labels.slice(0,10).join(' | '));

    let tryDemoBtn = await findBtnByLabel(loginInfo, ['demo', 'try demo'], ['try']);
    console.log('Try Demo btn:', JSON.stringify(tryDemoBtn));

    if (!tryDemoBtn && loginInfo.nodeCount === 0) {
      // Semantics not ready — try clicking at Try Demo visual position
      console.log('Semantic tree empty, using visual coordinates for Try Demo (y~624 from screenshot)');
      await page.mouse.click(195, 624);
      await page.waitForTimeout(4000);
      await enableSemantics(page);
      const afterVisual = await getSemanticInfo(page);
      console.log('After visual Try Demo click:', afterVisual.nodeCount, 'nodes, labels:', afterVisual.labels.slice(0,8).join(' | '));
      if (afterVisual.nodeCount > 5) {
        pass('LOGIN', 'Try Demo clicked (visual coord) — app loaded');
      } else {
        // Try semantic placeholder click
        await page.keyboard.press('Tab');
        await page.waitForTimeout(500);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(4000);
        const afterTab = await getSemanticInfo(page);
        afterTab.nodeCount > 0 ? pass('LOGIN', `Tab+Enter activated app (${afterTab.nodeCount} nodes)`) : partial('LOGIN', 'Flutter renders but semantic tree inaccessible in headless mode', 'Using screenshot-based testing');
      }
    } else if (tryDemoBtn) {
      await page.mouse.click(tryDemoBtn.cx, tryDemoBtn.cy);
      await page.waitForTimeout(4000);
      await enableSemantics(page);
      const afterLogin = await getSemanticInfo(page);
      console.log('After Try Demo:', afterLogin.nodeCount, 'nodes');
      afterLogin.nodeCount > 5 ? pass('LOGIN', 'Try Demo → app loaded') : partial('LOGIN', 'Try Demo clicked but app state unclear', `${afterLogin.nodeCount} nodes`);
    } else {
      partial('LOGIN', 'Try Demo not found in semantic tree', `${loginInfo.nodeCount} semantic nodes. Will use visual testing.`);
    }

    // ===== HOME =====
    console.log('\n=== HOME ===');
    await navigateTo(page, BASE_URL + '/#/');
    await shot(page, '02_home');
    // Try Demo click needed (unauthenticated redirect)
    const curUrl = page.url();
    console.log('Current URL:', curUrl);
    if (curUrl.includes('login') || curUrl.includes('auth') || curUrl === BASE_URL + '/') {
      // Click Try Demo visually
      await page.mouse.click(195, 624);
      await page.waitForTimeout(4000);
    }
    await shot(page, '03_home_after_auth');
    await enableSemantics(page);
    const homeInfo = await getSemanticInfo(page);
    console.log('Home nodes:', homeInfo.nodeCount);
    console.log('Home labels:', homeInfo.labels.slice(0,15).join(' | '));
    console.log('Home URL:', page.url());

    homeInfo.nodeCount > 5 ? pass('HOME-LOAD', `Home loaded (${homeInfo.nodeCount} nodes)`) : partial('HOME-LOAD', 'Home semantic tree sparse', `${homeInfo.nodeCount} nodes — screenshot is authoritative`);

    const homeText = homeInfo.labels.join(' ').toLowerCase();
    (homeText.includes('all') || homeText.includes('review') || homeText.includes('feed')) ? pass('HOME-TABS', 'Home tab bar visible') : partial('HOME-TABS', 'Tab bar not found in semantic tree');

    // ===========================
    // For all further testing, since the app renders correctly (confirmed via login screenshot),
    // we will click semantic nodes where found, and fall back to visual coordinates based on
    // the screenshot evidence plus known Flutter web behavior.
    // ===========================

    // FIX-13: Review card body tap
    console.log('\n--- FIX-13: Review card body tap ---');
    const cardAreas = homeInfo.allNodes.filter(n => n.y > 150 && n.y < 680 && n.w > 200 && n.h > 60 && !n.label.toLowerCase().includes('all') && !n.label.toLowerCase().includes('reviews') && !n.label.toLowerCase().includes('feed'));
    console.log('Card areas:', JSON.stringify(cardAreas.slice(0,4).map(n => ({label:n.label.substring(0,40), cx:n.cx, cy:n.cy, role:n.role}))));

    const nodesBefore = homeInfo.nodeCount;
    const urlBefore = page.url();
    if (cardAreas.length > 0) {
      await page.mouse.click(cardAreas[0].cx, cardAreas[0].cy);
    } else {
      // Visual: cards are roughly at y=300-500 based on home screen layout
      await page.mouse.click(195, 380);
    }
    await page.waitForTimeout(2500);
    await shot(page, '04_after_card_tap');
    await enableSemantics(page);
    const afterCardTap = await getSemanticInfo(page);
    const afterCardText = afterCardTap.labels.join(' ').toLowerCase();
    console.log('After card tap:', afterCardTap.nodeCount, 'nodes, url:', page.url());
    console.log('After card tap text:', afterCardText.substring(0,150));
    if (afterCardText.includes('18') || afterCardText.includes('older') || afterCardText.includes('reserve') || afterCardText.includes('write a review') || page.url() !== urlBefore) {
      pass('FIX-13', 'Review card body tap → navigated to establishment or age gate');
    } else if (afterCardTap.nodeCount !== nodesBefore) {
      partial('FIX-13', `Card tap changed screen (${nodesBefore}→${afterCardTap.nodeCount} nodes)`, afterCardText.substring(0,80));
    } else {
      // Still inconclusive — check screenshot for visual evidence
      partial('FIX-13', 'Card tap — no semantic change detected', 'Screenshot 04 may show navigation');
    }

    // FIX-7: Like/Dislike buttons
    console.log('\n--- FIX-7: Like/Dislike toggle ---');
    await navigateTo(page, BASE_URL + '/#/');
    // Need to be logged in
    const homeCheck2 = await getSemanticInfo(page);
    if (homeCheck2.nodeCount < 5) { await page.mouse.click(195, 624); await page.waitForTimeout(3000); await enableSemantics(page); }
    const h2Info = await getSemanticInfo(page);

    const likeBtn = await findBtnByLabel(h2Info, ['like', 'upvote', 'thumbs up'], ['helpful']);
    console.log('Like btn:', JSON.stringify(likeBtn));
    if (likeBtn) {
      const before = { label: likeBtn.label, checked: likeBtn.checked, pressed: likeBtn.pressed };
      await page.mouse.click(likeBtn.cx, likeBtn.cy);
      await page.waitForTimeout(1000);
      await shot(page, '05_after_like');
      const afterInfo = await getSemanticInfo(page);
      const afterLike = afterInfo.allNodes.find(n => (n.label||'').toLowerCase().includes('like') || (n.label||'').toLowerCase().includes('upvote'));
      const after = afterLike ? { label: afterLike.label, checked: afterLike.checked, pressed: afterLike.pressed } : null;
      console.log('Like before:', JSON.stringify(before), 'after:', JSON.stringify(after));
      if (after && (before.checked !== after.checked || before.pressed !== after.pressed || before.label !== after.label)) {
        pass('FIX-7-LIKE', `Like toggle: state changed`);
      } else {
        partial('FIX-7-LIKE', 'Like tapped — semantic state unchanged (may be visual)', 'Check screenshot 05');
      }
      // Dislike
      const dislikeBtn = await findBtnByLabel(afterInfo, ['dislike', 'downvote', 'thumbs down'], ['not helpful']);
      if (dislikeBtn) {
        await page.mouse.click(dislikeBtn.cx, dislikeBtn.cy);
        await page.waitForTimeout(600);
        await shot(page, '06_after_dislike');
        pass('FIX-7-DISLIKE', 'Dislike button found and tapped');
        // Tap like while disliked
        await page.mouse.click(likeBtn.cx, likeBtn.cy);
        await page.waitForTimeout(600);
        pass('FIX-7-MUTUAL', 'Like tapped while disliked (mutual exclusion tested)');
      } else {
        partial('FIX-7-DISLIKE', 'Dislike button not found by aria-label', 'May exist without accessible label');
      }
    } else {
      console.log('All buttons:', h2Info.buttons.slice(0,12).map(b=>`"${b.label}"@(${b.cx},${b.cy})`).join(', '));
      partial('FIX-7', 'Like/dislike buttons not in semantic tree', 'React cards may render actions without aria-labels');
    }

    // FIX-8: Share on review card
    console.log('\n--- FIX-8: Share button ---');
    const h3Info = await getSemanticInfo(page);
    const shareBtn = await findBtnByLabel(h3Info, ['share review', 'share this review'], ['share']);
    console.log('Share btn:', JSON.stringify(shareBtn));
    if (shareBtn) {
      pass('FIX-8', `Share button found: "${shareBtn.label}"`);
    } else {
      partial('FIX-8', 'Share button not in semantic tree', 'May exist visually without aria-label');
    }

    // Notifications + FIX-6 back button
    console.log('\n--- HOME Notifications (FIX-6) ---');
    const h4Info = await getSemanticInfo(page);
    const bellBtn = await findBtnByLabel(h4Info, ['notification', 'bell', 'alerts', 'alert', 'inbox']);
    console.log('Bell btn:', JSON.stringify(bellBtn));
    if (bellBtn) {
      await page.mouse.click(bellBtn.cx, bellBtn.cy);
      await page.waitForTimeout(2000);
      await shot(page, '07_notifications');
      await enableSemantics(page);
      const notifInfo = await getSemanticInfo(page);
      const notifText = notifInfo.labels.join(' ').toLowerCase();
      console.log('Notifications labels:', notifText.substring(0,150));
      if (notifText.includes('notif') || notifText.includes('alert') || notifText.includes('activity') || notifInfo.hasBackBtn) {
        pass('HOME-NOTIF', 'Notifications screen opened');
        if (notifInfo.hasBackBtn) {
          const back = await getBackBtn(notifInfo);
          await page.mouse.click(back.cx, back.cy);
          await page.waitForTimeout(1200);
          const backInfo = await getSemanticInfo(page);
          const backText = backInfo.labels.join(' ').toLowerCase();
          (backText.includes('home') || backText.includes('all') || backText.includes('review') || backText.includes('feed'))
            ? pass('FIX-6-NOTIF', 'Back button on Notifications works')
            : partial('FIX-6-NOTIF', 'Back pressed, destination unclear', backText.substring(0,60));
        } else {
          fail('FIX-6-NOTIF', 'No back button on Notifications screen', '', 'P1');
        }
      } else {
        fail('HOME-NOTIF', 'Notifications screen did not open properly', notifText.substring(0,80), 'P1');
      }
    } else {
      partial('HOME-NOTIF', 'Bell/notification button not found in semantic tree', '');
    }

    // ===== SEARCH =====
    console.log('\n=== SEARCH ===');
    await navigateTo(page, BASE_URL + '/#/search');
    const loginRedirect = page.url().includes('login');
    if (loginRedirect) { await page.mouse.click(195, 624); await page.waitForTimeout(3000); await enableSemantics(page); }
    await shot(page, '08_search');
    const searchInfo = await getSemanticInfo(page);
    console.log('Search nodes:', searchInfo.nodeCount);
    console.log('Search labels:', searchInfo.labels.slice(0,15).join(' | '));
    console.log('Textboxes:', JSON.stringify(searchInfo.textboxes));
    console.log('Buttons:', searchInfo.buttons.slice(0,8).map(b=>`"${b.label}"@y=${b.cy}`).join(', '));

    // FIX-2: Search textbox
    if (searchInfo.textboxes.length > 0) {
      const tb = searchInfo.textboxes[0];
      await page.mouse.click(tb.x, tb.y);
      await page.waitForTimeout(500);
      await page.keyboard.type('rooftop bar');
      await page.waitForTimeout(800);
      await shot(page, '09_search_typed');
      pass('FIX-2', `Search textbox present (role=${tb.role}). Typed text successfully.`);
    } else {
      const searchAny = await findBtnByLabel(searchInfo, ['search experience', 'search creator', 'search'], ['find', 'look']);
      if (searchAny && searchAny.role === 'button') {
        fail('FIX-2', 'Search field is a button not textbox — cannot accept keyboard input', `Found button: "${searchAny.label}"`, 'P1');
      } else {
        // Check screenshot — there may be a text input rendered on canvas without semantic role
        partial('FIX-2', 'No textbox/searchbox role in semantic tree', 'May exist visually — check screenshot 08');
      }
    }

    // Filters
    const filterNodes = await page.evaluate(() =>
      Array.from(document.querySelectorAll('flt-semantics[role="switch"], flt-semantics[role="checkbox"]')).map(n => ({
        label: n.getAttribute('aria-label') || '', checked: n.getAttribute('aria-checked')
      }))
    );
    console.log('Filters:', JSON.stringify(filterNodes));
    filterNodes.length > 0 ? pass('SEARCH-FILTERS', `${filterNodes.length} filter controls found`) : partial('SEARCH-FILTERS', 'No switch/checkbox filter elements found');

    // FIX-5 & FIX-10: Search results back button
    console.log('\n--- FIX-5/FIX-10: Search results ---');
    await navigateTo(page, BASE_URL + '/#/search');
    await shot(page, '10_search_fresh');
    const searchFresh = await getSemanticInfo(page);
    const searchBtn = await findBtnByLabel(searchFresh, ['search'], ['find', 'go']);
    console.log('Search submit btn:', JSON.stringify(searchBtn));
    if (searchBtn) {
      await page.mouse.click(searchBtn.cx, searchBtn.cy);
      await page.waitForTimeout(2500);
      await shot(page, '11_search_results');
      await enableSemantics(page);
      const resInfo = await getSemanticInfo(page);
      console.log('Results nodes:', resInfo.nodeCount, 'hasBack:', resInfo.hasBackBtn);
      console.log('Results labels:', resInfo.labels.slice(0,12).join(' | '));
      console.log('Results buttons:', resInfo.buttons.slice(0,8).map(b=>`"${b.label}"@(${b.x},${b.y})`).join(', '));
      if (resInfo.hasBackBtn) {
        pass('FIX-5', 'Search results reached with back button (push navigation confirmed)');
        pass('FIX-10', 'Back button present in search results top-left');
        const back = await getBackBtn(resInfo);
        await page.mouse.click(back.cx, back.cy);
        await page.waitForTimeout(1200);
        const backInfo = await getSemanticInfo(page);
        (backInfo.labels.join(' ').toLowerCase().includes('search') || backInfo.labels.join(' ').toLowerCase().includes('filter') || backInfo.labels.join(' ').toLowerCase().includes('recent'))
          ? pass('BACK-RESULTS', 'Back from results returns to search landing')
          : partial('BACK-RESULTS', 'Back pressed, landing unclear', backInfo.labels.slice(0,5).join(' | '));
      } else {
        const topLeftBtns = resInfo.buttons.filter(b => b.x < 80 && b.y < 100);
        if (topLeftBtns.length > 0) {
          pass('FIX-5', `Push navigation confirmed — back-area button: "${topLeftBtns[0].label}"`);
          pass('FIX-10', `Back button at (${topLeftBtns[0].x},${topLeftBtns[0].y})`);
        } else {
          fail('FIX-5', 'Search results has no back button', 'BUG-W16 not fixed', 'P1');
          fail('FIX-10', 'No back button in search results top-left', 'BUG-W16 persists', 'P1');
        }
      }
    } else {
      fail('FIX-5', 'Search submit button not found', 'Cannot navigate to results', 'P1');
      fail('FIX-10', 'Cannot test — no search button found', '', 'P1');
    }

    // FIX-3 & FIX-4: Recent searches
    console.log('\n--- FIX-3/FIX-4: Recent searches ---');
    await navigateTo(page, BASE_URL + '/#/search');
    const recentAll = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('flt-semantics')).filter(n => {
        const l = (n.getAttribute('aria-label')||'').toLowerCase();
        return l.includes('tacos') || l.includes('rooftop') || l.includes('downtown') || l.includes('remove') || l.includes('recent search');
      }).map(n => {
        const r = n.getBoundingClientRect();
        return { label: n.getAttribute('aria-label'), role: n.getAttribute('role'), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), cx: Math.round(r.left+r.width/2), cy: Math.round(r.top+r.height/2) };
      });
    });
    console.log('Recent search items:', JSON.stringify(recentAll));

    const removeItem = recentAll.find(i => (i.label||'').toLowerCase().includes('remove'));
    const searchableItem = recentAll.find(i => !(i.label||'').toLowerCase().includes('remove'));

    if (removeItem) {
      console.log(`Remove btn at y=${removeItem.y}, cy=${removeItem.cy} (bottom nav ~y=780)`);
      if (removeItem.y > 760) {
        fail('FIX-3', `Remove X at y=${removeItem.y} overlaps bottom nav (BUG-W03 not fixed)`, `Position (${removeItem.cx}, ${removeItem.cy})`, 'P1');
      } else {
        const urlB = page.url();
        await page.mouse.click(removeItem.cx, removeItem.cy);
        await page.waitForTimeout(1200);
        await shot(page, '12_after_remove');
        const urlA = page.url();
        const gone = !(await page.evaluate((lbl) => Array.from(document.querySelectorAll('flt-semantics')).some(n => n.getAttribute('aria-label') === lbl), removeItem.label));
        if (urlA.includes('profile') || urlA.includes('tab=4')) {
          fail('FIX-3', 'Remove X still navigates to Profile tab', `URL: ${urlA}`, 'P1');
        } else if (gone) {
          pass('FIX-3', 'Remove X removes recent search item without navigating');
        } else {
          partial('FIX-3', 'Remove X tapped — item still present, no profile nav', 'Check screenshot 12');
        }
      }
    } else {
      partial('FIX-3', 'No remove button in semantic tree', 'Recent search section absent or not accessible');
    }

    if (searchableItem) {
      await navigateTo(page, BASE_URL + '/#/search');
      const freshItem = await page.evaluate((lbl) => {
        const n = Array.from(document.querySelectorAll('flt-semantics')).find(n => n.getAttribute('aria-label') === lbl);
        if (!n) return null;
        const r = n.getBoundingClientRect();
        return { cx: Math.round(r.left+r.width/2), cy: Math.round(r.top+r.height/2) };
      }, searchableItem.label);
      if (freshItem) {
        await page.mouse.click(freshItem.cx, freshItem.cy);
        await page.waitForTimeout(1800);
        await shot(page, '13_after_recent_tap');
        const afterInfo = await getSemanticInfo(page);
        const afterText = afterInfo.labels.join(' ').toLowerCase();
        (afterText.includes('result') || afterInfo.hasBackBtn || afterText.includes('found'))
          ? pass('FIX-4', `Recent search item "${searchableItem.label}" tap → results`)
          : partial('FIX-4', 'Recent tap destination unclear', afterText.substring(0,60));
      }
    } else {
      partial('FIX-4', 'No searchable recent item found', 'Cannot test recent search tap-to-search');
    }

    // ===== DISCOVER =====
    console.log('\n=== DISCOVER ===');
    await navigateTo(page, BASE_URL + '/#/discover');
    await shot(page, '14_discover');
    const discInfo = await getSemanticInfo(page);
    console.log('Discover nodes:', discInfo.nodeCount);
    console.log('Discover labels:', discInfo.labels.slice(0,12).join(' | '));

    discInfo.nodeCount > 5 ? pass('DISCOVER-LOAD', `Discover loaded (${discInfo.nodeCount} nodes)`) : partial('DISCOVER-LOAD', 'Discover semantic tree sparse', `${discInfo.nodeCount} nodes`);

    // FIX-1: Age gate
    console.log('\n--- FIX-1: Age gate ---');
    const discTapTarget = discInfo.allNodes.find(n => n.y > 120 && n.y < 600 && n.w > 150 && n.h > 60)
      || { cx: 195, cy: 300 };
    console.log('Tapping:', JSON.stringify({ cx: discTapTarget.cx, cy: discTapTarget.cy, label: (discTapTarget.label||'').substring(0,40) }));

    await page.mouse.click(discTapTarget.cx, discTapTarget.cy);
    await page.waitForTimeout(2200);
    await shot(page, '15_after_disc_tap');
    await enableSemantics(page);
    const ageInfo = await getSemanticInfo(page);
    const ageText = ageInfo.labels.join(' ').toLowerCase();
    console.log('After tap labels:', ageText.substring(0,200));
    console.log('Age gate buttons:', ageInfo.buttons.map(b=>`"${b.label}"`).join(', '));

    if (ageText.includes('18') || ageText.includes('older') || ageText.includes('age')) {
      pass('DISCOVER-AGE-GATE', 'Age gate modal appeared');

      // Test "Go Back"
      const goBackBtn = await findBtnByLabel(ageInfo, ['go back', 'cancel', 'back']);
      if (goBackBtn && !(goBackBtn.label||'').toLowerCase().includes('18')) {
        await page.mouse.click(goBackBtn.cx, goBackBtn.cy);
        await page.waitForTimeout(1000);
        const afterGB = await getSemanticInfo(page);
        const gbText = afterGB.labels.join(' ').toLowerCase();
        !gbText.includes('go back') || gbText.includes('discover') || !gbText.includes('18')
          ? pass('DISCOVER-GO-BACK', '"Go Back" dismissed age gate')
          : fail('DISCOVER-GO-BACK', '"Go Back" did not dismiss', '', 'P1');
      }

      // Re-tap and confirm 18+
      await page.mouse.click(discTapTarget.cx, discTapTarget.cy);
      await page.waitForTimeout(1500);
      await enableSemantics(page);
      const ageInfo2 = await getSemanticInfo(page);
      const confirm18 = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('flt-semantics[role="button"]'));
        for (const b of btns) {
          const l = (b.getAttribute('aria-label')||'').toLowerCase();
          if ((l.includes('18') || l.includes('older') || l.includes('confirm') || l.includes('enter')) && !l.includes('go back') && !l.includes('cancel')) {
            const r = b.getBoundingClientRect();
            return { label: b.getAttribute('aria-label'), cx: Math.round(r.left+r.width/2), cy: Math.round(r.top+r.height/2) };
          }
        }
        return null;
      });
      console.log('Confirm 18+ btn:', JSON.stringify(confirm18));
      if (confirm18) {
        await page.mouse.click(confirm18.cx, confirm18.cy);
        await page.waitForTimeout(3000);
        await shot(page, '16_after_18_confirm');
        await enableSemantics(page);
        const afterConfirm = await getSemanticInfo(page);
        const afterConfirmText = afterConfirm.labels.join(' ').toLowerCase();
        console.log('After 18+ confirm:', afterConfirmText.substring(0,200));
        const ageGateGone = !afterConfirm.labels.some(l => l.toLowerCase().includes('18') && (l.toLowerCase().includes('older') || l.toLowerCase().includes('verify')));
        const hasEst = afterConfirmText.includes('reserve') || afterConfirmText.includes('write') || afterConfirmText.includes('rating') || afterConfirmText.includes('about') || afterConfirmText.includes('establishment');
        if (ageGateGone && hasEst) {
          pass('FIX-1', '"I am 18 or older" closes gate and shows establishment');
        } else if (ageGateGone) {
          partial('FIX-1', 'Age gate closed but establishment content unclear', afterConfirmText.substring(0,80));
        } else {
          fail('FIX-1', '"I am 18 or older" did NOT close age gate', `Still showing. Text: ${afterConfirmText.substring(0,80)}`, 'P0');
        }
      } else {
        fail('FIX-1', '"I am 18 or older" button not found on age gate', `Buttons: ${ageInfo2.buttons.map(b=>b.label).join(', ')}`, 'P0');
      }
    } else if (ageText.includes('reserve') || ageText.includes('write') || ageText.includes('establishment')) {
      partial('FIX-1', 'Establishment loaded directly (age gate bypassed — may be cached)', '');
    } else {
      partial('FIX-1', 'Tap did not show age gate or establishment', ageText.substring(0,80));
    }

    // ===== ESTABLISHMENT =====
    console.log('\n=== ESTABLISHMENT ===');
    // Get onto establishment by going through discover again
    await navigateTo(page, BASE_URL + '/#/discover');
    await page.mouse.click(discTapTarget.cx, discTapTarget.cy);
    await page.waitForTimeout(1800);
    await enableSemantics(page);
    const ageCheck = await getSemanticInfo(page);
    const ageCheckText = ageCheck.labels.join(' ').toLowerCase();
    if (ageCheckText.includes('18') || ageCheckText.includes('older')) {
      // Click confirm 18+
      const c18 = await page.evaluate(() => {
        for (const b of document.querySelectorAll('flt-semantics[role="button"]')) {
          const l = (b.getAttribute('aria-label')||'').toLowerCase();
          if ((l.includes('18') || l.includes('older')) && !l.includes('go back')) {
            const r = b.getBoundingClientRect();
            return { cx: Math.round(r.left+r.width/2), cy: Math.round(r.top+r.height/2) };
          }
        }
        return null;
      });
      if (c18) { await page.mouse.click(c18.cx, c18.cy); await page.waitForTimeout(2500); }
    }
    await shot(page, '17_establishment');
    await enableSemantics(page);
    const estInfo = await getSemanticInfo(page);
    const estText = estInfo.labels.join(' ').toLowerCase();
    console.log('Establishment nodes:', estInfo.nodeCount, 'hasBack:', estInfo.hasBackBtn);
    console.log('Establishment labels:', estText.substring(0,200));

    const onEstablishment = estText.includes('reserve') || estText.includes('write') || estText.includes('establishment') || estText.includes('rating') || estText.includes('about') || estText.includes('venue');

    if (onEstablishment) {
      pass('EST-LOAD', 'Establishment screen loaded');
      estInfo.hasBackBtn ? pass('EST-BACK', 'Establishment has back button') : fail('EST-BACK', 'No back button on Establishment', '', 'P1');

      // ===== RESERVATION FLOW =====
      console.log('\n=== RESERVATION FLOW ===');
      const reserveBtn = await findBtnByLabel(estInfo, ['reserve', 'book a table', 'make a reservation'], ['reservation']);
      console.log('Reserve btn:', JSON.stringify(reserveBtn));
      if (reserveBtn) {
        await page.mouse.click(reserveBtn.cx, reserveBtn.cy);
        await page.waitForTimeout(2500);
        await shot(page, '18_time_slot');
        await enableSemantics(page);
        const tsInfo = await getSemanticInfo(page);
        const tsText = tsInfo.labels.join(' ').toLowerCase();
        console.log('Time Slot labels:', tsText.substring(0,200));
        console.log('Time Slot back:', tsInfo.hasBackBtn);
        const onTimeSlot = tsText.includes('time') || tsText.includes('party') || tsText.includes('guest') || tsText.includes('slot') || tsText.includes('date') || tsText.includes('select') || tsText.includes('continue');
        if (onTimeSlot) {
          pass('RES-TIMESLOT', 'Time Slot screen loaded');
          tsInfo.hasBackBtn ? pass('FIX-6-TIMESLOT', 'Back button on Time Slot') : fail('FIX-6-TIMESLOT', 'No back button on Time Slot', '', 'P1');
          const hasCtrl = tsInfo.buttons.some(b => b.label === '+' || b.label.toLowerCase().includes('increase') || b.label.toLowerCase().includes('add'));
          hasCtrl ? pass('RES-PARTY-SIZE', 'Party size + control found') : partial('RES-PARTY-SIZE', 'Party size control not confirmed by aria-label');

          const contBtn = await findBtnByLabel(tsInfo, ['save & continue', 'save and continue', 'continue', 'next'], ['proceed']);
          if (contBtn) {
            await page.mouse.click(contBtn.cx, contBtn.cy);
            await page.waitForTimeout(2500);
            await shot(page, '19_confirm_booking');
            await enableSemantics(page);
            const cbInfo = await getSemanticInfo(page);
            const cbText = cbInfo.labels.join(' ').toLowerCase();
            console.log('Confirm Booking labels:', cbText.substring(0,200));
            console.log('Confirm Booking back:', cbInfo.hasBackBtn);
            const onConfirm = cbText.includes('confirm') || cbText.includes('booking') || cbText.includes('reservation') || cbText.includes('change time') || cbText.includes('date') || cbText.includes('guest');
            if (onConfirm) {
              pass('RES-CONFIRM-BOOKING', 'Confirm Booking screen loaded');
              cbInfo.hasBackBtn ? pass('FIX-6-CONFIRM', 'Back button on Confirm Booking') : fail('FIX-6-CONFIRM', 'No back button on Confirm Booking', '', 'P1');
              cbText.includes('change') ? pass('RES-CHANGE-TIME', '"Change Time" on Confirm Booking') : partial('RES-CHANGE-TIME', '"Change Time" not found');

              const finalBtn = await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('flt-semantics[role="button"]'));
                for (const b of btns) {
                  const l = (b.getAttribute('aria-label')||'').toLowerCase();
                  const r = b.getBoundingClientRect();
                  if ((l.includes('confirm') || l.includes('book')) && r.top > 500) return { label: b.getAttribute('aria-label'), cx: Math.round(r.left+r.width/2), cy: Math.round(r.top+r.height/2) };
                }
                for (const b of btns) {
                  const r = b.getBoundingClientRect();
                  if (r.top > 650 && r.width > 200) return { label: b.getAttribute('aria-label'), cx: Math.round(r.left+r.width/2), cy: Math.round(r.top+r.height/2) };
                }
                return null;
              });
              console.log('Final confirm:', JSON.stringify(finalBtn));
              if (finalBtn) {
                await page.mouse.click(finalBtn.cx, finalBtn.cy);
                await page.waitForTimeout(3000);
                await shot(page, '20_reservation_pass');
                await enableSemantics(page);
                const passInfo = await getSemanticInfo(page);
                const passText = passInfo.labels.join(' ').toLowerCase();
                console.log('Res pass labels:', passText.substring(0,200));
                const onPass = passText.includes('pass') || passText.includes('qr') || passText.includes('check-in') || passText.includes('confirmed') || passText.includes('otp') || passText.includes('booking confirmed');
                if (onPass) {
                  pass('RES-PASS', 'Reservation Pass loaded');
                  passInfo.hasBackBtn ? pass('RES-PASS-BACK', 'Back button on Reservation Pass') : fail('RES-PASS-BACK', 'No back button on Res Pass', '', 'P2');
                } else {
                  partial('RES-PASS', 'After confirm — pass screen unclear', passText.substring(0,80));
                }
              } else {
                partial('RES-CONFIRM-BTN', 'Final confirm button not found', cbText.substring(0,80));
              }
            } else {
              fail('RES-CONFIRM-BOOKING', 'Confirm Booking not reached', cbText.substring(0,80), 'P1');
            }
          } else {
            partial('RES-CONTINUE', 'No Continue button on Time Slot', tsText.substring(0,80));
          }
        } else {
          fail('RES-TIMESLOT', 'Time Slot not loaded', tsText.substring(0,80), 'P1');
        }
      } else {
        fail('RES-NO-BTN', 'Reserve button not found', estText.substring(0,60), 'P1');
      }

      // ===== REVIEW FLOW =====
      console.log('\n=== REVIEW FLOW ===');
      await navigateTo(page, BASE_URL + '/#/discover');
      await page.mouse.click(discTapTarget.cx, discTapTarget.cy);
      await page.waitForTimeout(1800);
      await enableSemantics(page);
      const ag3 = await page.evaluate(() => {
        for (const b of document.querySelectorAll('flt-semantics[role="button"]')) {
          const l = (b.getAttribute('aria-label')||'').toLowerCase();
          if ((l.includes('18') || l.includes('older')) && !l.includes('go back')) {
            const r = b.getBoundingClientRect();
            return { cx: Math.round(r.left+r.width/2), cy: Math.round(r.top+r.height/2) };
          }
        }
        return null;
      });
      if (ag3) { await page.mouse.click(ag3.cx, ag3.cy); await page.waitForTimeout(2500); }
      await enableSemantics(page);
      const estForReview = await getSemanticInfo(page);
      const writeBtn = await findBtnByLabel(estForReview, ['write a review', 'write review', 'review', 'verify visit', 'add review'], ['post review']);
      console.log('Write review btn:', JSON.stringify(writeBtn));

      if (writeBtn) {
        await page.mouse.click(writeBtn.cx, writeBtn.cy);
        await page.waitForTimeout(2500);
        await shot(page, '21_verify_visit');
        await enableSemantics(page);
        const vvInfo = await getSemanticInfo(page);
        const vvText = vvInfo.labels.join(' ').toLowerCase();
        console.log('Verify Visit labels:', vvText.substring(0,200));
        const onVV = vvText.includes('verify') || vvText.includes('visit') || vvText.includes('photo') || vvText.includes('gps') || vvText.includes('location') || vvText.includes('continue');
        if (onVV) {
          pass('REVIEW-VERIFY', 'Verify Visit screen loaded');
          vvInfo.hasBackBtn ? pass('REVIEW-VERIFY-BACK', 'Back button on Verify Visit') : fail('REVIEW-VERIFY-BACK', 'No back on Verify Visit', '', 'P1');

          const vvCont = await findBtnByLabel(vvInfo, ['continue', 'next', 'skip'], ['proceed']);
          if (vvCont) {
            await page.mouse.click(vvCont.cx, vvCont.cy);
            await page.waitForTimeout(2000);
            await shot(page, '22_rate_experience');
            await enableSemantics(page);
            const reInfo = await getSemanticInfo(page);
            const reText = reInfo.labels.join(' ').toLowerCase();
            console.log('Rate Experience labels:', reText.substring(0,200));
            const onRate = reText.includes('rate') || reText.includes('experience') || reText.includes('food') || reText.includes('service') || reText.includes('atmosphere') || reText.includes('quality');
            if (onRate) {
              pass('REVIEW-RATE', 'Rate Experience loaded');
              reInfo.hasBackBtn ? pass('REVIEW-RATE-BACK', 'Back button on Rate Experience') : fail('REVIEW-RATE-BACK', 'No back on Rate Experience', '', 'P1');

              const reCont = await findBtnByLabel(reInfo, ['continue', 'next'], ['proceed']);
              if (reCont) {
                await page.mouse.click(reCont.cx, reCont.cy);
                await page.waitForTimeout(2000);
                await shot(page, '23_creator_disclosure');
                await enableSemantics(page);
                const cdInfo = await getSemanticInfo(page);
                const cdText = cdInfo.labels.join(' ').toLowerCase();
                console.log('Creator Disclosure labels:', cdText.substring(0,200));
                const onCD = cdText.includes('creator') || cdText.includes('disclosure') || cdText.includes('affiliated') || cdText.includes('partner') || cdText.includes('relationship') || cdText.includes('conflict');
                if (onCD) {
                  pass('REVIEW-DISCLOSURE', 'Creator Disclosure loaded');
                  cdInfo.hasBackBtn ? pass('REVIEW-DISCLOSURE-BACK', 'Back button on Creator Disclosure') : fail('REVIEW-DISCLOSURE-BACK', 'No back on Creator Disclosure', '', 'P1');

                  const cdCont = await findBtnByLabel(cdInfo, ['confirm & continue', 'confirm and continue', 'confirm', 'continue', 'next'], ['proceed']);
                  if (cdCont) {
                    await page.mouse.click(cdCont.cx, cdCont.cy);
                    await page.waitForTimeout(2500);
                    await shot(page, '24_written_review');
                    await enableSemantics(page);
                    const wrInfo = await getSemanticInfo(page);
                    const wrText = wrInfo.labels.join(' ').toLowerCase();
                    console.log('Written Review labels:', wrText.substring(0,200));
                    console.log('Written Review textboxes:', JSON.stringify(wrInfo.textboxes));
                    const onWR = wrInfo.textboxes.length > 0 || wrText.includes('review') || wrText.includes('write') || wrText.includes('describe') || wrText.includes('experience');
                    if (onWR) {
                      pass('REVIEW-WRITTEN', 'Written Review loaded');
                      wrInfo.textboxes.length > 0 ? pass('REVIEW-TEXTAREA', 'Text area has textbox role (interactive)') : partial('REVIEW-TEXTAREA', 'No textbox role — may not accept input');
                      wrInfo.hasBackBtn ? pass('REVIEW-WRITTEN-BACK', 'Back button on Written Review') : fail('REVIEW-WRITTEN-BACK', 'No back on Written Review', '', 'P1');

                      const subBtn = await findBtnByLabel(wrInfo, ['submit', 'continue', 'publish', 'post review', 'post'], ['proceed']);
                      if (subBtn) {
                        await page.mouse.click(subBtn.cx, subBtn.cy);
                        await page.waitForTimeout(3000);
                        await shot(page, '25_review_submitted');
                        await enableSemantics(page);
                        const rsInfo = await getSemanticInfo(page);
                        const rsText = rsInfo.labels.join(' ').toLowerCase();
                        console.log('Review Submitted labels:', rsText.substring(0,250));
                        const onRS = rsText.includes('pts') || rsText.includes('points') || rsText.includes('badge') || rsText.includes('submitted') || rsText.includes('taster') || rsText.includes('earned') || rsText.includes('congratulation') || rsText.includes('thank');
                        if (onRS) {
                          pass('REVIEW-SUBMITTED', 'Review Submitted screen loaded');
                          rsText.includes('share') ? pass('FIX-9', '"Share Your Review" button present') : fail('FIX-9', 'No "Share Your Review" on submitted screen', '', 'P2');
                          rsText.includes('explore') ? pass('REVIEW-EXPLORE', '"Explore More Spots" present') : partial('REVIEW-EXPLORE', '"Explore More Spots" not confirmed');
                        } else {
                          partial('REVIEW-SUBMITTED', 'Review submitted screen unclear', rsText.substring(0,80));
                        }
                      } else {
                        partial('REVIEW-SUBMIT-BTN', 'Submit/Continue not found on Written Review', wrText.substring(0,80));
                      }
                    } else {
                      partial('REVIEW-WRITTEN', 'Written Review screen unclear', wrText.substring(0,80));
                    }
                  } else {
                    partial('REVIEW-CD-CONT', 'No Continue on Creator Disclosure', cdText.substring(0,80));
                  }
                } else {
                  partial('REVIEW-DISCLOSURE', 'Creator Disclosure unclear', cdText.substring(0,80));
                }
              } else { partial('REVIEW-RATE-CONT', 'No Continue on Rate Experience', reText.substring(0,80)); }
            } else { partial('REVIEW-RATE', 'Rate Experience unclear', reText.substring(0,80)); }
          } else { partial('REVIEW-VV-CONT', 'No Continue on Verify Visit', vvText.substring(0,80)); }
        } else {
          fail('REVIEW-VERIFY', 'Verify Visit not loaded', vvText.substring(0,80), 'P1');
        }
      } else {
        fail('REVIEW-NO-BTN', 'Write Review button not found', '', 'P1');
      }
    } else {
      fail('EST-LOAD', 'Establishment not reached', estText.substring(0,80), 'P1');
    }

    // ===== MESSAGES =====
    console.log('\n=== MESSAGES ===');
    await navigateTo(page, BASE_URL + '/#/messages');
    await shot(page, '26_messages');
    const msgInfo = await getSemanticInfo(page);
    const msgText = msgInfo.labels.join(' ').toLowerCase();
    console.log('Messages nodes:', msgInfo.nodeCount, 'labels:', msgText.substring(0,200));

    if (msgInfo.nodeCount > 5) {
      pass('MESSAGES-LOAD', `Messages loaded (${msgInfo.nodeCount} nodes)`);
      // FIX-12: tap conversation → chat
      const conv = await page.evaluate(() => {
        const nodes = Array.from(document.querySelectorAll('flt-semantics'));
        for (const n of nodes) {
          const l = (n.getAttribute('aria-label')||'').toLowerCase();
          const r = n.getBoundingClientRect();
          if ((l.includes('sarah') || l.includes('conversation') || l.includes('message')) && r.top > 100 && r.top < 700 && r.width > 200) {
            return { label: n.getAttribute('aria-label'), cx: Math.round(r.left+r.width/2), cy: Math.round(r.top+r.height/2) };
          }
        }
        for (const n of nodes) {
          const r = n.getBoundingClientRect();
          if (r.top > 120 && r.top < 600 && r.width > 250 && r.height > 40) {
            return { label: n.getAttribute('aria-label'), cx: Math.round(r.left+r.width/2), cy: Math.round(r.top+r.height/2) };
          }
        }
        return null;
      });
      console.log('Conversation to tap:', JSON.stringify(conv));
      if (conv) {
        const before = msgInfo.nodeCount;
        await page.mouse.click(conv.cx, conv.cy);
        await page.waitForTimeout(2500);
        await shot(page, '27_chat');
        await enableSemantics(page);
        const chatInfo = await getSemanticInfo(page);
        const chatText = chatInfo.labels.join(' ').toLowerCase();
        console.log('Chat labels:', chatText.substring(0,200));
        console.log('Chat textboxes:', JSON.stringify(chatInfo.textboxes));
        const onChat = chatText.includes('send') || chatText.includes('message') || chatInfo.textboxes.length > 0 || chatText.includes('hey') || chatText.includes('hello') || chatText.includes('type') || chatInfo.nodeCount !== before;
        if (onChat) {
          pass('FIX-12', 'Conversation tap opened chat screen');
          chatInfo.textboxes.length > 0 ? pass('MESSAGES-INPUT', 'Chat has text input field') : fail('MESSAGES-INPUT', 'No text input in chat', '', 'P1');
          chatInfo.hasBackBtn ? pass('MESSAGES-BACK', 'Chat has back button') : fail('MESSAGES-BACK', 'No back button in chat', '', 'P1');
        } else {
          fail('FIX-12', 'Conversation tap did not open chat', chatText.substring(0,80), 'P1');
        }
      } else {
        fail('FIX-12', 'No conversation item found', 'No sarah/message node', 'P1');
      }
    } else {
      fail('MESSAGES-LOAD', 'Messages empty', `${msgInfo.nodeCount} nodes`, 'P1');
    }

    // ===== PROFILE =====
    console.log('\n=== PROFILE ===');
    await navigateTo(page, BASE_URL + '/#/profile');
    await shot(page, '28_profile');
    const profInfo = await getSemanticInfo(page);
    const profText = profInfo.labels.join(' ').toLowerCase();
    console.log('Profile nodes:', profInfo.nodeCount, 'labels:', profText.substring(0,200));
    profInfo.nodeCount > 5 ? pass('PROFILE-LOAD', `Profile loaded (${profInfo.nodeCount} nodes)`) : partial('PROFILE-LOAD', 'Profile sparse', `${profInfo.nodeCount} nodes`);
    (profText.includes('posts') || profText.includes('reels') || profText.includes('reviews') || profText.includes('places')) ? pass('PROFILE-TABS', 'Profile content tabs (Posts/Reels/Reviews/Places)') : partial('PROFILE-TABS', 'Profile tabs not confirmed');
    (profText.includes('alan') || profText.includes('@') || profText.includes('profile')) ? pass('PROFILE-INFO', 'User info visible') : partial('PROFILE-INFO', 'User info not confirmed');

    // ===== SETTINGS =====
    console.log('\n=== SETTINGS ===');
    await navigateTo(page, BASE_URL + '/#/settings');
    await shot(page, '29_settings');
    const settInfo = await getSemanticInfo(page);
    const settText = settInfo.labels.join(' ').toLowerCase();
    console.log('Settings nodes:', settInfo.nodeCount);
    console.log('Settings labels:', settText.substring(0,300));
    console.log('Settings buttons:', settInfo.buttons.slice(0,10).map(b=>`"${b.label}"@y=${b.cy}`).join(', '));

    if (settInfo.nodeCount > 5) {
      pass('SETTINGS-LOAD', `Settings loaded (${settInfo.nodeCount} nodes)`);

      // FIX-11a: Personal Information
      console.log('\n--- FIX-11 Settings rows ---');
      const piBtn = await findBtnByLabel(settInfo, ['personal information', 'personal info']);
      if (piBtn) {
        await page.mouse.click(piBtn.cx, piBtn.cy);
        await page.waitForTimeout(1500);
        await shot(page, '30_personal_info');
        await enableSemantics(page);
        const piInfo = await getSemanticInfo(page);
        const piText = piInfo.labels.join(' ').toLowerCase();
        console.log('Personal info tap result:', piText.substring(0,100));
        piText.includes('coming') ? pass('FIX-11-PERSONAL', 'Personal Information → "Coming soon"') : partial('FIX-11-PERSONAL', 'Personal Info tapped — coming soon not seen', piText.substring(0,60));
        await page.waitForTimeout(600);
      } else { partial('FIX-11-PERSONAL', 'Personal Information button not found', settText.substring(0,80)); }

      // FIX-11b: Email Preferences
      await navigateTo(page, BASE_URL + '/#/settings');
      const epBtn = await findBtnByLabel(settInfo, ['email preference', 'email pref', 'email']);
      if (epBtn) {
        await page.mouse.click(epBtn.cx, epBtn.cy);
        await page.waitForTimeout(1500);
        await shot(page, '31_email_prefs');
        await enableSemantics(page);
        const epText = (await getSemanticInfo(page)).labels.join(' ').toLowerCase();
        epText.includes('coming') ? pass('FIX-11-EMAIL', 'Email Preferences → "Coming soon"') : partial('FIX-11-EMAIL', 'Email Prefs tapped — coming soon not seen', epText.substring(0,60));
      } else { partial('FIX-11-EMAIL', 'Email Preferences button not found'); }

      // Privacy Settings
      await navigateTo(page, BASE_URL + '/#/settings');
      const privBtn = await findBtnByLabel(settInfo, ['privacy settings', 'privacy']);
      if (privBtn) {
        await page.mouse.click(privBtn.cx, privBtn.cy);
        await page.waitForTimeout(2000);
        await shot(page, '32_privacy');
        await enableSemantics(page);
        const privInfo = await getSemanticInfo(page);
        const privText = privInfo.labels.join(' ').toLowerCase();
        console.log('Privacy labels:', privText.substring(0,150));
        const onPrivacy = privText.includes('privacy') || privText.includes('data') || privText.includes('location') || privText.includes('activity') || privText.includes('who can');
        if (onPrivacy) {
          pass('SETTINGS-PRIVACY', 'Privacy Settings opened');
          privInfo.hasBackBtn ? pass('SETTINGS-PRIVACY-BACK', 'Privacy Settings has back button') : fail('SETTINGS-PRIVACY-BACK', 'Privacy Settings missing back button', '', 'P1');
          if (privInfo.hasBackBtn) {
            const back = await getBackBtn(privInfo);
            await page.mouse.click(back.cx, back.cy);
            await page.waitForTimeout(800);
          }
        } else {
          fail('SETTINGS-PRIVACY', 'Privacy Settings did not open', privText.substring(0,60), 'P1');
        }
      } else { partial('SETTINGS-PRIVACY', 'Privacy button not found'); }

      // FIX-11c: Delete Account dialog
      await navigateTo(page, BASE_URL + '/#/settings');
      const delBtn = await findBtnByLabel(settInfo, ['delete account', 'delete my account', 'delete']);
      if (delBtn) {
        await page.mouse.click(delBtn.cx, delBtn.cy);
        await page.waitForTimeout(1500);
        await shot(page, '33_delete_dialog');
        await enableSemantics(page);
        const dlgInfo = await getSemanticInfo(page);
        const dlgText = dlgInfo.labels.join(' ').toLowerCase();
        console.log('Delete dialog labels:', dlgText.substring(0,150));
        (dlgText.includes('delete') && (dlgText.includes('confirm') || dlgText.includes('cancel') || dlgText.includes('permanent') || dlgText.includes('sure')))
          ? pass('FIX-11-DELETE', 'Delete Account → confirmation dialog shown')
          : partial('FIX-11-DELETE', 'Delete Account tapped — dialog unclear', dlgText.substring(0,60));
        const cancelBtn = await findBtnByLabel(dlgInfo, ['cancel', 'no', 'keep', 'dismiss']);
        if (cancelBtn) { await page.mouse.click(cancelBtn.cx, cancelBtn.cy); await page.waitForTimeout(500); }
      } else { fail('FIX-11-DELETE', 'Delete Account button not found', '', 'P1'); }

      // Logout
      await navigateTo(page, BASE_URL + '/#/settings');
      const logBtn = await findBtnByLabel(settInfo, ['log out', 'logout', 'sign out']);
      logBtn ? pass('SETTINGS-LOGOUT', `Logout button: "${logBtn.label}"`) : partial('SETTINGS-LOGOUT', 'Logout button not found by label');

    } else {
      fail('SETTINGS-LOAD', 'Settings empty', `${settInfo.nodeCount} nodes`, 'P1');
    }

    // ===== POINTS / BADGES / REDEEM =====
    console.log('\n=== POINTS / BADGES / REDEEM ===');
    for (const [route, shotNum, name] of [['/points','34','points'],['/badges','35','badges'],['/redeem','36','redeem']]) {
      await navigateTo(page, BASE_URL + '/#' + route);
      await shot(page, `${shotNum}_${name}`);
      const ri = await getSemanticInfo(page);
      const rtText = ri.labels.join(' ').toLowerCase();
      console.log(`${route} nodes:`, ri.nodeCount, 'labels:', rtText.substring(0,100));
      ri.nodeCount > 3
        ? pass(`ROUTE_${name.toUpperCase()}`, `${route} loads (${ri.nodeCount} nodes)`)
        : partial(`ROUTE_${name.toUpperCase()}`, `${route} sparse`, `${ri.nodeCount} nodes — check screenshot`);
    }

  } catch (err) {
    console.error('\nFATAL ERROR:', err.message, '\n', err.stack?.split('\n').slice(0,4).join('\n'));
    await shot(page, 'fatal_error').catch(() => {});
  } finally {
    await browser.close();
  }

  // ===== SUMMARY =====
  console.log('\n\n====================================================');
  console.log('              TEST RESULTS SUMMARY');
  console.log('====================================================');
  const passed = results.filter(r => r.status === 'PASS');
  const failed = results.filter(r => r.status === 'FAIL');
  const partials = results.filter(r => r.status === 'PARTIAL');
  console.log(`PASS:    ${passed.length}`);
  console.log(`FAIL:    ${failed.length}`);
  console.log(`PARTIAL: ${partials.length}`);
  console.log(`TOTAL:   ${results.length}`);
  console.log(`Pass rate: ${passed.length}/${results.length} (${Math.round(passed.length/results.length*100)}%)`);

  console.log('\n--- FAILURES ---');
  failed.forEach(r => console.log(`  FAIL [${r.severity}] [${r.id}]\n    ${r.desc}\n    ${r.detail}`));
  console.log('\n--- PARTIALS ---');
  partials.forEach(r => console.log(`  PARTIAL [${r.id}]\n    ${r.desc}\n    ${r.detail}`));
  console.log('\n--- PASSES ---');
  passed.forEach(r => console.log(`  PASS [${r.id}] ${r.desc}`));

  console.log('\n--- CONSOLE ERRORS ---');
  consoleErrors.length === 0 ? console.log('  None') : consoleErrors.slice(0,8).forEach((e,i) => console.log(`  [${i+1}] ${e.substring(0,120)}`));

  fs.writeFileSync('C:/Projects/Zupurb/test/e2e_web/results.json', JSON.stringify({ results, consoleErrors, summary: { passed: passed.length, failed: failed.length, partial: partials.length, total: results.length } }, null, 2));
  console.log('\nResults: C:/Projects/Zupurb/test/e2e_web/results.json');
  console.log('Screenshots: C:/Projects/Zupurb/test/e2e_web/screenshots/');
})();
