import { Stack } from "expo-router";

import { useSession } from "../data/useSession";

export default function RootLayout() {
  const { data, isPending } = useSession();
  if (isPending) return null;

  const signedIn = data !== null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="index" />
        <Stack.Screen name="room/[roomId]" />
        <Stack.Screen name="join/[token]" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}
