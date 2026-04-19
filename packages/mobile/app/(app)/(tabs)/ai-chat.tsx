import { TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AiChat() {
  return (
    <SafeAreaView
      style={{
        backgroundColor: "green",
        flex: 1,
      }}
    >
      <TextInput
        style={{
          backgroundColor: "blue",
          flex: 1,

          // justifyContent: "flex-end",
        }}
        multiline
      >
        AIe
      </TextInput>
    </SafeAreaView>
  );
}
