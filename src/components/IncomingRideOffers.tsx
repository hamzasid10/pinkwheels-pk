import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { dispatchLog, offerSeconds } from "@/lib/ride-dispatch";
import { pkr } from "@/lib/pink";

export function IncomingRideOffers({ uid, enabled }: { uid: string | undefined; enabled: boolean }) {
  const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const offers = useQuery({
    queryKey: ["incoming-offers", uid], enabled: !!uid && enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("incoming_ride_offers");
      if (error) throw error;
      return data ?? [];
    },
  });
  useEffect(() => {
    if (!uid || !enabled) return;
    let live = true;
    const refresh = async () => {
      const { error } = await supabase.rpc("dispatch_tick", {});
      if (error) dispatchLog("dispatch failed", error.message);
      if (live) void qc.invalidateQueries({ queryKey: ["incoming-offers", uid] });
    };
    const channel = supabase.channel(`offers-${uid}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_offers", filter: `driver_id=eq.${uid}` }, (payload) => {
        dispatchLog("incoming offer", payload.new);
        void qc.invalidateQueries({ queryKey: ["incoming-offers", uid] });
        void qc.invalidateQueries({ queryKey: ["driver-rides", uid] });
      }).subscribe((status) => { dispatchLog("subscription", status); if (status === "SUBSCRIBED") void refresh(); });
    void refresh();
    const timer = setInterval(() => { setNow(Date.now()); }, 1000);
    const fallback = setInterval(refresh, 3000);
    return () => { live = false; clearInterval(timer); clearInterval(fallback); void supabase.removeChannel(channel); };
  }, [uid, enabled, qc]);

  async function respond(id: string, accept: boolean) {
    if (busy) return;
    setBusy(id);
    try {
      const { error } = await supabase.rpc("respond_ride_offer", { _offer: id, _accept: accept });
      if (error) throw error;
      dispatchLog(accept ? "driver accepted" : "driver declined", id);
      toast.success(accept ? "Ride accepted" : "Offer declined");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't respond to the offer."); }
    finally { setBusy(null); void qc.invalidateQueries({ queryKey: ["incoming-offers", uid] }); void qc.invalidateQueries({ queryKey: ["driver-rides", uid] }); }
  }
  if (!enabled) return null;
  if (offers.isError) return <p role="alert" className="text-sm text-destructive">Incoming requests couldn't load. <Button size="sm" variant="outline" onClick={() => offers.refetch()}>Try again</Button></p>;
  const pending = (offers.data ?? []).filter((offer) => offerSeconds(offer.expires_at, now) > 0);
  return <div aria-live="polite" className="space-y-3">
    {pending.map((offer) => <article key={offer.id} className="rounded-xl border bg-muted p-3 text-sm">
      <div className="flex justify-between gap-2"><b>Incoming ride</b><span className="text-primary">{offerSeconds(offer.expires_at, now)}s</span></div>
      <p className="mt-2 font-semibold">{offer.pickup} → {offer.destination}</p>
      <p className="mt-1 text-muted-foreground">{offer.pickup_distance_km} km to pickup · {offer.distance_km ?? "—"} km trip · {offer.duration_min ?? "—"} min</p>
      <p className="mt-1"><span className="capitalize">{offer.vehicle}</span> · {pkr(offer.fare)}</p>
      <div className="mt-3 flex gap-2"><Button size="sm" disabled={!!busy} onClick={() => respond(offer.id, true)}>Accept</Button><Button size="sm" variant="outline" disabled={!!busy} onClick={() => respond(offer.id, false)}>Decline</Button></div>
    </article>)}
    {!pending.length && <p className="text-sm text-muted-foreground">No incoming offers.</p>}
  </div>;
}