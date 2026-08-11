import { setupServer } from 'msw/node'

// Empty by default. Individual tests attach handlers via `server.use(...)`.
export const server = setupServer()
