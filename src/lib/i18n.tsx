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
  },
} as const;

type TranslationKey = keyof typeof copy.en;
type I18nValue = { language: SiteLanguage; setLanguage: (language: SiteLanguage) => void; t: (key: TranslationKey) => string };
const I18nContext = createContext<I18nValue | null>(null);

function readLanguage(): SiteLanguage {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem("ek-language") === "pt-PT" ? "pt-PT" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SiteLanguage>(readLanguage);
  const setLanguage = (next: SiteLanguage) => {
    setLanguageState(next);
    window.localStorage.setItem("ek-language", next);
    document.documentElement.lang = next;
  };
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const value = useMemo<I18nValue>(() => ({ language, setLanguage, t: (key) => copy[language][key] ?? copy.en[key] }), [language]);
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
