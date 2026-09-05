import { SymbolView } from "expo-symbols";

import { colors } from "../theme";

const ICON_NAMES = {
  chevronLeft: { ios: "chevron.left", android: "chevron_left" },
  chevronRight: { ios: "chevron.right", android: "chevron_right" },
  close: { ios: "xmark", android: "close" },
  recentre: { ios: "location.fill", android: "my_location" },
  qrCode: { ios: "qrcode", android: "qr_code" },
  link: { ios: "link", android: "link" },
  copy: { ios: "doc.on.doc", android: "content_copy" },
  warning: { ios: "exclamationmark.triangle.fill", android: "warning" },
  checkmark: { ios: "checkmark", android: "check" },
} as const;

export type IconName = keyof typeof ICON_NAMES;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 24, color = colors.text.primary }: IconProps) {
  const symbol = ICON_NAMES[name];
  return (
    <SymbolView
      name={{ ios: symbol.ios, android: symbol.android, web: symbol.android }}
      size={size}
      tintColor={color}
      testID={`icon-${name}`}
    />
  );
}
