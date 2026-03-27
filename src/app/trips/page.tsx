'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { differenceInDays, format, parseISO } from 'date-fns'
import {
  ArrowRightLeft,
  Calendar as CalendarIcon,
  DollarSign,
  MapPin,
  PencilLine,
  Plane,
  PlusCircle,
  Search,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApp } from '@/contexts/AppContext'
import { getCurrencyDisplayLabel } from '@/lib/settings'
import {
  buildTripSettlementSuggestions,
  calculateTripMemberBalances,
  getTripFinancialSummary,
} from '@/lib/trips'
import type { Trip, TripMember, TripSettlement } from '@/types'

const amountFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
})

type TripMemberApiRecord = {
  id?: string
  trip?: string
  name?: string
  isOwner?: boolean
  sortOrder?: number
  created?: string
  updated?: string
}

type TripSettlementApiRecord = {
  id?: string
  trip?: string
  fromMemberId?: string
  toMemberId?: string
  amount?: number
  date?: string
  status?: string
  note?: string
  created?: string
  updated?: string
}

type ApiListResponse<T> = {
  items?: T[]
  error?: string
}

type SettlementFormState = {
  tripId: string
  fromMemberId: string
  toMemberId: string
  amount: string
  date: string
  status: 'planned' | 'paid'
  note: string
}

function sortMembers(a: TripMember, b: TripMember): number {
  if (a.isOwner && !b.isOwner) return -1
  if (!a.isOwner && b.isOwner) return 1
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)
}

function normalizeTripMemberRecord(raw: TripMemberApiRecord): TripMember | null {
  if (!raw.id || !raw.trip || !raw.name) {
    return null
  }

  return {
    id: raw.id,
    tripId: raw.trip,
    name: raw.name,
    isOwner: raw.isOwner === true,
    sortOrder: typeof raw.sortOrder === 'number' ? raw.sortOrder : undefined,
    createdAt: raw.created ?? new Date().toISOString(),
    updatedAt: raw.updated,
  }
}

function normalizeTripSettlementRecord(raw: TripSettlementApiRecord): TripSettlement | null {
  if (
    !raw.id ||
    !raw.trip ||
    !raw.fromMemberId ||
    !raw.toMemberId ||
    typeof raw.amount !== 'number' ||
    !raw.date ||
    (raw.status !== 'planned' && raw.status !== 'paid')
  ) {
    return null
  }

  return {
    id: raw.id,
    tripId: raw.trip,
    fromMemberId: raw.fromMemberId,
    toMemberId: raw.toMemberId,
    amount: raw.amount,
    date: raw.date,
    status: raw.status,
    note: raw.note,
    createdAt: raw.created ?? new Date().toISOString(),
    updatedAt: raw.updated,
  }
}

function parseParticipantNames(text: string): string[] {
  return text
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function buildDesiredParticipantNames(text: string, groupSize: number | null): string[] {
  const names = parseParticipantNames(text)
  const desiredCount = Math.max(names.length, groupSize ?? 0)

  if (desiredCount === 0) {
    return []
  }

  const nextNames = [...names]
  while (nextNames.length < desiredCount) {
    nextNames.push(`Traveler ${nextNames.length + 1}`)
  }

  return nextNames
}

function buildParticipantText(members: TripMember[]): string {
  return [...members].sort(sortMembers).map((member) => member.name).join('\n')
}

function formatDateLabel(value: string): string {
  try {
    return format(parseISO(value), 'MMM d, yyyy')
  } catch {
    return value
  }
}


export default function TripsPage() {
  const { trips, addTrip, updateTrip, deleteTrip, expenses, settings } = useApp()
  const displayCurrency = getCurrencyDisplayLabel(settings)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isSyncingMembers, setIsSyncingMembers] = useState(false)
  const [deletingTripId, setDeletingTripId] = useState<string | null>(null)
  const [tripMembers, setTripMembers] = useState<TripMember[]>([])
  const [tripSettlements, setTripSettlements] = useState<TripSettlement[]>([])
  const [isMembersLoading, setIsMembersLoading] = useState(true)
  const [isSettlementsLoading, setIsSettlementsLoading] = useState(true)
  const [membersError, setMembersError] = useState<string | null>(null)
  const [settlementsError, setSettlementsError] = useState<string | null>(null)
  const [isSettlementDialogOpen, setIsSettlementDialogOpen] = useState(false)
  const [isSettlementSaving, setIsSettlementSaving] = useState(false)
  const [deletingSettlementId, setDeletingSettlementId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [destinations, setDestinations] = useState('')
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(Date.now() + 7 * 86400000), 'yyyy-MM-dd'))
  const [budget, setBudget] = useState('')
  const [groupName, setGroupName] = useState('')
  const [groupSize, setGroupSize] = useState('')
  const [groupFund, setGroupFund] = useState('')
  const [participantNamesText, setParticipantNamesText] = useState('')
  const [search, setSearch] = useState('')
  const [settlementForm, setSettlementForm] = useState<SettlementFormState>({
    tripId: '',
    fromMemberId: '',
    toMemberId: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    status: 'paid',
    note: '',
  })

  const formatAmount = useCallback(
    (value: number) => `${amountFormatter.format(value)} ${displayCurrency}`,
    [displayCurrency]
  )

  const fetchTripMembers = useCallback(async () => {
    try {
      setIsMembersLoading(true)
      setMembersError(null)
      const response = await fetch('/api/trip-members?perPage=500')
      const data = (await response.json()) as ApiListResponse<TripMemberApiRecord>
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load trip participants')
      }

      const normalized = (data.items ?? [])
        .map(normalizeTripMemberRecord)
        .filter((item): item is TripMember => item !== null)
        .sort(sortMembers)
      setTripMembers(normalized)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load trip participants'
      setMembersError(message)
      setTripMembers([])
    } finally {
      setIsMembersLoading(false)
    }
  }, [])

  const fetchTripSettlements = useCallback(async () => {
    try {
      setIsSettlementsLoading(true)
      setSettlementsError(null)
      const response = await fetch('/api/trip-settlements?perPage=500')
      const data = (await response.json()) as ApiListResponse<TripSettlementApiRecord>
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load settlements')
      }

      const normalized = (data.items ?? [])
        .map(normalizeTripSettlementRecord)
        .filter((item): item is TripSettlement => item !== null)
      setTripSettlements(normalized)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load settlements'
      setSettlementsError(message)
      setTripSettlements([])
    } finally {
      setIsSettlementsLoading(false)
    }
  }, [])

  useEffect(() => {
    void Promise.all([fetchTripMembers(), fetchTripSettlements()])
  }, [fetchTripMembers, fetchTripSettlements])

  const membersByTrip = useMemo(() => {
    const map = new Map<string, TripMember[]>()
    for (const member of tripMembers) {
      const list = map.get(member.tripId) ?? []
      list.push(member)
      map.set(member.tripId, list)
    }
    for (const [tripId, members] of map.entries()) {
      map.set(tripId, [...members].sort(sortMembers))
    }
    return map
  }, [tripMembers])

  const settlementsByTrip = useMemo(() => {
    const map = new Map<string, TripSettlement[]>()
    for (const settlement of tripSettlements) {
      const list = map.get(settlement.tripId) ?? []
      list.push(settlement)
      map.set(settlement.tripId, list)
    }
    return map
  }, [tripSettlements])

  const tripMemberLookup = useMemo(
    () => new Map(tripMembers.map((member) => [member.id, member])),
    [tripMembers]
  )

  const filteredTrips = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    if (!normalizedSearch) {
      return trips
    }

    return trips.filter((trip) => {
      const members = membersByTrip.get(trip.id) ?? []
      return (
        trip.name.toLowerCase().includes(normalizedSearch) ||
        (trip.destinations ?? '').toLowerCase().includes(normalizedSearch) ||
        (trip.groupName ?? '').toLowerCase().includes(normalizedSearch) ||
        members.some((member) => member.name.toLowerCase().includes(normalizedSearch))
      )
    })
  }, [membersByTrip, search, trips])

  const settlementTrip = trips.find((trip) => trip.id === settlementForm.tripId) ?? null
  const settlementMembers = settlementTrip ? membersByTrip.get(settlementTrip.id) ?? [] : []
  const selectedSettlementFromMember = settlementMembers.find((member) => member.id === settlementForm.fromMemberId)
  const selectedSettlementToMember = settlementMembers.find((member) => member.id === settlementForm.toMemberId)

  const resetTripForm = () => {
    setEditingTrip(null)
    setName('')
    setDestinations('')
    setStartDate(format(new Date(), 'yyyy-MM-dd'))
    setEndDate(format(new Date(Date.now() + 7 * 86400000), 'yyyy-MM-dd'))
    setBudget('')
    setGroupName('')
    setGroupSize('')
    setGroupFund('')
    setParticipantNamesText('')
  }

  const handleOpenModal = (trip?: Trip) => {
    if (trip) {
      const existingMembers = membersByTrip.get(trip.id) ?? []
      setEditingTrip(trip)
      setName(trip.name)
      setDestinations(trip.destinations || '')
      setStartDate(trip.startDate)
      setEndDate(trip.endDate)
      setBudget(trip.budget?.toString() || '')
      setGroupName(trip.groupName || '')
      setGroupSize(trip.groupSize?.toString() || '')
      setGroupFund(trip.groupFund?.toString() || '')
      setParticipantNamesText(buildParticipantText(existingMembers))
    } else {
      resetTripForm()
    }

    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    resetTripForm()
  }


  const syncTripMembers = useCallback(async (tripId: string, namesText: string, groupSizeValue: number | null) => {
    const desiredNames = buildDesiredParticipantNames(namesText, groupSizeValue)
    const existingMembers = [...(membersByTrip.get(tripId) ?? [])].sort(sortMembers)

    let didChange = false

    for (let index = 0; index < desiredNames.length; index += 1) {
      const desiredName = desiredNames[index]
      const existing = existingMembers[index]
      const payload = {
        tripId,
        name: desiredName,
        isOwner: index === 0,
        sortOrder: index,
      }

      if (existing) {
        const shouldUpdate =
          existing.name !== desiredName ||
          existing.isOwner !== payload.isOwner ||
          (existing.sortOrder ?? index) !== index
        if (!shouldUpdate) continue

        const response = await fetch(`/api/trip-members/${existing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await response.json() as { error?: string }
        if (!response.ok) {
          throw new Error(data.error || `Failed to update participant ${existing.name}`)
        }
        didChange = true
        continue
      }

      const response = await fetch('/api/trip-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json() as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || `Failed to create participant ${desiredName}`)
      }
      didChange = true
    }

    for (const extraMember of existingMembers.slice(desiredNames.length)) {
      const response = await fetch(`/api/trip-members/${extraMember.id}`, {
        method: 'DELETE',
      })
      const data = await response.json() as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || `Failed to delete participant ${extraMember.name}`)
      }
      didChange = true
    }

    if (didChange || desiredNames.length === 0 || existingMembers.length === 0) {
      await fetchTripMembers()
    }
  }, [fetchTripMembers, membersByTrip])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !startDate || !endDate || isSaving) return

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
      let savedTrip: Trip | null
      if (editingTrip) {
        savedTrip = await updateTrip(editingTrip.id, tripData)
      } else {
        savedTrip = await addTrip(tripData)
        setEditingTrip(savedTrip)
      }

      if (!savedTrip) {
        throw new Error('Trip no longer exists')
      }

      setIsSyncingMembers(true)
      await syncTripMembers(savedTrip.id, participantNamesText, parsedGroupSize)
      handleCloseModal()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save trip'
      alert(message)
    } finally {
      setIsSyncingMembers(false)
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (deletingTripId === id) return

    if (confirm('Are you sure you want to delete this trip? Linked expenses will lose the trip reference.')) {
      try {
        setDeletingTripId(id)
        await deleteTrip(id)
        setTripMembers((prev) => prev.filter((member) => member.tripId !== id))
        setTripSettlements((prev) => prev.filter((settlement) => settlement.tripId !== id))
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete trip'
        alert(message)
      } finally {
        setDeletingTripId(null)
      }
    }
  }

  const openSettlementDialog = (
    trip: Trip,
    suggestion?: { fromMemberId: string; toMemberId: string; amount: number }
  ) => {
    const members = membersByTrip.get(trip.id) ?? []

    setSettlementForm({
      tripId: trip.id,
      fromMemberId: suggestion?.fromMemberId ?? members[1]?.id ?? members[0]?.id ?? '',
      toMemberId: suggestion?.toMemberId ?? members[0]?.id ?? '',
      amount: suggestion ? suggestion.amount.toFixed(2) : '',
      date: format(new Date(), 'yyyy-MM-dd'),
      status: 'paid',
      note: '',
    })
    setIsSettlementDialogOpen(true)
  }

  const handleSaveSettlement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!settlementForm.tripId || isSettlementSaving) return

    const amount = Number(settlementForm.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Settlement amount must be a positive number')
      return
    }

    if (!settlementForm.fromMemberId || !settlementForm.toMemberId) {
      alert('Select both group members')
      return
    }

    if (settlementForm.fromMemberId === settlementForm.toMemberId) {
      alert('Choose two different members')
      return
    }

    try {
      setIsSettlementSaving(true)
      const response = await fetch('/api/trip-settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: settlementForm.tripId,
          fromMemberId: settlementForm.fromMemberId,
          toMemberId: settlementForm.toMemberId,
          amount,
          date: settlementForm.date,
          status: settlementForm.status,
          note: settlementForm.note.trim() || undefined,
        }),
      })
      const data = await response.json() as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || 'Failed to record settlement')
      }

      await fetchTripSettlements()
      setIsSettlementDialogOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to record settlement'
      alert(message)
    } finally {
      setIsSettlementSaving(false)
    }
  }

  const handleDeleteSettlement = async (settlementId: string) => {
    if (deletingSettlementId === settlementId) return

    if (!confirm('Delete this settlement record?')) {
      return
    }

    try {
      setDeletingSettlementId(settlementId)
      const response = await fetch(`/api/trip-settlements/${settlementId}`, {
        method: 'DELETE',
      })
      const data = await response.json() as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete settlement')
      }
      await fetchTripSettlements()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete settlement'
      alert(message)
    } finally {
      setDeletingSettlementId(null)
    }
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Travel Trips</h1>
          <p className="text-sm text-muted-foreground">
            Plan budgets, manage group participants, and settle shared trip spending.
          </p>
        </div>
        <Button
          onClick={() => handleOpenModal()}
          className="rounded-xl bg-gradient-to-r from-primary to-primary/85 shadow-sm shadow-primary/20 hover:shadow-md hover:shadow-primary/25"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Trip
        </Button>
      </div>

      {trips.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search trips, destinations, groups, or participant names..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border-border/60 bg-card/60 pl-9"
          />
        </div>
      )}

      {(membersError || settlementsError) && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="space-y-1 py-4 text-sm text-amber-800">
            {membersError && <p>Participants: {membersError}</p>}
            {settlementsError && <p>Settlements: {settlementsError}</p>}
          </CardContent>
        </Card>
      )}

      {filteredTrips.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 bg-card/40 p-8 text-center backdrop-blur-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Plane className="h-8 w-8 text-primary/80" />
          </div>
          <h3 className="mb-2 text-lg font-semibold tracking-tight">No trips found</h3>
          <p className="mb-6 max-w-sm text-sm text-muted-foreground">
            {trips.length === 0
              ? 'Create a trip to track travel budgets, group funds, and shared settle-up balances.'
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
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {filteredTrips.map((trip) => {
            const tripExpenses = expenses.filter((expense) => expense.tripId === trip.id)
            const sharedGroupExpenses = tripExpenses.filter((expense) => expense.sharedGroupExpense)
            const totalSpend = tripExpenses.reduce((sum, expense) => sum + expense.amount, 0)
            const sharedGroupSpend = sharedGroupExpenses.reduce((sum, expense) => sum + expense.amount, 0)
            const tripStartDate = parseISO(trip.startDate)
            const tripEndDate = parseISO(trip.endDate)
            const days = Math.max(1, differenceInDays(tripEndDate, tripStartDate) + 1)
            const financialSummary = getTripFinancialSummary(trip, totalSpend, sharedGroupSpend)
            const members = membersByTrip.get(trip.id) ?? []
            const settlements = settlementsByTrip.get(trip.id) ?? []
            const balances = calculateTripMemberBalances(trip, members, sharedGroupExpenses, settlements)
            const settlementSuggestions = buildTripSettlementSuggestions(balances)
            const activeBalanceCount = balances.filter((member) => Math.abs(member.netBalance) > 0.009).length
            const recentSettlements = settlements.slice(0, 3)

            return (
              <Card
                key={trip.id}
                className="overflow-hidden border-border/40 bg-card/90 shadow-sm transition-all hover:border-primary/25 hover:shadow-md"
              >
                <CardHeader className="border-b border-border/20 bg-muted/20 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="line-clamp-1 text-lg">{trip.name}</CardTitle>
                      {trip.destinations && (
                        <CardDescription className="flex items-center gap-1 font-medium text-primary/80">
                          <MapPin className="h-3 w-3" />
                          {trip.destinations}
                        </CardDescription>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Badge variant="secondary">
                          <CalendarIcon className="h-3 w-3" />
                          {format(tripStartDate, 'MMM d')} to {format(tripEndDate, 'MMM d')}
                        </Badge>
                        <Badge variant="outline">{days} days</Badge>
                        {trip.groupSize && <Badge variant="outline">{trip.groupSize} travelers</Badge>}
                        {members.length > 0 && <Badge variant="outline">{members.length} tracked members</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => handleOpenModal(trip)}
                      >
                        <PencilLine className="mr-2 h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Delete trip"
                        disabled={deletingTripId === trip.id}
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => void handleDelete(trip.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pb-3 pt-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/40 bg-background/50 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Total Spend</p>
                      <p className={`mt-2 text-lg font-semibold ${financialSummary.isOverBudget ? 'text-destructive' : ''}`}>
                        {formatAmount(totalSpend)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{tripExpenses.length} trip transactions</p>
                    </div>
                    <div className="rounded-xl border border-border/40 bg-background/50 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Shared Group Spend</p>
                      <p className="mt-2 text-lg font-semibold">{formatAmount(sharedGroupSpend)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {sharedGroupExpenses.length} shared transactions
                      </p>
                    </div>
                  </div>

                  {financialSummary.hasBudget && typeof trip.budget === 'number' && (
                    <div className="space-y-1.5 rounded-xl border border-border/40 bg-background/50 p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Trip Budget</span>
                        <span className={`font-semibold ${financialSummary.isOverBudget ? 'text-destructive' : ''}`}>
                          {formatAmount(trip.budget)}
                        </span>
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


                  {financialSummary.hasGroupSetup && (
                    <div className="rounded-xl border border-primary/15 bg-primary/[0.04] p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">
                            <Users className="h-3.5 w-3.5" />
                            Shared Friend Group
                          </p>
                          <p className="mt-1 text-sm font-semibold">{trip.groupName || 'Shared Friend Group'}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Shared expenses are split across the tracked group members below.
                          </p>
                        </div>
                        {typeof trip.groupFund === 'number' && (
                          <div className="rounded-xl bg-background/80 px-3 py-2 text-right">
                            <p className="flex items-center justify-end gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                              <DollarSign className="h-3 w-3" />
                              Group Fund
                            </p>
                            <p className="mt-1 font-semibold">{formatAmount(trip.groupFund)}</p>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
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
                        <div className="space-y-1">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Outstanding Balances</p>
                          <p className="font-semibold">{activeBalanceCount > 0 ? activeBalanceCount : 'All settled'}</p>
                        </div>
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

                      <div className="mt-4 flex flex-wrap gap-2">
                        {members.length > 0 ? (
                          members.map((member) => (
                            <Badge key={member.id} variant={member.isOwner ? 'default' : 'secondary'}>
                              {member.name}
                              {member.isOwner ? ' (You)' : ''}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Add participant names from Edit Trip so shared expenses can track who paid.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl border border-border/40 bg-background/50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                          Settle Up
                        </p>
                        <p className="mt-1 text-sm font-semibold">Friend-group balances</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Who paid for shared spending and who still needs to reimburse.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        disabled={members.length < 2}
                        onClick={() => openSettlementDialog(trip)}
                      >
                        Record Settlement
                      </Button>
                    </div>

                    {isMembersLoading || isSettlementsLoading ? (
                      <p className="mt-4 text-sm text-muted-foreground">Loading settle-up data...</p>
                    ) : members.length < 2 ? (
                      <p className="mt-4 text-sm text-muted-foreground">
                        Add at least two participants to calculate who owes what.
                      </p>
                    ) : sharedGroupExpenses.length === 0 && settlements.length === 0 ? (
                      <p className="mt-4 text-sm text-muted-foreground">
                        Shared expenses will show balances here after you record them from the expense form.
                      </p>
                    ) : (
                      <div className="mt-4 space-y-4">
                        {balances.length > 0 && (
                          <div className="space-y-2">
                            {balances.map((member) => (
                              <div
                                key={member.memberId}
                                className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2 text-sm"
                              >
                                <div>
                                  <p className="font-medium">{member.memberName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Paid {formatAmount(member.paidTotal)} and owes {formatAmount(member.shareOwed)}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p
                                    className={`font-semibold ${
                                      member.netBalance > 0.009
                                        ? 'text-emerald-600'
                                        : member.netBalance < -0.009
                                          ? 'text-amber-700'
                                          : 'text-muted-foreground'
                                    }`}
                                  >
                                    {member.netBalance > 0.009
                                      ? `Gets ${formatAmount(member.netBalance)}`
                                      : member.netBalance < -0.009
                                        ? `Owes ${formatAmount(Math.abs(member.netBalance))}`
                                        : 'Settled'}
                                  </p>
                                  {(member.settlementsIn > 0 || member.settlementsOut > 0) && (
                                    <p className="text-xs text-muted-foreground">
                                      Transfers in {formatAmount(member.settlementsIn)} / out {formatAmount(member.settlementsOut)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold">Suggested transfers</p>
                            <p className="text-xs text-muted-foreground">{settlementSuggestions.length} suggestion(s)</p>
                          </div>
                          {settlementSuggestions.length > 0 ? (
                            settlementSuggestions.map((suggestion, index) => (
                              <div
                                key={`${suggestion.fromMemberId}-${suggestion.toMemberId}-${index}`}
                                className="flex flex-col gap-2 rounded-lg border border-primary/15 bg-primary/[0.04] px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div>
                                  <p className="text-sm font-medium">
                                    {suggestion.fromMemberName} pays {suggestion.toMemberName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{formatAmount(suggestion.amount)}</p>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg"
                                  onClick={() => openSettlementDialog(trip, suggestion)}
                                >
                                  Record
                                </Button>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No transfers needed. The group is currently settled.
                            </p>
                          )}
                        </div>


                        {recentSettlements.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold">Recent settlements</p>
                              <p className="text-xs text-muted-foreground">{settlements.length} total</p>
                            </div>
                            {recentSettlements.map((settlement) => {
                              const fromMember = tripMemberLookup.get(settlement.fromMemberId)
                              const toMember = tripMemberLookup.get(settlement.toMemberId)

                              return (
                                <div
                                  key={settlement.id}
                                  className="flex flex-col gap-2 rounded-lg border border-border/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-sm font-medium">
                                        {fromMember?.name ?? 'Unknown'} to {toMember?.name ?? 'Unknown'}
                                      </p>
                                      <Badge variant={settlement.status === 'paid' ? 'default' : 'secondary'}>
                                        {settlement.status}
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      {formatDateLabel(settlement.date)} - {formatAmount(settlement.amount)}
                                      {settlement.note ? ` - ${settlement.note}` : ''}
                                    </p>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    disabled={deletingSettlementId === settlement.id}
                                    onClick={() => void handleDeleteSettlement(settlement.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-border/10 pb-4 pt-3 text-xs text-muted-foreground">
                  <span>{tripExpenses.length} trip transactions</span>
                  <div className="flex flex-wrap gap-3">
                    {sharedGroupExpenses.length > 0 && <span>{sharedGroupExpenses.length} shared group</span>}
                    {settlements.length > 0 && <span>{settlements.length} settlement records</span>}
                  </div>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseModal()
            return
          }
          setIsModalOpen(true)
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[560px]">
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
                  step="100"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="e.g. 5000"
                  className="rounded-xl border-border/60 bg-muted/20 pl-9 focus:bg-background"
                />
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-border/50 bg-muted/15 p-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold">Shared Friend Group</p>
                <p className="text-xs text-muted-foreground">
                  Keep one pooled fund, track who paid, and let the app suggest reimbursements.
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

              <div className="space-y-2">
                <Label htmlFor="participants">Participants</Label>
                <Textarea
                  id="participants"
                  rows={5}
                  value={participantNamesText}
                  onChange={(e) => setParticipantNamesText(e.target.value)}
                  placeholder={'One name per line\nYou\nAlice\nBob'}
                  className="rounded-xl border-border/60 bg-muted/20 focus:bg-background"
                />
                <p className="text-[11px] text-muted-foreground">
                  The first participant becomes the default owner. If traveler count is larger, placeholder members are created automatically.
                </p>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={handleCloseModal} className="rounded-xl">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving || isSyncingMembers}
                className="rounded-xl bg-gradient-to-r from-primary to-primary/85 shadow-sm"
              >
                {isSaving || isSyncingMembers
                  ? editingTrip
                    ? 'Saving trip...'
                    : 'Creating trip...'
                  : editingTrip
                    ? 'Save Changes'
                    : 'Create Trip'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>


      <Dialog open={isSettlementDialogOpen} onOpenChange={setIsSettlementDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Record Settlement</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveSettlement} className="space-y-4 py-2">
            <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Trip</p>
              <p className="mt-1 font-semibold">{settlementTrip?.name ?? 'Select a trip'}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>From</Label>
                <Select
                  value={settlementForm.fromMemberId}
                  onValueChange={(value) => setSettlementForm((prev) => ({ ...prev, fromMemberId: value ?? '' }))}
                >
                  <SelectTrigger className="w-full rounded-xl border-border/60 bg-muted/20">
                    <SelectValue placeholder="Who paid back?">
                      {selectedSettlementFromMember?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {settlementMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>To</Label>
                <Select
                  value={settlementForm.toMemberId}
                  onValueChange={(value) => setSettlementForm((prev) => ({ ...prev, toMemberId: value ?? '' }))}
                >
                  <SelectTrigger className="w-full rounded-xl border-border/60 bg-muted/20">
                    <SelectValue placeholder="Who received it?">
                      {selectedSettlementToMember?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {settlementMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="settlement-amount">Amount</Label>
                <Input
                  id="settlement-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={settlementForm.amount}
                  onChange={(e) => setSettlementForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="rounded-xl border-border/60 bg-muted/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="settlement-date">Date</Label>
                <Input
                  id="settlement-date"
                  type="date"
                  value={settlementForm.date}
                  onChange={(e) => setSettlementForm((prev) => ({ ...prev, date: e.target.value }))}
                  className="rounded-xl border-border/60 bg-muted/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={settlementForm.status}
                onValueChange={(value) => {
                  if (value === 'planned' || value === 'paid') {
                    setSettlementForm((prev) => ({ ...prev, status: value }))
                  }
                }}
              >
                <SelectTrigger className="w-full rounded-xl border-border/60 bg-muted/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="planned">Planned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="settlement-note">Note</Label>
              <Textarea
                id="settlement-note"
                rows={3}
                value={settlementForm.note}
                onChange={(e) => setSettlementForm((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="Optional note"
                className="rounded-xl border-border/60 bg-muted/20"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsSettlementDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSettlementSaving} className="rounded-xl">
                {isSettlementSaving ? 'Saving...' : 'Save Settlement'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

