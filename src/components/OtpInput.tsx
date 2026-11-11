import { useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { colors, controlHeight, fonts, radius, shadow, T } from "@/components/ui";

/**
 * Six cells for a texted code (`.otp` in the prototype). One real input sits over the cells,
 * so the phone's one-time-code autofill and a paste both fill the whole code, and a screen
 * reader hears a single labelled field rather than six.
 */
export function OtpInput({
  value,
  onChange,
  label,
  hint,
  length = 6,
  invalid,
  disabled,
  onSubmit,
}: {
  value: string;
  onChange(next: string): void;
  label: string;
  hint?: string;
  length?: number;
  invalid?: boolean;
  disabled?: boolean;
  onSubmit?(): void;
}) {
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      accessible={false}
      onPress={() => input.current?.focus()}
      style={styles.row}
      importantForAccessibility="no"
    >
      {Array.from({ length }, (_, index) => {
        const current = focused && index === Math.min(value.length, length - 1);
        return (
          <View
            key={index}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            style={[
              styles.cell,
              current
                ? { borderColor: colors.brand, boxShadow: shadow.focus }
                : { borderColor: invalid ? colors.brand : colors.controlBorder },
            ]}
          >
            <T size={24} weight={900} tabular>
              {value[index] ?? ""}
            </T>
          </View>
        );
      })}
      <TextInput
        ref={input}
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, "").slice(0, length))}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        autoFocus
        editable={!disabled}
        caretHidden
        accessibilityLabel={label}
        accessibilityHint={hint}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSubmitEditing={onSubmit}
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  cell: {
    flex: 1,
    maxWidth: 56,
    height: controlHeight.otpCell,
    borderRadius: radius.control,
    borderWidth: 1.5,
    backgroundColor: colors.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  // Covers the cells so a tap anywhere lands in it, but draws nothing itself.
  hidden: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    color: "transparent",
    opacity: 0.02,
    fontFamily: fonts[400],
  },
});
