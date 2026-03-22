'use client'

import React, { useState } from 'react'
import { PlusCircle, Search, Plane, Trash2, MapPin, Calendar as CalendarIcon, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useApp } from '@/contexts/AppContext'
import { Trip } from '@/types'
import { format, differenceInDays } from 'date-fns'

export default function TripsPage() {
  const { trips, addTrip, updateTrip, deleteTrip, expenses } = useApp()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingTripId, setDeletingTripId] = useState<string | null>(null)

  // Form states
  const [name, setName] = useState('')
  const [destinations, setDestinations] = useState('')
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(Date.now() + 7 * 86400000), 'yyyy-MM-dd'))
  const [budget, setBudget] = useState('')
  const [search, setSearch] = useState('')

  const handleOpenModal = (trip?: Trip) => {
    if (trip) {
      setEditingTrip(trip)
      setName(trip.name)
      setDestinations(trip.destinations || '')
      setStartDate(trip.startDate)
      setEndDate(trip.endDate)
      setBudget(trip.budget?.toString() || '')
    } else {
      setEditingTrip(null)
      setName('')
      setDestinations('')
      setStartDate(format(new Date(), 'yyyy-MM-dd'))
      setEndDate(format(new Date(Date.now() + 7 * 86400000), 'yyyy-MM-dd'))
      setBudget('')
    }
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !startDate || !endDate) return

    const tripData = {
      name,
      destinations,
      startDate,
      endDate,
      budget: budget ? parseFloat(budget) : undefined
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

  // Filter trips by search
  const filteredTrips = trips.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    (t.destinations && t.destinations.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Travel Trips</h1>
          <p className="text-sm text-muted-foreground">Manage your trips and travel budgets</p>
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
            placeholder="Search trips or destinations..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl border-border/60 bg-card/60"
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
              : "No trips match your search criteria."}
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
          {filteredTrips.map(trip => {
            const tripExpenses = expenses.filter(e => e.tripId === trip.id)
            const totalSpend = tripExpenses.reduce((sum, e) => sum + e.amount, 0)
            const days = Math.max(1, differenceInDays(new Date(trip.endDate), new Date(trip.startDate)) + 1)
            
            let progress = 0
            if (trip.budget) {
              progress = Math.min((totalSpend / trip.budget) * 100, 100)
            }
            const isOverBudget = trip.budget && totalSpend > trip.budget

            return (
              <Card 
                key={trip.id} 
                className="group relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-md cursor-pointer border-border/40 hover:border-primary/30"
                onClick={() => handleOpenModal(trip)}
              >
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.03] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                
                <CardHeader className="pb-3 border-b border-border/20 bg-muted/20">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg line-clamp-1">{trip.name}</CardTitle>
                      {trip.destinations && (
                        <CardDescription className="flex items-center gap-1 mt-1 font-medium text-primary/80 line-clamp-1">
                          <MapPin className="h-3 w-3" />
                          {trip.destinations}
                        </CardDescription>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Delete trip"
                      disabled={deletingTripId === trip.id}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0 -mt-1 -mr-1"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => void handleDelete(trip.id, e)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 pb-2 space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-accent/20 px-3 py-1.5 rounded-lg w-max">
                    <CalendarIcon className="h-4 w-4 text-primary" />
                    {format(new Date(trip.startDate), 'MMM d, yyyy')} &rarr; {format(new Date(trip.endDate), 'MMM d')}
                    <span className="opacity-50 mx-1">•</span>
                    <span className="font-medium text-foreground/80">{days} days</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total Spend</span>
                      <span className={`font-bold ${isOverBudget ? 'text-destructive' : ''}`}>
                        {totalSpend.toLocaleString()}
                      </span>
                    </div>
                    
                    {trip.budget && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Budget: {trip.budget.toLocaleString()}</span>
                          <span>{progress.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isOverBudget ? 'bg-destructive' 
                                : progress > 85 ? 'bg-amber-500' 
                                : 'bg-primary'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="pt-2 pb-4 text-xs text-muted-foreground flex items-center justify-between border-t border-border/10">
                  <span>{tripExpenses.length} transactions</span>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingTrip ? 'Edit Trip' : 'Create New Trip'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="name">Trip Name *</Label>
              <Input 
                id="name" 
                value={name} 
                onChange={e => setName(e.target.value)} 
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
                onChange={e => setDestinations(e.target.value)} 
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
                  onChange={e => setStartDate(e.target.value)} 
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
                  onChange={e => setEndDate(e.target.value)} 
                  required
                  className="rounded-xl border-border/60 bg-muted/20 focus:bg-background"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget">Total Budget (Optional)</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Wallet className="w-4 h-4 text-muted-foreground" />
                </div>
                <Input 
                  id="budget" 
                  type="number" 
                  min="0"
                  step="1000"
                  value={budget} 
                  onChange={e => setBudget(e.target.value)} 
                  placeholder="e.g. 500000"
                  className="pl-9 rounded-xl border-border/60 bg-muted/20 focus:bg-background"
                />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={handleCloseModal} className="rounded-xl">Cancel</Button>
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
