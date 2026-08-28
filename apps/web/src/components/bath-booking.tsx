'use client'

import { useEffect, useState, useCallback } from 'react'
import { getBathSlots, bookBathSlot, cancelBathSlot, checkoutBathSlot, getBathConfig, updateBathConfig } from '@/lib/client-api'

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
  eventStart: string
  eventEnd: string
  dailyStart: string
  dailyEnd: string
  canSelectGender: boolean
  myBooking: { id: number; timeSlot: string; durationSlots: 1 | 2; checkedOutAt: string | null } | null
  slots: BathSlot[]
}

// Hardcoded display names for pre-seeded occupied slots (seed_* user_ids do not
// resolve to a real application record). Key: `${date}|${gender}|${timeSlot}`.
const OCCUPIED_SLOT_NAMES: Record<string, string> = {
  '2026-08-27|female|12:00': '范心怡',
  '2026-08-27|female|18:30': '张艾佳',
  '2026-08-27|female|19:00': '罗晨菲',
  '2026-08-27|female|19:30': '邓思涵',
  '2026-08-27|female|20:00': '王佳音',
  '2026-08-27|female|20:30': '范晓君',
  '2026-08-27|female|21:00': '廖思怡',
  '2026-08-28|female|20:30': '廖思怡',
  '2026-08-28|female|21:00': '张艾佳',
  '2026-08-29|female|20:30': '廖思怡',
  '2026-08-27|male|10:00': '聂宇杰',
  '2026-08-27|male|19:00': '王志宇',
  '2026-08-27|male|20:30': 'Alexandru',
}

function occupiedSlotName(date: string, gender: string, timeSlot: string): string | undefined {
  return OCCUPIED_SLOT_NAMES[`${date}|${gender}|${timeSlot}`]
}

function getTodayStr() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDate(dateStr: string) {
  const [, m, d] = dateStr.split('-')
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(`${dateStr}T00:00:00`).getDay()]
  return `${Number(m)}/${Number(d)} ${weekday}`
}

function timeOptions() {
  const options: string[] = []
  for (let h = 0; h < 24; h++) {
    options.push(`${String(h).padStart(2, '0')}:00`)
    options.push(`${String(h).padStart(2, '0')}:30`)
  }
  return options
}

function isPastSlot(dateStr: string, timeSlot: string): boolean {
  return new Date(`${dateStr}T${timeSlot}:00`) < new Date()
}

function hasStarted(dateStr: string, timeSlot: string, now: Date): boolean {
  return now >= new Date(`${dateStr}T${timeSlot}:00`)
}

export function BathBooking({ userId: _userId, email }: { userId: string; email: string | null }) {
  const today = getTodayStr()
  const isAdmin = !!email && email.toLowerCase().endsWith('@shenicest.cn')
  const TIME_OPTIONS = timeOptions()

  const [config, setConfig] = useState<{ eventStart: string; eventEnd: string; dailyStart: string; dailyEnd: string } | null>(null)
  const [data, setData] = useState<SlotsData | null>(null)
  const [selectedDate, setSelectedDate] = useState(today)
  const [durationSlots, setDurationSlots] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [error, setError] = useState<string | null>(null)
  const [gender, setGender] = useState<'male' | 'female' | undefined>(isAdmin ? 'female' : undefined)
  const [canSelectGender, setCanSelectGender] = useState(isAdmin)

  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [editDailyStart, setEditDailyStart] = useState('09:00')
  const [editDailyEnd, setEditDailyEnd] = useState('21:00')
  const [configSaving, setConfigSaving] = useState(false)
  const [configMsg, setConfigMsg] = useState<string | null>(null)

  const fetchSlots = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data: slotsData, error: err } = await getBathSlots(selectedDate, canSelectGender ? gender : undefined)
    if (err) {
      setError(err.body?.error?.message ?? '加载失败')
      setData(null)
    } else if (slotsData) {
      setData(slotsData)
      setCanSelectGender(slotsData.canSelectGender)
      if (slotsData.canSelectGender) setGender(slotsData.gender)
      setConfig({ eventStart: slotsData.eventStart, eventEnd: slotsData.eventEnd, dailyStart: slotsData.dailyStart, dailyEnd: slotsData.dailyEnd })
    }
    setLoading(false)
  }, [selectedDate, canSelectGender, gender])

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      const { data: cfg } = await getBathConfig()
      if (cancelled) return
      if (cfg) {
        setConfig(cfg)
        setEditStart(cfg.eventStart)
        setEditEnd(cfg.eventEnd)
        setEditDailyStart(cfg.dailyStart)
        setEditDailyEnd(cfg.dailyEnd)
      }
      await fetchSlots()
    }
    init()
    return () => { cancelled = true }
  }, [fetchSlots])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(interval)
  }, [])

  const handleBook = async (timeSlot: string) => {
    setActionLoading(timeSlot)
    setError(null)
    const { error: err } = await bookBathSlot(selectedDate, timeSlot, durationSlots, canSelectGender ? gender : undefined)
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

  const handleCheckout = async (bookingId: number) => {
    setActionLoading('checkout')
    setError(null)
    const { error: err } = await checkoutBathSlot(bookingId)
    if (err) {
      setError(err.body?.error?.message ?? '签退失败')
    }
    await fetchSlots()
    setActionLoading(null)
  }

  const handleSaveConfig = async () => {
    if (!editStart || !editEnd || !editDailyStart || !editDailyEnd) return
    setConfigSaving(true)
    setConfigMsg(null)
    const { data: newConfig, error: err } = await updateBathConfig({ eventStart: editStart, eventEnd: editEnd, dailyStart: editDailyStart, dailyEnd: editDailyEnd })
    if (err) {
      setConfigMsg(err.body?.error?.message ?? '保存失败')
    } else if (newConfig) {
      setConfig(newConfig)
      setConfigMsg('已保存')
      await fetchSlots()
    }
    setConfigSaving(false)
  }

  const genderLabel = data?.gender === 'male' ? '♂ 男浴室' : data?.gender === 'female' ? '♀ 女浴室' : ''

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">🚿 洗澡间预约</h1>
      <p className="mb-1 text-sm text-muted-foreground">
         每人每天仅限预约 1 次，可选择 30 分钟或连续 60 分钟。
      </p>
      <p className="mb-4 font-mono text-sm">
         日期：
         <input type="date" min={config?.eventStart} max={config?.eventEnd} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1 font-medium text-primary" />
      </p>

      {canSelectGender && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">浴室：</span>
          <button
            onClick={() => setGender('male')}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${gender === 'male' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            ♂ 男浴室
          </button>
          <button
            onClick={() => setGender('female')}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${gender === 'female' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            ♀ 女浴室
          </button>
        </div>
      )}

      {isAdmin && (
        <div className="mb-6 rounded-lg border border-primary/40 bg-primary/5 px-4 py-4">
          <h2 className="mb-3 text-sm font-semibold">管理员设置 — 预约开放时间</h2>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-muted-foreground">开始</label>
            <input
              type="date"
              value={editStart}
              onChange={(e) => setEditStart(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
            <label className="text-sm text-muted-foreground">结束</label>
            <input
              type="date"
              value={editEnd}
              onChange={(e) => setEditEnd(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="text-sm text-muted-foreground">每天</label>
            <select
              value={editDailyStart}
              onChange={(e) => setEditDailyStart(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <label className="text-sm text-muted-foreground">至</label>
            <select
              value={editDailyEnd}
              onChange={(e) => setEditDailyEnd(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <label className="text-sm text-muted-foreground">（整点/半点）</label>
            <button
              onClick={handleSaveConfig}
              disabled={configSaving}
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {configSaving ? '保存中...' : '保存'}
            </button>
          </div>
          {configMsg && <p className="mt-2 text-xs text-muted-foreground">{configMsg}</p>}
          <p className="mt-2 text-xs text-muted-foreground/70">当前开放范围：{config?.eventStart ?? '-'} 至 {config?.eventEnd ?? '-'}，每天 {config?.dailyStart ?? '-'} - {config?.dailyEnd ?? '-'}</p>
        </div>
      )}

      <div className="mb-6 rounded-lg border border-border bg-muted/30 px-4 py-4">
        <h2 className="mb-2 text-sm font-semibold">预约须知</h2>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li>· 按时间段预约，尽量准时到达</li>
          <li>· 洗漱不要超过自己的时段</li>
          <li>· 预约开始后即可签退，请在预约结束后 3 分钟内完成签退</li>
          <li>· 大家要自行带洗漱用品、浴巾</li>
          <li>· 直接去 C 座前台报&quot;黑克松女生&quot;&quot;黑客松男生&quot;进对应的房间，前台会登记信息，然后帮我们开门。（记得带身份证）</li>
          <li>· 酒店地址：北辰汇园酒店 C 座（酒店距离 1.7km）</li>
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
                您当天已预约：<span className="font-medium">{data.myBooking.timeSlot} - {addMinutes(data.myBooking.timeSlot, data.myBooking.durationSlots * 30)}</span>
              </p>
              {data.myBooking.checkedOutAt && <p className="mt-1 text-xs text-muted-foreground">已签退</p>}
            </div>
          )}

          <div className="space-y-2">
            {data.slots.map((slot) => {
              const end_time = add30Min(slot.timeSlot)
              const isDisabled = (data.myBooking && !slot.isMine) || actionLoading !== null
              const isMySlot = slot.isMine
              const isMyBookingStart = isMySlot && data.myBooking?.timeSlot === slot.timeSlot
              const isPast = !slot.booked && isPastSlot(data.date, slot.timeSlot)
              const started = hasStarted(data.date, slot.timeSlot, now)

              return (
                <div
                  key={slot.timeSlot}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-colors ${
                    slot.booked
                      ? isMySlot
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border bg-muted/30'
                      : isPast
                        ? 'border-border bg-muted/10'
                        : 'border-border hover:border-primary/30 hover:bg-muted/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-24 font-mono text-sm font-medium">
                      {slot.timeSlot} - {end_time}
                    </span>
                    {slot.booked ? (
                      <span className={`text-sm ${isMySlot ? 'font-medium text-primary' : 'text-muted-foreground'}`}>
                        {isMySlot ? '我的预约' : (occupiedSlotName(data.date, data.gender, slot.timeSlot) ?? slot.name)}
                      </span>
                    ) : (
                      <span className={`text-sm ${isPast ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>
                        {isPast ? '已过可预约时段' : '可预约'}
                      </span>
                    )}
                  </div>

                  <div>
                    {slot.booked && isMyBookingStart ? (
                      data.myBooking?.checkedOutAt ? (
                        <span className="text-xs text-muted-foreground">已签退</span>
                      ) : started ? (
                       <button
                          onClick={() => slot.bookingId && handleCheckout(slot.bookingId)}
                          disabled={actionLoading === 'checkout'}
                          className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                        >
                          {actionLoading === 'checkout' ? '签退中...' : '签退'}
                        </button>
                      ) : (
                        <button
                          onClick={() => slot.bookingId && handleCancel(slot.bookingId)}
                          disabled={actionLoading === 'cancel'}
                          className="rounded-md border border-destructive/30 px-3 py-1 text-xs text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                        >
                          {actionLoading === 'cancel' ? '取消中...' : '取消'}
                        </button>
                      )
                    ) : !slot.booked && !isPast ? (
                      <button
                        onClick={() => handleBook(slot.timeSlot)}
                        disabled={isDisabled}
                        className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                      >
                         {actionLoading === slot.timeSlot ? '预约中...' : durationSlots === 2 ? '预约 60 分钟' : '预约 30 分钟'}
                      </button>
                    ) : null}
           </div>
           {!data.myBooking && <div className="mt-4 flex items-center gap-2 text-sm">
             <span className="text-muted-foreground">预约时长：</span>
             <button onClick={() => setDurationSlots(1)} className={`rounded-md px-3 py-1 ${durationSlots === 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>30 分钟</button>
             <button onClick={() => setDurationSlots(2)} className={`rounded-md px-3 py-1 ${durationSlots === 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>连续 60 分钟</button>
           </div>}
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

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const totalMin = h * 60 + m + minutes
  return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`
}
