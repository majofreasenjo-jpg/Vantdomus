/**
 * U6 — Onboarding cálido del hogar (primer arranque → invitar familia).
 */
import { getDashboard } from "../../../lib/api";
import OnboardingWizard from "./OnboardingWizard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OnboardingPage({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId: hid } = await params;
  const dash = await getDashboard(hid).catch(() => null);
  const initialName: string = dash?.household?.meta?.family_name || dash?.household?.name || "";
  return <OnboardingWizard hid={hid} initialName={initialName} />;
}
