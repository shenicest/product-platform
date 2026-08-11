import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './msw/server'

// Testing Library needs an explicit cleanup between tests when `globals: false`
// is set — the automatic afterEach hook only registers when Vitest globals are
// enabled. Without this, rendered DOM leaks across tests and queries return
// multiple matches.
afterEach(() => cleanup())

// MSW lifecycle. Each test file installs its own handlers via server.use(...);
// this keeps the base server empty so unhandled requests fail loudly.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
