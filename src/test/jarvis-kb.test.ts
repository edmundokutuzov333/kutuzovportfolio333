import { describe, expect, it } from "vitest";
import { answerContactQuestion, buildFactsBlock, getContact, redactQuery,
 validateContacts, type Fact } from "@/lib/jarvis/facts";
const seed: Fact[] = [
  { key:"contact.email",value:"contact@edmundokutuzov.art",spoken:"contact arroba edmundokutuzov ponto art",locale:"all",priority:1,status:"verified",visibility:"public",source:"db" },
  { key:"contact.phone",value:"+258 87 601 312 1",spoken:null,locale:"all",priority:2,status:"verified",visibility:"public",source:"db" },
  { key:"contact.whatsapp",value:"https://wa.me/258876013121",spoken:null,locale:"all",priority:3,status:"verified",visibility:"public",source:"db" },
  { key:"contact.site",value:"https://www.edmundokutuzov.art",spoken:null,locale:"all",priority:4,status:"verified",visibility:"public",source:"db" },
  { key:"social.facebook.candidate.site",value:"https://www.facebook.com/edmundoku/",spoken:null,locale:"all",priority:100,status:"pending_review",visibility:"public",source:"db" },
  { key:"identity.name",value:"Edmundo Kutuzov",spoken:null,locale:"all",priority:5,status:"verified",visibility:"public",source:"db" },
];
describe("JARVIS facts and contact security", () => {
  it("builds instructions from approved facts only", () => {
    const block=buildFactsBlock(seed);
    expect(block).toContain("contact@edmundokutuzov.art");
    expect(block).not.toContain("facebook.com");
  });
  it("never publishes conflicting Facebook handles", () => {
    expect(getContact(seed).facebook).toBe(null);
    expect(answerContactQuestion("Qual o Facebook?",seed,"pt")).toContain("não está confirmado");
  });
  it("responds to email requests without Gemini", () => {
    expect(answerContactQuestion("Qual é o email do Edmundo?",seed,"pt")).toContain("contact@edmundokutuzov.art");
    expect(answerContactQuestion("What is your email?",seed,"en")).toContain("contact@edmundokutuzov.art");
  });
  it("replaces invented email and invalid URL", () => {
    const result=validateContacts("Escreva para example.mz@gmail.com e abra https://example.com",seed,"pt");
    expect(result.flagged).toBe(true);
    expect(result.text).not.toContain("gmail.com");
    expect(result.text).not.toContain("example.com");
    expect(result.text).toContain("contact@edmundokutuzov.art");
  });
  it("keeps legitimate work links and WhatsApp URL", () => {
    const message="Veja https://www.edmundokutuzov.art/work/diga-yes e https://wa.me/258876013121";
    expect(validateContacts(message,seed).text).toBe(message);
  });
  it("redacts private data before observability writes", () => {
    expect(redactQuery("ola email a@b.com https://example.com")).not.toContain("a@b.com");
  });
});
