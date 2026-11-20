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
        for (const r of b.rooms) {
          if (!isObj(r) || !Number.isInteger(r.rent_price) || r.rent_price <= 0) {
            throw new ApiError('Dữ liệu từ máy chủ có phòng thiếu hoặc sai giá thuê (rent_price)', 'schema');
          }
        }
      }
    }
  }
}

async function getJson({ url, token, fetchImpl, timeoutMs }) {
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
  if (res.status === 404) {
    throw new ApiError('Máy chủ chưa có route này (HTTP 404)', 'notFound');
  }
  if (!res.ok) {
    throw new ApiError(`Máy chủ trả lỗi (HTTP ${res.status})`, 'network');
  }
  try {
    return await res.json();
  } catch {
    throw new ApiError('Máy chủ trả dữ liệu không phải JSON', 'schema');
  }
}

const base = (baseUrl) => String(baseUrl).replace(/\/+$/, '');

// Route cũ (khung JSON của API AdsPower): quận → toà → phòng.
export async function fetchListingsRaw({ baseUrl, token, fetchImpl = fetch, timeoutMs = 30000 }) {
  let raw;
  try {
    raw = await getJson({ url: `${base(baseUrl)}/public/building-listing-posts-unit`, token, fetchImpl, timeoutMs });
  } catch (e) {
    if (e instanceof ApiError && e.kind === 'notFound') throw new ApiError(e.message, 'network');
    throw e;
  }
  checkSchema(raw);
  return raw;
}

function checkMarketingSchema(raw) {
  const bad = () => new ApiError('Dữ liệu từ máy chủ không đúng định dạng (thiếu listings/rooms/building)', 'schema');
  if (!isObj(raw) || !Array.isArray(raw.listings)) throw bad();
  for (const l of raw.listings) {
    if (!isObj(l) || typeof l.code !== 'string' || !Array.isArray(l.rooms) || !isObj(l.building)) throw bad();
    for (const r of l.rooms) {
      if (!isObj(r) || !Number.isInteger(r.rent_vnd) || r.rent_vnd <= 0) {
        throw new ApiError('Dữ liệu từ máy chủ có phòng thiếu hoặc sai giá thuê (rent_vnd)', 'schema');
      }
    }
  }
}

// Route mới cho marketing: nhiều trường hơn (loại phòng, phí, thú cưng, xe điện, đường vào…).
export async function fetchMarketingRaw({ baseUrl, token, fetchImpl = fetch, timeoutMs = 30000 }) {
  const raw = await getJson({ url: `${base(baseUrl)}/public/marketing-listings`, token, fetchImpl, timeoutMs });
  checkMarketingSchema(raw);
  return raw;
}

// Gọi route mới; máy chủ chưa có (404) thì lùi về route cũ.
export async function fetchListings(opts) {
  try {
    return { source: 'marketing', raw: await fetchMarketingRaw(opts) };
  } catch (e) {
    if (!(e instanceof ApiError) || e.kind !== 'notFound') throw e;
  }
  return { source: 'legacy', raw: await fetchListingsRaw(opts) };
}
