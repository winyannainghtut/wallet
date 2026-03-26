'use client'

import React, { useState } from 'react'
import {
  PlusCircle,
  Search,
  Plane,
  Trash2,
  MapPin,
  Calendar as CalendarIcon,
  Wallet,
  DollarSign,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useApp } from '@/contexts/AppContext'
import { Trip } from '@/types'
import { differenceInDays, format, parseISO } from 'date-fns'
import { getTripFinancialSummary } from '@/lib/trips'

const amountFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
})

function formatAmount(value: number): string {
  return amountFormatter.format(value)
}

export default function TripsPage() {
  const { trips, addTrip, updateTrip, deleteTrip, expenses } = useApp()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingTripId, setDeletingTripId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [destinations, setDestinations] = useState('')
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(Date.now() + 7 * 86400000), 'yyyy-MM-dd'))
  const [budget, setBudget] = useState('')
  const [groupName, setGroupName] = useState('')
  const [groupSize, setGroupSize] = useState('')
  const [groupFund, setGroupFund] = useState('')
  const [search, setSearch] = useState('')

  const handleOpenModal = (trip?: Trip) => {
    if (trip) {
      setEditingTrip(trip)
      setName(trip.name)
      setDestinations(trip.destinations || '')
      setStartDate(trip.startDate)
      setEndDate(trip.endDate)
      setBudget(trip.budget?.toString() || '')
      setGroupName(trip.groupName || '')
      setGroupSize(trip.groupSize?.toString() || '')
      setGroupFund(trip.groupFund?.toString() || '')
    } else {
      setEditingTrip(null)
      setName('')
      setDestinations('')
      setStartDate(format(new Date(), 'yyyy-MM-dd'))
      setEndDate(format(new Date(Date.now() + 7 * 86400000), 'yyyy-MM-dd'))
      setBudget('')
      setGroupName('')
      setGroupSize('')
      setGroupFund('')
    }

    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !startDate || !endDate) return

    const parsedBudget = budget.trim().length > 0 ? Number(budget) : null
    const parsedGroupSize = groupSize.trim().length > 0 ? Number(groupSize) : null
    const parsedGroupFund = groupFund.trim().length > 0 ? Number(groupFund) : null

    if (Number.isNaN(parsedBudget) || (parsedBudget !== null && parsedBudget < 0)) {
      alert('Budget must be a non-negative number')
      return
    }

    if (
      Number.isNaN(parsedGroupSize) ||
      (parsedGroupSize !== null && (!Number.isInteger(parsedGroupSize) || parsedGroupSize < 2))
    ) {
      alert('Total travelers must be an integer of at least 2')
      return
    }

    if (Number.isNaN(parsedGroupFund) || (parsedGroupFund !== null && parsedGroupFund < 0)) {
      alert('Group fund must be a non-negative number')
      return
    }

    if (new Date(`${endDate}T00:00:00`) < new Date(`${startDate}T00:00:00`)) {
      alert('End date must be on or after start date')
      return
    }

    const tripData = {
      name: name.trim(),
      destinations: destinations.trim(),
      startDate,
      endDate,
      budget: parsedBudget,
      groupName: groupName.trim(),
      groupSize: parsedGroupSize,
      groupFund: parsedGroupFund,
    }

    try {
      setIsSaving(true)
      if (editingTrip) {
        await updateTrip(editingTrip.id, tripData)
      } else {
        await addTrip(tripData)
      }
      handleCloseModal()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save trip'
      alert(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (deletingTripId === id) return

    if (confirm('Are you sure you want to delete this trip? All assigned expenses will become uncategorized.')) {
      try {
        setDeletingTripId(id)
        await deleteTrip(id)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete trip'
        alert(message)
      } finally {
        setDeletingTripId(null)
      }
    }
  }

  const normalizedSearch = search.toLowerCase()
  const filteredTrips = trips.filter((trip) =>
    trip.name.toLowerCase().includes(normalizedSearch) ||
    (trip.destinations && trip.destinations.toLowerCase().includes(normalizedSearch)) ||
    (trip.groupName && trip.groupName.toLowerCase().includes(normalizedSearch))
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Travel Trips</h1>
          <p className="text-sm text-muted-foreground">Manage your trips, budgets, and shared group funds</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="rounded-xl bg-gradient-to-r from-primary to-primary/85 shadow-sm shadow-primary/20 hover:shadow-md hover:shadow-primary/25">
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Trip
        </Button>
      </div>

      {trips.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search trips, destinations, or group names..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border-border/60 bg-card/60 pl-9"
          />
        </div>
      )}

      {filteredTrips.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 bg-card/40 p-8 text-center backdrop-blur-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Plane className="h-8 w-8 text-primary/80" />
          </div>
          <h3 className="mb-2 text-lg font-semibold tracking-tight">No trips found</h3>
          <p className="mb-6 max-w-sm text-sm text-muted-foreground">
            {trips.length === 0
              ? "You haven't added any trips yet. Create a trip to start tracking travel expenses separately."
              : 'No trips match your search criteria.'}
          </p>
          {trips.length === 0 && (
            <Button onClick={() => handleOpenModal()} className="rounded-xl">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create First Trip
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTrips.map((trip) => {
            const tripExpenses = expenses.filter((expense) => expense.tripId === trip.id)
            const sharedGroupExpenses = tripExpenses.filter((expense) => expense.sharedGroupExpense)
            const totalSpend = tripExpenses.reduce((sum, expense) => sum + expense.amount, 0)
            const sharedGroupSpend = sharedGroupExpenses.reduce((sum, expense) => sum + expense.amount, 0)
            const tripStartDate = parseISO(trip.startDate)
            const tripEndDate = parseISO(trip.endDate)
            const days = Math.max(1, differenceInDays(tripEndDate, tripStartDate) + 1)
            const financialSummary = getTripFinancialSummary(trip, totalSpend, sharedGroupSpend)

            return (
              <Card
                key={trip.id}
                className="group relative cursor-pointer overflow-hidden border-border/40 transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-md"
                onClick={() => handleOpenModal(trip)}
              >
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.03] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                <CardHeader className="border-b border-border/20 bg-muted/20 pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="line-clamp-1 text-lg">{trip.name}</CardTitle>
                      {trip.destinations && (
                        <CardDescription className="mt-1 flex items-center gap-1 font-medium text-primary/80 line-clamp-1">
                          <MapPin className="h-3 w-3" />
                          {trip.destinations}
                        </CardDescription>
                      )}
                      {trip.groupName && (
                        <CardDescription className="mt-1 flex items-center gap-1 text-muted-foreground line-clamp-1">
                          <Users className="h-3 w-3" />
                          {trip.groupName}
                        </CardDescription>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Delete trip"
                      disabled={deletingTripId === trip.id}
                      className="-mr-1 -mt-1 h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => void handleDelete(trip.id, e)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pb-2 pt-4">
                  <div className="flex w-max items-center gap-2 rounded-lg bg-accent/20 px-3 py-1.5 text-sm text-muted-foreground">
                    <CalendarIcon className="h-4 w-4 text-primary" />
                    {format(tripStartDate, 'MMM d, yyyy')} &rarr; {format(tripEndDate, 'MMM d')}
                    <span className="mx-1 opacity-50">&bull;</span>
                    <span className="font-medium text-foreground/80">{days} days</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total Spend</span>
                      <span className={`font-bold ${financialSummary.isOverBudget ? 'text-destructive' : ''}`}>
                        {formatAmount(totalSpend)}
                      </span>
                    </div>

                    {financialSummary.hasBudget && typeof trip.budget === 'number' && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Budget: {formatAmount(trip.budget)}</span>
                          <span>{financialSummary.budgetProgress.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                          <div
                            className={`h-full rounded-full transition-all ${
                              financialSummary.isOverBudget
                                ? 'bg-destructive'
                                : financialSummary.budgetProgress > 85
                                  ? 'bg-amber-500'
                                  : 'bg-primary'
                            }`}
                            style={{ width: `${financialSummary.budgetProgress}%` }}
                          />
                        </div>
                        {typeof financialSummary.remainingBudget === 'number' && (
                          <p className={`text-xs ${financialSummary.remainingBudget < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {financialSummary.remainingBudget < 0 ? 'Over budget by ' : 'Budget left: '}
                            {formatAmount(Math.abs(financialSummary.remainingBudget))}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {financialSummary.hasGroupSetup && (
                    <div className="rounded-xl border border-primary/15 bg-primary/[0.04] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">
                            <Users className="h-3.5 w-3.5" />
                            Shared Group
                          </p>
                          <p className="mt-1 text-sm font-semibold">{trip.groupName || 'Shared Friend Group'}</p>
                        </div>
                        {typeof trip.groupSize === 'number' && (
                          <span className="rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                            {trip.groupSize} travelers
                          </span>
                        )}
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div className="space-y-1">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Shared Spend</p>
                          <p className="font-semibold">{formatAmount(financialSummary.sharedGroupSpend)}</p>
                        </div>
                        {typeof trip.groupFund === 'number' && (
                          <div className="space-y-1">
                            <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                              <DollarSign className="h-3 w-3" />
                              Group Fund
                            </p>
                            <p className="font-semibold">{formatAmount(trip.groupFund)}</p>
                          </div>
                        )}
                        {typeof financialSummary.remainingGroupFund === 'number' && (
                          <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Fund Left</p>
                            <p className={`font-semibold ${financialSummary.remainingGroupFund < 0 ? 'text-destructive' : ''}`}>
                              {formatAmount(financialSummary.remainingGroupFund)}
                            </p>
                          </div>
                        )}
                        {typeof financialSummary.perPersonSharedSpend === 'number' && (
                          <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Per Person Shared Spend</p>
                            <p className="font-semibold">{formatAmount(financialSummary.perPersonSharedSpend)}</p>
                          </div>
                        )}
                        {typeof financialSummary.perPersonFundTarget === 'number' && (
                          <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Fund Per Person</p>
                            <p className="font-semibold">{formatAmount(financialSummary.perPersonFundTarget)}</p>
                          </div>
                        )}
                      </div>

                      {typeof financialSummary.groupFundProgress === 'number' && (
                        <div className="mt-3 space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Group fund usage</span>
                            <span>{financialSummary.groupFundProgress.toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-background/70">
                            <div
                              className={`h-full rounded-full transition-all ${
                                financialSummary.isOverGroupFund ? 'bg-destructive' : 'bg-primary'
                              }`}
                              style={{ width: `${financialSummary.groupFundProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex items-center justify-between border-t border-border/10 pb-4 pt-2 text-xs text-muted-foreground">
                  <span>{tripExpenses.length} transactions</span>
                  {(sharedGroupExpenses.length > 0 || typeof trip.groupSize === 'number') && (
                    <div className="flex items-center gap-3">
                      {sharedGroupExpenses.length > 0 && <span>{sharedGroupExpenses.length} shared group</span>}
                      {typeof trip.groupSize === 'number' && <span>Split across {trip.groupSize}</span>}
                    </div>
                  )}
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingTrip ? 'Edit Trip' : 'Create New Trip'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="name">Trip Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Summer Vacation"
                required
                className="rounded-xl border-border/60 bg-muted/20 focus:bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="destinations">Destination(s)</Label>
              <Input
                id="destinations"
                value={destinations}
                onChange={(e) => setDestinations(e.target.value)}
                placeholder="e.g. Bali, Indonesia"
                className="rounded-xl border-border/60 bg-muted/20 focus:bg-background"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start">Start Date *</Label>
                <Input
                  id="start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="rounded-xl border-border/60 bg-muted/20 focus:bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">End Date *</Label>
                <Input
                  id="end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="rounded-xl border-border/60 bg-muted/20 focus:bg-background"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget">Total Budget (Optional)</Label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </div>
                <Input
                  id="budget"
                  type="number"
                  min="0"
                  step="1000"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="e.g. 500000"
                  className="rounded-xl border-border/60 bg-muted/20 pl-9 focus:bg-background"
                />
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-border/50 bg-muted/15 p-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold">Shared Friend Group</p>
                <p className="text-xs text-muted-foreground">
                  Record one pooled fund for the whole trip and split total usage across the group.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="group-name">Group Name (Optional)</Label>
                <Input
                  id="group-name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Bali Crew"
                  className="rounded-xl border-border/60 bg-muted/20 focus:bg-background"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="group-size">Total Travelers</Label>
                  <Input
                    id="group-size"
                    type="number"
                    min="2"
                    step="1"
                    value={groupSize}
                    onChange={(e) => setGroupSize(e.target.value)}
                    placeholder="e.g. 4"
                    className="rounded-xl border-border/60 bg-muted/20 focus:bg-background"
                  />
                  <p className="text-[11px] text-muted-foreground">Include yourself in the count.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="group-fund">Group Fund</Label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Input
                      id="group-fund"
                      type="number"
                      min="0"
                      step="100"
                      value={groupFund}
                      onChange={(e) => setGroupFund(e.target.value)}
                      placeholder="e.g. 8000"
                      className="rounded-xl border-border/60 bg-muted/20 pl-9 focus:bg-background"
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={handleCloseModal} className="rounded-xl">
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving} className="rounded-xl bg-gradient-to-r from-primary to-primary/85 shadow-sm">
                {editingTrip ? 'Save Changes' : 'Create Trip'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
