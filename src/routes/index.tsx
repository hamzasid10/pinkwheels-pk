import { MobileMenu } from "@/components/MobileMenu";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck, Bike, Car, Clock, HeartHandshake, KeyRound, Mail, MapPin, Phone, Share2,
  ShieldAlert, ShieldCheck, Sparkles, UserCheck, Users, Wallet, Radio, Flag, Headphones,
} from "lucide-react";
import hero from "@/assets/hero.jpg";
import { Logo } from "@/components/Brand";
import { InfoFooter } from "@/components/InfoPage";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pink Wheel — Safe Rides. By Women. For Women." },
      { name: "description", content: "Pink Wheel connects women riders with verified women drivers. Book a car, scooty or bike safely." },
      { property: "og:title", content: "Pink Wheel — Safe Rides. By Women. For Women." },
      { property: "og:description", content: "Women Moving Women. Verified female drivers, SOS, trip PIN and live ride status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const steps = [
  { icon: MapPin, t: "Request", d: "Enter pickup, destination and pick Car, Scooty or Bike." },
  { icon: UserCheck, t: "Get matched", d: "We assign a verified female driver near you." },
  { icon: KeyRound, t: "Ride with PIN", d: "Share your Trip PIN to start. Track every step." },
];
const why = [
  { icon: Users, t: "Women only", d: "Every driver and every rider is a woman." },
  { icon: BadgeCheck, t: "Verified drivers", d: "CNIC, licence and vehicle checked by our team." },
  { icon: Wallet, t: "Fair prices", d: "See the estimated fare before you book." },
  { icon: HeartHandshake, t: "Community", d: "Built to create safe income for women drivers." },
];
const safety = [
  { icon: ShieldCheck, t: "Female-only verified drivers" },
  { icon: Users, t: "Female-only riders" },
  { icon: ShieldAlert, t: "SOS emergency button" },
  { icon: Share2, t: "Share trip" },
  { icon: Phone, t: "Emergency contact" },
  { icon: BadgeCheck, t: "Driver verification" },
  { icon: KeyRound, t: "Trip PIN" },
  { icon: Radio, t: "Live ride status" },
  { icon: Flag, t: "Report driver / rider" },
  { icon: Headphones, t: "24/7 support" },
];
const vehicles = [
  { icon: Car, t: "Car", d: "Comfort for up to 4. From Rs 250." },
  { icon: Sparkles, t: "Scooty", d: "Light, nimble city rides. From Rs 120." },
  { icon: Bike, t: "Bike", d: "Fastest through traffic. From Rs 100." },
];
const faqs = [
  { q: "Is Pink Wheel only for women?", a: "Yes. Both riders and drivers on Pink Wheel are women, verified at signup." },
  { q: "How are drivers verified?", a: "Drivers upload their CNIC, driving licence, vehicle documents and a profile photo. Our team reviews every application before approval." },
  { q: "What is a Trip PIN?", a: "A 4-digit code shown to you after booking. Your driver must enter it to start the ride, so you know it's the right car." },
  { q: "What happens if I press SOS?", a: "Our safety team is alerted immediately with your ride details, and you can call emergency services in one tap." },
  { q: "Which cities do you serve?", a: "We're launching city by city. Book a ride to check availability in your area." },
];

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
      <h2 className="mt-2 max-w-xl text-3xl font-semibold sm:text-4xl">{title}</h2>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <div className="flex min-w-0 items-center gap-1"><MobileMenu className="-ml-2" /><Logo /></div>
          <nav className="hidden gap-6 text-sm font-medium text-muted-foreground md:flex">
            <a href="#how">How it works</a>
            <a href="#safety">Safety</a>
            <a href="#drive">Drive</a>
            <a href="#faq">FAQ</a>
          </nav>
          <Button size="sm" variant="outline" asChild>
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-blush">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-10 md:grid-cols-2 md:pt-16">
          <div>
            <Logo variant="full" className="w-fit" />
            <h1 className="mt-5 text-5xl font-semibold leading-[1.02] sm:text-6xl">
              Safe Rides.<br />By Women.<br /><em className="text-primary">For Women.</em>
            </h1>
            <p className="mt-5 max-w-md text-lg text-muted-foreground">
              Pink Wheel connects women riders with verified women drivers for safer and more comfortable everyday travel.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button variant="hero" size="lg" asChild>
                <Link to="/book">Book Your Ride</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/auth" search={{ role: "driver" }}>Drive With Pink Wheel</Link>
              </Button>
            </div>
            <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" /> A safer ride platform created exclusively for women.
            </p>
          </div>
          <div className="relative">
            <img src={hero} alt="A woman driver smiling with a woman passenger" width={1280} height={1024} className="aspect-[5/4] w-full rounded-[2rem] object-cover shadow-card" />
            <div className="absolute -bottom-5 left-4 flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-card">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-success/15 text-success"><BadgeCheck className="h-5 w-5" /></span>
              <div className="text-sm"><p className="font-semibold">Verified driver</p><p className="text-muted-foreground">Trip PIN 4 2 1 8</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="text-3xl font-semibold sm:text-4xl">Going Your Way? Share the Ride.</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">Offer your empty seat or find a verified woman already travelling in your direction. Save money, share the journey, and travel safely with Pink Wheel.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            { to: "/book" as const, icon: Car, t: "Book a Ride", d: "A private Pink Wheel ride with a verified female driver." },
            { to: "/pool" as const, icon: Users, t: "Pink Pool", d: "Find cheaper shared rides already offered by women drivers." },
            { to: "/offer" as const, icon: MapPin, t: "Offer My Route", d: "Driving somewhere anyway? Post your journey and share empty seats." },
          ].map((c) => (
            <Link key={c.t} to={c.to} className="group rounded-3xl border bg-card p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-card">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-rose text-primary-foreground"><c.icon className="h-6 w-6" /></div>
              <p className="mt-4 font-display text-2xl font-semibold">{c.t}</p>
              <p className="mt-1 text-sm text-muted-foreground">{c.d}</p>
              <p className="mt-4 text-sm font-semibold text-primary">Get started →</p>
            </Link>
          ))}
        </div>
      </section>

      <Section id="how" eyebrow="How it works" title="Three simple steps to a safer ride">
        <div className="grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.t} className="rounded-2xl border bg-card p-6 shadow-card">
              <div className="flex items-center justify-between">
                <s.icon className="h-6 w-6 text-primary" />
                <span className="font-display text-3xl text-blush">0{i + 1}</span>
              </div>
              <h3 className="mt-4 text-xl font-semibold">{s.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </Section>

      <div className="bg-secondary/60">
        <Section id="why" eyebrow="Why Pink Wheel" title="Designed around trust, from the first tap">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {why.map((w) => (
              <div key={w.t} className="rounded-2xl bg-card p-6 shadow-soft">
                <w.icon className="h-6 w-6 text-primary" />
                <h3 className="mt-3 text-lg font-semibold">{w.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{w.d}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section id="safety" eyebrow="Safety features" title="Safety isn't a feature. It's the whole point.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {safety.map((s) => (
            <div key={s.t} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-accent text-accent-foreground"><s.icon className="h-5 w-5" /></span>
              <p className="text-sm font-semibold leading-snug">{s.t}</p>
            </div>
          ))}
        </div>
      </Section>

      <div className="bg-secondary/60">
        <Section id="vehicles" eyebrow="Vehicle options" title="Choose the ride that fits your day">
          <div className="grid gap-4 sm:grid-cols-3">
            {vehicles.map((v) => (
              <div key={v.t} className="rounded-2xl bg-card p-6 shadow-soft">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-rose text-primary-foreground"><v.icon className="h-6 w-6" /></span>
                <h3 className="mt-4 text-2xl font-semibold">{v.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{v.d}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <section id="drive" className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-8 overflow-hidden rounded-[2rem] bg-gradient-rose p-8 text-primary-foreground shadow-glow sm:p-12 md:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-80">Become a driver</p>
            <h2 className="mt-2 text-4xl font-semibold">Earn on your schedule, with riders you can trust.</h2>
          </div>
          <div className="flex flex-col justify-center gap-4">
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2"><Clock className="h-4 w-4" /> Choose your own working hours</li>
              <li className="flex gap-2"><Users className="h-4 w-4" /> Only women riders, ever</li>
              <li className="flex gap-2"><Wallet className="h-4 w-4" /> Track daily and total earnings</li>
            </ul>
            <Button variant="secondary" size="lg" className="w-fit" asChild>
              <Link to="/auth" search={{ role: "driver" }}>Become a Driver</Link>
            </Button>
          </div>
        </div>
      </section>

      <Section id="faq" eyebrow="FAQ" title="Questions, answered">
        <Accordion type="single" collapsible className="max-w-2xl rounded-2xl border bg-card px-5">
          {faqs.map((f) => (
            <AccordionItem key={f.q} value={f.q}>
              <AccordionTrigger className="text-left font-semibold">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Section>

      <footer id="contact" className="border-t bg-secondary/50">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-12 sm:grid-cols-3">
          <div>
            <Logo variant="full" className="w-fit" />
          </div>
          <div className="text-sm">
            <p className="font-semibold">Contact</p>
            <p className="mt-2 flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" /> Hamza.icaruss@gmail.com</p>
            <p className="mt-1 flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" /> +92 340 6289894</p>
          </div>
          <div className="text-sm">
            <p className="font-semibold">24/7 Safety line</p>
            <p className="mt-2 text-muted-foreground">Always here, day or night.</p>
          </div>
        </div>
        <InfoFooter />
        <div className="pb-8" />
      </footer>
    </div>
  );
}
