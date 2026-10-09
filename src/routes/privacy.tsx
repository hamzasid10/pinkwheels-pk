import { createFileRoute } from "@tanstack/react-router";
import { InfoPage } from "@/components/InfoPage";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Pink Wheel" },
      { name: "description", content: "How Pink Wheel collects, uses and protects your personal and location data." },
      { property: "og:title", content: "Privacy Policy — Pink Wheel" },
      { property: "og:description", content: "How Pink Wheel collects, uses and protects your personal and location data." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <InfoPage title="Privacy Policy" updated>
      <p>Pink Wheel ("we", "us") is a women-only ride platform in Pakistan. This policy explains what we collect, why, and the choices you have.</p>
      <h2>What we collect</h2>
      <ul>
        <li><b>Account details:</b> name, email address, phone number and your role (rider or driver).</li>
        <li><b>Driver verification:</b> CNIC number, driving licence number, city, vehicle details, emergency contact and uploaded documents (CNIC, licence, vehicle papers, profile photo).</li>
        <li><b>Trips:</b> pickup and drop-off places, date and time, route, distance, fare, trip status and ratings.</li>
        <li><b>Location:</b> see the section below.</li>
        <li><b>Safety reports:</b> complaints, SOS alerts and reports you send us.</li>
      </ul>
      <h2>How we use location</h2>
      <ul>
        <li><b>Riders:</b> we only read your GPS position when you tap "Use my location". You can always type an address instead.</li>
        <li><b>Drivers:</b> your position is shared only while you have turned on location sharing <i>and</i> are online. It updates about every 10 seconds and stops when you go offline.</li>
        <li>Your exact live position is visible only to the rider of your current trip and to Pink Wheel admins. Other riders see nearby drivers as unnamed, approximate dots.</li>
        <li>Addresses and routes are looked up using Google Maps.</li>
      </ul>
      <h2>Who can see your information</h2>
      <ul>
        <li>Riders and drivers on the same trip see each other's first name, phone number (for the trip), vehicle and trip details.</li>
        <li>Driver CNIC, licence and documents are seen only by Pink Wheel admins for verification — never by riders.</li>
        <li>We do not sell your personal data. We share it only with service providers that run the app (hosting, maps, email/SMS) or when required by Pakistani law.</li>
      </ul>
      <h2>How long we keep it</h2>
      <p>We keep your data while your account is active. When you delete your account, we delete your profile, contacts, saved places and driver documents, and remove your name and phone number from past trip records. Anonymous trip records may be kept for safety, fraud prevention and legal reasons.</p>
      <h2>Your choices</h2>
      <ul>
        <li>Edit your profile, email and phone in <b>Account</b>.</li>
        <li>Turn location sharing off at any time (drivers).</li>
        <li>Delete your account at any time from <b>Account → Delete account</b>.</li>
      </ul>
      <h2>Security</h2>
      <p>Each person can only access their own data. Sign-in uses verification codes or passwords, and documents are stored privately.</p>
      <h2>Contact</h2>
      <p>Questions about privacy: <a className="font-semibold text-primary" href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a> · {SITE.supportPhone}</p>
    </InfoPage>
  ),
});
