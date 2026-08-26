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

function getTodayStr() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function BathBooking({ userId: _userId }: { userId: string }) {
  const today = getTodayStr()
  const [data, setData] = useState<SlotsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchSlots = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data: slotsData, error: err } = await getBathSlots(today)
    if (err) {
      setError(err.body?.error?.message ?? '加载失败')
      setData(null)
    } else {
      setData(slotsData)
    }
    setLoading(false)
  }, [today])

  // Initial load on mount
  const [initialized, setInitialized] = useState(false)
  if (!initialized) {
    setInitialized(true)
    fetchSlots()
  }

  const handleBook = async (timeSlot: string) => {
    setActionLoading(timeSlot)
    setError(null)
    const { error: err } = await bookBathSlot(today, timeSlot)
    if (err) {
      setError(err.body?.error?.message ?? '预约失败')
    }
    await fetchSlots()
    setActionLoading(null)
  }

  const handleCancel = async (bookingId: number) => {
    setActionLoading('cancel')
    setError(null)
    const { error: err } = await cancelBathSlot(bookingId)
    if (err) {
      setError(err.body?.error?.message ?? '取消失败')
    }
    await fetchSlots()
    setActionLoading(null)
  }

  const genderLabel = data?.gender === 'male' ? '♂ 男浴室' : data?.gender === 'female' ? '♀ 女浴室' : ''

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">🚿 洗澡间预约</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        每人每天仅限预约 1 个时段（30 分钟），仅可预约当天。
      </p>

      <div className="mb-6 rounded-lg border border-border bg-muted/30 px-4 py-4">
        <h2 className="mb-2 text-sm font-semibold">预约须知</h2>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>· 按时间段预约，尽量准时到达</li>
          <li>· 洗漱不要超过自己的时段</li>
          <li>· 在北辰奥运村宾馆 C 座前台找到志愿者</li>
          <li>· 通过选手牌换房卡钥匙，留下姓名和电话</li>
          <li>· 洗漱完后归还房卡</li>
        </ul>
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
