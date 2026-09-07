// v152 review Finding 1: deleting an EMPTY current Session must not orphan the next row.
// Replays the review's own exact reproduction.
const L = require('./lib');

(async () => {
  const { browser, page } = await L.launch();
  await L.open(page);

  await L.setupSinging(page, { event: 'Delete Test', date: '2026-08-01', location: 'Place A', chair: 'Alice' });
  await L.toCapture(page);

  // Session 1 content
  await L.logMarker(page, 'ANNOUNCEMENTS');

  // Create Session 2 (Aug 2 / Place B / Chair Bob) with NO content
  await page.click('#startSessionBtn');
  await page.waitForTimeout(300);
  await page.fill('#newSessionDate', '2026-08-02');
  await page.fill('#newSessionLocation', 'Place B');
  await page.evaluate(() => { document.getElementById('newSessionOfficersDetails').open = true; });
  await page.fill('#newSessionChair', 'Bob');
  await page.click('#newDayConfirmBtn');
  await page.waitForTimeout(400);

  const beforeSummary = await page.evaluate(() => document.getElementById('setupSummary').textContent);
  L.check('S2 created and current (summary mentions Place B)', /Place B/.test(beforeSummary), beforeSummary.slice(0, 200));

  // Delete the Session 2 boundary via its own x button. Session rows render
  // reverse-chronologically, so the newest session boundary is the first one in the DOM.
  await page.evaluate(() => {
    const rows = document.querySelectorAll('.session-entry');
    rows[0].querySelector('button.remove').click();
  });
  await page.waitForTimeout(400);

  const afterSummary = await page.evaluate(() => document.getElementById('setupSummary').textContent);
  L.check('after deleting empty S2, Capture summary no longer shows Place B/Bob',
    !/Place B/.test(afterSummary) && !/Bob/.test(afterSummary), afterSummary.slice(0, 200));

  // Log a Prayer marker — the review's own next step
  await L.logMarker(page, 'PRAYER');

  const rows = L.asObjects(await L.csv(page));
  const real = rows.filter(r => r['Record Type'] === 'session' || r['Record Type'] === 'marker');
  const sessionRow = real.find(r => r['Record Type'] === 'session');
  const prayer = real.find(r => r['Marker'] === 'PRAYER');
  const announce = real.find(r => r['Marker'] === 'ANNOUNCEMENTS');

  L.check('only one session boundary survives', real.filter(r => r['Record Type'] === 'session').length === 1);
  L.check('Prayer row has a non-blank Session ID', !!(prayer && prayer['Session ID'] && prayer['Session ID'].trim()),
    prayer ? JSON.stringify({ sid: prayer['Session ID'] }) : 'no prayer row');
  L.check('Prayer Session ID === Session 1 ID',
    !!(prayer && sessionRow && prayer['Session ID'] === sessionRow['Session ID']),
    prayer && sessionRow ? prayer['Session ID'] + ' vs ' + sessionRow['Session ID'] : '');
  L.check('Prayer Date is S1 (2026-08-01), not the deleted S2', prayer && prayer['Date'] === '2026-08-01', prayer && prayer['Date']);
  L.check('Prayer Location is Place A, not Place B', prayer && prayer['Location'] === 'Place A', prayer && prayer['Location']);
  L.check('Prayer Chair is Alice, not Bob', prayer && prayer['Chair'] === 'Alice', prayer && prayer['Chair']);
  L.check('Announcements row unaffected', announce && announce['Location'] === 'Place A' && announce['Chair'] === 'Alice');

  // ---- Undo case: delete an empty S2, undo, then log a row; it must use S2's context ----
  await page.evaluate(() => localStorage.clear());
  await L.open(page);
  await L.setupSinging(page, { event: 'Undo Test', date: '2026-08-01', location: 'Place A', chair: 'Alice' });
  await L.toCapture(page);
  await L.logMarker(page, 'ANNOUNCEMENTS');
  await page.click('#startSessionBtn');
  await page.waitForTimeout(300);
  await page.fill('#newSessionDate', '2026-08-02');
  await page.fill('#newSessionLocation', 'Place B');
  await page.evaluate(() => { document.getElementById('newSessionOfficersDetails').open = true; });
  await page.fill('#newSessionChair', 'Bob');
  await page.click('#newDayConfirmBtn');
  await page.waitForTimeout(400);
  await page.evaluate(() => { document.querySelectorAll('.session-entry')[0].querySelector('button.remove').click(); });
  await page.waitForTimeout(300);
  // click the undo action in the toast
  const undone = await page.evaluate(() => {
    const btn = document.querySelector('button.toast-undo');
    if (btn) { btn.click(); return true; }
    return false;
  });
  await page.waitForTimeout(400);
  if (!undone){
    L.check('undo toast button found', false, 'could not locate the undo button — selector needs updating');
  } else {
    await L.logMarker(page, 'PRAYER');
    const rows2 = L.asObjects(await L.csv(page));
    const prayer2 = rows2.find(r => r['Marker'] === 'PRAYER');
    const s2row = rows2.filter(r => r['Record Type'] === 'session').pop();
    L.check('after undo, new row uses restored S2 Session ID',
      !!(prayer2 && s2row && prayer2['Session ID'] === s2row['Session ID']),
      prayer2 ? prayer2['Session ID'] + ' vs ' + (s2row && s2row['Session ID']) : '');
    L.check('after undo, new row uses S2 Date/Location/Chair',
      !!(prayer2 && prayer2['Date'] === '2026-08-02' && prayer2['Location'] === 'Place B' && prayer2['Chair'] === 'Bob'),
      prayer2 ? JSON.stringify({ d: prayer2['Date'], l: prayer2['Location'], c: prayer2['Chair'] }) : '');
  }

  // ---- Empty ONLY session: delete it, log a row, expect a clean new boundary ----
  await page.evaluate(() => localStorage.clear());
  await L.open(page);
  await L.setupSinging(page, { event: 'Only Session Test', date: '2026-08-05', location: 'Place C', chair: 'Carol' });
  await L.toCapture(page);
  await L.logMarker(page, 'ANNOUNCEMENTS');
  // remove the announcement so the session is genuinely empty
  await page.evaluate(() => {
    const btns = document.querySelectorAll('.marker-entry button.remove');
    if (btns.length) btns[0].click();
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const s = document.querySelectorAll('.session-entry');
    if (s.length) s[0].querySelector('button.remove').click();
  });
  await page.waitForTimeout(400);
  await L.logMarker(page, 'PRAYER');
  const rows3 = L.asObjects(await L.csv(page));
  const prayer3 = rows3.find(r => r['Marker'] === 'PRAYER');
  const sess3 = rows3.filter(r => r['Record Type'] === 'session');
  L.check('deleting the only empty session then logging creates a valid new boundary',
    sess3.length === 1 && !!prayer3 && !!prayer3['Session ID'] && prayer3['Session ID'] === sess3[0]['Session ID'],
    JSON.stringify({ sessions: sess3.length, sid: prayer3 && prayer3['Session ID'] }));

  L.check('no page errors', page._errors.length === 0, page._errors.slice(0, 3).join(' | '));
  await browser.close();
  process.exit(L.summary());
})();
