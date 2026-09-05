import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type PressableProps } from "react-native";

import { colors, spacing, touchTarget } from "../theme";
import { Icon } from "./Icon";
import { Text } from "./Text";

export interface ListRowProps extends Omit<PressableProps, "style"> {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  showDisclosure?: boolean;
}

export function ListRow({
  title,
  subtitle,
  leading,
  showDisclosure = false,
  ...rest
}: ListRowProps) {
  return (
    <Pressable accessibilityRole="button" style={styles.row} {...rest}>
      {leading}
      <View style={styles.text}>
        <Text role="body">{title}</Text>
        {subtitle ? (
          <Text role="footnote" color={colors.text.tertiary}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {showDisclosure ? <Icon name="chevronRight" size={16} color={colors.text.tertiary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: touchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  text: { flex: 1 },
});
