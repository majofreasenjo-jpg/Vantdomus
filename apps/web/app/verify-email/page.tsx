import { Suspense } from "react";
import VerifyEmailClient from "./VerifyEmailClient";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="card">Validando enlace...</div>}>
      <VerifyEmailClient />
    </Suspense>
  );
}
