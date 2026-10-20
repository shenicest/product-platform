'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  bookBathSlot,
  cancelBathSlot,
  checkoutBathSlot,
  getBathConfig,
  getBathSlots,
  updateBathConfig,
} from '@/lib/client-api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChipButton } from '@/components/ui/chip'

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

export function BathBooking({ email }: { email: string | null }) {
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
    <div className="min-h-screen pb-16">
      {/* 页头：天空蓝带，只做身份说明，不放操作 */}
      <header className="border-b border-border bg-sky-soft">
        <div className="shell shell--text py-8">
          <p className="eyebrow">BATH HOUSE / RESERVATION</p>
          <h1 className="mt-2 font-display text-3xl font-black tracking-tight">
            🚿 洗澡间预约
          </h1>
          <p className="mt-3 text-body-sm text-muted-foreground">
            每人每天仅限预约 1 次，可选择 30 分钟或连续 60 分钟。
          </p>
        </div>
      </header>

      <div className="shell shell--text pt-6">
        {/* 日期 + 浴室：预约的入口条件 */}
        <section className="ui-card ui-card--static mb-4">
          <div className="flex flex-wrap items-end gap-4 p-5">
            <label className="ui-field w-44">
              <span className="ui-label">日期</span>
              <input
                type="date"
                min={config?.eventStart}
                max={config?.eventEnd}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="ui-input font-mono"
              />
            </label>

            {canSelectGender && (
              <div className="ui-field" role="group" aria-label="浴室选择">
                <span className="ui-label">浴室</span>
                <div className="flex items-center gap-2">
                  <ChipButton
                    tone={gender === 'male' ? 'accent' : 'neutral'}
                    aria-pressed={gender === 'male'}
                    onClick={() => setGender('male')}
                    className="min-h-9"
                  >
                    ♂ 男浴室
                  </ChipButton>
                  <ChipButton
                    tone={gender === 'female' ? 'accent' : 'neutral'}
                    aria-pressed={gender === 'female'}
                    onClick={() => setGender('female')}
                    className="min-h-9"
                  >
                    ♀ 女浴室
                  </ChipButton>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 管理员：预约开放时间 */}
        {isAdmin && (
          <section className="mb-4 rounded-lg border border-brand-line bg-brand-wash p-5">
            <p className="eyebrow eyebrow--accent">ADMIN / OPEN WINDOW</p>
            <h2 className="mt-2 text-body-lg font-bold">管理员设置 — 预约开放时间</h2>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="ui-field w-44">
                <span className="ui-label">开始</span>
                <input
                  type="date"
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                  className="ui-input font-mono"
                />
              </label>
              <label className="ui-field w-44">
                <span className="ui-label">结束</span>
                <input
                  type="date"
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                  className="ui-input font-mono"
                />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="ui-field w-32">
                <span className="ui-label">每天</span>
                <select
                  value={editDailyStart}
                  onChange={(e) => setEditDailyStart(e.target.value)}
                  className="ui-select font-mono"
                >
                  {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="ui-field w-32">
                <span className="ui-label">至</span>
                <select
                  value={editDailyEnd}
                  onChange={(e) => setEditDailyEnd(e.target.value)}
                  className="ui-select font-mono"
                >
                  {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <span className="ui-hint pb-3">（整点/半点）</span>
              <Button onClick={handleSaveConfig} disabled={configSaving}>
                {configSaving ? '保存中...' : '保存'}
              </Button>
            </div>

            {configMsg && <p className="ui-hint mt-3">{configMsg}</p>}
            <p className="mono mt-3">
              当前开放范围：{config?.eventStart ?? '-'} 至 {config?.eventEnd ?? '-'}，每天 {config?.dailyStart ?? '-'} - {config?.dailyEnd ?? '-'}
            </p>
          </section>
        )}

        {/* 预约须知 */}
        <section className="ui-card ui-card--static mb-4">
          <div className="p-5">
            <h2 className="text-body-lg font-bold">预约须知</h2>
            <ul className="mt-2 flex flex-col gap-1.5 text-body-sm text-muted-foreground">
              <li>· 按时间段预约，尽量准时到达</li>
              <li>· 洗漱不要超过自己的时段</li>
              <li>· 预约开始后即可签退，请在预约结束后 3 分钟内完成签退</li>
              <li>· 大家要自行带洗漱用品、浴巾</li>
              <li>· 直接去 C 座前台报&quot;黑克松女生&quot;&quot;黑客松男生&quot;进对应的房间，前台会登记信息，然后帮我们开门。（记得带身份证）</li>
              <li>· 酒店地址：北辰汇园酒店 C 座（酒店距离 1.7km）</li>
            </ul>
          </div>
        </section>

        {error && (
          <div className="ui-note ui-note--danger mb-4" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <p className="ui-empty">加载中...</p>
        ) : !data ? (
          <p className="ui-empty">无法加载数据</p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-h3 font-bold">
                {genderLabel}
                <span className="mono">{data.date}</span>
              </h2>

              {/* 预约时长：未成单时才可选，全局一次 */}
              {!data.myBooking && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-body-sm text-muted-foreground">预约时长：</span>
                  <ChipButton
                    aria-pressed={durationSlots === 1}
                    onClick={() => setDurationSlots(1)}
                    className="min-h-9"
                  >
                    30 分钟
                  </ChipButton>
                  <ChipButton
                    aria-pressed={durationSlots === 2}
                    onClick={() => setDurationSlots(2)}
                    className="min-h-9"
                  >
                    连续 60 分钟
                  </ChipButton>
                </div>
              )}
            </div>

            {data.myBooking && (
              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-brand-line bg-brand-wash px-4 py-3">
                <span className="ui-chip ui-chip--active ui-chip--dot">我的预约</span>
                <p className="text-body-sm">
                  您当天已预约：
                  <span className="font-mono font-medium">
                    {data.myBooking.timeSlot} - {addMinutes(data.myBooking.timeSlot, data.myBooking.durationSlots * 30)}
                  </span>
                </p>
                {data.myBooking.checkedOutAt && (
                  <span className="ui-chip ui-chip--success">已签退</span>
                )}
              </div>
            )}

            <ul className="flex flex-col gap-2" aria-label="时段列表">
              {data.slots.map((slot) => {
                const end_time = add30Min(slot.timeSlot)
                const isDisabled = (data.myBooking && !slot.isMine) || actionLoading !== null
                const isMySlot = slot.isMine
                const isMyBookingStart = isMySlot && data.myBooking?.timeSlot === slot.timeSlot
                const isPast = !slot.booked && isPastSlot(data.date, slot.timeSlot)
                const started = hasStarted(data.date, slot.timeSlot, now)

                return (
                  <li
                    key={slot.timeSlot}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-md border px-4 py-3 transition-colors',
                      slot.booked
                        ? isMySlot
                          ? 'border-brand-line bg-brand-wash'
                          : 'border-border bg-secondary'
                        : isPast
                          ? 'border-border-soft bg-background'
                          : 'border-border bg-card hover:border-brand-line',
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="w-36 shrink-0 whitespace-nowrap font-mono text-body-sm font-medium">
                        {slot.timeSlot} - {end_time}
                      </span>
                      {slot.booked ? (
                        isMySlot ? (
                          <span className="ui-chip ui-chip--active">我的预约</span>
                        ) : (
                          <span className="truncate text-body-sm text-muted-foreground">
                            {occupiedSlotName(data.date, data.gender, slot.timeSlot) ?? slot.name}
                          </span>
                        )
                      ) : (
                        <span
                          className={cn(
                            'text-body-sm',
                            isPast ? 'text-subtle-foreground' : 'text-muted-foreground',
                          )}
                        >
                          {isPast ? '已过可预约时段' : '可预约'}
                        </span>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {slot.booked && isMyBookingStart ? (
                        data.myBooking?.checkedOutAt ? (
                          <span className="ui-chip ui-chip--success">已签退</span>
                        ) : started ? (
                          <Button
                            size="sm"
                            onClick={() => slot.bookingId && handleCheckout(slot.bookingId)}
                            disabled={actionLoading === 'checkout'}
                          >
                            {actionLoading === 'checkout' ? '签退中...' : '签退'}
                          </Button>
                        ) : (
                          <ChipButton
                            tone="danger"
                            className="min-h-9 disabled:opacity-50"
                            onClick={() => slot.bookingId && handleCancel(slot.bookingId)}
                            disabled={actionLoading === 'cancel'}
                          >
                            {actionLoading === 'cancel' ? '取消中...' : '取消'}
                          </ChipButton>
                        )
                      ) : !slot.booked && !isPast ? (
                        <Button
                          size="sm"
                          onClick={() => handleBook(slot.timeSlot)}
                          disabled={!!isDisabled}
                        >
                          {actionLoading === slot.timeSlot ? '预约中...' : durationSlots === 2 ? '预约 60 分钟' : '预约 30 分钟'}
                        </Button>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
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
