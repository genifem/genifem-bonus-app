import { useAuth } from "@/lib/auth";
import { firstName } from "@/lib/format";

import { PlaceholderTab } from "./Placeholder";

/** Home for the crew and for a GM: the greeting is the prototype's; the balance card, tiles
 *  and the manager's "this month" panel arrive in later phases. */
export function Home({ manager = false }: { manager?: boolean }) {
  const { t, me } = useAuth();
  const name = me ? firstName(me.name) : "";
  return (
    <PlaceholderTab
      title={name ? t("home.greeting", { name }) : t("home.greetingNoName")}
      lead={manager ? t("home.managerLead") : t("home.lead")}
      pose="coin"
    />
  );
}

export function CrewHome() {
  return <Home />;
}

export function ManagerHome() {
  return <Home manager />;
}
