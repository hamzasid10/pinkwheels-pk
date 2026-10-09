import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, Panel } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/pink";
import { COUNTRY_CODES, OtpVerify, otpErrorMessage, toE164 } from "@/components/OtpVerify";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "Account — Pink Wheel" }, { name: "description", content: "Change your email or phone with a verification code." }] }),
  component: Account,
});

function Account() {
  const me = useMe();
  const [kind, setKind] = useState<"email" | "phone" | null>(null);
  const [email, setEmail] = useState("");
  const [cc, setCc] = useState("+92");
  const [phone, setPhone] = useState("");
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(k: "email" | "phone", dest: string) {
    const { error } = await supabase.auth.updateUser(k === "email" ? { email: dest } : { phone: dest });
    if (error) throw error;
  }
  async function start(k: "email" | "phone") {
    if (busy) return;
    const dest = k === "email" ? (/^\S+@\S+\.\S+$/.test(email.trim()) ? email.trim() : null) : toE164(cc, phone);
    if (!dest) return toast.error(k === "email" ? "Enter a valid email address" : "Enter a valid phone number");
    setBusy(true);
    try { await send(k, dest); setKind(k); setTarget(dest); } catch (e) { toast.error(otpErrorMessage(e)); } finally { setBusy(false); }
  }
  async function verify(code: string) {
    const { error } = kind === "email"
      ? await supabase.auth.verifyOtp({ email: target!, token: code, type: "email_change" })
      : await supabase.auth.verifyOtp({ phone: target!, token: code, type: "phone_change" });
    if (error) throw error;
    if (kind === "phone") await supabase.from("profiles").update({ phone: target }).eq("id", me.data!.user.id);
    toast.success(kind === "email" ? "Email updated" : "Phone updated");
    setTarget(null); setKind(null); me.refetch();
  }

  return (
    <AppShell title="Account & security">
      {target && kind ? (
        <Panel className="mx-auto max-w-md">
          <OtpVerify target={target} onVerify={verify} onResend={() => send(kind, target)} onChange={() => setTarget(null)}
            changeLabel={kind === "email" ? "Change email" : "Change phone"} />
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="Email">
            <p className="mb-3 text-sm text-muted-foreground">Current: {me.data?.user.email || "—"}</p>
            <Label>New email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button className="mt-3" variant="hero" disabled={busy} onClick={() => start("email")}>Send code</Button>
          </Panel>
          <Panel title="Phone">
            <p className="mb-3 text-sm text-muted-foreground">Current: {me.data?.user.phone ? `+${me.data.user.phone}` : me.data?.profile?.phone || "—"}</p>
            <Label>New phone</Label>
            <div className="flex gap-2">
              <select value={cc} onChange={(e) => setCc(e.target.value)} aria-label="Country code" className="h-10 rounded-md border border-input bg-background px-2 text-sm">
                {COUNTRY_CODES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
              <Input type="tel" value={phone} placeholder="300 1234567" onChange={(e) => setPhone(e.target.value)} />
            </div>
            <Button className="mt-3" variant="hero" disabled={busy} onClick={() => start("phone")}>Send code</Button>
          </Panel>
        </div>
      )}
    </AppShell>
  );
}
