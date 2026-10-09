import { createFileRoute } from "@tanstack/react-router";
import { InfoPage } from "@/components/InfoPage";
import { SITE } from "@/lib/site";
import { Logo } from "@/components/Brand";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us — Pink Wheel" },
      { name: "description", content: "Pink Wheel is a women-only ride platform in Pakistan: verified female drivers for women riders." },
      { property: "og:title", content: "About Us — Pink Wheel" },
      { property: "og:description", content: "Women Moving Women — verified female drivers for women riders in Pakistan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <InfoPage title="About Pink Wheel">
      <Logo variant="full" className="justify-center" />
      <p><b>Women Moving Women.</b> Pink Wheel is a ride platform made only for women in Pakistan — every rider and every driver is a woman.</p>
      <p>Book a car, scooty or bike with a verified female driver, or share a seat on a driver's route with Pink Pool for a lower price. Every trip has a Trip PIN, live tracking, SOS and trip sharing.</p>
      <p>We currently serve Lahore, Gujranwala, Islamabad and Rawalpindi.</p>
      <p className="text-sm text-muted-foreground">App version {SITE.version}</p>
    </InfoPage>
  ),
});
