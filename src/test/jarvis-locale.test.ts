import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { jarvisCopy, jarvisServerCopy, siteToJarvisLocale } from "@/lib/jarvis/locale";
import { buildJarvisHistory } from "@/lib/jarvis/history";
import { jarvisPersona } from "@/lib/jarvis/persona";
import { spokenJarvisText } from "@/lib/jarvis/speech";
import { chooseEnglishMaleVoice, chooseJarvisMaleVoice, describeVoiceFallback, jarvisSpeechLocale } from "@/lib/jarvis/voice-selection";

describe("JARVIS follows the site's EN/PT selection", () => {
  it("maps the default EN and the saved Portuguese preference without language guessing", () => {
    expect(siteToJarvisLocale("en")).toBe("en");
    expect(siteToJarvisLocale("pt-PT")).toBe("pt");
    expect(jarvisCopy("en").welcomeTitle).toBe("Hi. I'm JARVIS.");
    expect(jarvisCopy("pt").welcomeTitle).toBe("Olá. Sou o JARVIS.");
    expect(jarvisCopy("en").assistantTitle).toBe("I'm right here.");
    expect(jarvisCopy("pt").assistantTitle).toBe("Estou por aqui.");
    expect(jarvisCopy("en").suggestions).toHaveLength(3);
    expect(jarvisCopy("pt").suggestions).toHaveLength(3);
  });

  it("translates chat, project gallery, briefing consent and server errors", () => {
    const en = jarvisCopy("en"), pt = jarvisCopy("pt");
    expect(en.projectsGallery).toBe("Project gallery");
    expect(pt.projectsGallery).toBe("Galeria de projectos");
    expect(en.leadConsent).toContain("I agree");
    expect(pt.leadConsent).toContain("Autorizo");
    expect(en.inputPlaceholder).toBe("Write a message…");
    expect(pt.inputPlaceholder).toBe("Escreva-me uma mensagem…");
    expect(jarvisServerCopy("en").quota).toMatch(/requests/);
    expect(jarvisServerCopy("pt").quota).toMatch(/pedidos/);
  });

  it("pins model language to the selected site setting even with mixed-language questions", () => {
    const en=jarvisPersona("en", "", "");
    const pt=jarvisPersona("pt", "", "");
    expect(en).toContain("Always respond in polished, natural English");
    expect(en).toContain("Never switch to Portuguese unless the site language");
    expect(pt).toContain("Responde sempre em português profissional");
    expect(pt).toContain("idioma do site");
  });

  it("localises long-conversation context without changing its safety envelope", () => {
    const messages=Array.from({length:24},(_,i)=>({role:"user" as const,content:"Question "+i}));
    const en=buildJarvisHistory(messages,"en");
    const pt=buildJarvisHistory(messages,"pt");
    expect(en[0]?.content).toMatch(/^EARLIER CONTEXT FROM THIS CONVERSATION/);
    expect(pt[0]?.content).toMatch(/^CONTEXTO ANTERIOR DA MESMA CONVERSA/);
    expect(en.length).toBeLessThanOrEqual(16);
    expect(pt.length).toBeLessThanOrEqual(16);
    expect(en.at(-1)?.content).toBe("Question 23");
  });

  it("chooses male English speech without altering Portuguese/Mozambique safeguards", () => {
    const voices=[
      {name:"Microsoft Duarte",lang:"pt-PT"},
      {name:"Manuel",lang:"pt-MZ"},
      {name:"Microsoft David",lang:"en-US"},
      {name:"Daniel",lang:"en-GB"},
      {name:"Samantha",lang:"en-GB"},
    ];
    expect(chooseEnglishMaleVoice(voices)?.name).toBe("Daniel");
    expect(chooseJarvisMaleVoice(voices,"en")?.name).toBe("Daniel");
    expect(chooseJarvisMaleVoice(voices,"pt")?.name).toBe("Manuel");
    expect(chooseEnglishMaleVoice([{name:"Samantha",lang:"en-GB"}])).toBeNull();
    expect(describeVoiceFallback([{name:"Samantha",lang:"en-GB"}],"en")).toContain("male English voice");
    expect(jarvisSpeechLocale("en")).toBe("en-GB");
    expect(jarvisSpeechLocale("pt")).toBe("pt-PT");
  });

  it("speaks contacts using the active language, without translating the displayed contact", () => {
    expect(spokenJarvisText("Contact me at hello@example.org","en")).toContain("hello at example dot org");
    expect(spokenJarvisText("Escreva para hello@example.org","pt")).toContain("hello arroba example ponto org");
    expect(spokenJarvisText("See https://example.org/work","en")).toContain("link available in the text chat");
  });

  it("uses explicit locale fields through both HTTP routes and voice transports", () => {
    const launcher=readFileSync("src/components/JarvisLauncher.tsx","utf8");
    const stream=readFileSync("src/routes/api.jarvis.stream.ts","utf8");
    const backend=readFileSync("src/lib/server/jarvis-stream.server.ts","utf8");
    const live=readFileSync("src/lib/jarvis/live-browser.ts","utf8");
    const tts=readFileSync("src/routes/api.jarvis.tts.ts","utf8");
    const token=readFileSync("src/routes/api.jarvis.live-token.ts","utf8");
    expect(launcher).toContain("siteToJarvisLocale(language)");
    expect(launcher).toContain("{ messages: modelHistory, locale });");
    expect(launcher).toContain('{ messages: modelHistory, locale, mode: "voice" }');
    expect(launcher).toContain('recognition.lang = locale === "en" ? "en-GB" : "pt-PT"');
    expect(stream).toContain("streamJarvis(data.messages,write,request.signal,data.locale,data.mode)");
    expect(backend).not.toContain("detectLocale(");
    expect(backend).toContain('locale:JarvisLocale="en"');
    expect(live).toContain("body:JSON.stringify({locale})");
    expect(tts).toContain("spokenJarvisText(safe.text,locale)");
    expect(token).toContain("jarvisPersona(locale,buildFactsBlock(facts,locale)");
  });
});
