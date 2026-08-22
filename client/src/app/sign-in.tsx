import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenHeading } from "@/components/ScreenHeading";
import { StepHeader } from "@/components/StepHeader";
import { TextField } from "@/components/TextField";
import { authStub, useAuth } from "@/utils/auth-stub";
import { colors, spacing } from "@/utils/theme";

export default function SignIn() {
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (session !== null) {
      router.replace("/home");
    }
  }, [session]);

  const submit = async () => {
    if (busy) {
      return;
    }
    if (email.trim().length === 0 || password.length === 0) {
      setError("Enter your email and password");
      return;
    }
    setBusy(true);
    const result = await authStub.signIn({ email, password });
    setBusy(false);
    if (result.error !== null) {
      setError(result.error.message);
      return;
    }
    setError(undefined);
    router.replace("/home");
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.stepTop }]}>
      <StepHeader onBack={() => router.back()} />
      <ScreenHeading
        title="Sign in to tether"
        subtitle="Share where you are with the people you choose. Nobody else, not even us."
      />

      <View style={styles.fields}>
        <TextField
          label="Email"
          accessibilityLabel="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          returnKeyType="next"
        />
        <TextField
          label="Password"
          accessibilityLabel="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      <View style={styles.spacer} />

      <PrimaryButton label={busy ? "Signing in…" : "Sign in"} disabled={busy} onPress={submit} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>No account yet? </Text>
        <Pressable accessibilityRole="link" onPress={() => router.push("/sign-up/name")}>
          <Text style={styles.footerLink}>Create one</Text>
        </Pressable>
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
  fields: {
    gap: spacing.headingGap,
  },
  error: {
    fontSize: 14,
    color: colors.errorText,
  },
  spacer: {
    flex: 1,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  footerText: {
    fontSize: 16,
    color: colors.text,
  },
  footerLink: {
    fontSize: 16,
    color: colors.primary,
    textDecorationLine: "underline",
  },
});
