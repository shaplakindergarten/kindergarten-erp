"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Download, X } from "lucide-react"

declare global {
  interface WindowEventMap {
    beforeinstallprompt: Event
  }
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowPrompt(true)
    }

    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    
    if (outcome === "accepted") {
      console.log("PWA installed successfully")
      setShowPrompt(false)
    }
    
    setDeferredPrompt(null)
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 animate-in slide-in-from-bottom-5">
      <div className="flex items-start gap-3">
        <div className="bg-blue-100 dark:bg-blue-900 rounded-full p-2">
          <Download className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">Install KinderERP App</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Install the app on your device for easy access to attendance management.
          </p>
        </div>
        <Button size="sm" onClick={handleInstall} className="bg-blue-600 hover:bg-blue-700 text-white">
          Install
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowPrompt(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}