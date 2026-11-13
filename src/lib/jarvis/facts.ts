export type JarvisLocale = "pt" | "en";
export type Fact = {
  key: string;
  locale: "all" | JarvisLocale;
  value: string;
  spoken: string | null;
  status: "verified" | "pending_review" | "rejected" | "deprecated";
  visibility: "public" | "private";
  priority: number;
  source: string;
};

export const approved = (facts: Fact[], locale: JarvisLocale): Fact[] =>
  facts.filter((fact) => fact.status === "verified" && fact.visibility === "public"
    && !fact.key.includes(".candidate.")
    && (fact.locale === "all" || fact.locale === locale))
    .sort((a, b) => a.priority - b.priority || a.key.localeCompare(b.key));

export function factValue(facts: Fact[], key: string, locale: JarvisLocale = "pt"): string | null {
  const value = approved(facts, locale).find((f) => f.key === key);
  return value?.value ?? null;
}

/** The system prompt deliberately contains no hardcoded personal contact details. */
export function buildFactsBlock(facts: Fact[], locale: JarvisLocale = "pt"): string {
  return approved(facts, locale).map(({ key, value }) => key + " = " + value)
    .join("\n").slice(0, 5700);
}

export function buildCoreProfile(facts: Fact[], locale: JarvisLocale = "pt"): string {
  const values = approved(facts, locale)
    .filter(({ key }) => /^(identity\.|value\.|service\.|stats\.)/.test(key))
    .map(({ key, value }) => key + ": " + value);
  return values.join("\n").slice(0, 5000);
}

export function getContact(facts: Fact[], locale: JarvisLocale = "pt") {
  const value = (key: string) => factValue(facts, key, locale);
  return {
    email: value("contact.email"),
    emailSpoken: approved(facts, locale).find(f => f.key === "contact.email")?.spoken ?? null,
    phone: value("contact.phone"),
    whatsapp: value("contact.whatsapp"),
    site: value("contact.site"),
    linkedin: value("social.linkedin"),
    instagram: value("social.instagram"),
    facebook: value("social.facebook"), // Deliberately null until approved.
  };
}

const normaliseDigits = (input: string) => input.replace(/\D/g, "");
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const urlPattern = /https?:\/\/[^\s<>"'()]+/gi;
const phonePattern = /(?:\+?\d[\d\s().-]{8,}\d)/g;

export function validateContacts(answer: string, facts: Fact[], locale: JarvisLocale = "pt") {
  const contact = getContact(facts, locale);
  const allowedEmails = new Set([contact.email?.toLowerCase()].filter(Boolean));
  const allowedPhones = new Set([contact.phone, contact.whatsapp].filter((v): v is string => !!v)
    .map(normaliseDigits));
  const approvedUrls = approved(facts, locale)
    .filter(fact => /^(?:contact\.(?:site|whatsapp)|social\.(?:linkedin|instagram|facebook))$/.test(fact.key))
    .map(fact => fact.value).filter(v => /^https:\/\//.test(v));
  const officialSite = contact.site;
  let flagged = false;
  const reasons = new Set<string>();

  // HTML is never generated. Unsupported URLs are replaced, not escaped as links.
  let text = answer.replace(urlPattern, (raw) => {
    const punctuation = /[.,;!?]+$/.exec(raw)?.[0] ?? "";
    const url = raw.slice(0, raw.length - punctuation.length);
    const trusted = approvedUrls.includes(url)
      || (!!officialSite && url.startsWith(officialSite + "/work/"));
    if (trusted) return raw;
    flagged = true; reasons.add("unverified_url");
    return (officialSite ?? (locale==="en"?"unverified address":"endereço não confirmado")) + punctuation;
  });
  text = text.replace(emailPattern, (value) => {
    if (allowedEmails.has(value.toLowerCase())) return value;
    flagged = true; reasons.add("unverified_email");
    return contact.email ?? (locale==="en"?"unverified email":"email não confirmado");
  });
  text = text.replace(phonePattern, (value) => {
    if (allowedPhones.has(normaliseDigits(value)) || normaliseDigits(value).length < 10) return value;
    flagged = true; reasons.add("unverified_phone");
    return contact.phone ?? (locale==="en"?"unverified phone":"telefone não confirmado");
  });
  return { text, flagged, reasons: [...reasons] };
}

/** Contact requests bypass the model entirely. No hallucination and no model latency. */
export function answerContactQuestion(question: string, facts: Fact[], locale: JarvisLocale): string | null {
  const q = question.toLowerCase();
  const c = getContact(facts, locale);
  const en = locale === "en";
  if (/\b(?:facebook|fb\.com)\b/i.test(q))
    return en ? "The Facebook profile has not yet been confirmed. Please use the official website."
      : "O perfil de Facebook ainda não está confirmado. Utilize o site oficial.";
  if (/(?:e-?mail|correio electr[oó]nico|endereço de email)/i.test(q) && c.email)
    return en ? "Edmundo's verified email is " + c.email : "O email oficial do Edmundo é " + c.email;
  if (/(?:whats?app)/i.test(q) && c.whatsapp)
    return en ? "Edmundo's official WhatsApp is " + c.whatsapp : "O WhatsApp oficial do Edmundo é " + c.whatsapp;
  if (/(?:telefone|telem[oó]vel|n[uú]mero de contacto|phone number|mobile number)/i.test(q) && c.phone)
    return en ? "The official phone contact is " + c.phone : "O contacto telefónico oficial é " + c.phone;
  if (/linkedin/i.test(q) && c.linkedin) return en ? "Verified LinkedIn: " + c.linkedin : "LinkedIn oficial: " + c.linkedin;
  if (/instagram/i.test(q) && c.instagram) return en ? "Verified Instagram: " + c.instagram : "Instagram oficial: " + c.instagram;
  if (/(?:site oficial|official (?:site|website)|site do edmundo|website do edmundo)/i.test(q) && c.site)
    return en ? "Official website: " + c.site : "O site oficial é " + c.site;
  if (/(?:como (?:posso )?(?:entrar em )?contact|contactar|contacto do edmundo|how (?:can i )?contact|hire edmundo)/i.test(q) && c.email)
    return en ? "You can contact Edmundo at " + c.email
      : "Pode contactar o Edmundo através de " + c.email;
  return null;
}

export function redactQuery(input: string): string {
  return input.slice(0, 350).replace(emailPattern, "[EMAIL]")
    .replace(urlPattern, "[URL]").replace(phonePattern, "[TELEFONE]");
}
