import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

// The fundamental fact of RN perf: anything synchronous on the JS thread
// blocks EVERYTHING on the JS thread. setState updates, gesture handlers,
// timers, the RN bridge itself. The only escape is to either (a) not run
// it on the JS thread (native module, worklet) or (b) break it into
// chunks that yield between them — which is what every concurrent
// technique in JS ultimately boils down to.
//
// This screen proves it. The heartbeat keeps ticking via setInterval.
// Tap "sync" and it visibly stalls. Tap "chunked" and the same amount
// of work runs, but the heartbeat stays alive because each chunk yields.

const TOTAL_WORK_MS = 600;
const CHUNK_MS = 16;

function blockFor(ms: number) {
  const start = performance.now();
  // eslint-disable-next-line no-empty
  while (performance.now() - start < ms) {}
}

// Synchronous version: one big blocking loop. Holds the JS thread for
// the full duration — nothing else runs until it's done.
function runSync(totalMs: number) {
  blockFor(totalMs);
}

// Chunked version: same total work, but split into ~16ms slices with a
// setTimeout(0) between them. Each chunk blocks for one frame's worth,
// then yields. The event loop drains (timers, setState effects, gesture
// handlers) between chunks, so the UI stays alive. Total wall time is
// slightly longer due to scheduler overhead, but the thread is never
// held for more than one frame at a stretch.
function runChunked(totalMs: number, chunkMs: number, onDone: () => void) {
  let done = 0;
  const tick = () => {
    const start = performance.now();
    blockFor(Math.min(chunkMs, totalMs - done));
    done += performance.now() - start;
    if (done < totalMs) {
      setTimeout(tick, 0);
    } else {
      onDone();
    }
  };
  tick();
}

export default function SlowMountScreen() {
  const [status, setStatus] = useState<'idle' | 'sync' | 'chunked'>('idle');
  const [lastMs, setLastMs] = useState<number | null>(null);

  const doSync = () => {
    setStatus('sync');
    // setTimeout(0) so the "sync" status has a chance to render before
    // we lock up the thread — otherwise React would batch and you'd
    // never see it.
    setTimeout(() => {
      const start = performance.now();
      runSync(TOTAL_WORK_MS);
      setLastMs(Math.round(performance.now() - start));
      setStatus('idle');
    }, 0);
  };

  const doChunked = () => {
    setStatus('chunked');
    const start = performance.now();
    runChunked(TOTAL_WORK_MS, CHUNK_MS, () => {
      setLastMs(Math.round(performance.now() - start));
      setStatus('idle');
    });
  };

  return (
    <View style={styles.container}>
      <Heartbeat />

      <Text style={styles.sectionHead}>Do ~{TOTAL_WORK_MS}ms of busy work</Text>
      <View style={styles.controls}>
        <ActionButton
          label="Sync block"
          sub="one big loop"
          active={status === 'sync'}
          onPress={doSync}
          disabled={status !== 'idle'}
        />
        <ActionButton
          label="Chunked"
          sub={`${CHUNK_MS}ms slices, setTimeout(0)`}
          active={status === 'chunked'}
          onPress={doChunked}
          disabled={status !== 'idle'}
        />
      </View>

      <View style={styles.results}>
        <Row label="Status" value={status} highlight={status !== 'idle'} />
        <Row
          label="Last run wall time"
          value={lastMs != null ? `${lastMs}ms` : '—'}
        />
      </View>

      <View style={styles.explain}>
        <Text style={styles.explainHead}>What you should see</Text>
        <Text style={styles.explainBody}>
          <Text style={styles.explainBold}>Sync</Text>: heartbeat freezes for
          the full {TOTAL_WORK_MS}ms. Max stall jumps to ~{TOTAL_WORK_MS}ms.
          Touch events queue up and fire all at once when the thread unlocks.
          {'\n\n'}
          <Text style={styles.explainBold}>Chunked</Text>: heartbeat keeps
          ticking smoothly. Max stall stays around {CHUNK_MS}–{CHUNK_MS * 2}ms
          (one frame). Total wall time is marginally longer than sync because
          of scheduler overhead, but the UI never locks.
          {'\n\n'}
          This is the core principle every "concurrent" technique rests on:
          never hold the JS thread for longer than a frame. `useTransition`,
          `InteractionManager`, Reanimated worklets, background threads —
          they're all different shapes of "cut it up and yield".
          {'\n\n'}
          <Text style={styles.explainBold}>What won't save you</Text>:
          `useTransition` only affects React render work. Wrapping a
          synchronous `for` loop in `startTransition` does nothing — it
          still blocks. Use it when a state change triggers an expensive
          re-render (filter a big list), not when you're doing arbitrary
          compute.
        </Text>
      </View>
    </View>
  );
}

// Heartbeat: a setInterval that fires every 100ms. When the JS thread is
// free, it ticks steadily. When something blocks, callbacks queue up and
// the tick counter freezes, then jumps. We also measure the biggest gap
// between consecutive ticks — the "max stall" — which is the clearest
// single number for "how long did we hold the thread".
function Heartbeat() {
  const [tick, setTick] = useState(0);
  const [maxStall, setMaxStall] = useState(0);
  const lastRef = useRef(performance.now());

  useEffect(() => {
    const id = setInterval(() => {
      const now = performance.now();
      const gap = now - lastRef.current;
      lastRef.current = now;
      setTick((t) => t + 1);
      if (gap > 150) setMaxStall((m) => Math.max(m, Math.round(gap)));
    }, 100);
    return () => clearInterval(id);
  }, []);

  const reset = () => {
    setMaxStall(0);
    lastRef.current = performance.now();
  };

  return (
    <View style={styles.heartbeat}>
      <View style={styles.heartbeatLeft}>
        <Text style={styles.heartbeatLabel}>Heartbeat</Text>
        <Text style={styles.heartbeatSub}>setInterval 100ms</Text>
      </View>
      <View style={styles.heartbeatRight}>
        <Text style={styles.heartbeatValue}>{tick}</Text>
        <Pressable onPress={reset}>
          <Text style={styles.heartbeatStall}>
            max stall: {maxStall > 0 ? `${maxStall}ms` : '—'} ↻
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, highlight && styles.rowValueHot]}>
        {value}
      </Text>
    </View>
  );
}

function ActionButton({
  label,
  sub,
  active,
  disabled,
  onPress,
}: {
  label: string;
  sub: string;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.actionBtn,
        active && styles.actionBtnActive,
        disabled && !active && styles.actionBtnDisabled,
      ]}
    >
      <Text
        style={[styles.actionBtnLabel, active && styles.actionBtnLabelActive]}
      >
        {label}
      </Text>
      <Text style={styles.actionBtnSub}>{sub}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f11', padding: 16 },
  heartbeat: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#14141a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#23232b',
    padding: 14,
    marginBottom: 20,
  },
  heartbeatLeft: { flex: 1 },
  heartbeatLabel: { color: '#e4e4e7', fontSize: 14, fontWeight: '600' },
  heartbeatSub: { color: '#6a6a72', fontSize: 11, marginTop: 2 },
  heartbeatRight: { alignItems: 'flex-end' },
  heartbeatValue: {
    color: '#6c63ff',
    fontSize: 26,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  heartbeatStall: { color: '#8a8a92', fontSize: 11, marginTop: 2 },
  sectionHead: {
    color: '#6a6a72',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  controls: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  actionBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a32',
    backgroundColor: '#1a1a1f',
  },
  actionBtnActive: { backgroundColor: '#6c63ff', borderColor: '#6c63ff' },
  actionBtnDisabled: { opacity: 0.4 },
  actionBtnLabel: { color: '#e4e4e7', fontSize: 14, fontWeight: '600' },
  actionBtnLabelActive: { color: '#fff' },
  actionBtnSub: { color: '#8a8a92', fontSize: 11, marginTop: 3 },
  results: {
    backgroundColor: '#14141a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#23232b',
    padding: 14,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  rowLabel: { color: '#8a8a92', fontSize: 12 },
  rowValue: {
    color: '#e4e4e7',
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  rowValueHot: { color: '#f59e0b' },
  explain: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a32',
    backgroundColor: '#14141a',
  },
  explainHead: {
    color: '#6c63ff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  explainBody: { color: '#8a8a92', fontSize: 12, lineHeight: 18 },
  explainBold: { color: '#e4e4e7', fontWeight: '700' },
});
