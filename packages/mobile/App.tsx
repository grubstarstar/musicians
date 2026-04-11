import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Musicians</Text>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f11',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#6c63ff',
    fontSize: 24,
    fontWeight: '600',
  },
});
