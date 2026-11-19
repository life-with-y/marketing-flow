// In JSON {rows, error} của một CSV Sheet đã xuất bản: sheet-cli.mjs <url> | --feedback (Task 14).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchSheet } from './lib/sheet.mjs';
import { profileDir } from './lib/paths.mjs';
import { loadConfig, ConfigError } from './lib/config.mjs';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function main(argv, { fetchImpl = fetch, out = (s) => process.stdout.write(s), home, root = PLUGIN_ROOT } = {}) {
  let url = argv[0];
  if (url === '--feedback') {
    try {
      url = loadConfig(profileDir(home), { root }).library?.feedbackCsvUrl ?? '';
    } catch (e) {
      if (!(e instanceof ConfigError)) throw e;
      out(JSON.stringify({ rows: [], error: e.message }) + '\n');
      return 2;
    }
    if (!url) {
      out(JSON.stringify({ rows: [], error: 'Chưa có library.feedbackCsvUrl trong cấu hình' }) + '\n');
      return 2;
    }
  }
  const res = await fetchSheet(url, fetchImpl);
  out(JSON.stringify(res) + '\n');
  return res.error ? 2 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
