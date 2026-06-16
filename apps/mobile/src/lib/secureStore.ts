/**
 * Secure storage for sensitive credentials (JWT access tokens).
 *
 * On native (iOS / Android), tokens are written to the platform Keychain /
 * Keystore via expo-secure-store, which is encrypted at rest and not
 * readable by other apps on the device.
 *
 * On web (Expo's `expo start --web` target), SecureStore is unavailable,
 * so we transparently fall back to AsyncStorage. This is acceptable for
 * dev/preview only — production web builds use the Next.js panel, which
 * stores its token in an HttpOnly cookie set by the server.
 *
 * Migration: any pre-existing token in AsyncStorage is opportunistically
 * promoted to SecureStore the first time `getSecureItem` is called, so
 * existing installs don't lose their session.
 */

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// expo-secure-store is a native module. On web/Expo Go for web, importing
// it should still resolve (it ships a no-op web shim), but we guard the
// call site anyway with Platform.OS to make the fall-back explicit.
import * as SecureStore from "expo-secure-store";

const isNativePlatform = Platform.OS === "ios" || Platform.OS === "android";

/**
 * Returns true if encrypted secure storage is actually available on this
 * device. Some emulators / older devices report unavailable; in those
 * cases we degrade to AsyncStorage rather than crash.
 */
async function secureAvailable(): Promise<boolean> {
  if (!isNativePlatform) return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (await secureAvailable()) {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    // Also purge any old AsyncStorage copy so the cleartext version doesn't
    // linger after the migration.
    try { await AsyncStorage.removeItem(key); } catch { /* best-effort */ }
    return;
  }
  await AsyncStorage.setItem(key, value);
}

export async function getSecureItem(key: string): Promise<string | null> {
  if (await secureAvailable()) {
    const fromSecure = await SecureStore.getItemAsync(key);
    if (fromSecure) return fromSecure;
    // Migration path: promote any cleartext copy in AsyncStorage to
    // SecureStore, then delete the cleartext version.
    const legacy = await AsyncStorage.getItem(key);
    if (legacy) {
      await SecureStore.setItemAsync(key, legacy, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      try { await AsyncStorage.removeItem(key); } catch { /* best-effort */ }
      return legacy;
    }
    return null;
  }
  return AsyncStorage.getItem(key);
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (await secureAvailable()) {
    try { await SecureStore.deleteItemAsync(key); } catch { /* not present */ }
  }
  try { await AsyncStorage.removeItem(key); } catch { /* not present */ }
}
