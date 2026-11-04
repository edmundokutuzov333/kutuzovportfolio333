import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type SiteLanguage = "en" | "pt-PT";

const copy = {
  en: {
    language: "Language",
    english: "English",
    portuguese: "Português",
    home: "Home",
    work: "Work",
    about: "About",
    services: "Services",
    process: "Process",
    clients: "Clients",
    contact: "Contact",
    menu: "Menu",
    close: "Close",
    replay: "Replay intro",
    scroll: "↓ Scroll",
    all: "All",
    challenge: "The challenge",
    idea: "The idea",
    outcome: "The outcome",
    nextProject: "Next project",
    client: "Client",
    discipline: "Discipline",
    year: "Year",
    role: "Role",
    available: "Available for projects",
    talk: "Let's talk.",
    newsletter: "Newsletter: new work and availability",
    allProjects: "All projects",
    exploreProject: "Explore project",
    selected: "Selected",
  },
  "pt-PT": {
    language: "Idioma",
    english: "English",
    portuguese: "Português",
    home: "Início",
    work: "Trabalhos",
    about: "Sobre",
    services: "Serviços",
    process: "Processo",
    clients: "Clientes",
    contact: "Contacto",
    menu: "Menu",
    close: "Fechar",
    replay: "Repetir introdução",
    scroll: "↓ Deslizar",
    all: "Todos",
    challenge: "O desafio",
    idea: "A ideia",
    outcome: "O resultado",
    nextProject: "Próximo projecto",
    client: "Cliente",
    discipline: "Disciplina",
    year: "Ano",
    role: "Função",
    available: "Disponível para projectos",
    talk: "Vamos conversar.",
    newsletter: "Newsletter: novos trabalhos e disponibilidade",
    allProjects: "Todos os projectos",
    exploreProject: "Explorar projecto",
    selected: "Selecção",
  },
} as const;

type TranslationKey = keyof typeof copy.en;
const contentTranslations: Record<string, string> = {
  "Maputo · Available for projects": "Maputo · Disponível para projectos",
  "I make ideas stop, take notice, stay in memory, and act.": "Faço as ideias parar, chamar atenção, ficar na memória e levar à acção.",
  "I'm Edmundo Kutuzov, an art director from Maputo operating globally, building brand systems that earn attention rather than beg for it. 30+ brands. One obsession: work that refuses to be ignored.": "Sou Edmundo Kutuzov, director de arte de Maputo com trabalho global, e construo sistemas de marca que conquistam atenção em vez de a pedir. Mais de 30 marcas. Uma obsessão: trabalho que se recusa a ser ignorado.",
  "Art Director": "Director de arte",
  "Social Media Manager": "Gestor de redes sociais",
  "AI Expert": "Especialista em IA",
  "Content Creator": "Criador de conteúdo",
  "Art Director / Social Media Manager / AI Expert / Content Creator": "Director de Arte / Gestor de Redes Sociais / Especialista em IA / Criador de Conteúdo",
  "Maputo — Moçambique, Africa": "Maputo - Moçambique, África",
  "Selected work": "Trabalho seleccionado",
  "All projects": "Todos os projectos",
  "Work that refuses": "Trabalho que se recusa",
  "to be ignored.": "a ser ignorado.",
  "Visual capabilities & disciplines": "Capacidades visuais e disciplinas",
  "See all": "Ver todos",
  "Brands and teams": "Marcas e equipas",
  "I have worked with.": "com quem trabalhei.",
  "Index of work": "Índice de trabalhos",
  "Campaigns, key visuals and content systems directed for brands in Mozambique and beyond.": "Campanhas, key visuals e sistemas de conteúdo dirigidos para marcas em Moçambique e além.",
  "Services": "Serviços",
  "Visual capabilities": "Capacidades visuais",
  "& disciplines.": "e disciplinas.",
  "Process": "Processo",
  "The working method proposed for each engagement — four phases, scaled to the project.": "O método de trabalho proposto para cada colaboração - quatro fases, adaptadas ao projecto.",
  "From brief": "Do briefing",
  "to rollout.": "à implementação.",
  "Selected collaborations": "Colaborações seleccionadas",
  "Contact": "Contacto",
  "Let's talk.": "Vamos conversar.",
  "Next move": "Próximo passo",
  "Social": "Redes sociais",
  "Years": "Anos",
  "Projects": "Projectos",
  "Brands": "Marcas",
  "Continents": "Continentes",
  "Capability": "Capacidade",
  "Selected achievements": "Conquistas seleccionadas",
  "Work with a point of view.": "Trabalho com um ponto de vista.",
  "The tools serve the idea.": "As ferramentas servem a ideia.",
  "Tools & proficiency": "Ferramentas e domínio",
  "The person behind the practice": "A pessoa por trás da prática",
  "Professional timeline.": "Percurso profissional.",
  "Experience / 2020 - 2026": "Experiência / 2020 - 2026",
  "Based in Maputo. Working worldwide.": "Baseado em Maputo. A trabalhar para todo o mundo.",
  "Start a conversation": "Iniciar uma conversa",
  "View CV (PDF)": "Ver CV (PDF)",
  "Career": "Carreira",
  "Visual Identity": "Identidade visual",
  "Art Direction": "Direcção de arte",
  "Editorial & Print": "Editorial e impressão",
  "Digital Design": "Design digital",
  "AI Creative Direction": "Direcção criativa com IA",
  "Discovery & Immersion": "Descoberta e imersão",
  "Strategic Direction": "Direcção estratégica",
  "Design & Craft": "Design e execução",
  "Production & Rollout": "Produção e implementação",
  "Strategic brand marks, typography systems & identity architecture.": "Marcas estratégicas, sistemas tipográficos e arquitectura de identidade.",
  "Campaign conception, visual storytelling & photography direction.": "Concepção de campanhas, narrativa visual e direcção de fotografia.",
  "Tactile publications, large-format OOH & packaging design.": "Publicações tácteis, OOH de grande formato e design de embalagem.",
  "Social-first content engines, motion assets & digital systems.": "Sistemas de conteúdo social-first, motion e sistemas digitais.",
  "Generative pipelines directed with an art director's eye.": "Fluxos generativos dirigidos com o olhar de um director de arte.",
  "Brand Architecture & Strategy": "Arquitectura e estratégia de marca",
  "Logo Marks & Symbol Systems": "Logótipos e sistemas de símbolos",
  "Custom Typographic Scales": "Escalas tipográficas personalizadas",
  "Comprehensive Identity Guidelines": "Guias completos de identidade",
  "Campaign Visual Concepts": "Conceitos visuais de campanha",
  "Photography & Video Treatments": "Direcção de fotografia e vídeo",
  "Master Key Visuals (KV)": "Key visuals principais (KV)",
  "Multi-Channel Rollout Systems": "Sistemas de implementação multicanal",
  "Editorial Books & Publications": "Livros e publicações editoriais",
  "Large-Format OOH & Billboards": "OOH e outdoors de grande formato",
  "Packaging & Structural Design": "Design de embalagem e estrutura",
  "Print Production & Finish Specs": "Produção gráfica e especificações de acabamento",
  "Social-First Content Systems": "Sistemas de conteúdo social-first",
  "Dynamic Motion Language": "Linguagem de motion dinâmica",
  "Digital Design Systems": "Sistemas de design digital",
  "Interactive Web Experiences": "Experiências web interactivas",
  "AI Concept Exploration": "Exploração de conceitos com IA",
  "Generative Key Art": "Key art generativo",
  "Image Manipulation & Retouch": "Manipulação e retoque de imagem",
  "Scaled Content Production": "Produção de conteúdo em escala",
  "Directing visual communication & strategy": "Direcção de comunicação visual e estratégia",
  "Delivered across branding, digital & print": "Entregues em branding, digital e impressão",
  "National & international collaborations": "Colaborações nacionais e internacionais",
  "Global creative exposure & delivery": "Experiência e execução criativa global",
  "Art direction, branding, strategy, AI & marketing": "Direcção de arte, branding, estratégia, IA e marketing",
  "Analysing strategic goals, competitive context and visual positioning.": "Análise de objectivos estratégicos, contexto competitivo e posicionamento visual.",
  "Defining the core visual idea, moodboards and narrative entry points.": "Definição da ideia visual central, moodboards e pontos de entrada narrativos.",
  "Iterative execution of typography, symbols, layouts and photographic treatments.": "Execução iterativa de tipografia, símbolos, layouts e tratamentos fotográficos.",
  "Scalable guideline systems, motion assets, print finishes and digital kits.": "Sistemas de guidelines escaláveis, motion, acabamentos gráficos e kits digitais.",
  "Every element must earn its place. Noise is the enemy of memory.": "Cada elemento tem de merecer o seu lugar. O ruído é inimigo da memória.",
  "Pacing dictates attention. Contrast creates engagement.": "O ritmo orienta a atenção. O contraste cria envolvimento.",
  "Execution defines positioning. God is in the details.": "A execução define o posicionamento. Deus está nos detalhes.",
  "Aesthetic survival requires a distinct point of view.": "A sobrevivência estética exige um ponto de vista distinto.",
  "Let's build a visual presence impossible to ignore.": "Vamos construir uma presença visual impossível de ignorar.",
  "Design is how it works.": "Design é a forma como funciona.",
};
type I18nValue = { language: SiteLanguage; setLanguage: (language: SiteLanguage) => void; t: (key: TranslationKey) => string; tx: (value: string) => string };
const I18nContext = createContext<I18nValue | null>(null);

function readLanguage(): SiteLanguage {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem("ek-language") === "pt-PT" ? "pt-PT" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // Keep the first render identical to SSR. Restore the saved preference only
  // after hydration so a saved PT preference cannot create a React mismatch.
  const [language, setLanguageState] = useState<SiteLanguage>("en");
  const setLanguage = (next: SiteLanguage) => {
    setLanguageState(next);
    window.localStorage.setItem("ek-language", next);
    document.documentElement.lang = next;
  };
  useEffect(() => {
    const savedLanguage = readLanguage();
    if (savedLanguage !== language) setLanguageState(savedLanguage);
  }, []);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const value = useMemo<I18nValue>(() => ({ language, setLanguage, t: (key) => copy[language][key] ?? copy.en[key], tx: (value) => language === "pt-PT" ? contentTranslations[value] ?? contentTranslations[value.trim()] ?? value : value }), [language]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();
  return (
    <div aria-label={t("language")} className="flex items-center gap-1 rounded-full border border-current/20 px-1 py-1 font-mono text-[9px] uppercase tracking-[0.16em]">
      <button type="button" onClick={() => setLanguage("en")} aria-pressed={language === "en"} className={`rounded-full px-2 py-1 transition ${language === "en" ? "bg-bone text-background" : "opacity-65 hover:opacity-100"}`}>EN</button>
      <button type="button" onClick={() => setLanguage("pt-PT")} aria-pressed={language === "pt-PT"} className={`rounded-full px-2 py-1 transition ${language === "pt-PT" ? "bg-bone text-background" : "opacity-65 hover:opacity-100"}`}>PT</button>
    </div>
  );
}
