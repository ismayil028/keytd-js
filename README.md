# @keytd/client

Tiny, zero-dependency JavaScript/TypeScript client for the **keytd** data API.
Works in the browser and in any runtime with a global `fetch` — Node 18+, Deno,
Bun, and edge runtimes. No build step, no dependencies.

## Install

```bash
npm install @keytd/client
```

## Quick start

Create an API key in your admin panel (**System → API Keys**), then:

```js
import { createClient } from '@keytd/client';

const keytd = createClient({
  url: 'https://api.your-domain.com', // your backend base URL
  apiKey: 'keytd_xxxxxxxx',           // read-only or read-write key
});

// List records (paginated)
const { data, total } = await keytd.from('products').list({ page: 1, pageSize: 20 });

// Filter (equality)
const featured = await keytd.from('products').list({ filter: { status: 'published' } });

// Single record
const product = await keytd.from('products').get(42);

// Create / update / delete (needs a read-write key)
const created = await keytd.from('products').create({ title: 'New thing', price: 9.99 });
await keytd.from('products').update(created.id, { price: 12.5 });
await keytd.from('products').delete(created.id);

// Discover collections your key can see
const names = await keytd.collections(); // ['products', 'orders', ...]
```

## Error handling

Any non-2xx response throws a `KeytdError` with the HTTP status and parsed body:

```js
import { KeytdError } from '@keytd/client';

try {
  await keytd.from('products').create({ title: 'x' });
} catch (err) {
  if (err instanceof KeytdError) {
    console.error(err.status, err.message); // e.g. 403 "this API key is read-only"
  }
}
```

## API

### `createClient({ url, apiKey, fetch?, headers? })`

| Option    | Type                     | Description                                          |
| --------- | ------------------------ | ---------------------------------------------------- |
| `url`     | `string`                 | Backend base URL (no trailing `/api/v1`).            |
| `apiKey`  | `string`                 | A `keytd_...` key from the admin panel.              |
| `fetch`   | `typeof fetch`           | Optional custom fetch (defaults to global).          |
| `headers` | `Record<string,string>`  | Optional extra headers sent on every request.        |

### `keytd.from(collection)`

| Method                    | Returns                              | Notes                    |
| ------------------------- | ------------------------------------ | ------------------------ |
| `.list({page,pageSize,filter})` | `{ data, total, page, pageSize }` | `filter` = equality only |
| `.get(id)`                | record                               |                          |
| `.create(values)`         | created record                       | read-write key           |
| `.update(id, values)`     | updated record                       | read-write key           |
| `.delete(id)`             | `{ message }`                        | read-write key           |

### `keytd.collections()`

Returns the list of collection names the key is allowed to see.

## Security notes

- A **read-only** key can only `list`/`get`. Writes return `403`.
- Keys are scoped to a single workspace (tenant) — a key can never reach another
  tenant's data or system tables (users, API keys, etc.).
- Prefer read-only keys for public frontends; keep read-write keys server-side.

## License

MIT
