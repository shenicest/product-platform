import { db } from '../../db'
import { UserProfileService } from './service'

// Service-only module: the shared User table is external and read-only, so it
// exposes no HTTP routes of its own — other modules consume the service.
export const userProfileService = new UserProfileService(db)
