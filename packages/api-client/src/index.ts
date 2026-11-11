import createClient, { type Middleware } from "openapi-fetch";

import type { components, paths } from "./schema";

export type { components, paths };
export type Schemas = components["schemas"];

/** Error body returned by every failing endpoint (app/core/errors.py). */
export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiClientOptions {
  /** Web: "" (same-origin /api proxy). Mobile: "https://api.stars.example.com". */
  baseUrl: string;
  /** Mobile only: the tenant slug, sent as X-Tenant. The portal's proxy injects it from env. */
  tenant?: () => string | null | undefined;
  /** Mobile only: bearer token. Web uses the httpOnly cookie set by the Next.js proxy. */
  accessToken?: () => string | null | undefined | Promise<string | null | undefined>;
  fetch?: typeof globalThis.fetch;
}

export function createApiClient(opts: ApiClientOptions) {
  const client = createClient<paths>({
    baseUrl: opts.baseUrl,
    ...(opts.fetch ? { fetch: opts.fetch } : {}),
  });

  const headers: Middleware = {
    async onRequest({ request }) {
      const tenant = opts.tenant?.();
      if (tenant) request.headers.set("X-Tenant", tenant);
      const token = await opts.accessToken?.();
      if (token) request.headers.set("Authorization", `Bearer ${token}`);
      return request;
    },
  };

  const errors: Middleware = {
    async onResponse({ response }) {
      if (response.ok) return response;
      let body: Partial<ApiErrorBody> = {};
      try {
        body = (await response.clone().json()) as Partial<ApiErrorBody>;
      } catch {
        // non-JSON error (proxy, network) falls through to a generic code
      }
      const err = body.error;
      throw new ApiError(
        response.status,
        err?.code ?? `http_${response.status}`,
        err?.message ?? response.statusText,
        err?.details,
      );
    },
  };

  client.use(headers, errors);
  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;
