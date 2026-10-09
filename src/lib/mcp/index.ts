import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMyRides from "./tools/list-my-rides";
import listPoolRoutes from "./tools/list-pool-routes";
import getFares from "./tools/get-fares";

// Vite inlines the stable ref; the published SUPABASE_URL may be a proxy.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "pink-wheels",
  title: "Pink Wheels",
  version: "0.1.0",
  instructions:
    "Tools for Pink Wheels, a women-only ride app in Pakistan. Read your own ride bookings, browse open Pink Pool shared routes, and check fare rates (PKR). All actions run as the signed-in user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
    requireOAuthClientClaim: true,
  }),
  tools: [listMyRides, listPoolRoutes, getFares],
});
