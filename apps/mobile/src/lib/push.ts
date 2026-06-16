export async function registerForPushToken(): Promise<{ token: string; platform: "ios" | "android" | "web"; deviceName?: string } | null> {
  // Push notifications removed for Expo Go SDK 53+ compatibility
  return null;
}

