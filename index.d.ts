// Type definitions for @keytd/client

export interface KeytdErrorInit {
  status?: number;
  body?: unknown;
}

export class KeytdError extends Error {
  name: 'KeytdError';
  status?: number;
  body?: unknown;
  constructor(message: string, init?: KeytdErrorInit);
}

export interface ClientOptions {
  /** Base URL of the backend, without the trailing /api/v1. */
  url: string;
  /** A `keytd_...` API key created in the admin panel. */
  apiKey: string;
  /** Custom fetch implementation (defaults to global fetch). */
  fetch?: typeof fetch;
  /** Extra headers sent with every request. */
  headers?: Record<string, string>;
}

export interface ListOptions {
  page?: number;
  pageSize?: number;
  /** Equality filters — each key/value becomes `?key=value`. */
  filter?: Record<string, string | number | boolean>;
}

export interface ListResult<T = Record<string, unknown>> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Collection<T = Record<string, unknown>> {
  list(opts?: ListOptions): Promise<ListResult<T>>;
  get(id: string | number): Promise<T>;
  create(values: Partial<T>): Promise<T>;
  update(id: string | number, values: Partial<T>): Promise<T>;
  delete(id: string | number): Promise<{ message: string }>;
}

export interface KeytdClient {
  from<T = Record<string, unknown>>(collection: string): Collection<T>;
  collections(): Promise<string[]>;
  request<T = unknown>(
    method: string,
    path: string,
    opts?: { query?: Record<string, unknown>; body?: unknown }
  ): Promise<T>;
}

export function createClient(options: ClientOptions): KeytdClient;

declare const _default: { createClient: typeof createClient; KeytdError: typeof KeytdError };
export default _default;
