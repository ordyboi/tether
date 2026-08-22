import { StyleSheet, Text, View } from "react-native";
import { spacing, typography } from "@/utils/theme";

export function ScreenHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.headingBlock}>
      <Text style={styles.heading}>{title}</Text>
      <Text style={styles.subtext}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headingBlock: {
    gap: spacing.headingGap,
    marginBottom: spacing.headingGap,
  },
  heading: {
    fontSize: typography.heading.fontSize,
    fontWeight: typography.heading.fontWeight,
    letterSpacing: typography.heading.letterSpacing,
    lineHeight: typography.heading.lineHeight,
    color: typography.heading.color,
  },
  subtext: {
    fontSize: typography.subtext.fontSize,
    lineHeight: typography.subtext.lineHeight,
    color: typography.subtext.color,
  },
});
