import { createContext, memo, useContext, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { create } from "zustand";

// --------------------------------------------------------------------------
// Shared shape — three unrelated slices so we can prove that updating one
// doesn't need to re-render subscribers of the others.
// --------------------------------------------------------------------------

type StateShape = {
  count: number;
  theme: "dark" | "light";
  text: string;
};

type Actions = {
  inc: () => void;
  toggleTheme: () => void;
  setText: (text: string) => void;
};

// --------------------------------------------------------------------------
// 1) Zustand store — state lives outside React. Subscribers pass a selector;
// the store calls them back only when the selected slice changes.
// --------------------------------------------------------------------------

const useZustand = create<StateShape & Actions>((set) => ({
  count: 0,
  theme: "dark",
  text: "",
  inc: () => set((s) => ({ count: s.count + 1 })),
  toggleTheme: () =>
    set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
  setText: (text) => set({ text }),
}));

function ZustandCountCard() {
  // Selector: read ONLY `count`. Zustand runs the selector on every store
  // change, shallow-compares the result, and only re-renders this component
  // when the returned value differs.
  const count = useZustand((s) => s.count);
  return <SliceCard label="count (zustand)" value={String(count)} />;
}

function ZustandThemeCard() {
  const theme = useZustand((s) => s.theme);
  return <SliceCard label="theme (zustand)" value={theme} />;
}

function ZustandTextCard() {
  const text = useZustand((s) => s.text);
  return <SliceCard label="text (zustand)" value={text || "(empty)"} />;
}

function ZustandControls() {
  // Actions are stable (created once when the store is built) so pulling
  // them with individual selectors doesn't cause re-renders on state change.
  const inc = useZustand((s) => s.inc);
  const toggleTheme = useZustand((s) => s.toggleTheme);
  const setText = useZustand((s) => s.setText);
  const text = useZustand((s) => s.text);

  return (
    <View style={styles.controls}>
      <Pressable style={styles.btn} onPress={inc}>
        <Text style={styles.btnText}>count++</Text>
      </Pressable>
      <Pressable style={styles.btn} onPress={toggleTheme}>
        <Text style={styles.btnText}>toggle theme</Text>
      </Pressable>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="type here…"
        placeholderTextColor="#4a4a52"
      />
    </View>
  );
}

// --------------------------------------------------------------------------
// 2) Context — the "just use React" version. Provider owns the state;
// children subscribe via useContext.
//
// The trap: context re-renders EVERY consumer whenever the provided value
// reference changes. And since we're creating `value = { ... }` during the
// provider's render, it's a new object every render, so every consumer
// always re-renders.
// --------------------------------------------------------------------------

const Ctx = createContext<(StateShape & Actions) | null>(null);

function ContextProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [text, setText] = useState("");

  // New object on every provider render. Every consumer re-renders.
  // (Wrapping in useMemo would help identity stability, but ANY of the
  // three useState changes still re-renders the provider AND all consumers
  // because they all destructure from the same object.)
  const value: StateShape & Actions = {
    count,
    theme,
    text,
    inc: () => setCount((c) => c + 1),
    toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    setText,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function useCtx() {
  const v = useContext(Ctx);
  if (!v) throw new Error("Missing ContextProvider");
  return v;
}

function ContextCountCard() {
  const { count } = useCtx();
  return <SliceCard label="count (context)" value={String(count)} />;
}

function ContextThemeCard() {
  const { theme } = useCtx();
  return <SliceCard label="theme (context)" value={theme} />;
}

function ContextTextCard() {
  const { text } = useCtx();
  return <SliceCard label="text (context)" value={text || "(empty)"} />;
}

function ContextControls() {
  const { inc, toggleTheme, setText, text } = useCtx();
  return (
    <View style={styles.controls}>
      <Pressable style={styles.btn} onPress={inc}>
        <Text style={styles.btnText}>count++</Text>
      </Pressable>
      <Pressable style={styles.btn} onPress={toggleTheme}>
        <Text style={styles.btnText}>toggle theme</Text>
      </Pressable>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="type here…"
        placeholderTextColor="#4a4a52"
      />
    </View>
  );
}

// --------------------------------------------------------------------------
// 3) Context with a memo'd intermediate layer. Proves two things:
//
//   (a) memo stops the parent→child render cascade — the MemoLayer
//       function body isn't re-called, and a non-consumer child inside it
//       stays frozen at 1 render.
//   (b) Context re-renders "pierce" the memo boundary — the three consumer
//       cards inside still re-render on every context change, because
//       React tracks context subscribers independently of the render tree.
//
// This is the shape people imagine context has by default. To get here you
// need to memo the intermediate layers. Even then, every consumer re-renders
// on every slice change — selectors (Zustand) are the real fix for that.
// --------------------------------------------------------------------------

const MemoLayer = memo(function MemoLayer() {
  return (
    <>
      <MemoBoundaryCard />
      <ContextCountCard />
      <ContextThemeCard />
      <ContextTextCard />
    </>
  );
});

// Non-consumer child INSIDE the memo'd layer. Doesn't call useContext.
// Should stay at 1 render — memo skipped its parent, and it has no context
// subscription of its own, so nothing schedules a re-render.
function MemoBoundaryCard() {
  const renders = useRef(0);
  renders.current += 1;
  return (
    <View style={[styles.card, styles.boundaryCard]}>
      <View style={styles.cardHead}>
        <Text style={styles.cardLabel}>
          &lt;MemoLayer&gt; — non-consumer child
        </Text>
        <View
          style={[
            styles.pill,
            renders.current === 1 ? styles.pillGood : styles.pillBad,
          ]}
        >
          <Text style={styles.pillText}>{renders.current} renders</Text>
        </View>
      </View>
      <Text style={styles.cardValue}>
        {renders.current === 1 ? "skipped ✓" : "leaked!"}
      </Text>
    </View>
  );
}

// --------------------------------------------------------------------------
// SliceCard — displays its own render count. Module-level refs don't work
// (shared between all instances); useRef incremented during render gives
// each instance its own counter.
// --------------------------------------------------------------------------

function SliceCard({ label, value }: { label: string; value: string }) {
  const renders = useRef(0);
  renders.current += 1;
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardLabel}>{label}</Text>
        <View
          style={[
            styles.pill,
            renders.current === 1 ? styles.pillGood : styles.pillBad,
          ]}
        >
          <Text style={styles.pillText}>{renders.current} renders</Text>
        </View>
      </View>
      <Text style={styles.cardValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

// --------------------------------------------------------------------------
// Screen
// --------------------------------------------------------------------------

export default function StateScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>State management</Text>
      <Text style={styles.intro}>
        Two stores, same shape. Each has three independent slices and three
        cards, each reading one slice. Watch the render counters — changing one
        slice should only re-render the card that reads it.
      </Text>

      <Text style={styles.section}>Zustand — selector subscriptions</Text>
      <ZustandControls />
      <ZustandCountCard />
      <ZustandThemeCard />
      <ZustandTextCard />

      <View style={styles.divider} />

      <Text style={styles.section}>Context — naive provider</Text>
      <ContextProvider>
        <ContextControls />
        <ContextCountCard />
        <ContextThemeCard />
        <ContextTextCard />
      </ContextProvider>

      <View style={styles.divider} />

      <Text style={styles.section}>Context — memo'd intermediate layer</Text>
      <ContextProvider>
        <ContextControls />
        <MemoLayer />
      </ContextProvider>

      <Text style={styles.footnote}>
        • <Text style={styles.bold}>Zustand</Text>: editing text only re-renders
        the "text" card. Selectors scope subscriptions to one slice.
        {"\n\n"}• <Text style={styles.bold}>Naive context</Text>: every
        keystroke re-renders all three cards. useContext has no selector API —
        any change to the provider's value re-renders every consumer, and the
        parent→child cascade drags every non-memo'd child along for the ride.
        {"\n\n"}• <Text style={styles.bold}>Memo'd context</Text>: the MemoLayer
        card stays at 1 render — memo stopped the parent→child cascade, and its
        non-consumer child wasn't visited. But the three consumer cards inside
        still climb on every change, because context re-renders pierce memo
        boundaries to reach subscribers, and every subscriber re-renders
        regardless of which slice it read.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f11" },
  content: { padding: 16, paddingBottom: 48 },
  title: { color: "#6c63ff", fontSize: 24, fontWeight: "700", marginBottom: 4 },
  intro: { color: "#8a8a92", fontSize: 13, lineHeight: 18, marginBottom: 16 },
  section: {
    color: "#e4e4e7",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 4,
  },
  controls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#6c63ff",
    borderRadius: 8,
  },
  btnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  input: {
    flex: 1,
    minWidth: 120,
    backgroundColor: "#1a1a1f",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2a2a32",
    color: "#e4e4e7",
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  card: {
    backgroundColor: "#14141a",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#23232b",
    padding: 12,
    marginBottom: 8,
  },
  cardHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cardLabel: {
    color: "#6a6a72",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cardValue: { color: "#e4e4e7", fontSize: 15, fontWeight: "600" },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  pillGood: { backgroundColor: "#1f3a1f" },
  pillBad: { backgroundColor: "#5a1f25" },
  pillText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  divider: {
    height: 1,
    backgroundColor: "#23232b",
    marginVertical: 20,
  },
  footnote: {
    color: "#6a6a72",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 16,
  },
  bold: { color: "#e4e4e7", fontWeight: "700" },
  boundaryCard: {
    borderColor: "#3a3a5a",
    backgroundColor: "#14141f",
  },
});
