/**
 * One Idempotency-Key per send intent (plan D13, acceptance test 22): a retry of the same
 * draft after an unknown outcome reuses the key, so the coins can never go twice; anything
 * the server answered ends the intent.
 */
import { ApiError } from "@/lib/apiError";
import { afterAttempt, fingerprintOf, intentFor, outcomeUnknown, uuid4 } from "@/lib/idempotency";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function counter() {
  let n = 0;
  return () => `key-${++n}`;
}

const draft = fingerprintOf({ to: "p1", tag: "guest", coins: 10, message: null });

describe("uuid4", () => {
  it("is a version-4 UUID", () => {
    expect(uuid4()).toMatch(UUID);
    expect(uuid4(() => 0)).toBe("00000000-0000-4000-8000-000000000000");
    expect(uuid4(() => 255)).toMatch(UUID);
  });

  it("is different every time", () => {
    const keys = new Set(Array.from({ length: 200 }, () => uuid4()));
    expect(keys.size).toBe(200);
  });
});

describe("intentFor", () => {
  it("gives a first tap a new key", () => {
    const next = counter();
    expect(intentFor(null, draft, next)).toEqual({ key: "key-1", fingerprint: draft });
  });

  it("reuses the open intent for the same draft", () => {
    const next = counter();
    const first = intentFor(null, draft, next);
    expect(intentFor(first, draft, next)).toBe(first);
  });

  it("starts a new intent when the draft changed", () => {
    const next = counter();
    const first = intentFor(null, draft, next);
    const other = fingerprintOf({ to: "p1", tag: "guest", coins: 15, message: null });
    expect(intentFor(first, other, next).key).toBe("key-2");
  });
});

describe("fingerprintOf", () => {
  it("is the same for the same fields in any order, and differs on any field", () => {
    expect(fingerprintOf({ a: 1, b: "x" })).toBe(fingerprintOf({ b: "x", a: 1 }));
    expect(fingerprintOf({ to: "p1", message: null })).not.toBe(fingerprintOf({ to: "p1", message: "hi" }));
    expect(fingerprintOf({ coins: 1 })).not.toBe(fingerprintOf({ coins: "1" }));
  });
});

describe("afterAttempt", () => {
  const intent = { key: "key-1", fingerprint: draft };

  it("keeps the intent when the outcome is unknown, so a retry reuses the key", () => {
    expect(afterAttempt(intent, new ApiError(0, "network", "no connection"))).toBe(intent);
    expect(afterAttempt(intent, new ApiError(502, "http_502", "bad gateway"))).toBe(intent);
    expect(afterAttempt(intent, new ApiError(408, "http_408", "timeout"))).toBe(intent);
    expect(afterAttempt(intent, new TypeError("boom"))).toBe(intent);
  });

  it("ends the intent after a success or a clear refusal", () => {
    expect(afterAttempt(intent, null)).toBeNull();
    expect(afterAttempt(intent, new ApiError(409, "kudos_insufficient", "no"))).toBeNull();
    expect(afterAttempt(intent, new ApiError(422, "amount_not_allowed", "no"))).toBeNull();
    expect(afterAttempt(intent, new ApiError(403, "not_in_scope", "no"))).toBeNull();
  });

  it("walks a whole send: offline, retried with the same key, then sent, then a new key", () => {
    const next = counter();
    let open = intentFor(null, draft, next);
    const firstKey = open.key;
    open = afterAttempt(open, new ApiError(0, "network", "offline"))!;
    const retry = intentFor(open, draft, next);
    expect(retry.key).toBe(firstKey);
    const closed = afterAttempt(retry, null);
    expect(intentFor(closed, draft, next).key).not.toBe(firstKey);
  });
});

describe("outcomeUnknown", () => {
  it("is true only when the server may have acted unheard", () => {
    expect(outcomeUnknown(new ApiError(0, "network", ""))).toBe(true);
    expect(outcomeUnknown(new ApiError(500, "http_500", ""))).toBe(true);
    expect(outcomeUnknown(new ApiError(429, "rate_limited", ""))).toBe(false);
    expect(outcomeUnknown(new ApiError(401, "http_401", ""))).toBe(false);
  });
});
