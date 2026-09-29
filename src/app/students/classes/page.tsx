// src/app/settings/classes/page.tsx
"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { 
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  GraduationCap,
  Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { getClasses, createClass, createSection, deleteSection, updateSection, updateClass, deleteClass } from "@/lib/api/students.service"
import { useToastStore } from "@/store/useStore"

interface Section {
  id: string
  name: string
  capacity: number
  class_teacher_id?: string
}

interface Class {
  id: string
  name: string
  numeric_order?: number
  sections?: Section[]
}

export default function ClassSetupPage() {
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [classModalOpen, setClassModalOpen] = useState(false)
  const [sectionModalOpen, setSectionModalOpen] = useState(false)
  const [editClassModalOpen, setEditClassModalOpen] = useState(false)
  const [editSectionModalOpen, setEditSectionModalOpen] = useState(false)
  const [selectedClass, setSelectedClass] = useState<Class | null>(null)
  const [editingClass, setEditingClass] = useState<Class | null>(null)
  const [editingSection, setEditingSection] = useState<Section | null>(null)
  const [classForm, setClassForm] = useState({ name: "", numericOrder: 1 })
  const [sectionForm, setSectionForm] = useState({ name: "", capacity: 40 })
  const [classError, setClassError] = useState("")
  const [sectionError, setSectionError] = useState("")
  const addToast = useToastStore((state) => state.addToast)

  useEffect(() => {
    loadClasses()
  }, [])

  async function loadClasses() {
    try {
      const data = await getClasses()
      console.log('📚 Loaded classes with sections:', data)
      setClasses(data || [])
    } catch (err) {
      console.error("Failed to load classes:", err)
      addToast({ type: 'error', title: 'Load Failed', message: 'Failed to load class data.' })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateClass = async () => {
    const trimmedName = classForm.name.trim()
    if (!trimmedName) {
      setClassError("Class name is required")
      return
    }
    if (trimmedName.includes("'")) {
      setClassError("Apostrophes are not allowed in class names")
      return
    }
    setClassError("")
    setLoading(true)
    try {
      await createClass({ name: trimmedName, numericOrder: classForm.numericOrder })
      addToast({ type: 'success', title: 'Success', message: `Class "${trimmedName}" created successfully.` })
      setClassModalOpen(false)
      setClassForm({ name: "", numericOrder: classes.length + 1 })
      await loadClasses()
    } catch (err: any) {
      console.error("Failed to create class:", err)
      const errorMessage = err?.message || 'Failed to create class.'
      addToast({ type: 'error', title: 'Failed', message: errorMessage })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSection = async () => {
    if (!selectedClass) return
    const trimmedName = sectionForm.name.trim()
    if (!trimmedName) {
      setSectionError("Section name is required")
      return
    }
    if (trimmedName.includes("'")) {
      setSectionError("Apostrophes are not allowed in section names")
      return
    }
    setSectionError("")
    setLoading(true)
    try {
      await createSection({
        classId: selectedClass.id,
        name: trimmedName,
        capacity: sectionForm.capacity,
      })
      addToast({ type: 'success', title: 'Success', message: `Section "${trimmedName}" created successfully.` })
      setSectionModalOpen(false)
      setSectionForm({ name: "", capacity: 40 })
      await loadClasses()
    } catch (err: any) {
      console.error("Failed to create section:", err)
      const errorMessage = err?.message || 'Failed to create section.'
      addToast({ type: 'error', title: 'Failed', message: errorMessage })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSection = async (sectionId: string) => {
    try {
      await deleteSection(sectionId)
      addToast({ type: 'success', title: 'Deleted', message: 'Section deleted successfully.' })
      loadClasses()
    } catch (err) {
      console.error("Failed to delete section:", err)
      addToast({ type: 'error', title: 'Failed', message: 'Failed to delete section.' })
    }
  }

  const handleDeleteClass = async (classId: string) => {
    try {
      await deleteClass(classId)
      addToast({ type: 'success', title: 'Deleted', message: 'Class deleted successfully.' })
      loadClasses()
    } catch (err) {
      console.error("Failed to delete class:", err)
      addToast({ type: 'error', title: 'Failed', message: 'Failed to delete class.' })
    }
  }

  const handleUpdateClass = async () => {
    if (!editingClass) return
    try {
      await updateClass(editingClass.id, { name: classForm.name, numericOrder: classForm.numericOrder })
      addToast({ type: 'success', title: 'Updated', message: 'Class updated successfully.' })
      setEditClassModalOpen(false)
      setEditingClass(null)
      setClassForm({ name: "", numericOrder: 1 })
      loadClasses()
    } catch (err) {
      console.error("Failed to update class:", err)
      addToast({ type: 'error', title: 'Failed', message: 'Failed to update class.' })
    }
  }

  const handleUpdateSection = async () => {
    if (!editingSection) return
    try {
      await updateSection(editingSection.id, { name: sectionForm.name, capacity: sectionForm.capacity })
      addToast({ type: 'success', title: 'Updated', message: 'Section updated successfully.' })
      setEditSectionModalOpen(false)
      setEditingSection(null)
      setSectionForm({ name: "", capacity: 40 })
      loadClasses()
    } catch (err) {
      console.error("Failed to update section:", err)
      addToast({ type: 'error', title: 'Failed', message: 'Failed to update section.' })
    }
  }

  const openEditClass = (cls: Class) => {
    setEditingClass(cls)
    setClassForm({ name: cls.name, numericOrder: cls.numeric_order || 1 })
    setEditClassModalOpen(true)
  }

  const openEditSection = (section: Section) => {
    setEditingSection(section)
    setSectionForm({ name: section.name, capacity: section.capacity })
    setEditSectionModalOpen(true)
  }

  const standardClasses = [
    { name: "Play", order: 0 },
    { name: "Nursery", order: 1 },
    { name: "KG", order: 2 },
    { name: "1 (One)", order: 3 },
    { name: "2 (Two)", order: 4 },
    { name: "3 (Three)", order: 5 },
    { name: "4 (Four)", order: 6 },
    { name: "5 (Five)", order: 7 },
  ]

  return (
    <ResponsiveLayout>
      <div className="space-y-6 p-4">

        {/* ============================================================
            HEADER - GRADIENT BACKGROUND
        ============================================================ */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 rounded-lg shadow-lg p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" asChild className="text-white hover:bg-white/20">
                <Link href="/students/list">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-white font-heading">Class & Section Setup</h1>
                <p className="text-white/80">Manage classes and sections for your school</p>
              </div>
            </div>
            <Button 
              onClick={() => setClassModalOpen(true)}
              className="bg-white text-indigo-600 hover:bg-indigo-50 shadow-lg"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Class
            </Button>
          </div>
        </div>

        {/* ============================================================
            MAIN CONTENT
        ============================================================ */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        ) : classes.length === 0 ? (
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="py-12 text-center">
              <GraduationCap className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">No Classes Found</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">Start by adding your first class to organize students.</p>
              <Button onClick={() => setClassModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <Plus className="h-4 w-4 mr-2" />
                Add First Class
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {classes.map((cls) => (
              <Card key={cls.id} className="overflow-hidden bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                {/* Class Header */}
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/50">
                      <GraduationCap className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{cls.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {cls.sections?.length || 0} section(s)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedClass(cls)
                        setSectionModalOpen(true)
                      }}
                      className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Section
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditClass(cls)}
                      className="text-gray-600 dark:text-gray-400 hover:text-indigo-600"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteClass(cls.id)}
                      className="text-gray-600 dark:text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Sections */}
                {cls.sections && cls.sections.length > 0 ? (
                  <CardContent className="pt-4">
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                      {cls.sections.map((section) => (
                        <div
                          key={section.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                              <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                                {section.name}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-sm text-gray-900 dark:text-white">
                                Section {section.name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Capacity: {section.capacity}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditSection(section)}
                              className="h-8 w-8 p-0 text-gray-600 dark:text-gray-400 hover:text-indigo-600"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteSection(section.id)}
                              className="h-8 w-8 p-0 text-gray-600 dark:text-gray-400 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                ) : (
                  <CardContent className="pt-2 pb-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                      No sections added yet. Click "Add Section" to create one.
                    </p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* ============================================================
            QUICK SETUP - BLACK TEXT
        ============================================================ */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Quick Setup</CardTitle>
            <CardDescription className="text-gray-500 dark:text-gray-400">
              Create standard classes quickly
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {standardClasses.map((cls) => {
                const exists = classes.some(c => c.name === cls.name)
                return (
                  <div
                    key={cls.name}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50"
                  >
                    <span className="font-medium text-sm text-gray-900 dark:text-white">{cls.name}</span>
                    {exists ? (
                      <Badge variant="success" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200 border-green-200 dark:border-green-800">
                        ✅ Added
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await createClass({ name: cls.name, numericOrder: cls.order })
                            addToast({ type: 'success', title: 'Success', message: `${cls.name} added.` })
                            loadClasses()
                          } catch {
                            addToast({ type: 'error', title: 'Failed', message: 'Failed to add class.' })
                          }
                        }}
                        className="text-gray-600 dark:text-gray-400 hover:text-indigo-600"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ============================================================
          MODALS
      ============================================================ */}

      {/* Add Class Modal */}
      <Dialog open={classModalOpen} onOpenChange={setClassModalOpen}>
        <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Add New Class</DialogTitle>
            <DialogDescription className="text-gray-500 dark:text-gray-400">
              Enter the class details below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="className" className="text-gray-700 dark:text-gray-300">Class Name</Label>
              <Input
                id="className"
                placeholder="e.g., (I) One"
                value={classForm.name}
                onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
              />
              {classError && <p className="text-xs text-red-500">{classError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="order" className="text-gray-700 dark:text-gray-300">Numeric Order</Label>
              <Input
                id="order"
                type="number"
                placeholder="Order for display"
                value={classForm.numericOrder}
                onChange={(e) => setClassForm({ ...classForm, numericOrder: parseInt(e.target.value) || 1 })}
                className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClassModalOpen(false)} className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
              Cancel
            </Button>
            <Button onClick={handleCreateClass} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              Create Class
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Class Modal */}
      <Dialog open={editClassModalOpen} onOpenChange={setEditClassModalOpen}>
        <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Edit Class</DialogTitle>
            <DialogDescription className="text-gray-500 dark:text-gray-400">
              Update class details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editClassName" className="text-gray-700 dark:text-gray-300">Class Name</Label>
              <Input
                id="editClassName"
                placeholder="e.g., One"
                value={classForm.name}
                onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
              />
              {classError && <p className="text-xs text-red-500">{classError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="editOrder" className="text-gray-700 dark:text-gray-300">Numeric Order</Label>
              <Input
                id="editOrder"
                type="number"
                placeholder="Order for display"
                value={classForm.numericOrder}
                onChange={(e) => setClassForm({ ...classForm, numericOrder: parseInt(e.target.value) || 1 })}
                className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditClassModalOpen(false)} className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
              Cancel
            </Button>
            <Button onClick={handleUpdateClass} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              Update Class
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Section Modal */}
      <Dialog open={sectionModalOpen} onOpenChange={setSectionModalOpen}>
        <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Add Section to {selectedClass?.name}</DialogTitle>
            <DialogDescription className="text-gray-500 dark:text-gray-400">
              Enter section details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="sectionName" className="text-gray-700 dark:text-gray-300">Section Name</Label>
              <Input
                id="sectionName"
                placeholder="e.g., A"
                value={sectionForm.name}
                onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
              />
              {sectionError && <p className="text-xs text-red-500">{sectionError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacity" className="text-gray-700 dark:text-gray-300">Capacity</Label>
              <Input
                id="capacity"
                type="number"
                placeholder="Max students"
                value={sectionForm.capacity}
                onChange={(e) => setSectionForm({ ...sectionForm, capacity: parseInt(e.target.value) || 40 })}
                className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionModalOpen(false)} className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
              Cancel
            </Button>
            <Button onClick={handleCreateSection} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              Add Section
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Section Modal */}
      <Dialog open={editSectionModalOpen} onOpenChange={setEditSectionModalOpen}>
        <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Edit Section</DialogTitle>
            <DialogDescription className="text-gray-500 dark:text-gray-400">
              Update section details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editSectionName" className="text-gray-700 dark:text-gray-300">Section Name</Label>
              <Input
                id="editSectionName"
                placeholder="e.g., A"
                value={sectionForm.name}
                onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
              />
              {sectionError && <p className="text-xs text-red-500">{sectionError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="editCapacity" className="text-gray-700 dark:text-gray-300">Capacity</Label>
              <Input
                id="editCapacity"
                type="number"
                placeholder="Max students"
                value={sectionForm.capacity}
                onChange={(e) => setSectionForm({ ...sectionForm, capacity: parseInt(e.target.value) || 40 })}
                className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSectionModalOpen(false)} className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
              Cancel
            </Button>
            <Button onClick={handleUpdateSection} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              Update Section
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ResponsiveLayout>
  )
}
