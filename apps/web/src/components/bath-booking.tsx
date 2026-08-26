'use client'

import { useState, useCallback } from 'react'
import { getBathSlots, bookBathSlot, cancelBathSlot } from '@/lib/client-api'

interface BathSlot {
  timeSlot: string
  booked: boolean
  name?: string
  bookingId?: number
  isMine?: boolean
}

interface SlotsData {
  date: string
  gender: 'male' | 'female'
  myBooking: { id: number; timeSlot: string } | null
  slots: BathSlot[]
}

const DATES = [
  { label: '8/27 周四', value: '2026-08-27' },
  { label: '8/28 周五', value: '2026-08-28' },
  { label: '8/29 周六', value: '2026-08-29' },
  { label: '8/30 周日', value: '2026-08-30' },
]

function getTodayStr() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function BathBooking({ userId: _userId }: { userId: string }) {
  const today = getTodayStr()
  const todayOption = DATES.find((d) => d.value === today)
  const [selectedDate, setSelectedDate] = useState(todayOption?.value ?? today)
  const [data, setData] = useState<SlotsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchSlots = useCallback(async (date: string) => {
    setLoading(true)
    setError(null)
    const { data: slotsData, error: err } = await getBathSlots(date)
    if (err) {
      setError(err.body?.error?.message ?? '加载失败')
      setData(null)
    } else {
      setData(slotsData)
    }
    setLoading(false)
  }, [])

  const loadDate = useCallback(async (date: string) => {
    setSelectedDate(date)
    await fetchSlots(date)
  }, [fetchSlots])

  // Initial load on mount
  const [initialized, setInitialized] = useState(false)
  if (!initialized) {
    setInitialized(true)
    fetchSlots(selectedDate)
  }

  const handleBook = async (timeSlot: string) => {
    setActionLoading(timeSlot)
    setError(null)
    const { error: err } = await bookBathSlot(selectedDate, timeSlot)
    if (err) {
      setError(err.body?.error?.message ?? '预约失败')
    }
    await fetchSlots(selectedDate)
    setActionLoading(null)
  }

  const handleCancel = async (bookingId: number) => {
    setActionLoading('cancel')
    setError(null)
    const { error: err } = await cancelBathSlot(bookingId)
    if (err) {
      setError(err.body?.error?.message ?? '取消失败')
    }
    await fetchSlots(selectedDate)
    setActionLoading(null)
  }

  const genderLabel = data?.gender === 'male' ? '♂ 男浴室' : data?.gender === 'female' ? '♀ 女浴室' : ''

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">🚿 洗澡间预约</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        每人每天仅限预约 1 个时段（30 分钟），预约后不可再预约其他时段。
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        {DATES.map((d) => {
          const isToday = d.value === today
          const isPast = d.value < today
          return (
            <button
              key={d.value}
              onClick={() => !isPast && loadDate(d.value)}
              disabled={isPast}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                selectedDate === d.value
                  ? 'bg-primary text-primary-foreground'
                  : isPast
                    ? 'cursor-not-allowed bg-muted text-muted-foreground/50'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {d.label}
              {isToday && <span className="ml-1 text-xs">（今天）</span>}
            </button>
          )
        })}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-muted-foreground">加载中...</div>
      ) : !data ? (
        <div className="py-16 text-center text-muted-foreground">无法加载数据</div>
      ) : (
        <>
          <h2 className="mb-4 text-lg font-semibold">{genderLabel}</h2>

          {data.myBooking && (
            <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
              <p className="text-sm">
                您今天已预约：<span className="font-medium">{data.myBooking.timeSlot} - {add30Min(data.myBooking.timeSlot)}</span>
              </p>
            </div>
          )}

          <div className="space-y-2">
            {data.slots.map((slot) => {
              const end_time = add30Min(slot.timeSlot)
              const isDisabled = (data.myBooking && !slot.isMine) || actionLoading !== null
              const isMySlot = slot.isMine

              return (
                <div
                  key={slot.timeSlot}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-colors ${
                    slot.booked
                      ? isMySlot
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border bg-muted/30'
                      : 'border-border hover:border-primary/30 hover:bg-muted/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-24 font-mono text-sm font-medium">
                      {slot.timeSlot} - {end_time}
                    </span>
                    {slot.booked ? (
                      <span className={`text-sm ${isMySlot ? 'font-medium text-primary' : 'text-muted-foreground'}`}>
                        {isMySlot ? '我的预约' : slot.name}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">可预约</span>
                    )}
                  </div>

                  <div>
                    {slot.booked && isMySlot ? (
                      <button
                        onClick={() => slot.bookingId && handleCancel(slot.bookingId)}
                        disabled={actionLoading === 'cancel'}
                        className="rounded-md border border-destructive/30 px-3 py-1 text-xs text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                      >
                        {actionLoading === 'cancel' ? '取消中...' : '取消'}
                      </button>
                    ) : !slot.booked ? (
                      <button
                        onClick={() => handleBook(slot.timeSlot)}
                        disabled={isDisabled}
                        className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                      >
                        {actionLoading === slot.timeSlot ? '预约中...' : '预约'}
                      </button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function add30Min(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const totalMin = h * 60 + m + 30
  const nh = Math.floor(totalMin / 60)
  const nm = totalMin % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}
