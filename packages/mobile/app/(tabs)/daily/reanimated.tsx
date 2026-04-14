import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

// The whole Reanimated story in one screen:
//
// - useSharedValue: a "ref" that lives on BOTH the JS thread and the UI
//   thread, kept in sync via shared memory. You mutate .value from either
//   side and the other sees it.
// - Worklets: small JS functions that get serialised and run on the UI
//   thread. Marked by the Babel plugin (auto via babel-preset-expo 13+).
//   Gesture callbacks and useAnimatedStyle bodies are worklets by default.
// - useAnimatedStyle: a worklet that produces a style object each frame,
//   running on the UI thread. The result is applied to the native view
//   directly without round-tripping through JS.
// - Gesture.Pan() + GestureDetector: gesture-handler's new API. The
//   gesture callbacks run as worklets on the UI thread, writing straight
//   to shared values, which the animated style reads from on the same
//   thread — zero JS involvement during the drag.
// - withSpring: a timing helper that animates a shared value towards a
//   target over time. Also a worklet; runs on the UI thread.
//
// Payoff: because the entire drag pipeline runs on the UI thread, the
// card stays silky even if the JS thread is blocked. The "Block JS"
// button proves it — it locks up JS for 3 seconds, during which the
// JS heartbeat freezes but you can STILL drag the card smoothly.

function blockFor(ms: number) {
  const start = performance.now();
  // eslint-disable-next-line no-empty
  while (performance.now() - start < ms) {}
}

export default function ReanimatedScreen() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.container}>
        <Header />
        <DraggableCard />
        <BlockButton />
      </View>
    </GestureHandlerRootView>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>Drag the card</Text>
      <Text style={styles.subtitle}>
        Gesture callbacks + useAnimatedStyle run as worklets on the UI
        thread. Shared values cross the threads without serialisation.
      </Text>
    </View>
  );
}

function DraggableCard() {
  // Shared values — refs that live on both threads. Initial values are
  // set from JS; subsequent writes from the gesture come from the UI
  // thread via worklets. Reads from useAnimatedStyle are also on the UI
  // thread. No JS involvement during the drag at all.
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  // "Start" values captured at gesture-begin so drags compose on top of
  // whatever translation was there before.
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  // Tracks whether a drag is currently in progress so the style worklet
  // can add a scale-up while held.
  const dragging = useSharedValue(0);

  const pan = Gesture.Pan()
    .onBegin(() => {
      // This function is a worklet — runs on the UI thread, no JS
      // involvement. If you need to call back into JS from here, use
      // `runOnJS(fn)(args)`.
      'worklet';
      startX.value = tx.value;
      startY.value = ty.value;
      dragging.value = withSpring(1, { damping: 15 });
    })
    .onUpdate((e) => {
      'worklet';
      tx.value = startX.value + e.translationX;
      ty.value = startY.value + e.translationY;
    })
    .onEnd(() => {
      'worklet';
      // Spring the card back to origin. withSpring is itself a worklet —
      // the animation runs on the UI thread, frame by frame, with no JS
      // round-trip. Configurable via damping, stiffness, mass.
      tx.value = withSpring(0, { damping: 12, stiffness: 120 });
      ty.value = withSpring(0, { damping: 12, stiffness: 120 });
      dragging.value = withSpring(0);
    });

  // Animated style — a worklet that runs every frame on the UI thread and
  // produces a style object applied directly to the native view. Reads
  // shared values, so whenever they change, this re-runs. No React
  // re-render triggered.
  const animatedStyle = useAnimatedStyle(() => {
    // Distance from origin, used to tint the card colour — further from
    // centre = warmer.
    const distance = Math.sqrt(tx.value * tx.value + ty.value * ty.value);
    const backgroundColor = interpolateColor(
      distance,
      [0, 200],
      ['#6c63ff', '#f59e0b'],
    );
    // Rotate slightly in the direction of drag for a tactile feel.
    const rotate = interpolate(tx.value, [-200, 200], [-12, 12], 'clamp');
    const scale = interpolate(dragging.value, [0, 1], [1, 1.08]);

    return {
      backgroundColor,
      transform: [
        { translateX: tx.value },
        { translateY: ty.value },
        { rotate: `${rotate}deg` },
        { scale },
      ],
    };
  });

  return (
    <View style={styles.cardArea}>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.card, animatedStyle]}>
          <Text style={styles.cardLabel}>drag me</Text>
          <Text style={styles.cardSub}>spring back on release</Text>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function BlockButton() {
  const [isBlocking, setIsBlocking] = useState(false);
  const [tick, setTick] = useState(0);
  const lastRef = useRef(performance.now());
  const [maxStall, setMaxStall] = useState(0);

  // JS-thread heartbeat — same as the slow-mount demo. When JS is
  // blocked, this freezes. The whole point of this section is to show
  // that the card above keeps animating smoothly even while this is
  // frozen — because the drag runs on the UI thread.
  useEffect(() => {
    const id = setInterval(() => {
      const now = performance.now();
      const gap = now - lastRef.current;
      lastRef.current = now;
      setTick((t) => t + 1);
      if (gap > 200) setMaxStall((m) => Math.max(m, Math.round(gap)));
    }, 100);
    return () => clearInterval(id);
  }, []);

  const blockJs = () => {
    setIsBlocking(true);
    // Yield so "isBlocking" renders before we lock up.
    setTimeout(() => {
      blockFor(3000);
      setIsBlocking(false);
    }, 0);
  };

  return (
    <View style={styles.blockBox}>
      <View style={styles.heartbeatRow}>
        <View>
          <Text style={styles.heartbeatLabel}>JS heartbeat</Text>
          <Text style={styles.heartbeatSub}>setInterval 100ms</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.heartbeatValue}>{tick}</Text>
          <Text style={styles.heartbeatStall}>
            max stall: {maxStall > 0 ? `${maxStall}ms` : '—'}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={blockJs}
        disabled={isBlocking}
        style={[styles.blockBtn, isBlocking && styles.blockBtnActive]}
      >
        <Text style={styles.blockBtnText}>
          {isBlocking ? 'JS blocked…' : 'Block JS thread for 3s'}
        </Text>
      </Pressable>
      <Text style={styles.blockHint}>
        Tap "Block JS" then immediately start dragging the card. The
        heartbeat freezes for 3 seconds — but the card still moves
        smoothly. That's the payoff of worklets: gesture + animation
        pipeline runs on the UI thread, independent of the JS thread's
        health.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0f11' },
  container: { flex: 1, padding: 16 },
  header: { marginBottom: 8 },
  title: { color: '#e4e4e7', fontSize: 16, fontWeight: '700' },
  subtitle: {
    color: '#8a8a92',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  cardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: 160,
    height: 160,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  cardLabel: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cardSub: { color: 'rgba(255,255,255,0.8)', fontSize: 10, marginTop: 4 },
  blockBox: {
    backgroundColor: '#14141a',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#23232b',
  },
  heartbeatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  heartbeatLabel: { color: '#e4e4e7', fontSize: 13, fontWeight: '600' },
  heartbeatSub: { color: '#6a6a72', fontSize: 11, marginTop: 2 },
  heartbeatValue: {
    color: '#6c63ff',
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  heartbeatStall: { color: '#8a8a92', fontSize: 11, marginTop: 2 },
  blockBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#6c63ff',
    alignItems: 'center',
  },
  blockBtnActive: { backgroundColor: '#f59e0b' },
  blockBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  blockHint: {
    color: '#8a8a92',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 10,
  },
});
