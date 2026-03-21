'use client'

import React, { useState } from 'react'
import { UserCircle, PlusCircle, Trash2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useApp } from '@/contexts/AppContext'

export function UserSwitcher() {
  const { profiles, activeProfile, switchUser, addProfile, removeProfile } = useApp()
  const [newName, setNewName] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const handleAdd = () => {
    if (!newName.trim()) return
    const profile = addProfile(newName.trim())
    setNewName('')
    switchUser(profile.id)
    setIsOpen(false)
  }

  const handleSwitch = (userId: string) => {
    switchUser(userId)
    setIsOpen(false)
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        className="flex items-center gap-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground px-2 py-1.5 transition-colors hover:bg-accent/60"
        title={activeProfile?.name || 'User'}
      >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm">
            {activeProfile?.avatar || '👤'}
          </span>
          <span className="hidden lg:inline max-w-[80px] truncate">{activeProfile?.name || 'User'}</span>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="space-y-1">
          <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Switch User
          </p>
          {profiles.map(profile => (
            <div
              key={profile.id}
              className={`flex items-center justify-between rounded-lg px-2 py-2 cursor-pointer transition-colors ${
                profile.id === activeProfile?.id
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-accent/60'
              }`}
              onClick={() => handleSwitch(profile.id)}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm">
                  {profile.avatar || profile.name.charAt(0)}
                </span>
                <span className="text-sm font-medium truncate max-w-[120px]">{profile.name}</span>
              </div>
              <div className="flex items-center gap-1">
                {profile.id === activeProfile?.id && (
                  <Check className="h-4 w-4 text-primary" />
                )}
                {profiles.length > 1 && profile.id !== activeProfile?.id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`Remove "${profile.name}"? All their data will be deleted.`)) {
                        removeProfile(profile.id)
                      }
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}

          <div className="border-t border-border/40 mt-2 pt-2">
            <div className="flex gap-1.5">
              <Input
                placeholder="New user name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                className="h-8 text-xs"
              />
              <Button size="sm" className="h-8 px-2 shrink-0" onClick={handleAdd} disabled={!newName.trim()}>
                <PlusCircle className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
