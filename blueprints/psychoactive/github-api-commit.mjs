import { readFile } from "node:fs/promises";
const token = process.env.GITHUB_TOKEN;
if(!token)throw new Error("GITHUB_TOKEN is required");
async function api(method,path,body) {
  const response = await fetch("https://api.github.com"+path,{
    method,
    headers:{Authorization:"Bearer "+token,Accept:"application/vnd.github+json","Content-Type":"application/json","X-GitHub-Api-Version":"2026-03-10"},
    body:body===undefined?undefined:JSON.stringify(body),
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(method+" "+path+" returned "+response.status+": "+(data?.message||"Unknown error"));
  return data;
}
let repository=process.env.REPOSITORY;
if(process.env.NEW_REPOSITORY_NAME){
  const created=await api("POST","/user/repos",{
    name:process.env.NEW_REPOSITORY_NAME,
    private:process.env.NEW_REPOSITORY_PRIVATE!=="false",
    auto_init:true,
    description:"Implementação original baseada numa especificação de caixa preta",
  });
  repository=created.full_name;
}
if(!repository || !/^[\w.-]+\/[\w.-]+$/.test(repository))throw new Error("Invalid REPOSITORY");
const root="/repos/"+repository;
let ref;
try { ref=await api("GET",root+"/git/ref/heads/main"); }
catch(error){
  if(!process.env.NEW_REPOSITORY_NAME)throw error;
  const repo=await api("GET",root);
  const source=await api("GET",root+"/git/ref/heads/"+encodeURIComponent(repo.default_branch));
  ref=await api("POST",root+"/git/refs",{ref:"refs/heads/main",sha:source.object.sha});
  await api("PATCH",root,{default_branch:"main"});
}
const parent=await api("GET",root+"/git/commits/"+ref.object.sha);
const manifest=JSON.parse(await readFile(process.env.FILES_MANIFEST || "files-manifest.json","utf8"));
if(!Array.isArray(manifest)||!manifest.length)throw new Error("The file manifest must be a non-empty array");
const tree=manifest.map(({path,content})=>{
  if(typeof path!=="string" || path.startsWith("/") || path.split("/").includes("..") || typeof content!=="string")throw new Error("Invalid manifest entry");
  return {path,content,type:"blob",mode:"100644"};
});
const createdTree=await api("POST",root+"/git/trees",{base_tree:parent.tree.sha,tree});
const commit=await api("POST",root+"/git/commits",{message:process.env.COMMIT_MESSAGE||"docs: publish replica specification",tree:createdTree.sha,parents:[parent.sha]});
const fresh=await api("GET",root+"/git/ref/heads/main");
if(fresh.object.sha!==parent.sha)throw new Error("main changed; rebuild the tree from the latest commit");
await api("PATCH",root+"/git/refs/heads/main",{sha:commit.sha,force:false});
console.log(JSON.stringify({repository,commit:commit.sha,url:"https://github.com/"+repository+"/commit/"+commit.sha}));
