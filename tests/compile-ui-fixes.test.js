// Kevin's own direct observation: a marker row (Recess, Lunch, Singing School, etc.) on
// the Compile Song List used to render as a single wide colspan block with its own
// flex-wrapped layout inside it, instead of the same per-column cells every song row
// uses - it looked like a different kind of UI element inserted into the table, not a
// row within it. There was also a real, separate, previously-undetected bug alongside
// it: the <tr> used the class "marker-row", which Capture's own marker-button group (an
// unrelated part of the same file) already owns with a real, active display:flex rule -
// two different elements silently sharing one class name. This file exists so both stay
// fixed: the row structure itself, and the class collision that could have quietly
// re-broken it even after the structural fix.
'use strict';

const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const { loadPage, wait, closeAllWindows } = require('./helpers');

after(() => closeAllWindows());

function addRealMarkerRow(doc, win, markerLabel) {
  const songsBtn = doc.querySelector('[data-panel-target="songs"]');
  songsBtn.click();
  doc.getElementById('addSongRow').click();
  const originalPrompt = win.prompt;
  win.prompt = () => markerLabel;
  doc.getElementById('addMarkerRow').click();
  win.prompt = originalPrompt;
  doc.getElementById('addSongRow').click();
}

describe('Compile Song List: a marker row uses the same column grid as a song row, not a separate wide block', () => {
  test('a real Singing School marker row has the same <td> count as surrounding song rows, with no colspan', async () => {
    const dom = loadPage('minutes.html');
    const win = dom.window;
    await wait(700);
    const doc = win.document;

    addRealMarkerRow(doc, win, 'SINGING SCHOOL');
    await wait(200);

    const rows = [...doc.querySelectorAll('#songBody tr')];
    assert.equal(rows.length, 3, 'song, marker, song');
    const tdCounts = rows.map((tr) => tr.querySelectorAll('td').length);
    assert.deepStrictEqual(tdCounts, [9, 9, 9], 'Every row, marker included, must have the identical column count');
    const anyColspan = rows.some((tr) => [...tr.querySelectorAll('td')].some((td) => td.hasAttribute('colspan')));
    assert.ok(!anyColspan, 'No row may use colspan - that is exactly the old, now-removed wide-block layout');
  });

  test('the marker type shows in the Book column, and the instructor/notes/prose fields sit in their normal columns', async () => {
    const dom = loadPage('minutes.html');
    const win = dom.window;
    await wait(700);
    const doc = win.document;

    addRealMarkerRow(doc, win, 'SINGING SCHOOL');
    await wait(200);

    const markerRow = [...doc.querySelectorAll('#songBody tr')].find((tr) => tr.classList.contains('songlist-marker-row'));
    assert.ok(markerRow, 'The marker row must be findable by its own, non-colliding class name');
    const cells = markerRow.querySelectorAll('td');
    assert.equal(cells[3].textContent.trim(), 'SINGING SCHOOL', 'Marker type belongs in the Book column, the one otherwise unused by a marker row');
    assert.ok(cells[5].querySelector('.leader-in'), 'Instructor input must be in the real Leader column');
    assert.equal(cells[5].querySelector('.leader-in').placeholder, 'Instructor (optional)');
    assert.ok(cells[6].querySelector('.notes-in') && cells[6].querySelector('.prose-in'), 'Both notes and the prose override must be in the real Notes column, stacked, not off in a separate block');
  });

  test('editing the instructor and notes fields on a marker row actually persists', async () => {
    const dom = loadPage('minutes.html');
    const win = dom.window;
    await wait(700);
    const doc = win.document;

    addRealMarkerRow(doc, win, 'SINGING SCHOOL');
    await wait(200);

    const markerRow = [...doc.querySelectorAll('#songBody tr')].find((tr) => tr.classList.contains('songlist-marker-row'));
    const cells = markerRow.querySelectorAll('td');
    const instructorInput = cells[5].querySelector('.leader-in');
    instructorInput.value = 'Richard DeLong';
    instructorInput.dispatchEvent(new win.Event('input', { bubbles: true }));
    const notesInput = cells[6].querySelector('.notes-in');
    notesInput.value = 'Morning session was a singing school';
    notesInput.dispatchEvent(new win.Event('input', { bubbles: true }));

    assert.equal(instructorInput.value, 'Richard DeLong');
    assert.equal(notesInput.value, 'Morning session was a singing school');
  });

  test('the Song List row class no longer collides with Capture\u2019s own, unrelated ".marker-row" button-group class', async () => {
    const dom = loadPage('minutes.html');
    const win = dom.window;
    await wait(700);
    const doc = win.document;

    addRealMarkerRow(doc, win, 'RECESS');
    await wait(200);

    const markerRow = [...doc.querySelectorAll('#songBody tr')].find((tr) => tr.textContent.includes('RECESS'));
    assert.ok(!markerRow.classList.contains('marker-row'), 'The table row must not carry the class Capture\u2019s own button group already owns');
    assert.ok(markerRow.classList.contains('songlist-marker-row'), 'It must carry its own, distinct class instead');
    assert.ok(doc.querySelector('div.marker-row'), 'Capture\u2019s own marker-button group must still exist, genuinely untouched by this rename');
  });
});

describe('Clicking Compile in the rail always lands on a real Compile subpage, never left showing Export or SHMHA Guide (Kevin\u2019s own report)', () => {
  function activeCompilePanel(doc) {
    const p = doc.querySelector('#compileHost .panel.active');
    return p ? p.getAttribute('data-panel') : null;
  }

  test('visiting Export, then clicking Compile, lands on Event Details - not left on Export', async () => {
    const dom = loadPage('minutes.html');
    const win = dom.window;
    await wait(700);
    const doc = win.document;

    doc.getElementById('stageBtn-export').click();
    await wait(200);
    assert.equal(activeCompilePanel(doc), 'export');

    doc.getElementById('stageBtn-compile').click();
    await wait(200);
    assert.equal(activeCompilePanel(doc), 'details', 'Compile must mean Compile, not whatever Export left active behind it');
  });

  test('visiting SHMHA Guide, then clicking Compile, also lands on Event Details', async () => {
    const dom = loadPage('minutes.html');
    const win = dom.window;
    await wait(700);
    const doc = win.document;

    doc.getElementById('stageBtn-shmha').click();
    await wait(200);
    assert.equal(activeCompilePanel(doc), 'shmha');

    doc.getElementById('stageBtn-compile').click();
    await wait(200);
    assert.equal(activeCompilePanel(doc), 'details');
  });

  test('a genuine, real Compile subpage (e.g. Song List) is remembered across a visit to another top-level stage', async () => {
    const dom = loadPage('minutes.html');
    const win = dom.window;
    await wait(700);
    const doc = win.document;

    doc.querySelector('[data-panel-target="songs"]').click();
    await wait(200);
    assert.equal(activeCompilePanel(doc), 'songs');

    doc.getElementById('stageBtn-setup').click();
    await wait(200);
    doc.getElementById('stageBtn-compile').click();
    await wait(200);
    assert.equal(activeCompilePanel(doc), 'songs', 'A real Compile subpage - unlike Export/SHMHA - is a legitimate "where was I" to remember, and this fix must not have broken that');
  });

  test('the very first visit to Compile still lands on Event Details', async () => {
    const dom = loadPage('minutes.html');
    const win = dom.window;
    await wait(700);
    const doc = win.document;

    doc.getElementById('stageBtn-compile').click();
    await wait(200);
    assert.equal(activeCompilePanel(doc), 'details');
  });
});
