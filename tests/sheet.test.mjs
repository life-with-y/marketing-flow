import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseCsv, fetchSheet, loadLeads } from '../scripts/lib/sheet.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'hm-'));

test('parseCsv quotes, commas, newlines in cells', () => {
  const rows = parseCsv('a,b\n1,"Có, nhưng ""ít"""\n2,"dòng 1\ndòng 2"\n');
  assert.deepEqual(rows, [
    { a: '1', b: 'Có, nhưng "ít"' },
    { a: '2', b: 'dòng 1\ndòng 2' },
  ]);
});

test('parseCsv BOM, CRLF, trailing/empty rows, trimmed headers', () => {
  const rows = parseCsv('﻿ a , b \r\n1,2\r\n,\r\n\r\n3,4\r\n\r\n');
  assert.deepEqual(rows, [{ a: '1', b: '2' }, { a: '3', b: '4' }]);
});

test('parseCsv empty input', () => assert.deepEqual(parseCsv(''), []));

test('fetchSheet empty url is not an error', async () => {
  assert.deepEqual(await fetchSheet(''), { rows: [], error: null });
  assert.deepEqual(await fetchSheet(undefined), { rows: [], error: null });
});

test('fetchSheet 404', async () => {
  const f = async () => ({ ok: false, status: 404, text: async () => '' });
  const r = await fetchSheet('https://docs.google.com/x?key=SECRET', f);
  assert.deepEqual(r.rows, []);
  assert.match(r.error, /404/);
  assert.ok(!r.error.includes('SECRET'));
});

test('fetchSheet network error does not throw or leak url', async () => {
  const f = async () => { throw new Error('boom https://docs.google.com/x?key=SECRET'); };
  const r = await fetchSheet('https://docs.google.com/x?key=SECRET', f);
  assert.deepEqual(r.rows, []);
  assert.ok(r.error);
  assert.ok(!r.error.includes('SECRET'));
});

test('fetchSheet ok parses', async () => {
  const f = async () => ({ ok: true, status: 200, text: async () => 'a\n1\n' });
  assert.deepEqual(await fetchSheet('https://x/y', f), { rows: [{ a: '1' }], error: null });
});

test('loadLeads missing, valid, malformed', () => {
  const d = tmp();
  assert.equal(loadLeads(d, '2026-11-19'), null);
  fs.mkdirSync(path.join(d, 'leads'));
  fs.writeFileSync(path.join(d, 'leads', '2026-11-19.json'), '{"n":1}');
  assert.deepEqual(loadLeads(d, '2026-11-19'), { n: 1 });
  fs.writeFileSync(path.join(d, 'leads', '2026-11-20.json'), '{bad');
  assert.equal(loadLeads(d, '2026-11-20'), null);
});
