import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Car, User } from "lucide-react";
import { Logo } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { role?: "driver" } =>
    s["role"] === "driver" ? { role: "driver" } : {},
  head: () => ({
    meta: [
      { title: "Sign in — Pink Wheel" },
      { name: "description", content: "Sign in or create your Pink Wheel rider or driver account." },
      { property: "og:title", content: "Sign in — Pink Wheel" },
      { property: "og:description", content: "Join Pink Wheel as a rider or a driver." },
    ],
  }),
  component: AuthPage,
});

const signupSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your name").max(100),
  phone: z.string().trim().min(7, "Enter a valid phone").max(20),
  email: z.string().trim().email().max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

function AuthPage() {
  const { role: initialRole } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">(initialRole ? "signup" : "signin");
  const [role, setRole] = useState<"rider" | "driver">(initialRole ?? "rider");
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      } else {
        const parsed = signupSchema.safeParse(form);
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: parsed.data.full_name, phone: parsed.data.phone, role },
          },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/dashboard" });
        else toast.success("Check your email to confirm your account, then sign in.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) return toast.error("Google sign-in failed");
    if (r.redirected) return;
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-blush px-4 py-10">
      <div className="w-full max-w-md">
        <Logo className="mb-6 justify-center" />
        <div className="rounded-3xl border bg-card p-6 shadow-card sm:p-8">
          <h1 className="text-3xl font-semibold">{mode === "signin" ? "Welcome back" : "Join Pink Wheel"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pink Wheel is for women only.</p>

          {mode === "signup" && (
            <div className="mt-5 grid grid-cols-2 gap-2">
              {(["rider", "driver"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-2xl border-2 p-3 text-sm font-semibold transition",
                    role === r ? "border-primary bg-accent" : "border-border",
                  )}
                >
                  {r === "rider" ? <User className="h-5 w-5" /> : <Car className="h-5 w-5" />}
                  I'm a {r}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={submit} className="mt-5 space-y-3">
            {mode === "signup" && (
              <>
                <div><Label>Full name</Label><Input value={form.full_name} onChange={set("full_name")} required /></div>
                <div><Label>Phone number</Label><Input type="tel" value={form.phone} onChange={set("phone")} required /></div>
              </>
            )}
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={set("email")} required /></div>
            <div><Label>Password</Label><Input type="password" value={form.password} onChange={set("password")} required /></div>
            <Button type="submit" variant="hero" className="w-full" disabled={busy}>
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : `Create ${role} account`}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
          <Button variant="outline" className="w-full" onClick={google}>Continue with Google</Button>
          {mode === "signup" && role === "driver" && (
            <p className="mt-2 text-center text-xs text-muted-foreground">Google sign-up creates a rider account. Use email to register as a driver.</p>
          )}

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "New to Pink Wheel?" : "Already have an account?"}{" "}
            <button className="font-semibold text-primary" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
              {mode === "signin" ? "Create account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
