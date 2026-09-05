import { Stack } from "expo-router";

export default function RoomLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="share" options={{ presentation: "modal" }} />
    </Stack>
  );
}
