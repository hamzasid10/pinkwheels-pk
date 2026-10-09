import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Brand";
import { SITE } from "@/lib/site";

export const INFO_LINKS = [
  { to: "/about", label: "About us" },
  { to: "/contact", label: "Contact & support" },
  { to: "/safety", label: "Safety guidelines" },
  { to: "/privacy", label: "Privacy policy" },
  { to: "/terms", label: "Terms of service" },
] as const;

export function InfoPage({ title, updated, children }: { title: string; updated?: boolean; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-blush">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Logo />
          <button type="button" onClick={() => history.length > 1 ? history.back() : (location.href = "/")} className="flex items-center gap-1 text-sm font-semibold text-primary">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
        {updated && <p className="mt-1 text-sm text-muted-foreground">Last updated: {SITE.lastUpdated}</p>}
        <article className="mt-6 space-y-5 rounded-3xl border bg-card p-6 text-[15px] leading-relaxed shadow-card sm:p-8 [&_h2]:mt-2 [&_h2]:text-xl [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
          {children}
        </article>
        <InfoFooter />
      </main>
    </div>
  );
}

export function InfoFooter() {
  return (
    <nav aria-label="Legal and help" className="mt-8 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
      {INFO_LINKS.map((l) => (
        <Link key={l.to} to={l.to} className="font-medium text-muted-foreground hover:text-primary">{l.label}</Link>
      ))}
      <span className="w-full text-center text-xs text-muted-foreground">© {new Date().getFullYear()} {SITE.name} · Version {SITE.version}</span>
    </nav>
  );
}
