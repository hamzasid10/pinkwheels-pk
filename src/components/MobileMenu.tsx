import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Bell, Car, CarFront, HelpCircle, Home, LayoutDashboard, LogIn, LogOut, Menu, Settings, ShieldCheck, User, Users, History,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/pink";
import { cn } from "@/lib/utils";
import brandIcon from "@/assets/pink-wheel-icon.png";

type Item = { label: string; to: string; icon: typeof Home; auth?: boolean };

export function MobileMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const user = me.data;
  const driver = useQuery({
    queryKey: ["menu-driver", user?.user.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("drivers").select("status").eq("user_id", user!.user.id).maybeSingle();
      return data?.status ?? null;
    },
  });
  const approved = driver.data === "approved";
  const isAdmin = user?.role === "admin";

  const items: Item[] = [
    { label: "Home", to: "/", icon: Home },
    { label: "Book a Ride", to: "/book", icon: Car, auth: true },
    { label: "My Rides", to: "/rider", icon: History, auth: true },
    { label: "Pink Pool (Shared Rides)", to: "/pool", icon: Users, auth: true },
    ...(!approved ? [{ label: "Become a Driver", to: "/driver-register", icon: CarFront, auth: true }] : []),
    ...(approved ? [{ label: "Driver Dashboard", to: "/driver", icon: LayoutDashboard, auth: true }] : []),
    ...(isAdmin ? [{ label: "Admin Dashboard", to: "/admin", icon: ShieldCheck, auth: true }] : []),
    { label: "My Profile", to: user?.role === "driver" || driver.data ? "/driver" : "/account", icon: User, auth: true },
    { label: "Notifications", to: "/rider", icon: Bell, auth: true },
    { label: "Help & Support", to: "/contact", icon: HelpCircle },
    { label: "Settings", to: "/account", icon: Settings, auth: true },
  ];

  function go(it: Item) {
    setOpen(false);
    if (it.auth && !user) return navigate({ to: "/auth", search: { next: it.to } });
    navigate({ to: it.to });
  }

  async function signOut() {
    setOpen(false);
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/" });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button type="button" aria-label="Open menu"
          className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full text-foreground transition hover:bg-accent md:hidden", className)}>
          <Menu className="h-6 w-6" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-[82vw] max-w-xs flex-col gap-0 bg-gradient-blush p-0 [&>button:first-child]:top-[calc(env(safe-area-inset-top)+1rem)]">
        <SheetHeader className="border-b bg-card/80 px-5 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] text-left">
          <SheetTitle className="flex items-center gap-2 font-display text-xl">
            <img src={brandIcon} alt="" className="h-9 w-8 object-contain" /> Pink Wheel
          </SheetTitle>
          <p className="truncate text-xs text-muted-foreground">
            {user ? `${user.profile?.full_name || user.user.email} · ${isAdmin ? "Admin" : approved ? "Driver" : "Rider"}` : "Welcome, guest"}
          </p>
        </SheetHeader>
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {items.map((it) => (
              <li key={it.label}>
                <button type="button" onClick={() => go(it)}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition hover:bg-card active:bg-accent">
                  <it.icon className="h-5 w-5 shrink-0 text-primary" /> {it.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t bg-card/80 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {user ? (
            <button type="button" onClick={signOut} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-destructive hover:bg-accent">
              <LogOut className="h-5 w-5" /> Sign Out
            </button>
          ) : (
            <Link to="/auth" onClick={() => setOpen(false)} className="flex w-full items-center gap-3 rounded-2xl bg-primary px-3 py-3 text-sm font-semibold text-primary-foreground">
              <LogIn className="h-5 w-5" /> Sign In
            </Link>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
