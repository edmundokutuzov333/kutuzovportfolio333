import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cvContactEmail, cvPdfForLanguage, getCvContent } from "@/lib/cv-content";
import { useI18n, type SiteLanguage } from "@/lib/i18n";
import { normaliseCvPhone, originalCv } from "@/lib/cv-original";
import { profilePortrait } from "@/lib/profile-portrait";
import "./cv.css";
import "./cv-print.css";

export const Route = createFileRoute("/cv")({
  head: () => ({
    meta: [
      { title: "Edmundo Kutuzov — CV" },
      { name: "description", content: "Edmundo Kutuzov — Visual Communication Designer & Art Director." },
    ],
  }),
  component: CurriculumPage,
});

function CvHeading({ id, children }: { id: string; children: string }) {
  return (
    <div className="cv-section-heading">
      <h2 id={id} className="cv-section-heading__title">{children}</h2>
      <span className="cv-section-heading__rule" aria-hidden="true" />
    </div>
  );
}

function CvUtilityBar({
  className = "",
  lang,
  strings,
}: {
  className?: string;
  lang: SiteLanguage;
  strings: ReturnType<typeof getCvContent>;
}) {
  return (
    <div className={`cv-actions ${className}`} data-cv-controls>
      <Link
        to="/about"
        className="cv-actions__button"
        aria-label={strings.back}
        title={strings.back}
      >
        <ArrowLeft size={18} strokeWidth={1.6} aria-hidden="true" />
      </Link>
      <a
        href={cvPdfForLanguage(lang)}
        download={`Edmundo-Kutuzov-CV-${lang === "en" ? "EN" : "PT"}.pdf`}
        className="cv-actions__button"
        aria-label={strings.download}
        title={strings.download}
        data-testid="cv-download"
        data-cv-controls
      >
        <Download size={18} strokeWidth={1.6} aria-hidden="true" />
      </a>
      <button
        type="button"
        className="cv-actions__button"
        aria-label={strings.print}
        title={strings.print}
        onClick={() => window.print()}
        data-testid="cv-print"
      >
        <Printer size={18} strokeWidth={1.6} aria-hidden="true" />
      </button>
    </div>
  );
}

function CvLanguageControl({
  lang,
  onChange,
  label,
}: {
  lang: SiteLanguage;
  onChange: (lang: SiteLanguage) => void;
  label: string;
}) {
  return (
    <div className="cv-language-control" role="group" aria-label={label} data-cv-controls>
      <button
        type="button"
        aria-label="CV in English"
        aria-pressed={lang === "en"}
        data-testid="cv-language-en"
        onClick={() => onChange("en")}
      >EN</button>
      <button
        type="button"
        aria-label="CV em português"
        aria-pressed={lang === "pt-PT"}
        data-testid="cv-language-pt"
        onClick={() => onChange("pt-PT")}
      >PT</button>
    </div>
  );
}

/**
 * CV has a standalone language control. By default it follows the site;
 * a visitor's explicit CV override is stored only for CV (never changes the site).
 * ?cvLang=en / ?cvLang=pt-PT provide deterministic print/PDF snapshots.
 */
export function CurriculumPage() {
  const nameRef=useRef<HTMLHeadingElement>(null);
  const { language: siteLanguage } = useI18n();
  const [override,setOverride] = useState<SiteLanguage | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("cvLang");
    const saved = q || window.sessionStorage.getItem("ek-cv-language");
    if(saved === "en" || saved === "pt-PT")setOverride(saved);
  }, []);
  const changeLanguage = (next:SiteLanguage) => {
    setOverride(next);
    window.sessionStorage.setItem("ek-cv-language",next);
  };
  const lang = override ?? siteLanguage;
  const content = getCvContent(lang);

  useEffect(()=>{
    const name=nameRef.current;
    if(!name)return;
    let frame=0;
    let disposed=false;
    const fit=()=>{
      if(disposed || !name.isConnected)return;
      // Start with the CSS-responsive scale, then enforce true text width.
      name.style.fontSize="";
      const size=parseFloat(getComputedStyle(name).fontSize);
      const available=name.clientWidth;
      const lines=[...name.querySelectorAll<HTMLElement>(".cv-cover__name-line")];
      const needed=Math.max(...lines.map(el=>el.scrollWidth));
      if(available>0 && needed>available+1){
        name.style.fontSize=`${Math.max(24,Math.floor(size*available/(needed+3)*.965))}px`;
      }
    };
    const queue=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(fit);};
    const observer=new ResizeObserver(queue);
    observer.observe(name.parentElement || name);
    document.fonts.ready.then(queue).catch(()=>{});
    queue();
    return ()=>{disposed=true;observer.disconnect();cancelAnimationFrame(frame);};
  },[]);

  return (
    <main className="cv-experience" data-testid="cv-page" data-cv-language={lang}>
      <div className="cv-container">
        <section className="cv-cover" aria-labelledby="cv-name">
          <div className="cv-cover__content">
            <div className="cv-cover__upper">
              <span className="cv-cover__mark" aria-hidden="true" />
              <div className="cv-cover__tools">
                <CvLanguageControl lang={lang} onChange={changeLanguage} label={content.switcher}/>
                <CvUtilityBar lang={lang} strings={content}/>
              </div>
            </div>
            <h1 ref={nameRef} id="cv-name" className="cv-cover__name">
              {originalCv.name.map((line,index) => (
                <span className="cv-cover__name-line" key={line} style={{animationDelay:`${index*.09}s`}}>
                  {line}
                </span>
              ))}
            </h1>
            <div className="cv-cover__role">
              {content.role.map(line => <span key={line}>{line}</span>)}
            </div>
            <div className="cv-cover__baseline" aria-hidden="true"><span /></div>
          </div>
          <div className="cv-cover__portrait-frame">
            <img
              src={profilePortrait}
              alt="Edmundo Kutuzov"
              className="cv-cover__portrait"
              loading="eager"
              decoding="async"
              fetchPriority="high"
              width={4096}
              height={4096}
              data-testid="cv-portrait"
            />
            <span className="cv-cover__portrait-stroke" aria-hidden="true"/>
          </div>
        </section>

        <div className="cv-document">
          <aside className="cv-document__rail" aria-label={content.nav}>
            <nav className="cv-navigation" aria-label={content.nav}>
              {content.sections.map(item => (
                <a className="cv-navigation__item" key={item.id} href={`#${item.id}`}>{item.heading}</a>
              ))}
            </nav>
            <CvUtilityBar className="cv-actions--rail" lang={lang} strings={content}/>
          </aside>

          <article className="cv-document__body">
            <section className="cv-section cv-section--about" aria-labelledby="sobre">
              <CvHeading id="sobre">{content.about}</CvHeading>
              <div className="cv-about__body">
                {content.summary.map(paragraph=><p className="cv-about__copy" key={paragraph}>{paragraph}</p>)}
                <div className="cv-brands">
                  <p className="cv-brands__label">{content.collaborations}</p>
                  <p className="cv-brands__list">{content.brands.join(" · ")}</p>
                </div>
              </div>
            </section>

            <section className="cv-section cv-section--experience" aria-labelledby="experiencia">
              <CvHeading id="experiencia">{content.experience}</CvHeading>
              <ol className="cv-experience-list">
                {content.experiences.map(item => (
                  <li key={item.company} className="cv-experience-list__item">
                    <p className="cv-experience-list__period">{item.period}</p>
                    <div>
                      <h3 className="cv-experience-list__company">{item.company}</h3>
                      <p className="cv-experience-list__role">{item.role}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <div className="cv-document__duo">
              <section className="cv-section cv-section--education" aria-labelledby="educacao">
                <CvHeading id="educacao">{content.education}</CvHeading>
                <h3 className="cv-education__name">{originalCv.education.school}</h3>
                <p className="cv-education__level">{content.grade}</p>
                <p className="cv-education__year">{originalCv.education.year}</p>
              </section>

              <section className="cv-section cv-section--skills" aria-labelledby="skills">
                <CvHeading id="skills">{content.skills}</CvHeading>
                <ul className="cv-skills">
                  {originalCv.skills.items.map(skill => (
                    <li key={skill.name} className="cv-skills__item">
                      <div className="cv-skills__header">
                        <span className="cv-skills__name">{skill.name}</span>
                        <span className="cv-skills__percentage">{skill.value}%</span>
                      </div>
                      <div
                        className="cv-skills__track"
                        role="meter"
                        aria-label={skill.name}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={skill.value}
                      >
                        <span className="cv-skills__fill" style={{width:`${skill.value}%`}}/>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <div className="cv-document__duo cv-document__duo--end">
              <section className="cv-section cv-section--contact" aria-labelledby="contacto">
                <CvHeading id="contacto">{content.contact}</CvHeading>
                <dl className="cv-contact">
                  <div>
                    <dt>{content.phone}</dt>
                    <dd><a href={normaliseCvPhone(originalCv.contact.phone)}>{originalCv.contact.phone}</a></dd>
                  </div>
                  <div>
                    <dt>{content.email}</dt>
                    <dd><a href={`mailto:${cvContactEmail}`}>{cvContactEmail}</a></dd>
                  </div>
                  <div>
                    <dt>{content.address}</dt>
                    <dd>{content.localeAddress.map(line=><span key={line}>{line}</span>)}</dd>
                  </div>
                </dl>
              </section>

              <section className="cv-section cv-section--reference" aria-labelledby="referencia">
                <CvHeading id="referencia">{content.reference}</CvHeading>
                <h3 className="cv-reference__name">{originalCv.reference.name}</h3>
                <p className="cv-reference__role">{content.referenceRole}</p>
                <p className="cv-reference__phone">
                  <a href={normaliseCvPhone(originalCv.reference.phone)}>{content.referencePhone}</a>
                </p>
              </section>
            </div>
          </article>
        </div>
      </div>
    </main>
  );
}
