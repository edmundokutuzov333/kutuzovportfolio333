import {useState} from "react";
import {X,ArrowUpRight,Maximize2,Minimize2,Layers3,Image,Shapes,
  Clapperboard,Sparkles,Orbit,ChevronLeft,ChevronRight} from "lucide-react";
import {FILTERS} from "@/reel/storyboard";
import {BASE_URL as BASE} from "@/reel/paths";
import {atlasTile} from "@/reel/archiveExperience";

const stop=e=>e.stopPropagation();
const pad=n=>String(n).padStart(3,"0");
const icons=[Orbit,Layers3,Image,Shapes,Sparkles,Clapperboard];

function Selected({it,onClose,onSelect,onNavigate,suggestions,transition,cols,rows}){
  const [expanded,setExpanded]=useState(false);
  return (
    <aside data-testid="explore-selected-panel"
      onPointerDown={stop} onPointerUp={stop} onPointerMove={stop}
      className={"archive-selected"+(expanded?" archive-selected--expanded":"")}>
      <button type="button" className="archive-expand"
        aria-label={expanded?"Reduzir visualização":"Ampliar obra"}
        title={expanded?"Reduzir visualização":"Ampliar obra"}
        onClick={()=>setExpanded(value=>!value)}>
        {expanded?<Minimize2 size={19}/>:<Maximize2 size={19}/>}
      </button>
      <button type="button" data-testid="explore-close-selected" onClick={onClose}
        title="Voltar à exploração" aria-label="Voltar à exploração" className="archive-close">
        <X size={19}/>
      </button>
      <div key={it.id} className={"archive-preview archive-preview--"+transition}>
        {it.video
          ?<video src={BASE+"/vid/"+it.id+".mp4"} autoPlay muted loop playsInline
              controls preload="metadata" className="archive-media"/>
          :<img loading="eager" decoding="async" src={BASE+"/img/"+pad(it.id)+".webp"}
              alt={it.title} className="archive-media"/>}
      </div>
      <div className="archive-related" aria-label="Outros trabalhos para descobrir">
        <div className="archive-related__head">
          <button type="button" onClick={()=>onNavigate(-1)}
            title="Trabalho anterior" aria-label="Trabalho anterior"
            data-testid="work-previous" className="archive-related__arrow">
            <ChevronLeft size={17}/>
          </button>
          <span>DISCOVER</span>
          <button type="button" onClick={()=>onNavigate(1)}
            title="Trabalho seguinte" aria-label="Trabalho seguinte"
            data-testid="work-next" className="archive-related__arrow">
            <ChevronRight size={17}/>
          </button>
        </div>
        <div className="archive-related__tiles">
          {suggestions.map(work=>(
            <button key={work.id} type="button"
              data-testid={"related-work-"+work.id}
              title={work.title} aria-label={"Abrir "+work.title}
              onClick={()=>onSelect(work)}
              className="archive-related__tile">
              <span aria-hidden="true" style={atlasTile(work,cols,rows)}/>
            </button>
          ))}
        </div>
      </div>
      <div className="archive-metadata">
        <p>{pad(it.id)} / {it.brand||it.cat}</p>
        <h2>{it.title}</h2>
        <a data-testid="explore-open-site"
          href={"https://edmundokutuzov.art/work/"+encodeURIComponent(it.slug)}
          target="_blank" rel="noopener noreferrer">
          Ver no site <ArrowUpRight size={16}/>
        </a>
      </div>
    </aside>
  );
}

export default function ExploreOverlay({r}){
  return (
    <div data-testid="explore-overlay" className="archive-overlay">
      <nav aria-label="Filtrar obras do arquivo" className="archive-filters"
        onPointerDown={stop} onPointerUp={stop} onPointerMove={stop}>
        {FILTERS.map((filter,i)=>{
          const Icon=icons[i]||Layers3;
          return <button key={filter} type="button"
            data-testid={"explore-filter-"+filter.toLowerCase().replace(/ /g,"-")}
            title={filter==="ALL"?"Todas as obras":filter}
            aria-label={filter==="ALL"?"Todas as obras":filter}
            aria-pressed={r.filter===filter} onClick={()=>r.setFilter(filter)}
            className={"archive-filter "+(r.filter===filter?"archive-filter--active":"")}>
            <Icon size={18} strokeWidth={1.6}/>
          </button>;
        })}
      </nav>
      {r.hover&&!r.selected&&(
        <div className="archive-hover" data-testid="explore-hover-label">
          <span>{r.hover.brand||r.hover.cat}</span>
          <strong>{r.hover.title}</strong>
        </div>
      )}
      {r.selected&&<Selected it={r.selected}
        onClose={()=>r.setSelected(null)}
        onSelect={r.setSelected} onNavigate={r.navigateSelected}
        suggestions={r.suggestions} transition={r.transition}
        cols={r.atlasColumns} rows={r.atlasRows}/>}
    </div>
  );
}
