// H:\kindergarten-erp\src\components\dark-mode-initializer.tsx

"use client"

import { useEffect } from "react"

export default function DarkModeInitializer() {
  useEffect(() => {
    // ডার্কমোড ইনিশিয়ালাইজেশন
    const isDark = localStorage.getItem("darkMode") === "true" ||
      (!("darkMode" in localStorage) && 
       window.matchMedia("(prefers-color-scheme: dark)").matches)
    
    if (isDark) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
    
    // সিস্টেম থিম চেঞ্জ listening
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem("darkMode")) {
        if (e.matches) {
          document.documentElement.classList.add("dark")
        } else {
          document.documentElement.classList.remove("dark")
        }
      }
    }
    
    mediaQuery.addEventListener("change", handleChange)

    // NOTE: removed the global fetch wrapper because proxying the browser
    // Response object caused Illegal invocation errors in production.
    // Individual API consumers should guard `response.ok` and content-type
    // before calling `response.json()` instead.

    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])
  
  return null
}