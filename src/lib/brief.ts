export type Brief = {
  name: string;
  email: string;
  company: string;
  role: string;
  location: string;
  phone: string;
  type: string;
  additionalTypes: string[];
  projectName: string;
  industry: string;
  projectStage: string;
  projectGoal: string;
  channels: string[];
  languages: string;
  existingAssets: string;
  styleDirection: string;
  successCriteria: string;
  deliverables: string[];
  audience: string;
  urgency: "low" | "normal" | "high" | "urgent";
  currency: string;
  budget: string;
  exact: string;
  negotiable: boolean;
  deadline: string;
  channel: "email" | "phone" | "whatsapp" | "linkedin";
  message: string;
  links: string;
  files: File[];
};

export const emptyBrief: Brief = {
  name: "",
  email: "",
  company: "",
  role: "",
  location: "",
  phone: "",
  type: "",
  additionalTypes: [],
  projectName: "",
  industry: "",
  projectStage: "",
  projectGoal: "",
  channels: [],
  languages: "",
  existingAssets: "",
  styleDirection: "",
  successCriteria: "",
  deliverables: [],
  audience: "",
  urgency: "normal",
  currency: "EUR",
  budget: "Prefer not to say",
  exact: "",
  negotiable: false,
  deadline: "",
  channel: "email",
  message: "",
  links: "",
  files: [],
};

export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_TOTAL_FILE_BYTES = 17 * 1024 * 1024;
export const FILE_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"] as const;

export const DELIVERABLE_OPTIONS = [
  "Brand strategy and positioning",
  "Naming and verbal identity",
  "Logo and visual identity",
  "Brand guidelines",
  "Campaign concept and key visual",
  "Social media assets",
  "Motion graphics and animation",
  "Video direction and production",
  "Website or landing page",
  "UI/UX design",
  "Presentation or pitch deck",
  "Packaging and product visuals",
  "Photography and image retouching",
  "3D, CGI or AI-generated visuals",
  "Content strategy and copy",
  "Launch assets and rollout",
] as const;

export const INDUSTRIES = [
  "Technology and SaaS",
  "Finance and fintech",
  "Consumer goods and FMCG",
  "Fashion and lifestyle",
  "Entertainment and music",
  "Hospitality and tourism",
  "Real estate and construction",
  "Healthcare and wellness",
  "Education",
  "NGO and social impact",
  "Public sector",
  "Retail and e-commerce",
  "Food and beverage",
  "Other",
] as const;

export const PROJECT_GOALS = [
  "Brand awareness and positioning", "Product or service launch", "Lead generation and sales",
  "Audience growth and engagement", "Rebrand or repositioning", "Investor or sales presentation",
  "Recruitment and employer branding", "Customer retention", "Event or activation", "Other / still defining",
] as const;

export const CHANNEL_OPTIONS = [
  "Social media", "Website / landing page", "Digital advertising", "Email marketing", "Print / outdoor",
  "Packaging", "Video / motion", "Events / activation", "Retail / point of sale", "Internal communications", "Not decided yet",
] as const;

export const PROJECT_STAGES = [
  "Idea or early concept",
  "Strategy and planning",
  "New brand or product launch",
  "Existing brand refresh",
  "Campaign already in progress",
  "Ready for execution",
  "Not sure yet",
] as const;

export function validateStep(step: number, b: Brief): string | null {
  if (step === 0) {
    if (!b.name.trim()) return "Full name is required.";
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(b.email.trim())) return "A valid email is required.";
  }

  if (step === 1) {
    if (!b.type) return "Choose at least one service.";
    if (b.additionalTypes.includes(b.type)) return "The main service cannot also be listed as an additional service.";
    if (b.additionalTypes.some((value) => !value.trim())) return "Remove empty additional services.";
    if (b.projectStage && !(PROJECT_STAGES as readonly string[]).includes(b.projectStage)) return "Choose a valid project stage.";
    if (b.projectGoal && !(PROJECT_GOALS as readonly string[]).includes(b.projectGoal)) return "Choose a valid project goal.";
    if (b.channels.some((value) => !(CHANNEL_OPTIONS as readonly string[]).includes(value))) return "Remove an invalid channel.";
    if (b.industry && !(INDUSTRIES as readonly string[]).includes(b.industry)) return "Choose a valid industry.";
  }

  if (step === 2 && b.deliverables.some((value) => !(DELIVERABLE_OPTIONS as readonly string[]).includes(value))) {
    return "Remove an invalid deliverable and try again.";
  }

  if (step === 4) {
    const len = b.message.trim().length;
    if (len < 10) return "Message needs at least 10 characters.";
    if (len > 4000) return "Message can be at most 4,000 characters.";
    const links = b.links.split(/\\s+/).filter(Boolean);
    if (links.length > 10) return "You can add up to 10 reference links.";
    if (links.some((link) => {
      try {
        const parsed = new URL(link);
        return !["http:", "https:"].includes(parsed.protocol) || !parsed.hostname;
      } catch {
        return true;
      }
    })) return "Each link must be a valid http:// or https:// URL.";
    if (b.files.length > MAX_FILES) return `Up to ${MAX_FILES} files.`;
    if (b.files.some((file) => !FILE_TYPES.includes(file.type as typeof FILE_TYPES[number]))) return "Files must be PNG, JPG, WEBP or PDF.";
    if (b.files.some((file) => file.size > MAX_FILE_BYTES)) return "Each file must be 8 MB or less.";
    if (b.files.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_FILE_BYTES) return "The combined file size must be 17 MB or less.";
  }
  return null;
}
