import Constants from "expo-constants";

import { ApiError } from "@/lib/apiError";
import { clearTokens, loadSession, saveTokens } from "@/lib/session";
import { tenantSlug } from "@/lib/tenant";

export { ApiError };

/**
 * Talking to the API from the app.
 *
 * Unlike the owner portal, which goes through its Next.js proxy, the app holds its own tokens
 * and names its operator with X-Tenant. An expired access token is renewed once, transparently.
 *
 * There is deliberately no offline queue (plan D11): giving, redeeming, spinning and approving
 * need a connection and show the server's answer, so a failed call is reported, not replayed.
 */

/** In development, reach the API on the machine running Metro. */
function devHost(): string {
  const hostUri = Constants.expoConfig?.hostUri ?? "";
  const host = hostUri.split(":")[0];
  return host ? `http://${host}:8000` : "http://127.0.0.1:8000";
}

export const API_URL = process.env.EXPO_PUBLIC_API_URL || devHost();

interface CallOptions {
  method?: string;
  body?: unknown;
  /** Skip the token: used by sign-in calls. */
  anonymous?: boolean;
}

async function send(path: string, options: CallOptions, token: string | null) {
  const headers: Record<string, string> = { "x-client": "app" };
  const tenant = tenantSlug();
  if (tenant) headers["x-tenant"] = tenant;
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (token && !options.anonymous) headers.authorization = `Bearer ${token}`;
  try {
    return await fetch(`${API_URL}/api/v1${path}`, {
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, "network", "no connection");
  }
}

/** The API's error envelope as an ApiError, or the bare status when there is none. */
async function failure(response: Response): Promise<ApiError> {
  const payload: unknown = await response.json().catch(() => null);
  const error = (payload as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
  return new ApiError(
    response.status,
    error?.code ?? `http_${response.status}`,
    error?.message ?? "request failed",
    error?.details,
  );
}

const sessionEnded = new Set<() => void>();

/**
 * Be told when the server has ended this device's session: it refused the refresh token
 * (revoked, expired, reused, or the person was terminated). The tokens are already cleared by
 * then. The auth provider listens, so the route gates send the person to the welcome screen
 * rather than leaving every screen on a Retry that can never work. Returns the way to stop
 * listening.
 */
export function onSessionEnded(listener: () => void): () => void {
  sessionEnded.add(listener);
  return () => {
    sessionEnded.delete(listener);
  };
}

/**
 * Trade the refresh token for a new pair. Resolves to the new access token, or to null when
 * the server refused the refresh token, which ends the session here too.
 *
 * Anything short of that refusal (no connection, a server error, too many requests) is thrown
 * and the tokens are kept: a dead spot or a bad minute on the server must not sign anyone out.
 */
async function renew(refreshToken: string): Promise<string | null> {
  const response = await send(
    "/auth/refresh",
    { method: "POST", body: { refresh_token: refreshToken }, anonymous: true },
    null,
  );
  if (response.status === 401) {
    await clearTokens();
    for (const listener of sessionEnded) listener();
    return null;
  }
  if (!response.ok) throw await failure(response);
  const tokens = (await response.json()) as { access_token: string; refresh_token?: string | null };
  await saveTokens(tokens.access_token, tokens.refresh_token ?? null);
  return tokens.access_token;
}

/**
 * The most recent renewal and the refresh token it spent.
 *
 * Screens load in parallel, so when the access token expires several requests get a 401 at
 * once. The server rotates refresh tokens and treats a second use of one as theft, ending
 * every session in the family (refresh_reused), so only the first of them renews and the rest
 * wait for its answer. It is kept after it settles, so a request that read the old refresh
 * token a moment before the renewal finished still never sends that token a second time.
 */
let lastRenewal: { refreshToken: string; accessToken: Promise<string | null> } | null = null;

function renewOnce(refreshToken: string): Promise<string | null> {
  if (lastRenewal?.refreshToken === refreshToken) return lastRenewal.accessToken;
  const renewal = { refreshToken, accessToken: renew(refreshToken) };
  lastRenewal = renewal;
  // A renewal that failed without the server's verdict (no connection, say) gave nothing to
  // share, so the next 401 is free to try again with the same token.
  renewal.accessToken.catch(() => {
    if (lastRenewal === renewal) lastRenewal = null;
  });
  return renewal.accessToken;
}

/**
 * The access token to retry a 401 with, or null when the session is over. The session is read
 * again first: if another request renewed it after this one was sent, that new token is used
 * as it is, rather than renewing again with a refresh token that has already been spent.
 */
async function freshToken(sent: string | null): Promise<string | null> {
  const current = await loadSession();
  if (current.accessToken && current.accessToken !== sent) return current.accessToken;
  if (!current.refreshToken) return null;
  return renewOnce(current.refreshToken);
}

export async function api<T>(path: string, options: CallOptions = {}): Promise<T> {
  const session = await loadSession();
  let response = await send(path, options, session.accessToken);

  if (response.status === 401 && session.refreshToken && !options.anonymous) {
    const fresh = await freshToken(session.accessToken);
    if (fresh) response = await send(path, options, fresh);
  }

  if (response.status === 204) return undefined as T;
  if (!response.ok) throw await failure(response);
  return (await response.json().catch(() => null)) as T;
}
