// Searches Wikimedia Commons for candidate photos and prints license/date/description for review.
// Usage: node tools/commons-search.mjs "query one" "query two" ...
// Full results are cached in tools/cache/candidates.json for tools/fetch-photos.mjs.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

const UA = { 'User-Agent': 'TimescopeGame/1.0 (https://github.com/ladderheroladder/peekmoji)' };
const cacheDir = new URL('./cache/', import.meta.url);
mkdirSync(cacheDir, { recursive: true });
const cacheFile = new URL('./candidates.json', cacheDir);
const cache = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {};
const strip = s => (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

for (const q of process.argv.slice(2)) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrsearch: q, gsrnamespace: '6', gsrlimit: '6',
    prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '1600',
    iiextmetadatafilter: 'LicenseShortName|DateTimeOriginal|ImageDescription|Artist|Credit'
  });
  const res = await fetch('https://commons.wikimedia.org/w/api.php?' + params, { headers: UA });
  const pages = Object.values((await res.json()).query?.pages || {}).sort((a, b) => a.index - b.index);
  console.log(`\n## ${q}`);
  let shown = 0;
  for (const p of pages) {
    const ii = p.imageinfo?.[0]; if (!ii) continue;
    const m = ii.extmetadata || {};
    const lic = strip(m.LicenseShortName?.value);
    if (!/jpeg|tiff|png/.test(ii.mime) || ii.width < 900) continue;
    cache[p.title] = {
      title: p.title, page: ii.descriptionurl, thumb: ii.thumburl, width: ii.width, height: ii.height, license: lic,
      date: strip(m.DateTimeOriginal?.value), artist: strip(m.Artist?.value), desc: strip(m.ImageDescription?.value)
    };
    console.log(`- ${p.title.slice(5)} | ${lic} | ${strip(m.DateTimeOriginal?.value).slice(0, 30)} | ${ii.width}x${ii.height} | ${strip(m.ImageDescription?.value).slice(0, 110)}`);
    if (++shown >= 3) break;
  }
  await new Promise(r => setTimeout(r, 250));
}
writeFileSync(cacheFile, JSON.stringify(cache, null, 1));
