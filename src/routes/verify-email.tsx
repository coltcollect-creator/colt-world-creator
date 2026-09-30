import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/verify-email")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/play" });
  },
  head: () => ({ meta: [{ title: "אימות חשבון — COLT" }] }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/play" });
  }, [navigate]);

  return null;
}
