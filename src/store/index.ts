import { create } from 'zustand'
import type { User, Organization, AcademicYear, Student, Staff, Class, Section } from '@/types'

interface AppState {
  user: User | null
  organization: Organization | null
  academicYear: AcademicYear | null
  classes: Class[]
  sections: Section[]
  
  setUser: (user: User | null) => void
  setOrganization: (org: Organization | null) => void
  setAcademicYear: (year: AcademicYear | null) => void
  setClasses: (classes: Class[]) => void
  setSections: (sections: Section[]) => void
  
  sidebarCollapsed: boolean
  toggleSidebar: () => void
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  organization: null,
  academicYear: null,
  classes: [],
  sections: [],
  
  setUser: (user) => set({ user }),
  setOrganization: (organization) => set({ organization }),
  setAcademicYear: (academicYear) => set({ academicYear }),
  setClasses: (classes) => set({ classes }),
  setSections: (sections) => set({ sections }),
  
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}))

interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
}

interface ToastState {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Date.now().toString()
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }))
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }))
    }, 5000)
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}))
