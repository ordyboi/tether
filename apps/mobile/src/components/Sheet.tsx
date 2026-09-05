import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, radii, spacing } from "../theme";
import { Icon } from "./Icon";
import { Text } from "./Text";

export interface SheetProps {
  title: string;
  onClose?: () => void;
  children?: ReactNode;
}

export function Sheet({ title, onClose, children }: SheetProps) {
  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <Text role="title">{title}</Text>
        {onClose ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose}>
            <Icon name="close" size={20} color={colors.text.tertiary} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: colors.bg.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
});
