import { Ionicons } from "@expo/vector-icons";
import { Link, Redirect, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../src/auth/AuthContext";

// Server enforces this too. Keeping the constant in sync with
// `packages/server/src/routes/authRoutes.ts` — if this moves, both sides need
// to update in the same commit.
const MIN_PASSWORD_LENGTH = 8;

export default function SignupScreen() {
  const { status, register } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Same bounce-back as login: if a user deep-links here while already signed
  // in, flip them straight into the app shell.
  if (status === "authenticated") {
    return <Redirect href="/" />;
  }

  const canSubmit =
    username.trim().length > 0 &&
    password.length >= MIN_PASSWORD_LENGTH &&
    !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      // Trim on submit — server also trims, but mirroring here means the
      // canSubmit check stays honest against the value the server will see.
      await register(username.trim(), password);
      // MUS-89: send freshly registered users straight into the onboarding
      // wizard rather than letting the (app) group pick up the authed state.
      // The wizard picks a role (and writes it to users.roles); once the
      // user lands on home they'll have an active context to render. The
      // replace is important — we don't want the signup screen in the back
      // stack while they're partway through onboarding.
      router.replace("/onboarding/role-picker");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView
      style={styles.container}
      edges={["left", "right", "top", "bottom"]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.inner}>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Pick a username and a password</Text>

          <View style={styles.form}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              testID="signup-username"
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username-new"
              textContentType="username"
              placeholder="username"
              placeholderTextColor="#555"
              editable={!submitting}
              returnKeyType="next"
            />

            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                testID="signup-password"
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password-new"
                // textContentType="password" (not "newPassword") — iOS's
                // "Automatic Strong Password" cover view renders over the
                // field on focus when newPassword is set, blocking both
                // manual typing on the sim (Maestro inputText is absorbed
                // into the suggestion, not the TextInput) and users who
                // want to pick their own password. The "password" type
                // still integrates with Password Manager's save-after-submit
                // prompt, which is the UX that matters for a signup flow.
                textContentType="password"
                placeholder={`at least ${MIN_PASSWORD_LENGTH} characters`}
                placeholderTextColor="#555"
                editable={!submitting}
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                style={styles.passwordToggle}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword ? "Hide password" : "Show password"
                }
              >
                <Ionicons
                  name={showPassword ? "eye-off" : "eye"}
                  size={20}
                  color="#7a7a85"
                />
              </Pressable>
            </View>

            {error && (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            )}

            <Pressable
              testID="signup-submit"
              onPress={handleSubmit}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.button,
                !canSubmit && styles.buttonDisabled,
                pressed && canSubmit && styles.buttonPressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit, busy: submitting }}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Create account</Text>
              )}
            </Pressable>

            <Link href="/login" asChild>
              <Pressable
                testID="signup-to-login-link"
                style={styles.altLink}
                accessibilityRole="link"
              >
                <Text style={styles.altLinkText}>
                  Already have an account?{" "}
                  <Text style={styles.altLinkTextStrong}>Sign in</Text>
                </Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f11" },
  flex: { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  title: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "700",
  },
  subtitle: {
    color: "#7a7a85",
    fontSize: 16,
    marginTop: 8,
    marginBottom: 32,
  },
  form: { gap: 8 },
  label: {
    color: "#7a7a85",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#1a1a1f",
    borderWidth: 1,
    borderColor: "#2a2a30",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 16,
  },
  passwordRow: { position: "relative", justifyContent: "center" },
  passwordInput: { paddingRight: 44 },
  passwordToggle: {
    position: "absolute",
    right: 12,
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  error: {
    color: "#ff6b6b",
    fontSize: 14,
    marginTop: 12,
  },
  button: {
    backgroundColor: "#6c63ff",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 24,
  },
  buttonPressed: { opacity: 0.8 },
  buttonDisabled: { opacity: 0.4 },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  altLink: {
    marginTop: 20,
    alignSelf: "center",
    paddingVertical: 8,
  },
  altLinkText: {
    color: "#7a7a85",
    fontSize: 14,
  },
  altLinkTextStrong: {
    color: "#6c63ff",
    fontWeight: "600",
  },
});
