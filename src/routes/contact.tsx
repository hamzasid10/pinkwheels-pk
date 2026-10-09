import { createFileRoute } from "@tanstack/react-router";
import { Mail, Phone, ShieldAlert } from "lucide-react";
import { InfoPage } from "@/components/InfoPage";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact & Support — Pink Wheel" },
      { name: "description", content: "Get help with rides, Pink Pool, driver applications or your account." },
      { property: "og:title", content: "Contact & Support — Pink Wheel" },
      { property: "og:description", content: "Get help with rides, Pink Pool, driver applications or your account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <InfoPage title="Contact & Support">
      <p>We're here to help with rides, Pink Pool, driver applications and your account.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <a href={`mailto:${SITE.supportEmail}`} className="flex items-center gap-3 rounded-2xl border p-4 hover:bg-accent">
          <Mail className="h-5 w-5 text-primary" /><span><b className="block">Email</b><span className="break-all text-sm text-muted-foreground">{SITE.supportEmail}</span></span>
        </a>
        <a href={`tel:${SITE.supportPhoneTel}`} className="flex items-center gap-3 rounded-2xl border p-4 hover:bg-accent">
          <Phone className="h-5 w-5 text-primary" /><span><b className="block">Phone / WhatsApp</b><span className="text-sm text-muted-foreground">{SITE.supportPhone}</span></span>
        </a>
      </div>
      <a href={`tel:${SITE.emergencyNumber}`} className="flex items-center gap-3 rounded-2xl border-2 border-destructive/40 p-4">
        <ShieldAlert className="h-5 w-5 text-destructive" /><span><b className="block">Emergency</b><span className="text-sm text-muted-foreground">Call {SITE.emergencyNumber} (Rescue) — or press SOS during a trip.</span></span>
      </a>
      <h2>Common questions</h2>
      <ul>
        <li><b>My driver application is pending:</b> our team reviews documents, usually within 1–2 working days.</li>
        <li><b>I forgot my password:</b> use "Forgot password?" on the sign-in page.</li>
        <li><b>Delete my account:</b> open Account → Delete account.</li>
      </ul>
    </InfoPage>
  ),
});
