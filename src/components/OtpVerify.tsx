import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Turns auth errors into plain, friendly messages. */
export function otpErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const m = raw.toLowerCase();
  if (m.includes("expired")) return "This code has expired. Tap “Resend code” to get a new one.";
  if (m.includes("invalid") || m.includes("token")) return "That code isn't right. Please check and try again.";
  if (m.includes("rate") || m.includes("too many") || m.includes("security purposes") || m.includes("429"))
    return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("sms") || m.includes("phone provider") || m.includes("unsupported phone"))
    return "Phone codes aren't available yet. Please use your email instead.";
  if (m.includes("signups not allowed") || m.includes("user not found"))
    return "No account found. Please create an account first.";
  return raw || "Something went wrong. Please try again.";
}

const MAX_TRIES = 5;

export function OtpVerify({
  target,
  onVerify,
  onResend,
  onChange,
  changeLabel = "Change email/phone",
}: {
  target: string;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onChange: () => void;
  changeLabel?: string;
}) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(60);
  const [tries, setTries] = useState(0);
  const lock = useRef(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  useEffect(() => refs.current[0]?.focus(), []);

  async function verify(code: string) {
    if (lock.current || code.length !== 6) return;
    if (tries >= MAX_TRIES) return setError("Too many wrong codes. Please request a new code.");
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await onVerify(code);
    } catch (e) {
      setTries((n) => n + 1);
      setError(otpErrorMessage(e));
      setDigits(["", "", "", "", "", ""]);
      refs.current[0]?.focus();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function setAt(i: number, v: string) {
    const clean = v.replace(/\D/g, "");
    if (clean.length > 1) {
      const next = clean.slice(0, 6).split("");
      const d = [...next, ...Array(6 - next.length).fill("")];
      setDigits(d);
      refs.current[Math.min(next.length, 5)]?.focus();
      if (next.length === 6) verify(next.join(""));
      return;
    }
    const d = [...digits];
    d[i] = clean;
    setDigits(d);
    if (clean && i < 5) refs.current[i + 1]?.focus();
    if (d.every(Boolean)) verify(d.join(""));
  }

  async function resend() {
    if (lock.current || left > 0) return;
    lock.current = true;
    setError(null);
    try {
      await onResend();
      setTries(0);
      setLeft(60);
    } catch (e) {
      setError(otpErrorMessage(e));
    } finally {
      lock.current = false;
    }
  }

  return (
    <div className="text-center">
      <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
      <h2 className="mt-3 text-2xl font-semibold">Enter your code</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        We sent a 6-digit code to <b className="text-foreground">{target}</b>
      </p>
      <div className="mt-6 flex justify-center gap-2">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            value={d}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            aria-label={`Digit ${i + 1}`}
            maxLength={6}
            disabled={busy}
            onChange={(e) => setAt(i, e.target.value)}
            onKeyDown={(e) => { if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus(); }}
            className={cn(
              "h-14 w-11 rounded-2xl border-2 bg-background text-center text-2xl font-semibold outline-none transition focus:border-primary sm:w-12",
              error ? "border-destructive" : "border-border",
            )}
          />
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
      <Button variant="hero" className="mt-6 w-full" disabled={busy || digits.some((x) => !x)} onClick={() => verify(digits.join(""))}>
        {busy ? "Verifying…" : "Verify"}
      </Button>
      <div className="mt-4 flex items-center justify-between text-sm">
        <button type="button" className="font-semibold text-primary" onClick={onChange}>{changeLabel}</button>
        <button type="button" className="font-semibold text-primary disabled:text-muted-foreground" disabled={left > 0} onClick={resend}>
          {left > 0 ? `Resend code in ${left}s` : "Resend code"}
        </button>
      </div>
    </div>
  );
}

export const COUNTRY_CODES = [
  { code: "+92", label: "🇵🇰 +92" },
  { code: "+971", label: "🇦🇪 +971" },
  { code: "+966", label: "🇸🇦 +966" },
  { code: "+44", label: "🇬🇧 +44" },
  { code: "+1", label: "🇺🇸 +1" },
  { code: "+91", label: "🇮🇳 +91" },
];

/** Returns an E.164 number or null if invalid. */
export function toE164(cc: string, local: string): string | null {
  let n = local.replace(/[\s-()]/g, "");
  if (n.startsWith("+")) return /^\+[1-9]\d{7,14}$/.test(n) ? n : null;
  n = n.replace(/^0+/, "");
  if (cc === "+92" && !/^3\d{9}$/.test(n)) return null;
  const full = cc + n;
  return /^\+[1-9]\d{7,14}$/.test(full) ? full : null;
}
