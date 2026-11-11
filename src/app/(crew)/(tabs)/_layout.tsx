import { Tabs } from "expo-router/js-tabs";

import { colors, TabBar, type TabItem } from "@/components/ui";
import { useAuth } from "@/lib/auth";

/** The crew's five places (`.m-nav`): Home, Wall, Give (the raised red button), Rewards,
 *  Profile. Who gets here is decided one level up, by the group's gate. */
export default function CrewTabs() {
  const { t } = useAuth();

  const items: TabItem[] = [
    { name: "index", label: t("nav.home"), icon: "home" },
    { name: "wall", label: t("nav.wall"), icon: "chat" },
    { name: "give", label: t("nav.give"), icon: "send", primary: true },
    { name: "rewards", label: t("nav.rewards"), icon: "gift" },
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
      <Tabs.Screen name="rewards" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
