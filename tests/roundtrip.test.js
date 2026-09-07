// The single most-repeated manual check throughout this project's whole development
// history: every one of the four real, historical sample CSVs must import cleanly into
// both Capture and Compile, with no thrown JS errors and no rows lost. This has been run
// by hand after nearly every change made to either app - this file makes that permanent.
'use strict';

const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const { loadStage, pickFile, importIntoCompile, listSamples, readSample, wait, closeAllWindows } = require('./helpers');

const EXPECTED_ROW_COUNTS = {
  'james-river-convention-2025-11-01-minutes.csv': 87,
  'national-sacred-harp-convention-2000.csv': 249,
  'western-massachusetts-convention-1999.csv': 135,
  'christmas-harp-singing-2018-12-29.csv': 83,
};

after(closeAllWindows);

describe('Capture + Compile round-trip on real historical samples', () => {
  for (const filename of listSamples()) {
    test(`${filename} imports cleanly into Capture with zero JS errors`, async () => {
      const csvText = readSample(filename);
      const dom = await loadStage('minutes');

      const doc = dom.window.document;
      // Capture's side is unchanged: its hidden csvFileInput is still how the wrapper's own
      // stage-sync bridge delivers a record, so this test drives exactly what it always did.
      const input = doc.getElementById('csvFileInput');
      pickFile(dom.window, input, csvText, filename, 'text/csv');
      await wait(800);

      assert.deepEqual(dom.__errors, [], `Capture threw JS error(s) loading ${filename}`);

      const expected = EXPECTED_ROW_COUNTS[filename];
      if (expected) {
        const logText = doc.getElementById('logCount').textContent;
        assert.match(
          logText,
          new RegExp(`\\(${expected}\\)`),
          `Expected Capture's log count to show (${expected}) for ${filename}, got "${logText}"`
        );
      }
    });

    test(`${filename} imports cleanly into Compile with zero JS errors`, async () => {
      const csvText = readSample(filename);
      const dom = await loadStage('compile');

      const doc = dom.window.document;
      importIntoCompile(dom.window, csvText, filename, 'text/csv');
      await wait(800);

      assert.deepEqual(dom.__errors, [], `Compile threw JS error(s) loading ${filename}`);

      const statusText = doc.getElementById('importStatus').textContent;
      const expected = EXPECTED_ROW_COUNTS[filename];
      if (expected) {
        assert.match(
          statusText,
          new RegExp(`^${expected} row`),
          `Expected Compile's import status to report ${expected} rows for ${filename}, got "${statusText}"`
        );
      }
      // A real regression this project hit more than once: importing successfully is not
      // the same as importing without a validation/schema complaint slipping into the
      // status message silently. These four files are all known-good Schema 4 CSVs, so
      // the status should never mention a validation problem.
      assert.doesNotMatch(
        statusText.toLowerCase(),
        /error|invalid|rejected|blank|could not/,
        `Compile's import status for ${filename} unexpectedly mentions a problem: "${statusText}"`
      );
    });
  }
});
