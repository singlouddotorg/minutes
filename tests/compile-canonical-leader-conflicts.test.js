// If two rows share the same raw leader name but disagree on the canonical name, both
// rows' original values must survive export exactly as typed - not be silently collapsed
// to whichever row happened to be processed last. This was a genuine data-loss bug: the
// losing row's evidence wasn't just overwritten in a lookup, it was completely
// unrecoverable, since no per-row storage of the value existed before the fix.
'use strict';

const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const Papa = require('papaparse');
const { loadStage, importIntoCompile, stubDownload, wait, closeAllWindows } = require('./helpers');

const HEADER = 'Schema Version,Order of entry,Record Type,Session Label,Session ID,Metadata Field,Metadata Value,Event,Date,Location,Chair,Vice-Chair,Secretary,Treasurer,Arranger(s),Chaplain,Memorial Lesson Leader,Book,Edition Code,Leader(s),Canonical Leader(s),Page,Song,Tag,Notes,Marker,Timestamp ISO,Time entered'.split(',');

function row(fields) {
  const r = new Array(HEADER.length).fill('');
  for (const [k, v] of Object.entries(fields)) {
    const idx = HEADER.indexOf(k);
    if (idx === -1) throw new Error(`Unknown column: ${k}`);
    r[idx] = v;
  }
  return r.join(',');
}

async function importAndExport(rows) {
  const csvText = [HEADER.join(','), ...rows].join('\n');
  const dom = await loadStage('compile');
  const doc = dom.window.document;
  const capture = stubDownload(dom.window);
  importIntoCompile(dom.window, csvText, 'x.csv', 'text/csv');
  await wait(800);

  const importStatus = doc.getElementById('importStatus').textContent;
  // "Export" is reached through the wrapper's own dedicated nav item now, not a tab
  // strip inside Compile itself - that tab strip no longer exists; the rail drives
  // Compile's panels directly since the merge.
  doc.getElementById('stageBtn-export').click();
  await wait(300);
  doc.getElementById('exp_csv').click();

  const parsed = Papa.parse(capture.value, { header: true });
  return { importStatus, songRows: parsed.data.filter((r) => r['Record Type'] === 'song') };
}

after(closeAllWindows);

describe('Compile: canonical leader conflicts preserved per row', () => {
  test('two rows sharing a raw name but disagreeing on canonical name both keep their own value', async () => {
    const { importStatus, songRows } = await importAndExport([
      row({ 'Schema Version': '4', 'Order of entry': '1', 'Record Type': 'session', 'Session ID': 'sess1', Event: 'Test', Date: '2026-01-03' }),
      row({ 'Schema Version': '4', 'Order of entry': '2', 'Record Type': 'song', 'Session ID': 'sess1', Book: 'SHM1991', 'Leader(s)': 'J. Smith', 'Canonical Leader(s)': 'Jane Smith', Page: '1' }),
      row({ 'Schema Version': '4', 'Order of entry': '3', 'Record Type': 'song', 'Session ID': 'sess1', Book: 'SHM1991', 'Leader(s)': 'J. Smith', 'Canonical Leader(s)': 'John Smith', Page: '2' }),
    ]);

    assert.match(importStatus, /disagree on the Canonical Leader/);
    assert.equal(songRows.length, 2);
    assert.equal(songRows[0]['Canonical Leader(s)'], 'Jane Smith');
    assert.equal(songRows[1]['Canonical Leader(s)'], 'John Smith');
  });

  test('rows that agree on the same canonical name are not falsely flagged as conflicting', async () => {
    const { importStatus, songRows } = await importAndExport([
      row({ 'Schema Version': '4', 'Order of entry': '1', 'Record Type': 'session', 'Session ID': 'sess1', Event: 'Test', Date: '2026-01-03' }),
      row({ 'Schema Version': '4', 'Order of entry': '2', 'Record Type': 'song', 'Session ID': 'sess1', Book: 'SHM1991', 'Leader(s)': 'J. Smith', 'Canonical Leader(s)': 'Jane Smith', Page: '1' }),
      row({ 'Schema Version': '4', 'Order of entry': '3', 'Record Type': 'song', 'Session ID': 'sess1', Book: 'SHM1991', 'Leader(s)': 'J. Smith', 'Canonical Leader(s)': 'Jane Smith', Page: '2' }),
    ]);

    assert.doesNotMatch(importStatus, /disagree on the Canonical Leader/);
    assert.equal(songRows[0]['Canonical Leader(s)'], 'Jane Smith');
    assert.equal(songRows[1]['Canonical Leader(s)'], 'Jane Smith');
  });
});
