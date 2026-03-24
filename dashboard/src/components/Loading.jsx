import React from 'react'

function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="animate-pulse space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-neutral-200 rounded-lg" />
          <div className="space-y-2">
            <div className="h-5 w-48 bg-neutral-200 rounded" />
            <div className="h-3 w-72 bg-neutral-200 rounded" />
          </div>
        </div>

        {/* Tabs skeleton */}
        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 w-32 bg-neutral-200 rounded-lg" />
          ))}
        </div>

        {/* KPI cards skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 bg-neutral-200 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-20 bg-neutral-200 rounded" />
                  <div className="h-7 w-16 bg-neutral-200 rounded" />
                  <div className="h-3 w-24 bg-neutral-200 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Chart skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card h-80 bg-neutral-100 rounded-xl" />
          <div className="card h-80 bg-neutral-100 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

export default Loading
