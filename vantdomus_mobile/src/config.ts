export const API_BASE = process.env.EXPO_PUBLIC_API_BASE || "http://127.0.0.1:8001";

// v0.6: token + household are stored after login
export const STORAGE_KEYS = {
  token: "vantdomus_token",
  householdId: "vantdomus_household_id",
};
