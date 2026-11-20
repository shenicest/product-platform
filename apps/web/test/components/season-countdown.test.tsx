import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatCountdown, SeasonCountdown } from '@/components/season-countdown'

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000
const MINUTE_MS = 60_000

describe('formatCountdown', () => {
  it('splits the remaining time into days and a zero-padded clock', () => {
    expect(
      formatCountdown(19 * DAY_MS + 10 * HOUR_MS + 58 * MINUTE_MS + 37_000),
    ).toEqual({ days: 19, clock: '10:58:37' })
  })

  it('clamps negative values to zero', () => {
    expect(formatCountdown(-1)).toEqual({ days: 0, clock: '00:00:00' })
  })
})

describe('SeasonCountdown', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the server-computed remaining time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-21T00:00:00.000Z'))
    const remaining = 19 * DAY_MS + 10 * HOUR_MS + 58 * MINUTE_MS + 37_000
    const target = new Date(Date.now() + remaining).toISOString()

    render(
      <SeasonCountdown target={target} initialRemainingMs={remaining} />,
    )

    expect(screen.getByRole('timer')).toHaveTextContent(
      /19\s*天\s*10:58:37/,
    )
  })

  it('shows a closed state once the work deadline has passed', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-21T00:00:00.000Z'))

    render(
      <SeasonCountdown
        target="2026-11-01T00:00:00.000Z"
        initialRemainingMs={0}
      />,
    )

    expect(screen.getByText('作品提交已截止')).toBeInTheDocument()
  })
})
