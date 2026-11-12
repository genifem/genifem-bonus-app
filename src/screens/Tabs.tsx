import { useAuth } from "@/lib/auth";

import { PlaceholderTab } from "./Placeholder";

/** The rewards catalogue (crew tabs): arrives with P3. */
export function Rewards() {
  const { t } = useAuth();
  return <PlaceholderTab title={t("rewards.title")} lead={t("rewards.lead")} pose="coin" />;
}

/** Reward requests waiting for the GM (manager tabs): arrives with P3. */
export function Approvals() {
  const { t } = useAuth();
  return <PlaceholderTab title={t("approvals.title")} lead={t("approvals.lead")} pose="cheer" />;
}
