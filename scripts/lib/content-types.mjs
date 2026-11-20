// Đọc content-types.md thành danh sách kiểu bài cho tab Kiểu bài. Thiếu trường thì để rỗng.

const FIELD_RE = /^\s*[-*]\s+\*\*(.+?)\*\*\s*(?:\(([^)]*)\))?\s*:?\s*(.*)$/;
const KEYS = {
  'kênh': 'channels',
  'số tin mỗi bài': 'listings',
  'cách chọn tin': 'howToPick',
  'cấu trúc': 'structure',
  'ảnh': 'images',
  'ví dụ': 'example',
};

function parseSection(title, lines) {
  const t = { name: title.replace(/^\d+\.\s*/, '').trim(), channels: [], listings: '', howToPick: '', structure: [], images: '', example: '', exampleNote: '' };
  let known = false;
  for (let i = 0; i < lines.length; i++) {
    const m = FIELD_RE.exec(lines[i]);
    const key = m && KEYS[m[1].trim().toLowerCase()];
    if (!key) continue;
    known = true;
    const val = m[3].trim();
    if (key === 'channels') {
      t.channels = val.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (key === 'structure') {
      if (val) t.structure.push(val);
      for (let j = i + 1; j < lines.length && !FIELD_RE.test(lines[j]); j++) {
        const step = /^\s*(?:\d+[.)]|[-*•])\s+(.*)$/.exec(lines[j]);
        if (step) t.structure.push(step[1].trim());
      }
    } else if (key === 'example') {
      t.exampleNote = (m[2] || '').trim();
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      if (j < lines.length && /^\s*```/.test(lines[j])) {
        const body = [];
        for (j++; j < lines.length && !/^\s*```/.test(lines[j]); j++) body.push(lines[j]);
        t.example = body.join('\n').replace(/^\n+|\s+$/g, '');
      } else {
        t.example = val;
      }
    } else {
      t[key] = val;
    }
  }
  return known ? t : null;
}

export function parseContentTypes(md) {
  const out = [];
  let cur = null;
  const flush = () => { if (cur) { const t = parseSection(cur.title, cur.lines); if (t) out.push(t); } };
  for (const line of String(md ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const h = /^##\s+(.*)$/.exec(line);
    if (h) { flush(); cur = { title: h[1], lines: [] }; } else if (cur) cur.lines.push(line);
  }
  flush();
  return out;
}
