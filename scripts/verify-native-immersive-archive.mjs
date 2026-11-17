import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const prefix = "/work/immersive";
const publicRoot = path.join(root, "public/work/immersive");
const sourceRoot = path.join(root, "vendor/immersive-archive/frontend");

function mustExist(relative) {
  const file = path.join(publicRoot, relative);
  assert.ok(fs.existsSync(file), `Missing self-hosted archive file: ${relative}`);
  assert.ok(fs.statSync(file).size > 0, `Empty self-hosted archive file: ${relative}`);
  return file;
}

mustExist("index.html");
mustExist("reel/catalog.json");
mustExist("reel/atlas0.webp");
mustExist("reel/atlas1.webp");

const catalog = JSON.parse(fs.readFileSync(mustExist("reel/catalog.json"), "utf8"));
assert.ok(Array.isArray(catalog.items));
assert.equal(catalog.items.length, 155, "The source archive must retain all 155 works");
assert.equal(new Set(catalog.items.map((it) => it.id)).size, 155);
const video = catalog.items.filter((it) => it.video);
assert.equal(video.length, 7, "All original video works are retained");
const thumbManifestFile = mustExist("reel/thumbs/manifest.json");
const thumbManifest = JSON.parse(fs.readFileSync(thumbManifestFile, "utf8"));
assert.equal(thumbManifest.count, 155, "The DISCOVER rail must have all 155 previews");
assert.equal(thumbManifest.items.length, 155);
const thumbs = new Map(thumbManifest.items.map(item => [item.id,item]));
assert.equal(thumbs.size, 155);
assert.ok(thumbManifest.totalBytes < 5_000_000,
  "All previews together must remain below 5 MB to protect network performance");
for (const item of catalog.items) {
  if (item.video) mustExist(`reel/vid/${item.id}.mp4`);
  else mustExist(`reel/img/${String(item.id).padStart(3,"0")}.webp`);
  const preview = mustExist(`reel/thumbs/${String(item.id).padStart(3,"0")}.webp`);
  const entry = thumbs.get(item.id);
  assert.ok(entry, `No manifest entry for image ${item.id}`);
  assert.equal(entry.type,item.video ? "video" : "image");
  assert.equal(entry.bytes,fs.statSync(preview).size);
  const [sw,sh] = entry.original;
  const [tw,th] = entry.thumbnail;
  assert.ok(tw>0 && th>0 && sw>0 && sh>0);
  assert.ok(tw<=thumbManifest.maxWidth && th<=thumbManifest.maxHeight);
  assert.ok(Math.abs((tw/th)/(sw/sh)-1)<=0.025,
    `Distorted thumbnail dimensions for item ${item.id}`);
  const header=fs.readFileSync(preview).subarray(0,12);
  assert.equal(header.toString("ascii",0,4),"RIFF");
  assert.equal(header.toString("ascii",8,12),"WEBP");
}

const html = fs.readFileSync(mustExist("index.html"), "utf8");
assert.match(html, /<div id="root"><\/div>/);
assert.match(html, /href="\/work"/);
assert.match(html, /<script[^>]+src="\/work\/immersive\/static\/js\//);
assert.match(html, /\/work\/immersive\/reel\/atlas0.webp/);
assert.match(html, /\/work\/immersive\/reel\/catalog.json/);
assert.ok(!html.includes("showreel-kutuzov-v2.vercel.app"),
  "The same-origin page must not depend on the former showreel domain");

assert.ok(fs.existsSync(path.join(sourceRoot,"src/reel/archiveEngine.js")));
assert.ok(fs.existsSync(path.join(sourceRoot,"src/reel/livingFrames.js")));
assert.ok(fs.existsSync(path.join(sourceRoot,"src/reel/spatialAccents.js")));
assert.ok(fs.existsSync(path.join(sourceRoot,"package.json")));
assert.ok(fs.existsSync(path.join(sourceRoot,"yarn.lock")));
assert.ok(!fs.existsSync(path.join(sourceRoot,"public/reel")),
  "The artworks are stored exactly once in public, not copied into the source folder");

let assets = 0;
let assetBytes = 0;
for (const folder of ["reel", "static"]) {
  const base = path.join(publicRoot,folder);
  function walk(dir){
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      const file=path.join(dir,entry.name);
      if(entry.isDirectory())walk(file);
      else {assets++;assetBytes+=fs.statSync(file).size;}
    }
  }
  walk(base);
}
console.log(JSON.stringify({
  ok: true, origin: "same-origin", route: prefix+"/index.html",
  works:catalog.items.length,videos:video.length,
  thumbnails:thumbs.size,thumbnailBytes:thumbManifest.totalBytes,
  files:assets,bytes:assetBytes,
  runtimeDependencyOnShowreelDomain:false
},null,2));
