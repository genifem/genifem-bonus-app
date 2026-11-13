/**
 * The company code (P7): what a typed code becomes and which codes can be sent, the build's
 * optional default (EXPO_PUBLIC_TENANT), and keeping the choice in the app's plain storage,
 * tested against a fake store. The choice beats the default, the default is never mistaken
 * for a choice, and whatever opens the app is the one every request names.
 */
import {
  type Company,
  COMPANY_CODE_MAX,
  companyFrom,
  companyOf,
  defaultCompanyCode,
  isCompanyCode,
  loadCompany,
  normaliseCompanyCode,
  restoreCompany,
  saveCompany,
  setActiveCompany,
  tenantSlug,
} from "@/lib/tenant";

// babel-preset-expo reads EXPO_PUBLIC_ variables through this module, which jest cannot load.
jest.mock("expo/virtual/env", () => ({ env: process.env }));

const mockStore = new Map<string, string>();
const mockBroken = { now: false };

function mockReach() {
  if (mockBroken.now) throw new Error("storage unavailable");
}

jest.mock("@/lib/storage", () => ({
  __esModule: true,
  default: {
    getItem: async (key: string) => {
      mockReach();
      return mockStore.get(key) ?? null;
    },
    setItem: async (key: string, value: string) => {
      mockReach();
      mockStore.set(key, value);
    },
    removeItem: async (key: string) => {
      mockReach();
      mockStore.delete(key);
    },
  },
}));

const globals = globalThis as unknown as { __DEV__: boolean };
const original = process.env.EXPO_PUBLIC_TENANT;

const ECC: Company = { code: "ecc", name: "ECC Restaurants", logoUrl: "https://cdn.example.com/ecc.png" };

beforeEach(() => {
  mockStore.clear();
  mockBroken.now = false;
  delete process.env.EXPO_PUBLIC_TENANT;
  setActiveCompany(null);
});

afterAll(() => {
  if (original === undefined) delete process.env.EXPO_PUBLIC_TENANT;
  else process.env.EXPO_PUBLIC_TENANT = original;
});

describe("a typed company code", () => {
  it("is the slug whatever the case or the spaces around it", () => {
    expect(normaliseCompanyCode("ECC")).toBe("ecc");
    expect(normaliseCompanyCode("  Ecc ")).toBe("ecc");
    expect(normaliseCompanyCode("Crew-Stars-2")).toBe("crew-stars-2");
  });

  it("drops what a slug can't hold: spaces inside, dots, underscores, accents, emoji", () => {
    expect(normaliseCompanyCode("E.C.C")).toBe("ecc");
    expect(normaliseCompanyCode("crew stars")).toBe("crewstars");
    expect(normaliseCompanyCode("crew_stars")).toBe("crewstars");
    expect(normaliseCompanyCode("Café⭐")).toBe("caf");
  });

  it("stops at the longest slug the API allows", () => {
    expect(normaliseCompanyCode("a".repeat(40))).toHaveLength(COMPANY_CODE_MAX);
  });
});

describe("which codes can be sent", () => {
  it.each(["ecc", "a", "7", "a1", "crew-stars", "demo", "a".repeat(32)])("%s can", (code) => {
    expect(isCompanyCode(code)).toBe(true);
  });

  it.each(["", "-ecc", "ecc-", "-", "a".repeat(33), "ECC", "e_c", "e c"])("%j can't", (code) => {
    expect(isCompanyCode(code)).toBe(false);
  });

  it("can't start or end on a dash while it is still being typed", () => {
    expect(isCompanyCode(normaliseCompanyCode("crew-"))).toBe(false);
    expect(isCompanyCode(normaliseCompanyCode("crew-s"))).toBe(true);
  });
});

describe("the build's default company (EXPO_PUBLIC_TENANT)", () => {
  it("is the configured code, normalised", () => {
    process.env.EXPO_PUBLIC_TENANT = "  ECC ";
    expect(defaultCompanyCode()).toBe("ecc");
  });

  it("is none when unset or not a code, in development too: there is no quiet demo any more", () => {
    globals.__DEV__ = true;
    expect(defaultCompanyCode()).toBeNull();
    process.env.EXPO_PUBLIC_TENANT = "-";
    expect(defaultCompanyCode()).toBeNull();
    globals.__DEV__ = false;
    expect(defaultCompanyCode()).toBeNull();
  });
});

describe("the company /meta describes", () => {
  it("keeps its slug, name and logo", () => {
    expect(companyOf({ tenant: "ecc", name: "ECC Restaurants", logo_url: "https://cdn.example.com/ecc.png" })).toEqual(
      ECC,
    );
  });

  it("keeps no empty name or logo", () => {
    expect(companyOf({ tenant: "ecc", name: "", logo_url: null })).toEqual({ code: "ecc", name: null, logoUrl: null });
  });
});

describe("a saved company", () => {
  it("reads back what was saved", () => {
    expect(companyFrom(JSON.stringify(ECC))).toEqual(ECC);
    expect(companyFrom(JSON.stringify({ code: "demo" }))).toEqual({ code: "demo", name: null, logoUrl: null });
  });

  it("is nothing for what can't be one", () => {
    expect(companyFrom(null)).toBeNull();
    expect(companyFrom("")).toBeNull();
    expect(companyFrom("ecc")).toBeNull(); // not JSON
    expect(companyFrom("null")).toBeNull();
    expect(companyFrom("[]")).toBeNull();
    expect(companyFrom(JSON.stringify({ code: "ECC" }))).toBeNull();
    expect(companyFrom(JSON.stringify({ code: "-ecc", name: "ECC" }))).toBeNull();
    expect(companyFrom(JSON.stringify({ name: "ECC" }))).toBeNull();
  });

  it("drops a name or a logo of the wrong kind rather than the company", () => {
    expect(companyFrom(JSON.stringify({ code: "ecc", name: 3, logoUrl: {} }))).toEqual({
      code: "ecc",
      name: null,
      logoUrl: null,
    });
  });
});

describe("keeping the company on the phone", () => {
  it("saves and loads it, and forgets it", async () => {
    await saveCompany(ECC);
    expect(await loadCompany()).toEqual(ECC);
    await saveCompany(null);
    expect(await loadCompany()).toBeNull();
    expect(mockStore.size).toBe(0);
  });

  it("never throws when storage can't be reached: the screen just asks again", async () => {
    mockBroken.now = true;
    await expect(saveCompany(ECC)).resolves.toBeUndefined();
    await expect(loadCompany()).resolves.toBeNull();
  });
});

describe("opening the app", () => {
  it("names no company before one is chosen", async () => {
    expect(await restoreCompany()).toBeNull();
    expect(tenantSlug()).toBeNull();
  });

  it("opens on the company chosen on this phone, and names it on every request", async () => {
    await saveCompany(ECC);
    expect(await restoreCompany()).toEqual(ECC);
    expect(tenantSlug()).toBe("ecc");
  });

  it("opens on the build's default when nothing was chosen, without saving it as a choice", async () => {
    process.env.EXPO_PUBLIC_TENANT = "demo";
    expect(await restoreCompany()).toEqual({ code: "demo", name: null, logoUrl: null });
    expect(tenantSlug()).toBe("demo");
    expect(await loadCompany()).toBeNull();
  });

  it("prefers the choice made on this phone to the build's default", async () => {
    process.env.EXPO_PUBLIC_TENANT = "demo";
    await saveCompany(ECC);
    expect((await restoreCompany())?.code).toBe("ecc");
    expect(tenantSlug()).toBe("ecc");
  });

  it("falls back to the default when what was saved is unreadable", async () => {
    process.env.EXPO_PUBLIC_TENANT = "demo";
    mockStore.set("cs_company", "{not json");
    expect((await restoreCompany())?.code).toBe("demo");
  });
});

describe("the company in use", () => {
  it("is what was set last, or none", () => {
    setActiveCompany("ecc");
    expect(tenantSlug()).toBe("ecc");
    setActiveCompany(null);
    expect(tenantSlug()).toBeNull();
  });
});
