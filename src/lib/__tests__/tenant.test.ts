/**
 * One operator per build (plan D3): the slug comes from EXPO_PUBLIC_TENANT, `demo` stands in
 * for it in development, and a release build without one names no tenant at all.
 */
// babel-preset-expo reads EXPO_PUBLIC_ variables through this module, which jest cannot load.
jest.mock("expo/virtual/env", () => ({ env: process.env }));

const globals = globalThis as unknown as { __DEV__: boolean };

function load(): typeof import("@/lib/tenant") {
  let mod!: typeof import("@/lib/tenant");
  jest.isolateModules(() => {
    mod = jest.requireActual("@/lib/tenant");
  });
  return mod;
}

describe("tenantSlug", () => {
  const original = process.env.EXPO_PUBLIC_TENANT;

  afterEach(() => {
    if (original === undefined) delete process.env.EXPO_PUBLIC_TENANT;
    else process.env.EXPO_PUBLIC_TENANT = original;
  });

  it("uses the configured operator, normalised", () => {
    globals.__DEV__ = false;
    process.env.EXPO_PUBLIC_TENANT = "  Acme ";
    expect(load().tenantSlug()).toBe("acme");
  });

  it("falls back to the demo tenant in development only", () => {
    delete process.env.EXPO_PUBLIC_TENANT;
    globals.__DEV__ = true;
    expect(load().tenantSlug()).toBe("demo");
    globals.__DEV__ = false;
    expect(load().tenantSlug()).toBeNull();
  });
});
