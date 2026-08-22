import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenHeading } from "@/components/ScreenHeading";
import { StepHeader } from "@/components/StepHeader";
import { TextField } from "@/components/TextField";
import { authStub } from "@/utils/auth-stub";
import { colors, spacing } from "@/utils/theme";

export default function SignUpCredentials() {
  const params = useLocalSearchParams<{ name: string }>();
  const name = params.name ?? "";
  const firstName = name.trim().split(" ")[0] ?? "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [passwordError, setPasswordError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const insets = useSafeAreaInsets();

  const submit = async () => {
    if (busy) {
      return;
    }
    const nextEmailError = email.trim().includes("@") ? undefined : "Enter a valid email address";
    const nextPasswordError = password.length > 0 ? undefined : "Add a password";
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    if (nextEmailError || nextPasswordError) {
      return;
    }
    setBusy(true);
    const result = await authStub.signUp({ name, email, password });
    setBusy(false);
    if (result.error !== null) {
      setEmailError(result.error.message);
      return;
    }
    router.replace("/home");
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.stepTop }]}>
      <StepHeader onBack={() => router.push({ pathname: "/sign-up/name", params: { name } })} progress={[true, true]} />
      <ScreenHeading title={`Nice to meet you, ${firstName}`} subtitle="Now the details you'll sign in with." />

      <View style={styles.fields}>
        <TextField
          label="Email"
          accessibilityLabel="Email"
          value={email}
          onChangeText={setEmail}
          error={emailError}
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
          error={passwordError}
          secureTextEntry
          autoCapitalize="none"
          returnKeyType="done"
          onSubmitEditing={submit}
        />
      </View>

      <View style={styles.spacer} />

      <PrimaryButton label={busy ? "Creating account…" : "Create account"} disabled={busy} onPress={submit} />
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
  spacer: {
    flex: 1,
  },
});
