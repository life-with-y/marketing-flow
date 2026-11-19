import test from 'node:test';
import assert from 'node:assert/strict';
import { main } from '../scripts/sheet-cli.mjs';

const run = async (argv, fetchImpl) => {
  let out = '';
  const code = await main(argv, { fetchImpl, out: (s) => { out += s; } });
  return { code, json: JSON.parse(out) };
};

test('prints rows as JSON', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => 'Góp ý,Issue\nSai giá,\nĐẹp,Đã tạo issue #1\n' });
  const { code, json } = await run(['https://example.com/x.csv'], fetchImpl);
  assert.equal(code, 0);
  assert.deepEqual(json, { rows: [{ 'Góp ý': 'Sai giá', Issue: '' }, { 'Góp ý': 'Đẹp', Issue: 'Đã tạo issue #1' }], error: null });
});

test('HTTP error gives error and exit 2', async () => {
  const { code, json } = await run(['https://example.com/x.csv'], async () => ({ ok: false, status: 404 }));
  assert.equal(code, 2);
  assert.deepEqual(json.rows, []);
  assert.match(json.error, /404/);
});
