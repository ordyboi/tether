import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Banner, Button, Icon, Sheet, Text } from "../../../components";
import { useInvite } from "../../../data/useInvite";
import { useRoom } from "../../../data/useRoom";
import { colors, radii, spacing } from "../../../theme";

const QR_SIZE = 160;

export default function ShareScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { room, roomKey } = useRoom();
  const { link, loading, error } = useInvite(room, roomKey);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!link) return;
    await Clipboard.setStringAsync(link);
    setCopied(true);
  }

  return (
    <Sheet title="Share" onClose={() => router.back()}>
      <Text role="body" color={colors.text.secondary} style={styles.subtitle}>
        Anyone with this link can join your room.
      </Text>

      {loading ? <Text role="body">Creating your invite…</Text> : null}
      {error ? (
        <Text role="body" color={colors.text.secondary}>
          Couldn&apos;t create an invite. Try again.
        </Text>
      ) : null}

      {link ? (
        <>
          <View style={styles.qrWrap}>
            <QRCode value={link} size={QR_SIZE} />
          </View>

          <View style={styles.linkRow}>
            <Text role="body" numberOfLines={1} style={styles.linkText}>
              {link}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Copy link"
              onPress={copyLink}
              style={styles.copyChip}
            >
              <Icon name="copy" size={16} color={colors.accent} />
            </Pressable>
          </View>
          {copied ? (
            <Text role="footnote" color={colors.text.tertiary}>
              Copied
            </Text>
          ) : null}

          <Banner message="This link expires in 24 hours." />
        </>
      ) : null}

      <View style={[styles.footer, { paddingBottom: insets.bottom }]}>
        <Button label="Done" onPress={() => router.back()} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginBottom: spacing.lg },
  qrWrap: { alignItems: "center", marginVertical: spacing.xl },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  linkText: { flex: 1 },
  copyChip: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentTint,
  },
  footer: { marginTop: "auto" },
});
