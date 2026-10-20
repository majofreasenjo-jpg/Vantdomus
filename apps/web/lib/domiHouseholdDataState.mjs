/**
 * R69: source-of-truth classification for the REAL household page.
 * Empty family/empty shopping lists are valid authenticated households.
 * A partial response or malformed payload must NEVER become local demo.
 * The synthetic Preview is a different route and passes "demo" explicitly.
 */
export function classifyHouseholdData({ dashboard, shopping, dashboardError, shoppingError }) {
  const errors = [dashboardError, shoppingError].filter(Boolean);
  if (errors.length > 0) {
    const authFailure = errors.some(error =>
      /(?:^|\D)(401|403)(?:\D|$)|unauthoriz|forbidden|authentication|sesi[oó]n|expirad/i
        .test(String(error?.message ?? error))
    );
    return authFailure ? "session" : "api";
  }
  if (
    !dashboard || !shopping ||
    typeof dashboard !== "object" || typeof shopping !== "object" ||
    !Array.isArray(dashboard.persons) ||
    !Array.isArray(shopping.items)
  ) {
    return "api";
  }
  return "real";
}
