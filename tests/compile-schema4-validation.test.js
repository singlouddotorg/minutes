// Schema 4 declares Session ID as required structural data. A blank or unmatched
// Session ID on a Schema 4 file should be a blocking import error (not silently repaired
// via position-based inference, which is only correct for Schema 3 and earlier, where
// Session ID didn't exist as a concept). This was a confirmed, then-unfixed bug caught
// twice across two separate reviews before actually being corrected - this test exists
// so a third recurrence gets caught immediately instead of by a future review.
'use strict';

const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const { loadStage, importIntoCompile, wait, closeAllWindows } = require('./helpers');

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

async function importCsv(rows) {
  const csvText = [HEADER.join(','), ...rows].join('\n');
  const dom = await loadStage('compile');
  const doc = dom.window.document;
  importIntoCompile(dom.window, csvText, 'x.csv', 'text/csv');
  await wait(800);
  return doc.getElementById('importStatus').textContent;
}

after(closeAllWindows);

describe('Compile: Schema 4 Session ID validation', () => {
  test('blank Session ID on a song row is rejected', async () => {
    const status = await importCsv([
      row({ 'Schema Version': '4', 'Order of entry': '1', 'Record Type': 'session', 'Session ID': 'sess1', Event: 'Test', Date: '2026-01-03' }),
      row({ 'Schema Version': '4', 'Order of entry': '2', 'Record Type': 'song', 'Session ID': '', Book: 'SHM1991', 'Leader(s)': 'A', Page: '1' }),
    ]);
    assert.match(status, /Schema 4/);
    assert.match(status, /blank Session ID/);
  });

  test('unmatched Session ID on a song row is rejected, naming the bad value', async () => {
    const status = await importCsv([
      row({ 'Schema Version': '4', 'Order of entry': '1', 'Record Type': 'session', 'Session ID': 'sess1', Event: 'Test', Date: '2026-01-03' }),
      row({ 'Schema Version': '4', 'Order of entry': '2', 'Record Type': 'song', 'Session ID': 'nonexistent', Book: 'SHM1991', 'Leader(s)': 'A', Page: '1' }),
    ]);
    assert.match(status, /"nonexistent"/);
  });

  test('blank session-boundary Session ID is rejected', async () => {
    const status = await importCsv([
      row({ 'Schema Version': '4', 'Order of entry': '1', 'Record Type': 'session', 'Session ID': '', Event: 'Test', Date: '2026-01-03' }),
      row({ 'Schema Version': '4', 'Order of entry': '2', 'Record Type': 'song', 'Session ID': '', Book: 'SHM1991', 'Leader(s)': 'A', Page: '1' }),
    ]);
    assert.match(status, /session boundar/i);
  });

  test('a valid Schema 4 file with matching Session IDs is accepted', async () => {
    const status = await importCsv([
      row({ 'Schema Version': '4', 'Order of entry': '1', 'Record Type': 'session', 'Session ID': 'sess1', Event: 'Test', Date: '2026-01-03' }),
      row({ 'Schema Version': '4', 'Order of entry': '2', 'Record Type': 'song', 'Session ID': 'sess1', Book: 'SHM1991', 'Leader(s)': 'A', Page: '1' }),
    ]);
    assert.match(status, /2 row\(s\) imported/);
  });

  test('Schema 3 with no Session IDs at all still imports via legacy inference (backward compatibility)', async () => {
    const status = await importCsv([
      row({ 'Schema Version': '3', 'Order of entry': '1', 'Record Type': 'session', Event: 'Test', Date: '2026-01-03' }),
      row({ 'Schema Version': '3', 'Order of entry': '2', 'Record Type': 'song', Book: 'SHM1991', 'Leader(s)': 'A', Page: '1' }),
    ]);
    assert.match(status, /2 row\(s\) imported/);
  });
});
