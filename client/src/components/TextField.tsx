import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors, typography } from "@/utils/theme";

type TextFieldProps = {
  label?: string;
  accessibilityLabel: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
} & Pick<TextInputProps, "placeholder" | "secureTextEntry" | "autoCapitalize" | "autoCorrect" | "keyboardType" | "returnKeyType" | "onSubmitEditing">;

export function TextField({ label, accessibilityLabel, value, onChangeText, error, ...inputProps }: TextFieldProps) {
  const hasError = error && error.length > 0;
  return (
    <View style={styles.fieldGroup}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputBox, hasError && styles.inputBoxError]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          accessibilityLabel={accessibilityLabel}
          placeholderTextColor="#A8ACB2"
          autoCorrect={false}
          {...inputProps}
        />
      </View>
      {hasError && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: typography.label.fontSize,
    fontWeight: typography.label.fontWeight,
    color: typography.label.color,
  },
  inputBox: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 4,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  inputBoxError: {
    borderColor: colors.errorBorder,
  },
  input: {
    fontSize: 16,
    color: colors.text,
  },
  errorText: {
    fontSize: 14,
    color: colors.errorText,
  },
});
