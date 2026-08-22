import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { SecondaryButton } from "@/components/SecondaryButton";
import { authStub, useAuth } from "@/utils/auth-stub";
import { colors, spacing, typography } from "@/utils/theme";

export default function Home() {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (session === null) {
      router.replace("/");
    }
  }, [session]);

  if (session === null) {
    return null;
  }

  const initial = session.name.charAt(0).toUpperCase();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.bookendTop }]}>
      <View style={styles.profileRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.profileText}>
          <Text style={styles.name}>{session.name}</Text>
          <Text style={styles.email}>{session.email}</Text>
        </View>
      </View>

      <View style={styles.spacer} />

      <SecondaryButton
        label="Sign out"
        shadow
        onPress={() => {
          authStub.signOut();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.screenHorizontal,
    paddingBottom: spacing.screenBottom,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "600",
    color: colors.background,
  },
  profileText: {
    gap: 4,
  },
  name: {
    fontSize: 24,
    fontWeight: typography.heading.fontWeight,
    letterSpacing: -0.03 * 24,
    color: colors.text,
  },
  email: {
    fontSize: 16,
    color: colors.text,
  },
  spacer: {
    flex: 1,
  },
});
