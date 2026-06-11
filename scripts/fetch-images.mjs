// Engangs datapipeline: henter ~80 public domain-bilder av Arendal fra
// Nasjonalbibliotekets API og skriver public/data/manifest.json.
// Kjør: npm run fetch-data  (idempotent — hopper over filer som finnes)

import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMG_DIR = join(ROOT, 'public', 'images');
const DATA_DIR = join(ROOT, 'public', 'data');

const API = 'https://api.nb.no/catalog/v1/items';
const QUERY = 'q=Arendal&filter=mediatype:bilder';
const MAX_CANDIDATE_PAGES = 15; // 15 × 100 = inntil 1500 kandidater
// Midtrommet har dør i begge ender og dermed mindre veggplass
const PERIOD_TARGETS = { p1: 27, p2: 22, p3: 27 };
const PAGE_DELAY_MS = 250;
const DOWNLOAD_DELAY_MS = 300;
const YEAR_MIN = 1840;
const YEAR_MAX = 1990;
// Runde årstall som ofte er katalog-plassholdere — kvotebegrenses per periode
const SUSPECT_YEARS = new Set([1900, 1950]);
const SUSPECT_QUOTA_PER_PERIOD = 6;

const CATEGORIES = [
  { id: 'havn', label: 'Havn og sjøfart', keywords: ['havn', 'brygge', 'skip', 'båt', 'baat', 'seil', 'damp', 'fisk', 'sjø', 'sjo', 'tollbod', 'toldbod', 'kai', 'fartøy', 'fartoy', 'skute', 'skonnert', 'bark '] },
  { id: 'kirke', label: 'Kirke og Tyholmen', keywords: ['kirke', 'kirken', 'tyholmen', 'kapell'] },
  { id: 'gate', label: 'Gater og bygninger', keywords: ['gate', 'gade', 'torv', 'torg', 'bygning', 'hus', 'hotel', 'skole', 'rådhus', 'raadhus', 'park', 'bro ', 'jernbane', 'stasjon', 'gård', 'gaard', 'villa', 'bibliotek', 'museum'] },
  { id: 'mennesker', label: 'Mennesker', keywords: ['portrett', 'familie', 'barn', 'folk', 'gruppe', 'kvinne', 'mann ', 'menn ', 'arbeidere'] },
  { id: 'utsikt', label: 'Byen og utsikt', keywords: ['panorama', 'oversigt', 'oversikt', 'utsikt', 'udsigt', 'fugleperspektiv', 'parti', 'fjord', 'holme', 'øy ', 'oy '] },
];
const FALLBACK_CATEGORY = 'utsikt';

const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, attempt = 1) {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (attempt >= 3) throw err;
    await sleep(1000 * attempt);
    return fetchJson(url, attempt + 1);
  }
}

async function fetchCandidates() {
  const items = [];
  for (let page = 0; page < MAX_CANDIDATE_PAGES; page++) {
    const data = await fetchJson(`${API}?${QUERY}&size=100&page=${page}`);
    const batch = data._embedded?.items ?? [];
    items.push(...batch);
    const totalPages = data.page?.totalPages ?? 0;
    log(`  side ${page + 1}/${Math.min(MAX_CANDIDATE_PAGES, totalPages)} — ${items.length} elementer`);
    if (page + 1 >= totalPages || batch.length === 0) break;
    await sleep(PAGE_DELAY_MS);
  }
  return items;
}

function parseYear(item) {
  const raw = item.metadata?.originInfo?.issued ?? item.metadata?.creation?.date ?? item.dateCreated ?? item.metadata?.dateCreated;
  const m = String(raw ?? '').match(/\b(1[89]\d\d|19\d\d)\b/);
  return m ? Number(m[1]) : null;
}

function isFromArendal(item) {
  const geo = item.metadata?.geographic ?? item.geographic ?? {};
  const haystack = [geo.city, geo.placeString, ...(Array.isArray(geo) ? geo : []), JSON.stringify(item.metadata?.subject ?? '')]
    .filter((v) => typeof v === 'string')
    .join(';')
    .toLowerCase();
  return haystack.includes('arendal');
}

function getThumbTemplate(item) {
  return item._links?.thumbnail_custom?.href ?? null;
}

function categorize(item) {
  const subjects = item.metadata?.subjectName ?? [];
  const text = `${subjects.join(' ')} ${item.metadata?.title ?? ''}`.toLowerCase();
  for (const cat of CATEGORIES) {
    if (cat.keywords.some((kw) => text.includes(kw))) return cat.id;
  }
  return FALLBACK_CATEGORY;
}

function normalizeTitle(title) {
  return String(title ?? '')
    .toLowerCase()
    .replace(/\[|\]|\(|\)/g, '')
    .replace(/\b(nf\.?w?|fnr|nb|mit)[\s._-]*\d+\b/g, '') // arkivnumre
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildPeriods(years) {
  // Histogram for manuell sjekk
  const byDecade = {};
  for (const y of years) byDecade[`${Math.floor(y / 10) * 10}-årene`] = (byDecade[`${Math.floor(y / 10) * 10}-årene`] ?? 0) + 1;
  log('\nÅrs-histogram (per tiår):');
  for (const k of Object.keys(byDecade).sort()) log(`  ${k}: ${'█'.repeat(Math.min(60, byDecade[k]))} ${byDecade[k]}`);

  return [
    { id: 'p1', label: 'Tiden før 1905', from: 0, to: 1904 },
    { id: 'p2', label: '1905–1949', from: 1905, to: 1949 },
    { id: 'p3', label: 'Etter 1950', from: 1950, to: 9999 },
  ];
}

function periodFor(periods, year) {
  return periods.find((p) => year >= p.from && year <= p.to)?.id ?? null;
}

function selectBalanced(candidates, periods) {
  const selected = [];
  for (const period of periods) {
    const perPeriod = PERIOD_TARGETS[period.id] ?? 25;
    const pool = candidates.filter((c) => c.period === period.id);
    // Foretrekk presise årstall; mistenkte plassholder-år sist og kvotebegrenset
    const byCat = new Map(CATEGORIES.map((c) => [c.id, []]));
    for (const c of pool) byCat.get(c.category).push(c);
    for (const list of byCat.values()) list.sort((a, b) => Number(SUSPECT_YEARS.has(a.year)) - Number(SUSPECT_YEARS.has(b.year)));

    const maxPerCat = Math.ceil(perPeriod * 0.4);
    const picked = [];
    let suspectCount = 0;
    let progress = true;
    while (picked.length < perPeriod && progress) {
      progress = false;
      for (const cat of CATEGORIES) {
        if (picked.length >= perPeriod) break;
        const list = byCat.get(cat.id);
        const inCat = picked.filter((p) => p.category === cat.id).length;
        while (list.length > 0) {
          const next = list.shift();
          const suspect = SUSPECT_YEARS.has(next.year);
          if (inCat >= maxPerCat) break;
          if (suspect && suspectCount >= SUSPECT_QUOTA_PER_PERIOD) continue;
          picked.push(next);
          if (suspect) suspectCount++;
          progress = true;
          break;
        }
      }
    }
    log(`  ${period.label}: ${picked.length} valgt (av ${pool.length} kandidater)`);
    selected.push(...picked);
  }
  return selected;
}

function readJpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let off = 2;
  while (off < buf.length - 9) {
    if (buf[off] !== 0xff) { off++; continue; }
    const marker = buf[off + 1];
    // SOF0–SOF15 unntatt DHT/JPG/DAC (C4, C8, CC)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
    }
    const len = buf.readUInt16BE(off + 2);
    off += 2 + len;
  }
  return null;
}

async function fileExists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function downloadImage(url, dest, attempt = 1) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 10_000) throw new Error(`for liten fil (${buf.length} B)`);
    await writeFile(dest, buf);
    return buf;
  } catch (err) {
    if (attempt >= 3) throw err;
    await sleep(1500 * attempt);
    return downloadImage(url, dest, attempt + 1);
  }
}

async function main() {
  await mkdir(IMG_DIR, { recursive: true });
  await mkdir(DATA_DIR, { recursive: true });

  log('Henter kandidater fra api.nb.no …');
  const raw = await fetchCandidates();
  log(`Totalt hentet: ${raw.length}`);

  const seenUrn = new Set();
  const seenTitle = new Set();
  const candidates = [];
  for (const item of raw) {
    if (item.accessInfo?.isPublicDomain !== true) continue;
    const thumb = getThumbTemplate(item);
    if (!thumb) continue;
    const year = parseYear(item);
    if (year === null || year < YEAR_MIN || year > YEAR_MAX) continue;
    if (!isFromArendal(item)) continue;
    const urn = item.metadata?.identifiers?.urn ?? item.id;
    if (seenUrn.has(urn)) continue;
    seenUrn.add(urn);
    const title = ((item.metadata?.title ?? 'Uten tittel')
      .replace(/^\[|\]$/g, '')
      .replace(/^NF\.\w+\s+\d+\s*[-–.]?\s*/i, '') // arkivkoder som «NF.WL 02136»
      .trim()) || 'Uten tittel';
    const titleKey = `${normalizeTitle(title)}|${year}`;
    if (seenTitle.has(titleKey)) continue;
    seenTitle.add(titleKey);
    candidates.push({
      id: item.id,
      title,
      year,
      creator: item.metadata?.creators?.join(', ') || 'Ukjent fotograf',
      category: categorize(item),
      thumb,
      nbUrl: `https://www.nb.no/items/${item.id}`,
    });
  }
  log(`Etter filtrering/dedupe: ${candidates.length} kandidater`);

  const periods = buildPeriods(candidates.map((c) => c.year));
  for (const c of candidates) c.period = periodFor(periods, c.year);

  log('\nKategorifordeling i kandidater:');
  for (const cat of CATEGORIES) log(`  ${cat.label}: ${candidates.filter((c) => c.category === cat.id).length}`);

  log('\nVelger balansert utvalg:');
  const selected = selectBalanced(candidates, periods);

  log(`\nLaster ned ${selected.length} bilder i to størrelser …`);
  const items = [];
  let n = 0;
  for (const item of selected) {
    n++;
    const file1200 = join(IMG_DIR, `${item.id}.jpg`);
    const file512 = join(IMG_DIR, `${item.id}_512.jpg`);
    try {
      let buf;
      if (await fileExists(file1200)) {
        buf = await readFile(file1200);
        log(`  [${n}/${selected.length}] finnes fra før: ${item.id}`);
      } else {
        buf = await downloadImage(item.thumb.replace('{width},{height}', '1200,0'), file1200);
        await sleep(DOWNLOAD_DELAY_MS);
        log(`  [${n}/${selected.length}] lastet ned: ${item.title.slice(0, 60)}`);
      }
      if (!(await fileExists(file512))) {
        await downloadImage(item.thumb.replace('{width},{height}', '512,0'), file512);
        await sleep(DOWNLOAD_DELAY_MS);
      }
      const size = readJpegSize(buf);
      if (!size || size.width < 400) { log(`    hopper over (uleselig/for liten: ${JSON.stringify(size)})`); continue; }
      items.push({
        id: item.id,
        title: item.title,
        year: item.year,
        creator: item.creator,
        category: item.category,
        period: item.period,
        src: `/images/${item.id}.jpg`,
        src512: `/images/${item.id}_512.jpg`,
        aspect: Number((size.width / size.height).toFixed(3)),
        nbUrl: item.nbUrl,
      });
    } catch (err) {
      log(`    FEIL for ${item.id}: ${err.message} — hopper over`);
    }
  }

  const manifest = {
    generated: new Date().toISOString(),
    periods,
    categories: CATEGORIES.map(({ id, label }) => ({ id, label })),
    items,
  };
  await writeFile(join(DATA_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // Selvtest
  let ok = true;
  for (const it of items) {
    for (const field of ['id', 'title', 'year', 'creator', 'category', 'period', 'src', 'src512', 'aspect', 'nbUrl']) {
      if (it[field] === undefined || it[field] === null || it[field] === '') { log(`SELVTEST-FEIL: ${it.id} mangler ${field}`); ok = false; }
    }
    if (!(await fileExists(join(ROOT, 'public', it.src)))) { log(`SELVTEST-FEIL: mangler fil ${it.src}`); ok = false; }
    if (!(await fileExists(join(ROOT, 'public', it.src512)))) { log(`SELVTEST-FEIL: mangler fil ${it.src512}`); ok = false; }
  }
  log(`\nFerdig: ${items.length} bilder i manifestet. Selvtest: ${ok ? 'OK' : 'FEILET'}`);
  log('Fordeling per periode/kategori:');
  for (const p of periods) {
    const inP = items.filter((i) => i.period === p.id);
    const cats = CATEGORIES.map((c) => `${c.id}:${inP.filter((i) => i.category === c.id).length}`).join(' ');
    log(`  ${p.label}: ${inP.length}  (${cats})`);
  }
  if (!ok) process.exit(1);
}

main().catch((err) => { console.error('Pipeline feilet:', err); process.exit(1); });
