import os from 'node:os';
import path from 'node:path';

export function profileDir(home = os.homedir()) {
  return path.join(home, '.homematch-marketing');
}

export function expandHome(p, home = os.homedir()) {
  if (p === '~') return home;
  if (typeof p === 'string' && (p.startsWith('~/') || p.startsWith('~\\'))) {
    return path.join(home, p.slice(2));
  }
  return p;
}
