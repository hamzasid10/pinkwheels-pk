import { createServerFn } from "@tanstack/react-start";

// Returns the user's own referrer-restricted Google Maps browser key (safe to expose:
// Google only accepts it from pinkwheelpk.com). Used on the custom domain, where the
// managed Lovable key is not authorised.
export const getMapsBrowserKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: process.env["GOOGLE_API_KEY"] ?? null };
});
