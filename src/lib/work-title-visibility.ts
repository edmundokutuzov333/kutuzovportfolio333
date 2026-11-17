/** Campaign titles are deliberately editorial; individual artwork titles stay in metadata only. */
export function isCampaignDiscipline(discipline: string | null | undefined): boolean {
  return /campaign|campanha/i.test((discipline ?? "").trim());
}
export function isArchiveCampaign(item: {cat?: string} | null | undefined): boolean {
  return item?.cat === "CAMPAIGN";
}
