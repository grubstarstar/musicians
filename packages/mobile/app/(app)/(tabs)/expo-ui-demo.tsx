import {
  Button,
  ColorPicker,
  DatePicker,
  Gauge,
  Host,
  HStack,
  Picker,
  ProgressView,
  Slider,
  Stepper,
  Text as UIText,
  TextField,
  Toggle,
  VStack,
} from "@expo/ui/swift-ui";
import {
  background,
  frame,
  gaugeStyle,
  pickerStyle,
  tag,
} from "@expo/ui/swift-ui/modifiers";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ControlsDemo() {
  const router = useRouter();

  const [textValue, setTextValue] = useState("");
  const [toggleOn, setToggleOn] = useState(true);
  const [sliderValue, setSliderValue] = useState(0.4);
  const [stepperValue, setStepperValue] = useState(3);
  const [instrument, setInstrument] = useState<string>("Guitar");
  const [genre, setGenre] = useState<string>("Rock");
  const [date, setDate] = useState(new Date());
  const [color, setColor] = useState<string>("#6c63ff");
  const [buttonPresses, setButtonPresses] = useState(0);

  if (Platform.OS !== "ios") {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Text style={styles.title}>Controls Demo</Text>
        <Text style={styles.body}>
          This playground uses @expo/ui/swift-ui, which only renders on iOS. Run
          this screen on an iOS simulator or device.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
          <Text style={styles.title}>@expo/ui playground</Text>
        </View>

        <Section title="Button">
          <Host matchContents>
            <VStack spacing={8} alignment="leading">
              <Button
                label="Tap me"
                onPress={() => setButtonPresses((n) => n + 1)}
              />
              <Button
                label="Destructive"
                role="destructive"
                systemImage="trash"
                onPress={() => setButtonPresses(0)}
              />
            </VStack>
          </Host>
          <Text style={styles.caption}>
            Pressed {buttonPresses} time{buttonPresses === 1 ? "" : "s"}
          </Text>
        </Section>

        <Section title="TextField">
          <Host matchContents>
            <TextField
              placeholder="What's your band called?"
              defaultValue={textValue}
              onValueChange={setTextValue}
            />
          </Host>
          <Text style={styles.caption}>Value: {textValue || "(empty)"}</Text>
        </Section>

        <Section title="Toggle">
          <Host matchContents>
            <Toggle
              label="Push notifications"
              isOn={toggleOn}
              onIsOnChange={setToggleOn}
            />
          </Host>
        </Section>

        <Section title="Stepper">
          <Host matchContents>
            <Stepper
              label={`Band size: ${stepperValue}`}
              min={1}
              max={12}
              value={stepperValue}
              onValueChange={setStepperValue}
            />
          </Host>
        </Section>

        <Section title="Picker (wheel)">
          <Host matchContents>
            <Picker
              label="Instrument"
              selection={instrument}
              onSelectionChange={setInstrument}
              modifiers={[pickerStyle("wheel")]}
            >
              <UIText modifiers={[tag("Guitar")]}>Guitar</UIText>
              <UIText modifiers={[tag("Bass")]}>Bass</UIText>
              <UIText modifiers={[tag("Drums")]}>Drums</UIText>
              <UIText modifiers={[tag("Keys")]}>Keys</UIText>
              <UIText modifiers={[tag("Vocals")]}>Vocals</UIText>
            </Picker>
          </Host>
          <Text style={styles.caption}>Chosen: {instrument}</Text>
        </Section>

        <Section title="Picker (segmented)">
          <Host
            matchContents
            style={{
              alignSelf: "stretch",
              backgroundColor: "red",
            }}
          >
            <Picker
              selection={genre}
              onSelectionChange={setGenre}
              modifiers={[
                pickerStyle("menu"),
                background("blue"),
                frame({ maxWidth: Infinity, alignment: "leading" }),
              ]}
            >
              <UIText modifiers={[tag("Rock")]}>Rock</UIText>
              <UIText modifiers={[tag("Jazz")]}>Jazz</UIText>
              <UIText modifiers={[tag("Funk")]}>Funk</UIText>
            </Picker>
          </Host>
        </Section>

        <Section title="DatePicker">
          <Host matchContents>
            <DatePicker
              title="Next gig"
              selection={date}
              displayedComponents={["date", "hourAndMinute"]}
              onDateChange={setDate}
            />
          </Host>
          <Text style={styles.caption}>Picked: {date.toLocaleString()}</Text>
        </Section>

        <Section title="ColorPicker">
          <Host matchContents>
            <ColorPicker
              label="Brand colour"
              selection={color}
              onSelectionChange={setColor}
              supportsOpacity
            />
          </Host>
          <View style={[styles.colorSwatch, { backgroundColor: color }]} />
        </Section>

        <Section title="Slider">
          <Host matchContents>
            <Slider
              value={sliderValue}
              onValueChange={setSliderValue}
              min={0}
              max={1}
            />
          </Host>
          <Text style={styles.caption}>
            Volume: {Math.round(sliderValue * 100)}%
          </Text>
        </Section>

        <Section title="ProgressView">
          <Host matchContents>
            <VStack spacing={16}>
              <ProgressView value={sliderValue} />
              <HStack spacing={24}>
                <ProgressView />
                <UIText>Indeterminate</UIText>
              </HStack>
            </VStack>
          </Host>
          <Text style={styles.caption}>
            Linear bar is driven by the Slider above.
          </Text>
        </Section>

        <Section title="Gauge">
          <Host matchContents>
            <Gauge
              value={sliderValue}
              min={0}
              max={1}
              modifiers={[gaugeStyle("linearCapacity")]}
            />
          </Host>
          <Text style={styles.caption}>
            Also driven by the Slider ({Math.round(sliderValue * 100)}%)
          </Text>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.subTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f11" },
  scroll: { padding: 16, gap: 8 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  backBtn: { paddingVertical: 4, paddingRight: 12 },
  backText: { color: "#6c63ff", fontSize: 16, fontWeight: "600" },
  title: { color: "#6c63ff", fontSize: 24, fontWeight: "600" },
  subTitle: {
    color: "#6c63ff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  body: { color: "#ddd", fontSize: 14, padding: 16 },
  caption: { color: "#888", fontSize: 12, marginTop: 8 },
  section: {
    backgroundColor: "#1a1a1f",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  colorSwatch: {
    height: 24,
    borderRadius: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#333",
  },
});
