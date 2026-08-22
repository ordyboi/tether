import { Pressable, StyleSheet, Text } from "react-native";
import { colors, typography } from "@/utils/theme";

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  weight = "600",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  weight?: "400" | "600";
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.primaryButton, (pressed || disabled) && styles.pressed]}
    >
      <Text style={[styles.primaryLabel, { fontWeight: weight }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primaryButton: {
    height: 52,
    borderRadius: 4,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryLabel: {
    fontSize: typography.button.fontSize,
    fontWeight: "600",
    color: colors.onPrimary,
  },
  pressed: {
    opacity: 0.6,
  },
});
