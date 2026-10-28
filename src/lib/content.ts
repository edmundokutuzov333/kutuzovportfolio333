export const profile = {
  name: "Edmundo Kutuzov",
  title: "Art Director",
  roles: ["Art Director", "Social Media Manager", "AI Expert", "Content Creator"],
  location: "Maputo — Moçambique, Africa",
  address: 'Magoanine "C", Maputo, Mozambique',
  email: "contact@edmundokutuzov.art",
  phone: "+258 87 601 312 1",
  whatsapp: "https://wa.me/258876013121",
  socials: [
    { label: "LinkedIn", href: "https://www.linkedin.com/in/edmundo-kutuzov-3457351b4" },
    { label: "Instagram", href: "https://www.instagram.com/edmundo.kutuzov/" },
    { label: "Facebook", href: "https://www.facebook.com/edmundoku/" },
  ],
  headline: "I make ideas stop, take notice, stay in memory, and act.",
  intro:
    "I'm Edmundo Kutuzov, an art director from Maputo operating globally, building brand systems that earn attention rather than beg for it. 30+ brands. One obsession: work that refuses to be ignored.",
};

export const metrics = [
  { value: "7+", label: "Years", note: "Directing visual communication & strategy" },
  { value: "150+", label: "Projects", note: "Delivered across branding, digital & print" },
  { value: "30+", label: "Brands", note: "National & international collaborations" },
  { value: "3", label: "Continents", note: "Global creative exposure & delivery" },
  { value: "360º", label: "Capability", note: "Art direction, branding, strategy, AI & marketing" },
];

export const experience = [
  {
    company: "WEBMASTERS Limitada",
    period: "2024 — Present",
    role: "Art Director & Content Creator",
    text: "Directing high-visibility visual campaigns, motion rollouts and multichannel creative systems for enterprise accounts in Mozambique.",
  },
  {
    company: "SPOT Comunicação",
    period: "2023 — 2024",
    role: "Art Director",
    text: "Leading campaign concepts and key visuals for agency clients across automotive, finance and consumer brands.",
  },
  {
    company: "Ikigai Moçambique",
    period: "2023",
    role: "Senior Graphic Designer",
    text: "Building identity and communication pieces with typographic rigour for corporate and institutional accounts.",
  },
  {
    company: "Imperial Seguros",
    period: "2023",
    role: "Marketing Assistant & Social Media Manager",
    text: "Running social presence and in-house campaign communication for an insurance brand.",
  },
  {
    company: "Agência Creer",
    period: "2020 — 2023",
    role: "Graphic Designer",
    text: "Advertising, print, digital content and institutional communication — the foundation years.",
  },
];

export const skills = [
  { name: "Adobe Photoshop", value: 95, tier: "Core" },
  { name: "Artificial Intelligence", value: 95, tier: "Core" },
  { name: "Adobe Illustrator", value: 75, tier: "Fluent" },
  { name: "Adobe Premiere", value: 75, tier: "Fluent" },
  { name: "Adobe After Effects", value: 45, tier: "Exploring" },
];

export const disciplines = [
  {
    group: "Core Disciplines",
    items: ["Art Direction", "Brand Identity Systems", "Campaign Design", "Creative Direction", "Visual Hierarchy & Typography"],
  },
  {
    group: "Digital & Motion",
    items: ["Social-First Content Systems", "Motion Design & Key Art", "UI/UX Design Systems", "AI Creative Direction", "Audiovisual Storytelling"],
  },
  {
    group: "Print & Special Projects",
    items: ["Editorial & Publications", "Large-Format OOH Billboards", "Packaging & Print Prep", "Music Video & Single Rollouts", "Streetwear Curation"],
  },
];

export const services = [
  {
    n: "01",
    slug: "identity",
    title: "Visual Identity",
    line: "Strategic brand marks, typography systems & identity architecture.",
    text: "Turning strategic brand intent into a recognisable visual form. A complete visual grammar — logo systems, proprietary type pairings, colour scales and identity manuals built to last.",
    deliverables: ["Brand Architecture & Strategy", "Logo Marks & Symbol Systems", "Custom Typographic Scales", "Comprehensive Identity Guidelines"],
  },
  {
    n: "02",
    slug: "art-direction",
    title: "Art Direction",
    line: "Campaign conception, visual storytelling & photography direction.",
    text: "Defining the visual dimension of campaigns and brand narratives. Photography direction, set styling, cinematic colour grading and commercial rollout systems for national and global markets.",
    deliverables: ["Campaign Visual Concepts", "Photography & Video Treatments", "Master Key Visuals (KV)", "Multi-Channel Rollout Systems"],
  },
  {
    n: "03",
    slug: "editorial",
    title: "Editorial & Print",
    line: "Tactile publications, large-format OOH & packaging design.",
    text: "Editorial compositions, annual reports, large-format billboards, product packaging and print production oversight — with typographic rigour from screen to press.",
    deliverables: ["Editorial Books & Publications", "Large-Format OOH & Billboards", "Packaging & Structural Design", "Print Production & Finish Specs"],
  },
  {
    n: "04",
    slug: "digital",
    title: "Digital Design",
    line: "Social-first content engines, motion assets & digital systems.",
    text: "Modular digital ecosystems that keep a brand present and in rhythm. Social publishing systems, UI/UX aesthetics, digital campaign kits, motion graphics and interactive web interfaces.",
    deliverables: ["Social-First Content Systems", "Dynamic Motion Language", "Digital Design Systems", "Interactive Web Experiences"],
  },
  {
    n: "05",
    slug: "ai",
    title: "AI Creative Direction",
    line: "Generative pipelines directed with an art director's eye.",
    text: "Using AI as a production instrument, not a shortcut — concept exploration, image synthesis, retouching and content at scale, always held to the brand system and human judgement.",
    deliverables: ["AI Concept Exploration", "Generative Key Art", "Image Manipulation & Retouch", "Scaled Content Production"],
  },
];

export const capabilities = ["Art Direction", "Brand Identity", "Campaign Design", "Creative Direction", "AI Creative Direction", "Digital Experience"];

export const projectTypes = [
  "Brand Identity", "Art Direction", "Campaign Design", "Social Media", "Motion Content", "Web Design",
  "Image Manipulation", "Video Direction", "Creative Strategy", "Content Creation", "Product Launch Design", "Visual Systems",
];

export const clients = [
  "Absa", "Toyota Moçambique", "Nissan Moçambique", "Hyundai Moçambique", "Galp", "TotalEnergies", "Vodacom",
  "Ronil Auto Moçambique", "Pernod Ricard Moçambique", "GIZ", "MultiChoice (DStv & GOtv)", "KitKat", "Flying Fish",
  "Brutal Fruit", "Joaquim Chaves Saúde", "Ponta Apart Hotel", "Hotel Cardoso", "EMOSE",
  "Moçambique Companhia de Seguros", "PROMAR",
].map((name, i) => ({ id: i + 1, name, logo: null as string | null }));

export const process = [
  { n: "01", title: "Discovery & Immersion", text: "Analysing strategic goals, competitive context and visual positioning." },
  { n: "02", title: "Strategic Direction", text: "Defining the core visual idea, moodboards and narrative entry points." },
  { n: "03", title: "Design & Craft", text: "Iterative execution of typography, symbols, layouts and photographic treatments." },
  { n: "04", title: "Production & Rollout", text: "Scalable guideline systems, motion assets, print finishes and digital kits." },
];

export const principles = [
  { title: "Clarity", text: "Every element must earn its place. Noise is the enemy of memory." },
  { title: "Rhythm", text: "Pacing dictates attention. Contrast creates engagement." },
  { title: "Precision", text: "Execution defines positioning. God is in the details." },
  { title: "Memory", text: "Aesthetic survival requires a distinct point of view." },
];

// Placeholder case studies — replace cover/gallery with official art when delivered.
export const projects = [
  { slug: "automotive-launch", title: "Drive the Coast", client: "Automotive", year: "2025", discipline: "Campaign Design", hue: 30 },
  { slug: "energy-identity", title: "Fuel of Tomorrow", client: "Energy", year: "2025", discipline: "Art Direction", hue: 200 },
  { slug: "telecom-social", title: "Always On", client: "Telecom", year: "2024", discipline: "Social Media", hue: 350 },
  { slug: "spirits-rollout", title: "Night Ritual", client: "Beverage", year: "2024", discipline: "Key Visual", hue: 50 },
  { slug: "hospitality-brand", title: "Ocean Rooms", client: "Hospitality", year: "2024", discipline: "Brand Identity", hue: 170 },
  { slug: "insurance-ooh", title: "Covered", client: "Insurance", year: "2023", discipline: "OOH & Print", hue: 260 },
  { slug: "music-rollout", title: "Single Season", client: "Music", year: "2023", discipline: "Video Direction", hue: 10 },
  { slug: "ai-series", title: "Synthetic Maputo", client: "Personal", year: "2025", discipline: "AI Creative Direction", hue: 120 },
].map((p) => ({ ...p, cover: null as string | null }));

export type Project = (typeof projects)[number];

export const budgets: Record<string, string[]> = {
  EUR: ["< €5K", "€5K – €15K", "€15K – €40K", "€40K+"],
  USD: ["< $5K", "$5K – $17K", "$17K – $45K", "$45K+"],
  MZN: ["< 350K MT", "350K – 1M MT", "1M – 2.5M MT", "2.5M MT+"],
  GBP: ["< £4K", "£4K – £13K", "£13K – £35K", "£35K+"],
  BRL: ["< R$25K", "R$25K – R$90K", "R$90K – R$220K", "R$220K+"],
};
