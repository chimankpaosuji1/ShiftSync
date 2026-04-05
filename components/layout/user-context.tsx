'use client'
import { createContext, useContext } from 'react'

interface UserCtx { id: string; name: string; role: string }

const UserContext = createContext<UserCtx>({ id: '', name: '', role: '' })

export function UserProvider({ user, children }: { user: UserCtx; children: React.ReactNode }) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>
}

export function useUser() {
  return useContext(UserContext)
}
