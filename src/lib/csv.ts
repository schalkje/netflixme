import { ingestHistory, touchIngest, type IngestSummary } from "./ingest";

export { parseNetflixCsv, baseTitle } from "./csvParse";

// Resolve a batch of titles and mark them seen (same pipeline the extension uses).
export async function backfillFromCsv(titles: string[]): Promise<IngestSummary> {
  const result = await ingestHistory(titles, "csv");
  await touchIngest();
  return result;
}
