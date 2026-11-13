import type { Schemas } from "@crewstars/api-client";

import storage from "@/lib/storage";

/**
 * The operator this app is talking to (plan D3, P7: one app for every operator).
 *
 * Crew pick their company once, with a company code: the operator's slug, the same word as
 * its portal's address (`{slug}.stars.genifem.com`). The company screen checks it with
 * `GET /meta` before it is kept, and from then on it is sent as X-Tenant on every request.
 * Signing out keeps it; only "Not your company? Change" (or the API saying the operator is
 * gone) lets it go.
 *
 * EXPO_PUBLIC_TENANT is only a default now: a build that sets it (development, or a build
 * made for one operator) starts on that company without asking, and the code field starts
 * with it filled in. Preview and production builds leave it unset, so the screen shows.
 *
 * The code is not a secret, so it lives in the app's plain storage (storage.ts), never in the
 * keychain. It is read before the first request of a launch (auth.tsx), and held here in
 * memory, so api.ts names the operator without waiting on storage for every call.
 */

/** What `GET /meta` answers: whose app this is. */
export type MetaOut = Schemas["MetaOut"];

/** The company this phone is set up for. The name and logo are kept to show it offline. */
export interface Company {
  /** The slug, lower case: what X-Tenant carries. */
  code: string;
  name: string | null;
  logoUrl: string | null;
}

/** The API's slug rule (org.models SLUG_RE): 1 to 32 lower-case letters, digits and dashes,
 *  starting and ending with a letter or digit. */
export const COMPANY_CODE_MAX = 32;
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

/**
 * What was typed (or pasted) as a company code, the way the API stores it: lower case, with
 * anything but letters, digits and dashes dropped. "ECC", " ecc " and "E.C.C" are all `ecc`.
 * The field shows it in capitals, as managers write it, but the code itself is case-blind.
 */
export function normaliseCompanyCode(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, COMPANY_CODE_MAX);
}

/** Whether a normalised code could be an operator's: Continue stays off until it is. */
export function isCompanyCode(value: string): boolean {
  return SLUG.test(value);
}

/** The build's default company (EXPO_PUBLIC_TENANT), when it names one properly. */
export function defaultCompanyCode(): string | null {
  const configured = normaliseCompanyCode(process.env.EXPO_PUBLIC_TENANT ?? "");
  return isCompanyCode(configured) ? configured : null;
}

/** The company `/meta` described, as the app keeps it. */
export function companyOf(meta: Pick<MetaOut, "tenant" | "name" | "logo_url">): Company {
  return { code: meta.tenant, name: meta.name || null, logoUrl: meta.logo_url || null };
}

/** A saved company, or null for anything that is not one (nothing saved, an older format,
 *  a code the API would refuse). */
export function companyFrom(raw: string | null): Company | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown> | null;
    if (typeof value !== "object" || value === null) return null;
    const { code, name, logoUrl } = value;
    if (typeof code !== "string" || !isCompanyCode(code)) return null;
    return {
      code,
      name: typeof name === "string" && name ? name : null,
      logoUrl: typeof logoUrl === "string" && logoUrl ? logoUrl : null,
    };
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------- the one in use */

let active: string | null = null;

/** The slug every request names in X-Tenant, or null before a company is chosen (the API
 *  then refuses the call, which only the company screen's own check could make, and it
 *  names its code itself). */
export function tenantSlug(): string | null {
  return active;
}

/** Point every request from now on at this company, or at none. */
export function setActiveCompany(code: string | null): void {
  active = code;
}

/* ---------------------------------------------------------------- on the phone */

const COMPANY = "cs_company";

export async function loadCompany(): Promise<Company | null> {
  try {
    return companyFrom(await storage.getItem(COMPANY));
  } catch {
    return null; // unreadable storage: the company screen asks again
  }
}

export async function saveCompany(company: Company | null): Promise<void> {
  try {
    if (company) await storage.setItem(COMPANY, JSON.stringify(company));
    else await storage.removeItem(COMPANY);
  } catch {
    // Only the next launch misses it, and asks for the code again.
  }
}

/**
 * The company to open with: the one chosen on this phone, else the build's default, else
 * none (the company screen). The default is not saved, so it is never mistaken for a choice:
 * a later build without one still asks. Whichever it is becomes the one in use.
 */
export async function restoreCompany(): Promise<Company | null> {
  const fallback = defaultCompanyCode();
  const company = (await loadCompany()) ?? (fallback ? { code: fallback, name: null, logoUrl: null } : null);
  setActiveCompany(company?.code ?? null);
  return company;
}
