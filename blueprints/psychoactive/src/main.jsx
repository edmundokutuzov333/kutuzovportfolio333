import React from "react";
import { createRoot } from "react-dom/client";
import { createRootRoute, createRoute, createRouter, createHashHistory, RouterProvider } from "@tanstack/react-router";
import { loadReplicaContent } from "./lib/cms/loaders";
import { loadProjectDetailContent, loadContactContent } from "../../../src/lib/cms/loaders";
import { Shell } from "./components/Shell";
import { Home, About, Project, Article, Missing, Contact } from "./routes/Pages";
import { ProjectGrid, ClientsGrid, Services, Feed } from "./components/Sections";
import { AuditCard } from "./components/AuditCard";
import "./styles.css";
const rootRoute = createRootRoute({
  loader: loadReplicaContent,
  component: function Root() { return <Shell data={rootRoute.useLoaderData()}/>; },
  pendingComponent: ()=><div className="loading" role="status">A carregar o conteúdo…</div>,
  errorComponent: ({error,reset})=><section className="section page-intro" role="alert"><h1>Conteúdo temporariamente indisponível.</h1><p>{error.message}</p><button className="pill" onClick={reset}>Tentar novamente</button></section>,
  notFoundComponent: Missing,
});
const route = (path,component,extra={}) => createRoute({ getParentRoute:()=>rootRoute, path, component, ...extra });
const home = route("/",()=> <Home data={rootRoute.useLoaderData()}/>);
const work = route("/work",()=> <ProjectGrid projects={rootRoute.useLoaderData().projects}/>);
const about = route("/about",()=> <About data={rootRoute.useLoaderData()}/>);
const services = route("/services",()=> <Services services={rootRoute.useLoaderData().services}/>);
const clients = route("/clients",()=> <ClientsGrid clients={rootRoute.useLoaderData().clients}/>);
const audit = route("/design-audit",()=> <AuditCard full/>);
const feed = route("/content-hub",()=> <Feed filters/>);
const article = route("/content-hub/$slug",()=> <Article slug={article.useParams().slug}/>);
const project = route("/work/$slug",()=> <Project project={project.useLoaderData().project}/>,{loader:({params})=>loadProjectDetailContent(params.slug)});
const contact = route("/contact",()=> <Contact data={contact.useLoaderData()}/>,{loader:loadContactContent});
const router = createRouter({routeTree:rootRoute.addChildren([home,work,about,services,clients,audit,feed,article,project,contact]),history:createHashHistory(),defaultPreload:"intent"});
createRoot(document.getElementById("root")).render(<React.StrictMode><RouterProvider router={router}/></React.StrictMode>);
