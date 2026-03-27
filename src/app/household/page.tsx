'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Home, Pencil, PlusCircle, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useApp } from '@/contexts/AppContext'
import { t } from '@/i18n/config'
import { HouseholdMemberRecord, HouseholdRecord } from '@/lib/households'

type ApiListResponse<T> = {
  items?: T[]
  error?: string
}

type HouseholdFormState = {
  name: string
  baseCurrency: string
  note: string
}

type MemberFormState = {
  householdId: string
  name: string
  email: string
  role: 'owner' | 'member' | 'viewer'
  status: 'active' | 'invited'
}

const emptyHouseholdForm: HouseholdFormState = {
  name: '',
  baseCurrency: 'SGD',
  note: '',
}

const emptyMemberForm: MemberFormState = {
  householdId: '',
  name: '',
  email: '',
  role: 'member',
  status: 'invited',
}

export default function HouseholdPage() {
  const { settings } = useApp()
  const [households, setHouseholds] = useState<HouseholdRecord[]>([])
  const [members, setMembers] = useState<HouseholdMemberRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isHouseholdDialogOpen, setIsHouseholdDialogOpen] = useState(false)
  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false)
  const [editingHousehold, setEditingHousehold] = useState<HouseholdRecord | null>(null)
  const [editingMember, setEditingMember] = useState<HouseholdMemberRecord | null>(null)
  const [householdForm, setHouseholdForm] = useState<HouseholdFormState>({ ...emptyHouseholdForm, baseCurrency: settings.currency })
  const [memberForm, setMemberForm] = useState<MemberFormState>(emptyMemberForm)

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const [householdsResponse, membersResponse] = await Promise.all([
        fetch('/api/households'),
        fetch('/api/household-members'),
      ])
      const householdsData = await householdsResponse.json() as ApiListResponse<HouseholdRecord>
      const membersData = await membersResponse.json() as ApiListResponse<HouseholdMemberRecord>
      if (!householdsResponse.ok) {
        throw new Error(householdsData.error || t('common.error'))
      }
      if (!membersResponse.ok) {
        throw new Error(membersData.error || t('common.error'))
      }
      setHouseholds(householdsData.items ?? [])
      setMembers(membersData.items ?? [])
    } catch (loadError) {
      setHouseholds([])
      setMembers([])
      setError(loadError instanceof Error ? loadError.message : t('common.error'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const membersByHousehold = useMemo(() => {
    const map = new Map<string, HouseholdMemberRecord[]>()
    for (const member of members) {
      const list = map.get(member.householdId) ?? []
      list.push(member)
      map.set(member.householdId, list)
    }
    return map
  }, [members])

  const openCreateHousehold = () => {
    setEditingHousehold(null)
    setHouseholdForm({ ...emptyHouseholdForm, baseCurrency: settings.currency })
    setIsHouseholdDialogOpen(true)
  }

  const openEditHousehold = (household: HouseholdRecord) => {
    setEditingHousehold(household)
    setHouseholdForm({
      name: household.name,
      baseCurrency: household.baseCurrency ?? settings.currency,
      note: household.note ?? '',
    })
    setIsHouseholdDialogOpen(true)
  }

  const openCreateMember = (householdId?: string) => {
    setEditingMember(null)
    setMemberForm({ ...emptyMemberForm, householdId: householdId ?? households[0]?.id ?? '' })
    setIsMemberDialogOpen(true)
  }

  const openEditMember = (member: HouseholdMemberRecord) => {
    setEditingMember(member)
    setMemberForm({
      householdId: member.householdId,
      name: member.name,
      email: member.email,
      role: member.role,
      status: member.status,
    })
    setIsMemberDialogOpen(true)
  }

  const saveHousehold = async () => {
    if (!householdForm.name.trim()) return
    try {
      const response = await fetch(editingHousehold ? `/api/households/${editingHousehold.id}` : '/api/households', {
        method: editingHousehold ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: householdForm.name.trim(),
          baseCurrency: householdForm.baseCurrency.trim().toUpperCase(),
          note: householdForm.note.trim(),
        }),
      })
      const data = await response.json() as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || t('common.error'))
      }
      await loadData()
      setIsHouseholdDialogOpen(false)
    } catch (saveError) {
      alert(saveError instanceof Error ? saveError.message : t('common.error'))
    }
  }

  const saveMember = async () => {
    if (!memberForm.householdId || !memberForm.name.trim() || !memberForm.email.trim()) return
    try {
      const response = await fetch(editingMember ? `/api/household-members/${editingMember.id}` : '/api/household-members', {
        method: editingMember ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId: memberForm.householdId,
          name: memberForm.name.trim(),
          email: memberForm.email.trim(),
          role: memberForm.role,
          status: memberForm.status,
        }),
      })
      const data = await response.json() as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || t('common.error'))
      }
      await loadData()
      setIsMemberDialogOpen(false)
    } catch (saveError) {
      alert(saveError instanceof Error ? saveError.message : t('common.error'))
    }
  }

  const deleteHousehold = async (household: HouseholdRecord) => {
    if (!confirm(t('household.deleteConfirm', { name: household.name }))) return
    try {
      const response = await fetch(`/api/households/${household.id}`, { method: 'DELETE' })
      const data = await response.json() as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || t('common.error'))
      }
      await loadData()
    } catch (deleteError) {
      alert(deleteError instanceof Error ? deleteError.message : t('common.error'))
    }
  }

  const deleteMember = async (member: HouseholdMemberRecord) => {
    if (!confirm(t('household.deleteConfirm', { name: member.name }))) return
    try {
      const response = await fetch(`/api/household-members/${member.id}`, { method: 'DELETE' })
      const data = await response.json() as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || t('common.error'))
      }
      await loadData()
    } catch (deleteError) {
      alert(deleteError instanceof Error ? deleteError.message : t('common.error'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('household.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('household.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => openCreateMember()} disabled={households.length === 0}>
            <Users className="mr-2 h-4 w-4" />
            {t('household.addMember')}
          </Button>
          <Button className="rounded-xl" onClick={openCreateHousehold}>
            <PlusCircle className="mr-2 h-4 w-4" />
            {t('household.addHousehold')}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {isLoading ? (
          <Card className="border-border/40 xl:col-span-2"><CardContent className="py-10 text-sm text-muted-foreground">{t('common.loading')}...</CardContent></Card>
        ) : households.length === 0 ? (
          <Card className="border-dashed border-border/50 xl:col-span-2">
            <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Home className="h-6 w-6" /></div>
              <div>
                <h2 className="font-semibold">{t('household.noHouseholdTitle')}</h2>
                <p className="text-sm text-muted-foreground">{t('household.noHouseholdDesc')}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          households.map((household) => {
            const householdMembers = membersByHousehold.get(household.id) ?? []
            return (
              <Card key={household.id} className="border-border/40">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">{household.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('household.baseCurrency')}: {household.baseCurrency ?? settings.currency} · {householdMembers.length} {t('household.members')}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => openEditHousehold(household)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive" onClick={() => void deleteHousehold(household)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  {household.note && <p className="text-sm text-muted-foreground">{household.note}</p>}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{t('household.memberSectionTitle')}</p>
                      <Button variant="outline" size="sm" className="rounded-lg" onClick={() => openCreateMember(household.id)}>
                        <PlusCircle className="mr-2 h-3.5 w-3.5" />
                        {t('common.add')}
                      </Button>
                    </div>
                    {householdMembers.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border/50 px-4 py-6 text-sm text-muted-foreground">{t('household.noMembersHint')}</div>
                    ) : (
                      <div className="space-y-2">
                        {householdMembers.map((member) => (
                          <div key={member.id} className="flex items-center justify-between rounded-xl border border-border/40 px-4 py-3">
                            <div>
                              <p className="font-medium">{member.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {member.email} · {t(`household.${member.role}Role`)} · {t(`household.${member.status}Member`)}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => openEditMember(member)}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive" onClick={() => void deleteMember(member)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      <Dialog open={isHouseholdDialogOpen} onOpenChange={setIsHouseholdDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader><DialogTitle>{editingHousehold ? t('household.editHousehold') : t('household.addHousehold')}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label htmlFor="household-name">{t('common.name')}</Label><Input id="household-name" value={householdForm.name} onChange={(event) => setHouseholdForm((prev) => ({ ...prev, name: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="household-currency">{t('household.baseCurrency')}</Label><Input id="household-currency" maxLength={3} value={householdForm.baseCurrency} onChange={(event) => setHouseholdForm((prev) => ({ ...prev, baseCurrency: event.target.value.toUpperCase() }))} /></div>
            <div className="space-y-2"><Label htmlFor="household-note">{t('common.note')}</Label><Textarea id="household-note" rows={3} value={householdForm.note} onChange={(event) => setHouseholdForm((prev) => ({ ...prev, note: event.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHouseholdDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => void saveHousehold()}>{t('household.saveHousehold')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isMemberDialogOpen} onOpenChange={setIsMemberDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader><DialogTitle>{editingMember ? t('household.editMember') : t('household.addMember')}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('household.title')}</Label>
              <Select
                value={memberForm.householdId}
                onValueChange={(value) => setMemberForm((prev) => ({ ...prev, householdId: value ?? prev.householdId }))}
                disabled={Boolean(editingMember)}
              >
                <SelectTrigger><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                <SelectContent>
                  {households.map((household) => (
                    <SelectItem key={household.id} value={household.id}>{household.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editingMember && (
                <p className="text-xs text-muted-foreground">{t('household.noMembersHint')}</p>
              )}
            </div>
            <div className="space-y-2"><Label htmlFor="member-name">{t('common.name')}</Label><Input id="member-name" value={memberForm.name} onChange={(event) => setMemberForm((prev) => ({ ...prev, name: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="member-email">{t('common.email')}</Label><Input id="member-email" type="email" value={memberForm.email} onChange={(event) => setMemberForm((prev) => ({ ...prev, email: event.target.value }))} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('common.role')}</Label>
                <Select value={memberForm.role} onValueChange={(value) => setMemberForm((prev) => ({ ...prev, role: value as MemberFormState['role'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">{t('household.ownerRole')}</SelectItem>
                    <SelectItem value="member">{t('household.memberRole')}</SelectItem>
                    <SelectItem value="viewer">{t('household.viewerRole')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('common.status')}</Label>
                <Select value={memberForm.status} onValueChange={(value) => setMemberForm((prev) => ({ ...prev, status: value as MemberFormState['status'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invited">{t('household.invitedMember')}</SelectItem>
                    <SelectItem value="active">{t('household.activeMember')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMemberDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => void saveMember()}>{t('household.saveMember')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

