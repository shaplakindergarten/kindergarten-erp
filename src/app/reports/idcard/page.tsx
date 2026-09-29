"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Printer, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"
import { getStudents } from "@/lib/api/students.service"
import { getSchoolSettings } from "@/lib/api/settings"
import { supabase } from "@/lib/supabase/client"

interface Student {
  id: string
  student_id: string
  name: string
  father_name: string
  mother_name: string
  dob: string
  class?: { id: string; name: string }
  section?: { id: string; name: string }
  class_roll?: string
  student_photo_url?: string
  gender?: string
  contact?: string
  fathers_contact?: string
  mothers_contact?: string
  email?: string
  address?: string
  village?: string
  post_office?: string
  police_station?: string
  district?: string
  blood_group?: string
  status?: string
  academic_year_id?: string
}

interface SchoolSettings {
  school_name: string
  school_address: string
  school_phone: string
  school_email: string
  school_logo?: string
  school_watermark?: string
}

interface AcademicYear {
  id: string
  year_name: string
  name: string | null
  start_date: string | null
  end_date: string | null
  is_active: boolean
  is_current: boolean
  created_at: string
}

export default function IDCardPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [settings, setSettings] = useState<SchoolSettings | null>(null)
  const [academicYear, setAcademicYear] = useState<AcademicYear | null>(null)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [printMode, setPrintMode] = useState<'single' | 'bulk'>('single')
  const [selectAll, setSelectAll] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const printRef = useRef<HTMLDivElement>(null)
  const CARDS_PER_PAGE = 9

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const studentsResponse = await getStudents().catch(() => ({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 }))
      const settingsData = await getSchoolSettings().catch(() => null)
      
      const { data: academicYearData, error: academicYearError } = await supabase
        .from('academic_years')
        .select('*')
        .eq('is_current', true)
        .single()

      if (academicYearError) {
        console.error('Error fetching academic year:', academicYearError)
      }

      setStudents(studentsResponse.data || [])
      setSettings(settingsData)
      setAcademicYear(academicYearData || null)
    } catch (err) {
      console.error("Failed to load data:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleStudentSelect = (id: string) => {
    const student = students.find((s) => s.id === id)
    setSelectedStudent(student || null)
  }

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    )
  }

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedStudents([])
    } else {
      setSelectedStudents(students.map(s => s.id))
    }
    setSelectAll(!selectAll)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleBulkPrint = () => {
    if (selectedStudents.length === 0) return
    window.print()
  }

  const getSelectedStudentData = () => {
    return students.filter(s => selectedStudents.includes(s.id))
  }

  const getStudentPhoto = (student: Student) => {
    return student.student_photo_url || null
  }

  const formatDateDisplay = (date: string | null | undefined) => {
    if (!date) return 'DD/MM/YYYY'
    try {
      const d = new Date(date)
      return d.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
      })
    } catch {
      return 'DD/MM/YYYY'
    }
  }

  const getFullAddress = (student: Student) => {
    const parts = []
    if (student.village) parts.push(student.village)
    if (student.post_office) parts.push(student.post_office)
    if (student.police_station) parts.push(student.police_station)
    if (student.district) parts.push(student.district)
    return parts.length > 0 ? parts.join(', ') : settings?.school_address || 'Address Not Available'
  }

  // Get paginated data
  const getPaginatedData = () => {
    const selectedData = getSelectedStudentData()
    const start = (currentPage - 1) * CARDS_PER_PAGE
    const end = start + CARDS_PER_PAGE
    return selectedData.slice(start, end)
  }

  const totalPages = Math.ceil(getSelectedStudentData().length / CARDS_PER_PAGE)

  const goToNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1)
  }

  const goToPrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1)
  }

  // ============ PORTRAIT ID CARD FRONT ============
  const IDCardFront = ({ student }: { student: Student }) => (
    <div className="id-card-front-portrait">
      {/* Decorative Top Border Line */}
      <div className="id-card-top-border"></div>
      
      {/* Top: Logo + School Name + Address */}
      <div className="id-card-header-portrait">
        <div className="id-card-logo-portrait">
          {settings?.school_logo ? (
            <img src={settings.school_logo} alt="School Logo" className="w-full h-full object-contain" />
          ) : (
            <div className="text-[6px] font-bold text-[#1a56db]">Logo</div>
          )}
        </div>
        <div className="id-card-school-info-portrait">
          <h3 className="id-card-school-name-portrait">
            {settings?.school_name || 'Shapla Kindergarten & Pre-cadet'}
          </h3>
          <p className="id-card-school-address-portrait">
            {settings?.school_address || 'Nowtala, Madhaiya, Chandina, Comilla'}
          </p>
        </div>
      </div>

      {/* Title with decorative lines */}
      <div className="id-card-title-wrapper">
        <div className="id-card-title-line"></div>
        <div className="id-card-title-portrait">
          <span>STUDENT ID CARD</span>
        </div>
        <div className="id-card-title-line"></div>
      </div>

      {/* Photo */}
      <div className="id-card-photo-portrait">
        {getStudentPhoto(student) ? (
          <img 
            src={getStudentPhoto(student) || ''} 
            alt={student.name} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1a56db]/10 to-[#1a56db]/5 flex items-center justify-center">
            <svg className="w-10 h-10 text-[#1a56db]/30" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="id-card-details-portrait">
        <div className="id-card-detail-row-portrait">
          <span className="id-card-label-portrait">Student ID</span>
          <span className="id-card-value-portrait">: {student.student_id}</span>
        </div>
        <div className="id-card-detail-row-portrait">
          <span className="id-card-label-portrait">Name</span>
          <span className="id-card-value-portrait">: {student.name}</span>
        </div>
        <div className="id-card-detail-row-portrait">
          <span className="id-card-label-portrait">Father&apos;s Name</span>
          <span className="id-card-value-portrait">: {student.father_name}</span>
        </div>
        <div className="id-card-detail-row-portrait">
          <span className="id-card-label-portrait">Class</span>
          <span className="id-card-value-portrait">: {student.class?.name || 'N/A'}</span>
        </div>
        <div className="id-card-detail-row-portrait">
          <span className="id-card-label-portrait">Address</span>
          <span className="id-card-value-portrait">: {getFullAddress(student)}</span>
        </div>
        <div className="id-card-detail-row-portrait">
          <span className="id-card-label-portrait">Contact No</span>
          <span className="id-card-value-portrait">: {student.fathers_contact || student.contact || 'N/A'}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="id-card-footer-portrait">
        <span className="id-card-email-portrait">{settings?.school_email || 'shapla.kindergarten@gmail.com'}</span>
      </div>
      
      {/* Decorative Bottom Border Line */}
      <div className="id-card-bottom-border"></div>
    </div>
  )

  // ============ PORTRAIT ID CARD BACK ============
  const IDCardBack = ({ student }: { student: Student }) => (
    <div className="id-card-back-portrait">
      <div className="id-card-back-header-portrait">
        <div className="id-card-back-logo-portrait">
          {settings?.school_logo ? (
            <img src={settings.school_logo} alt="School Logo" className="w-full h-full object-contain" />
          ) : (
            <div className="text-[6px] font-bold text-[#1a56db]">Logo</div>
          )}
        </div>
        <div className="id-card-back-school-portrait">
          <h4 className="id-card-back-school-name-portrait">
            {settings?.school_name || 'Shapla Kindergarten & Pre-cadet'}
          </h4>
        </div>
      </div>

      <div className="id-card-back-body-portrait">
        <div className="id-card-back-info-portrait">
          <div className="id-card-back-item-portrait">
            <span className="label-portrait">Student Name</span>
            <span className="value-portrait">{student.name}</span>
          </div>
          <div className="id-card-back-item-portrait">
            <span className="label-portrait">Father&apos;s Name</span>
            <span className="value-portrait">{student.father_name}</span>
          </div>
          <div className="id-card-back-item-portrait">
            <span className="label-portrait">Mother&apos;s Name</span>
            <span className="value-portrait">{student.mother_name || 'N/A'}</span>
          </div>
          <div className="id-card-back-item-portrait">
            <span className="label-portrait">Date of Birth</span>
            <span className="value-portrait">{formatDateDisplay(student.dob)}</span>
          </div>
          <div className="id-card-back-item-portrait">
            <span className="label-portrait">Blood Group</span>
            <span className="value-portrait">{student.blood_group || 'N/A'}</span>
          </div>
          <div className="id-card-back-item-portrait">
            <span className="label-portrait">Contact</span>
            <span className="value-portrait">{student.fathers_contact || student.contact || 'N/A'}</span>
          </div>
        </div>

        <div className="id-card-back-terms-portrait">
          <p>This ID card is the property of the institution.</p>
          <p>Please return if found.</p>
        </div>
      </div>

      <div className="id-card-back-footer-portrait">
        <span>{settings?.school_phone || '01777584352'}</span>
        <span>|</span>
        <span>{settings?.school_email || 'shapla.kindergarten@gmail.com'}</span>
      </div>
    </div>
  )

  // ============ BULK PREVIEW - Shows 9 Cards with Pagination ============
  const BulkPreviewGrid = ({ students, type }: { students: Student[], type: 'front' | 'back' }) => {
    const filledStudents: (Student | null)[] = [...students]
    while (filledStudents.length < CARDS_PER_PAGE) {
      filledStudents.push(null)
    }

    return (
      <div className="bulk-preview-grid">
        {filledStudents.map((student, index) => (
          <div key={student?.id || `empty-${index}`} className="bulk-preview-item">
            {student ? (
              type === 'front' ? (
                <IDCardFront student={student} />
              ) : (
                <IDCardBack student={student} />
              )
            ) : (
              <div className="id-card-empty-portrait" />
            )}
          </div>
        ))}
      </div>
    )
  }

  // ============ PRINT SHEET - 3×3 = 9 Cards per A4 Page ============
  const PrintSheet = ({ students, type }: { students: Student[], type: 'front' | 'back' }) => {
    const filledStudents: (Student | null)[] = [...students]
    while (filledStudents.length < CARDS_PER_PAGE) {
      filledStudents.push(null)
    }

    return (
      <div className="print-sheet-portrait">
        {filledStudents.map((student, index) => (
          <div key={student?.id || `empty-${index}`} className="id-card-wrapper-portrait">
            {student ? (
              type === 'front' ? (
                <IDCardFront student={student} />
              ) : (
                <IDCardBack student={student} />
              )
            ) : (
              <div className="id-card-empty-portrait" />
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <ResponsiveLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/reports">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold font-heading">ID Card</h1>
              <p className="text-text-muted text-sm">Generate student ID cards</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {selectedStudents.length > 0 && printMode === 'bulk' && (
              <Button onClick={handleBulkPrint} className="gap-2 bg-[#1a56db] hover:bg-[#1a4ba8] text-white">
                <Printer className="h-4 w-4" />
                Print All ({selectedStudents.length})
              </Button>
            )}
            {selectedStudent && printMode === 'single' && (
              <Button onClick={handlePrint} className="gap-2 bg-[#1a56db] hover:bg-[#1a4ba8] text-white">
                <Printer className="h-4 w-4" />
                Print
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Selection Panel */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">Select Mode</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button 
                    variant={printMode === 'single' ? 'default' : 'outline'} 
                    className="flex-1"
                    onClick={() => setPrintMode('single')}
                  >
                    Single
                  </Button>
                  <Button 
                    variant={printMode === 'bulk' ? 'default' : 'outline'} 
                    className="flex-1"
                    onClick={() => setPrintMode('bulk')}
                  >
                    Bulk
                  </Button>
                </div>

                {printMode === 'single' ? (
                  <div className="space-y-2">
                    <Label>Select Student</Label>
                    <Select onValueChange={handleStudentSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a student" />
                      </SelectTrigger>
                      <SelectContent>
                        {students.map((student) => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.name} ({student.student_id})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedStudent && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium">{selectedStudent.name}</p>
                        <p className="text-xs text-text-muted">ID: {selectedStudent.student_id}</p>
                        <p className="text-xs text-text-muted">Class: {selectedStudent.class?.name}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Select Students</Label>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleSelectAll}
                        className="h-auto px-2 py-1 text-xs"
                      >
                        {selectAll ? 'Deselect All' : 'Select All'}
                      </Button>
                    </div>
                    <div className="max-h-[350px] overflow-y-auto space-y-1 border rounded-md p-2 bg-gray-50/50">
                      {students.map((student) => (
                        <div 
                          key={student.id} 
                          className="flex items-center gap-2 p-2 hover:bg-white rounded-md transition-colors cursor-pointer"
                          onClick={() => handleSelectStudent(student.id)}
                        >
                          <Checkbox
                            checked={selectedStudents.includes(student.id)}
                            onCheckedChange={() => handleSelectStudent(student.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{student.name}</p>
                            <p className="text-xs text-text-muted truncate">{student.student_id} • {student.class?.name}</p>
                          </div>
                        </div>
                      ))}
                      {students.length === 0 && (
                        <p className="text-sm text-text-muted text-center py-8">No students found</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text-muted">
                        {selectedStudents.length} student{selectedStudents.length !== 1 ? 's' : ''} selected
                      </span>
                      {selectedStudents.length > 0 && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setSelectedStudents([])}
                          className="h-7 text-xs"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ID Card Display Container */}
            <div className="lg:col-span-2">
              {printMode === 'single' ? (
                selectedStudent ? (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-6 p-6 bg-gradient-to-br from-[#1a56db]/5 to-[#1a56db]/10 border border-[#1a56db]/20 rounded-xl" ref={printRef} id="idcard-print">
                    <IDCardFront student={selectedStudent} />
                    <IDCardBack student={selectedStudent} />
                  </div>
                ) : (
                  <Card className="h-full">
                    <CardContent className="p-12 text-center flex flex-col items-center justify-center h-full min-h-[300px]">
                      <div className="text-text-muted">
                        <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                        </svg>
                        <p className="text-lg font-medium">No student selected</p>
                        <p className="text-sm">Select a student from the left panel to generate ID card</p>
                      </div>
                    </CardContent>
                  </Card>
                )
              ) : (
                selectedStudents.length > 0 ? (
                  <div className="space-y-6 p-4 bg-gradient-to-br from-[#1a56db]/5 to-[#1a56db]/10 border border-[#1a56db]/20 rounded-xl" ref={printRef} id="idcard-print">
                    {/* Pagination Controls - Only visible on screen */}
                    <div className="print:hidden">
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between gap-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={goToPrevPage}
                            disabled={currentPage === 1}
                            className="gap-1"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                          </Button>
                          <span className="text-sm font-medium text-gray-600">
                            Page {currentPage} of {totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={goToNextPage}
                            disabled={currentPage === totalPages}
                            className="gap-1"
                          >
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Front Side Preview - Screen */}
                    <div className="print:hidden">
                      <h3 className="text-sm font-semibold text-[#1a56db] mb-3 flex items-center gap-2">
                        <span className="inline-block w-1 h-4 bg-[#1a56db] rounded"></span>
                        Front Side ({getSelectedStudentData().length} cards) - Page {currentPage}
                      </h3>
                      <BulkPreviewGrid students={getPaginatedData()} type="front" />
                    </div>

                    {/* Back Side Preview - Screen */}
                    <div className="print:hidden">
                      <h3 className="text-sm font-semibold text-[#1a56db] mb-3 flex items-center gap-2">
                        <span className="inline-block w-1 h-4 bg-[#1a56db] rounded"></span>
                        Back Side ({getSelectedStudentData().length} cards) - Page {currentPage}
                      </h3>
                      <BulkPreviewGrid students={getPaginatedData()} type="back" />
                    </div>
                    
                    {/* Hidden Print Layout - No text, only cards */}
                    <div className="hidden print:block">
                      {Array.from({ length: totalPages }).map((_, pageIndex) => {
                        const start = pageIndex * CARDS_PER_PAGE
                        const end = start + CARDS_PER_PAGE
                        const pageStudents = getSelectedStudentData().slice(start, end)
                        return (
                          <div key={pageIndex}>
                            <PrintSheet students={pageStudents} type="front" />
                            <PrintSheet students={pageStudents} type="back" />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <Card className="h-full">
                    <CardContent className="p-12 text-center flex flex-col items-center justify-center h-full min-h-[300px]">
                      <div className="text-text-muted">
                        <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0018 4.5H6.75A2.25 2.25 0 004.5 6.75V18a2.25 2.25 0 002.25 2.25h3.75m3.75-18h3.75a2.25 2.25 0 012.25 2.25v3.75" />
                        </svg>
                        <p className="text-lg font-medium">No students selected</p>
                        <p className="text-sm">Select students from the left panel to generate ID cards</p>
                      </div>
                    </CardContent>
                  </Card>
                )
              )}
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        /* ===== PORTRAIT ID CARD ===== */
        
        /* Front Card */
        .id-card-front-portrait {
          width: 60mm;
          height: 90mm;
          background: linear-gradient(180deg, #f0f4ff 0%, #e8edf8 100%);
          border-radius: 4px;
          border: 1.5px solid #1a56db;
          display: flex;
          flex-direction: column;
          padding: 2.5mm 3.5mm;
          box-shadow: 0 2px 8px rgba(26, 86, 219, 0.15);
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          position: relative;
          overflow: hidden;
        }

        /* Decorative top border */
        .id-card-top-border {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2.5mm;
          background: linear-gradient(90deg, #1a56db, #3b82f6, #1a56db);
          border-radius: 4px 4px 0 0;
        }

        /* Decorative bottom border */
        .id-card-bottom-border {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2.5mm;
          background: linear-gradient(90deg, #1a56db, #3b82f6, #1a56db);
          border-radius: 0 0 4px 4px;
        }

        /* Background decorative pattern */
        .id-card-front-portrait::before {
          content: '';
          position: absolute;
          top: 15mm;
          left: -10mm;
          right: -10mm;
          height: 0.3mm;
          background: rgba(26, 86, 219, 0.05);
          transform: rotate(-5deg);
        }

        .id-card-front-portrait::after {
          content: '';
          position: absolute;
          bottom: 20mm;
          left: -10mm;
          right: -10mm;
          height: 0.3mm;
          background: rgba(26, 86, 219, 0.05);
          transform: rotate(3deg);
        }

        .id-card-header-portrait {
          display: flex;
          align-items: center;
          gap: 2.5mm;
          padding-bottom: 1.5mm;
          margin-bottom: 1mm;
          position: relative;
          z-index: 1;
        }

        .id-card-header-portrait::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, #1a56db, #3b82f6, #1a56db);
          border-radius: 2px;
        }

        .id-card-logo-portrait {
          width: 11mm;
          height: 11mm;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: transparent;
        }

        .id-card-logo-portrait img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .id-card-school-info-portrait {
          flex: 1;
          min-width: 0;
        }

        .id-card-school-name-portrait {
          font-size: 5pt;
          font-weight: 700;
          text-transform: uppercase;
          color: #0d0d11;
          letter-spacing: 0.3px;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .id-card-school-address-portrait {
          font-size: 3.5pt;
          color: #4b5563;
          letter-spacing: 0.2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .id-card-title-wrapper {
          display: flex;
          align-items: center;
          gap: 2mm;
          margin-bottom: 1.5mm;
          position: relative;
          z-index: 1;
        }

        .id-card-title-line {
          flex: 1;
          height: 1.5px;
          background: linear-gradient(90deg, transparent, #1a56db);
        }

        .id-card-title-line:last-child {
          background: linear-gradient(90deg, #1a56db, transparent);
        }

        .id-card-title-portrait {
          background: #1a56db;
          color: white;
          text-align: center;
          padding: 0.6mm 2mm;
          border-radius: 2px;
          font-size: 4.5pt;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .id-card-photo-portrait {
          width: 22mm;
          height: 26mm;
          border-radius: 3px;
          border: 2px solid #1a56db;
          overflow: hidden;
          flex-shrink: 0;
          background: white;
          margin: 0 auto 1.5mm auto;
          position: relative;
          z-index: 1;
          box-shadow: 0 2px 6px rgba(26, 86, 219, 0.1);
        }

        .id-card-photo-portrait img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .id-card-details-portrait {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.3mm;
          position: relative;
          z-index: 1;
        }

        .id-card-detail-row-portrait {
          display: flex;
          font-size: 4.5pt;
          line-height: 1.3;
          min-height: 4mm;
          align-items: baseline;
        }

        .id-card-label-portrait {
          font-weight: 600;
          color: #1a56db;
          min-width: 14mm;
          flex-shrink: 0;
          font-size: 4pt;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .id-card-value-portrait {
          color: #0d0d11;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .id-card-footer-portrait {
          border-top: 2px solid #1a56db;
          padding-top: 0.8mm;
          margin-top: auto;
          text-align: center;
          position: relative;
          z-index: 1;
        }

        .id-card-email-portrait {
          font-size: 4pt;
          color: #1a56db;
          font-weight: 600;
          letter-spacing: 0.3px;
        }

        /* Back Card */
        .id-card-back-portrait {
          width: 60mm;
          height: 90mm;
          background: linear-gradient(180deg, #f0f4ff 0%, #e8edf8 100%);
          border-radius: 4px;
          border: 1.5px solid #1a56db;
          display: flex;
          flex-direction: column;
          padding: 2.5mm 3.5mm;
          box-shadow: 0 2px 8px rgba(26, 86, 219, 0.15);
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          overflow: hidden;
          position: relative;
        }

        .id-card-back-portrait::before {
          content: '';
          position: absolute;
          top: 10mm;
          left: -10mm;
          right: -10mm;
          height: 0.3mm;
          background: rgba(26, 86, 219, 0.05);
          transform: rotate(-5deg);
        }

        .id-card-back-portrait::after {
          content: '';
          position: absolute;
          bottom: 15mm;
          left: -10mm;
          right: -10mm;
          height: 0.3mm;
          background: rgba(26, 86, 219, 0.05);
          transform: rotate(3deg);
        }

        .id-card-back-header-portrait {
          display: flex;
          align-items: center;
          gap: 2.5mm;
          padding-bottom: 1.5mm;
          margin-bottom: 1.5mm;
          position: relative;
          z-index: 1;
        }

        .id-card-back-header-portrait::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, #1a56db, #3b82f6, #1a56db);
          border-radius: 2px;
        }

        .id-card-back-logo-portrait {
          width: 9mm;
          height: 9mm;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: transparent;
        }

        .id-card-back-logo-portrait img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .id-card-back-school-portrait {
          flex: 1;
          min-width: 0;
        }

        .id-card-back-school-name-portrait {
          font-size: 5pt;
          font-weight: 700;
          text-transform: uppercase;
          color: #0d0d11;
          letter-spacing: 0.3px;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .id-card-back-body-portrait {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 1mm;
          position: relative;
          z-index: 1;
        }

        .id-card-back-info-portrait {
          display: flex;
          flex-direction: column;
          gap: 0.5mm;
          padding: 1mm 0;
        }

        .id-card-back-item-portrait {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .id-card-back-item-portrait .label-portrait {
          font-size: 3.5pt;
          font-weight: 600;
          color: #1a56db;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .id-card-back-item-portrait .value-portrait {
          font-size: 4.5pt;
          color: #1f2937;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .id-card-back-terms-portrait {
          padding: 1mm 0;
          border-top: 1px solid rgba(26, 86, 219, 0.15);
          border-bottom: 1px solid rgba(26, 86, 219, 0.15);
          text-align: center;
        }

        .id-card-back-terms-portrait p {
          font-size: 3.5pt;
          color: #6b7280;
          margin: 0;
          line-height: 1.4;
        }

        .id-card-back-footer-portrait {
          padding-top: 1mm;
          text-align: center;
          font-size: 3.5pt;
          color: #1a56db;
          font-weight: 500;
          display: flex;
          justify-content: center;
          gap: 3px;
          border-top: 1px solid rgba(26, 86, 219, 0.1);
        }

        /* Empty card placeholder */
        .id-card-empty-portrait {
          width: 60mm;
          height: 90mm;
          border: 1px dashed #d1d5db;
          border-radius: 4px;
          background: #f9fafb;
        }

        /* ===== BULK PREVIEW GRID ===== */
        .bulk-preview-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 4mm;
          width: 100%;
          justify-items: center;
          align-items: center;
        }

        .bulk-preview-item {
          break-inside: avoid;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        /* ===== PRINT SHEET - 3×3 Grid ===== */
        .print-sheet-portrait {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 3mm;
          width: 100%;
          page-break-after: always;
          padding: 2mm 0;
          justify-items: center;
          align-items: center;
        }

        .id-card-wrapper-portrait {
          break-inside: avoid;
          page-break-inside: avoid;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        /* ===== PREVIEW MODE (Screen) ===== */
        @media screen {
          .id-card-front-portrait,
          .id-card-back-portrait {
            width: 200px;
            height: 300px;
            padding: 8px 10px;
          }

          .id-card-logo-portrait,
          .id-card-back-logo-portrait {
            width: 32px;
            height: 32px;
          }

          .id-card-photo-portrait {
            width: 74px;
            height: 86px;
          }

          .id-card-school-name-portrait,
          .id-card-back-school-name-portrait {
            font-size: 9px;
          }

          .id-card-school-address-portrait {
            font-size: 6px;
          }

          .id-card-title-wrapper {
            gap: 4px;
          }

          .id-card-title-portrait {
            font-size: 8px;
            padding: 2px 8px;
          }

          .id-card-detail-row-portrait {
            font-size: 7.5px;
            min-height: 14px;
          }

          .id-card-label-portrait {
            font-size: 6.5px;
            min-width: 42px;
          }

          .id-card-email-portrait {
            font-size: 6.5px;
          }

          .id-card-back-item-portrait .label-portrait {
            font-size: 6px;
          }

          .id-card-back-item-portrait .value-portrait {
            font-size: 7.5px;
          }

          .id-card-back-terms-portrait p {
            font-size: 6px;
          }

          .id-card-back-footer-portrait {
            font-size: 6.5px;
          }

          .id-card-empty-portrait {
            width: 200px;
            height: 300px;
          }

          .bulk-preview-grid {
            gap: 6px;
          }

          .id-card-top-border,
          .id-card-bottom-border {
            height: 6px;
          }
        }

        /* ===== PRINT OPTIMIZATION ===== */
        @media print {
          body * {
            visibility: hidden;
          }
          
          #idcard-print,
          #idcard-print * {
            visibility: visible;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          #idcard-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            background: transparent !important;
            border: none !important;
            display: block !important;
          }

          #idcard-print .space-y-6 > div:first-child,
          #idcard-print .space-y-6 > div:first-child h3,
          #idcard-print .space-y-6 > div:last-child h3,
          #idcard-print .print\\:hidden,
          #idcard-print .text-sm,
          #idcard-print .font-semibold,
          #idcard-print .flex.items-center.gap-2,
          #idcard-print .mb-3,
          #idcard-print .inline-block {
            display: none !important;
          }

          #idcard-print .hidden.print\\:block {
            display: block !important;
          }

          .id-card-front-portrait,
          .id-card-back-portrait {
            box-shadow: none !important;
            border-color: #1a56db !important;
          }

          .id-card-empty-portrait {
            display: none !important;
          }

          .print-sheet-portrait {
            gap: 2.5mm;
            padding: 1.5mm 0;
          }

          @page {
            margin: 3mm 4mm;
            size: A4 portrait;
          }

          .id-card-front-portrait,
          .id-card-back-portrait {
            width: 60mm;
            height: 90mm;
            padding: 2.5mm 3.5mm;
          }

          .id-card-top-border,
          .id-card-bottom-border {
            height: 2.5mm;
          }

          .id-card-logo-portrait,
          .id-card-back-logo-portrait {
            width: 10mm;
            height: 10mm;
          }

          .id-card-photo-portrait {
            width: 22mm;
            height: 26mm;
          }

          .id-card-school-name-portrait,
          .id-card-back-school-name-portrait {
            font-size: 4.5pt;
          }

          .id-card-school-address-portrait {
            font-size: 3pt;
          }

          .id-card-title-portrait {
            font-size: 4.5pt;
            padding: 0.6mm 2mm;
          }

          .id-card-detail-row-portrait {
            font-size: 4pt;
            min-height: 4mm;
          }

          .id-card-label-portrait {
            font-size: 3.5pt;
            min-width: 12mm;
          }

          .id-card-email-portrait {
            font-size: 3.5pt;
          }

          .id-card-back-item-portrait .label-portrait {
            font-size: 3pt;
          }

          .id-card-back-item-portrait .value-portrait {
            font-size: 4pt;
          }

          .id-card-back-terms-portrait p {
            font-size: 3pt;
          }

          .id-card-back-footer-portrait {
            font-size: 3pt;
          }
        }
      `}</style>
    </ResponsiveLayout>
  )
}
