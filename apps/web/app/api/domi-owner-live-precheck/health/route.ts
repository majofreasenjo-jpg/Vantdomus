import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== "domi-owner-live-precheck") {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.json({ ok: true, scope: "owner-only-synthetic-network-probe", familyDataUsed: false });
}
