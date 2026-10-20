#!/usr/bin/env node
/**
 * Turn a running dev server's page into one self-contained HTML file.
 *
 *   node scripts/html-snapshot.mjs --url http://localhost:3000/ --out snapshot.html
 *
 * Why this exists: a UI walkthrough should not need a running backend, a Node
 * toolchain, or network access. A page served by Next.js/Vite pulls its styling,
 * fonts and images from build-output URLs that only exist while the dev server is
 * up, and its JS bundle expects a hydration runtime that a bare file cannot give
 * it. This script inlines everything that affects rendering and removes the
 * runtime, leaving a file you can double-click.
 *
 * Pipeline:
 *   1. GET the page.
 *   2. Download every stylesheet, follow @import chains, and collect url() refs.
 *   3. Download those url() assets (fonts, background images) and the <img> sources.
 *   4. Subset webfonts to the glyphs the page actually shows; re-encode covers.
 *   5. Rewrite the document: inline CSS, inline assets as data URIs, drop scripts.
 *   6. Verify nothing external is left and that every class has a rule.
 *
 * Markup is rewritten with regular expressions rather than a DOM parser on
 * purpose: the input is server-rendered HTML from a build tool, and avoiding a
 * dependency keeps this runnable from any checkout without an install step.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- options ---

function parseArgs(argv) {
  const opts = {
    url: 'http://localhost:3000/',
    out: null,
    workdir: null,
    inlineImages: true,
    maxInlineBytes: 3 * 1024 * 1024,
    subsetFonts: true,
    optimizeImages: true,
    keepScripts: false,
    keepHeadMeta: true,
    dropOgImages: true,
    stripCssComments: [/^\/\* \[project\]/, /^\/\*# sourceMappingURL/],
    injectCss: [],
    injectJs: [],
    // Sent as the Cookie header on every request. Auth-gated pages (founder
    // dashboard, submit, connections) redirect to /login without it, and the
    // server-rendered markup — the only markup a snapshot can capture — depends
    // on it.
    cookie: null,
    proxy: null,
    timeoutMs: 30_000,
    retries: 3,
    retryDelayMs: 800,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--url': opts.url = next(); break;
      case '--out': opts.out = next(); break;
      case '--workdir': opts.workdir = next(); break;
      case '--max-inline-bytes': opts.maxInlineBytes = Number(next()); break;
      case '--no-inline-images': opts.inlineImages = false; break;
      case '--no-subset-fonts': opts.subsetFonts = false; break;
      case '--no-optimize-images': opts.optimizeImages = false; break;
      case '--keep-scripts': opts.keepScripts = true; break;
      case '--keep-og-images': opts.dropOgImages = false; break;
      case '--inject-css': opts.injectCss.push(next()); break;
      case '--inject-js': opts.injectJs.push(next()); break;
      case '--timeout': opts.timeoutMs = Number(next()); break;
      case '--cookie': opts.cookie = next(); break;
      case '--proxy': opts.proxy = next(); break;
      case '--verbose':
        opts.verbose = true;
        process.env.SNAPSHOT_VERBOSE = '1';
        process.env.SNAPSHOT_TIMINGS = '1';
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        if (a.startsWith('--')) fail(`unknown option: ${a}`);
    }
  }

  const base = opts.url.replace(/\/[^/]*$/, '/') || opts.url;
  opts.baseUrl = base.endsWith('/') ? base : `${base}/`;
  opts.out ??= path.join('.scratch', 'snapshot', 'page.html');
  opts.workdir ??= path.dirname(opts.out);
  return opts;
}

function printHelp() {
  console.log(`Usage: node scripts/html-snapshot.mjs [options]

  --url <url>              page to snapshot            (default http://localhost:3000/)
  --out <file>             single-file HTML output     (default .scratch/snapshot/page.html)
  --workdir <dir>          scratch dir for downloads   (default: dirname of --out)
  --max-inline-bytes <n>   skip inlining assets bigger than this (default 3145728)
  --no-inline-images       leave <img> pointing at their URLs
  --no-subset-fonts        embed fonts whole (much bigger, exact)
  --no-optimize-images     skip the WebP re-encode pass
  --keep-scripts           keep <script> tags (rarely wanted: runtime will error)
  --keep-og-images         keep og:image / twitter:image (dead links from file://)
  --inject-css <file>      append extra CSS (repeatable)
  --inject-js <file>       append extra JS (repeatable)
  --cookie <value>         Cookie header sent with every request, e.g.
                           "shenicest_token=..." for auth-gated pages
  --proxy <url>            Route asset requests through this proxy, e.g.
                           http://127.0.0.1:7890. Loopback stays direct.
                           Falls back to HTTPS_PROXY/HTTP_PROXY when omitted.
  --timeout <ms>           per-request timeout        (default 30000)
  --verbose                print per-phase and per-asset timings to stderr
                           (also: SNAPSHOT_TIMINGS=1 for the summary only)`);
}

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

const log = (...a) => console.log(...a);
const warn = (...a) => console.warn(...a);
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

// ------------------------------------------------------------------ timing ---

/**
 * Wall-clock instrumentation.
 *
 * A snapshot spends its time in four very different places (page fetch, asset
 * downloads, Python post-processing, assembly), and the totals alone don't say
 * which one is slow. Each phase is timed and printed, and `--timings` dumps the
 * per-asset breakdown so a single stalling host is obvious.
 *
 * Timings go to stderr so they can be filtered without disturbing the report.
 */
const timings = [];
let phaseStart = performance.now();

function mark(label) {
  const now = performance.now();
  const ms = now - phaseStart;
  phaseStart = now;
  timings.push({ label, ms });
  if (ms >= 50 || process.env.SNAPSHOT_VERBOSE) {
    console.error(`  [${ms.toFixed(0).padStart(6)}ms] ${label}`);
  }
  return ms;
}

/**
 * Record an event that already knows its own duration.
 *
 * Unlike `mark`, this does not touch the phase clock — asset downloads happen
 * inside a phase and must not reset it.
 */
function note(label, ms) {
  timings.push({ label, ms });
  if (process.env.SNAPSHOT_VERBOSE) console.error(`  [${ms.toFixed(0).padStart(6)}ms] ${label}`);
}

function dumpTimings() {
  if (!process.env.SNAPSHOT_TIMINGS) return;
  console.error('\n--- timings ---');
  const total = timings.reduce((sum, t) => sum + t.ms, 0);
  for (const t of [...timings].sort((a, b) => b.ms - a.ms)) {
    if (t.ms < 1) continue;
    const share = total ? ((t.ms / total) * 100).toFixed(0) : '0';
    console.error(`  ${(t.ms / 1000).toFixed(2).padStart(7)}s ${share.padStart(3)}%  ${t.label}`);
  }
  console.error(`  ${(total / 1000).toFixed(2).padStart(7)}s       TOTAL`);
}

// --------------------------------------------------------------- fetching ---

/**
 * Fetch, routed through a proxy when one is configured.
 *
 * Node's built-in fetch ignores HTTP(S)_PROXY, and its `ProxyAgent` support is
 * incomplete: passing an undici dispatcher to the global fetch fails with
 * "invalid onRequestStart method". So when a proxy is in play we swap in
 * undici's own fetch, which accepts a dispatcher. Without a proxy the built-in
 * fetch is used, keeping the no-dependency path intact.
 *
 * A proxy is needed whenever the assets live on a host the machine cannot reach
 * directly — image CDNs behind a firewall are the common case, and the failure
 * mode is a silent stall until the per-request timeout.
 */
let httpFetch = globalThis.fetch;

async function configureProxy(proxyUrl) {
  if (!proxyUrl) return;

  let undici;
  try {
    undici = await import('undici');
  } catch {
    warn(`  ! --proxy ignored: undici is not installed (run bun install)`);
    return;
  }

  // connect.timeout matters: ProxyAgent's default is short enough that a
  // TLS-handshaking upstream proxy times out before the tunnel opens.
  const agent = new undici.ProxyAgent({
    uri: proxyUrl,
    connect: { timeout: 30_000 },
  });
  httpFetch = (url, init) => undici.fetch(url, { ...init, dispatcher: agent });
  log(`  proxy ${proxyUrl}`);
}

/**
 * Hosts that must bypass the proxy.
 *
 * The page under test is served from localhost; routing that through an
 * upstream proxy either fails or is needlessly slow. undici's ProxyAgent has no
 * NO_PROXY support, so the bypass is an explicit list.
 */
const LOOPBACK = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?\//i;

async function fetchText(url, opts) {
  const res = await fetchWithTimeout(url, opts);
  return await res.text();
}

async function fetchBuffer(url, opts) {
  const res = await fetchWithTimeout(url, opts);
  const contentType = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  return { buffer: Buffer.from(await res.arrayBuffer()), contentType };
}

async function fetchWithTimeout(url, opts) {
  const attempt = async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
    try {
      // Loopback always goes direct: proxying the dev server through an
      // upstream proxy is slower at best and usually broken.
      const res = await (LOOPBACK.test(url) ? globalThis.fetch : httpFetch)(url, {
        signal: ctrl.signal,
        redirect: 'follow',
        headers: {
          'user-agent': 'html-snapshot/1.0',
          accept: '*/*',
          ...(opts.cookie ? { cookie: opts.cookie } : {}),
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } finally {
      clearTimeout(timer);
    }
  };

  // Remote hosts (image CDNs especially) are flaky; retry before giving up. The
  // asset cache below means a retry usually only happens on the first run.
  let lastErr;
  for (let i = 0; i < opts.retries; i++) {
    try {
      return await attempt();
    } catch (err) {
      lastErr = err;
      if (i < opts.retries - 1) await new Promise((r) => setTimeout(r, opts.retryDelayMs * (i + 1)));
    }
  }
  throw new Error(`${lastErr?.message ?? 'fetch failed'} (after ${opts.retries} attempts)`);
}

// ------------------------------------------------------------ url helpers ---

const isDataUri = (u) => /^data:/i.test(u);
const isAbsolute = (u) => /^[a-z][a-z0-9+.-]*:/i.test(u) || u.startsWith('//');

function resolveUrl(ref, base) {
  if (!ref || isDataUri(ref) || ref.startsWith('#')) return null;
  try {
    return new URL(ref, base).href;
  } catch {
    return null;
  }
}

/**
 * Local filename for a URL.
 *
 * Built from the whole path rather than its basename: many CDNs end every image
 * URL in the same segment (`/seed/<name>/800/600`), so `basename()` would collapse
 * dozens of distinct images onto one filename and silently overwrite them. The
 * path slug keeps the name readable, and a short hash guarantees uniqueness for
 * URLs that differ only in their query string.
 */
function localNameFor(url, ext) {
  const u = new URL(url);
  const slug = u.pathname
    .replace(ext, '')
    .split('/')
    .filter(Boolean)
    .map((seg) => seg.replace(/[^a-zA-Z0-9._-]/g, '_'))
    .join('-')
    .slice(-80) || 'index';
  const hash = crypto.createHash('sha1').update(u.pathname + u.search).digest('hex').slice(0, 8);
  return `${slug}-${hash}${ext}`;
}

const MIME = {
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.css': 'text/css',
};

/** Reverse map so a response's Content-Type can decide the file extension. */
const EXT_FOR_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'image/x-icon': '.ico',
  'image/vnd.microsoft.icon': '.ico',
  'image/avif': '.avif',
  'font/woff2': '.woff2',
  'font/woff': '.woff',
  'font/ttf': '.ttf',
  'font/otf': '.otf',
  'text/css': '.css',
};

function mimeFor(file) {
  return MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * The extension an asset should be stored under.
 *
 * A URL's own extension is preferred, but plenty of CDNs serve images from
 * extension-less paths (`/seed/forest/800/600`). Without an extension the file has
 * no MIME type when it becomes a data URI, and browsers refuse to render it, so
 * fall back to the Content-Type.
 */
function extensionFor(urlPath, contentType) {
  const fromUrl = path.extname(urlPath).toLowerCase();
  if (fromUrl && MIME[fromUrl]) return fromUrl;
  return EXT_FOR_MIME[contentType] ?? fromUrl ?? '';
}

async function toDataUri(file) {
  const buf = await fs.readFile(file);
  return `data:${mimeFor(file)};base64,${buf.toString('base64')}`;
}

// ------------------------------------------------------------- asset store ---

/**
 * Downloads every asset once, remembers its local path, and (optionally) runs the
 * Python helpers over fonts and images. Rewriting works off this map so each URL
 * is fetched a single time even when it appears many times in the document.
 */
class AssetStore {
  constructor(opts, dirs) {
    this.opts = opts;
    this.dirs = dirs;
    this.byUrl = new Map();
    this.failures = [];
    this.subsetFonts = new Map(); // original local path -> subsetted local path
    this.optimizedImages = new Map(); // original local path -> smaller encoding
  }

  async fetch(url, kind) {
    if (this.byUrl.has(url)) return this.byUrl.get(url);

    const dir = kind === 'font' ? this.dirs.fonts
      : kind === 'css' ? this.dirs.css
      : this.dirs.images;

    // Persistent cache keyed by URL, so a later run reuses earlier downloads even
    // if the remote host is unreachable by then (image CDNs and placeholders are
    // frequently flaky, and a UI snapshot must not depend on them being up).
    const key = crypto.createHash('sha1').update(url).digest('hex');
    const cachedBase = path.join(this.dirs.cache, key);

    // Cache entries keep the extension they were stored with, which matters when
    // the URL itself carries none.
    for (const ext of Object.keys(MIME)) {
      const candidate = cachedBase + ext;
      try {
        const stat = await fs.stat(candidate);
        if (stat.size > 0) {
          const file = path.join(dir, localNameFor(url, ext));
          await fs.copyFile(candidate, file);
          const record = { url, file, bytes: stat.size, kind, ext, cached: true };
          this.byUrl.set(url, record);
          return record;
        }
      } catch {
        /* try the next extension */
      }
    }

    try {
      const started = performance.now();
      const { buffer, contentType } = await fetchBuffer(url, this.opts);
      const elapsed = performance.now() - started;
      const ext = extensionFor(new URL(url).pathname, contentType);
      const file = path.join(dir, localNameFor(url, ext));
      await fs.writeFile(file, buffer);
      await fs.writeFile(cachedBase + ext, buffer);
      const record = { url, file, bytes: buffer.length, kind, ext, cached: false };
      this.byUrl.set(url, record);
      // Slow downloads are the usual cause of a long run; surface them as they
      // happen instead of only in the final total.
      if (elapsed > (this.opts.slowAssetMs ?? 1000)) {
        warn(`  ! slow ${kind} ${(elapsed / 1000).toFixed(1)}s ${kb(buffer.length)} ${url}`);
      }
      note(`download ${kind} ${(elapsed / 1000).toFixed(2)}s ${url.slice(-70)}`, elapsed);
      return record;
    } catch (err) {
      this.failures.push({ url, kind, error: String(err) });
      this.byUrl.set(url, null);
      return null;
    }
  }

  /** Bytes that will actually be embedded (post-subset / post-re-encode). */
  async embeddedBytes(record) {
    const file = this.subsetFonts.get(record.file)
      ?? this.optimizedImages.get(record.file)
      ?? record.file;
    const stat = await fs.stat(file);
    return { file, bytes: stat.size };
  }
}

// -------------------------------------------------------------------- css ---

const CSS_URL_RE = /url\(\s*(['"]?)([^)'"]+)\1\s*\)/g;
const CSS_IMPORT_RE = /@import\s+(?:url\(\s*(['"]?)([^)'"]+)\1\s*\)|(['"])([^'"]+)\3)\s*([^;]*);/g;

/** Inline @import chains, then hand back a single flattened stylesheet. */
async function flattenCss(css, cssUrl, store, seen = new Set()) {
  if (seen.has(cssUrl)) return '';
  seen.add(cssUrl);

  let out = css;
  const imports = [...css.matchAll(CSS_IMPORT_RE)];

  for (const m of imports) {
    const ref = m[2] ?? m[4];
    const resolved = resolveUrl(ref, cssUrl);
    if (!resolved) continue;
    let childCss;
    try {
      const record = await store.fetch(resolved, 'css');
      if (!record) continue;
      childCss = await fs.readFile(record.file, 'utf8');
    } catch {
      continue;
    }
    // @import may carry a media query: wrap the child so it keeps its condition.
    const media = (m[5] ?? '').trim();
    const flattened = await flattenCss(childCss, resolved, store, seen);
    out = out.replace(m[0], media ? `@media ${media} {\n${flattened}\n}` : flattened);
  }

  return out;
}

/**
 * Replace every url() in the stylesheet with a data URI, downloading fonts and
 * background images as needed.
 *
 * Fonts are returned un-inlined on purpose: subsetting has to happen before the
 * bytes are turned into a data URI, and that pass needs the whole document's glyph
 * set. `inlineFontCssUrls` does the font substitution afterwards.
 */
async function inlineCssUrls(css, cssUrl, store, opts) {
  const refs = [...css.matchAll(CSS_URL_RE)];
  const fontRecords = [];
  const replacements = new Map();

  for (const m of refs) {
    const ref = m[2];
    if (isDataUri(ref)) continue;
    const resolved = resolveUrl(ref, cssUrl);
    if (!resolved) continue;

    const ext = path.extname(new URL(resolved).pathname).toLowerCase();
    const isFont = ['.woff2', '.woff', '.ttf', '.otf'].includes(ext);
    const record = await store.fetch(resolved, isFont ? 'font' : 'image');
    if (!record) {
      warn(`  ! could not fetch ${resolved}`);
      continue;
    }

    if (isFont) {
      // defer: recorded now, inlined after subsetting
      fontRecords.push({ ...record, ref: m[0] });
      continue;
    }

    const { file, bytes } = await store.embeddedBytes(record);
    if (bytes > opts.maxInlineBytes) {
      warn(`  ! leaving ${path.basename(file)} external (${kb(bytes)} > limit)`);
      continue;
    }
    replacements.set(m[0], `url("${await toDataUri(file)}")`);
  }

  let result = css;
  for (const [from, to] of replacements) result = result.split(from).join(to);
  return { css: result, fontRecords };
}

/** Second pass: substitute font url() refs, after subsetting has run. */
async function inlineFontCssUrls(css, fontRecords, store, opts) {
  let out = css;
  for (const record of fontRecords) {
    const { file, bytes } = await store.embeddedBytes(record);
    if (bytes > opts.maxInlineBytes) {
      warn(`  ! leaving font external (${kb(bytes)} > limit): ${record.url}`);
      continue;
    }
    out = out.split(record.ref).join(`url("${await toDataUri(file)}")`);
  }
  return out;
}

function stripCssComments(css, patterns) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    patterns.some((p) => p.test(comment.trim())) ? '' : comment,
  );
}

// ------------------------------------------------------- font / image work ---

function runPython(script, args) {
  return new Promise((resolve) => {
    const py = process.env.PYTHON ?? 'python';
    const child = spawn(py, [path.join(HERE, script), ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', () => resolve({ code: -1, stdout, stderr }));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

/** Every glyph the page can show: text nodes plus attribute values like title/alt. */
function collectGlyphs(html) {
  const stripped = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  const attrs = [...html.matchAll(/\s(?:title|alt|aria-label|placeholder|value|content)="([^"]*)"/gi)]
    .map((m) => m[1]).join(' ');

  const chars = new Set();
  for (let c = 32; c < 127; c++) chars.add(String.fromCharCode(c));
  // CJK punctuation and symbols that sit next to copy without being in the text
  for (const c of '　、。〃々〈〉《》「」『』【】〔〕〖〗！？：；，．·—…‘’“”（）［］｛｝％＋－×÷→←↑↓°¥§±≥≤≠') chars.add(c);
  for (const c of stripped + ' ' + attrs) if (c.trim()) chars.add(c);

  return [...chars].sort().join('');
}

/**
 * Subset each font to the glyphs the page shows.
 *
 * Two layers of caching, because fontTools has to inflate the entire WOFF2
 * stream before it can reach any glyph — ~40s for a 4 MB CJK face, against
 * ~0.6s for the subsetting itself:
 *
 *   1. The final subset, keyed by font content + glyph set. Pages that render
 *      the same text reuse it outright (the common case when several pages share
 *      a nav and footer).
 *   2. The decompressed TTF, keyed by font content alone. Different glyph sets
 *      still skip the 40s inflate; font-subset.py subsets from the cached TTF.
 *
 * Without layer 2, every distinct glyph set costs a full decompression, which is
 * what made a page take ~130s.
 */
async function subsetFonts(fontRecords, glyphs, store, dirs) {
  const unique = [...new Map(fontRecords.map((r) => [r.file, r])).values()];
  if (!unique.length) return;

  const charsFile = path.join(dirs.build, 'glyphs.txt');
  await fs.writeFile(charsFile, glyphs, 'utf8');

  const cacheDir = path.join(dirs.root, 'cache/fonts');
  const ttfCacheDir = path.join(dirs.root, 'cache/fonts-ttf');
  await fs.mkdir(cacheDir, { recursive: true });
  const glyphHash = crypto.createHash('sha1').update(glyphs).digest('hex').slice(0, 12);

  // Split into cache hits and misses so only genuinely new work hits Python.
  const pending = [];
  let cachedCount = 0;
  for (const record of unique) {
    const fontHash = crypto.createHash('sha1')
      .update(await fs.readFile(record.file))
      .digest('hex')
      .slice(0, 12);
    const cached = path.join(cacheDir, `${fontHash}-${glyphHash}.woff2`);
    const target = path.join(dirs.fontSubset, path.basename(record.file));
    try {
      await fs.access(cached);
      await fs.mkdir(dirs.fontSubset, { recursive: true });
      await fs.copyFile(cached, target);
      store.subsetFonts.set(record.file, target);
      cachedCount += 1;
      continue;
    } catch {
      pending.push({ record, target, cached });
    }
  }
  if (cachedCount) log(`  font subsets: ${cachedCount}/${unique.length} from cache`);

  if (pending.length) {
    const res = await runPython('font-subset.py', [
      '--text-file', charsFile,
      '--out-dir', dirs.fontSubset,
      '--cache-dir', ttfCacheDir,
      ...pending.map(({ record }) => record.file),
    ]);

    if (res.code !== 0) {
      warn(`  ! font subsetting unavailable (${res.stderr.trim().split('\n')[0] || 'python/fonttools missing'})`);
      warn('    embedding original fonts instead — output will be much larger');
      return;
    }

    for (const { record, target, cached } of pending) {
      try {
        await fs.access(target);
      } catch {
        continue;
      }
      store.subsetFonts.set(record.file, target);
      // Store in the cache so the next page with the same glyph set is free.
      await fs.copyFile(target, cached).catch(() => {});
    }
  }

  let before = 0;
  let after = 0;
  for (const record of unique) {
    const subset = store.subsetFonts.get(record.file);
    if (!subset) continue;
    before += record.bytes;
    after += (await fs.stat(subset)).size;
  }
  if (before) log(`  fonts: ${kb(before)} -> ${kb(after)} (${unique.length} files, ${glyphs.length} glyphs)`);
}

async function optimizeImages(records, store, dirs) {
  const unique = [...new Map(records.map((r) => [r.file, r])).values()];
  if (!unique.length) return;

  const res = await runPython('image-optimize.py', [
    '--out-dir', dirs.imageOptimized,
    ...unique.map((r) => r.file),
  ]);
  if (res.code !== 0) {
    warn('  ! image optimization unavailable; embedding originals');
    return;
  }

  for (const line of res.stdout.trim().split('\n').filter(Boolean)) {
    let info;
    try {
      info = JSON.parse(line);
    } catch {
      continue;
    }
    if (info.webp_bytes < info.original_bytes) {
      store.optimizedImages.set(info.src, info.webp);
    }
  }
}

// ------------------------------------------------------------------- html ---

function stripScripts(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '');
}

/**
 * Inline scripts in <head> that are worth keeping.
 *
 * Most head scripts are framework bootstrapping (RSC payload, hydration glue) and
 * must go. A small pre-paint script, though, often sets a theme attribute before
 * first paint precisely to avoid a flash — dropping it would be a visible
 * regression. So keep short inline scripts that carry no runtime markers.
 */
const RUNTIME_MARKERS = /__next|__NUXT|__NUXT__|webpack|hydrat|React|createRoot|__vite|astro-island/i;

function extractHeadInlineScripts(headInner, { keepScripts = false } = {}) {
  const kept = [];
  for (const m of headInner.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1];
    const code = m[2];
    if (/\bsrc=/i.test(attrs)) continue; // external bundle: always dropped
    if (keepScripts) {
      kept.push(m[0]);
      continue;
    }
    if (!code.trim()) continue;
    if (RUNTIME_MARKERS.test(code)) continue;
    if (code.length > 4096) continue; // inline payload, not a bootstrap snippet
    kept.push(`<script>${code}</script>`);
  }
  return kept;
}

function stripNextRuntimeHints(html) {
  return html
    // React/Next comment markers mean nothing without the runtime
    .replace(/<!--\$-->/g, '')
    .replace(/<!--\/\$-->/g, '')
    .replace(/<!--\s*-->/g, '')
    // preload/modulepreload for scripts we just removed
    .replace(/<link\b[^>]*\brel="(?:preload|modulepreload|prefetch)"[^>]*>/gi, '');
}

/**
 * Collect every <img> source and download it.
 *
 * Kept separate from embedding so the optimization pass can run in between:
 * embedding first would lock in the original encoding.
 */
async function collectHtmlImages(html, pageUrl, store) {
  const images = [];
  const seen = new Set();

  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const srcMatch = m[0].match(/\bsrc="([^"]+)"/i);
    if (!srcMatch) continue;
    const resolved = resolveUrl(srcMatch[1], pageUrl);
    if (!resolved) continue;
    const record = await store.fetch(resolved, 'image');
    if (!record) {
      warn(`  ! could not fetch image ${resolved}`);
      continue;
    }
    if (!seen.has(resolved)) {
      seen.add(resolved);
      images.push(record);
    }
  }

  return images;
}

/** Swap every <img src> that points at a downloaded asset for a data URI. */
async function applyHtmlImages(html, pageUrl, store, opts) {
  const replacements = new Map();

  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const srcMatch = tag.match(/\bsrc="([^"]+)"/i);
    if (!srcMatch) continue;
    const resolved = resolveUrl(srcMatch[1], pageUrl);
    if (!resolved) continue;
    const record = store.byUrl.get(resolved);
    if (!record) continue;

    const { file, bytes } = await store.embeddedBytes(record);
    if (bytes > opts.maxInlineBytes) {
      warn(`  ! leaving image external (${kb(bytes)} > limit): ${resolved}`);
      continue;
    }
    replacements.set(tag, tag.replace(srcMatch[0], `src="${await toDataUri(file)}"`));
  }

  let out = html;
  for (const [from, to] of replacements) out = out.split(from).join(to);
  return out;
}

async function inlineFavicons(html, pageUrl, store, opts) {
  const tags = [...html.matchAll(/<link\b[^>]*\brel="[^"]*icon[^"]*"[^>]*>/gi)];
  let out = html;
  for (const m of tags) {
    const tag = m[0];
    const hrefMatch = tag.match(/\bhref="([^"]+)"/i);
    if (!hrefMatch) continue;
    const resolved = resolveUrl(hrefMatch[1], pageUrl);
    if (!resolved) continue;
    const record = await store.fetch(resolved, 'image');
    if (!record) continue;
    const { file } = await store.embeddedBytes(record);
    out = out.split(tag).join(tag.replace(hrefMatch[0], `href="${await toDataUri(file)}"`));
  }
  return out;
}

function dropDeadMetadata(html) {
  return html
    .replace(/<meta\b[^>]*(?:property|name)="(?:og:image|twitter:image|og:url|og:image:width|og:image:height|twitter:image:width|twitter:image:height)"[^>]*>/gi, '')
    .replace(/<meta\b[^>]*http-equiv="(?:content-security-policy|x-frame-options)"[^>]*>/gi, '');
}

// -------------------------------------------------------------- assemble ----

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const dirs = {
    root: path.resolve(opts.workdir),
    cache: path.resolve(opts.workdir, 'cache'),
    css: path.resolve(opts.workdir, 'assets/css'),
    fonts: path.resolve(opts.workdir, 'assets/fonts'),
    fontSubset: path.resolve(opts.workdir, 'assets/fonts-subset'),
    images: path.resolve(opts.workdir, 'assets/images'),
    imageOptimized: path.resolve(opts.workdir, 'assets/images-webp'),
    build: path.resolve(opts.workdir, 'build'),
  };
  for (const d of Object.values(dirs)) await fs.mkdir(d, { recursive: true });

  // Proxy: explicit flag wins, otherwise fall back to the conventional env vars
  // so a machine-wide setting is picked up without repeating it on every call.
  await configureProxy(
    opts.proxy ?? process.env.HTTPS_PROXY ?? process.env.https_proxy
      ?? process.env.HTTP_PROXY ?? process.env.http_proxy ?? null,
  );

  log(`fetching ${opts.url}`);
  const rawHtml = await fetchText(opts.url, opts);
  await fs.writeFile(path.join(dirs.build, 'raw.html'), rawHtml, 'utf8');
  log(`  ${kb(Buffer.byteLength(rawHtml))}`);
  mark('page fetch');

  const store = new AssetStore(opts, dirs);

  // --- 1. stylesheets ------------------------------------------------------
  const sheetLinks = [...rawHtml.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*>/gi)].map((m) => m[0]);
  log(`stylesheets: ${sheetLinks.length}`);

  let css = '';
  const fontRecords = [];
  for (const tag of sheetLinks) {
    const hrefMatch = tag.match(/\bhref="([^"]+)"/i);
    const resolved = hrefMatch && resolveUrl(hrefMatch[1], opts.baseUrl);
    if (!resolved) continue;
    const record = await store.fetch(resolved, 'css');
    if (!record) {
      warn(`  ! could not fetch stylesheet ${resolved}`);
      continue;
    }
    const text = await fs.readFile(record.file, 'utf8');
    log(`  ${path.basename(record.file)} ${kb(text.length)}`);

    // Flatten and inline each sheet against its OWN url: a stylesheet's relative
    // url() refs resolve from the stylesheet location, not from the page.
    const flat = await flattenCss(text, resolved, store);
    const { css: inlined, fontRecords: fonts } = await inlineCssUrls(flat, resolved, store, opts);
    css += `\n/* ${resolved} */\n${inlined}`;
    fontRecords.push(...fonts);
  }

  // --- 2. subset fonts, then inline them -----------------------------------
  mark('stylesheets');
  if (opts.subsetFonts && fontRecords.length) {
    log('subsetting fonts');
    await subsetFonts(fontRecords, collectGlyphs(rawHtml), store, dirs);
    mark('font subsetting');
  }
  if (fontRecords.length) {
    log('inlining fonts');
    css = await inlineFontCssUrls(css, fontRecords, store, opts);
    mark('font inlining');
  }

  // --- 4. html rewriting ---------------------------------------------------
  const headStart = rawHtml.search(/<head\b[^>]*>/i);
  const headEnd = rawHtml.search(/<\/head>/i);
  const headInner = headStart >= 0 && headEnd > headStart
    ? rawHtml.slice(rawHtml.indexOf('>', headStart) + 1, headEnd)
    : '';

  const bodyOpenMatch = rawHtml.match(/<body\b[^>]*>/i);
  const bodyOpen = bodyOpenMatch ? bodyOpenMatch[0] : '<body>';
  const bodyStart = bodyOpenMatch ? rawHtml.indexOf(bodyOpenMatch[0]) + bodyOpenMatch[0].length : 0;
  const bodyEnd = rawHtml.lastIndexOf('</body>');
  let body = rawHtml.slice(bodyStart, bodyEnd > bodyStart ? bodyEnd : rawHtml.length);

  body = opts.keepScripts ? body : stripScripts(body);
  body = stripNextRuntimeHints(body);

  const htmlOpenTag = (rawHtml.match(/<html\b[^>]*>/i) ?? ['<html>'])[0];

  // metadata: everything in <head> that is not a stylesheet/preload script link
  const headTags = headInner.match(/<(?:meta|title|link)\b[^>]*>[^<]*(?:<\/title>)?/gi) ?? [];
  const keptHead = headTags.filter((tag) => {
    if (!tag.startsWith('<link')) return true;
    if (/rel="stylesheet"/i.test(tag)) return false;
    if (/rel="(?:preload|modulepreload|prefetch)"/i.test(tag)) return false;
    return /rel="[^"]*icon[^"]*"/i.test(tag);
  });

  log('downloading images');
  const images = opts.inlineImages ? await collectHtmlImages(body, opts.baseUrl, store) : [];
  mark(`image downloads (${images.length})`);

  if (opts.optimizeImages && images.length) {
    log('optimizing images');
    await optimizeImages(images, store, dirs);
    if (store.optimizedImages.size) log(`  ${store.optimizedImages.size} re-encoded smaller`);
    mark('image optimization');
  }

  if (opts.inlineImages) {
    log('inlining images');
    body = await applyHtmlImages(body, opts.baseUrl, store, opts);
    mark('image inlining');
  }

  let headHtml = keptHead.join('\n');
  const headScripts = extractHeadInlineScripts(headInner, { keepScripts: opts.keepScripts });
  if (headScripts.length) {
    log(`  kept ${headScripts.length} pre-paint inline script(s) from <head>`);
    headHtml += '\n' + headScripts.join('\n');
  }
  headHtml = await inlineFavicons(headHtml, opts.baseUrl, store, opts);
  if (opts.dropOgImages) headHtml = dropDeadMetadata(headHtml);

  css = stripCssComments(css, opts.stripCssComments);

  for (const file of opts.injectCss) css += `\n/* injected: ${file} */\n` + await fs.readFile(file, 'utf8');

  // --- 5. assemble ---------------------------------------------------------
  const doc = [
    '<!DOCTYPE html>',
    htmlOpenTag,
    '<head>',
    headHtml,
    '<style>',
    css,
    '</style>',
    '</head>',
    bodyOpen,
    body,
    ...(await Promise.all(opts.injectJs.map(async (f) => `<script>\n${await fs.readFile(f, 'utf8')}\n</script>`))),
    '</body>',
    '</html>',
    '',
  ].join('\n');

  await fs.mkdir(path.dirname(path.resolve(opts.out)), { recursive: true });
  await fs.writeFile(opts.out, doc, 'utf8');
  mark('assemble + write');

  // --- 6. verify -----------------------------------------------------------
  const report = verify(doc, css, body);
  mark('self-check');

  log('');
  log(`written ${opts.out}`);
  log(`  size            ${kb(Buffer.byteLength(doc))}`);
  log(`  stylesheets     ${sheetLinks.length} -> inlined`);
  log(`  images          ${images.length} inlined`);
  log(`  fonts           ${store.subsetFonts.size} subset`);
  log(`  external refs   ${report.externalRefs.length}`);
  log(`  scripts left    ${report.scriptSrcs.length}`);
  log(`  unstyled class  ${report.missingClasses.length}`);

  if (report.externalRefs.length) {
    warn('\nexternal references that will not resolve from file://:');
    for (const r of report.externalRefs.slice(0, 20)) warn(`  ${r}`);
  }
  if (report.missingClasses.length) {
    warn('\nclasses in markup with no CSS rule (styling may be missing):');
    for (const c of report.missingClasses.slice(0, 30)) warn(`  .${c}`);
  }
  if (store.failures.length) {
    warn('\nassets that failed to download:');
    for (const f of store.failures) warn(`  ${f.kind} ${f.url} — ${f.error}`);
  }

  await fs.writeFile(
    path.join(dirs.build, 'report.json'),
    JSON.stringify({ ...report, failures: store.failures, size: Buffer.byteLength(doc) }, null, 2),
    'utf8',
  );

  process.exitCode = report.externalRefs.length ? 0 : 0; // refs are reported, not fatal
  dumpTimings();
}

/** Post-build sanity checks; each one caught a real bug while building this. */
function verify(doc, css, body) {
  // Only subresource references matter. <a href> is a navigation link: it cannot
  // resolve from file:// either, but that is expected and not a rendering fault.
  const externalRefs = [];
  for (const m of doc.matchAll(/<(?:img|script|source|video|audio|iframe|link)\b[^>]*?\b(?:src|href)="((?!data:|#)[^"]+)"/gi)) {
    if (!isAbsolute(m[1])) externalRefs.push(m[1]);
  }
  for (const m of doc.matchAll(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi)) {
    if (!isDataUri(m[2])) externalRefs.push(`url(${m[2]})`);
  }

  const scriptSrcs = [...doc.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/gi)].map((m) => m[1]);
  const anchorCount = [...body.matchAll(/<a\b[^>]*\bhref="(?!data:|#)/gi)].length;

  // Tailwind escapes special characters in selectors (.sm\:gap-3), so unescape
  // before testing membership or every utility class looks missing.
  const unescapedCss = css.replace(/\\(.)/g, '$1');
  const classes = new Set();
  for (const m of body.matchAll(/\sclass="([^"]*)"/g)) {
    for (const c of m[1].split(/\s+/)) if (c) classes.add(c);
  }
  const missingClasses = [];
  for (const c of classes) {
    const escaped = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(`\\.${escaped}(?![\\w-])`).test(unescapedCss)) missingClasses.push(c);
  }

  return {
    externalRefs: [...new Set(externalRefs)],
    scriptSrcs,
    missingClasses,
    classCount: classes.size,
    anchorCount,
  };
}

main().catch((err) => {
  fail(err?.stack ?? String(err));
});
