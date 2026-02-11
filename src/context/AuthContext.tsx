import React, { createContext, useContext, useEffect, useState } from 'react'
import { auth } from '../services/firebase'
import { refreshProfile } from '../services/persistenceService'

interface AuthContextType {
  user: any
  profile: any
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      setLoading(true)
      
      // Listen for Firebase auth changes
      const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
        if (firebaseUser) {
          setUser(firebaseUser)
          
          // Get user profile from Supabase
          try {
            const profileData = await refreshProfile(firebaseUser.uid)
            setProfile(profileData)
          } catch (error) {
            console.error('Error fetching profile:', error)
          }
        } else {
          setUser(null)
          setProfile(null)
        }
        setLoading(false)
      })

      return unsubscribe
    }

    initAuth()
  }, [])

  const signOut = async () => {
    try {
      await auth.signOut()
      setUser(null)
      setProfile(null)
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const refreshProfileData = async () => {
    if (user) {
      try {
        const profileData = await refreshProfile(user.uid)
        setProfile(profileData)
      } catch (error) {
        console.error('Error refreshing profile:', error)
      }
    }
  }

  const value = {
    user,
    profile,
    loading,
    signOut,
    refreshProfile: refreshProfileData
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}