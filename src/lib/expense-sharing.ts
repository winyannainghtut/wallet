import type { Expense, Trip } from '@/types'

type TripLookup = Map<string, Pick<Trip, 'groupSize'>>

function resolveTripLookup(trips: Trip[] | TripLookup): TripLookup {
  if (trips instanceof Map) {
    return trips
  }

  return new Map(
    trips.map((trip) => [trip.id, { groupSize: trip.groupSize }])
  )
}

export function getPersonalExpenseAmount(
  expense: Pick<Expense, 'amount' | 'tripId' | 'sharedGroupExpense'>,
  trips: Trip[] | TripLookup
): number {
  if (!expense.sharedGroupExpense || !expense.tripId) {
    return expense.amount
  }

  const trip = resolveTripLookup(trips).get(expense.tripId)
  const groupSize = trip?.groupSize
  if (typeof groupSize !== 'number' || groupSize < 2) {
    return expense.amount
  }

  return expense.amount / groupSize
}

export function applyPersonalExpenseShares<T extends Expense>(
  expenses: T[],
  trips: Trip[] | TripLookup
): T[] {
  const tripLookup = resolveTripLookup(trips)

  return expenses.map((expense) => ({
    ...expense,
    amount: getPersonalExpenseAmount(expense, tripLookup),
  }))
}

