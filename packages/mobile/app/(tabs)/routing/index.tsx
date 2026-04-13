import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

const CONCEPTS = [
  {
    id: "file-based",
    title: "File-based routing",
    blurb: "Filename = route path.",
  },
  {
    id: "layouts",
    title: "_layout.tsx",
    blurb: "Wraps every child route below it.",
  },
  {
    id: "groups",
    title: "Route groups",
    blurb: "(parens) = organisational, no URL segment.",
  },
  {
    id: "dynamic",
    title: "Dynamic routes",
    blurb: "[id].tsx captures a URL param.",
  },
  {
    id: "link",
    title: "<Link>",
    blurb: "Declarative navigation, like a web <a>.",
  },
  {
    id: "router",
    title: "useRouter()",
    blurb: "Imperative: push, back, replace.",
  },
  {
    id: "params",
    title: "useLocalSearchParams()",
    blurb: "Read dynamic route params inside [id].tsx.",
  },
];

export default function RoutingIndex() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Routing Concepts</Text>
      <Text style={styles.subtitle}>
        Tap a row — each one pushes a detail screen onto a stack nested INSIDE
        this tab. The tab bar stays visible; only this tab's stack changes.
      </Text>

      {CONCEPTS.map((c) => (
        <Link key={c.id} href={`/routing/${c.id}`} asChild>
          <Pressable style={styles.row}>
            <Text style={styles.rowTitle}>{`/routing/${c.id}`}</Text>
            <Text style={styles.rowTitle}>{c.title}</Text>
            <Text style={styles.rowBlurb}>{c.blurb}</Text>
          </Pressable>
        </Link>
      ))}

      <Text style={styles.footer}>
        URL shape for this screen: /routing. The (tabs) group does not appear.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f11" },
  content: { padding: 24, paddingBottom: 48 },
  title: { color: "#6c63ff", fontSize: 28, fontWeight: "700", marginBottom: 4 },
  subtitle: {
    color: "#8a8a92",
    fontSize: 14,
    marginBottom: 24,
    lineHeight: 20,
  },
  row: {
    backgroundColor: "#1a1a1f",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  rowTitle: { color: "#fff", fontSize: 16, fontWeight: "600", marginBottom: 4 },
  rowBlurb: { color: "#8a8a92", fontSize: 13 },
  footer: {
    color: "#6a6a72",
    fontSize: 12,
    marginTop: 16,
    lineHeight: 18,
    fontStyle: "italic",
  },
});
