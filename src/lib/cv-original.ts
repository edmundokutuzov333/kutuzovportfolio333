import { profilePortrait } from "@/lib/profile-portrait";

/**
 * Verbatim content from the original single-page image-based CV.
 *
 * Source: public/edmundo-kutuzov-cv-2026.pdf
 * Original PDF SHA256: 4ebf841282ac47b386c8dab6e4f37dfc09950704aa925bd563ac08efb7ce9e37
 * All visible content was visually checked against the embedded page image.
 * Deliberately preserve spellings and figures, including "Adobe Potoshop".
 * The portfolio image is a replaceable presentation asset, not archival PDF text.
 * This is not sourced from the About CMS, translations or profile fallbacks.
 */
export const originalCv = {
  name: ["EDMUNDO", "KUTUZOV."],
  role: ["VISUAL COMMUNICATION DESIGNER", "& ART DIRECTOR"],
  photo: profilePortrait,
  pdf: "/edmundo-kutuzov-cv-2026.pdf",
  about: {
    heading: "Sobre Mim",
    text: "Criativo de 23 anos, iniciei a carreira aos 17 em agências de referência. Colaborei com marcas como Absa, Pernod Ricard Moçambique, Nissan Moçambique, Galp, TotalEnergies, MultiChoice, Vodacom, Toyota, KitKat Moçambique e GIZ, entregando soluções visuais sólidas e coerentes.",
  },
  education: {
    heading: "EDUCAÇÃO",
    school: "Escola Secundária Quisse Mavota",
    level: "12a Classe",
    year: "2019",
  },
  experience: {
    heading: "EXPERIÊNCIA",
    items: [
      { company: "Agência Creer", period: "2020 - 2023", role: "Designer Gráfico" },
      { company: "Imperial Seguros", period: "2023 - 2023", role: "Assistente de Marketing & Gestor de Redes Sociais" },
      { company: "Ikigai Moçambique", period: "2023 - 2023", role: "Designer Gráfico" },
      { company: "SPOT Comunicação", period: "2023 - 2024", role: "Director de Arte" },
      { company: "WEBMASTERS Limitada", period: "2024 - Presente", role: "Director de Arte & Criador de Conteúdo" },
    ],
  },
  contact: {
    heading: "CONTACTO",
    phoneLabel: "Celular",
    phone: "+258 87 601 312 1",
    emailLabel: "Email",
    email: "edmundokutuzov.mz@gmail.com",
    addressLabel: "Endereço",
    address: ["Magoanine “C”", "Maputo, Moçambique"],
  },
  skills: {
    heading: "SKILLS",
    items: [
      { name: "Adobe Potoshop", value: 95 },
      { name: "Adobe Illustrator", value: 75 },
      { name: "Adobe Premiere", value: 55 },
      { name: "Adobe InDesign", value: 55 },
      { name: "Inteligência Artificial", value: 95 },
    ],
  },
  reference: {
    heading: "REFERÊNCIA",
    name: "Ferrão Chico",
    role: "Director de Arte - SPOT Comunicação",
    phoneLine: "Celular: +258 84 579 2106",
    phone: "+258 84 579 2106",
  },
} as const;

export type CvSectionId = "sobre" | "experiencia" | "educacao" | "skills" | "contacto" | "referencia";

export const cvSections: ReadonlyArray<{id: CvSectionId; heading: string}> = [
  { id: "sobre", heading: originalCv.about.heading },
  { id: "experiencia", heading: originalCv.experience.heading },
  { id: "educacao", heading: originalCv.education.heading },
  { id: "skills", heading: originalCv.skills.heading },
  { id: "contacto", heading: originalCv.contact.heading },
  { id: "referencia", heading: originalCv.reference.heading },
];

export const normaliseCvPhone = (phone: string) => `tel:${phone.replace(/[^+\d]/g, "")}`;
