'use client'

import { useState } from 'react'
import type { Project } from '@/server/projects'
import { ProjectCard } from '@/components/project-card'
import { Button } from '@/components/ui/button'
import { SectionHead } from '@/components/ui/typography'

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
    (_, index) => projects[(start + index) % projects.length],
  )
  const canRotate = projects.length > BATCH_SIZE

  return (
    <section className="section section--flush">
      <div className="shell">
        <SectionHead
          eyebrow="FEATURED / 01"
          title="精选项目"
          aside={
            <div className="flex flex-col items-start gap-3 sm:items-end">
              <p className="section-head__lead">
                平台希望你优先关注的优质项目 —— 它们正在被真实地建造。
              </p>
              {canRotate ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setBatch((value) => value + 1)}
                >
                  换一批 <span className="ui-btn__arrow" aria-hidden>→</span>
                </Button>
              ) : null}
            </div>
          }
        />
        <div className="card-grid">
          {visible.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </section>
  )
}
