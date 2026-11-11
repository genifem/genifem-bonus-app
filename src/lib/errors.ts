import type { Translator } from "@crewstars/i18n";

import { ApiError } from "@/lib/api";

/** What went wrong, in the person's language: the API's error code when the catalog has a
 *  message for it (`errors.<code>`), else the generic one. */
export function explain(t: Translator, err: unknown): string {
  const code = err instanceof ApiError ? err.code : "generic";
  return t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.generic");
}

/**
 * A failed sign-in, said one way whatever the cause (CR-02): which of the two was wrong is not
 * given away. Only a dead connection is told apart, since retrying is the fix for that one.
 */
export function explainSignIn(t: Translator, err: unknown): string {
  if (err instanceof ApiError && err.code === "network") return t("errors.network");
  return t("errors.invalid_credentials");
}
