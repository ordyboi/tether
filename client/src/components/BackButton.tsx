import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "@/utils/theme";

export function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onPress} hitSlop={8} style={styles.backButton}>
      <Text style={styles.backGlyph}>‹</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backButton: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  backGlyph: {
    fontSize: 26,
    fontWeight: "600",
    color: colors.text,
    marginTop: -2,
  },
});
