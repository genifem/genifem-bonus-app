import type { ReactNode } from "react";

import { AppHeader } from "@/components/AppHeader";
import { Mascot, type MascotPose } from "@/components/Mascot";
import { Body, EmptyState, Page, ScreenTitle } from "@/components/ui";
import { useAuth } from "@/lib/auth";

/**
 * A tab that is not built yet: the header every tab has, its real title from the prototype,
 * and the mascot saying the screen arrives in a later phase. `children` sit under the empty
 * state.
 */
export function PlaceholderTab({
  title,
  lead,
  pose = "wave",
  children,
}: {
  title: string;
  lead?: string;
  pose?: MascotPose;
  children?: ReactNode;
}) {
  const { t } = useAuth();
  return (
    <Page>
      <Body>
        <AppHeader />
        <ScreenTitle title={title} lead={lead} />
        <EmptyState art={<Mascot pose={pose} size={110} />} title={t("soon.title")} lead={t("soon.lead")} />
        {children}
      </Body>
    </Page>
  );
}
