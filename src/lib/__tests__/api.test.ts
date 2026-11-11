/**
 * Renewing an expired session. The server rotates refresh tokens and, when one is used twice,
 * takes it as stolen and ends every session in its family (refresh_reused). Screens load in
 * parallel, so the app must renew once however many requests find the token expired, and
 * must never send a refresh token it has already spent. Tested against a fake device keychain
 * and a fake server that behaves that way.
 */
import { api, ApiError, onSessionEnded } from "@/lib/api";

const mockSession = {
  accessToken: null as string | null,
  refreshToken: null as string | null,
};

jest.mock("@/lib/session", () => ({
  loadSession: async () => ({ ...mockSession }),
  saveTokens: async (access: string, refresh: string | null) => {
    mockSession.accessToken = access;
    if (refresh) mockSession.refreshToken = refresh;
  },
  clearTokens: async () => {
    mockSession.accessToken = null;
    mockSession.refreshToken = null;
  },
}));

jest.mock("@/lib/tenant", () => ({ tenantSlug: () => "demo" }));

jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: null } }));
// babel-preset-expo reads EXPO_PUBLIC_ variables through this module, which jest cannot load.
jest.mock("expo/virtual/env", () => ({ env: process.env }));

type RefreshMode = "rotate" | "refuse" | "fail" | "offline";

/** The server's side: the one live access token and the one live refresh token. */
const server = {
  // Never reset, so every test's tokens are new to the app.
  generation: 0,
  access: "",
  refresh: "",
  /** Every refresh token presented to /auth/refresh, in order. */
  refreshes: [] as string[],
  refreshMode: "rotate" as RefreshMode,
  /** A request to one of these paths gets its answer only once the promise settles. */
  holds: new Map<string, Promise<void>>(),
};

function reply(status: number, body: unknown): Response {
  return { status, ok: status >= 200 && status < 300, json: async () => body } as unknown as Response;
}

async function fakeFetch(url: string, init: RequestInit): Promise<Response> {
  const path = url.slice(url.indexOf("/api/v1") + "/api/v1".length);
  if (path === "/auth/refresh") {
    const { refresh_token: presented } = JSON.parse(String(init.body)) as { refresh_token: string };
    server.refreshes.push(presented);
    // Long enough for every other request on the screen to get its 401 meanwhile.
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (server.refreshMode === "offline") throw new TypeError("Network request failed");
    if (server.refreshMode === "fail") return reply(503, null);
    if (server.refreshMode === "refuse" || presented !== server.refresh) {
      server.access = "revoked";
      server.refresh = "revoked";
      return reply(401, { error: { code: "refresh_reused", message: "refresh token reused" } });
    }
    server.generation += 1;
    server.access = `access-${server.generation}`;
    server.refresh = `refresh-${server.generation}`;
    return reply(200, { access_token: server.access, refresh_token: server.refresh });
  }
  // The token is checked as the request arrives, even when the answer comes back later.
  const authorised = (init.headers as Record<string, string>).authorization === `Bearer ${server.access}`;
  const hold = server.holds.get(path);
  if (hold) await hold;
  return authorised ? reply(200, { path }) : reply(401, { error: { code: "token_expired", message: "expired" } });
}

async function failureOf(call: Promise<unknown>): Promise<ApiError> {
  try {
    await call;
  } catch (err) {
    if (err instanceof ApiError) return err;
    throw err;
  }
  throw new Error("expected the call to fail");
}

let issuedRefresh = "";

beforeEach(() => {
  globalThis.fetch = jest.fn(fakeFetch) as unknown as typeof fetch;
  server.generation += 1;
  // The device signed in a while ago: its access token has expired, its refresh token is live.
  server.access = `access-${server.generation}`;
  server.refresh = `refresh-${server.generation}`;
  server.refreshes = [];
  server.refreshMode = "rotate";
  server.holds.clear();
  issuedRefresh = server.refresh;
  mockSession.accessToken = `expired-${server.generation}`;
  mockSession.refreshToken = server.refresh;
});

describe("an expired access token", () => {
  it("is renewed once when every request on the screen finds it expired at the same time", async () => {
    const replies = await Promise.all([
      api("/me/summary"),
      api("/me/notifications"),
      api("/wall"),
    ]);

    expect(replies).toEqual([
      { path: "/me/summary" },
      { path: "/me/notifications" },
      { path: "/wall" },
    ]);
    expect(server.refreshes).toEqual([issuedRefresh]);
    expect(mockSession.accessToken).toBe(server.access);
    expect(mockSession.refreshToken).toBe(server.refresh);
  });

  it("is not renewed again by a request whose 401 arrives after the renewal finished", async () => {
    let release = () => {};
    server.holds.set(
      "/slow",
      new Promise((resolve) => {
        release = resolve;
      }),
    );
    const slow = api("/slow"); // sent with the expired token; its 401 comes back late
    await expect(api("/fast")).resolves.toEqual({ path: "/fast" }); // meets the expiry, renews
    release();

    await expect(slow).resolves.toEqual({ path: "/slow" });
    expect(server.refreshes).toEqual([issuedRefresh]);
  });

  it("never spends a refresh token twice, even for a request that read it a moment too early", async () => {
    const expired = mockSession.accessToken;
    await api("/first");
    const renewed = server.access;

    // What a read of the keychain just before the renewal was saved would still see.
    mockSession.accessToken = expired;
    mockSession.refreshToken = issuedRefresh;
    await expect(api("/second")).resolves.toEqual({ path: "/second" });

    expect(server.refreshes).toEqual([issuedRefresh]);
    expect(server.access).toBe(renewed);
  });
});

describe("a renewal that does not succeed", () => {
  it("ends the session when the server refuses the refresh token, and says so once", async () => {
    server.refreshMode = "refuse";
    const ended = jest.fn();
    const stop = onSessionEnded(ended);

    const failures = await Promise.all([failureOf(api("/a")), failureOf(api("/b"))]);
    stop();

    expect(failures.map((err) => err.status)).toEqual([401, 401]);
    expect(server.refreshes).toEqual([issuedRefresh]);
    expect(ended).toHaveBeenCalledTimes(1);
    expect(mockSession.accessToken).toBeNull();
    expect(mockSession.refreshToken).toBeNull();
  });

  it("signs nobody out when there is no connection, and tries the same token again later", async () => {
    server.refreshMode = "offline";
    const ended = jest.fn();
    const stop = onSessionEnded(ended);

    const failure = await failureOf(api("/a"));
    expect(failure.status).toBe(0);
    expect(failure.code).toBe("network");
    expect(ended).not.toHaveBeenCalled();
    expect(mockSession.refreshToken).toBe(issuedRefresh);

    server.refreshMode = "rotate";
    await expect(api("/a")).resolves.toEqual({ path: "/a" });
    stop();
    expect(server.refreshes).toEqual([issuedRefresh, issuedRefresh]);
    expect(ended).not.toHaveBeenCalled();
  });

  it("signs nobody out when the server fails", async () => {
    server.refreshMode = "fail";
    const ended = jest.fn();
    const stop = onSessionEnded(ended);

    expect((await failureOf(api("/a"))).status).toBe(503);
    stop();
    expect(ended).not.toHaveBeenCalled();
    expect(mockSession.refreshToken).toBe(issuedRefresh);
  });
});

describe("every request", () => {
  it("names the operator and the client, and carries the token unless it is anonymous", async () => {
    mockSession.accessToken = server.access;
    await api("/me");
    // The fake server refuses it (no token), which is fine: only what was sent matters here.
    await failureOf(api("/auth/login", { method: "POST", body: { eid: "2741001", password: "x" }, anonymous: true }));

    const calls = (globalThis.fetch as jest.Mock).mock.calls as [string, RequestInit][];
    const [signedIn, anonymous] = calls.map(([, init]) => init.headers as Record<string, string>);
    expect(signedIn).toMatchObject({ "x-tenant": "demo", "x-client": "app", authorization: `Bearer ${server.access}` });
    expect(anonymous).toMatchObject({ "x-tenant": "demo", "x-client": "app", "content-type": "application/json" });
    expect(anonymous).not.toHaveProperty("authorization");
  });
});
