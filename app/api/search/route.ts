import { NextResponse } from "next/server"
import * as cheerio from "cheerio"

type SunbizResult = {
  name: string
  status?: string
  documentNumber?: string
  url?: string
}

// Simple in-memory cache with TTL and a crude size cap
type CacheEntry = { value: SunbizResult[]; expiresAt: number }
const CACHE = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const CACHE_MAX_ENTRIES = 200

function getCache(key: string): SunbizResult[] | null {
  const hit = CACHE.get(key)
  if (!hit) return null
  if (Date.now() > hit.expiresAt) {
    CACHE.delete(key)
    return null
  }
  return hit.value
}

function setCache(key: string, value: SunbizResult[]) {
  if (CACHE.size >= CACHE_MAX_ENTRIES) {
    // Evict oldest entry (Map preserves insertion order)
    const oldestKey = CACHE.keys().next().value
    if (oldestKey) CACHE.delete(oldestKey)
  }
  CACHE.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
}

function normalizeQuery(q: string) {
  return q.trim().toLowerCase()
}

// Parse Sunbiz HTML search results
function parseSunbiz(html: string, baseUrl: string): SunbizResult[] {
  const $ = cheerio.load(html)
  const results: SunbizResult[] = []

  // The Sunbiz search results are typically presented in a table of rows.
  // We'll parse table rows and extract entity name (anchor), document number, and status.
  $("table tbody tr").each((_, tr) => {
    const tds = $(tr).find("td")
    if (tds.length === 0) return

    const nameAnchor = $(tds[0]).find("a").first()
    const name = nameAnchor.text().trim()
    if (!name) return

    const href = nameAnchor.attr("href")
    const documentNumber = (tds.get(1) ? $(tds[1]).text().trim() : undefined) || undefined

    // Try to find a cell that looks like a status (Active/Inactive/etc.)
    let status: string | undefined
    for (let i = 0; i < tds.length; i++) {
      const txt = $(tds[i]).text().trim()
      if (/active|inactive|inact|in active|status/i.test(txt)) {
        status = txt
        break
      }
    }
    const url = href ? new URL(href, baseUrl).toString() : undefined

    results.push({ name, status, documentNumber, url })
  })

  // Fallback: if no rows parsed, try anchors that look like detail links
  if (results.length === 0) {
    $('a[href*="SearchResultDetail"]').each((_, a) => {
      const name = $(a).text().trim()
      const href = $(a).attr("href")
      if (name && href) {
        results.push({ name, url: new URL(href, baseUrl).toString() })
      }
    })
  }

  return results
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get("q") || ""
    const limit = Math.max(1, Math.min(10, Number(searchParams.get("limit") || 7)))

    const cleaned = normalizeQuery(q)
    if (cleaned.length < 2) {
      return NextResponse.json({ error: "Query must be at least 2 characters." }, { status: 400 })
    }

    const cacheKey = `${cleaned}:${limit}`
    const cached = getCache(cacheKey)
    if (cached) {
      return NextResponse.json({ results: cached.slice(0, limit), fromCache: true })
    }

    // Sunbiz search endpoint (HTML). This may change; selectors are written defensively.
    // Example: https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults?inquiryType=EntityName&searchTerm=tesla
    const baseUrl = "https://search.sunbiz.org"
    const url = `${baseUrl}/Inquiry/CorporationSearch/SearchResults?inquiryType=EntityName&searchTerm=${encodeURIComponent(
      q,
    )}`

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    })

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch Sunbiz results.", status: res.status }, { status: 502 })
    }

    const html = await res.text()
    const parsed = parseSunbiz(html, baseUrl)
    const results = parsed.slice(0, limit)

    setCache(cacheKey, results)

    return NextResponse.json({ results })
  } catch (err: any) {
    return NextResponse.json(
      { error: "Unexpected error while searching Sunbiz.", details: err?.message || String(err) },
      { status: 500 },
    )
  }
}
