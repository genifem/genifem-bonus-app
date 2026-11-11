/**
 * The operator this build belongs to (plan D3: multi-tenant-ready, single-tenant deployed).
 *
 * There is no pairing screen: the slug is baked in at build time from EXPO_PUBLIC_TENANT and
 * sent as X-Tenant on every request. In development an unset value means `demo`, the seeded
 * tenant; a release build without one sends no X-Tenant and the API refuses it, which is
 * louder than quietly talking to the demo data.
 */
export const DEV_TENANT = "demo";

export function tenantSlug(): string | null {
  const configured = process.env.EXPO_PUBLIC_TENANT?.trim().toLowerCase();
  if (configured) return configured;
  return __DEV__ ? DEV_TENANT : null;
}
