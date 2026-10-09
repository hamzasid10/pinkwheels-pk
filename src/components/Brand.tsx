import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Phone, Share2, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_FLOW, STATUS_LABEL, type RideStatus } from "@/lib/pink";
import { cn } from "@/lib/utils";
import fullLogo from "@/assets/pink-wheel-full.png.asset.json";
import brandIcon from "@/assets/pink-wheel-icon.png";

export function Logo({ className, variant = "compact" }: { className?: string; variant?: "compact" | "full" }) {
  return (
    <Link to="/" aria-label="Pink Wheel home" className={cn("flex shrink-0 items-center gap-2", className)}>
      {variant === "full" ? (
        <img src={fullLogo.url} alt="Pink Wheel — Women Moving Women" width={512} height={512} className="aspect-square w-40 max-w-full object-contain sm:w-44" />
      ) : (
        <>
          <img src={brandIcon} alt="" width={36} height={36} className="h-9 w-8 shrink-0 object-contain" />
          <span className="whitespace-nowrap font-display text-lg font-semibold sm:text-xl">Pink Wheel</span>
        </>
      )}
    </Link>
  );
}

export function BrandSplash() {
  return (
    <div role="status" aria-label="Loading Pink Wheel" className="grid min-h-screen place-items-center bg-gradient-blush">
      <div className="flex flex-col items-center gap-5">
        <img src={fullLogo.url} alt="Pink Wheel — Women Moving Women" width={512} height={512} className="aspect-square w-52 max-w-full object-contain" />
        <span className="h-5 w-5 rounded-full border-2 border-primary/20 border-t-primary motion-safe:animate-spin" />
      </div>
    </div>
  );
}

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return (
    <div className="min-h-screen bg-gradient-blush">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Logo />
          <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/account" })}>Account</Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Sign out"
            onClick={async () => {
              await supabase.auth.signOut();
              qc.clear();
              navigate({ to: "/" });
            }}
          >
            <LogOut /><span className="hidden sm:inline">Sign out</span>
          </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="mb-5 text-3xl font-semibold">{title}</h1>
        {children}
      </main>
    </div>
  );
}

export function Panel({ title, icon, children, className }: { title?: string; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border bg-card p-5 shadow-card", className)}>
      {title && (
        <h2 className="mb-3 flex items-center gap-2 font-sans text-sm font-bold uppercase tracking-wider text-muted-foreground">
          {icon}
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

export function StatusPill({ status }: { status: RideStatus }) {
  const tone =
    status === "completed"
      ? "bg-success/15 text-success"
      : status === "cancelled"
        ? "bg-destructive/10 text-destructive"
        : "bg-accent text-accent-foreground";
  return <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", tone)}>{STATUS_LABEL[status]}</span>;
}

export function StatusTrack({ status }: { status: RideStatus }) {
  const idx = STATUS_FLOW.indexOf(status);
  return (
    <ol className="flex gap-1.5">
      {STATUS_FLOW.map((s, i) => (
        <li key={s} className="flex-1">
          <div className={cn("h-1.5 rounded-full", i <= idx ? "bg-primary" : "bg-muted")} />
          <p className={cn("mt-1 hidden text-[10px] sm:block", i <= idx ? "text-foreground" : "text-muted-foreground")}>
            {STATUS_LABEL[s].replace("Looking for a verified female driver", "Requested")}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function MapPlaceholder({ from, to }: { from: string; to: string }) {
  return (
    <div className="map-grid relative h-36 overflow-hidden rounded-xl border">
      <div className="absolute left-[18%] top-[62%] h-3 w-3 rounded-full bg-primary ring-4 ring-primary/25" />
      <div className="absolute right-[20%] top-[24%] h-3 w-3 rounded-full bg-foreground ring-4 ring-foreground/15" />
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        <path d="M20 65 C 40 60, 55 30, 79 26" stroke="var(--primary)" strokeWidth="1.2" strokeDasharray="3 2" fill="none" />
      </svg>
      <div className="absolute bottom-2 left-2 right-2 flex justify-between gap-2 text-[11px] font-medium">
        <span className="truncate rounded-full bg-card/90 px-2 py-0.5">{from}</span>
        <span className="truncate rounded-full bg-card/90 px-2 py-0.5">{to}</span>
      </div>
    </div>
  );
}

export function SafetyActions({ rideId, shareText }: { rideId?: string; shareText: string }) {
  async function sos() {
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      await supabase.from("complaints").insert({
        user_id: u.user.id,
        ride_id: rideId ?? null,
        kind: "emergency",
        message: "SOS button pressed",
      });
    }
    toast.error("SOS sent. Our safety team has been alerted. Call 15 for police.");
  }
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "My Pink Wheel trip", text: shareText });
      } catch {
        /* dismissed */
      }
    } else {
      await navigator.clipboard.writeText(shareText);
      toast.success("Trip details copied — paste to share");
    }
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      <Button variant="sos" onClick={sos}>
        <ShieldAlert /> SOS
      </Button>
      <Button variant="outline" onClick={share}>
        <Share2 /> Share
      </Button>
      <Button variant="outline" asChild>
        <a href="tel:15">
          <Phone /> 15
        </a>
      </Button>
    </div>
  );
}
