'use client'

import { useState } from 'react'
import type { Project } from '@/server/projects'
import { ProjectCard } from '@/components/project-card'

const BATCH_SIZE = 4

export function FeaturedSection({ projects }: { projects: Project[] }) {
  const [batch, setBatch] = useState(0)

  if (projects.length === 0) return null

  const batchCount = Math.max(1, Math.ceil(projects.length / BATCH_SIZE))
  const currentBatch = batch % batchCount
  const start = (currentBatch * BATCH_SIZE) % projects.length
  const size = Math.min(BATCH_SIZE, projects.length)
  // Wrap around the configured order so every batch shows `size` cards. With
  // more than four configured entries the batches overlap rather than leaving
  // a short final row.
  const visible = Array.from(
    { length: size },
    (_, index) => projects[(start + index) % projects.length]
  )
  const canRotate = projects.length > BATCH_SIZE

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-16 sm:px-6 sm:pt-20">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">FEATURED / 01</p>
          <h2 className="mt-2 text-[clamp(28px,3vw,40px)] font-bold leading-[1.15]">
            精选项目
          </h2>
        </div>
        <div className="flex flex-col items-start gap-3 pb-1 sm:items-end">
          <p className="max-w-[520px] text-base text-muted-foreground">
            平台希望你优先关注的优质项目
          </p>
          {canRotate ? (
            <button
              type="button"
              onClick={() => setBatch((value) => value + 1)}
              className="btn-hard btn-secondary px-4 py-2 text-xs"
            >
              换一批 <span aria-hidden>→</span>
            </button>
          ) : null}
        </div>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {visible.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </section>
  )
}
