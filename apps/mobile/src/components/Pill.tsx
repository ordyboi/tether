import { View, StyleSheet, type ViewProps } from "react-native";

import { colors, radii, spacing } from "../theme";

export function Pill({ style, ...rest }: ViewProps) {
  return <View style={[styles.pill, style]} {...rest} />;
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: colors.bg.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
  },
});
