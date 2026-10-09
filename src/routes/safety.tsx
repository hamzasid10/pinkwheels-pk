import { createFileRoute } from "@tanstack/react-router";
import { InfoPage } from "@/components/InfoPage";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/safety")({
  head: () => ({
    meta: [
      { title: "Safety & Community Guidelines — Pink Wheel" },
      { name: "description", content: "How Pink Wheel keeps women riders and drivers safe, and what we expect from everyone." },
      { property: "og:title", content: "Safety & Community Guidelines — Pink Wheel" },
      { property: "og:description", content: "How Pink Wheel keeps women riders and drivers safe." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <InfoPage title="Safety & Community Guidelines">
      <p>Pink Wheel exists so women can move around safely. These guidelines apply to every rider and driver.</p>
      <h2>Before your ride</h2>
      <ul>
        <li>Check the driver's name, vehicle and registration number match the app.</li>
        <li>Never get in until the driver asks for your 4-digit <b>Trip PIN</b>. Don't share it before.</li>
        <li>Add an emergency contact in your dashboard.</li>
      </ul>
      <h2>During your ride</h2>
      <ul>
        <li>Use <b>Share trip</b> to send your trip to someone you trust.</li>
        <li>Press <b>SOS</b> if you feel unsafe — our team is alerted immediately.</li>
        <li>In an emergency call <b>{SITE.emergencyNumber}</b> (Rescue/Police) straight away.</li>
      </ul>
      <h2>Community rules</h2>
      <ul>
        <li>Pink Wheel is for women only. Bringing male passengers or companions is not allowed unless agreed in advance for children.</li>
        <li>Be respectful. No harassment, abusive language, or discrimination.</li>
        <li>Drivers must follow traffic laws and never use a phone while driving.</li>
        <li>Do not share another person's phone number or trip details outside the app.</li>
        <li>False reports or misuse of SOS may lead to suspension.</li>
      </ul>
      <h2>Reporting</h2>
      <p>Use the report button on any trip, or contact us at <a className="font-semibold text-primary" href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a> / {SITE.supportPhone}. Serious reports lead to immediate suspension while we investigate.</p>
    </InfoPage>
  ),
});
