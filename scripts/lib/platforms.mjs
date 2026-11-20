// Hướng dẫn đăng theo nền tảng: rules/platforms/<file>, file cùng tên trong ~/.homematch-marketing/platforms/ ghi đè.
import fs from 'node:fs';
import path from 'node:path';

export const PLATFORM_FILES = {
  page: 'facebook-page.md',
  wall: 'facebook-profile.md',
  group: 'facebook-groups.md',
  threads: 'threads.md',
};

export function platformGuidePaths(dir, root) {
  const out = {};
  for (const [kind, file] of Object.entries(PLATFORM_FILES)) {
    const own = path.join(dir, 'platforms', file);
    out[kind] = fs.existsSync(own) ? own : path.join(root, 'rules', 'platforms', file);
  }
  return out;
}
