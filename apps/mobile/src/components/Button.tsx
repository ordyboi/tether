import { Pressable, StyleSheet, type PressableProps } from "react-native";

import { colors, radii, spacing, touchTarget } from "../theme";
import { Text } from "./Text";

export type ButtonVariant = "primary" | "secondary" | "plain";

export interface ButtonProps extends Omit<PressableProps, "style"> {
  label: string;
  variant?: ButtonVariant;
}

export function Button({ label, variant = "primary", disabled, ...rest }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        variant === "plain" && styles.plain,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
      {...rest}
    >
      <Text role="headline" color={variant === "primary" ? colors.bg.surface : colors.accent}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.accentTint },
  plain: { backgroundColor: "transparent" },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
});
