import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useState, type ReactNode } from "react";
import { PageHero } from "@/components/Reveal";
import { emptyBrief, validateStep, type Brief } from "@/lib/brief";
import { budgets, profile, projectTypes } from "@/lib/content";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/contact")({
  head: () => seo("Contact", "Tell Edmundo Kutuzov about your project — every message answered within 48 hours."),
  component: Contact,
});

const steps = [
  { k: "Identity", t: "Start with the people behind the project.", d: "Enough about you or your team to start the conversation." },
  { k: "Project", t: "What are we making?", d: "Pick the main discipline and how pressing the work is." },
  { k: "Budget", t: "What scale should I design for?", d: "Share a range if useful — not disclosing is fine." },
  { k: "Timing", t: "When does the work need to move?", d: "A target date and preferred channel help shape the reply." },
  { k: "References", t: "Give the idea enough context.", d: "Describe the brief, add links and useful visual references." },
];

const input = "w-full border-b border-foreground/30 bg-transparent py-3 text-lg outline-none transition focus:border-primary placeholder:text-muted-foreground/60";
const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block"><span className="eyebrow">{label}</span>{children}</label>
);
const Chip = ({ on, children, onClick }: { on: boolean; children: ReactNode; onClick: () => void }) => (
  <button type="button" onClick={onClick} className={`rounded-full border px-4 py-2 text-sm transition ${on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-foreground"}`}>{children}</button>
);

function Contact() {
  const [step, setStep] = useState(0);
  const [b, setB] = useState<Brief>(emptyBrief);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const set = <K extends keyof Brief>(k: K, v: Brief[K]) => setB((p) => ({ ...p, [k]: v }));

  const next = () => {
    const e = validateStep(step, b);
    setErr(e);
    if (e) return;
    if (step < 4) setStep(step + 1);
    else setSent(true);
  };

  return (
    <>
      <PageHero eyebrow="Contact" lines={["Let's talk."]} intro="Tell me about your project. I respond to every message within 48 hours with an initial process proposal." />

      <section className="grid gap-px bg-border md:grid-cols-3">
        {[
          { l: "WhatsApp", v: profile.phone, h: profile.whatsapp },
          { l: "Email", v: profile.email, h: `mailto:${profile.email}` },
          { l: "30-min call", v: "Request a slot", h: `mailto:${profile.email}?subject=30-minute%20call` },
        ].map((c) => (
          <a key={c.l} href={c.h} target="_blank" rel="noreferrer" className="group bg-background p-10 transition hover:bg-primary hover:text-primary-foreground">
            <p className="eyebrow group-hover:text-primary-foreground">{c.l}</p>
            <p className="mt-6 font-display text-2xl font-semibold">{c.v} ↗</p>
          </a>
        ))}
      </section>

      <section className="grid gap-16 px-6 py-32 md:grid-cols-[1fr_2fr] md:px-12">
        <aside className="space-y-4">
          {steps.map((s, i) => (
            <div key={s.k} className={`flex items-center gap-4 transition ${i === step ? "text-foreground" : "text-muted-foreground"}`}>
              <span className={`font-mono text-xs ${i <= step ? "text-primary" : ""}`}>0{i + 1}</span>
              <span className="font-display text-xl">{s.k}</span>
            </div>
          ))}
          <p className="pt-10 text-sm text-muted-foreground">{profile.address}</p>
        </aside>

        <div>
          {sent ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h2 className="font-display text-5xl font-bold">Brief received.</h2>
              <p className="mt-4 text-muted-foreground">Thanks, {b.name.split(" ")[0]}. Expect a reply within 48 hours.</p>
            </motion.div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); next(); }}>
              <AnimatePresence mode="wait">
                <motion.div key={step} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="space-y-8">
                  <div>
                    <h2 className="font-display text-4xl font-bold md:text-5xl">{steps[step].t}</h2>
                    <p className="mt-3 text-muted-foreground">{steps[step].d}</p>
                  </div>

                  {step === 0 && (
                    <div className="grid gap-8 md:grid-cols-2">
                      <Field label="Full name *"><input className={input} value={b.name} onChange={(e) => set("name", e.target.value)} /></Field>
                      <Field label="Email *"><input type="email" className={input} value={b.email} onChange={(e) => set("email", e.target.value)} /></Field>
                      <Field label="Company / brand"><input className={input} value={b.company} onChange={(e) => set("company", e.target.value)} /></Field>
                      <Field label="Role"><input className={input} value={b.role} onChange={(e) => set("role", e.target.value)} /></Field>
                      <Field label="Country / city"><input className={input} value={b.location} onChange={(e) => set("location", e.target.value)} /></Field>
                      <Field label="Phone / WhatsApp"><input className={input} value={b.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
                    </div>
                  )}

                  {step === 1 && (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {projectTypes.map((t) => <Chip key={t} on={b.type === t} onClick={() => set("type", t)}>{t}</Chip>)}
                      </div>
                      <div>
                        <p className="eyebrow mb-3">Urgency</p>
                        <div className="flex flex-wrap gap-2">
                          {([["low", "Low — exploring"], ["normal", "Normal"], ["high", "High"], ["urgent", "Urgent"]] as const).map(([v, l]) => (
                            <Chip key={v} on={b.urgency === v} onClick={() => set("urgency", v)}>{l}</Chip>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {Object.keys(budgets).map((c) => <Chip key={c} on={b.currency === c} onClick={() => set("currency", c)}>{c}</Chip>)}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {["Prefer not to say", ...budgets[b.currency]].map((r) => <Chip key={r} on={b.budget === r} onClick={() => set("budget", r)}>{r}</Chip>)}
                      </div>
                      <div className="grid items-end gap-8 md:grid-cols-2">
                        <Field label="Exact amount (optional)"><input className={input} value={b.exact} onChange={(e) => set("exact", e.target.value)} /></Field>
                        <label className="flex items-center gap-3 pb-3"><input type="checkbox" checked={b.negotiable} onChange={(e) => set("negotiable", e.target.checked)} className="accent-primary" /> Budget is negotiable</label>
                      </div>
                    </>
                  )}

                  {step === 3 && (
                    <>
                      <Field label="Deadline"><input type="date" className={input} value={b.deadline} onChange={(e) => set("deadline", e.target.value)} /></Field>
                      <div>
                        <p className="eyebrow mb-3">Preferred channel</p>
                        <div className="flex flex-wrap gap-2">
                          {(["email", "phone", "whatsapp", "linkedin"] as const).map((c) => <Chip key={c} on={b.channel === c} onClick={() => set("channel", c)}>{c[0].toUpperCase() + c.slice(1)}</Chip>)}
                        </div>
                      </div>
                    </>
                  )}

                  {step === 4 && (
                    <>
                      <Field label={`Message * (${b.message.length}/4000)`}>
                        <textarea rows={6} maxLength={4000} className={input} value={b.message} onChange={(e) => set("message", e.target.value)} />
                      </Field>
                      <Field label="Reference links (space separated)"><input className={input} placeholder="https://" value={b.links} onChange={(e) => set("links", e.target.value)} /></Field>
                      <Field label="Visual references — up to 5 · PNG, JPG, WEBP · 8 MB each">
                        <input type="file" multiple accept="image/png,image/jpeg,image/webp" className="mt-3 block text-sm file:mr-4 file:rounded-full file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-foreground" onChange={(e) => set("files", Array.from(e.target.files ?? []))} />
                      </Field>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>

              {err && <p className="mt-6 text-sm text-destructive">{err}</p>}
              <div className="mt-12 flex items-center justify-between">
                <button type="button" disabled={step === 0} onClick={() => { setErr(null); setStep(step - 1); }} className="font-mono text-xs uppercase tracking-widest disabled:opacity-30">← Back</button>
                <button type="submit" className="rounded-full bg-primary px-8 py-4 font-mono text-xs uppercase tracking-widest text-primary-foreground transition hover:scale-105">
                  {step < 4 ? "Continue →" : "Send brief"}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
