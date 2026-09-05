import { StyleSheet, View, type ViewStyle } from "react-native";

import { avatarColorFor, avatarFont, colors, touchTarget } from "../theme";
import { Text } from "./Text";

export interface AvatarProps {
  memberAlias: string;
  initials: string;
  size?: number;
  stale?: boolean;
  style?: ViewStyle;
}

export function Avatar({
  memberAlias,
  initials,
  size = touchTarget,
  stale = false,
  style,
}: AvatarProps) {
  const backgroundColor = stale ? colors.avatarStale : avatarColorFor(memberAlias);
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor },
        style,
      ]}
    >
      <Text role="headline" color={colors.bg.surface} style={{ fontSize: avatarFont(size) }}>
        {initials}
      </Text>
    </View>
  );
}

const MAX_STACKED = 4;

export interface AvatarStackProps {
  members: { memberAlias: string; initials: string; stale?: boolean }[];
  size?: number;
}

export function AvatarStack({ members, size = 32 }: AvatarStackProps) {
  const shown = members.slice(0, MAX_STACKED);
  const overflow = members.length - shown.length;

  return (
    <View style={styles.stack}>
      {shown.map((member, index) => (
        <Avatar
          key={member.memberAlias}
          memberAlias={member.memberAlias}
          initials={member.initials}
          stale={member.stale}
          size={size}
          style={{
            marginLeft: index === 0 ? 0 : -size * 0.3,
            borderWidth: 2,
            borderColor: colors.bg.surface,
          }}
        />
      ))}
      {overflow > 0 ? (
        <View
          style={[
            styles.circle,
            styles.overflow,
            { width: size, height: size, borderRadius: size / 2, marginLeft: -size * 0.3 },
          ]}
        >
          <Text role="footnote" color={colors.text.secondary}>
            +{overflow}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: "center", justifyContent: "center" },
  stack: { flexDirection: "row", alignItems: "center" },
  overflow: { backgroundColor: colors.bg.fill },
});
