"use client"

import type React from "react"
import useSWR from "swr"
import { useEffect, useMemo, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type SunbizResult = {
  name: string
  status?: string
  documentNumber?: string
  url?: string
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function useDebouncedValue<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

function getStatusChipClass(statusText: string) {
  const s = statusText.toLowerCase()
  if (s.includes("active")) return "bg-accent text-accent-foreground"
  if (s.includes("inactive") || s.includes("revoked") || s.includes("involuntary"))
    return "bg-destructive text-primary-foreground"
  return "bg-muted text-muted-foreground"
}

export function SunbizSearch({
  limit = 7,
  placeholder = "Search Florida business names…",
  onSelect,
}: {
  limit?: number
  placeholder?: string
  onSelect?: (result: SunbizResult) => void
}) {
  const [query, setQuery] = useState("")
  const debounced = useDebouncedValue(query, 200)
  const shouldSearch = debounced.trim().length >= 2

  const { data, isLoading, error } = useSWR<{ results?: SunbizResult[]; fromCache?: boolean }>(
    shouldSearch ? `/api/search?q=${encodeURIComponent(debounced)}&limit=${limit}` : null,
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true },
  )

  const results = useMemo(() => data?.results ?? [], [data])
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setOpen(shouldSearch && (isLoading || (results && results.length > 0)))
    setHighlighted(0)
  }, [shouldSearch, isLoading, results])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  function handleSelect(item: SunbizResult) {
    setQuery(item.name)
    setOpen(false)
    onSelect?.(item)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || !results.length) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlighted((h) => (h + 1) % results.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlighted((h) => (h - 1 + results.length) % results.length)
    } else if (e.key === "Enter") {
      e.preventDefault()
      const item = results[highlighted]
      if (item) handleSelect(item)
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto" ref={containerRef}>
      <label htmlFor="sunbiz-search" className="sr-only">
        Company search
      </label>

      <Input
        id="sunbiz-search"
        type="search"
        placeholder={placeholder}
        aria-label="Search for a registered Florida company"
        title="Search for a registered Florida company"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => shouldSearch && setOpen(true)}
        onKeyDown={onKeyDown}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="sunbiz-suggestions"
        className="w-full h-14 text-lg placeholder:text-muted-foreground/70 border-2 border-primary/30 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      />

      {open && (
        <div
          id="sunbiz-suggestions"
          role="listbox"
          aria-label="Search results"
          className={cn(
            "mt-2 rounded-lg border-2 border-primary/30 bg-popover/95 text-popover-foreground shadow-lg supports-[backdrop-filter]:bg-popover/80 backdrop-blur",
            "w-full overflow-hidden"
          )}
        >
          {isLoading ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">Searching…</div>
          ) : error ? (
            <div className="px-3 py-2 text-sm text-destructive-foreground">Error fetching results</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">No results found</div>
          ) : (
            <ul className="max-h-96 overflow-auto" role="presentation">
              {results.map((item, idx) => {
                const statusText = (item.status || "").trim()
                return (
                  <li
                    key={`${item.documentNumber ?? item.url ?? item.name}-${idx}`}
                    role="option"
                    aria-selected={(highlighted === idx).toString()} // ✅ fixed and warning-free
                    tabIndex={-1}
                    className={cn(
                      "cursor-pointer px-4 py-3 text-base outline-none",
                      highlighted === idx
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-primary/10"
                    )}
                    onMouseEnter={() => setHighlighted(idx)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(item)}
                  >
                    <div className="font-medium text-pretty">{item.name}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      {statusText && (
                        <span
                          className={cn(
                            "inline-flex items-center rounded px-1.5 py-0.5",
                            getStatusChipClass(statusText)
                          )}
                        >
                          {statusText}
                        </span>
                      )}
                      {item.documentNumber && (
                        <span className="text-muted-foreground/80">
                          Doc #{item.documentNumber}
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {results.length > 0 && (
            <div className="px-3 py-2 border-t text-xs text-muted-foreground">
              Results powered by sunbiz.org
            </div>
          )}
        </div>
      )}
    </div>
  )
}
