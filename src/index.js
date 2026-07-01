// @keytd/client — tiny, zero-dependency client for the keytd data API.
//
// Works in the browser and in any runtime with a global `fetch`
// (Node 18+, Deno, Bun, edge runtimes). No build step required.
//
//   import { createClient } from '@keytd/client'
//
//   const keytd = createClient({
//     url: 'https://api.your-domain.com',
//     apiKey: 'keytd_xxx',
//   })
//
//   const { data, total } = await keytd.from('products').list({ page: 1 })
//   const one = await keytd.from('products').get(42)
//   const created = await keytd.from('products').create({ title: 'Hi' })

/**
 * Error thrown for any non-2xx response from the API. Carries the HTTP
 * status and the parsed error payload so callers can branch on it.
 */
export class KeytdError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = 'KeytdError';
    this.status = status;
    this.body = body;
  }
}

function normalizeBaseUrl(url) {
  if (!url) throw new KeytdError('createClient: `url` is required');
  return String(url).replace(/\/+$/, '');
}

function buildQuery(params) {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null) continue;
    usp.append(key, String(value));
  }
  const q = usp.toString();
  return q ? `?${q}` : '';
}

/**
 * Create a keytd client.
 *
 * @param {object} options
 * @param {string} options.url     Base URL of the backend (no trailing /api/v1).
 * @param {string} options.apiKey  A `keytd_...` API key from the admin panel.
 * @param {typeof fetch} [options.fetch]  Custom fetch (defaults to global).
 * @param {Record<string,string>} [options.headers]  Extra headers on every request.
 */
export function createClient(options = {}) {
  const base = normalizeBaseUrl(options.url);
  const apiKey = options.apiKey;
  if (!apiKey) throw new KeytdError('createClient: `apiKey` is required');
  const doFetch = options.fetch || globalThis.fetch;
  if (typeof doFetch !== 'function') {
    throw new KeytdError('createClient: no global fetch found — pass options.fetch');
  }
  const extraHeaders = options.headers || {};

  async function request(method, path, { query, body } = {}) {
    const url = `${base}/api/v1${path}${buildQuery(query)}`;
    const headers = { 'X-API-Key': apiKey, ...extraHeaders };
    const init = { method, headers };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await doFetch(url, init);
    } catch (err) {
      throw new KeytdError(`network error: ${err.message}`, { status: 0 });
    }
    const text = await res.text();
    let parsed = null;
    if (text) {
      try { parsed = JSON.parse(text); } catch { parsed = text; }
    }
    if (!res.ok) {
      const msg = (parsed && parsed.error) || res.statusText || `HTTP ${res.status}`;
      throw new KeytdError(msg, { status: res.status, body: parsed });
    }
    return parsed;
  }

  /** A scoped query interface for a single collection. */
  function from(collection) {
    if (!collection) throw new KeytdError('from(): collection name is required');
    const enc = encodeURIComponent(collection);
    return {
      /**
       * List records. Any key in `filter` becomes an equality filter.
       * @param {{page?:number, pageSize?:number, filter?:Record<string,any>}} [opts]
       * @returns {Promise<{data:any[], total:number, page:number, pageSize:number}>}
       */
      list(opts = {}) {
        const { page, pageSize, filter } = opts;
        return request('GET', `/${enc}`, { query: { page, pageSize, ...filter } });
      },
      /** Fetch a single record by id. */
      get(id) {
        return request('GET', `/${enc}/${encodeURIComponent(id)}`);
      },
      /** Create a record (needs a read-write key). */
      create(values) {
        return request('POST', `/${enc}`, { body: values });
      },
      /** Update a record by id (needs a read-write key). */
      update(id, values) {
        return request('PUT', `/${enc}/${encodeURIComponent(id)}`, { body: values });
      },
      /** Delete a record by id (needs a read-write key). */
      delete(id) {
        return request('DELETE', `/${enc}/${encodeURIComponent(id)}`);
      },
    };
  }

  return {
    from,
    /** List the collections this key can see. @returns {Promise<string[]>} */
    async collections() {
      const res = await request('GET', '/collections');
      return (res && res.collections) || [];
    },
    /** Escape hatch for calling an endpoint the helpers don't cover. */
    request,
  };
}

export default { createClient, KeytdError };
