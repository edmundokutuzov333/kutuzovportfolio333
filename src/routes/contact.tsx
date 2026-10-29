import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useState, type ReactNode } from "react";
import { PageHero } from "@/components/Reveal";
import { DELIVERABLE_OPTIONS, INDUSTRIES, MAX_TOTAL_FILE_BYTES, PROJECT_STAGES, emptyBrief, validateStep, type Brief } from "@/lib/brief";
import { loadContactContent } from "@/lib/cms/loaders";
import { requireHeroSection } from "@/lib/cms/section-utils";
import { seoFromPage } from "@/lib/seo";
import { submitContactForm } from "@/lib/public-forms";

export const Route = createFileRoute("/contact")({
  loader: () => loadContactContent(),
  head: ({ loaderData }) => loaderData ? seoFromPage(loaderData.page) : { meta: [{ title: "Contact — Edmundo Kutuzov" }] },
  component: Contact,
});

const input = "w-full border-b border-foreground/30 bg-transparent py-3 text-lg outline-none transition focus:border-primary placeholder:text-muted-foreground/60";
const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block"><span className="eyebrow">{label}</span>{children}</label>
);
const Chip = ({ on, children, onClick }: { on: boolean; children: ReactNode; onClick: () => void }) => (
  <button type="button" onClick={onClick} className={`rounded-full border px-4 py-2 text-sm transition ${on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-foreground"}`}>{children}</button>
);

function Contact() {
  const data = Route.useLoaderData();
  const { profile, budgets, projectTypes, contactSteps } = data;
  const hero = requireHeroSection(data.sections);
  const [step, setStep] = useState(0);
  const [b, setB] = useState<Brief>(emptyBrief);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [notificationStatus, setNotificationStatus] = useState<string>("");
  const [receiptStatus, setReceiptStatus] = useState<string>("");
  const set = <K extends keyof Brief>(k: K, v: Brief[K]) => setB((p) => ({ ...p, [k]: v }));
  const toggleService = (service: string) => {
    if (b.type === service) {
      const [nextPrimary = "", ...remaining] = b.additionalTypes;
      setB((current) => ({ ...current, type: nextPrimary, additionalTypes: remaining }));
    } else if (b.additionalTypes.includes(service)) {
      set("additionalTypes", b.additionalTypes.filter((item) => item !== service));
    } else if (!b.type) {
      set("type", service);
    } else {
      set("additionalTypes", [...b.additionalTypes, service]);
    }
  };
  const toggleDeliverable = (item: string) => {
    set("deliverables", b.deliverables.includes(item)
      ? b.deliverables.filter((value) => value !== item)
      : [...b.deliverables, item]);
  };

  const next = async () => {
    const validationError = validateStep(step, b);
    setErr(validationError);
    if (validationError || submitting) return;
    if (step < 4) {
      setStep((current) => Math.min(current + 1, 4));
      return;
    }

    setSubmitting(true);
    const payload = new FormData();
    payload.set("name", b.name.trim());
    payload.set("email", b.email.trim().toLowerCase());
    payload.set("company", b.company);
    payload.set("role", b.role);
    payload.set("location", b.location);
    payload.set("phone", b.phone);
    payload.set("type", b.type);
    payload.set("additionalTypes", JSON.stringify(b.additionalTypes));
    payload.set("projectName", b.projectName);
    payload.set("industry", b.industry);
    payload.set("projectStage", b.projectStage);
    payload.set("deliverables", JSON.stringify(b.deliverables));
    payload.set("audience", b.audience);
    payload.set("urgency", b.urgency);
    payload.set("currency", b.currency);
    payload.set("budget", b.budget);
    payload.set("exact", b.exact);
    payload.set("negotiable", b.negotiable ? "true" : "false");
    payload.set("deadline", b.deadline);
    payload.set("channel", b.channel);
    payload.set("message", b.message.trim());
    payload.set("links", b.links);
    for (const file of b.files) payload.append("files", file, file.name);

    try {
      const result = await submitContactForm(payload);
      if (!result.ok || !result.submissionId) {
        throw new Error("The database did not confirm the enquiry.");
      }
      setSubmittedId(result.submissionId);
      setNotificationStatus(result.notification ?? "recipient_unconfigured");
      setReceiptStatus(result.receipt ?? "email_delivery_failed");
      setErr(null);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "The enquiry could not be confirmed. Your details have not been marked as sent; retry or use the email/WhatsApp links above.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHero eyebrow={hero.config.eyebrow} lines={hero.config.lines} intro={hero.config.intro ?? ""} />

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
          {contactSteps.map((s, i) => (
            <div key={s.k} className={`flex items-center gap-4 transition ${i === step ? "text-foreground" : "text-muted-foreground"}`}>
              <span className={`font-mono text-xs ${i <= step ? "text-primary" : ""}`}>0{i + 1}</span>
              <span className="font-display text-xl">{s.k}</span>
            </div>
          ))}
          <p className="pt-10 text-sm text-muted-foreground">{profile.address}</p>
        </aside>

        <div>
          {!submittedId && (
            <div role="status" className="mb-6 border border-border bg-secondary/40 p-4 text-sm leading-6 text-muted-foreground">
              Your enquiry is submitted to secure storage only after you press Send enquiry and the server confirms the database write.
            </div>
          )}
          {submittedId ? (
            <div role="status" className="border border-primary/40 bg-secondary/40 p-6 text-sm leading-7">
              <h2 className="font-display text-2xl font-semibold">Enquiry received.</h2>
              <p className="mt-3">The database confirmed your request. Reference: <span className="font-mono text-xs">{submittedId}</span></p>
              {notificationStatus === "sent"
                ? <p className="mt-3 text-muted-foreground">The studio notification was accepted by the email provider.</p>
                : <p className="mt-3 text-muted-foreground">The enquiry is safely stored, but the studio notification was not confirmed as sent ({notificationStatus}). No data was lost and you do not need to submit the enquiry again.</p>}
              {receiptStatus === "sent"
                ? <p className="mt-3 text-muted-foreground">A receipt has also been sent to the email address you provided.</p>
                : <p className="mt-3 text-muted-foreground">The automatic receipt email could not be confirmed as sent ({receiptStatus}). Your enquiry is still recorded under the reference above.</p>}
            </div>
          ) : (
          <form onSubmit={(e) => { e.preventDefault(); void next(); }}>
              <AnimatePresence mode="wait">
                <motion.div key={step} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="space-y-8">
                  <div>
                    <h2 className="font-display text-4xl font-bold md:text-5xl">{contactSteps[step]?.t}</h2>
                    <p className="mt-3 text-muted-foreground">{contactSteps[step]?.d}</p>
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
                    <div className="space-y-8">
                      <div>
                        <p className="eyebrow mb-3">Services required * <span className="normal-case tracking-normal text-muted-foreground">Select all that apply. Your first selection becomes the main service.</span></p>
                        <div className="flex flex-wrap gap-2">
                          {projectTypes.map((service) => {
                            const primary = b.type === service;
                            const additional = b.additionalTypes.includes(service);
                            return (
                              <Chip key={service} on={primary || additional} onClick={() => toggleService(service)}>
                                {primary ? "01 · " : additional ? "✓ · " : ""}{service}
                              </Chip>
                            );
                          })}
                        </div>
                        {(b.type || b.additionalTypes.length > 0) && (
                          <p className="mt-3 text-xs leading-5 text-muted-foreground">
                            Main service: {b.type || "Not selected"}{b.additionalTypes.length ? ` · Also requested: ${b.additionalTypes.join(", ")}` : ""}
                          </p>
                        )}
                      </div>
                      <div className="grid gap-8 md:grid-cols-2">
                        <Field label="Project / campaign name (optional)">
                          <input className={input} maxLength={180} value={b.projectName} onChange={(e) => set("projectName", e.target.value)} placeholder="e.g. 2027 product launch" />
                        </Field>
                        <Field label="Industry">
                          <select className={input} value={b.industry} onChange={(e) => set("industry", e.target.value)}>
                            <option value="">Choose an industry</option>
                            {INDUSTRIES.map((industry) => <option key={industry} value={industry}>{industry}</option>)}
                          </select>
                        </Field>
                        <div className="md:col-span-2">
                          <Field label="Project stage">
                            <select className={input} value={b.projectStage} onChange={(e) => set("projectStage", e.target.value)}>
                              <option value="">Choose a stage (optional)</option>
                              {PROJECT_STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                            </select>
                          </Field>
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div className="space-y-10">
                      <div className="space-y-4">
                        <p className="eyebrow">Expected deliverables <span className="normal-case tracking-normal text-muted-foreground">Select all that apply</span></p>
                        <div className="flex flex-wrap gap-2">
                          {DELIVERABLE_OPTIONS.map((item) => (
                            <Chip key={item} on={b.deliverables.includes(item)} onClick={() => toggleDeliverable(item)}>{item}</Chip>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <p className="eyebrow">Budget range</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.keys(budgets).map((currency) => <Chip key={currency} on={b.currency === currency} onClick={() => set("currency", currency)}>{currency}</Chip>)}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {["Prefer not to say", ...(budgets[b.currency] ?? [])].map((range) => <Chip key={range} on={b.budget === range} onClick={() => set("budget", range)}>{range}</Chip>)}
                        </div>
                        <div className="grid items-end gap-8 md:grid-cols-2">
                          <Field label="Exact amount (optional)">
                            <input inputMode="decimal" className={input} value={b.exact} onChange={(e) => set("exact", e.target.value)} placeholder="e.g. 45000" />
                          </Field>
                          <label className="flex items-center gap-3 pb-3">
                            <input type="checkbox" checked={b.negotiable} onChange={(e) => set("negotiable", e.target.checked)} className="accent-primary" />
                            Budget is negotiable
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 3 && (
                    <div className="space-y-8">
                      <div>
                        <p className="eyebrow mb-3">Urgency</p>
                        <div className="flex flex-wrap gap-2">
                          {([["low", "Exploring"], ["normal", "Normal"], ["high", "High priority"], ["urgent", "Urgent"]] as const).map(([value, label]) => (
                            <Chip key={value} on={b.urgency === value} onClick={() => set("urgency", value)}>{label}</Chip>
                          ))}
                        </div>
                      </div>
                      <Field label="Target deadline (optional)">
                        <input type="date" className={input} value={b.deadline} onChange={(e) => set("deadline", e.target.value)} />
                      </Field>
                      <div>
                        <p className="eyebrow mb-3">Preferred contact channel</p>
                        <div className="flex flex-wrap gap-2">
                          {(["email", "phone", "whatsapp", "linkedin"] as const).map((channel) => <Chip key={channel} on={b.channel === channel} onClick={() => set("channel", channel)}>{channel.charAt(0).toUpperCase() + channel.slice(1)}</Chip>)}
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 4 && (
                    <div className="space-y-8">
                      <Field label="Project brief *">
                        <textarea rows={6} maxLength={4000} className={input} value={b.message} onChange={(e) => set("message", e.target.value)} placeholder="What are you building, what needs to change, and what would a successful result look like?" />
                        <span className="mt-2 block text-xs text-muted-foreground">{b.message.length}/4000 characters</span>
                      </Field>
                      <Field label="Target audience (optional)">
                        <textarea rows={2} maxLength={800} className={input} value={b.audience} onChange={(e) => set("audience", e.target.value)} placeholder="Who should this work reach or influence?" />
                      </Field>
                      <Field label="Reference links">
                        <textarea rows={3} maxLength={2000} className={input} placeholder={"One URL per line, up to 10 links\nhttps://example.com"} value={b.links} onChange={(e) => set("links", e.target.value)} />
                      </Field>
                      <div>
                        <p className="eyebrow">Attachments</p>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">Up to 5 files. PNG, JPG, WEBP or PDF. 8 MB per file, 17 MB combined. Files are attached to the email using the original filenames.</p>
                        <input
                          type="file"
                          multiple
                          accept="image/png,image/jpeg,image/webp,application/pdf,.pdf"
                          className="mt-4 block w-full text-sm file:mr-4 file:rounded-full file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-foreground"
                          onChange={(event) => {
                            const files = Array.from(event.target.files ?? []);
                            set("files", files);
                            const total = files.reduce((sum, file) => sum + file.size, 0);
                            if (files.length > 5) setErr("You can attach up to 5 files.");
                            else if (total > MAX_TOTAL_FILE_BYTES) setErr("The combined file size must be 17 MB or less.");
                            else if (files.some((file) => file.size > 8 * 1024 * 1024)) setErr("Each file must be 8 MB or less.");
                            else setErr(null);
                          }}
                        />
                        {b.files.length > 0 && (
                          <ul className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
                            {b.files.map((file, index) => (
                              <li key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between gap-4">
                                <span className="min-w-0 truncate">{file.name} <span className="text-xs text-muted-foreground">({(file.size / 1024 / 1024).toFixed(2)} MB)</span></span>
                                <button type="button" className="shrink-0 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground" onClick={() => set("files", b.files.filter((_, fileIndex) => fileIndex !== index)}>Remove</button>
                              </li>
                            ))}
                          </ul>
                        )}
                        {b.files.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{(b.files.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024).toFixed(2)} MB of 17 MB used</p>}
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {err && <p className="mt-6 text-sm text-destructive">{err}</p>}
              <div className="mt-12 flex items-center justify-between">
                <button type="button" disabled={step === 0} onClick={() => { setErr(null); setStep(step - 1); }} className="font-mono text-xs uppercase tracking-widest disabled:opacity-30">← Back</button>
                <button type="submit" disabled={submitting} className="rounded-full bg-primary px-8 py-4 font-mono text-xs uppercase tracking-widest text-primary-foreground transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50">
                  {submitting ? "Sending..." : step < 4 ? "Continue →" : "Send enquiry"}
                </button>
              </div>
          </form>
          )}
        </div>
      </section>
    </>
  );
}
