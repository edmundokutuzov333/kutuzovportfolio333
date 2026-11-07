import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Hero, ProjectGrid, ClientsGrid, Services, Testimonials, Awards, Feed } from "../components/Sections";
import { SafeImage } from "../components/Primitives";
import { AuditCard } from "../components/AuditCard";
import { copy } from "../lib/content";
import { emptyBrief } from "../../../../src/lib/brief";
import { submitContactForm } from "../../../../src/lib/public-forms";
export function Home({ data }) {
  return <><Hero profile={data.profile}/><ProjectGrid projects={data.projects} limit={8}/>
    <ClientsGrid clients={data.clients}/><AuditCard/><Feed/><Services services={data.services}/><Testimonials/><Awards/></>;
}
export function About({ data }) {
  return <><section className="section page-intro"><p className="eyebrow">Sobre</p><h1>{data.profile.name}</h1>
    <p className="lead">{data.profile.intro}</p><SafeImage source={data.profile.portraitPath} alt={data.profile.name}/>
    {data.profile.biography && <p>{data.profile.biography}</p>}</section>
    <section className="section"><h2>Princípios</h2>{data.principles.map(item=><details key={item.title}><summary>{item.title}</summary><p>{item.text}</p></details>)}</section></>;
}
export function Project({ project }) {
  if (!project) return <Missing/>;
  return <article><header className="section page-intro"><p className="eyebrow">{project.client} · {project.year}</p><h1>{project.title}</h1><p className="lead">{project.summary}</p></header>
    <SafeImage source={project.cover} alt={project.coverAlt} className="project-hero" priority/>
    <section className="section case-copy">{[["Desafio",project.challenge],["Ideia",project.idea],["Resultado",project.outcome]].filter(([,text])=>text).map(([title,text])=>
      <div key={title}><h2>{title}</h2><p>{text}</p></div>)}</section>
    <div className="section project-gallery">{project.gallery.map((source,index)=><SafeImage key={source+index} source={source} alt={project.galleryAlt[index] || project.title}/>)}</div>
    <div className="section"><Link to="/work">Voltar ao trabalho ↗</Link></div></article>;
}
export function Article({ slug }) {
  const item = copy.articles.find(article=>article.slug===slug);
  if(!item)return <Missing/>;
  return <article className="section page-intro article"><p className="eyebrow">{item.category} · conteúdo de exemplo</p><h1>{item.title}</h1><p className="lead">{item.text}</p><Link to="/content-hub">Voltar aos conteúdos</Link></article>;
}
export function Missing() { return <section className="section page-intro"><h1>Página não encontrada.</h1><Link to="/">Voltar ao início</Link></section>; }
export function Contact({ data }) {
  const [step,setStep] = useState(0);
  const [draft,setDraft] = useState({ ...emptyBrief, additionalTypes:[], channels:[], deliverables:[], files:[] });
  const [status,setStatus] = useState("idle");
  const [error,setError] = useState("");
  const [receipt,setReceipt] = useState(null);
  const [sendReal,setSendReal] = useState(false);
  const update = (key,value)=>setDraft(previous=>({...previous,[key]:value}));
  async function next(event) {
    event.preventDefault();setError("");
    if(step<3){setStep(step+1);return;}
    if(draft.message.trim().length<10){setError("Descreva o projeto com pelo menos 10 caracteres.");return;}
    if(!sendReal){setStatus("demo");return;}
    if(status==="sending")return;
    setStatus("sending");
    const payload = new FormData();
    Object.entries(draft).forEach(([key,value])=>{
      if(key==="files")return;
      payload.set(key,Array.isArray(value)?JSON.stringify(value):String(value));
    });
    try{
      const result = await submitContactForm(payload);
      if(!result.ok || !result.submissionId)throw new Error("Não foi possível confirmar a gravação.");
      setReceipt(result);setStatus("success");
    }catch(failure){setError(failure.message);setStatus("error");}
  }
  if(status==="success")return <section className="section page-intro" role="status"><h1>Pedido guardado.</h1><p>Referência: {receipt.submissionId}</p>
    <p>Estado da notificação: {receipt.notification || "por confirmar"}. Estado da cópia: {receipt.receipt || "por confirmar"}.</p></section>;
  if(status==="demo")return <section className="section page-intro" role="status"><h1>Demonstração concluída.</h1><p>Não foi enviado qualquer pedido.</p><button className="pill" onClick={()=>setStatus("idle")}>Voltar ao formulário</button></section>;
  return <section className="section page-intro contact"><p className="eyebrow">Novo projeto · etapa {step+1}/4</p><h1>Vamos conversar.</h1>
    <form onSubmit={next}>
      {step===0 && <><label>Nome<input value={draft.name} onChange={e=>update("name",e.target.value)} required maxLength={180} autoComplete="name"/></label>
        <label>Email<input type="email" value={draft.email} onChange={e=>update("email",e.target.value)} required autoComplete="email"/></label></>}
      {step===1 && <><label>Empresa<input value={draft.company} onChange={e=>update("company",e.target.value)} maxLength={240}/></label>
        <label>Serviço<select value={draft.type} onChange={e=>update("type",e.target.value)} required><option value="">Escolher</option>{data.projectTypes.map(type=><option key={type}>{type}</option>)}</select></label></>}
      {step===2 && <><label>Orçamento<select value={draft.budget} onChange={e=>update("budget",e.target.value)}>{[...new Set([draft.budget,...Object.values(data.budgets).flat()])].map(value=><option key={value}>{value}</option>)}</select></label>
        <label>Data prevista<input type="date" value={draft.deadline} onChange={e=>update("deadline",e.target.value)}/></label></>}
      {step===3 && <><label>Descrição<textarea value={draft.message} onChange={e=>update("message",e.target.value)} required minLength={10} maxLength={4000}/></label>
        <label className="check-label"><input type="checkbox" checked={sendReal} onChange={e=>setSendReal(e.target.checked)}/>Enviar este pedido para o Supabase do portefólio. Sem esta opção, apenas simular.</label></>}
      {error && <p role="alert">{error}</p>}
      <div className="actions">{step>0 && <button type="button" className="pill" disabled={status==="sending"} onClick={()=>setStep(step-1)}>Anterior</button>}
        <button className="pill primary" disabled={status==="sending"}>{status==="sending"?"A enviar…":step===3?(sendReal?"Enviar pedido":"Concluir simulação"):"Continuar"}</button></div>
    </form></section>;
}
