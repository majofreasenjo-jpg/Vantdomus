import { notFound } from "next/navigation";
import OwnerAlphaCrossDeviceHarness from "./OwnerAlphaCrossDeviceHarness";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function OwnerAlphaCrossDevicePage() {
  const isolatedPreview =
    process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === "domi-owner-live-precheck";

  if (!isolatedPreview) notFound();
  return <OwnerAlphaCrossDeviceHarness />;
}
