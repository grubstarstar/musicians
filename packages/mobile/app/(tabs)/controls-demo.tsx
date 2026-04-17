import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  ActivityIndicator,
  Button,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const bands = [
  { id: "1", name: "Lit Allusions" },
  { id: "2", name: "Shakerfaker" },
  { id: "3", name: "Alone With Tiger" },
  { id: "4", name: "The Pressables" },
  { id: "5", name: "FlatListers" },
];

export default function App() {
  const router = useRouter();
  const [name, setName] = useState("Richard");
  const [notifications, setNotifications] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [pressCount, setPressCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBand, setSelectedBand] = useState<string | null>(null);

  const simulateLoad = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  };

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6c63ff"
          />
        }
      >
        <Text style={styles.title}>Welcome {name || "stranger"}!</Text>

        <Section title="TextInput">
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor="#555"
          />
        </Section>

        <Section title="Switch">
          <View style={styles.row}>
            <Text style={styles.body}>Enable notifications</Text>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: "#333", true: "#6c63ff" }}
              thumbColor="#fff"
            />
          </View>
        </Section>

        <Section title="Pressable (custom button)">
          <Pressable
            onPress={() => router.navigate("/apple")}
            style={({ pressed }) => [
              styles.pressable,
              pressed && styles.pressablePressed,
            ]}
          >
            <Text style={styles.pressableText}>
              Pressed {pressCount} time{pressCount === 1 ? "" : "s"}
            </Text>
          </Pressable>
        </Section>

        <Section title="Button (core, basic)">
          <Button
            title="Fetch something"
            color="#6c63ff"
            onPress={simulateLoad}
          />
          {loading && (
            <ActivityIndicator
              size="small"
              color="#6c63ff"
              style={{ marginTop: 12 }}
            />
          )}
        </Section>

        <Section title="FlatList — tap to select">
          <FlatList
            data={bands}
            scrollEnabled={false}
            keyExtractor={(b) => b.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => setSelectedBand(item.id)}
                style={[
                  styles.listItem,
                  selectedBand === item.id && styles.listItemSelected,
                ]}
              >
                <Text style={styles.listItemText}>{item.name}</Text>
              </Pressable>
            )}
          />
        </Section>

        <Section title="Modal">
          <Button
            title="Open modal"
            color="#6c63ff"
            onPress={() => setModalOpen(true)}
          />
          <Modal
            visible={modalOpen}
            animationType="slide"
            transparent
            onRequestClose={() => setModalOpen(false)}
          >
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <Text style={styles.subTitle}>Hello from a Modal</Text>
                <Text style={styles.body}>
                  Swipe down, tap close, or press back on Android.
                </Text>
                <Pressable
                  onPress={() => setModalOpen(false)}
                  style={styles.pressable}
                >
                  <Text style={styles.pressableText}>Close</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        </Section>

        <Section title="Pull down to refresh">
          <Text style={styles.body}>
            Pull the whole screen down — the spinner at the top is a
            RefreshControl attached to the ScrollView.
          </Text>
        </Section>
      </ScrollView>
      <StatusBar style="light" />
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
  container: {
    flex: 1,
    backgroundColor: "#0f0f11",
  },
  scroll: {
    padding: 16,
    gap: 8,
  },
  title: {
    color: "#6c63ff",
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 8,
  },
  subTitle: {
    color: "#6c63ff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  body: {
    color: "#ddd",
    fontSize: 14,
  },
  section: {
    backgroundColor: "#1a1a1f",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  input: {
    backgroundColor: "#0f0f11",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#fff",
    fontSize: 16,
  },
  pressable: {
    backgroundColor: "#6c63ff",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  pressablePressed: {
    opacity: 0.7,
  },
  pressableText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  listItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: "#0f0f11",
  },
  listItemSelected: {
    backgroundColor: "#6c63ff",
  },
  listItemText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#1a1a1f",
    padding: 20,
    borderRadius: 12,
    gap: 8,
  },
});
