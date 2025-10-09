"use client"

import { SunbizSearch } from "@/components/sunbiz-search"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Page() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-start px-4 py-10">
      {/* Search Card */}
      <section className="w-full max-w-4xl">
        <div className="rounded-2xl bg-muted/40 p-6 md:p-8">
          <Card className="border-primary/40 shadow-xl">
            <CardHeader className="text-center space-y-1">
              <div className="flex justify-center">
                <span className="inline-flex items-center rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                  Sunbiz live data
                </span>
              </div>
              <CardTitle className="text-3xl md:text-4xl text-balance text-primary">
                Get your Business Intelligence Report
              </CardTitle>
              <CardDescription className="text-pretty">
                Type at least 2 letters. Suggestions update in real time from sunbiz.org.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SunbizSearch
                limit={7}
                onSelect={(r) => {
                  // Optionally open the Sunbiz detail page in a new tab if available.
                  if (r.url) window.open(r.url, "_blank", "noopener,noreferrer")
                }}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                This demo fetches and parses results from the live Sunbiz website in real time.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  )
}
