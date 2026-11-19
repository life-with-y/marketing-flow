import fs from 'node:fs';
import path from 'node:path';

const file = (dir) => path.join(dir, 'prepared.jsonl');

export function appendPrepared(dir, entries, now = new Date()) {
  if (!entries.length) return;
  fs.mkdirSync(dir, { recursive: true });
  const at = now.toISOString();
  fs.appendFileSync(file(dir), entries.map((e) => JSON.stringify({ ...e, at })).join('\n') + '\n');
}

export function lastPreparedMap(dir) {
  const map = new Map();
  let text;
  try {
    text = fs.readFileSync(file(dir), 'utf8');
  } catch {
    return map;
  }
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    for (const code of e.postCodes || []) {
      const k = `${e.target}|${code}`;
      if (!map.has(k) || e.at > map.get(k)) map.set(k, e.at);
    }
  }
  return map;
}
