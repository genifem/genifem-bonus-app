import { Tabs } from "expo-router/js-tabs";

import { colors, TabBar, type TabItem } from "@/components/ui";
import { useAuth } from "@/lib/auth";

/** The GM's five places (`.m-nav`, manager variant): Home, Wall, Give, Approvals, Profile.
 *  Approvals will carry the pending count as a badge once the requests endpoint lands. */
export default function ManagerTabs() {
  const { t } = useAuth();

  const items: TabItem[] = [
    { name: "index", label: t("nav.home"), icon: "home" },
    { name: "wall", label: t("nav.wall"), icon: "chat" },
    { name: "give", label: t("nav.give"), icon: "send", primary: true },
    { name: "approvals", label: t("nav.approvals"), icon: "approve" },
    { name: "profile", label: t("nav.profile"), icon: "user" },
  ];

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
      tabBar={(props) => <TabBar {...props} items={items} label={t("nav.label")} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="wall" />
      <Tabs.Screen name="give" />
      <Tabs.Screen name="approvals" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
