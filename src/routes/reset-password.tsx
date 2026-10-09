import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Pink Wheel" },
      { name: "description", content: "Choose a new password for your Pink Wheel account." },
      { property: "og:title", content: "Reset password — Pink Wheel" },
      { property: "og:description", content: "Choose a new password for your Pink Wheel account." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return toast.error("Password must be at least 8 characters");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error("This reset link has expired. Please request a new code.");
    toast.success("Password updated");
    navigate({ to: "/dashboard" });
  }
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-blush px-4">
      <div className="w-full max-w-md">
        <Logo className="mb-6 justify-center" />
        <form onSubmit={save} className="space-y-3 rounded-3xl border bg-card p-6 shadow-card">
          <h1 className="text-2xl font-semibold">Choose a new password</h1>
          <div><Label>New password</Label><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required /></div>
          <Button type="submit" variant="hero" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save password"}</Button>
        </form>
      </div>
    </div>
  );
}
