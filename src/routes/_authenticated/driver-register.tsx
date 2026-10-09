import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { BadgeCheck, Check, Upload } from "lucide-react";
import { AppShell, Panel } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useMe, VEHICLES, type Vehicle } from "@/lib/pink";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/driver-register")({
  head: () => ({ meta: [{ title: "Become a Driver — Pink Wheel" }, { name: "description", content: "Apply to drive with Pink Wheel in a few simple steps." }, { property: "og:title", content: "Become a Driver — Pink Wheel" }, { property: "og:description", content: "Apply to drive with Pink Wheel." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: DriverRegister,
});

const STEPS = ["Basic info", "Identity", "Licence", "Vehicle", "Agreements", "Submit"];
type DocKey = "cnic_front" | "cnic_back" | "selfie" | "licence_front" | "licence_back" | "registration" | "vehicle_front" | "vehicle_back" | "insurance" | "ownership";
const DOCS: Record<number, { key: DocKey; label: string; optional?: boolean }[]> = {
  1: [{ key: "cnic_front", label: "CNIC front" }, { key: "cnic_back", label: "CNIC back" }, { key: "selfie", label: "Clear profile / selfie photo" }],
  2: [{ key: "licence_front", label: "Licence front" }, { key: "licence_back", label: "Licence back", optional: true }],
  3: [
    { key: "registration", label: "Registration document" }, { key: "vehicle_front", label: "Vehicle front photo" }, { key: "vehicle_back", label: "Vehicle back photo" },
    { key: "insurance", label: "Insurance document", optional: true }, { key: "ownership", label: "Ownership document", optional: true },
  ],
};

const phone = z.string().trim().transform((s) => s.replace(/[\s-]/g, "")).refine((s) => /^(\+92|0)3\d{9}$/.test(s), "Enter a valid Pakistani mobile number, e.g. 0300 1234567");
const today = () => new Date().toISOString().slice(0, 10);
const schemas = [
  z.object({
    full_name: z.string().trim().min(3, "Enter your full legal name").max(100),
    guardian_name: z.string().trim().max(100),
    date_of_birth: z.string().min(1, "Enter your date of birth").refine((d) => {
      const age = (Date.now() - new Date(d).getTime()) / 31557600000; return age >= 18 && age < 80;
    }, "You must be at least 18 years old"),
    gender: z.literal("female", { message: "Pink Wheel drivers must be women" }),
    phone, email: z.string().trim().email("Enter a valid email").max(255),
    home_address: z.string().trim().min(5, "Enter your home address").max(300),
    city: z.string().trim().min(2, "Enter your city").max(60),
    emergency_contact_name: z.string().trim().min(2, "Enter emergency contact name").max(100),
    emergency_contact_phone: phone,
  }),
  z.object({ cnic: z.string().trim().regex(/^\d{5}-?\d{7}-?\d$/, "CNIC format: 12345-1234567-1") }),
  z.object({
    licence_no: z.string().trim().min(4, "Enter licence number").max(40),
    licence_expiry: z.string().min(1, "Enter licence expiry date").refine((d) => d >= today(), "Your licence has expired — renew it before applying"),
    licence_category: z.string().trim().min(1, "Choose licence category").max(40),
  }),
  z.object({
    make: z.string().trim().min(2, "Enter vehicle make").max(40),
    model: z.string().trim().min(1, "Enter vehicle model").max(40),
    model_year: z.coerce.number().int().min(1990, "Enter a valid model year").max(new Date().getFullYear() + 1, "Enter a valid model year"),
    color: z.string().trim().min(2, "Enter vehicle colour").max(30),
    reg_no: z.string().trim().regex(/^[A-Za-z]{2,4}[- ]?\d{1,4}([- ]?\d{2,4})?$/, "Registration like LEA-1234"),
  }),
];

type Form = Record<string, string>;
const EMPTY: Form = { full_name: "", guardian_name: "", date_of_birth: "", gender: "female", phone: "", email: "", home_address: "", city: "", emergency_contact_name: "", emergency_contact_phone: "", cnic: "", licence_no: "", licence_expiry: "", licence_category: "", make: "", model: "", model_year: "", color: "", reg_no: "" };

function DriverRegister() {
  const me = useMe();
  const uid = me.data?.user.id;
  const data = useQuery({
    queryKey: ["driver-app", uid], enabled: !!uid,
    queryFn: async () => {
      const [d, v, docs] = await Promise.all([
        supabase.from("drivers").select("*").eq("user_id", uid!).maybeSingle(),
        supabase.from("vehicles").select("*").eq("driver_id", uid!).order("created_at").limit(1).maybeSingle(),
        supabase.from("driver_documents").select("doc_type, file_path").eq("driver_id", uid!),
      ]);
      return { driver: d.data, vehicle: v.data, docs: docs.data ?? [] };
    },
  });
  const [f, setF] = useState<Form>(EMPTY);
  const [kind, setKind] = useState<Vehicle>("car");
  const [step, setStep] = useState(0);
  const [agree, setAgree] = useState({ correct: false, terms: false, background: false, guidelines: false });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded || !data.data || !me.data) return;
    const d = data.data.driver, v = data.data.vehicle;
    setF({
      ...EMPTY,
      full_name: d?.full_name ?? me.data.profile?.full_name ?? "", phone: d?.phone ?? me.data.profile?.phone ?? "", email: d?.email ?? me.data.user.email ?? "",
      guardian_name: d?.guardian_name ?? "", date_of_birth: d?.date_of_birth ?? "", home_address: d?.home_address ?? "", city: d?.city ?? "",
      emergency_contact_name: d?.emergency_contact_name ?? "", emergency_contact_phone: d?.emergency_contact_phone ?? "",
      cnic: d?.cnic ?? "", licence_no: d?.licence_no ?? "", licence_expiry: d?.licence_expiry ?? "", licence_category: d?.licence_category ?? "",
      make: v?.make ?? "", model: v?.model ?? "", model_year: v?.model_year ? String(v.model_year) : "", color: v?.color ?? "", reg_no: v?.reg_no ?? "",
    });
    if (v) setKind(v.kind as Vehicle);
    // Resume at the first unfinished step.
    if (d) {
      const has = new Set(data.data.docs.map((x) => x.doc_type));
      const s = !d.cnic || !has.has("cnic_front") ? 1 : !d.licence_no || !d.licence_expiry ? 2 : !v?.make ? 3 : 4;
      setStep(s);
    }
    setLoaded(true);
  }, [data.data, me.data, loaded]);

  if (me.isLoading || data.isLoading || !loaded) return <AppShell title="Become a driver"><p className="text-muted-foreground">Loading…</p></AppShell>;
  const status = data.data?.driver?.status;
  if (done || status === "pending" || status === "approved" || status === "suspended") {
    return (
      <AppShell title="Driver application">
        <Panel className="mx-auto max-w-lg text-center">
          <BadgeCheck className="mx-auto h-12 w-12 text-primary" />
          <p className="mt-4 text-lg font-semibold">{status === "approved" ? "You're approved — you can start driving." : "Your driver application has been submitted and is pending review."}</p>
          <p className="mt-1 text-sm text-muted-foreground">You'll see updates on your driver dashboard.</p>
          <Button className="mt-5" variant="hero" asChild><Link to="/driver">Go to driver dashboard</Link></Button>
        </Panel>
      </AppShell>
    );
  }

  const docs = data.data?.docs ?? [];
  const hasDoc = (k: string) => docs.some((d) => d.doc_type === k);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const field = (k: string, label: string, opts: { ph?: string; type?: string; optional?: boolean; disabled?: boolean } = {}) => (
    <div><Label>{label}{opts.optional && <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>}</Label>
      <Input type={opts.type} value={f[k]} placeholder={opts.ph} disabled={opts.disabled} onChange={(e) => set(k, e.target.value)} /></div>
  );

  async function saveStep(s: number) {
    const sch = schemas[s];
    if (sch) {
      const r = sch.safeParse(f);
      if (!r.success) { toast.error(r.error.issues[0]?.message); return false; }
    }
    const missing = (DOCS[s] ?? []).find((d) => !d.optional && !hasDoc(d.key));
    if (missing) { toast.error(`Please upload: ${missing.label}`); return false; }
    const clean = (x: string) => x.trim();
    if (s === 0) {
      const row = {
        full_name: clean(f.full_name), guardian_name: clean(f.guardian_name) || null, date_of_birth: f.date_of_birth, gender: "female",
        phone: f.phone.replace(/[\s-]/g, ""), email: clean(f.email), home_address: clean(f.home_address), city: clean(f.city),
        emergency_contact_name: clean(f.emergency_contact_name), emergency_contact_phone: f.emergency_contact_phone.replace(/[\s-]/g, ""),
        emergency_contact: `${clean(f.emergency_contact_name)} — ${f.emergency_contact_phone.trim()}`,
      };
      const { error } = data.data?.driver
        ? await supabase.from("drivers").update(row).eq("user_id", uid!)
        : await supabase.from("drivers").insert({ ...row, user_id: uid!, cnic: "", licence_no: "", status: "incomplete" });
      if (error) { toast.error(error.message); return false; }
      await data.refetch();
    }
    if (s === 1 || s === 2) {
      const row = s === 1 ? { cnic: f.cnic.trim() } : { licence_no: f.licence_no.trim(), licence_expiry: f.licence_expiry, licence_category: f.licence_category };
      const { error } = await supabase.from("drivers").update(row).eq("user_id", uid!);
      if (error) { toast.error(error.message); return false; }
    }
    if (s === 3) {
      const row = { kind, make: clean(f.make), model: clean(f.model), make_model: `${clean(f.make)} ${clean(f.model)}`, model_year: Number(f.model_year), color: clean(f.color), reg_no: f.reg_no.trim().toUpperCase() };
      const v = data.data?.vehicle;
      const { error } = v ? await supabase.from("vehicles").update(row).eq("id", v.id) : await supabase.from("vehicles").insert({ ...row, driver_id: uid! });
      if (error) { toast.error(error.message); return false; }
      await data.refetch();
    }
    return true;
  }

  async function next() {
    setBusy(true);
    const ok = await saveStep(step);
    setBusy(false);
    if (ok) { setStep(step + 1); window.scrollTo({ top: 0 }); }
  }

  async function upload(key: DocKey, file?: File) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("Each file must be under 10MB");
    if (!/^(image\/|application\/pdf)/.test(file.type)) return toast.error("Upload an image or PDF");
    setUploading(key);
    const path = `${uid}/${key}-${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const up = await supabase.storage.from("driver-docs").upload(path, file);
    if (up.error) { setUploading(null); return toast.error(up.error.message); }
    const { error } = await supabase.from("driver_documents").insert({ driver_id: uid!, doc_type: key, file_path: path });
    setUploading(null);
    if (error) return toast.error(error.message);
    data.refetch();
  }

  async function submit() {
    for (let s = 0; s < 4; s++) {
      const sch = schemas[s];
      const r = sch?.safeParse(f);
      if (r && !r.success) { setStep(s); return toast.error(r.error.issues[0]?.message); }
      const m = (DOCS[s] ?? []).find((d) => !d.optional && !hasDoc(d.key));
      if (m) { setStep(s); return toast.error(`Please upload: ${m.label}`); }
    }
    if (!Object.values(agree).every(Boolean)) { setStep(4); return toast.error("Please tick all the agreements"); }
    setBusy(true);
    const { error } = await supabase.from("drivers").update({ status: "pending", terms_accepted_at: new Date().toISOString() }).eq("user_id", uid!);
    setBusy(false);
    if (error) return toast.error(error.message);
    setDone(true);
  }

  const note = data.data?.driver?.admin_note;
  return (
    <AppShell title="Become a Pink Wheel driver">
      {(status === "rejected" || status === "info_requested") && (
        <div className="mb-4 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <b>{status === "rejected" ? "Application not approved" : "More information required"}</b>{note && <> — {note}</>}
          <p className="mt-1 text-muted-foreground">Update your details or documents below and submit again.</p>
        </div>
      )}
      <ol className="mb-5 flex gap-1 overflow-x-auto">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1 min-w-[64px]">
            <button type="button" onClick={() => i < step && setStep(i)} className={cn("w-full rounded-full px-2 py-1.5 text-xs font-semibold", i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>
              {i < step && <Check className="mr-1 inline h-3 w-3" />}{i + 1}. {s}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Panel title="Step 1 — Basic information">
          <div className="grid gap-3 sm:grid-cols-2">
            {field("full_name", "Full legal name")}
            {field("guardian_name", "Father / husband name", { optional: true })}
            {field("date_of_birth", "Date of birth", { type: "date" })}
            <div><Label>Gender</Label><Input value="Female" disabled /><p className="mt-1 text-xs text-muted-foreground">Pink Wheel is a women-only platform.</p></div>
            {field("phone", "Phone number", { ph: "0300 1234567" })}
            {field("email", "Email address", { type: "email" })}
            {field("home_address", "Home address")}
            {field("city", "City", { ph: "Lahore" })}
            {field("emergency_contact_name", "Emergency contact name")}
            {field("emergency_contact_phone", "Emergency contact phone", { ph: "0300 1234567" })}
          </div>
        </Panel>
      )}
      {step === 1 && (
        <Panel title="Step 2 — Identity verification">
          <div className="mb-3 max-w-sm">{field("cnic", "CNIC number", { ph: "12345-1234567-1" })}</div>
          <DocGrid items={DOCS[1]!} hasDoc={hasDoc} uploading={uploading} onFile={upload} />
        </Panel>
      )}
      {step === 2 && (
        <Panel title="Step 3 — Driving information">
          <div className="mb-3 grid gap-3 sm:grid-cols-3">
            {field("licence_no", "Driving licence number")}
            {field("licence_expiry", "Licence expiry date", { type: "date" })}
            <div><Label>Licence category</Label>
              <select className="h-10 w-full rounded-md border bg-card px-3 text-sm" value={f.licence_category} onChange={(e) => set("licence_category", e.target.value)}>
                <option value="">Choose…</option>
                {["Motorcycle", "Motor car", "Motor car + motorcycle", "LTV", "Other"].map((c) => <option key={c}>{c}</option>)}
              </select></div>
          </div>
          <DocGrid items={DOCS[2]!} hasDoc={hasDoc} uploading={uploading} onFile={upload} />
        </Panel>
      )}
      {step === 3 && (
        <Panel title="Step 4 — Vehicle information">
          <div className="mb-3 grid grid-cols-3 gap-2">
            {VEHICLES.map((v) => (
              <button type="button" key={v.id} onClick={() => setKind(v.id)} className={cn("rounded-2xl border-2 p-3 font-semibold", kind === v.id ? "border-primary bg-accent" : "border-border")}>{v.label}</button>
            ))}
          </div>
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            {field("make", "Vehicle make", { ph: "Suzuki" })}
            {field("model", "Vehicle model", { ph: "Alto" })}
            {field("model_year", "Model year", { ph: "2021" })}
            {field("color", "Vehicle colour", { ph: "White" })}
            {field("reg_no", "Registration number", { ph: "LEA-1234" })}
          </div>
          <DocGrid items={DOCS[3]!} hasDoc={hasDoc} uploading={uploading} onFile={upload} />
        </Panel>
      )}
      {step === 4 && (
        <Panel title="Step 5 — Safety & agreements">
          <div className="space-y-3 text-sm">
            {([
              ["correct", "I confirm all the information I submitted is correct."],
              ["terms", <>I agree to the Pink Wheel <Link to="/terms" className="underline" target="_blank">Driver Terms</Link>.</>],
              ["background", "I agree to identity and background verification where legally applicable."],
              ["guidelines", <>I accept the <Link to="/safety" className="underline" target="_blank">safety & community guidelines</Link>.</>],
            ] as const).map(([k, l]) => (
              <label key={k} className="flex items-start gap-3">
                <Checkbox checked={agree[k]} onCheckedChange={(v) => setAgree({ ...agree, [k]: !!v })} className="mt-0.5" />
                <span>{l}</span>
              </label>
            ))}
          </div>
        </Panel>
      )}
      {step === 5 && (
        <Panel title="Step 6 — Review & submit">
          <ul className="space-y-1 text-sm">
            <li><b>Name:</b> {f.full_name} · {f.phone} · {f.city}</li>
            <li><b>CNIC:</b> {f.cnic}</li>
            <li><b>Licence:</b> {f.licence_no} · {f.licence_category} · expires {f.licence_expiry}</li>
            <li><b>Vehicle:</b> <span className="capitalize">{kind}</span> · {f.make} {f.model} {f.model_year} · {f.color} · {f.reg_no.toUpperCase()}</li>
            <li><b>Documents uploaded:</b> {new Set(docs.map((d) => d.doc_type)).size}</li>
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">You can't go online or receive rides until an admin approves your application.</p>
        </Panel>
      )}

      <div className="mt-5 flex gap-3">
        {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)} disabled={busy}>Back</Button>}
        {step < 4 && <Button variant="hero" onClick={next} disabled={busy || !!uploading}>{busy ? "Saving…" : "Save & continue"}</Button>}
        {step === 4 && <Button variant="hero" onClick={() => Object.values(agree).every(Boolean) ? setStep(5) : toast.error("Please tick all the agreements")}>Continue</Button>}
        {step === 5 && <Button variant="hero" onClick={submit} disabled={busy}>{busy ? "Submitting…" : "Submit for approval"}</Button>}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Your progress is saved after each step — you can come back later. Documents are stored privately and only Pink Wheel admins can view them.</p>
    </AppShell>
  );
}

function DocGrid({ items, hasDoc, uploading, onFile }: { items: { key: DocKey; label: string; optional?: boolean }[]; hasDoc: (k: string) => boolean; uploading: string | null; onFile: (k: DocKey, f?: File) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((d) => (
        <label key={d.key} className={cn("flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed p-4 text-sm", hasDoc(d.key) ? "border-primary bg-accent" : "border-border")}>
          {hasDoc(d.key) ? <Check className="h-5 w-5 text-primary" /> : <Upload className="h-5 w-5 text-primary" />}
          <span className="min-w-0 flex-1">
            <b className="block">{d.label}{d.optional && <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>}</b>
            <span className="block text-xs text-muted-foreground">{uploading === d.key ? "Uploading…" : hasDoc(d.key) ? "Uploaded — tap to replace" : "Image or PDF, max 10MB"}</span>
          </span>
          <input type="file" accept="image/*,application/pdf" className="hidden" disabled={!!uploading} onChange={(e) => onFile(d.key, e.target.files?.[0])} />
        </label>
      ))}
    </div>
  );
}
