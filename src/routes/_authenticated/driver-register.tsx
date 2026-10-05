import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { BadgeCheck, Upload } from "lucide-react";
import { AppShell, Panel } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useMe, VEHICLES, type Vehicle } from "@/lib/pink";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/driver-register")({
  head: () => ({ meta: [{ title: "Driver Registration — Pink Wheel" }, { name: "description", content: "Apply to drive with Pink Wheel." }] }),
  component: DriverRegister,
});

const schema = z.object({
  full_name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(20),
  email: z.string().trim().email().max(255),
  cnic: z.string().trim().regex(/^\d{5}-?\d{7}-?\d$/, "CNIC format: 12345-1234567-1"),
  licence_no: z.string().trim().min(4, "Enter licence number").max(40),
  city: z.string().trim().min(2, "Enter city").max(60),
  make_model: z.string().trim().min(2, "Enter vehicle make/model").max(80),
  reg_no: z.string().trim().min(2, "Enter registration number").max(30),
  working_hours: z.string().trim().min(2, "Enter working hours").max(80),
  emergency_contact: z.string().trim().min(7, "Enter emergency contact").max(120),
});

const DOCS = [
  { key: "cnic", label: "Upload CNIC" },
  { key: "licence", label: "Upload driving licence" },
  { key: "vehicle", label: "Upload vehicle documents" },
  { key: "photo", label: "Upload profile photo" },
] as const;

function DriverRegister() {
  const me = useMe();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<Vehicle>("car");
  const [files, setFiles] = useState<Record<string, File | undefined>>({});
  const [f, setF] = useState({ full_name: "", phone: "", email: "", cnic: "", licence_no: "", city: "", make_model: "", reg_no: "", working_hours: "", emergency_contact: "" });
  const val = (k: keyof typeof f) =>
    f[k] || (k === "full_name" ? me.data?.profile?.full_name ?? "" : k === "phone" ? me.data?.profile?.phone ?? "" : k === "email" ? me.data?.user.email ?? "" : "");
  const field = (k: keyof typeof f, label: string, ph?: string) => (
    <div><Label>{label}</Label><Input value={val(k)} placeholder={ph} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const filled = Object.fromEntries(Object.keys(f).map((k) => [k, val(k as keyof typeof f)]));
    const parsed = schema.safeParse(filled);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (DOCS.some((d) => !files[d.key])) return toast.error("Please upload all 4 documents");
    if (Object.values(files).some((x) => x && x.size > 10 * 1024 * 1024)) return toast.error("Each file must be under 10MB");
    const uid = me.data!.user.id;
    setBusy(true);
    try {
      const { make_model, reg_no, ...driver } = parsed.data;
      const { error } = await supabase.from("drivers").insert({ ...driver, user_id: uid });
      if (error) throw error;
      const { error: ve } = await supabase.from("vehicles").insert({ driver_id: uid, kind, make_model, reg_no });
      if (ve) throw ve;
      for (const d of DOCS) {
        const file = files[d.key]!;
        const path = `${uid}/${d.key}-${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const up = await supabase.storage.from("driver-docs").upload(path, file);
        if (up.error) throw up.error;
        await supabase.from("driver_documents").insert({ driver_id: uid, doc_type: d.key, file_path: path });
      }
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <AppShell title="Application submitted">
        <Panel className="mx-auto max-w-lg text-center">
          <BadgeCheck className="mx-auto h-12 w-12 text-primary" />
          <p className="mt-4 text-lg font-semibold">Your application has been received and is under verification.</p>
          <p className="mt-1 text-sm text-muted-foreground">We'll notify you once our team approves your documents.</p>
          <Button className="mt-5" variant="hero" asChild><Link to="/driver">Go to driver dashboard</Link></Button>
        </Panel>
      </AppShell>
    );
  }

  return (
    <AppShell title="Drive with Pink Wheel">
      <form onSubmit={submit} className="space-y-5">
        <Panel title="About you">
          <div className="grid gap-3 sm:grid-cols-2">
            {field("full_name", "Full name")}
            {field("phone", "Phone number")}
            {field("email", "Email")}
            {field("cnic", "CNIC number", "12345-1234567-1")}
            {field("licence_no", "Driving licence number")}
            {field("city", "City", "Lahore")}
            {field("emergency_contact", "Emergency contact", "Name — phone")}
            {field("working_hours", "Available working hours", "e.g. 9am – 5pm, Mon–Sat")}
          </div>
        </Panel>
        <Panel title="Your vehicle">
          <div className="mb-3 grid grid-cols-3 gap-2">
            {VEHICLES.map((v) => (
              <button type="button" key={v.id} onClick={() => setKind(v.id)} className={cn("rounded-2xl border-2 p-3 font-semibold", kind === v.id ? "border-primary bg-accent" : "border-border")}>{v.label}</button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {field("make_model", "Vehicle make / model", "Suzuki Alto 2021")}
            {field("reg_no", "Registration number", "LEA-1234")}
          </div>
        </Panel>
        <Panel title="Documents">
          <div className="grid gap-3 sm:grid-cols-2">
            {DOCS.map((d) => (
              <label key={d.key} className={cn("flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed p-4 text-sm", files[d.key] ? "border-primary bg-accent" : "border-border")}>
                <Upload className="h-5 w-5 text-primary" />
                <span className="min-w-0 flex-1"><b className="block">{d.label}</b><span className="block truncate text-xs text-muted-foreground">{files[d.key]?.name ?? "Image or PDF, max 10MB"}</span></span>
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setFiles({ ...files, [d.key]: e.target.files?.[0] })} />
              </label>
            ))}
          </div>
        </Panel>
        <Button type="submit" variant="hero" size="lg" className="w-full sm:w-auto" disabled={busy}>{busy ? "Submitting…" : "Submit Application"}</Button>
      </form>
    </AppShell>
  );
}
