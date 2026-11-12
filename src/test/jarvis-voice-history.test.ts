import {describe,it,expect} from "vitest";
import { choosePortugueseMaleVoice,describeVoiceFallback,JARVIS_LIVE_VOICE } from "@/lib/jarvis/voice-selection";
import { buildJarvisHistory } from "@/lib/jarvis/history";
describe("JARVIS speech gender and regional safeguards",()=>{
  it("prefers verified-name masculine Portuguese-Mozambique voice",()=>{
    const voices=[
      {name:"Luciana",lang:"pt-BR"}, {name:"Joana",lang:"pt-PT"},
      {name:"Microsoft Duarte",lang:"pt-PT"}, {name:"Manuel",lang:"pt-MZ"}];
    expect(choosePortugueseMaleVoice(voices)?.name).toBe("Manuel");
    expect(JARVIS_LIVE_VOICE).toBe("Orus");
  });
  it("never sends speech through Brazilian or unknown-gender fallbacks",()=>{
    expect(choosePortugueseMaleVoice([{name:"Google português",lang:"pt-BR"}])).toBeNull();
    expect(choosePortugueseMaleVoice([{name:"Joana",lang:"pt-PT"}])).toBeNull();
    expect(describeVoiceFallback([{name:"Luciana",lang:"pt-BR"}])).toContain("não disponibiliza");
  });
});
describe("JARVIS long conversation continuity",()=>{
  it("keeps compact historical topics and newest turn after 60 turns",()=>{
    const messages=Array.from({length:60},(_,i)=>({
      role:(i%2?"assistant":"user") as "user"|"assistant",
      content:i===0?"Conversa sobre campanha Toyota":i===58?"Agora sobre GIZ":"Mensagem "+i,
    }));
    const payload=buildJarvisHistory(messages);
    expect(payload.length).toBeLessThanOrEqual(20);
    expect(payload[0]?.content).toContain("Toyota");
    expect(payload.at(-2)?.content).toBe("Agora sobre GIZ");
    expect(payload.every(x=>x.content.length<=2000)).toBe(true);
  });
  it("leaves short conversations semantically unchanged",()=>{
    expect(buildJarvisHistory([{role:"user",content:"Olá"}])).toEqual([{role:"user",content:"Olá"}]);
  });
});

describe("JARVIS large-conversation transport contract",()=>{
  it("fits 320 maximum-sized turns into the streaming request limit",()=>{
    const messages=Array.from({length:320},(_,i)=>({
      role:(i%2===0?"user":"assistant") as "user"|"assistant",
      content:(i===0?"Trabalho original Toyota: ":"")+"x".repeat(1850),
    }));
    const packed=buildJarvisHistory(messages);
    expect(packed.length).toBeLessThanOrEqual(16);
    expect(packed[0]?.content).toContain("Trabalho original Toyota");
    expect(JSON.stringify({messages:packed}).length).toBeLessThan(26_000);
    expect(packed.at(-1)?.content.length).toBeLessThanOrEqual(1900);
  });
});
