import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Pink Wheel" }, { name: "description", content: "Open your Pink Wheel account and continue to your rides." }, { property: "og:title", content: "Dashboard — Pink Wheel" }, { property: "og:description", content: "Open your Pink Wheel account and continue to your rides." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  beforeLoad: async ({ context }) => {
    const uid = context.user.id;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    const r = (roles ?? []).map((x) => x.role);
    if (r.includes("admin")) throw redirect({ to: "/admin" });
    if (r.includes("driver")) {
      const { data: d } = await supabase.from("drivers").select("user_id").eq("user_id", uid).maybeSingle();
      throw redirect({ to: d ? "/driver" : "/driver-register" });
    }
    throw redirect({ to: "/rider" });
  },
});
