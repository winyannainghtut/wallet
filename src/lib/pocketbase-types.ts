// PocketBase Collection Types

export interface UserRecord {
  id: string
  collectionId: string
  collectionName: string
  username: string
  verified: boolean
  emailVisibility: boolean
  email: string
  created: string
  updated: string
  name?: string
  avatar?: string
}

export interface TransactionRecord {
  id: string
  collectionId: string
  collectionName: string
  user: string // Relation to users collection
  type: 'income' | 'expense'
  category: string
  amount: number
  description: string
  date: string // ISO date string
  created: string
  updated: string
}

export interface BudgetRecord {
  id: string
  collectionId: string
  collectionName: string
  user: string // Relation to users collection
  category: string
  amount: number
  period: 'weekly' | 'monthly'
  created: string
  updated: string
}

export interface SubscriptionRecord {
  id: string
  collectionId: string
  collectionName: string
  user: string // Relation to users collection
  name: string
  amount: number
  category: string
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  nextDueDate: string
  isActive: boolean
  created: string
  updated: string
}

export interface TripRecord {
  id: string
  collectionId: string
  collectionName: string
  user: string // Relation to users collection
  name: string
  budget: number
  startDate: string
  endDate: string
  created: string
  updated: string
}

// Response types with expanded relations
export interface TransactionWithUser extends TransactionRecord {
  expand?: {
    user?: UserRecord
  }
}

// Helper type for creating records (without auto-generated fields)
export type CreateTransaction = Omit<TransactionRecord, 'id' | 'collectionId' | 'collectionName' | 'created' | 'updated'>
export type CreateBudget = Omit<BudgetRecord, 'id' | 'collectionId' | 'collectionName' | 'created' | 'updated'>
export type CreateSubscription = Omit<SubscriptionRecord, 'id' | 'collectionId' | 'collectionName' | 'created' | 'updated'>
export type CreateTrip = Omit<TripRecord, 'id' | 'collectionId' | 'collectionName' | 'created' | 'updated'>
