export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-lg space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pt-4">
          <div className="h-8 w-40 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
        </div>

        {/* Goal card */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 h-4 w-24 animate-pulse rounded bg-gray-200" />
          <div className="h-10 w-full animate-pulse rounded-lg bg-gray-100" />
        </div>

        {/* Today card */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 h-4 w-16 animate-pulse rounded bg-gray-200" />
          <div className="mb-3 h-9 w-36 animate-pulse rounded bg-gray-200" />
          <div className="mb-4 h-2.5 w-full animate-pulse rounded-full bg-gray-100" />
          <div className="flex gap-6">
            <div className="h-4 w-20 animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-20 animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-16 animate-pulse rounded bg-gray-100" />
          </div>
        </div>

        {/* 7-day chart card */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 h-4 w-24 animate-pulse rounded bg-gray-200" />
          <div className="flex h-24 items-end gap-1">
            {[40, 65, 30, 80, 55, 70, 45].map((h, i) => (
              <div key={i} className="flex-1 animate-pulse rounded-t bg-gray-100" style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className="mt-2 h-3 w-full animate-pulse rounded bg-gray-100" />
        </div>

        {/* Coach's notes card */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 h-4 w-28 animate-pulse rounded bg-gray-200" />
          <div className="space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-4/6 animate-pulse rounded bg-gray-100" />
          </div>
        </div>

        {/* Weekly insights card */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 h-4 w-32 animate-pulse rounded bg-gray-200" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
