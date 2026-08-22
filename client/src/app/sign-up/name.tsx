import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenHeading } from "@/components/ScreenHeading";
import { StepHeader } from "@/components/StepHeader";
import { TextField } from "@/components/TextField";
import { colors, spacing } from "@/utils/theme";

const HEADING = "What should we call you?";

export default function SignUpName() {
  const params = useLocalSearchParams<{ name?: string }>();
  const [name, setName] = useState(params.name ?? "");
  const [error, setError] = useState<string | undefined>(undefined);
  const insets = useSafeAreaInsets();

  const next = () => {
    if (name.trim().length === 0) {
      setError("Pick a name your friends will recognise");
      return;
    }
    setError(undefined);
    router.push({ pathname: "/sign-up/credentials", params: { name: name.trim() } });
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.stepTop }]}>
      <StepHeader onBack={() => router.back()} progress={[true, false]} />
      <ScreenHeading title={HEADING} subtitle="Friends see this name when you show up on their map. You can change it later." />

      <TextField
        accessibilityLabel={HEADING}
        value={name}
        onChangeText={setName}
        error={error}
        autoCapitalize="words"
        returnKeyType="next"
        onSubmitEditing={next}
      />

      <View style={styles.spacer} />

      <PrimaryButton label="Continue" onPress={next} />
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
  spacer: {
    flex: 1,
  },
});
