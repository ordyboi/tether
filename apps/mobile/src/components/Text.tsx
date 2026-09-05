import { Text as RNText, type TextProps as RNTextProps } from "react-native";

import { colors, type TypeRole, type } from "../theme";

export interface TextProps extends Omit<RNTextProps, "role"> {
  role?: TypeRole;
  color?: string;
}

export function Text({ role = "body", color = colors.text.primary, style, ...rest }: TextProps) {
  const roleStyle = type[role];
  return (
    <RNText
      style={[
        {
          color,
          fontSize: roleStyle.fontSize,
          fontWeight: roleStyle.fontWeight,
          letterSpacing: roleStyle.letterSpacing,
          textTransform: roleStyle.textTransform,
        },
        style,
      ]}
      {...rest}
    />
  );
}
