// Smoke test for @keytd/client using a mock fetch. No server required.
//   node test/smoke.mjs
import assert from 'node:assert';
import { createClient, KeytdError } from '../src/index.js';

let pass = 0;
function ok(name) { pass++; console.log(`  ok  ${name}`); }

// A mock fetch that records the last call and returns a scripted response.
function mockFetch(script) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const r = script(url, init);
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      statusText: r.statusText || '',
      text: async () => (r.body === undefined ? '' : JSON.stringify(r.body)),
    };
  };
  fn.calls = calls;
  return fn;
}

// --- construction guards ------------------------------------------------
assert.throws(() => createClient({}), KeytdError);
assert.throws(() => createClient({ url: 'x' }), KeytdError);
ok('createClient requires url + apiKey');

// --- list builds correct URL + headers ----------------------------------
{
  const fetch = mockFetch(() => ({ status: 200, body: { data: [{ id: 1 }], total: 1, page: 1, pageSize: 20 } }));
  const keytd = createClient({ url: 'https://api.test.com/', apiKey: 'keytd_abc', fetch });
  const res = await keytd.from('products').list({ page: 2, pageSize: 5, filter: { status: 'published' } });
  const { url, init } = fetch.calls[0];
  assert.strictEqual(url, 'https://api.test.com/api/v1/products?page=2&pageSize=5&status=published');
  assert.strictEqual(init.method, 'GET');
  assert.strictEqual(init.headers['X-API-Key'], 'keytd_abc');
  assert.deepStrictEqual(res.data, [{ id: 1 }]);
  ok('list() builds URL, query, and auth header');
}

// --- trailing slash on url is normalized --------------------------------
{
  const fetch = mockFetch(() => ({ status: 200, body: { collections: ['a', 'b'] } }));
  const keytd = createClient({ url: 'https://api.test.com///', apiKey: 'k', fetch });
  const names = await keytd.collections();
  assert.strictEqual(fetch.calls[0].url, 'https://api.test.com/api/v1/collections');
  assert.deepStrictEqual(names, ['a', 'b']);
  ok('collections() + url normalization');
}

// --- create sends JSON body + content-type ------------------------------
{
  const fetch = mockFetch(() => ({ status: 201, body: { id: 7, title: 'Hi' } }));
  const keytd = createClient({ url: 'https://api.test.com', apiKey: 'k', fetch });
  const rec = await keytd.from('products').create({ title: 'Hi' });
  const { url, init } = fetch.calls[0];
  assert.strictEqual(url, 'https://api.test.com/api/v1/products');
  assert.strictEqual(init.method, 'POST');
  assert.strictEqual(init.headers['Content-Type'], 'application/json');
  assert.strictEqual(init.body, JSON.stringify({ title: 'Hi' }));
  assert.strictEqual(rec.id, 7);
  ok('create() sends JSON body');
}

// --- get / update / delete encode ids -----------------------------------
{
  const fetch = mockFetch(() => ({ status: 200, body: { message: 'deleted' } }));
  const keytd = createClient({ url: 'https://api.test.com', apiKey: 'k', fetch });
  await keytd.from('products').delete('a/b');
  assert.strictEqual(fetch.calls[0].url, 'https://api.test.com/api/v1/products/a%2Fb');
  assert.strictEqual(fetch.calls[0].init.method, 'DELETE');
  ok('delete() encodes id path segment');
}

// --- non-2xx throws KeytdError with status + parsed body ----------------
{
  const fetch = mockFetch(() => ({ status: 403, statusText: 'Forbidden', body: { error: 'this API key is read-only' } }));
  const keytd = createClient({ url: 'https://api.test.com', apiKey: 'k', fetch });
  await assert.rejects(
    () => keytd.from('products').create({ title: 'x' }),
    (err) => {
      assert.ok(err instanceof KeytdError);
      assert.strictEqual(err.status, 403);
      assert.strictEqual(err.message, 'this API key is read-only');
      assert.deepStrictEqual(err.body, { error: 'this API key is read-only' });
      return true;
    }
  );
  ok('non-2xx throws KeytdError with status + body');
}

// --- network failure surfaces as KeytdError status 0 --------------------
{
  const fetch = async () => { throw new Error('ECONNREFUSED'); };
  const keytd = createClient({ url: 'https://api.test.com', apiKey: 'k', fetch });
  await assert.rejects(
    () => keytd.collections(),
    (err) => err instanceof KeytdError && err.status === 0
  );
  ok('network error → KeytdError status 0');
}

console.log(`\n${pass} checks passed`);
