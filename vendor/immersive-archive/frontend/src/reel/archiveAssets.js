import * as THREE from "three";
import { BASE_URL } from "./paths";

/**
 * Minimum boot payload: one 155-item manifest and two atlas images.
 * All individual high-resolution artworks and videos are loaded on selection.
 */
export async function loadArchiveAssets(onProgress=()=>{}) {
  const report = (v) => onProgress(Math.min(1, v));
  const loadTexture = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      const texture = new THREE.Texture(img);
      texture.colorSpace = THREE.NoColorSpace;
      texture.anisotropy = 8;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.needsUpdate = true;
      resolve(texture);
    };
    img.onerror = () => reject(new Error("Falha ao carregar o atlas do arquivo 3D."));
    img.src = src;
  });

  const catalogTask = fetch(`${BASE_URL}/catalog.json`, {cache:"force-cache"})
    .then((response) => {
      if (!response.ok) throw new Error("Catálogo de obras indisponível.");
      return response.json();
    }).then(catalog => {report(1/3); return catalog;});
  const atlasTasks = [0,1].map((i) => loadTexture(`${BASE_URL}/atlas${i}.webp`)
    .then((texture)=>{report((i+2)/3);return texture;}));
  const [catalog, ...atlases] = await Promise.all([catalogTask,...atlasTasks]);
  if (!Array.isArray(catalog.items) || catalog.items.length === 0 || !atlases.every(Boolean)) {
    throw new Error("O arquivo 3D não tem os recursos necessários.");
  }
  report(1);
  return { catalog, atlases };
}
