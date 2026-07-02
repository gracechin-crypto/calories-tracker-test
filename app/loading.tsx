export default function HomeLoading() {
  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-lg space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pt-4">
          <div className="h-8 w-44 animate-pulse rounded-lg bg-gray-200" />
          <div className="flex gap-4">
            <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-14 animate-pulse rounded bg-gray-200" />
          </div>
        </div>

        {/* Log card */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 h-9 w-full animate-pulse rounded-lg bg-gray-100" />
          <div className="mb-3 h-4 w-32 animate-pulse rounded bg-gray-200" />
          <div className="flex gap-2">
            <div className="h-9 flex-1 animate-pulse rounded-lg bg-gray-100" />
            <div className="h-9 w-16 animate-pulse rounded-lg bg-gray-200" />
          </div>
        </div>

        {/* Meals list */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 h-4 w-16 animate-pulse rounded bg-gray-200" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-5 w-full animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
