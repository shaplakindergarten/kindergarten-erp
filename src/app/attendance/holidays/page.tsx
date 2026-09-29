"use client"

import { useState, useEffect } from "react"
import {
  Plus,
  Search,
  Trash2,
  Settings2,
  Calendar as CalendarIcon,
  Loader2
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { format, eachDayOfInterval, parseISO } from "date-fns"
import { createClient } from "@/lib/supabase/client"

export default function HolidaysPage() {
  const supabase = createClient()
  const [holidays, setHolidays] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  
  // Weekend states
  const [isFridayOff, setIsFridayOff] = useState(true)
  const [isSaturdayOff, setIsSaturdayOff] = useState(false)
  
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  const [newHoliday, setNewHoliday] = useState({
    title: "",
    fromDate: "",
    toDate: "",
    type: "holiday",
    isOptional: false
  })

  // ১. ডাটা লোড করা (সংশোধিত: Boolean চেক যুক্ত)
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true)
      try {
        const { data: holidayData } = await supabase
          .from("attendance_holidays")
          .select("*")
          .order("holiday_date", { ascending: true })

        const { data: settingsData } = await supabase
          .from("attendance_settings")
          .select("is_friday_off, is_saturday_off")
          .eq('id', 1)
          .single()

        if (holidayData) setHolidays(holidayData)
        if (settingsData) {
          // নিশ্চিত করা হচ্ছে ডাটা boolean হিসেবে সেট হচ্ছে
          setIsFridayOff(!!settingsData.is_friday_off)
          setIsSaturdayOff(!!settingsData.is_saturday_off)
        }
      } catch (error) {
        console.error("Error loading data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadInitialData()
  }, [])

  // ২. সাপ্তাহিক বন্ধ আপডেট (সংশোধিত: upsert ব্যবহার করা হয়েছে)
  const updateWeekendSettings = async (day: 'fri' | 'sat', value: boolean) => {
    const prevValue = day === 'fri' ? isFridayOff : isSaturdayOff
    
    // UI দ্রুত আপডেট
    if (day === 'fri') setIsFridayOff(value)
    else setIsSaturdayOff(value)

    const updateField = day === 'fri' ? { is_friday_off: value } : { is_saturday_off: value }

    // Update এর বদলে upsert ব্যবহার করা নিরাপদ যদি ID 1 না থাকে
    const { error } = await supabase
      .from("attendance_settings")
      .upsert({ id: 1, ...updateField }, { onConflict: 'id' })

    if (error) {
      toast.error("Update Failed: " + error.message)
      if (day === 'fri') setIsFridayOff(prevValue)
      else setIsSaturdayOff(prevValue)
    } else {
      toast.success("Settings Updated")
    }
  }

  // ৩. নতুন ছুটি সেভ (সংশোধিত: upsert ব্যবহার করা হয়েছে ডুপ্লিকেট ডেট এরর এড়াতে)
  const handleAddHoliday = async () => {
    if (!newHoliday.title || !newHoliday.fromDate || !newHoliday.toDate) {
      toast.error("Please fill all required fields")
      return
    }

    setIsSaving(true)
    try {
      const days = eachDayOfInterval({
        start: parseISO(newHoliday.fromDate),
        end: parseISO(newHoliday.toDate),
      })

      const insertData = days.map(day => ({
        title: newHoliday.title,
        holiday_date: format(day, "yyyy-MM-dd"),
        type: newHoliday.type,
        is_optional: newHoliday.isOptional
      }))

      // .insert() এর বদলে .upsert() ব্যবহার করা হয়েছে
      const { error } = await supabase
        .from("attendance_holidays")
        .upsert(insertData, { onConflict: 'holiday_date' }) 

      if (error) throw error

      toast.success("Holidays saved successfully")
      setIsOpen(false)
      setNewHoliday({ title: "", fromDate: "", toDate: "", type: "holiday", isOptional: false })
      
      const { data } = await supabase.from("attendance_holidays").select("*").order("holiday_date")
      setHolidays(data || [])
    } catch (error: any) {
      toast.error("Database Error: " + error.message)
    } finally {
      setIsSaving(false)
    }
  }

  // ৪. ডিলিট করা
  const deleteHoliday = async (id: string) => {
    const { error } = await supabase.from("attendance_holidays").delete().eq("id", id)
    if (!error) {
      setHolidays(prev => prev.filter(h => h.id !== id))
      toast.success("Removed")
    }
  }

  return (
    <ResponsiveLayout>
      <div className="min-h-screen bg-slate-50 dark:bg-[#0b1120] p-4 space-y-6 transition-colors">
        
        {/* Header Section */}
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 dark:from-slate-900 dark:via-indigo-950 dark:to-slate-900 rounded-2xl p-8 text-white shadow-2xl border border-white/10">
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
                <CalendarIcon className="h-8 w-8 text-indigo-200" /> Holiday Management
              </h1>
              <p className="text-indigo-100/80 dark:text-slate-400 mt-2 font-medium">Manage institutional holidays & weekly off-days</p>
            </div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button className="bg-white text-indigo-700 hover:bg-indigo-50 dark:bg-indigo-600 dark:text-white dark:hover:bg-indigo-700 h-12 px-6 rounded-xl font-bold shadow-lg transition-all hover:scale-105 active:scale-95">
                  <Plus className="h-5 w-5 mr-2" /> Add New Holiday
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white dark:bg-slate-900 dark:text-white border-none shadow-2xl rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold">Configure Holiday Range</DialogTitle>
                  <DialogDescription className="dark:text-slate-400">Selected dates will be marked as non-working days.</DialogDescription>
                </DialogHeader>
                <div className="space-y-5 py-4">
                  <div className="space-y-2">
                    <Label className="font-semibold">Holiday Title</Label>
                    <Input 
                      placeholder="e.g. Eid Holidays"
                      className="h-11 dark:bg-slate-800 dark:border-slate-700"
                      value={newHoliday.title} 
                      onChange={e => setNewHoliday({...newHoliday, title: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-semibold">Start Date</Label>
                      <Input type="date" className="h-11 dark:bg-slate-800 dark:border-slate-700" value={newHoliday.fromDate} onChange={e => setNewHoliday({...newHoliday, fromDate: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-semibold">End Date</Label>
                      <Input type="date" className="h-11 dark:bg-slate-800 dark:border-slate-700" value={newHoliday.toDate} onChange={e => setNewHoliday({...newHoliday, toDate: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-semibold">Type</Label>
                      <Select value={newHoliday.type} onValueChange={v => setNewHoliday({...newHoliday, type: v})}>
                        <SelectTrigger className="h-11 dark:bg-slate-800 dark:border-slate-700">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-slate-800 dark:text-white border-slate-700">
                          <SelectItem value="holiday">Official Holiday</SelectItem>
                          <SelectItem value="leave">School Leave</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-xl dark:border-slate-700 mt-6 bg-slate-50/50 dark:bg-slate-800/50">
                      <Label className="text-sm font-bold cursor-pointer">Optional?</Label>
                      <Switch checked={newHoliday.isOptional} onCheckedChange={v => setNewHoliday({...newHoliday, isOptional: v})} />
                    </div>
                  </div>
                </div>
                <DialogFooter className="gap-3">
                  <Button variant="ghost" onClick={() => setIsOpen(false)} className="font-semibold">Cancel</Button>
                  <Button onClick={handleAddHoliday} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 px-8 font-bold">
                    {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Save To Database"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Weekly Settings Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 dark:bg-slate-900 border-none shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 rounded-2xl overflow-hidden">
            <CardHeader className="py-4 px-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
              <CardTitle className="text-base font-bold flex items-center gap-2 dark:text-white">
                <Settings2 size={18} className="text-indigo-500" /> Weekend Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex items-center gap-12">
              <div className="flex items-center space-x-4">
                <Switch 
                  id="fri" 
                  checked={isFridayOff} 
                  onCheckedChange={(v) => updateWeekendSettings('fri', v)}
                  className="data-[state=checked]:bg-emerald-500" 
                />
                <Label htmlFor="fri" className="text-sm font-bold dark:text-slate-200 cursor-pointer uppercase tracking-wider">Friday (Off)</Label>
              </div>
              <div className="flex items-center space-x-4">
                <Switch 
                  id="sat" 
                  checked={isSaturdayOff} 
                  onCheckedChange={(v) => updateWeekendSettings('sat', v)}
                  className="data-[state=checked]:bg-emerald-500"
                />
                <Label htmlFor="sat" className="text-sm font-bold dark:text-slate-200 cursor-pointer uppercase tracking-wider">Saturday (Off)</Label>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-slate-900 border-none shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 rounded-2xl flex flex-col justify-center p-6 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800">
             <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Total Holidays</p>
             <h2 className="text-4xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{holidays.length} Days</h2>
          </Card>
        </div>

        {/* Data Table */}
        <Card className="dark:bg-slate-900 border-none shadow-xl ring-1 ring-slate-200 dark:ring-slate-800 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search holiday by title..." 
                className="pl-12 h-11 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 rounded-xl"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-20 text-center"><Loader2 className="animate-spin h-10 w-10 mx-auto text-indigo-500 opacity-50" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold uppercase text-[11px] tracking-[0.1em]">
                    <tr>
                      <th className="px-8 py-5">Date</th>
                      <th className="px-8 py-5">Event Title</th>
                      <th className="px-8 py-5">Type</th>
                      <th className="px-8 py-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {holidays
                      .filter((h: any) => h.title.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map((holiday: any) => (
                      <tr key={holiday.id} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors">
                        <td className="px-8 py-4 font-bold text-slate-700 dark:text-slate-300">
                          {format(new Date(holiday.holiday_date), "EEEE, dd MMM yyyy")}
                        </td>
                        <td className="px-8 py-4 font-semibold text-slate-800 dark:text-slate-100">{holiday.title}</td>
                        <td className="px-8 py-4">
                          <div className="flex items-center gap-2">
                             <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter ${holiday.type === 'holiday' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'}`}>
                              {holiday.type}
                            </span>
                            {holiday.is_optional && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded-lg font-bold">OPTIONAL</span>}
                          </div>
                        </td>
                        <td className="px-8 py-4 text-right">
                          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" onClick={() => deleteHoliday(holiday.id)}>
                            <Trash2 size={16} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  )
}
