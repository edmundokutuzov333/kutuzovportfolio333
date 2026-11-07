import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import Lenis from "lenis";
import { copy } from "../lib/content";
import { OriginalMark } from "./Primitives";
export function Shell({ data }) {
  const dialog = useRef(null);
  const trigger = useRef(null);
  const [open, setOpen] = useState(false);
  const location = useRouterState({ select: state => state.location.pathname });
  useEffect(() => {
    const element = dialog.current;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
    const previous = document.body.style.overflow;
    if (open) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [location]);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches) return;
    const lenis = new Lenis({ autoRaf: true, anchors: true });
    return () => lenis.destroy();
  }, []);
  function close() { setOpen(false); trigger.current?.focus(); }
  const brand = data.profile.name || copy.brand;
  return <>
    <a className="skip" href="#main-content">{copy.skip}</a>
    <header className="site-header">
      <Link to="/" className="brand" aria-label={brand+" — início"}><OriginalMark/><span>{brand}</span></Link>
      <button className="menu-button" ref={trigger} aria-expanded={open} aria-controls="global-menu" onClick={()=>setOpen(true)}>
        <span>{copy.menu}</span><span aria-hidden>⠿</span>
      </button>
    </header>
    <dialog id="global-menu" className="menu-dialog" ref={dialog} aria-label="Navegação principal"
      onCancel={close} onClose={()=>setOpen(false)} onClick={event=>{if(event.target===event.currentTarget)close();}}>
      <button className="pill menu-close" onClick={close}>{copy.close} ×</button>
      <nav>{copy.nav.map(item=><Link key={item.path} to={item.path} onClick={close}>{item.label}<span aria-hidden>↗</span></Link>)}</nav>
      <OriginalMark className="menu-art"/>
    </dialog>
    <main id="main-content" tabIndex={-1}><Outlet/></main>
    <Footer profile={data.profile}/>
  </>;
}
function WorldClocks() {
  const [now, setNow] = useState(null);
  useEffect(()=>{setNow(new Date());const id=setInterval(()=>setNow(new Date()),60000);return()=>clearInterval(id);},[]);
  return <div className="clocks">{[["Maputo","Africa/Maputo"],["Lisboa","Europe/Lisbon"],["Londres","Europe/London"]].map(([name,zone])=>
    <span key={zone}>{name} <time>{now ? new Intl.DateTimeFormat("pt-PT",{timeZone:zone,hour:"2-digit",minute:"2-digit"}).format(now) : "—"}</time></span>)}</div>;
}
export function Footer({ profile }) {
  return <footer className="site-footer">
    <nav aria-label="Navegação do rodapé">{copy.nav.slice(1).map(item=><Link key={item.path} to={item.path}>{item.label}</Link>)}</nav>
    <Link className="footer-cta" to="/contact">{copy.contact}<span aria-hidden>↗</span></Link>
    <a href={"mailto:"+profile.email}>{profile.email}</a>
    <div className="footer-bottom"><WorldClocks/><p>{copy.disclaimer}</p></div>
  </footer>;
}
