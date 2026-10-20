import { ConnectionRequestStatus } from '@shenicest/shared'

// Covers every ConnectionRequestStatus value for platform-Project connections.
export const PROJECT_CONNECTION_STATUS_LABELS: Record<number, string> = {
  [ConnectionRequestStatus.Pending]: '等待项目方回应',
  [ConnectionRequestStatus.Accepted]: '已建立连接',
  [ConnectionRequestStatus.Ignored]: '暂未建立连接',
  [ConnectionRequestStatus.Cancelled]: '申请已结束',
}
