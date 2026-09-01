import { Elysia } from 'elysia'
import { eventManagementDb } from '../db/event-management'

export const eventManagementDbPlugin = new Elysia({ name: 'event-management-db' })
  .decorate('eventManagementDb', eventManagementDb)
