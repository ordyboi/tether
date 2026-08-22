import { StyleSheet, View } from "react-native";
import { BackButton } from "@/components/BackButton";
import { colors, spacing } from "@/utils/theme";

export function StepHeader({
  onBack,
  progress,
}: {
  onBack: () => void;
  progress?: readonly [boolean, boolean];
}) {
  return (
    <View style={styles.header}>
      <BackButton onPress={onBack} />
      {progress && (
        <View style={styles.progressRow}>
          <View style={[styles.progressSegment, progress[0] && styles.progressSegmentActive]} />
          <View style={[styles.progressSegment, progress[1] && styles.progressSegmentActive]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: spacing.headerToHeading,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  progressSegment: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.progressTrack,
  },
  progressSegmentActive: {
    backgroundColor: colors.progressActive,
  },
});
