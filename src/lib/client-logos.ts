const clientLogoFiles: Record<string, string> = {
  absa: "absa.webp", "toyota-mocambique": "toyota-mocambique.webp", "nissan-mocambique": "nissan-mocambique.webp", "hyundai-mocambique": "hyundai-mocambique.webp", galp: "galp.webp", totalenergies: "totalenergies.webp", vodacom: "vodacom.png", "ronil-auto-mocambique": "ronil-auto-mocambique.webp", "pernod-ricard-mocambique": "pernod-ricard-mocambique.webp", giz: "giz.webp", "multichoice-dstv-gotv": "multichoice-dstv-gotv.webp", kitkat: "kitkat.webp", "flying-fish": "flying-fish.png", "brutal-fruit": "brutal-fruit.webp", "joaquim-chaves-saude": "joaquim-chaves-saude.webp", "ponta-apart-hotel": "ponta-apart-hotel.webp", "hotel-cardoso": "hotel-cardoso.webp", emose: "emose.webp", "mocambique-companhia-de-seguros": "mocambique-companhia-de-seguros.webp", promar: "promar.webp",
};

export function clientLogoUrl(slug: string): string | null {
  const file = clientLogoFiles[slug];
  return file ? `/client-logos/${file}` : null;
}
