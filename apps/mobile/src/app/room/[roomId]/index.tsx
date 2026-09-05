import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AvatarStack, Icon, Pill, Text } from "../../../components";
import { useRoom } from "../../../data/useRoom";
import { defaultDisplayName, HOME_ROOM_NAME } from "../../../rooms/crypto";
import { colors, spacing, touchTarget } from "../../../theme";

export default function RoomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { room, loading, error, refresh } = useRoom();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  if (loading || !room) {
    return (
      <View style={styles.center}>
        <Text role="body" color={colors.text.secondary}>
          {error ? error.message : "Setting up your room…"}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.placeholder}>
        <Text role="footnote" color={colors.text.tertiary}>
          The map arrives in a later phase
        </Text>
      </View>

      <View style={[styles.topButtons, { top: insets.top + spacing.sm }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.circleButton}
          onPress={() => router.back()}
        >
          <Icon name="chevronLeft" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share"
          style={styles.circleButton}
          onPress={() =>
            router.push({ pathname: "/room/[roomId]/share", params: { roomId: room.roomId } })
          }
        >
          <Icon name="recentre" />
        </Pressable>
      </View>

      <Pill style={[styles.bottomBar, { bottom: insets.bottom + spacing.lg }]}>
        <AvatarStack
          members={[{ memberAlias: room.memberAlias, initials: defaultDisplayName().charAt(0) }]}
        />
        <View style={styles.bottomText}>
          <Text role="headline">{HOME_ROOM_NAME}</Text>
          <Text role="footnote" color={colors.text.tertiary}>
            {room.memberCount} {room.memberCount === 1 ? "member" : "members"}
          </Text>
        </View>
      </Pill>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.fill },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  topButtons: {
    position: "absolute",
    left: spacing.gutter,
    right: spacing.gutter,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  circleButton: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    backgroundColor: colors.bg.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomBar: {
    position: "absolute",
    left: spacing.gutter,
    right: spacing.gutter,
    gap: spacing.md,
  },
  bottomText: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg.app,
  },
});
