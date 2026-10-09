import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { deleteMyAccount } from "@/lib/account.functions";
import { INFO_LINKS } from "@/components/InfoPage";
import { SITE } from "@/lib/site";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
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
    <AppShell title="Account & settings">
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
          <ProfilePanel />
          <Panel title="Help & legal">
            <ul className="space-y-2 text-sm">
              {INFO_LINKS.map((l) => <li key={l.to}><Link to={l.to} className="font-semibold text-primary">{l.label}</Link></li>)}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">{SITE.name} version {SITE.version}</p>
          </Panel>
          <DeletePanel />
        </div>
      )}
    </AppShell>
  );
}

function ProfilePanel() {
  const me = useMe();
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const v = name ?? me.data?.profile?.full_name ?? "";
  async function save() {
    if (v.trim().length < 2 || v.trim().length > 100) return toast.error("Enter your name (2–100 letters)");
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ full_name: v.trim() }).eq("id", me.data!.user.id);
    setBusy(false);
    if (error) return toast.error("Couldn't save. Please try again.");
    toast.success("Profile saved"); me.refetch();
  }
  return (
    <Panel title="Edit profile">
      <Label htmlFor="pname">Full name</Label>
      <Input id="pname" value={v} onChange={(e) => setName(e.target.value)} maxLength={100} />
      <Button className="mt-3" variant="hero" disabled={busy || !me.data} onClick={save}>{busy ? "Saving…" : "Save"}</Button>
    </Panel>
  );
}

function DeletePanel() {
  const del = useServerFn(deleteMyAccount);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  async function go() {
    if (busy || text !== "DELETE") return;
    setBusy(true);
    try {
      await del({ data: { confirm: text } });
      await qc.cancelQueries(); qc.clear();
      await supabase.auth.signOut();
      toast.success("Your account has been deleted.");
      navigate({ to: "/", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete your account. Please contact support.");
      setBusy(false);
    }
  }
  return (
    <Panel title="Delete account" className="border-destructive/30">
      <p className="text-sm text-muted-foreground">Permanently delete your account, profile, contacts, saved places and driver documents. Past trips are kept without your name or phone. This can't be undone.</p>
      <AlertDialog>
        <AlertDialogTrigger asChild><Button variant="destructive" className="mt-3">Delete my account</Button></AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>Any upcoming rides and Pink Pool seats will be cancelled. Type DELETE to confirm.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input aria-label="Type DELETE to confirm" value={text} onChange={(e) => setText(e.target.value)} placeholder="DELETE" />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep my account</AlertDialogCancel>
            <Button variant="destructive" disabled={busy || text !== "DELETE"} onClick={go}>{busy ? "Deleting…" : "Delete permanently"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
}
