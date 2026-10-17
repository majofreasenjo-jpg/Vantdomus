import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import OwnerPrivateClient from "./OwnerPrivateClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  title: "DOMI · Owner privada — no habilitada",
  robots: { index:false, follow:false },
};

export default async function OwnerPrivatePage() {
  // Do NOT modify the synthetic /owner-beta preview. No release by a client
  // flag. This page is available only on the explicitly named preview branch,
  // with a separate server-only opt-in and an existing HttpOnly auth cookie.
  const allowed = process.env.VERCEL_ENV === "preview"
    && process.env.VERCEL_GIT_COMMIT_REF === "domi-neon-staging-pg-startup-gate-20261010"
    && process.env.DOMI_OWNER_PRIVATE_UI_ENABLED === "1";
  if (!allowed) notFound();
  const store = await cookies();
  if (!store.get("vantdomus_access_token")?.value) redirect("/login");
  return <OwnerPrivateClient />;
}
