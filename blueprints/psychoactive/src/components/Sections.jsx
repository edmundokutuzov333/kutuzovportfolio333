import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { copy } from "../lib/content";
import { OriginalMark, SafeImage, Reveal, BadgePlaceholder } from "./Primitives";
export function Hero({ profile }) {
  const section = useRef(null);
  const reel = useRef(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end start"] });
  const scale = useTransform(scrollYProgress, [0,1], [1,.8]);
  const opacity = useTransform(scrollYProgress, [0,.9], [1,0]);
  return <section className="hero" ref={section}>
    <motion.div className="hero-art" style={reduced ? {} : { scale, opacity }}><OriginalMark/></motion.div>
    <div className="hero-copy"><p className="eyebrow">{profile.roles.join(" · ")}</p><h1>{profile.name}</h1><p>{profile.headline}</p>
      <div className="actions"><Link className="pill primary" to="/contact">Iniciar um projeto ↗</Link>
        <button className="pill" onClick={()=>reel.current.showModal()}>Ver demonstração ▷</button></div></div>
    <p className="hero-location eyebrow">{profile.location}</p>
    <dialog ref={reel} className="reel-dialog" aria-label="Demonstração gráfica original">
      <button className="pill" onClick={()=>reel.current.close()}>Fechar ×</button><OriginalMark className="demo-reel"/>
      <p>Elemento gráfico original. O showreel do estúdio de referência não foi copiado.</p>
    </dialog>
  </section>;
}
export function ProjectGrid({ projects, limit }) {
  const shown = typeof limit === "number" ? projects.slice(0,limit) : projects;
  return <section className="section"><div className="section-heading"><h2>{copy.work}</h2><Link to="/work">Ver todos ↗</Link></div>
    <div className="project-grid">{shown.map((project,index)=><Reveal key={project.id} className={"project-card "+(index===0||index===5 ? "wide" : "")}>
      <Link to="/work/$slug" params={{slug:project.slug}} className="project-link">
        <div className="project-media"><SafeImage source={project.cover} alt={project.coverAlt} priority={index===0}/><span className="project-arrow" aria-hidden>↗</span></div>
        <div className="project-meta"><h3>{project.title}</h3><span>{project.year}</span></div>
        <p className="eyebrow muted">{[project.client,project.discipline].filter(Boolean).join(" · ")}</p>
      </Link></Reveal>)}</div>
    {!shown.length && <p>Nenhum projeto publicado.</p>}
  </section>;
}
export function ClientsGrid({ clients }) {
  return <section className="section"><div className="section-heading"><h2>{copy.clients}</h2><Link to="/clients">Todos os clientes ↗</Link></div>
    <ul className="clients-grid">{clients.map(client=><li key={client.slug}>{client.logo
      ? <SafeImage source={client.logo} alt={client.logoAlt || client.name}/>
      : <span>{client.name}</span>}</li>)}</ul></section>;
}
export function Services({ services }) {
  return <section className="section"><h2>{copy.services}</h2><div className="services-list">{services.map(service=>
    <details key={service.slug}><summary><span className="eyebrow">{service.n}</span><span>{service.title}</span><span aria-hidden>+</span></summary>
      <div className="service-details"><p>{service.text}</p><ul>{service.deliverables.map(item=><li key={item}>{item}</li>)}</ul></div>
    </details>)}</div></section>;
}
export function Testimonials({ items = copy.testimonials }) {
  return <section className="section"><h2>Experiências de colaboração</h2>{items.length
    ? <div className="testimonials">{items.map(item=><figure key={item.id}><blockquote>{item.quote}</blockquote><figcaption>{item.author} · {item.company}</figcaption></figure>)}</div>
    : <p className="muted">{copy.missingProof}</p>}</section>;
}
export function Awards({ items = copy.awards }) {
  const platforms = ["Destaques", ...new Set(items.map(item=>item.platform))];
  const [active,setActive] = useState("Destaques");
  const [page,setPage] = useState(0);
  const selected = active==="Destaques" ? items : items.filter(item=>item.platform===active);
  const pages = Math.max(1,Math.ceil(selected.length/6));
  return <section className="section awards"><div><p className="eyebrow">Reconhecimento verificado</p><h2>{items.length ? items.length+"+" : "—"}</h2>
    {!items.length && <BadgePlaceholder label="Prémio"/>}</div><div>
      <div className="tabs" role="tablist" aria-label="Prémios por plataforma">{platforms.map(name=><button key={name} role="tab"
        id={"tab-"+platforms.indexOf(name)} aria-controls="awards-panel" aria-selected={active===name} tabIndex={active===name ? 0 : -1}
        onKeyDown={event=>{if(["ArrowRight","ArrowLeft"].includes(event.key)){event.preventDefault();const offset=event.key==="ArrowRight"?1:-1;const next=(platforms.indexOf(active)+offset+platforms.length)%platforms.length;setActive(platforms[next]);setPage(0);document.getElementById("tab-"+next)?.focus();}}}
        onClick={()=>{setActive(name);setPage(0);}}>{name}</button>)}</div>
      <div role="tabpanel" id="awards-panel" aria-labelledby={"tab-"+platforms.indexOf(active)}>
        {selected.length ? <table><thead><tr><th>Plataforma</th><th>Prémio</th><th>Projeto</th><th>Ano</th></tr></thead>
          <tbody>{selected.slice(page*6,page*6+6).map(item=><tr key={item.id}><td>{item.platform}</td><td>{item.prize}</td><td>{item.project}</td><td>{item.year}</td></tr>)}</tbody></table>
          : <p className="muted">Sem registos verificados.</p>}
      </div>
      <div className="pager"><button disabled={page===0} onClick={()=>setPage(page-1)} aria-label="Prémios anteriores">←</button>
        <span>{String(page+1).padStart(2,"0")} / {String(pages).padStart(2,"0")}</span>
        <button disabled={page+1>=pages} onClick={()=>setPage(page+1)} aria-label="Próximos prémios">→</button></div>
    </div></section>;
}
export function Feed({ filters = false }) {
  const [category,setCategory] = useState("Todos");
  const items = copy.articles.filter(item=>category==="Todos" || item.category===category);
  return <section className="section"><div className="section-heading"><h2>{copy.feed}</h2><Link to="/content-hub">Ver conteúdos ↗</Link></div>
    {filters && <div className="tabs" aria-label="Filtrar conteúdos">{["Todos","Recursos","Novidades"].map(name=>
      <button key={name} aria-pressed={category===name} onClick={()=>setCategory(name)}>{name}</button>)}</div>}
    <div className="feed-grid">{items.map(item=><article key={item.slug}><Link to="/content-hub/$slug" params={{slug:item.slug}}>
      <div className="feed-art"><OriginalMark label="Ilustração geométrica original"/></div><p className="eyebrow">{item.category}</p><h3>{item.title}</h3>
    </Link></article>)}</div></section>;
}
