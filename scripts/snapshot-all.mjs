#!/usr/bin/env node
/**
 * Snapshot every page in the UI-walkthrough set into one self-contained HTML
 * file each.
 *
 *   node scripts/snapshot-all.mjs [--only <name>] [--no-verify]
 *
 * Runs scripts/html-snapshot.mjs once per page so a failure is isolated to one
 * output, and each run gets its own cache/work dir. Auth-gated pages are fetched
 * with the cookie for the user that page belongs to (see tokens.json, written by
 * snapshot-seed.mjs).
 *
 * Two things are checked beyond the per-page self-containment report, because
 * both fail silently:
 *
 *   - a login redirect: an expired cookie makes /founder/dashboard return the
 *     login page with HTTP 200, so the snapshot looks plausible but is wrong
 *   - an empty state: a missing seed makes /talents render "no results", which
 *     is a valid page but tells a reviewer nothing
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT_DIR = path.join(ROOT, '.scratch/snapshot')
// One work dir for the whole run, not one per page: AssetStore keys its cache
// by URL, so a shared dir means the fonts and cover images every page pulls are
// downloaded once instead of once per page. That is the difference between a
// ~15s and a ~2min page.
const WORK_DIR = path.join(OUT_DIR, 'work')
const SNAPSHOT_SCRIPT = path.join(ROOT, 'scripts/html-snapshot.mjs')
const TOKENS_FILE = path.join(OUT_DIR, 'tokens.json')

const BASE_URL = process.env.SNAPSHOT_BASE_URL ?? 'http://localhost:3000'

/**
 * Proxy for asset downloads. The pages themselves are local, but their images
 * and fonts come from external hosts, which on a restricted network stall until
 * the per-request timeout. Falls back to the conventional env vars.
 */
const PROXY =
  process.env.SNAPSHOT_PROXY
  ?? process.env.HTTPS_PROXY ?? process.env.https_proxy
  ?? process.env.HTTP_PROXY ?? process.env.http_proxy
  ?? null

/**
 * A full Cookie header to use for every page instead of the per-user tokens.
 *
 * Lets you snapshot the gated pages with a cookie copied from a real browser
 * session, without running the seeder or minting tokens.
 */
const COOKIE_OVERRIDE = process.env.SNAPSHOT_COOKIE ?? null

/**
 * The walkthrough set, in the order a reviewer should read them.
 *
 * `user` picks the cookie: the seeded founder owns the projects, submit and
 * talent pages; 4652 owns project 28 and the follow row behind /following.
 * `expect` is text that must appear in the captured markup — a page that
 * renders an empty state or a login form instead is a failure, not a snapshot.
 */
const PAGES = [
  { name: '01-home', path: '/', title: '首页' },
  { name: '02-project-detail', path: '/projects/1', title: '项目详情', expect: '月事轻记' },
  // The page header alone proves nothing: it renders even when the form below
  // is replaced by the login prompt. '项目速览' is the first section heading of
  // the form itself, so it only appears when the real form was captured.
  { name: '03-submit', path: '/submit', title: '项目提交', user: '1', expect: '项目速览' },
  { name: '04-talents', path: '/talents', title: '人才广场', expect: '林一舟' },
  // The editor has two headings (with/without an existing profile), so the
  // stable marker is the eyebrow above them.
  { name: '05-talent-edit', path: '/talents/me/edit', title: '编辑个人档案', user: '1', expect: 'PROFILE / SIGNAL BUILDER' },
  { name: '06-hackathon', path: '/hackathon', title: '黑客松专区', expect: '潮汐日记' },
  { name: '07-hackathon-project', path: '/hackathon/projects/1', title: '黑客松项目详情', expect: '潮汐日记' },
  { name: '08-connections', path: '/connections', title: '连接记录', user: '1', expect: '苏晚' },
  { name: '09-founder-dashboard', path: '/founder/dashboard', title: '创始人后台', user: '4652', expect: '创始人后台' },
  { name: '10-founder-project', path: '/founder/projects/28', title: '后台查看项目', user: '4652', expect: 'testtest' },
  { name: '11-following', path: '/following', title: '关注页面', user: '4652', expect: '月事轻记' },
]

/** Markers that mean Next.js served the login page instead of the target. */
const LOGIN_MARKERS = ['AUTH / LOGIN', '发送验证码']

// ------------------------------------------------------------------ helpers ---

function parseArgs(argv) {
  const opts = { only: [], verify: true, quiet: false, verbose: false }
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--only': opts.only.push(argv[++i]); break
      case '--no-verify': opts.verify = false; break
      case '--quiet': opts.quiet = true; break
      case '--verbose': opts.verbose = true; break
      case '--help':
      case '-h':
        console.log(`Usage: node scripts/snapshot-all.mjs [options]

  --only <name>     snapshot only this page (repeatable; matches name or path)
  --no-verify       skip the headless-Chrome screenshot pass
  --quiet           print only the summary
  --verbose         stream each page's per-phase timings`)
        process.exit(0)
        break
      default:
        if (argv[i].startsWith('--')) {
          console.error(`error: unknown option ${argv[i]}`)
          process.exit(1)
        }
    }
  }
  return opts
}

function run(command, args, { capture = true } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (d) => { stdout += d })
    child.stderr?.on('data', (d) => { stderr += d })
    child.on('error', (err) => resolve({ code: -1, stdout, stderr: stderr + String(err) }))
    child.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

/** Pull the self-check numbers out of html-snapshot.mjs's report. */
function parseReport(stdout) {
  const num = (label) => {
    const m = stdout.match(new RegExp(`^\\s*${label}\\s+(\\d+)`, 'm'))
    return m ? Number(m[1]) : null
  }
  return {
    size: (stdout.match(/^\s*size\s+([\d.]+ KB)/m) ?? [])[1] ?? null,
    externalRefs: num('external refs'),
    scriptSrcs: num('scripts left'),
    missingClasses: num('unstyled class'),
  }
}

// --------------------------------------------------------------------- main ---

async function main() {
  const opts = parseArgs(process.argv.slice(2))

  let tokens = {}
  try {
    tokens = JSON.parse(await fs.readFile(TOKENS_FILE, 'utf8'))
  } catch {
    // Public pages need no token, so a missing file only breaks gated pages —
    // report it when one of those is actually selected.
  }

  const selected = PAGES.filter((page) => {
    if (!opts.only.length) return true
    return opts.only.some((want) => want === page.name || want === page.path)
  })
  if (!selected.length) {
    console.error(`error: --only matched no page. Known names:\n  ${PAGES.map((p) => p.name).join('\n  ')}`)
    process.exit(1)
  }

  // Fail fast when the dev server is down: otherwise every page reports the same
  // opaque fetch error after a retry cycle.
  try {
    const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  } catch (err) {
    console.error(`error: ${BASE_URL} is not responding (${err.message})`)
    console.error('start it first: bun run dev:web')
    process.exit(1)
  }

  await fs.mkdir(OUT_DIR, { recursive: true })
  const results = []

  for (const page of selected) {
    const outFile = path.join(OUT_DIR, `${page.name}.html`)
    const label = `${page.name.padEnd(22)} ${page.path}`

    // An explicit cookie wins over the minted per-user token, so a real browser
    // session can drive every page. The override is already a full Cookie
    // header; tokens.json holds bare JWT values.
    const cookieHeader = COOKIE_OVERRIDE
      ?? (page.user && tokens[page.user] ? `shenicest_token=${tokens[page.user]}` : null)
    if (!COOKIE_OVERRIDE && page.user && !cookieHeader) {
      console.log(`${label}  SKIP (no token for user ${page.user}; run snapshot-seed.mjs)`)
      results.push({ page, status: 'skip', reason: `no token for user ${page.user}` })
      continue
    }

    if (!opts.quiet) console.log(`${label}  ...`)
    const pageStart = performance.now()

    const args = [
      SNAPSHOT_SCRIPT,
      '--url', `${BASE_URL}${page.path}`,
      '--out', outFile,
      '--workdir', WORK_DIR,
    ]
    if (cookieHeader) args.push('--cookie', cookieHeader)
    if (PROXY) args.push('--proxy', PROXY)
    if (opts.verbose) args.push('--verbose')

    const run1 = await run(process.execPath, args)
    if (run1.code !== 0) {
      const detail = (run1.stderr || run1.stdout).trim().split('\n').slice(-4).join('\n    ')
      console.log(`${label}  FAIL (snapshot exited ${run1.code})\n    ${detail}`)
      results.push({ page, status: 'fail', reason: 'snapshot script failed' })
      continue
    }

    const seconds = (performance.now() - pageStart) / 1000
    const report = parseReport(run1.stdout)
    const html = await fs.readFile(outFile, 'utf8')

    const problems = []
    if (report.externalRefs) problems.push(`${report.externalRefs} external ref(s)`)
    if (report.scriptSrcs) problems.push(`${report.scriptSrcs} script src(s)`)
    if (report.missingClasses) problems.push(`${report.missingClasses} unstyled class(es)`)

    // A login page here means the cookie was rejected: the snapshot is a valid
    // file but the wrong page, which is worse than a hard failure.
    if (page.user && LOGIN_MARKERS.some((marker) => html.includes(marker))) {
      problems.push('rendered the LOGIN page (cookie rejected?)')
    }
    if (page.expect && !html.includes(page.expect)) {
      problems.push(`missing expected text "${page.expect}" (empty state?)`)
    }

    const status = problems.length ? 'warn' : 'ok'
    const summary = problems.length
      ? `WARN  ${problems.join(', ')}`
      : `ok    ${report.size ?? '?'}`
    console.log(`${label}  ${summary}  (${seconds.toFixed(1)}s)`)
    results.push({ page, status, problems, report, outFile, seconds })
  }

  // Screenshot pass: the structural checks cannot see a font fallback or a
  // broken cover, so render each file and count images that failed to decode.
  if (opts.verify) {
    const ok = results.filter((r) => r.status === 'ok' || r.status === 'warn')
    if (ok.length) {
      if (!opts.quiet) console.log('\nverifying with headless Chrome')
      for (const result of ok) {
        const png = result.outFile.replace(/\.html$/, '-1440.png')
        const shot = await run(process.env.PYTHON ?? 'python', [
          path.join(ROOT, 'scripts/snapshot-shot.py'),
          result.outFile, png, '1440', '1200',
        ])
        if (shot.code !== 0) {
          console.log(`  ${result.page.name.padEnd(22)} SKIP (${(shot.stderr || shot.stdout).trim().split('\n').pop()})`)
          result.verify = 'skipped'
          continue
        }
        try {
          const info = JSON.parse(shot.stdout)
          const broken = info.info?.broken ?? 0
          const height = info.info?.h ?? 0
          result.verify = broken ? `${broken} broken image(s)` : 'ok'
          if (broken) result.problems = [...(result.problems ?? []), `${broken} broken image(s)`]
          console.log(`  ${result.page.name.padEnd(22)} ${broken ? `WARN ${broken} broken image(s)` : `ok    ${height}px tall`}`)
        } catch {
          result.verify = 'unparsed'
          console.log(`  ${result.page.name.padEnd(22)} WARN could not parse screenshot report`)
        }
      }
    }
  }

  // ------------------------------------------------------------------ summary ---
  const count = (s) => results.filter((r) => r.status === s).length
  const totalSeconds = results.reduce((sum, r) => sum + (r.seconds ?? 0), 0)
  console.log(`\n${results.length} page(s): ${count('ok')} ok, ${count('warn')} warn, ${count('fail')} fail, ${count('skip')} skip`)
  console.log(`time:   ${totalSeconds.toFixed(1)}s total`)
  console.log(`output: ${path.relative(ROOT, OUT_DIR)}`)

  // Per-page timings, slowest first: the useful signal when a run drags is
  // which page, not which phase.
  const timed = results.filter((r) => r.seconds).sort((a, b) => b.seconds - a.seconds)
  if (timed.length > 1) {
    console.log('\nslowest pages:')
    for (const r of timed.slice(0, 5)) {
      console.log(`  ${r.page.name.padEnd(22)} ${r.seconds.toFixed(1)}s`)
    }
  }

  const bad = results.filter((r) => r.status === 'fail' || r.status === 'warn' || r.status === 'skip')
  if (bad.length) {
    console.log('\nneeds attention:')
    for (const r of bad) {
      console.log(`  ${r.page.name.padEnd(22)} ${r.reason ?? r.problems?.join(', ')}`)
    }
  }

  process.exitCode = results.some((r) => r.status === 'fail') ? 1 : 0
}

main().catch((err) => {
  console.error(`error: ${err?.stack ?? err}`)
  process.exit(1)
})
