// src/components/print/SchoolPrintHeader.tsx
"use client"

import { useSchoolSettings } from '@/hooks/useSchoolSettings'

interface SchoolPrintHeaderProps {
  title: string
  showStudentPhoto?: boolean
  studentPhotoUrl?: string | null
}

export function SchoolPrintHeader({
  title,
  showStudentPhoto = false,
  studentPhotoUrl,
}: SchoolPrintHeaderProps) {
  const { data: schoolSettings } = useSchoolSettings()

  if (!schoolSettings) return null

  return `
    <div style="width:100%; display:flex; justify-content:center; margin-bottom:10px;">
      <div style="display:inline-flex; align-items:center; gap:15px; border-bottom:2px solid #000; padding-bottom:8px;">
        ${schoolSettings.school_logo ? `<img src="${schoolSettings.school_logo}" alt="Logo" style="height:70px; width:auto; object-fit:contain;" />` : ''}
        <div style="text-align:center;">
          <div style="font-size:20px; font-weight:700; text-transform:uppercase; margin:2px 0; color:#1a1a2e;">${schoolSettings.school_name}</div>
          ${schoolSettings.school_address ? `<div style="font-size:12px; font-weight:500; color:#333; margin:1px 0;">${schoolSettings.school_address}</div>` : ''}
          <div style="font-size:10px; color:#555; margin:1px 0;">
            ${schoolSettings.school_phone ? `Mobile: ${schoolSettings.school_phone}` : ''}
            ${schoolSettings.school_email ? ` | Email: ${schoolSettings.school_email}` : ''}
          </div>
        </div>
        ${showStudentPhoto ? `<div style="flex-shrink:0;">${studentPhotoUrl ? `<img src="${studentPhotoUrl}" alt="Student Photo" style="max-height:110px; max-width:100px; border:1px solid #ddd; border-radius:4px; object-fit:cover;" />` : '<div style="width:100px; height:110px; border:1px dashed #999; border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:10px; color:#999;">No Photo</div>'}</div>` : ''}
      </div>
    </div>
    <div style="text-align:center; margin:10px 0;">
      <div style="font-size:14px; font-weight:700; color:#1a3e60; border-top:1px solid #ccc; border-bottom:1px solid #ccc; padding:6px 0; display:inline-block;">${title}</div>
    </div>
  `
}

export function getSchoolPrintHeader(
  schoolSettings: {
    school_name?: string
    school_address?: string
    school_phone?: string
    school_email?: string
    school_logo?: string
  },
  title: string,
  showStudentPhoto = false,
  studentPhotoUrl?: string | null
) {
  return `
    <div style="width:100%; display:flex; justify-content:center; margin-bottom:10px;">
      <div style="display:inline-flex; align-items:center; gap:15px; border-bottom:2px solid #000; padding-bottom:8px;">
        ${schoolSettings.school_logo ? `<img src="${schoolSettings.school_logo}" alt="Logo" style="height:70px; width:auto; object-fit:contain;" />` : ''}
        <div style="text-align:center;">
          <div style="font-size:20px; font-weight:700; text-transform:uppercase; margin:2px 0; color:#1a1a2e;">${schoolSettings.school_name || ''}</div>
          ${schoolSettings.school_address ? `<div style="font-size:12px; font-weight:500; color:#333; margin:1px 0;">${schoolSettings.school_address}</div>` : ''}
          <div style="font-size:10px; color:#555; margin:1px 0;">
            ${schoolSettings.school_phone ? `Mobile: ${schoolSettings.school_phone}` : ''}
            ${schoolSettings.school_email ? ` | Email: ${schoolSettings.school_email}` : ''}
          </div>
        </div>
        ${showStudentPhoto ? `<div style="flex-shrink:0;">${studentPhotoUrl ? `<img src="${studentPhotoUrl}" alt="Student Photo" style="max-height:110px; max-width:100px; border:1px solid #ddd; border-radius:4px; object-fit:cover;" />` : '<div style="width:100px; height:110px; border:1px dashed #999; border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:10px; color:#999;">No Photo</div>'}</div>` : ''}
      </div>
    </div>
    <div style="text-align:center; margin:10px 0;">
      <div style="font-size:14px; font-weight:700; color:#1a3e60; border-top:1px solid #ccc; border-bottom:1px solid #ccc; padding:6px 0; display:inline-block;">${title}</div>
    </div>
  `
}