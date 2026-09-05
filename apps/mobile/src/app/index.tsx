import { Redirect } from "expo-router";
import { View } from "react-native";

import { Text } from "../components";
import { useRoom } from "../data/useRoom";
import { colors } from "../theme";

export default function Index() {
  const { room, loading, error } = useRoom();

  if (loading || !room) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.bg.app,
        }}
      >
        <Text role="body" color={colors.text.secondary}>
          {error ? error.message : "Setting up your room…"}
        </Text>
      </View>
    );
  }

  return <Redirect href={{ pathname: "/room/[roomId]", params: { roomId: room.roomId } }} />;
}
