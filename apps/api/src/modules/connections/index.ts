import { Elysia, t } from 'elysia'
import { db } from '../../db'
import { authPlugin } from '../../plugins/auth'
import { ErrorResponse } from '../../common'
import { hackathonConnectionService } from '../hackathon-connection'
import { TalentService } from '../talent/service'
import { ConnectionsQuery } from './model'
import { ConnectionsService } from './service'

const talentService = new TalentService(db)
const service = new ConnectionsService({
  talentConnections: (userId) => talentService.connections(userId),
  hackathonConnections: (userId) => hackathonConnectionService.listForUser(userId),
})

export const connectionsModule = new Elysia()
  .use(authPlugin)
  .model({ ConnectionsQuery })
  .prefix('model', 'Connections.')
  .get('/connections', ({ user, query }) => service.connections(user.userId, query), {
    auth: true,
    query: 'Connections.ConnectionsQuery',
    detail: { tags: ['Connections'], summary: 'Unified connection list across talent and hackathon sources' },
    response: { 200: t.Any(), 401: ErrorResponse },
  })
