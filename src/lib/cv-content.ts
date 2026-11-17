import { originalCv } from "@/lib/cv-original";
import type { SiteLanguage } from "@/lib/i18n";

/** One shared source for browser, print and generated PDF. No fabricated employment or metrics. */
export const cvBrands = [
  "Absa", "Flying Fish", "Brutal", "Pernod Ricard Moçambique",
  "Nissan Moçambique", "Galp Moçambique", "Total Energies",
  "MultiChoice (DSTV & GOTV)", "EMOSE", "Moçambique Companhia de Seguros",
  "Kit Kat Moçambique", "Joaquim Chaves Saúde", "Vodacom", "Toyota",
  "GIZ – German Corporation for International Cooperation",
  "Hyundai Moçambique"
] as const;

const enRoles = [
  "Graphic Designer",
  "Marketing Assistant & Social Media Manager",
  "Graphic Designer",
  "Art Director",
  "Art Director & Content Creator"
] as const;

export const cvLanguages = {
  en: {
    role: ["VISUAL COMMUNICATION DESIGNER", "& ART DIRECTOR"],
    about: "About Me",
    summary: [
      "I'm an Art Director and creative based in Maputo, Mozambique. I entered the world of design and communication at 17, developing a practice built around ideas, visual direction and rigorous execution. My work is driven by a clear point of view: every element should earn its place, and creative decisions should be as considered as they are memorable.",
      "My experience spans agency art departments, marketing and collaborations with national and international brands. I connect concept, craft and context across brand identity, campaigns and digital communication — with attention to the details that give work character and staying power."
    ],
    collaborations: "Selected collaborations",
    experience: "EXPERIENCE",
    education: "EDUCATION",
    grade: "12th Grade",
    present: "Present",
    skills: "SKILLS",
    contact: "CONTACT",
    phone: "Phone",
    email: "Email",
    address: "Address",
    reference: "REFERENCE",
    referenceRole: "Art Director - SPOT Comunicação",
    referencePhone: `Phone: ${originalCv.reference.phone}`,
    localeAddress: ["Magoanine “C”", "Maputo, Mozambique"],
    roles: enRoles,
    back: "Back to About",
    download: "Download designed CV (PDF)",
    print: "Print CV",
    nav: "CV sections",
    switcher: "CV language",
  },
  "pt-PT": {
    role: ["DESIGNER DE COMUNICAÇÃO VISUAL", "& DIRECTOR DE ARTE"],
    about: "Sobre Mim",
    summary: [
      "Sou director de arte e criativo, com base em Maputo, Moçambique. Entrei no universo do design e da comunicação aos 17 anos e desenvolvi uma prática que aproxima conceito, direcção visual e execução rigorosa. Defendo que cada elemento deve merecer o seu lugar — e que a melhor criatividade não depende de ruído para ser memorável.",
      "O meu percurso cruza departamentos de arte em agências, marketing e colaborações com marcas nacionais e internacionais. Trabalho entre identidade visual, campanhas e comunicação digital, com uma visão clara: unir ideia, contexto e detalhe para produzir trabalhos com carácter, coerência e relevância."
    ],
    collaborations: "Colaborações seleccionadas",
    experience: "EXPERIÊNCIA",
    education: "EDUCAÇÃO",
    grade: originalCv.education.level,
    present: "Presente",
    skills: "SKILLS",
    contact: "CONTACTO",
    phone: "Celular",
    email: "Email",
    address: "Endereço",
    reference: "REFERÊNCIA",
    referenceRole: originalCv.reference.role,
    referencePhone: originalCv.reference.phoneLine,
    localeAddress: [...originalCv.contact.address],
    roles: originalCv.experience.items.map(item=>item.role),
    back: "Voltar à About",
    download: "Descarregar CV actual (PDF)",
    print: "Imprimir CV",
    nav: "Secções do CV",
    switcher: "Idioma do CV",
  },
} as const;

export function getCvContent(lang: SiteLanguage) {
  const content = cvLanguages[lang];
  const experiences = originalCv.experience.items.map((item,index)=>({
    company:item.company,
    period:lang==="en" ? item.period.replace("Presente","Present") : item.period,
    role:content.roles[index]
  }));
  const sections = [
    {id:"sobre",heading:content.about},
    {id:"experiencia",heading:content.experience},
    {id:"educacao",heading:content.education},
    {id:"skills",heading:content.skills},
    {id:"contacto",heading:content.contact},
    {id:"referencia",heading:content.reference}
  ] as const;
  return { ...content, experiences, sections, brands:cvBrands };
}

export const cvPdfForLanguage = (lang: SiteLanguage) =>
  lang==="pt-PT" ? "/cv/Edmundo-Kutuzov-CV-PT.pdf" : "/cv/Edmundo-Kutuzov-CV-EN.pdf";
