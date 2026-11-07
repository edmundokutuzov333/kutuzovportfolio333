import { loadHomeContent } from "../../../../../src/lib/cms/loaders";
import { getPublicPresentation } from "../../../../../src/lib/cms/queries";
export async function loadReplicaContent() {
  const [content, presentation] = await Promise.all([loadHomeContent(), getPublicPresentation()]);
  return { ...content, presentation };
}
