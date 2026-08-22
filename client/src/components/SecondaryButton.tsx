import { Pressable, StyleSheet, Text } from "react-native";
import { colors, typography } from "@/utils/theme";

export function SecondaryButton({
  label,
  onPress,
  shadow = false,
}: {
  label: string;
  onPress: () => void;
  shadow?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.secondaryButton, shadow && styles.secondaryButtonShadow, pressed && styles.pressed]}
    >
      <Text style={styles.secondaryLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  secondaryButton: {
    height: 52,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonShadow: {
    borderWidth: 0,
    shadowColor: "#B4B9C8",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  secondaryLabel: {
    fontSize: typography.button.fontSize,
    fontWeight: "600",
    color: colors.text,
  },
  pressed: {
    opacity: 0.6,
  },
});
