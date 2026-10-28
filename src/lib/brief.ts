export type Brief = {
  name: string; email: string; company: string; role: string; location: string; phone: string;
  type: string; urgency: "low" | "normal" | "high" | "urgent";
  currency: string; budget: string; exact: string; negotiable: boolean;
  deadline: string; channel: "email" | "phone" | "whatsapp" | "linkedin";
  message: string; links: string; files: File[];
};

export const emptyBrief: Brief = {
  name: "", email: "", company: "", role: "", location: "", phone: "",
  type: "", urgency: "normal", currency: "EUR", budget: "Prefer not to say", exact: "", negotiable: false,
  deadline: "", channel: "email", message: "", links: "", files: [],
};

export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const FILE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function validateStep(step: number, b: Brief): string | null {
  if (step === 0) {
    if (!b.name.trim()) return "Full name is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) return "A valid email is required.";
  }
  if (step === 1 && !b.type) return "Choose a project type.";
  if (step === 4) {
    const len = b.message.trim().length;
    if (len < 10) return "Message needs at least 10 characters.";
    if (len > 4000) return "Message can be at most 4,000 characters.";
    const links = b.links.split(/\s+/).filter(Boolean);
    if (links.some((l) => !/^https?:\/\/\S+$/i.test(l))) return "Links must start with http:// or https://";
    if (b.files.length > MAX_FILES) return `Up to ${MAX_FILES} files.`;
    if (b.files.some((f) => !FILE_TYPES.includes(f.type))) return "Files must be PNG, JPG or WEBP.";
    if (b.files.some((f) => f.size > MAX_FILE_BYTES)) return "Each file must be 8 MB or less.";
  }
  return null;
}
