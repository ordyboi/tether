import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LockIcon } from "@/components/LockIcon";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { useAuth } from "@/utils/auth-stub";
import { colors, spacing, typography } from "@/utils/theme";

export default function Landing() {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (session !== null) {
      router.replace("/home");
    }
  }, [session]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.bookendTop }]}>
      <View style={styles.headingBlock}>
        <Text style={styles.heading}>Know where your people are</Text>
        <Text style={styles.subtext}>
          Share your location with the handful of people you choose. Nobody else, not even us.
        </Text>
      </View>

      <View style={styles.spacer} />

      <View style={styles.actions}>
        <PrimaryButton label="Create an account" weight="400" onPress={() => router.push("/sign-up/name")} />
        <SecondaryButton label="I already have one" shadow onPress={() => router.push("/sign-in")} />
      </View>

      <View style={styles.footer}>
        <LockIcon />
        <Text style={styles.footerText}>End-to-end encrypted</Text>
      </View>
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
  headingBlock: {
    gap: spacing.headingGap,
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
  spacer: {
    flex: 1,
  },
  actions: {
    gap: 12,
    marginBottom: 24,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  footerText: {
    fontSize: 16,
    color: colors.primary,
  },
});
