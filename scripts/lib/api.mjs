export class ApiError extends Error {
  constructor(message, kind) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
  }
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function checkSchema(raw) {
  const bad = () => new ApiError('Dữ liệu từ máy chủ không đúng định dạng (thiếu data/areas/buildings/rooms)', 'schema');
  if (!isObj(raw) || !Array.isArray(raw.data)) throw bad();
  for (const c of raw.data) {
    if (!isObj(c) || !Array.isArray(c.areas)) throw bad();
    for (const a of c.areas) {
      if (!isObj(a) || !Array.isArray(a.buildings)) throw bad();
      for (const b of a.buildings) {
        if (!isObj(b) || !Array.isArray(b.rooms)) throw bad();
      }
    }
  }
}

export async function fetchListingsRaw({ baseUrl, token, fetchImpl = fetch, timeoutMs = 30000 }) {
  const url = `${String(baseUrl).replace(/\/+$/, '')}/public/building-listing-posts-unit`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetchImpl(url, {
      method: 'GET',
      headers: { 'x-public-api-token': token, accept: 'application/json' },
      signal: ctrl.signal,
    });
  } catch (e) {
    const timedOut = e && e.name === 'AbortError';
    throw new ApiError(timedOut ? 'Máy chủ không phản hồi kịp (hết thời gian chờ)' : 'Không kết nối được tới máy chủ', 'network');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401 || res.status === 403) {
    throw new ApiError('Token không hợp lệ hoặc không có quyền truy cập', 'auth');
  }
  if (!res.ok) {
    throw new ApiError(`Máy chủ trả lỗi (HTTP ${res.status})`, 'network');
  }
  let raw;
  try {
    raw = await res.json();
  } catch {
    throw new ApiError('Máy chủ trả dữ liệu không phải JSON', 'schema');
  }
  checkSchema(raw);
  return raw;
}
