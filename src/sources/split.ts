import { GET, isSkippedYear, NEXT_YEAR, throwIfHttpError } from '../-utils';
import { makeUrl } from './-shared';
import { processTxtFileForSplits } from './splits/txt';
import { processXlsxFileForSplits } from './splits/xlsx';
import { processXlsFileForSplits } from './splits/xls';

export function fetchSplitData(year: number, force = false): Promise<void> {
  return _fetchSplitData(year, force);
}

async function _fetchSplitData(year: number, force = false): Promise<void> {
  if (isSkippedYear(year, 'split')) {
    return;
  }

  const startsFile = Bun.file(`./manual-data/starts.json`);
  const OfficialStarts = (await startsFile.json()) as Record<number, string>;

  // we always serve from cache unless asked to force generate
  const path = `./.data-cache/raw/${year}/split.json`;
  const file = Bun.file(path);
  const forceGenerate = force || Bun.env.FORCE_GENERATE === 'true';
  const exists = await file.exists();

  if (!forceGenerate && exists) {
    return;
  }

  const url = makeUrl('split', year);
  const response = await GET(url);

  // avoid erring for stats that likely just don't exist yet
  if (response.status >= 400 && year === NEXT_YEAR) {
    console.log(`\t⚠️  No splits data available at ${url} for year ${year}`);
    return;
  }

  throwIfHttpError(response);

  const SplitContext = {
    year,
    url,
    response,
    file,
    path,
    OfficialStarts,
  };

  //
  //////////////////////////
  /////// TXT FILE /////////
  //////////////////////////
  //
  // TXT files exist for 1986-2007
  // but we use XLS files for 2004-2007
  if (url.endsWith('.txt')) return processTxtFileForSplits(SplitContext);

  //
  //////////////////////////
  /////// XLSX FILE /////////
  //////////////////////////
  //
  // XLSX files exist for 2014+
  if (url.endsWith('.xlsx')) return processXlsxFileForSplits(SplitContext);

  //
  //////////////////////////
  /////// XLS FILE /////////
  //////////////////////////
  //
  // XLS files exist for 2004-2013
  if (url.endsWith('.xls')) return processXlsFileForSplits(SplitContext);

  //
  //////////////////////////
  ////// UNKNOWN FILE //////
  //////////////////////////
  //
  throw new Error(`Support for parsing splits from ${url} is not implemented`);
}
