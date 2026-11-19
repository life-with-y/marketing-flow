import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { main } from '../scripts/setup-permissions.mjs';

function mk(settings) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hm-perm-'));
  const file = path.join(home, '.claude', 'settings.json');
  if (settings !== undefined) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, settings); }
  return { home, file };
}
async function run(argv, { home, file }, now = new Date('2026-11-19T10:00:00Z')) {
  const lines = [];
  const push = (s) => lines.push(String(s));
  const code = await main(argv, { home, settingsPath: file, out: push, err: push, now });
  return { code, text: lines.join('\n') };
}
const readJ = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

test('dry run prints rules JSON incl deny and ~ form, writes nothing', async () => {
  const e = mk();
  const r = await run(['--output-dir', path.join(e.home, 'HM-Posts')], e);
  assert.equal(r.code, 0);
  const j = JSON.parse(r.text);
  assert.ok(j.allow.includes('Write(~/HM-Posts/**)'));
  assert.ok(j.allow.includes('Read(~/.homematch-marketing/**)'));
  assert.ok(j.allow.some((x) => /^Bash\(node \/.*\/scripts\/prepare\.mjs:\*\)$/.test(x)));
  assert.ok(j.allow.some((x) => x.includes('/scripts/build.mjs:*')) && j.allow.some((x) => x.includes('/scripts/config-cli.mjs:*')));
  assert.deepEqual(j.deny, ['Read(~/.homematch-marketing/secrets.json)']);
  assert.equal(fs.existsSync(e.file), false);
});

test('--apply creates missing file', async () => {
  const e = mk();
  const r = await run(['--output-dir', '~/HM-Posts', '--apply'], e);
  assert.equal(r.code, 0);
  const s = readJ(e.file);
  assert.ok(s.permissions.allow.includes('Write(~/HM-Posts/**)'));
  assert.deepEqual(s.permissions.deny, ['Read(~/.homematch-marketing/secrets.json)']);
});

test('malformed or wrong-typed settings untouched, exit 2', async () => {
  for (const body of ['{oops', '[]', '{"permissions":[]}', '{"permissions":{"allow":"x"}}', '{"permissions":{"deny":{}}}']) {
    const e = mk(body);
    const r = await run(['--output-dir', '~/HM-Posts', '--apply'], e);
    assert.equal(r.code, 2, body);
    assert.equal(fs.readFileSync(e.file, 'utf8'), body);
    assert.equal(fs.readdirSync(path.dirname(e.file)).length, 1);
  }
});

test('preserves existing, no duplicates on second run, backup kept', async () => {
  const e = mk(JSON.stringify({ theme: 'x', permissions: { allow: ['Bash(ls:*)'], deny: ['Bash(rm:*)'] } }));
  await run(['--output-dir', '~/HM-Posts', '--apply'], e);
  const first = readJ(e.file);
  assert.equal(first.theme, 'x');
  assert.ok(first.permissions.allow.includes('Bash(ls:*)'));
  assert.ok(first.permissions.deny.includes('Bash(rm:*)'));
  const baks = fs.readdirSync(path.dirname(e.file)).filter((f) => f.startsWith('settings.json.bak-hm-'));
  assert.equal(baks.length, 1);
  const bakBody = fs.readFileSync(path.join(path.dirname(e.file), baks[0]), 'utf8');
  assert.equal(JSON.parse(bakBody).permissions.allow.length, 1);
  const r2 = await run(['--output-dir', '~/HM-Posts', '--apply'], e);
  assert.equal(r2.code, 0);
  assert.deepEqual(readJ(e.file), first);
  assert.equal(new Set(first.permissions.allow).size, first.permissions.allow.length);
  // same timestamp, changed outputDir: backup must not overwrite existing one
  await run(['--output-dir', '~/Other', '--apply'], e);
  const baks2 = fs.readdirSync(path.dirname(e.file)).filter((f) => f.startsWith('settings.json.bak-hm-'));
  assert.equal(baks2.length, 2);
  assert.equal(fs.readFileSync(path.join(path.dirname(e.file), baks[0]), 'utf8'), bakBody);
});

test('refuses dangerous outputDir', async () => {
  const e = mk();
  const parent = path.dirname(e.home);
  for (const d of ['~', '/', e.home, parent, '~/.claude', '~/.claude/x', '']) {
    const r = await run(['--output-dir', d, '--apply'], e);
    assert.equal(r.code, 2, `dir=${d}`);
  }
  assert.equal(fs.existsSync(e.file), false);
});
