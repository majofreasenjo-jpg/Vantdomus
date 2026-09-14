import { notFound } from "next/navigation";
import OwnerAlphaHandoffHarness from "./OwnerAlphaHandoffHarness";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * P5 physical handoff harness.
 * Synthetic-only and Preview-only on the isolated owner branch.
 * No real household data, backend memory writes, or provider network calls.
 */
export default function OwnerAlphaHandoffPage() {
  const isolatedPreview =
    process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === "domi-owner-live-precheck";

  if (!isolatedPreview) notFound();

  return <OwnerAlphaHandoffHarness />;
}
