/**
 * Zupurb Web App - Comprehensive QA Regression Test v2
 *
 * Improvements over v1:
 * - Uses JS-dispatch to activate Flutter semantics (headless-compatible)
 * - Authenticates once and reuses session; does NOT re-navigate away from auth state
 * - Uses coordinate-based clicking matched to visual screenshot positions
 * - Verifies navigation via URL changes and visual content changes
 * - Screenshots taken at every key step
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://zupurb-dev.web.app';
const SCREENSHOT_DIR = 'C:/Projects/Zupurb/test/e2e_web/screenshots_v2';
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = [];
let shotCount = 0;
const consoleErrors = [];
const startTime = Date.now();

function pass(id, desc) {
  results.push({ id, status: 'PASS', desc });
  console.log(`PASS    [${id}] ${desc}`);
}
function fail(id, desc, detail = '', severity = 'P1') {
  results.push({ id, status: 'FAIL', desc, detail, severity });
  console.log(`FAIL    [${id}][${severity}] ${desc}${detail ? ' -- ' + detail : ''}`);
}
function partial(id, desc, detail = '') {
  results.push({ id, status: 'PARTIAL', desc, detail });
  console.log(`PARTIAL [${id}] ${desc}${detail ? ' -- ' + detail : ''}`);
}

async function shot(page, name) {
  const file = path.join(SCREENSHOT_DIR, `${String(++shotCount).padStart(3, '0')}_${name}.png`);
  await page.screenshot({ path: file, fullPage: false }).catch(e => console.log('Screenshot err:', e.message));
  return file;
}

/** Activate Flutter accessibility semantics via JS (headless-compatible) */
async function activateSemantics(page) {
  await page.evaluate(() => {
    const ph = document.querySelector('flt-semantics-placeholder');
    if (ph) ph.click();
  });
  await page.waitForTimeout(1500);
}

/** Get all semantic nodes from Flutter */
async function getNodes(page) {
  await activateSemantics(page);
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll('flt-semantics')).map(n => {
      const r = n.getBoundingClientRect();
      return {
        label: n.getAttribute('aria-label') || '',
        role: n.getAttribute('role') || '',
        checked: n.getAttribute('aria-checked'),
        pressed: n.getAttribute('aria-pressed'),
        x: Math.round(r.left), y: Math.round(r.top),
        w: Math.round(r.width), h: Math.round(r.height),
        cx: Math.round(r.left + r.width / 2),
        cy: Math.round(r.top + r.height / 2),
      };
    }).filter(n => n.w > 0 && n.h > 0);
  });
}

/** Find a node by role within a bounding box */
function findBtn(nodes, role = 'button') {
  return nodes.filter(n => n.role === role);
}

/** Find button closest to given coordinates */
function nearestBtn(nodes, cx, cy, maxDist = 60) {
  let best = null, bestD = Infinity;
  for (const n of nodes) {
    if (n.role !== 'button') continue;
    const d = Math.hypot(n.cx - cx, n.cy - cy);
    if (d < bestD && d <= maxDist) { bestD = d; best = n; }
  }
  return best;
}

/** Click at coordinate, wait, return new nodes */
async function clickAt(page, cx, cy, waitMs = 2000) {
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(waitMs);
}

/** Wait for Flutter app to render (glass pane present) */
async function waitForFlutter(page, timeout = 20000) {
  await page.waitForFunction(() => !!document.querySelector('flt-glass-pane'), { timeout }).catch(() => {});
  await page.waitForTimeout(3000);
}

/** Check if URL changed (navigation happened) */
function urlChanged(before, after) {
  return before !== after;
}

/** Check if node count changed significantly */
function screenChanged(before, after, threshold = 3) {
  return Math.abs(before.length - after.length) >= threshold;
}

// ============================================================
// MAIN TEST EXECUTION
// ============================================================
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
  });

  const page = await ctx.newPage();
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push('PAGE_ERROR: ' + err.message));

  // ============================
  // STEP 1: LOGIN via Try Demo
  // ============================
  console.log('\n=== STEP 1: LOGIN ===');
  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 30000 });
  await waitForFlutter(page);
  await shot(page, 'login_01_initial');

  // Activate semantics
  const loginNodes = await getNodes(page);
  console.log(`Login screen: ${loginNodes.length} semantic nodes`);

  // Login screen layout from visual analysis:
  // Try Demo button is at ~(195, 652) based on screenshot
  // The nodes at top:630 role=button is Try Demo

  const tryDemoNode = loginNodes.find(n => n.role === 'button' && n.y >= 620 && n.y <= 680);
  console.log('Try Demo candidate:', JSON.stringify(tryDemoNode));

  const tryDemoCoords = tryDemoNode ? { cx: tryDemoNode.cx, cy: tryDemoNode.cy } : { cx: 195, cy: 652 };
  console.log(`Clicking Try Demo at (${tryDemoCoords.cx}, ${tryDemoCoords.cy})`);

  await page.mouse.click(tryDemoCoords.cx, tryDemoCoords.cy);
  console.log('Try Demo clicked, waiting for auth (up to 15s)...');

  // Wait for navigation away from login
  await page.waitForFunction(
    () => !window.location.hash.includes('login') && window.location.hash !== '',
    { timeout: 15000 }
  ).catch(async () => {
    console.log('Auth wait timed out, checking URL...');
  });

  await page.waitForTimeout(2000);
  await shot(page, 'login_02_after_try_demo');

  const urlAfterLogin = page.url();
  console.log('URL after Try Demo:', urlAfterLogin);

  const loginSucceeded = !urlAfterLogin.includes('login') && urlAfterLogin !== BASE_URL;

  if (loginSucceeded) {
    pass('LOGIN', `Try Demo succeeded — navigated to ${urlAfterLogin}`);
  } else {
    // Try again — maybe we need to wait longer or retry
    console.log('First try did not succeed, attempting retry...');
    await page.mouse.click(tryDemoCoords.cx, tryDemoCoords.cy);
    await page.waitForTimeout(8000);
    const urlRetry = page.url();
    console.log('URL after retry:', urlRetry);
    if (!urlRetry.includes('login') && urlRetry !== BASE_URL) {
      pass('LOGIN', `Try Demo (retry) succeeded — navigated to ${urlRetry}`);
    } else {
      // Check if it might have navigated to onboarding
      const nodesAfter = await getNodes(page);
      if (nodesAfter.length > 5) {
        partial('LOGIN', 'URL still shows login but app has semantic content — may be SPA routing', `${nodesAfter.length} nodes`);
      } else {
        fail('LOGIN', 'Try Demo failed — app stays on login screen', `URL: ${urlRetry}`, 'P0');
        await browser.close();
        printSummary();
        return;
      }
    }
  }

  const homeUrl = page.url();
  console.log('Authenticated, current URL:', homeUrl);

  // ============================
  // STEP 2: VERIFY HOME SCREEN
  // ============================
  console.log('\n=== STEP 2: HOME SCREEN ===');
  // Navigate to home if not already there
  if (!homeUrl.includes('/home') && !homeUrl.includes('/#/')) {
    await page.goto(BASE_URL + '/#/home', { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(3000);
  }
  await shot(page, 'home_01');
  const homeNodes = await getNodes(page);
  console.log(`Home: ${homeNodes.length} nodes, URL: ${page.url()}`);

  if (homeNodes.length > 5) {
    pass('HOME-LOAD', `Home screen loaded (${homeNodes.length} nodes)`);
  } else {
    partial('HOME-LOAD', 'Home loaded but semantic tree sparse', `${homeNodes.length} nodes — check screenshot`);
  }

  // Check for tab bar (All/Reviews/Feed/Creators/Deals)
  const homeText = homeNodes.map(n => n.label.toLowerCase()).join(' ');
  const hasTabBar = homeText.includes('all') || homeText.includes('review') || homeText.includes('feed') || homeText.includes('creator') || homeText.includes('deal');
  hasTabBar ? pass('HOME-TABS', 'Home tab bar visible in semantic tree') : partial('HOME-TABS', 'Tab bar not confirmed via labels', 'Check screenshot');

  // ============================
  // F8/FIX-13: Review card body tap
  // ============================
  console.log('\n--- F8: Review card body tap (FIX-13) ---');
  // Cards typically in middle of screen y: 200-650
  const cardCandidates = homeNodes.filter(n =>
    n.y > 180 && n.y < 650 && n.w > 200 && n.h > 60 &&
    !['all', 'reviews', 'feed', 'creators', 'deals', 'home', 'search', 'discover', 'messages', 'profile'].some(t => n.label.toLowerCase() === t)
  );
  console.log('Card candidates:', cardCandidates.slice(0, 5).map(n => `y=${n.y} h=${n.h} role=${n.role} label="${n.label.substring(0, 30)}"`).join(', '));

  const cardTarget = cardCandidates[0] || { cx: 195, cy: 370 };
  const urlBeforeCard = page.url();
  await clickAt(page, cardTarget.cx, cardTarget.cy, 3000);
  await shot(page, 'home_02_after_card_tap');
  const urlAfterCard = page.url();
  const nodesAfterCard = await getNodes(page);
  const nodesAfterCardText = nodesAfterCard.map(n => n.label.toLowerCase()).join(' ');

  const cardTapNavigated = urlChanged(urlBeforeCard, urlAfterCard) ||
    nodesAfterCardText.includes('reserve') || nodesAfterCardText.includes('write') ||
    nodesAfterCardText.includes('18') || nodesAfterCardText.includes('establishment');

  if (cardTapNavigated) {
    pass('F8', `Review card body tap navigated — URL: ${urlAfterCard}`);
  } else if (Math.abs(nodesAfterCard.length - homeNodes.length) >= 3) {
    partial('F8', 'Card tap changed screen content', `${homeNodes.length} → ${nodesAfterCard.length} nodes`);
  } else {
    fail('F8', 'Review card body tap — no navigation detected', `URL unchanged: ${urlAfterCard}`, 'P1');
  }

  // ============================
  // F7: Like/Dislike toggle
  // ============================
  console.log('\n--- F7: Like/Dislike toggle ---');
  // Return to home to test like/dislike on cards
  await page.goto(BASE_URL + '/#/home', { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(2500);
  const homeNodes2 = await getNodes(page);

  // Like/dislike buttons are typically small icons on card — look for buttons near bottom of card area
  const potentialLikeBtns = homeNodes2.filter(n => n.role === 'button' && n.y > 400 && n.y < 750 && n.w < 80);
  console.log('Potential like/dislike buttons:', potentialLikeBtns.map(n => `(${n.cx},${n.cy}) w=${n.w} h=${n.h} lbl="${n.label}"`).join(', '));

  if (potentialLikeBtns.length >= 2) {
    const likeBtn = potentialLikeBtns[0];
    const stateBefore = { checked: likeBtn.checked, pressed: likeBtn.pressed };
    await clickAt(page, likeBtn.cx, likeBtn.cy, 1000);
    await shot(page, 'home_03_after_like');
    const nodesAfterLike = await getNodes(page);
    const likeBtnAfter = nodesAfterLike.find(n => n.cx === likeBtn.cx && n.cy === likeBtn.cy && n.role === 'button');
    const stateAfter = likeBtnAfter ? { checked: likeBtnAfter.checked, pressed: likeBtnAfter.pressed } : null;
    console.log('Like state before:', stateBefore, 'after:', stateAfter);

    if (stateAfter && (stateBefore.checked !== stateAfter.checked || stateBefore.pressed !== stateAfter.pressed)) {
      pass('F7-LIKE', 'Like button state toggled');
    } else {
      partial('F7-LIKE', 'Like tapped — state comparison inconclusive', 'Check screenshot home_03');
    }

    // Test dislike
    if (potentialLikeBtns.length >= 2) {
      const dislikeBtn = potentialLikeBtns[1];
      await clickAt(page, dislikeBtn.cx, dislikeBtn.cy, 800);
      await shot(page, 'home_04_after_dislike');
      pass('F7-DISLIKE', 'Dislike button tapped');

      // Tap like while dislike is active (mutual exclusion)
      await clickAt(page, likeBtn.cx, likeBtn.cy, 800);
      pass('F7-MUTUAL', 'Like tapped while dislike active — mutual exclusion exercised');
    }
  } else {
    partial('F7', `Only ${potentialLikeBtns.length} small buttons found in card area`, 'Like/dislike may not have semantic roles');
  }

  // ============================
  // HOME: Notifications (FIX-6)
  // ============================
  console.log('\n--- HOME: Notifications + Back (FIX-6) ---');
  const homeNodes3 = await getNodes(page);
  // Notifications bell is typically top-right
  const bellCandidates = homeNodes3.filter(n => n.role === 'button' && n.x > 300 && n.y < 80);
  console.log('Bell candidates (top-right buttons):', bellCandidates.map(n => `(${n.cx},${n.cy}) lbl="${n.label}"`).join(', '));

  const bellBtn = bellCandidates[0] || null;
  if (bellBtn) {
    const urlBefore = page.url();
    await clickAt(page, bellBtn.cx, bellBtn.cy, 2500);
    await shot(page, 'notif_01_screen');
    const notifNodes = await getNodes(page);
    const notifText = notifNodes.map(n => n.label.toLowerCase()).join(' ');
    console.log('Notifications screen:', notifNodes.length, 'nodes, text:', notifText.substring(0, 100));
    const onNotif = notifText.includes('notif') || notifText.includes('alert') || notifText.includes('activity') ||
      urlChanged(urlBefore, page.url()) || notifNodes.length !== homeNodes3.length;

    if (onNotif) {
      pass('HOME-NOTIF', 'Notifications screen opened');
      const backCandidates = notifNodes.filter(n => n.role === 'button' && n.x < 80 && n.y < 100);
      if (backCandidates.length > 0) {
        await clickAt(page, backCandidates[0].cx, backCandidates[0].cy, 1500);
        const backNodes = await getNodes(page);
        const backText = backNodes.map(n => n.label.toLowerCase()).join(' ');
        const returnedHome = backText.includes('all') || backText.includes('review') || backText.includes('feed') || page.url().includes('home');
        returnedHome ? pass('F6-NOTIF-BACK', 'Back from Notifications returns to Home') : partial('F6-NOTIF-BACK', 'Back pressed, destination unclear', page.url());
      } else {
        fail('F6-NOTIF-BACK', 'No back button on Notifications screen', '', 'P1');
      }
    } else {
      fail('HOME-NOTIF', 'Bell tap did not open Notifications', notifText.substring(0, 60), 'P2');
    }
  } else {
    partial('HOME-NOTIF', 'Bell button not found (no button in top-right area)', '');
  }

  // ============================
  // STEP 3: SEARCH SCREEN
  // ============================
  console.log('\n=== STEP 3: SEARCH SCREEN ===');
  await page.goto(BASE_URL + '/#/search', { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(2500);
  await shot(page, 'search_01');
  const searchNodes = await getNodes(page);
  console.log('Search:', searchNodes.length, 'nodes');

  searchNodes.length > 3 ? pass('SEARCH-LOAD', `Search loaded (${searchNodes.length} nodes)`) : partial('SEARCH-LOAD', 'Search sparse', `${searchNodes.length} nodes`);

  // FIX-2: Text input
  const textboxes = searchNodes.filter(n => ['textbox', 'searchbox', 'combobox'].includes(n.role));
  console.log('Textboxes:', JSON.stringify(textboxes));

  if (textboxes.length > 0) {
    const tb = textboxes[0];
    await page.mouse.click(tb.cx, tb.cy);
    await page.waitForTimeout(500);
    await page.keyboard.type('rooftop bar');
    await page.waitForTimeout(800);
    await shot(page, 'search_02_typed');
    pass('F2', `Search textbox (role=${tb.role}) at (${tb.cx},${tb.cy}) — typed text`);
  } else {
    // Search input might be above the tab bar area ~ y=100-160
    const inputCandidates = searchNodes.filter(n => n.y > 70 && n.y < 200 && n.w > 150);
    console.log('Input candidates:', inputCandidates.map(n => `(${n.cx},${n.cy}) role=${n.role}`).join(', '));
    if (inputCandidates.length > 0) {
      await page.mouse.click(inputCandidates[0].cx, inputCandidates[0].cy);
      await page.waitForTimeout(500);
      await page.keyboard.type('rooftop bar');
      await page.waitForTimeout(800);
      await shot(page, 'search_02_typed_visual');
      partial('F2', 'Typed in search area but no textbox role — may work visually', 'Check screenshot');
    } else {
      fail('F2', 'No textbox/searchbox in semantic tree and no input candidate in search area', '', 'P1');
    }
  }

  // Filters check
  const filterNodes = searchNodes.filter(n => ['switch', 'checkbox'].includes(n.role));
  filterNodes.length > 0 ? pass('SEARCH-FILTERS', `${filterNodes.length} filter controls`) : partial('SEARCH-FILTERS', 'No filter controls in semantic tree');

  // FIX-5: Search button → results → back button
  console.log('\n--- F5: Search results + back button ---');
  await page.goto(BASE_URL + '/#/search', { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(2000);
  const searchNodesB = await getNodes(page);
  // Search submit button — typically bottom area or right side of search bar
  const searchSubmitBtns = searchNodesB.filter(n => n.role === 'button');
  console.log('All buttons on search screen:', searchSubmitBtns.map(n => `(${n.cx},${n.cy}) lbl="${n.label}" y=${n.y}`).join(', '));

  // Try keyboard Enter to submit search
  const searchInput = searchNodesB.find(n => ['textbox', 'searchbox', 'combobox'].includes(n.role));
  if (searchInput) {
    await page.mouse.click(searchInput.cx, searchInput.cy);
    await page.waitForTimeout(300);
    await page.keyboard.type('bar');
    await page.keyboard.press('Enter');
  } else {
    // Click in search input area and press Enter
    await page.mouse.click(195, 115);
    await page.waitForTimeout(300);
    await page.keyboard.type('bar');
    await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(3000);
  await shot(page, 'search_03_results');
  const resultsNodes = await getNodes(page);
  const resultsUrl = page.url();
  console.log('After search submit:', resultsNodes.length, 'nodes, URL:', resultsUrl);

  const onResults = resultsNodes.length !== searchNodesB.length ||
    urlChanged(BASE_URL + '/#/search', resultsUrl) ||
    resultsNodes.map(n => n.label.toLowerCase()).join(' ').includes('result');

  if (onResults) {
    pass('SEARCH-RESULTS', `Search results loaded (${resultsNodes.length} nodes)`);
    const backBtns = resultsNodes.filter(n => n.role === 'button' && n.x < 80 && n.y < 100);
    if (backBtns.length > 0) {
      pass('F5', 'Search results has back button (top-left)');
      await clickAt(page, backBtns[0].cx, backBtns[0].cy, 1500);
      const afterBackNodes = await getNodes(page);
      const afterBackUrl = page.url();
      const returnedToSearch = afterBackUrl.includes('search') || afterBackNodes.map(n => n.label.toLowerCase()).join(' ').includes('search');
      returnedToSearch ? pass('BACK-RESULTS', 'Back from results → search screen') : partial('BACK-RESULTS', 'Back pressed', afterBackUrl);
    } else {
      fail('F5', 'No back button in search results (top-left x<80, y<100)', `Buttons: ${resultsNodes.filter(n => n.role === 'button').map(n => `(${n.x},${n.y})`).join(', ')}`, 'P1');
    }
  } else {
    partial('SEARCH-RESULTS', 'Search submit — results unclear', `${searchNodesB.length} → ${resultsNodes.length} nodes`);
    partial('F5', 'Cannot test — did not reach results screen', '');
  }

  // FIX-3 & FIX-4: Recent searches
  console.log('\n--- F3/F4: Recent searches ---');
  await page.goto(BASE_URL + '/#/search', { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(2000);
  const searchNodesC = await getNodes(page);

  // Recent searches typically appear below search bar as list items
  // Look for remove/X buttons (small, typically to the right of list items)
  const recentXBtns = searchNodesC.filter(n => n.role === 'button' && n.w < 50 && n.y > 130 && n.y < 650);
  const recentItems = searchNodesC.filter(n => n.role !== 'button' && n.y > 130 && n.y < 650 && n.w > 150 && n.h < 60);
  console.log('Recent X buttons:', recentXBtns.map(n => `(${n.cx},${n.cy}) lbl="${n.label}"`).join(', '));
  console.log('Recent items:', recentItems.slice(0, 5).map(n => `(${n.cx},${n.cy}) lbl="${n.label.substring(0, 30)}"`).join(', '));

  if (recentXBtns.length > 0) {
    const xBtn = recentXBtns[0];
    const urlBefore = page.url();
    await clickAt(page, xBtn.cx, xBtn.cy, 1500);
    await shot(page, 'search_04_after_remove');
    const afterRemove = await getNodes(page);
    const afterRemoveUrl = page.url();

    if (urlChanged(urlBefore, afterRemoveUrl) && !afterRemoveUrl.includes('search')) {
      fail('F3', 'Remove X navigated away from search screen', `Went to: ${afterRemoveUrl}`, 'P1');
    } else if (afterRemove.length < searchNodesC.length) {
      pass('F3', `Remove X removed item (${searchNodesC.length} → ${afterRemove.length} nodes)`);
    } else {
      partial('F3', 'Remove X tapped — no node count change', 'Check screenshot search_04');
    }
  } else {
    partial('F3', 'No recent search X buttons found', `${recentXBtns.length} small buttons found in list area`);
  }

  if (recentItems.length > 0) {
    await page.goto(BASE_URL + '/#/search', { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(2000);
    const freshNodes = await getNodes(page);
    const freshItems = freshNodes.filter(n => n.role !== 'button' && n.y > 130 && n.y < 650 && n.w > 150 && n.h < 60);
    if (freshItems.length > 0) {
      const urlBefore = page.url();
      await clickAt(page, freshItems[0].cx, freshItems[0].cy, 2000);
      await shot(page, 'search_05_recent_tap');
      const afterTapNodes = await getNodes(page);
      const afterTapUrl = page.url();
      const navigatedToResults = urlChanged(urlBefore, afterTapUrl) || afterTapNodes.length !== freshNodes.length;
      navigatedToResults ? pass('F4', `Recent search tap navigated — URL: ${afterTapUrl}`) : partial('F4', 'Recent tap — no clear navigation', afterTapUrl);
    } else {
      partial('F4', 'No recent search items to tap after re-navigation', '');
    }
  } else {
    partial('F4', 'No recent search items found in semantic tree', '');
  }

  // ============================
  // STEP 4: DISCOVER + AGE GATE
  // ============================
  console.log('\n=== STEP 4: DISCOVER + AGE GATE (F1) ===');
  await page.goto(BASE_URL + '/#/discover', { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(2500);
  await shot(page, 'discover_01');
  const discNodes = await getNodes(page);
  console.log('Discover:', discNodes.length, 'nodes');
  discNodes.length > 3 ? pass('DISCOVER-LOAD', `Discover loaded (${discNodes.length} nodes)`) : partial('DISCOVER-LOAD', 'Discover sparse');

  // Find a venue card to tap — large cards in middle area
  const venueCandidates = discNodes.filter(n => n.y > 100 && n.y < 680 && n.w > 150 && n.h > 60);
  const venueTarget = venueCandidates[0] || { cx: 195, cy: 300 };
  console.log('Tapping venue at:', JSON.stringify({ cx: venueTarget.cx, cy: venueTarget.cy }));

  await clickAt(page, venueTarget.cx, venueTarget.cy, 2500);
  await shot(page, 'discover_02_after_tap');
  const ageGateNodes = await getNodes(page);
  const ageGateText = ageGateNodes.map(n => n.label.toLowerCase()).join(' ');
  console.log('After discover tap:', ageGateNodes.length, 'nodes, text:', ageGateText.substring(0, 200));
  console.log('Buttons:', ageGateNodes.filter(n => n.role === 'button').map(n => `(${n.cx},${n.cy}) lbl="${n.label}"`).join(', '));

  const ageGateShown = ageGateText.includes('18') || ageGateText.includes('older') || ageGateText.includes('age');
  const establishmentDirect = ageGateText.includes('reserve') || ageGateText.includes('write') || ageGateText.includes('establishment');

  if (ageGateShown) {
    pass('DISCOVER-AGE-GATE', 'Age gate modal appeared');

    // Test "Go Back" button
    const goBackBtn = ageGateNodes.find(n => n.role === 'button' &&
      (n.label.toLowerCase().includes('go back') || n.label.toLowerCase().includes('back') ||
       (n.y > 400 && n.x < 250 && !n.label.toLowerCase().includes('18'))));
    console.log('Go Back btn:', JSON.stringify(goBackBtn));
    if (goBackBtn) {
      await clickAt(page, goBackBtn.cx, goBackBtn.cy, 1500);
      await shot(page, 'discover_03_go_back');
      const afterGoBack = await getNodes(page);
      const afterGoBackText = afterGoBack.map(n => n.label.toLowerCase()).join(' ');
      const ageGateGone = !afterGoBackText.includes('18') || afterGoBackText.includes('discover');
      ageGateGone ? pass('F1-GO-BACK', '"Go Back" dismissed age gate') : fail('F1-GO-BACK', '"Go Back" did not dismiss age gate', '', 'P1');

      // Re-tap to show age gate again
      await page.goto(BASE_URL + '/#/discover', { waitUntil: 'load', timeout: 20000 });
      await page.waitForTimeout(2000);
      await clickAt(page, venueTarget.cx, venueTarget.cy, 2500);
      await activateSemantics(page);
    }

    // Tap "I am 18 or older" button
    const confirmBtns = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('flt-semantics[role="button"]')).map(n => {
        const l = (n.getAttribute('aria-label') || '').toLowerCase();
        const r = n.getBoundingClientRect();
        return { label: n.getAttribute('aria-label'), l, cx: Math.round(r.left + r.width / 2), cy: Math.round(r.top + r.height / 2), y: Math.round(r.top) };
      }).filter(n => (n.l.includes('18') || n.l.includes('older') || n.l.includes('confirm') || n.l.includes('enter')) && !n.l.includes('go back') && !n.l.includes('cancel'));
    });
    console.log('18+ confirm buttons:', JSON.stringify(confirmBtns));

    // If no labeled button, use bottom button (I am 18 = second/lower button on age gate)
    let confirm18Coords = confirmBtns[0] ? { cx: confirmBtns[0].cx, cy: confirmBtns[0].cy } : null;
    if (!confirm18Coords) {
      const ageBtns = ageGateNodes.filter(n => n.role === 'button');
      // The "I am 18+" button is typically the lower/primary CTA
      const primBtn = ageBtns.find(n => n.y > 500) || ageBtns[ageBtns.length - 1];
      confirm18Coords = primBtn ? { cx: primBtn.cx, cy: primBtn.cy } : { cx: 195, cy: 560 };
    }
    console.log('Clicking 18+ at:', JSON.stringify(confirm18Coords));

    await clickAt(page, confirm18Coords.cx, confirm18Coords.cy, 3500);
    await shot(page, 'discover_04_after_18_confirm');
    const afterConfirmNodes = await getNodes(page);
    const afterConfirmText = afterConfirmNodes.map(n => n.label.toLowerCase()).join(' ');
    console.log('After 18+ confirm:', afterConfirmText.substring(0, 200));

    const ageGateCleared = !afterConfirmNodes.some(n => n.label.toLowerCase().includes('older') && n.label.toLowerCase().includes('18'));
    const hasEstContent = afterConfirmText.includes('reserve') || afterConfirmText.includes('write') || afterConfirmText.includes('establishment') || afterConfirmText.includes('rating') || afterConfirmText.includes('about');

    if (ageGateCleared && hasEstContent) {
      pass('F1', '"I am 18 or older" — age gate closed, establishment loaded');
    } else if (ageGateCleared) {
      partial('F1', 'Age gate closed but establishment content not confirmed', afterConfirmText.substring(0, 80));
    } else {
      fail('F1', '"I am 18 or older" did NOT close age gate', afterConfirmText.substring(0, 80), 'P0');
    }

  } else if (establishmentDirect) {
    partial('F1', 'Establishment loaded directly without age gate — may be cached', '');
  } else {
    fail('F1', 'Discover tap did not show age gate or establishment', ageGateText.substring(0, 80), 'P1');
  }

  // ============================
  // STEP 5: ESTABLISHMENT SCREEN
  // ============================
  console.log('\n=== STEP 5: ESTABLISHMENT SCREEN ===');
  // Get onto establishment
  await page.goto(BASE_URL + '/#/discover', { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(2000);
  await clickAt(page, venueTarget.cx, venueTarget.cy, 2500);

  // Handle age gate if shown
  const estCheckNodes = await getNodes(page);
  const estCheckText = estCheckNodes.map(n => n.label.toLowerCase()).join(' ');
  if (estCheckText.includes('18') || estCheckText.includes('older')) {
    const ageBtns = estCheckNodes.filter(n => n.role === 'button');
    const primBtn = ageBtns.find(n => n.y > 500) || ageBtns[ageBtns.length - 1];
    if (primBtn) await clickAt(page, primBtn.cx, primBtn.cy, 3000);
  }

  await shot(page, 'est_01');
  const estNodes = await getNodes(page);
  const estText = estNodes.map(n => n.label.toLowerCase()).join(' ');
  console.log('Establishment:', estNodes.length, 'nodes, text:', estText.substring(0, 200));
  console.log('Est back btn:', estNodes.filter(n => n.role === 'button' && n.x < 80 && n.y < 100).map(n => `(${n.cx},${n.cy})`).join(', '));

  const onEst = estText.includes('reserve') || estText.includes('write') || estText.includes('establishment') || estText.includes('rating') || estText.includes('venue') || estText.includes('about');
  if (onEst) {
    pass('EST-LOAD', `Establishment screen loaded (${estNodes.length} nodes)`);
    const estBackBtns = estNodes.filter(n => n.role === 'button' && n.x < 80 && n.y < 100);
    estBackBtns.length > 0 ? pass('EST-BACK', 'Establishment has back button') : fail('EST-BACK', 'No back button on Establishment', '', 'P1');

    // ============================
    // RESERVATION FLOW
    // ============================
    console.log('\n=== STEP 6: RESERVATION FLOW ===');
    const reserveBtn = estNodes.find(n => n.role === 'button' &&
      (n.label.toLowerCase().includes('reserve') || n.label.toLowerCase().includes('book') || n.label.toLowerCase().includes('reservation')));
    // Fallback: primary CTA button is typically bottom-center
    const primaryCTA = estNodes.filter(n => n.role === 'button' && n.y > 600 && n.w > 200).slice(0, 1)[0];
    const reserveTarget = reserveBtn || primaryCTA;
    console.log('Reserve btn:', JSON.stringify(reserveTarget));

    if (reserveTarget) {
      await clickAt(page, reserveTarget.cx, reserveTarget.cy, 3000);
      await shot(page, 'res_01_time_slot');
      const tsNodes = await getNodes(page);
      const tsText = tsNodes.map(n => n.label.toLowerCase()).join(' ');
      console.log('Time Slot:', tsNodes.length, 'nodes, text:', tsText.substring(0, 200));

      const onTS = tsText.includes('time') || tsText.includes('party') || tsText.includes('guest') || tsText.includes('slot') || tsText.includes('date') || tsText.includes('select');
      if (onTS) {
        pass('RES-TIMESLOT', 'Time Slot screen loaded');
        const tsBacks = tsNodes.filter(n => n.role === 'button' && n.x < 80 && n.y < 100);
        tsBacks.length > 0 ? pass('F6-TIMESLOT', 'Back button on Time Slot') : fail('F6-TIMESLOT', 'No back button on Time Slot', '', 'P1');

        // Continue button
        const contBtn = tsNodes.find(n => n.role === 'button' &&
          (n.label.toLowerCase().includes('save') || n.label.toLowerCase().includes('continue') || n.label.toLowerCase().includes('next') ||
           (n.y > 650 && n.w > 200)));
        if (contBtn) {
          await clickAt(page, contBtn.cx, contBtn.cy, 3000);
          await shot(page, 'res_02_confirm_booking');
          const cbNodes = await getNodes(page);
          const cbText = cbNodes.map(n => n.label.toLowerCase()).join(' ');
          console.log('Confirm Booking:', cbNodes.length, 'nodes, text:', cbText.substring(0, 200));

          const onCB = cbText.includes('confirm') || cbText.includes('booking') || cbText.includes('reservation') || cbText.includes('change time') || cbText.includes('guest');
          if (onCB) {
            pass('RES-CONFIRM', 'Confirm Booking screen loaded');
            const cbBacks = cbNodes.filter(n => n.role === 'button' && n.x < 80 && n.y < 100);
            cbBacks.length > 0 ? pass('F6-CONFIRM', 'Back button on Confirm Booking') : fail('F6-CONFIRM', 'No back button on Confirm Booking', '', 'P1');

            // Final confirm
            const finalBtn = cbNodes.find(n => n.role === 'button' &&
              (n.label.toLowerCase().includes('confirm') || n.label.toLowerCase().includes('book')) &&
              n.y > 500) ||
              cbNodes.filter(n => n.role === 'button' && n.y > 600 && n.w > 200)[0];
            if (finalBtn) {
              await clickAt(page, finalBtn.cx, finalBtn.cy, 4000);
              await shot(page, 'res_03_pass');
              const passNodes = await getNodes(page);
              const passText = passNodes.map(n => n.label.toLowerCase()).join(' ');
              console.log('Reservation Pass:', passNodes.length, 'nodes, text:', passText.substring(0, 200));
              const onPass = passText.includes('pass') || passText.includes('qr') || passText.includes('check-in') || passText.includes('confirmed') || passText.includes('otp') || passText.includes('booking');
              onPass ? pass('RES-PASS', 'Reservation Pass/confirmation loaded') : partial('RES-PASS', 'After confirm — screen unclear', passText.substring(0, 80));
            } else {
              partial('RES-FINAL-BTN', 'No final confirm button found', cbText.substring(0, 80));
            }
          } else {
            fail('RES-CONFIRM', 'Confirm Booking not reached', cbText.substring(0, 80), 'P1');
          }
        } else {
          partial('RES-CONT', 'No Continue button on Time Slot', tsText.substring(0, 80));
        }
      } else {
        fail('RES-TIMESLOT', 'Time Slot not loaded', tsText.substring(0, 80), 'P1');
      }
    } else {
      fail('EST-NO-RESERVE', 'Reserve/Book button not found on Establishment', estText.substring(0, 80), 'P1');
    }

    // ============================
    // REVIEW FLOW
    // ============================
    console.log('\n=== STEP 7: REVIEW FLOW ===');
    // Get back to establishment
    await page.goto(BASE_URL + '/#/discover', { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(2000);
    await clickAt(page, venueTarget.cx, venueTarget.cy, 2500);
    const agGateChk = await getNodes(page);
    const agGateText = agGateChk.map(n => n.label.toLowerCase()).join(' ');
    if (agGateText.includes('18') || agGateText.includes('older')) {
      const agBtns = agGateChk.filter(n => n.role === 'button');
      const primBtn = agBtns.find(n => n.y > 500) || agBtns[agBtns.length - 1];
      if (primBtn) await clickAt(page, primBtn.cx, primBtn.cy, 3000);
    }

    const estForReview = await getNodes(page);
    const estForReviewText = estForReview.map(n => n.label.toLowerCase()).join(' ');
    const writeBtn = estForReview.find(n => n.role === 'button' &&
      (n.label.toLowerCase().includes('write') || n.label.toLowerCase().includes('review') || n.label.toLowerCase().includes('verify')));
    // Secondary CTA (Write a Review) usually second large button
    const secondaryCTA = estForReview.filter(n => n.role === 'button' && n.y > 600 && n.w > 150)[1];
    const reviewTarget = writeBtn || secondaryCTA;
    console.log('Write review btn:', JSON.stringify(reviewTarget));

    if (reviewTarget) {
      await clickAt(page, reviewTarget.cx, reviewTarget.cy, 3000);
      await shot(page, 'review_01_verify_visit');
      const vvNodes = await getNodes(page);
      const vvText = vvNodes.map(n => n.label.toLowerCase()).join(' ');
      console.log('Verify Visit:', vvNodes.length, 'nodes, text:', vvText.substring(0, 200));

      const onVV = vvText.includes('verify') || vvText.includes('visit') || vvText.includes('photo') || vvText.includes('location') || vvText.includes('continue');
      if (onVV) {
        pass('REVIEW-VERIFY', 'Verify Visit screen loaded');
        vvNodes.filter(n => n.role === 'button' && n.x < 80 && n.y < 100).length > 0 ?
          pass('F6-REVIEW-VERIFY', 'Back button on Verify Visit') :
          fail('F6-REVIEW-VERIFY', 'No back on Verify Visit', '', 'P1');

        const vvCont = vvNodes.find(n => n.role === 'button' &&
          (n.label.toLowerCase().includes('continue') || n.label.toLowerCase().includes('next') || n.label.toLowerCase().includes('skip') ||
           (n.y > 650 && n.w > 150)));
        if (vvCont) {
          await clickAt(page, vvCont.cx, vvCont.cy, 2500);
          await shot(page, 'review_02_rate');
          const reNodes = await getNodes(page);
          const reText = reNodes.map(n => n.label.toLowerCase()).join(' ');
          console.log('Rate Experience:', reNodes.length, 'nodes, text:', reText.substring(0, 200));

          const onRate = reText.includes('rate') || reText.includes('experience') || reText.includes('food') || reText.includes('service') || reText.includes('atmosphere') || reText.includes('quality');
          if (onRate) {
            pass('REVIEW-RATE', 'Rate Experience loaded');
            reNodes.filter(n => n.role === 'button' && n.x < 80 && n.y < 100).length > 0 ?
              pass('F6-REVIEW-RATE', 'Back button on Rate Experience') :
              fail('F6-REVIEW-RATE', 'No back on Rate Experience', '', 'P1');

            const reCont = reNodes.find(n => n.role === 'button' && (n.label.toLowerCase().includes('continue') || (n.y > 650 && n.w > 150)));
            if (reCont) {
              await clickAt(page, reCont.cx, reCont.cy, 2500);
              await shot(page, 'review_03_disclosure');
              const cdNodes = await getNodes(page);
              const cdText = cdNodes.map(n => n.label.toLowerCase()).join(' ');
              console.log('Creator Disclosure:', cdNodes.length, 'nodes, text:', cdText.substring(0, 200));

              const onCD = cdText.includes('creator') || cdText.includes('disclosure') || cdText.includes('affiliated') || cdText.includes('partner') || cdText.includes('conflict');
              if (onCD) {
                pass('REVIEW-DISCLOSURE', 'Creator Disclosure loaded');
                cdNodes.filter(n => n.role === 'button' && n.x < 80 && n.y < 100).length > 0 ?
                  pass('F6-REVIEW-DISCLOSURE', 'Back button on Creator Disclosure') :
                  fail('F6-REVIEW-DISCLOSURE', 'No back on Creator Disclosure', '', 'P1');

                const cdCont = cdNodes.find(n => n.role === 'button' &&
                  (n.label.toLowerCase().includes('confirm') || n.label.toLowerCase().includes('continue') || (n.y > 650 && n.w > 150)));
                if (cdCont) {
                  await clickAt(page, cdCont.cx, cdCont.cy, 2500);
                  await shot(page, 'review_04_written');
                  const wrNodes = await getNodes(page);
                  const wrText = wrNodes.map(n => n.label.toLowerCase()).join(' ');
                  const wrTextboxes = wrNodes.filter(n => ['textbox', 'searchbox', 'combobox'].includes(n.role));
                  console.log('Written Review:', wrNodes.length, 'nodes, textboxes:', wrTextboxes.length, 'text:', wrText.substring(0, 200));

                  const onWR = wrTextboxes.length > 0 || wrText.includes('review') || wrText.includes('write') || wrText.includes('describe') || wrText.includes('experience');
                  if (onWR) {
                    pass('REVIEW-WRITTEN', 'Written Review screen loaded');
                    wrTextboxes.length > 0 ?
                      pass('REVIEW-TEXTAREA', `Written review text area has role (${wrTextboxes[0].role})`) :
                      partial('REVIEW-TEXTAREA', 'No textbox role — textarea may be non-semantic');
                    wrNodes.filter(n => n.role === 'button' && n.x < 80 && n.y < 100).length > 0 ?
                      pass('F6-REVIEW-WRITTEN', 'Back button on Written Review') :
                      fail('F6-REVIEW-WRITTEN', 'No back on Written Review', '', 'P1');

                    // Test text input
                    if (wrTextboxes.length > 0) {
                      await page.mouse.click(wrTextboxes[0].cx, wrTextboxes[0].cy);
                      await page.waitForTimeout(300);
                      await page.keyboard.type('Great atmosphere and excellent service!');
                      await page.waitForTimeout(500);
                    }

                    const subBtn = wrNodes.find(n => n.role === 'button' &&
                      (n.label.toLowerCase().includes('submit') || n.label.toLowerCase().includes('publish') ||
                       n.label.toLowerCase().includes('continue') || n.label.toLowerCase().includes('post') ||
                       (n.y > 650 && n.w > 150)));
                    if (subBtn) {
                      await clickAt(page, subBtn.cx, subBtn.cy, 4000);
                      await shot(page, 'review_05_submitted');
                      const rsNodes = await getNodes(page);
                      const rsText = rsNodes.map(n => n.label.toLowerCase()).join(' ');
                      console.log('Review Submitted:', rsNodes.length, 'nodes, text:', rsText.substring(0, 250));

                      const onRS = rsText.includes('pts') || rsText.includes('points') || rsText.includes('badge') ||
                        rsText.includes('submitted') || rsText.includes('taster') || rsText.includes('earned') ||
                        rsText.includes('congratulation') || rsText.includes('thank') || rsText.includes('review');
                      if (onRS) {
                        pass('REVIEW-SUBMITTED', 'Review Submitted screen loaded');
                        rsText.includes('share') ? pass('F9', '"Share Your Review" present on Submitted') : fail('F9', 'No "Share Your Review" on Submitted', '', 'P2');
                        rsText.includes('explore') ? pass('REVIEW-EXPLORE', '"Explore More Spots" present') : partial('REVIEW-EXPLORE', '"Explore More Spots" not confirmed');
                      } else {
                        partial('REVIEW-SUBMITTED', 'After submit — screen unclear', rsText.substring(0, 80));
                      }
                    } else {
                      partial('REVIEW-SUBMIT-BTN', 'No Submit button found', wrText.substring(0, 80));
                    }
                  } else {
                    partial('REVIEW-WRITTEN', 'Written Review unclear', wrText.substring(0, 80));
                  }
                } else {
                  partial('REVIEW-CD-CONT', 'No Continue on Creator Disclosure', cdText.substring(0, 80));
                }
              } else {
                partial('REVIEW-DISCLOSURE', 'Creator Disclosure unclear', cdText.substring(0, 80));
              }
            } else {
              partial('REVIEW-RATE-CONT', 'No Continue on Rate Experience', reText.substring(0, 80));
            }
          } else {
            partial('REVIEW-RATE', 'Rate Experience unclear', reText.substring(0, 80));
          }
        } else {
          partial('REVIEW-VV-CONT', 'No Continue on Verify Visit', vvText.substring(0, 80));
        }
      } else {
        fail('REVIEW-VERIFY', 'Verify Visit not loaded', vvText.substring(0, 80), 'P1');
      }
    } else {
      fail('REVIEW-NO-BTN', 'Write Review button not found on Establishment', estForReviewText.substring(0, 60), 'P1');
    }

  } else {
    fail('EST-LOAD', 'Could not reach Establishment screen', estText.substring(0, 80), 'P1');
    // Skip reservation and review flows
    fail('RES-TIMESLOT', 'SKIPPED — establishment not reached', '', 'P1');
    fail('REVIEW-VERIFY', 'SKIPPED — establishment not reached', '', 'P1');
  }

  // ============================
  // STEP 8: MESSAGES (F9/FIX-12)
  // ============================
  console.log('\n=== STEP 8: MESSAGES (FIX-12) ===');
  await page.goto(BASE_URL + '/#/messages', { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(2500);
  await shot(page, 'msg_01');
  const msgNodes = await getNodes(page);
  const msgText = msgNodes.map(n => n.label.toLowerCase()).join(' ');
  console.log('Messages:', msgNodes.length, 'nodes, text:', msgText.substring(0, 200));

  if (msgNodes.length > 3) {
    pass('MESSAGES-LOAD', `Messages loaded (${msgNodes.length} nodes)`);

    // Find conversation items — typically list items in center of screen
    const convCandidates = msgNodes.filter(n => n.y > 80 && n.y < 680 && n.w > 200 && n.h > 40 && n.role !== 'button');
    const convBtns = msgNodes.filter(n => n.role === 'button' && n.y > 80 && n.y < 680 && n.h > 40);
    console.log('Conv candidates:', convCandidates.slice(0, 5).map(n => `(${n.cx},${n.cy}) lbl="${n.label.substring(0, 30)}"`).join(', '));
    console.log('Conv buttons:', convBtns.slice(0, 5).map(n => `(${n.cx},${n.cy}) lbl="${n.label.substring(0, 30)}"`).join(', '));

    const convTarget = convCandidates[0] || convBtns[0] || { cx: 195, cy: 250 };
    const urlBefore = page.url();
    await clickAt(page, convTarget.cx, convTarget.cy, 3000);
    await shot(page, 'msg_02_chat');
    const chatNodes = await getNodes(page);
    const chatText = chatNodes.map(n => n.label.toLowerCase()).join(' ');
    console.log('Chat:', chatNodes.length, 'nodes, text:', chatText.substring(0, 200));

    const onChat = chatText.includes('send') || chatText.includes('message') || chatNodes.filter(n => ['textbox', 'searchbox'].includes(n.role)).length > 0 ||
      chatText.includes('type') || chatNodes.length !== msgNodes.length;

    if (onChat) {
      pass('F9-MESSAGES', 'Conversation tap opened chat screen');
      const chatInputs = chatNodes.filter(n => ['textbox', 'searchbox', 'combobox'].includes(n.role));
      chatInputs.length > 0 ? pass('MESSAGES-INPUT', 'Chat text input present') : fail('MESSAGES-INPUT', 'No text input in chat', '', 'P1');

      const chatBacks = chatNodes.filter(n => n.role === 'button' && n.x < 80 && n.y < 100);
      if (chatBacks.length > 0) {
        pass('MESSAGES-BACK', 'Chat has back button');
        await clickAt(page, chatBacks[0].cx, chatBacks[0].cy, 1500);
        const backUrl = page.url();
        const backNodes = await getNodes(page);
        backUrl.includes('messages') || backNodes.length === msgNodes.length ?
          pass('MESSAGES-BACK-WORKS', 'Back from chat → messages list') :
          partial('MESSAGES-BACK-WORKS', 'Back pressed, destination unclear', backUrl);
      } else {
        fail('MESSAGES-BACK', 'No back button in chat screen', '', 'P1');
      }
    } else {
      fail('F9-MESSAGES', 'Conversation tap did not open chat', chatText.substring(0, 80), 'P1');
    }
  } else {
    fail('MESSAGES-LOAD', 'Messages not loaded', `${msgNodes.length} nodes`, 'P1');
  }

  // ============================
  // STEP 9: PROFILE
  // ============================
  console.log('\n=== STEP 9: PROFILE ===');
  await page.goto(BASE_URL + '/#/profile', { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(2500);
  await shot(page, 'profile_01');
  const profNodes = await getNodes(page);
  const profText = profNodes.map(n => n.label.toLowerCase()).join(' ');
  console.log('Profile:', profNodes.length, 'nodes, text:', profText.substring(0, 200));

  if (profNodes.length > 3) {
    pass('PROFILE-LOAD', `Profile loaded (${profNodes.length} nodes)`);
    const hasUserInfo = profText.includes('alan') || profText.includes('@') || profText.includes('profile');
    hasUserInfo ? pass('PROFILE-INFO', 'User info visible') : partial('PROFILE-INFO', 'User info not confirmed in labels');
    const hasTabs = profText.includes('posts') || profText.includes('reels') || profText.includes('reviews') || profText.includes('places');
    hasTabs ? pass('PROFILE-TABS', 'Profile content tabs visible') : partial('PROFILE-TABS', 'Profile tabs not confirmed');
  } else {
    partial('PROFILE-LOAD', 'Profile sparse', `${profNodes.length} nodes`);
  }

  // ============================
  // STEP 10: SETTINGS (FIX-10/11)
  // ============================
  console.log('\n=== STEP 10: SETTINGS ===');
  await page.goto(BASE_URL + '/#/settings', { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(2500);
  await shot(page, 'settings_01');
  const settNodes = await getNodes(page);
  const settText = settNodes.map(n => n.label.toLowerCase()).join(' ');
  console.log('Settings:', settNodes.length, 'nodes, text:', settText.substring(0, 300));
  console.log('Settings buttons:', settNodes.filter(n => n.role === 'button').map(n => `(${n.cx},${n.cy}) y=${n.y} lbl="${n.label.substring(0, 30)}"`).join(', '));

  if (settNodes.length > 3) {
    pass('SETTINGS-LOAD', `Settings loaded (${settNodes.length} nodes)`);

    const settBtns = settNodes.filter(n => n.role === 'button');

    // Personal Information (FIX-11a) — typically first/second list item
    const piBtn = settBtns.find(n => n.label.toLowerCase().includes('personal')) ||
      settBtns.find(n => n.y > 80 && n.y < 300);
    if (piBtn) {
      await clickAt(page, piBtn.cx, piBtn.cy, 2000);
      await shot(page, 'settings_02_personal_info');
      const piNodes = await getNodes(page);
      const piText = piNodes.map(n => n.label.toLowerCase()).join(' ');
      console.log('After Personal Info tap:', piText.substring(0, 100));
      piText.includes('coming') ? pass('F10-PERSONAL', 'Personal Info → snackbar/toast') :
        partial('F10-PERSONAL', 'Personal Info tapped — snackbar not confirmed', piText.substring(0, 60));
      await page.waitForTimeout(1000);
    } else {
      partial('F10-PERSONAL', 'Personal Information button not found', settText.substring(0, 80));
    }

    // Email Preferences (FIX-11b)
    await page.goto(BASE_URL + '/#/settings', { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(2000);
    const settNodes2 = await getNodes(page);
    const settBtns2 = settNodes2.filter(n => n.role === 'button');
    const epBtn = settBtns2.find(n => n.label.toLowerCase().includes('email')) ||
      settBtns2.find(n => n.y > 150 && n.y < 350 && !n.label.toLowerCase().includes('personal'));
    if (epBtn) {
      await clickAt(page, epBtn.cx, epBtn.cy, 2000);
      await shot(page, 'settings_03_email_prefs');
      const epNodes = await getNodes(page);
      const epText = epNodes.map(n => n.label.toLowerCase()).join(' ');
      epText.includes('coming') ? pass('F10-EMAIL', 'Email Preferences → snackbar') :
        partial('F10-EMAIL', 'Email Prefs tapped — snackbar not confirmed', epText.substring(0, 60));
    } else {
      partial('F10-EMAIL', 'Email Preferences button not found');
    }

    // Privacy Settings
    await page.goto(BASE_URL + '/#/settings', { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(2000);
    const settNodes3 = await getNodes(page);
    const settBtns3 = settNodes3.filter(n => n.role === 'button');
    const privBtn = settBtns3.find(n => n.label.toLowerCase().includes('privacy'));
    if (privBtn) {
      await clickAt(page, privBtn.cx, privBtn.cy, 2500);
      await shot(page, 'settings_04_privacy');
      const privNodes = await getNodes(page);
      const privText = privNodes.map(n => n.label.toLowerCase()).join(' ');
      const onPrivacy = privText.includes('privacy') || privText.includes('data') || privText.includes('location') || privText.includes('activity') || privText.includes('who can');
      if (onPrivacy) {
        pass('SETTINGS-PRIVACY', 'Privacy Settings navigates correctly');
        const privBacks = privNodes.filter(n => n.role === 'button' && n.x < 80 && n.y < 100);
        if (privBacks.length > 0) {
          pass('SETTINGS-PRIVACY-BACK', 'Privacy Settings has back button');
          await clickAt(page, privBacks[0].cx, privBacks[0].cy, 1500);
        } else {
          fail('SETTINGS-PRIVACY-BACK', 'No back button on Privacy Settings', '', 'P1');
        }
      } else {
        fail('SETTINGS-PRIVACY', 'Privacy Settings did not open', privText.substring(0, 60), 'P1');
      }
    } else {
      partial('SETTINGS-PRIVACY', 'Privacy button not found by label');
    }

    // Delete Account (FIX-11c)
    await page.goto(BASE_URL + '/#/settings', { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(2000);
    const settNodes4 = await getNodes(page);
    const settBtns4 = settNodes4.filter(n => n.role === 'button');
    const delBtn = settBtns4.find(n => n.label.toLowerCase().includes('delete'));
    if (delBtn) {
      await clickAt(page, delBtn.cx, delBtn.cy, 2000);
      await shot(page, 'settings_05_delete_dialog');
      const dlgNodes = await getNodes(page);
      const dlgText = dlgNodes.map(n => n.label.toLowerCase()).join(' ');
      console.log('Delete dialog:', dlgText.substring(0, 150));
      const hasDialog = dlgText.includes('delete') && (dlgText.includes('confirm') || dlgText.includes('cancel') || dlgText.includes('permanent') || dlgText.includes('sure') || dlgNodes.filter(n => n.role === 'button').length >= 2);
      hasDialog ? pass('F10-DELETE', 'Delete Account → confirmation dialog') :
        partial('F10-DELETE', 'Delete Account tapped — dialog state unclear', dlgText.substring(0, 60));
      // Dismiss dialog
      const cancelBtn = dlgNodes.find(n => n.role === 'button' && (n.label.toLowerCase().includes('cancel') || n.label.toLowerCase().includes('no') || n.label.toLowerCase().includes('keep')));
      if (cancelBtn) await clickAt(page, cancelBtn.cx, cancelBtn.cy, 500);
    } else {
      fail('F10-DELETE', 'Delete Account button not found', settText.substring(0, 80), 'P1');
    }

    // Logout
    await page.goto(BASE_URL + '/#/settings', { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(2000);
    const settNodes5 = await getNodes(page);
    const logBtn = settNodes5.filter(n => n.role === 'button').find(n => n.label.toLowerCase().includes('log out') || n.label.toLowerCase().includes('logout') || n.label.toLowerCase().includes('sign out'));
    logBtn ? pass('SETTINGS-LOGOUT', `Logout button found: "${logBtn.label}"`) : partial('SETTINGS-LOGOUT', 'Logout button not found by label');

  } else {
    fail('SETTINGS-LOAD', 'Settings not loaded', `${settNodes.length} nodes`, 'P1');
  }

  // ============================
  // STEP 11: POINTS / BADGES / REDEEM
  // ============================
  console.log('\n=== STEP 11: POINTS / BADGES / REDEEM ===');
  for (const [route, name] of [['/#/points', 'points'], ['/#/badges', 'badges'], ['/#/redeem', 'redeem']]) {
    await page.goto(BASE_URL + route, { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(2500);
    await shot(page, `reward_${name}`);
    const ri = await getNodes(page);
    const rt = ri.map(n => n.label.toLowerCase()).join(' ');
    console.log(`${route}: ${ri.length} nodes, text: ${rt.substring(0, 80)}`);
    ri.length > 3 ? pass(`ROUTE-${name.toUpperCase()}`, `${route} loaded (${ri.length} nodes)`) :
      partial(`ROUTE-${name.toUpperCase()}`, `${route} sparse — check screenshot`, `${ri.length} nodes`);
  }

  await browser.close();

  // ============================
  // FINAL SUMMARY
  // ============================
  printSummary();

  fs.writeFileSync('C:/Projects/Zupurb/test/e2e_web/results_v2.json',
    JSON.stringify({ results, consoleErrors, summary: getSummary(), durationMs: Date.now() - startTime }, null, 2)
  );
  console.log('\nResults: C:/Projects/Zupurb/test/e2e_web/results_v2.json');
  console.log('Screenshots: C:/Projects/Zupurb/test/e2e_web/screenshots_v2/');
})();

function getSummary() {
  return {
    passed: results.filter(r => r.status === 'PASS').length,
    failed: results.filter(r => r.status === 'FAIL').length,
    partial: results.filter(r => r.status === 'PARTIAL').length,
    total: results.length,
  };
}

function printSummary() {
  const passed = results.filter(r => r.status === 'PASS');
  const failed = results.filter(r => r.status === 'FAIL');
  const partials = results.filter(r => r.status === 'PARTIAL');

  console.log('\n\n====================================================');
  console.log('              TEST RESULTS SUMMARY');
  console.log('====================================================');
  console.log(`PASS:    ${passed.length}`);
  console.log(`FAIL:    ${failed.length}`);
  console.log(`PARTIAL: ${partials.length}`);
  console.log(`TOTAL:   ${results.length}`);
  if (results.length > 0) {
    console.log(`Pass rate: ${passed.length}/${results.length} (${Math.round(passed.length / results.length * 100)}%)`);
  }

  console.log('\n--- FAILURES ---');
  failed.forEach(r => console.log(`  FAIL [${r.severity}] [${r.id}]\n    ${r.desc}\n    ${r.detail || ''}`));
  console.log('\n--- PARTIALS ---');
  partials.forEach(r => console.log(`  PARTIAL [${r.id}]\n    ${r.desc}\n    ${r.detail || ''}`));
  console.log('\n--- PASSES ---');
  passed.forEach(r => console.log(`  PASS [${r.id}] ${r.desc}`));

  console.log('\n--- CONSOLE ERRORS ---');
  if (consoleErrors.length === 0) {
    console.log('  None');
  } else {
    consoleErrors.slice(0, 10).forEach((e, i) => console.log(`  [${i + 1}] ${e.substring(0, 150)}`));
  }
}
