import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, CarFront, ChevronRight, CreditCard, FileCheck, History, MapPin, Pencil, ShieldCheck, Star, UserRound, Users, Wallet, Power, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { pkr } from "@/lib/pink";
import { DRIVER_STATUS, driverTotals } from "@/lib/driver-profile";
import { cn } from "@/lib/utils";

type Driver = Database["public"]["Tables"]["drivers"]["Row"];
type Ride = Database["public"]["Tables"]["ride_requests"]["Row"];
type Doc = Database["public"]["Tables"]["driver_documents"]["Row"];
type Section = "personal" | "cnic" | "licence" | "vehicle" | "earnings" | "history" | "reviews" | null;
const TITLES = { personal: "Personal details", cnic: "CNIC verification", licence: "Driving licence", vehicle: "Vehicle details", earnings: "My earnings", history: "Trip history", reviews: "Ratings & reviews" };

export function DriverProfile({ driver: d, rides, docs, sharing, suspended, onOnline }: { driver: Driver; rides: Ride[]; docs: Doc[]; sharing: boolean; suspended: boolean; onOnline: () => void }) {
  const [section, setSection] = useState<Section>(null);
  const [draft, setDraft] = useState({ home_address: d.home_address ?? "", city: d.city, emergency_contact_name: d.emergency_contact_name ?? "", emergency_contact_phone: d.emergency_contact_phone ?? "" });
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const details = useQuery({
    queryKey: ["driver-profile", d.user_id],
    queryFn: async () => {
      const [vehicles, ratings, poolRatings, routes] = await Promise.all([
        supabase.from("vehicles").select("*").eq("driver_id", d.user_id).order("created_at"),
        supabase.from("ratings").select("stars,comment,created_at").eq("driver_id", d.user_id),
        supabase.from("pool_ratings").select("stars,comment,created_at").eq("driver_id", d.user_id),
        supabase.from("pool_routes").select("id,status,start_location,destination,departure_date").eq("driver_id", d.user_id),
      ]);
      for (const result of [vehicles, ratings, poolRatings, routes]) if (result.error) throw result.error;
      const ids = (routes.data ?? []).map((r) => r.id);
      const seats = ids.length ? await supabase.from("pool_seat_requests").select("pool_route_id,request_status,fare").in("pool_route_id", ids) : { data: [], error: null };
      if (seats.error) throw seats.error;
      return { vehicles: vehicles.data ?? [], reviews: [...(ratings.data ?? []), ...(poolRatings.data ?? [])].sort((a,b) => b.created_at.localeCompare(a.created_at)), routes: routes.data ?? [], seats: seats.data ?? [] };
    },
  });
  const selfie = docs.filter((doc) => doc.doc_type === "selfie").sort((a,b) => b.created_at.localeCompare(a.created_at))[0];
  const photo = useQuery({ queryKey: ["driver-selfie", d.user_id, selfie?.file_path], enabled: !!selfie,
    staleTime: 240000, refetchInterval: 240000,
    queryFn: async () => {
      if (!selfie) return null;
      const { data, error } = await supabase.storage.from("driver-docs").createSignedUrl(selfie.file_path, 300);
      if (error) return null;
      return data.signedUrl;
    },
  });
  const totals = details.data ? driverTotals(rides, details.data.routes, details.data.seats) : null;
  const approved = d.status === "approved" && !suspended;
  const editableApplication = ["incomplete", "rejected", "info_requested"].includes(d.status);
  function open(next: Section) {
    setDraft({ home_address: d.home_address ?? "", city: d.city, emergency_contact_name: d.emergency_contact_name ?? "", emergency_contact_phone: d.emergency_contact_phone ?? "" });
    setSection(next);
  }
  async function save() {
    if (saving) return;
    if (draft.home_address.trim().length < 5 || draft.city.trim().length < 2 || draft.emergency_contact_name.trim().length < 2 || !/^(\+92|0)3\d{9}$/.test(draft.emergency_contact_phone.replace(/[\s-]/g, ""))) return toast.error("Enter your address, city and a valid Pakistani emergency contact.");
    setSaving(true);
    try {
      const { error, data } = await supabase.from("drivers").update({ ...draft, emergency_contact: `${draft.emergency_contact_name.trim()} — ${draft.emergency_contact_phone.trim()}` }).eq("user_id", d.user_id).select("user_id").single();
      if (error || !data) throw error ?? new Error("Profile wasn't saved");
      await qc.invalidateQueries({ queryKey: ["driver", d.user_id] });
      await qc.invalidateQueries({ queryKey: ["driver-app", d.user_id] });
      toast.success("Driver profile saved"); setSection(null);
    } catch { toast.error("Couldn't save your profile. Please try again."); } finally { setSaving(false); }
  }
  const row = (title: string, subtitle: string, Icon: typeof UserRound, action: () => void) => <Button key={title} variant="ghost" onClick={action} className="h-auto min-h-20 w-full justify-start gap-4 whitespace-normal rounded-none px-5 py-4 text-left"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-driver-blush text-driver-primary"><Icon className="!h-5 !w-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">{subtitle}</span></span><ChevronRight className="text-muted-foreground" /></Button>;
  const datum = (label: string, value: string | null | undefined) => <div key={label} className="border-b py-3 last:border-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-semibold">{value || "Not provided"}</dd></div>;
  return <div className="driver-profile mx-auto max-w-3xl">
    <section aria-label="Driver profile" className="pb-7 text-center">
      <div className="relative mx-auto w-24"><div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full border-4 border-card bg-driver-blush shadow-soft">{photo.data ? <img src={photo.data} alt={`${d.full_name}'s profile photo`} className="h-full w-full object-cover" /> : <UserRound className="h-10 w-10 text-driver-primary" />}</div><span className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full border-4 border-background bg-card text-driver-primary"><ShieldCheck className="h-5 w-5" /></span></div>
      <h2 className="mt-4 font-sans text-2xl font-bold">{d.full_name}</h2>
      <p className="mt-1 break-all text-xs text-muted-foreground">Driver ID · PW-{d.user_id.toUpperCase()}</p>
      <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{d.city || "City not provided"}, Pakistan</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3"><span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold", approved ? "bg-success/10 text-success" : "bg-driver-blush text-driver-primary")}><BadgeCheck className="h-4 w-4" />{suspended ? "Account suspended" : DRIVER_STATUS[d.status]}</span><Button size="sm" variant="outline" onClick={() => open("personal")}><Pencil />Edit profile</Button></div>
      <p className="mt-3 text-xs text-muted-foreground">Member since {new Date(d.created_at).toLocaleDateString("en-PK", { month: "short", year: "numeric" })}</p>
      {d.admin_note && !approved && <p className="mt-3 text-sm text-muted-foreground">{d.admin_note}</p>}
    </section>
    <div className="grid grid-cols-3 gap-2 sm:gap-4">
      {[{ label: "Driver rating", value: details.data ? (details.data.reviews.length ? Number(d.rating).toFixed(1) : "—") : "—", icon: Star, action: "reviews" as const }, { label: "Completed rides", value: totals?.completedRides.toLocaleString() ?? "—", icon: CarFront, action: "history" as const }, { label: "Total earnings", value: totals ? pkr(totals.totalEarnings) : "—", icon: Wallet, action: "earnings" as const }].map((stat) => <Button key={stat.label} variant="outline" onClick={() => open(stat.action)} className="flex h-32 min-w-0 flex-col gap-2 whitespace-normal rounded-2xl border-border bg-card px-2 shadow-soft"><stat.icon className="!h-5 !w-5 text-driver-primary" /><span className="max-w-full break-words text-center text-lg font-bold sm:text-xl">{stat.value}</span><span className="text-center text-[11px] font-normal text-muted-foreground">{stat.label}</span></Button>)}
    </div>
    {details.isError && <p role="alert" className="mt-3 text-sm text-destructive">Statistics couldn't load. <Button variant="link" size="sm" onClick={() => details.refetch()}>Try again</Button></p>}
    <div className="mt-7 grid gap-7 md:grid-cols-2">
      <section><h3 className="mb-3 font-sans text-sm font-bold">Account information</h3><div className="overflow-hidden rounded-2xl border bg-card shadow-soft divide-y">
        {row("Personal details", "Your contact & personal information", UserRound, () => open("personal"))}
        {row("CNIC verification", docs.filter((x) => x.doc_type.startsWith("cnic")).every((x) => x.verified) && docs.some((x) => x.doc_type.startsWith("cnic")) ? "Documents verified" : "Identity verification status", ShieldCheck, () => open("cnic"))}
        {row("Driving licence", "Licence details & expiry date", CreditCard, () => open("licence"))}
        {row("Vehicle details", details.data?.vehicles[0]?.make_model || "Your registered vehicle", CarFront, () => open("vehicle"))}
      </div></section>
      <section><h3 className="mb-3 font-sans text-sm font-bold">Driving & earnings</h3><div className="overflow-hidden rounded-2xl border bg-card shadow-soft divide-y">
        {row("My earnings", "Your completed trip fares", Wallet, () => open("earnings"))}
        {row("Trip history", "All your rides & shared routes", History, () => open("history"))}
        <Button variant="ghost" asChild className="h-auto min-h-20 w-full justify-start gap-4 whitespace-normal rounded-none px-5 py-4 text-left"><a href="#driver-pool"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-driver-blush text-driver-primary"><Users /></span><span className="flex-1"><span className="block">Pink Pool routes</span><span className="mt-1 block text-xs font-normal text-muted-foreground">Manage your shared journeys</span></span><ChevronRight className="text-muted-foreground" /></a></Button>
        {row("Ratings & reviews", "Feedback from your riders", Star, () => open("reviews"))}
        <Button variant="ghost" asChild className="h-auto min-h-20 w-full justify-start gap-4 whitespace-normal rounded-none px-5 py-4 text-left"><a href="#driver-safety"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-driver-blush text-driver-primary"><ShieldCheck /></span><span className="flex-1"><span className="block">Safety settings</span><span className="mt-1 block text-xs font-normal text-muted-foreground">Location & emergency contacts</span></span><ChevronRight className="text-muted-foreground" /></a></Button>
      </div></section>
    </div>
    <div className="py-7"><Button size="lg" className="w-full bg-driver-primary text-primary-foreground hover:bg-driver-primary/90" disabled={!approved} onClick={onOnline}><Power />{d.online ? "Go offline" : "Start driving / Go online"}</Button><p className="mt-2 text-center text-xs text-muted-foreground">{!approved ? "Available after admin approval" : d.online ? "You're online and ready to receive rides" : !sharing ? "Location sharing is required to receive rides" : "Ready when you are"}</p>{editableApplication && <Button asChild variant="link" className="mt-2 w-full"><Link to="/driver-register">{d.status === "incomplete" ? "Continue application" : "Update & resubmit application"}<ArrowUpRight /></Link></Button>}</div>
    <Dialog open={section !== null} onOpenChange={(v) => { if (!v) setSection(null); }}><DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl bg-card"><DialogHeader><DialogTitle className="font-sans">{section ? TITLES[section] : "Driver profile"}</DialogTitle><DialogDescription>{section === "cnic" || section === "licence" ? "Private details. Only authorized admins can review your documents." : "Your Pink Wheel driver account"}</DialogDescription></DialogHeader>
      {section === "personal" && <div><dl>{datum("Legal name", d.full_name)}{datum("Email", d.email)}{datum("Phone", d.phone)}</dl><Button variant="link" asChild className="px-0"><Link to="/account">Manage account name, email & phone<ArrowUpRight /></Link></Button><form onSubmit={(e) => { e.preventDefault(); save(); }} className="mt-3 space-y-3">{([{ key: "home_address", label: "Home address" }, { key: "city", label: "City" }, { key: "emergency_contact_name", label: "Emergency contact name" }, { key: "emergency_contact_phone", label: "Emergency contact phone" }] as const).map((f) => <div key={f.key}><Label htmlFor={`driver-${f.key}`}>{f.label}</Label><Input id={`driver-${f.key}`} value={draft[f.key]} maxLength={f.key === "home_address" ? 300 : 100} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} /></div>)}<p className="text-xs text-muted-foreground">Verified legal identity stays locked during review and after approval. Contact support to request a correction.</p><Button type="submit" className="w-full" disabled={saving}>{saving ? "Saving…" : "Save details"}</Button></form></div>}
      {(section === "cnic" || section === "licence") && <div><dl>{section === "cnic" ? datum("CNIC number", d.cnic ? `•••••-•••••••-${d.cnic.slice(-1)}` : null) : <>{datum("Licence number", d.licence_no)}{datum("Category", d.licence_category)}{datum("Expiry date", d.licence_expiry)}</>}</dl><ul className="mt-3 space-y-3">{docs.filter((x) => x.doc_type.startsWith(section === "cnic" ? "cnic" : "licence")).map((doc) => <li key={doc.id} className="flex items-center gap-2 text-sm"><FileCheck className="h-4 w-4 text-driver-primary" /><span className="flex-1 capitalize">{doc.doc_type.replaceAll("_", " ")}</span><span className="text-xs text-muted-foreground">{doc.verified ? "Verified" : "Under review"}</span></li>)}</ul>{editableApplication && <Button asChild variant="outline" className="mt-4 w-full"><Link to="/driver-register">Update application</Link></Button>}<Button asChild variant="link" className="mt-2 w-full"><Link to="/contact">Contact verification support</Link></Button></div>}
      {section === "vehicle" && <div>{details.data?.vehicles.length ? details.data.vehicles.map((v) => <dl key={v.id}>{datum("Vehicle", v.make_model)}{datum("Type", v.kind)}{datum("Registration", v.reg_no)}{datum("Colour", v.color)}{datum("Model year", v.model_year?.toString())}</dl>) : <p className="text-sm text-muted-foreground">No vehicle added yet.</p>}<Button asChild variant="outline" className="mt-4 w-full"><Link to={editableApplication ? "/driver-register" : "/contact"}>{editableApplication ? "Edit vehicle in application" : "Request a vehicle update"}</Link></Button></div>}
      {section === "earnings" && <dl>{datum("Ride fares", totals ? pkr(totals.rideEarnings) : "Unavailable")}{datum("Pink Pool fares", totals ? pkr(totals.poolEarnings) : "Unavailable")}{datum("Total gross earnings", totals ? pkr(totals.totalEarnings) : "Unavailable")}<p className="mt-3 text-xs text-muted-foreground">Completed booking fares only, before any fees. These are not payout records.</p></dl>}
      {section === "history" && <div className="space-y-4">{!rides.length && !details.data?.routes.length && <p className="text-sm text-muted-foreground">No trips yet.</p>}{rides.map((r) => <div key={r.id} className="border-b pb-3 text-sm"><p className="font-semibold">{r.pickup} → {r.destination}</p><p className="mt-1 text-xs text-muted-foreground">{r.ride_date} · {r.status.replaceAll("_", " ")} · {pkr(r.fare)}</p></div>)}{details.data?.routes.map((r) => <div key={r.id} className="border-b pb-3 text-sm"><p className="font-semibold">{r.start_location} → {r.destination}</p><p className="mt-1 text-xs text-muted-foreground">Pink Pool · {r.departure_date} · {r.status.replaceAll("_", " ")}</p></div>)}</div>}
      {section === "reviews" && <div className="space-y-4">{details.isPending ? <p>Loading reviews…</p> : details.isError ? <p>Reviews are unavailable. Please try again.</p> : !details.data.reviews.length ? <p className="text-sm text-muted-foreground">No rider reviews yet.</p> : details.data.reviews.map((r, i) => <div key={i} className="border-b pb-3 text-sm"><p className="flex items-center gap-1 font-semibold"><Star className="h-4 w-4 text-driver-primary" />{r.stars} / 5<span className="ml-auto text-xs font-normal text-muted-foreground">{new Date(r.created_at).toLocaleDateString("en-PK")}</span></p>{r.comment && <p className="mt-2 break-words">{r.comment}</p>}</div>)}</div>}
    </DialogContent></Dialog>
  </div>;
}