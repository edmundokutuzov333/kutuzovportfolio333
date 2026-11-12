import { describe, expect, it } from "vitest";
import golden from "../../knowledge/evals/golden.json";
import { answerContactQuestion, validateContacts, type Fact } from "@/lib/jarvis/facts";
const base = (key:string,value:string): Fact => ({
  key, value, locale:"all", source:"unit-test", spoken:null,
  priority:1,status:"verified",visibility:"public",
});
const facts: Fact[] = [
 base("contact.email","contact@edmundokutuzov.art"),
 base("contact.phone","+258 87 601 312 1"),
 base("contact.whatsapp","https://wa.me/258876013121"),
 base("contact.site","https://www.edmundokutuzov.art"),
 { ...base("social.facebook.candidate.site","https://www.facebook.com/edmundoku/"),status:"pending_review" },
];
describe("Golden set factual verification",()=>{
  it("has at least 120 PT/EN cases",()=>{
    expect(golden.length).toBeGreaterThanOrEqual(120);
    expect(golden.some(c=>c.locale==="pt")).toBe(true);
    expect(golden.some(c=>c.locale==="en")).toBe(true);
  });
  for(const c of golden.filter(c=>c.expected_tier==="contact")){
    it("canonical contact: "+c.id,()=>{
      const reply=answerContactQuestion(c.query,facts,c.locale as "pt"|"en");
      expect(reply).toBeTruthy();
      const safe=validateContacts(reply||"",facts,c.locale as "pt"|"en");
      for(const include of c.must_include)expect(safe.text).toContain(include);
      for(const forbidden of c.must_not_include)expect(safe.text).not.toMatch(new RegExp(forbidden,"i"));
    });
  }
  for(const c of golden.filter(c=>c.expected_tier!=="contact")){
    it("rejects spoofed contact in "+c.id,()=>{
      const mock="Contacto: ficticio@example.com; veja https://example.org";
      const safe=validateContacts(mock,facts,c.locale as "pt"|"en");
      expect(safe.flagged).toBe(true);
      expect(safe.text).toContain("contact@edmundokutuzov.art");
      expect(safe.text).not.toContain("example.org");
    });
  }
});
