import fs from 'node:fs';
import path from 'node:path';

export function parseCsv(text) {
  if (!text) return [];
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const records = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const endRow = () => { row.push(cell); cell = ''; records.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\r') { if (text[i + 1] === '\n') i++; endRow(); }
    else if (c === '\n') endRow();
    else cell += c;
  }
  if (cell !== '' || row.length) endRow();
  const nonEmpty = records.filter((r) => r.some((v) => v.trim() !== ''));
  if (!nonEmpty.length) return [];
  const headers = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((r) => {
    const o = {};
    headers.forEach((h, i) => { o[h] = r[i] ?? ''; });
    return o;
  });
}

export async function fetchSheet(url, fetchImpl = fetch) {
  if (!url) return { rows: [], error: null };
  let host = '';
  try { host = new URL(url).host; } catch { return { rows: [], error: 'Link Sheet không hợp lệ' }; }
  try {
    const res = await fetchImpl(url);
    if (!res.ok || res.status !== 200) {
      return { rows: [], error: `Không đọc được Sheet (HTTP ${res.status})` };
    }
    return { rows: parseCsv(await res.text()), error: null };
  } catch {
    return { rows: [], error: `Không đọc được Sheet (lỗi mạng tới ${host})` };
  }
}

export function loadLeads(dir, dateStr) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'leads', `${dateStr}.json`), 'utf8'));
  } catch {
    return null;
  }
}
