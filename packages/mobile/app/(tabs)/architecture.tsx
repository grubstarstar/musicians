import { ScrollView, StyleSheet, Text, View } from 'react-native';

type Flag = {
  label: string;
  value: boolean;
  detail: string;
};

const runtime = globalThis as unknown as {
  nativeFabricUIManager?: unknown;
  HermesInternal?: unknown;
  RN$Bridgeless?: unknown;
  __turboModuleProxy?: unknown;
};

function getFlags(): Flag[] {
  const fabric = runtime.nativeFabricUIManager != null;
  const hermes = runtime.HermesInternal != null;
  const bridgeless = runtime.RN$Bridgeless != null;
  const legacyProxy = runtime.__turboModuleProxy != null;
  const turboModulesActive = bridgeless || legacyProxy;

  return [
    {
      label: 'Fabric renderer',
      value: fabric,
      detail: 'global.nativeFabricUIManager — New Arch renderer, C++ shadow tree',
    },
    {
      label: 'Hermes engine',
      value: hermes,
      detail: "global.HermesInternal — Meta's JS engine, built for RN",
    },
    {
      label: 'Bridgeless mode',
      value: bridgeless,
      detail: 'global.RN$Bridgeless — legacy bridge fully removed',
    },
    {
      label: 'TurboModules active',
      value: turboModulesActive,
      detail: bridgeless
        ? 'Inferred from bridgeless mode — modules installed directly on global, no proxy needed'
        : legacyProxy
          ? 'global.__turboModuleProxy — transitional lookup proxy present'
          : 'No bridgeless mode and no legacy proxy — running old NativeModules',
    },
  ];
}

export default function Architecture() {
  const flags = getFlags();
  const allOn = flags.every((f) => f.value);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Architecture Inspector</Text>
      <Text style={styles.subtitle}>Day 1 — New Architecture runtime flags</Text>

      <View style={[styles.banner, { borderColor: allOn ? '#6bff8c' : '#ffb86b' }]}>
        <Text style={[styles.bannerText, { color: allOn ? '#6bff8c' : '#ffb86b' }]}>
          {allOn ? 'Full New Architecture active' : 'Partial New Architecture'}
        </Text>
      </View>

      {flags.map((flag) => (
        <View key={flag.label} style={styles.row}>
          <View style={styles.rowHeader}>
            <View
              style={[
                styles.dot,
                { backgroundColor: flag.value ? '#6bff8c' : '#ff6b6b' },
              ]}
            />
            <Text style={styles.label}>{flag.label}</Text>
            <Text
              style={[styles.status, { color: flag.value ? '#6bff8c' : '#ff6b6b' }]}
            >
              {flag.value ? 'ON' : 'OFF'}
            </Text>
          </View>
          <Text style={styles.detail}>{flag.detail}</Text>
        </View>
      ))}

      <Text style={styles.footer}>
        These are runtime globals the RN core exposes. Reading them is itself a
        tiny JSI demo — native C++ installs them on global at bootstrap.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f11',
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  title: {
    color: '#6c63ff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: '#8a8a92',
    fontSize: 14,
    marginBottom: 24,
  },
  banner: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  row: {
    backgroundColor: '#1a1a1f',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  status: {
    fontSize: 13,
    fontWeight: '700',
  },
  detail: {
    color: '#8a8a92',
    fontSize: 12,
    marginLeft: 22,
    lineHeight: 18,
  },
  footer: {
    color: '#6a6a72',
    fontSize: 12,
    marginTop: 16,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
