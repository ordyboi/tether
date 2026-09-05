import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { authClient } from "../auth/client";
import { Button, Text } from "../components";
import { colors, spacing } from "../theme";

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const [error, setError] = useState<string | null>(null);

  async function withErrorHandling(action: () => Promise<unknown>, failureMessage: string) {
    setError(null);
    try {
      await action();
    } catch {
      setError(failureMessage);
    }
  }

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <View style={styles.header}>
        <Text role="largeTitle">Tether</Text>
        <Text role="body" color={colors.text.secondary}>
          Share your location privately with people you trust.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          label="Continue with Apple"
          onPress={() =>
            withErrorHandling(
              () => authClient.signIn.social({ provider: "apple", callbackURL: "tether://" }),
              "Apple sign-in failed. Try again.",
            )
          }
        />
        <Button
          label="Continue with Google"
          variant="secondary"
          onPress={() =>
            withErrorHandling(
              () => authClient.signIn.social({ provider: "google", callbackURL: "tether://" }),
              "Google sign-in failed. Try again.",
            )
          }
        />
        <Button
          label="Continue with a passkey"
          variant="secondary"
          onPress={() =>
            withErrorHandling(
              () => authClient.signIn.passkey(),
              "Passkeys aren't set up on this device yet.",
            )
          }
        />
        <Button
          label="Continue without an account"
          variant="plain"
          onPress={() =>
            withErrorHandling(() => authClient.signIn.anonymous(), "Couldn't continue. Try again.")
          }
        />
      </View>

      {error ? (
        <Text role="footnote" color={colors.text.secondary}>
          {error}
        </Text>
      ) : null}

      <Text role="footnote" color={colors.text.tertiary} style={styles.footnote}>
        Room names and the names of people in them are encrypted on your phone. We can&apos;t read
        them.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: spacing.gutter,
    backgroundColor: colors.bg.app,
  },
  header: { gap: spacing.sm },
  actions: { gap: spacing.md },
  footnote: { textAlign: "center" },
});
