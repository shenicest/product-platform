import { afterEach, describe, expect, it, mock } from 'bun:test'
import { logEvent } from '../../src/lib/log-event'

describe('logEvent', () => {
  const original = console.log
  const logMock = mock(() => {})

  afterEach(() => {
    console.log = original
    logMock.mockClear()
  })

  it('emits a single JSON line with event, time, and allow-listed fields', () => {
    console.log = logMock as typeof console.log
    logEvent('connection_submit_success', {
      eventId: 4,
      hackathonProjectId: 12,
      requestId: 345,
      source: 'hackathon',
      status: 'Pending',
    })
    expect(logMock).toHaveBeenCalledTimes(1)
    const [first] = logMock.mock.calls as unknown as string[][]
    expect(first).toHaveLength(1)
    const parsed = JSON.parse(first[0])
    expect(parsed.event).toBe('connection_submit_success')
    expect(parsed.eventId).toBe(4)
    expect(parsed.hackathonProjectId).toBe(12)
    expect(parsed.requestId).toBe(345)
    expect(parsed.source).toBe('hackathon')
    expect(parsed.status).toBe('Pending')
    expect(parsed.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(Object.keys(parsed).sort()).toEqual(
      ['event', 'eventId', 'hackathonProjectId', 'requestId', 'source', 'status', 'time'].sort(),
    )
  })

  it('stays one line even when values contain newlines (JSON-escaped)', () => {
    console.log = logMock as typeof console.log
    logEvent('connection_submit_failed', { source: 'hackathon', errorCode: 'INVALID_MESSAGE' })
    const [first] = logMock.mock.calls as unknown as string[][]
    expect(first[0].split('\n')).toHaveLength(1)
    expect(JSON.parse(first[0]).errorCode).toBe('INVALID_MESSAGE')
  })
})
