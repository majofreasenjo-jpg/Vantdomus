import { notFound } from "next/navigation";
import FamilyLocalPilot from "./FamilyLocalPilot";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "DOMI · Piloto local ficticio", robots: {index:false,follow:false} };
export default function LocalPilotPage(){
  if(process.env.VERCEL_ENV !== "preview" ||
    process.env.VERCEL_GIT_COMMIT_REF !== "domi-neon-staging-pg-startup-gate-20261010") notFound();
  return <FamilyLocalPilot/>;
}
