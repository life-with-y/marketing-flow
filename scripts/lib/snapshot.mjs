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
  // Ghi file tạm rồi đổi tên: lần chạy bị ngắt không để lại snapshot cụt.
  const file = path.join(snapDir(dir), `${slot}.json`);
  const tmp = `${file}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(listings));
    fs.renameSync(tmp, file);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw e;
  }
  const all = slots(dir);
  for (const old of all.slice(0, Math.max(0, all.length - keep))) {
    fs.rmSync(path.join(snapDir(dir), `${old}.json`), { force: true });
  }
}

// Bản mới nhất trước beforeSlot; file hỏng/không đọc được thì lùi về bản cũ hơn, hết thì null.
export function latestSnapshot(dir, beforeSlot) {
  const prior = slots(dir).filter((s) => s < beforeSlot);
  for (let i = prior.length - 1; i >= 0; i--) {
    try {
      const v = JSON.parse(fs.readFileSync(path.join(snapDir(dir), `${prior[i]}.json`), 'utf8'));
      if (Array.isArray(v)) return v;
    } catch {
      // bỏ qua file hỏng
    }
  }
  return null;
}
