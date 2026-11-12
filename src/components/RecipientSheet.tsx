import type { Schemas } from "@crewstars/api-client";
import { memo, useMemo, useState } from "react";
import { SectionList, StyleSheet, View } from "react-native";

import { Avatar, colors, Field, Icon, Sheet, T, Touchable } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { filterGroups } from "@/lib/recognition";

type PartyOut = Schemas["PartyOut"];
type RecipientGroup = Schemas["RecipientGroup"];

const PersonRow = memo(function PersonRow({
  person,
  selected,
  otherStore,
  onPick,
}: {
  person: PartyOut;
  selected: boolean;
  /** "Store 2815", for someone outside the sender's store (supervisors, directors). */
  otherStore: string | null;
  onPick: (person: PartyOut) => void;
}) {
  return (
    <Touchable
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel={otherStore ? `${person.name}, ${otherStore}` : person.name}
      aria-selected={selected}
      onPress={() => onPick(person)}
      style={[styles.row, selected && styles.rowSelected]}
    >
      <Avatar name={person.name} seed={person.id} size={36} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size={15} weight={800} numberOfLines={1}>
          {person.name}
        </T>
        {otherStore ? (
          <T size={12} color={colors.muted} numberOfLines={1}>
            {otherStore}
          </T>
        ) : null}
      </View>
      {selected ? <Icon name="check" size={20} color={colors.brandInk} stroke={2.6} /> : null}
    </Touchable>
  );
});

/**
 * Who to recognize (CR-20, plan D18): a searchable sheet of the people this person may
 * recognize, grouped by role, highest rank first, as `/give/context` sends them. A store can
 * have sixty crew and an area hundreds, so it is a virtualized list with a search on top
 * rather than a long select.
 */
export function RecipientSheet({
  visible,
  groups,
  selectedId,
  myStoreId,
  onPick,
  onClose,
}: {
  visible: boolean;
  groups: readonly RecipientGroup[];
  selectedId: string | null;
  myStoreId: string | null;
  onPick: (person: PartyOut) => void;
  onClose: () => void;
}) {
  const { t } = useAuth();
  const [query, setQuery] = useState("");
  const [wasVisible, setWasVisible] = useState(visible);
  // Each opening starts with the whole list.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setQuery("");
  }

  const sections = useMemo(
    () =>
      filterGroups(groups, query).map((group) => ({
        key: group.role,
        title: t(`roles.${group.role}.plural`),
        data: group.people,
      })),
    [groups, query, t],
  );

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      fill
      label={t("give.pickerTitle")}
      closeLabel={t("common.close")}
      title={t("give.pickerTitle")}
    >
      <View style={{ paddingBottom: 12 }}>
        <Field
          label={t("give.search")}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="search"
          accessory={
            <View style={{ paddingRight: 10 }}>
              <Icon name="search" size={20} color={colors.muted} />
            </View>
          }
        />
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(person) => person.id}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        style={{ flex: 1 }}
        renderSectionHeader={({ section }) => (
          <T size={12} weight={900} color={colors.muted} upper tracking={0.4} heading style={styles.groupTitle}>
            {section.title}
          </T>
        )}
        renderItem={({ item }) => (
          <PersonRow
            person={item}
            selected={item.id === selectedId}
            otherStore={
              item.store && item.store.id !== myStoreId ? t("give.otherStore", { number: item.store.number }) : null
            }
            onPick={onPick}
          />
        )}
        ListEmptyComponent={
          <T size={14} color={colors.muted} align="center" style={{ paddingVertical: 24 }}>
            {query.trim() ? t("give.noMatch", { query: query.trim() }) : t("give.nobody")}
          </T>
        }
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  groupTitle: { paddingTop: 12, paddingBottom: 6 },
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: 12,
  },
  rowSelected: { backgroundColor: colors.brandSubtle },
});
