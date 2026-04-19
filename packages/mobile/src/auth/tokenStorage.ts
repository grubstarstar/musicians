import * as SecureStore from "expo-secure-store";

// Key used in the device's secure store (iOS keychain / Android keystore).
// Chosen to match the server cookie name for grep-ability; the two storages
// are independent — web uses the cookie, mobile uses this store.
const TOKEN_KEY = "auth_token";

export async function getStoredToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (err) {
    // Secure store can throw if the keychain is locked or the device is in
    // an unusual state. Treat failures as "no token" so the user is prompted
    // to log in again rather than wedging the app.
    console.warn("[auth] Failed to read token from secure store:", err);
    return null;
  }
}

export async function storeToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearStoredToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch (err) {
    // Deletion failures are non-fatal — the worst case is a stale token that
    // will be rejected by the server on next use.
    console.warn("[auth] Failed to clear token from secure store:", err);
  }
}
