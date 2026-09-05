import { StyleSheet, View } from "react-native";

import { colors, radii, spacing } from "../theme";
import { Icon } from "./Icon";
import { Text } from "./Text";

export interface BannerProps {
  message: string;
}

export function Banner({ message }: BannerProps) {
  return (
    <View style={styles.banner}>
      <Icon name="warning" size={16} color={colors.text.secondary} />
      <Text role="footnote" color={colors.text.secondary} style={styles.message}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.warningBg,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  message: { flex: 1 },
});
