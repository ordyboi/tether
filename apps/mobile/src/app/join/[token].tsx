import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

import { Button, Text } from "../../components";
import { useJoin } from "../../data/useJoin";
import { colors, spacing } from "../../theme";

export default function JoinScreen() {
  const url = Linking.useURL();
  const router = useRouter();
  const { phase, roomId, error, confirm } = useJoin(url);

  useEffect(() => {
    if (phase === "success" && roomId) {
      router.replace({ pathname: "/room/[roomId]", params: { roomId } });
    }
  }, [phase, roomId, router]);

  return (
    <View style={styles.container}>
      {phase === "resolving" ? <Text role="body">Checking your invite…</Text> : null}

      {phase === "confirm" ? (
        <>
          <Text role="title">Join this room?</Text>
          <Button label="Join" onPress={confirm} />
        </>
      ) : null}

      {phase === "joining" ? <Text role="body">Joining…</Text> : null}

      {phase === "error" ? (
        <Text role="body" color={colors.text.secondary}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.gutter,
    backgroundColor: colors.bg.app,
  },
});
