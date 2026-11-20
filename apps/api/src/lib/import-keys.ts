import { createHash, timingSafeEqual } from 'node:crypto'

// External-import API keys. One secret per source, configured as a JSON map:
//
//   IMPORT_API_KEYS={"榜单A":"<secret-1>","黑客松":"<secret-2>"}
//
// The key in the map is the source name (also the `source_name` the importer
// sends), the value is the secret they present in the `X-Api-Key` header.
// Absent/empty means the import endpoint is effectively disabled (every request
// fails auth) — fail closed rather than crashing unrelated deployments.
const RAW = process.env.IMPORT_API_KEYS

let keys: Record<string, string> = {}
if (RAW && RAW.trim() !== '') {
  try {
    const parsed = JSON.parse(RAW) as unknown
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('IMPORT_API_KEYS must be a JSON object mapping source_name to secret')
    }
    for (const [sourceName, secret] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof secret !== 'string' || secret.length === 0) {
        throw new Error(`IMPORT_API_KEYS source "${sourceName}" must map to a non-empty secret string`)
      }
    }
    keys = parsed as Record<string, string>
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('IMPORT_API_KEYS is not valid JSON')
    throw error
  }
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest()
}

// Constant-time comparison (hashed first so length differences don't leak).
function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b))
}

// Returns the source name bound to `provided`, or null when no key matches.
export function sourceNameForKey(provided: string): string | null {
  for (const [sourceName, secret] of Object.entries(keys)) {
    if (safeEqual(provided, secret)) return sourceName
  }
  return null
}
