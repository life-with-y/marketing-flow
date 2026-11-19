import fs from 'node:fs';
import path from 'node:path';

const snapDir = (dir) => path.join(dir, 'snapshots');
const slots = (dir) => {
  try {
    return fs.readdirSync(snapDir(dir)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
  } catch {
    return [];
  }
};

export function saveSnapshot(dir, slot, listings, keep = 30) {
  fs.mkdirSync(snapDir(dir), { recursive: true });
  fs.writeFileSync(path.join(snapDir(dir), `${slot}.json`), JSON.stringify(listings));
  const all = slots(dir);
  for (const old of all.slice(0, Math.max(0, all.length - keep))) {
    fs.rmSync(path.join(snapDir(dir), `${old}.json`), { force: true });
  }
}

export function latestSnapshot(dir, beforeSlot) {
  const prior = slots(dir).filter((s) => s < beforeSlot);
  if (!prior.length) return null;
  return JSON.parse(fs.readFileSync(path.join(snapDir(dir), `${prior[prior.length - 1]}.json`), 'utf8'));
}
