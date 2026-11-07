'use client'

import { useRef, useState } from 'react'

export type SeasonCarouselSlide = {
  id: number
  name: string
  content: React.ReactNode
}

export function SeasonCarousel({
  slides,
  initialIndex,
}: {
  slides: SeasonCarouselSlide[]
  initialIndex: number
}) {
  const total = slides.length
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(initialIndex, 0), Math.max(total - 1, 0)),
  )
  const [drag, setDrag] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef(0)
  const axisRef = useRef<'x' | 'y' | null>(null)
  const startRef = useRef({ x: 0, y: 0 })
  const rootRef = useRef<HTMLDivElement>(null)

  function goTo(next: number) {
    if (total <= 1) return
    const clamped = Math.max(0, Math.min(total - 1, next))
    dragRef.current = 0
    setDrag(0)
    if (clamped === index) return

    setIndex(clamped)
    const url = new URL(window.location.href)
    url.searchParams.set('season', String(slides[clamped].id))
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)

    const root = rootRef.current
    if (root && root.getBoundingClientRect().top < 0) {
      root.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  function onTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if (total <= 1) return
    const touch = event.touches[0]
    startRef.current = { x: touch.clientX, y: touch.clientY }
    axisRef.current = null
    dragRef.current = 0
    setDrag(0)
    setDragging(true)
  }

  function onTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    if (!dragging) return
    const touch = event.touches[0]
    const dx = touch.clientX - startRef.current.x
    const dy = touch.clientY - startRef.current.y

    if (!axisRef.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      axisRef.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    }
    if (axisRef.current !== 'x') return

    const atStart = index === 0 && dx > 0
    const atEnd = index === total - 1 && dx < 0
    const value = atStart || atEnd ? dx * 0.35 : dx
    dragRef.current = value
    setDrag(value)
  }

  function onTouchEnd() {
    if (!dragging) return
    setDragging(false)
    const dx = dragRef.current
    if (axisRef.current === 'x' && Math.abs(dx) > 56) {
      goTo(index + (dx < 0 ? 1 : -1))
    } else {
      dragRef.current = 0
      setDrag(0)
    }
    axisRef.current = null
  }

  const transform = `translate3d(calc(${-index * 100}% + ${drag}px), 0, 0)`

  return (
    <div ref={rootRef} className="season-carousel">
      {total > 1 ? (
        <div className="season-carousel__nav" role="group" aria-label="切换赛季">
          <button
            type="button"
            className="season-carousel__arrow"
            aria-label="上一个赛季"
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
          >
            ←
          </button>
          <div className="season-carousel__dots">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                className="season-carousel__dot"
                aria-label={`切换到 ${slide.name}`}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
          <button
            type="button"
            className="season-carousel__arrow"
            aria-label="下一个赛季"
            onClick={() => goTo(index + 1)}
            disabled={index === total - 1}
          >
            →
          </button>
        </div>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {slides[index]?.name}
      </p>

      <div
        className="season-carousel__viewport"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <div
          className="season-carousel__track"
          data-dragging={dragging ? 'true' : 'false'}
          style={{ transform }}
        >
          {slides.map((slide, i) => (
            <div
              key={slide.id}
              className="season-carousel__slide"
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${total}`}
              aria-hidden={i !== index}
              inert={i !== index}
            >
              {slide.content}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
