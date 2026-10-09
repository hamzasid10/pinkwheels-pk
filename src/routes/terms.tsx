import { createFileRoute, Link } from "@tanstack/react-router";
import { InfoPage } from "@/components/InfoPage";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Pink Wheel" },
      { name: "description", content: "The rules for using Pink Wheel as a rider or driver." },
      { property: "og:title", content: "Terms of Service — Pink Wheel" },
      { property: "og:description", content: "The rules for using Pink Wheel as a rider or driver." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <InfoPage title="Terms of Service" updated>
      <p>By creating an account or using Pink Wheel you agree to these terms.</p>
      <h2>1. Who can use Pink Wheel</h2>
      <p>Pink Wheel is for women only, aged 18 or over. Drivers must hold a valid Pakistani CNIC and driving licence and pass our verification. We may refuse, suspend or remove any account that breaks these terms.</p>
      <h2>2. Our role</h2>
      <p>Pink Wheel connects riders with independent women drivers. Drivers provide the transport; we provide the platform, verification and safety tools.</p>
      <h2>3. Fares and payment</h2>
      <p>Fares are shown in Pakistani Rupees before you book and are paid in cash to the driver. Pink Pool seat prices are set by the driver. Online payments are not yet available.</p>
      <h2>4. Cancellations</h2>
      <p>Riders can cancel before the ride starts. Repeated late cancellations or no-shows may lead to suspension.</p>
      <h2>5. Conduct</h2>
      <p>Everyone must follow our <Link to="/safety" className="font-semibold text-primary">Safety guidelines</Link>. Harassment, discrimination, unsafe driving, false information or misuse of SOS is not allowed.</p>
      <h2>6. Driver responsibilities</h2>
      <p>Drivers must keep their documents, vehicle and insurance valid, drive lawfully, and only start a trip after the rider shares the correct Trip PIN.</p>
      <h2>7. Liability</h2>
      <p>To the extent allowed by Pakistani law, Pink Wheel is not liable for indirect losses arising from trips. In an emergency always call {SITE.emergencyNumber} (Rescue) first.</p>
      <h2>8. Ending your account</h2>
      <p>You can delete your account at any time in Account settings. See our <Link to="/privacy" className="font-semibold text-primary">Privacy policy</Link> for what happens to your data.</p>
      <h2>9. Changes</h2>
      <p>We may update these terms. We'll show the new date above, and continuing to use the app means you accept the changes.</p>
      <h2>10. Contact</h2>
      <p><a className="font-semibold text-primary" href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a> · {SITE.supportPhone}</p>
    </InfoPage>
  ),
});
