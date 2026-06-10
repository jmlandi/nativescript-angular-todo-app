export interface TodoModel {
  id: number
  title: string
  description: string
  status: TodoStatus
  createdAt: Date
}

export enum TodoStatus {
  Pending = 'PENDING',
  InProgress = 'IN_PROGRESS',
  Blocked = 'BLOCKED',
  Completed = 'COMPLETED',
  Cancelled = 'CANCELLED'
}


