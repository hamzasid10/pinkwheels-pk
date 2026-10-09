import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Car, Mail, Phone, User } from "lucide-react";
import { Logo } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { cn } from "@/lib/utils";
import { oauthReturnPath } from "@/lib/oauth-return-path";
import { COUNTRY_CODES, OtpVerify, otpErrorMessage, toE164 } from "@/components/OtpVerify";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { role?: "driver"; next?: string } => {
    const next = oauthReturnPath(s["next"]);
    return { ...(s["role"] === "driver" ? { role: "driver" as const } : {}), ...(next !== "/" ? { next } : {}) };
  },
  head: () => ({
    meta: [
      { title: "Sign in — Pink Wheel" },
      { name: "description", content: "Sign in or create your Pink Wheel rider or driver account with a one-time code." },
      { property: "og:title", content: "Sign in — Pink Wheel" },
      { property: "og:description", content: "Join Pink Wheel as a rider or a driver." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "password" | "forgot";
type Method = "email" | "phone";
const emailSchema = z.string().trim().email("Enter a valid email address").max(255);

function AuthPage() {
  const { role: initialRole, next } = Route.useSearch();
  const navigate = useNavigate();
  const goNext = () => (next ? window.location.assign(next) : navigate({ to: "/dashboard" }));
  const [mode, setMode] = useState<Mode>(initialRole ? "signup" : "signin");
  const [method, setMethod] = useState<Method>("email");
  const [role, setRole] = useState<"rider" | "driver">(initialRole ?? "rider");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cc, setCc] = useState("+92");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [newPass, setNewPass] = useState("");
  const [step, setStep] = useState<"form" | "otp" | "newpass">("form");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && step === "form") goNext();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  async function sendCode(dest: string) {
    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(dest, { redirectTo: `${window.location.origin}/reset-password` });
      if (error) throw error;
      return;
    }
    const create = mode === "signup";
    const options = { shouldCreateUser: create, ...(create ? { data: { full_name: name.trim(), role } } : {}) };
    const { error } = dest.startsWith("+")
      ? await supabase.auth.signInWithOtp({ phone: dest, options })
      : await supabase.auth.signInWithOtp({ email: dest, options: { ...options, emailRedirectTo: next ? new URL(next, window.location.origin).href : `${window.location.origin}/dashboard` } });
    if (error) throw error;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      if (mode === "password") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        return goNext();
      }
      if (mode === "signup" && name.trim().length < 2) throw new Error("Enter your name");
      let dest: string;
      if (method === "phone" && mode !== "forgot") {
        const p = toE164(cc, phone);
        if (!p) throw new Error("Enter a valid phone number, e.g. 300 1234567");
        dest = p;
      } else {
        const r = emailSchema.safeParse(email);
        if (!r.success) throw new Error(r.error.issues[0]?.message);
        dest = r.data;
      }
      await sendCode(dest);
      setTarget(dest);
      setStep("otp");
    } catch (err) {
      toast.error(otpErrorMessage(err));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function verify(code: string) {
    const type = mode === "forgot" ? "recovery" : target.startsWith("+") ? "sms" : "email";
    const { error } = target.startsWith("+")
      ? await supabase.auth.verifyOtp({ phone: target, token: code, type: "sms" })
      : await supabase.auth.verifyOtp({ email: target, token: code, type: type as "email" | "recovery" });
    if (error) throw error;
    if (mode === "forgot") return setStep("newpass");
    toast.success("Verified!");
    goNext();
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPass.length < 8) return toast.error("Password must be at least 8 characters");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPass });
    setBusy(false);
    if (error) return toast.error(otpErrorMessage(error));
    toast.success("Password updated");
    navigate({ to: "/dashboard" });
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" + (next ? `?next=${encodeURIComponent(next)}` : "") });
    if (r.error) return toast.error("Google sign-in failed");
    if (r.redirected) return;
    goNext();
  }

  const title = { signin: "Welcome back", signup: "Join Pink Wheel", password: "Sign in with password", forgot: "Reset password" }[mode];
  const usePhone = method === "phone" && (mode === "signin" || mode === "signup");

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-blush px-4 py-10">
      <div className="w-full max-w-md">
        <Logo variant="full" className="mb-6 justify-center" />
        <div className="rounded-3xl border bg-card p-6 shadow-card sm:p-8">
          {step === "otp" ? (
            <OtpVerify target={target} onVerify={verify} onResend={() => sendCode(target)} onChange={() => setStep("form")}
              changeLabel={target.startsWith("+") ? "Change phone" : "Change email"} />
          ) : step === "newpass" ? (
            <form onSubmit={savePassword} className="space-y-3">
              <h1 className="text-2xl font-semibold">Choose a new password</h1>
              <div><Label>New password</Label><Input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} required /></div>
              <Button type="submit" variant="hero" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save password"}</Button>
            </form>
          ) : (
            <>
              <h1 className="text-3xl font-semibold">{title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">Pink Wheel is for women only.</p>

              {mode === "signup" && (
                <div className="mt-5 grid grid-cols-2 gap-2">
                  {(["rider", "driver"] as const).map((r) => (
                    <button key={r} type="button" onClick={() => setRole(r)}
                      className={cn("flex flex-col items-center gap-1 rounded-2xl border-2 p-3 text-sm font-semibold transition", role === r ? "border-primary bg-accent" : "border-border")}>
                      {r === "rider" ? <User className="h-5 w-5" /> : <Car className="h-5 w-5" />}
                      I'm a {r}
                    </button>
                  ))}
                </div>
              )}

              {(mode === "signin" || mode === "signup") && (
                <div className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-muted p-1 text-sm font-semibold">
                  {(["email", "phone"] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setMethod(m)}
                      className={cn("flex items-center justify-center gap-1.5 rounded-full py-2 transition", method === m ? "bg-card shadow-soft" : "text-muted-foreground")}>
                      {m === "email" ? <Mail className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                      {m === "email" ? "Email" : "Phone"}
                    </button>
                  ))}
                </div>
              )}

              <form onSubmit={submit} className="mt-5 space-y-3">
                {mode === "signup" && (
                  <div><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required /></div>
                )}
                {usePhone ? (
                  <div>
                    <Label>Phone number</Label>
                    <div className="flex gap-2">
                      <select value={cc} onChange={(e) => setCc(e.target.value)} aria-label="Country code"
                        className="h-10 rounded-md border border-input bg-background px-2 text-sm">
                        {COUNTRY_CODES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                      </select>
                      <Input type="tel" inputMode="tel" placeholder="300 1234567" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                    </div>
                  </div>
                ) : (
                  <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
                )}
                {mode === "password" && (
                  <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
                )}
                <Button type="submit" variant="hero" className="w-full" disabled={busy}>
                  {busy ? "Please wait…" : mode === "password" ? "Sign in" : mode === "forgot" ? "Send reset code" : "Send code"}
                </Button>
              </form>

              <div className="mt-3 flex justify-between text-xs">
                {mode !== "password" ? (
                  <button type="button" className="font-semibold text-primary" onClick={() => { setMode("password"); setMethod("email"); }}>Use password instead</button>
                ) : (
                  <button type="button" className="font-semibold text-primary" onClick={() => setMode("signin")}>Use a code instead</button>
                )}
                {(mode === "password" || mode === "signin") && (
                  <button type="button" className="font-semibold text-primary" onClick={() => setMode("forgot")}>Forgot password?</button>
                )}
              </div>

              <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
              <Button variant="outline" className="w-full" onClick={google}>Continue with Google</Button>
              {mode === "signup" && role === "driver" && (
                <p className="mt-2 text-center text-xs text-muted-foreground">Google sign-up creates a rider account. Use email or phone to register as a driver.</p>
              )}

              <p className="mt-4 text-center text-xs text-muted-foreground">
                By continuing you agree to our <Link to="/terms" className="font-semibold text-primary">Terms</Link> and <Link to="/privacy" className="font-semibold text-primary">Privacy policy</Link>.
              </p>
              <p className="mt-3 text-center text-sm text-muted-foreground">
                {mode === "signup" ? "Already have an account?" : "New to Pink Wheel?"}{" "}
                <button className="font-semibold text-primary" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
                  {mode === "signup" ? "Sign in" : "Create account"}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
