// src/app/api/students/bulk-upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import * as XLSX from 'xlsx';

// Validation Schema
const BulkUploadSchema = z.object({
  students: z.array(z.object({
    name: z.string().min(2, 'Name is required'),
    father_name: z.string().min(2, "Father's name is required"),
    mother_name: z.string().min(2, "Mother's name is required"),
    dob: z.string().min(1, 'Date of birth is required'),
    gender: z.string().min(1, 'Gender is required'),
    contact: z.string().min(11, 'Valid contact number is required'),
    class_name: z.string().min(1, 'Class is required'),
    section_name: z.string().min(1, 'Section is required'),
    name_bn: z.string().optional(),
    father_name_bn: z.string().optional(),
    mother_name_bn: z.string().optional(),
    birth_cert_no: z.string().optional(),
    blood_group: z.string().optional(),
    particular_disease: z.string().optional(),
    village: z.string().optional(),
    post_office: z.string().optional(),
    police_station: z.string().optional(),
    district: z.string().optional(),
    class_roll: z.string().optional(),
    fathers_contact: z.string().optional(),
    mothers_contact: z.string().optional(),
    email: z.string().email().optional(),
    whatsapp: z.string().optional(),
    father_nid_no: z.string().optional(),
    mother_nid_no: z.string().optional(),
  })).min(1, 'No students data found'),
});

// ============================
// HELPERS
// ============================

function parseDateValue(value: any): string {
  if (!value) return '';
  
  if (typeof value === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0];
  }
  
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
      const parts = value.split('-');
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      const parts = value.split('/');
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  return '';
}

function mapColumnNames(row: any): any {
  const mapping: Record<string, string> = {
    'Name': 'name',
    'Name (Bangla)': 'name_bn',
    "Father's Name": 'father_name',
    'Father Name': 'father_name',
    "Father's Name (Bangla)": 'father_name_bn',
    "Mother's Name": 'mother_name',
    'Mother Name': 'mother_name',
    "Mother's Name (Bangla)": 'mother_name_bn',
    'Date of Birth': 'dob',
    'dob': 'dob',
    'Gender': 'gender',
    'Blood Group': 'blood_group',
    'Contact Number': 'contact',
    'District': 'district',
    'Police Station': 'police_station',
    'Post Office': 'post_office',
    'Village': 'village',
    'Class': 'class_name',
    'Section': 'section_name',
    'Class Roll': 'class_roll',
    "Father's Contact": 'fathers_contact',
    "Mother's Contact": 'mothers_contact',
    'Email': 'email',
    'WhatsApp': 'whatsapp',
    'Birth Certificate No': 'birth_cert_no',
    "Father's NID": 'father_nid_no',
    "Mother's NID": 'mother_nid_no',
  };

  const mapped: any = {};
  Object.keys(row).forEach(key => {
    const mappedKey = mapping[key] || key;
    mapped[mappedKey] = row[key];
  });
  return mapped;
}

function parseFile(buffer: Buffer, filename: string): any[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);
  return jsonData.map(row => {
    const mapped = mapColumnNames(row);
    if (mapped.dob) {
      mapped.dob = parseDateValue(mapped.dob);
    }
    return mapped;
  });
}

// ============================
// MAIN HANDLER
// ============================

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Check file type
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload Excel or CSV file.' },
        { status: 400 }
      );
    }

    // Parse file
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsedData = parseFile(buffer, file.name);

    if (parsedData.length === 0) {
      return NextResponse.json(
        { error: 'No data found in file' },
        { status: 400 }
      );
    }

    // Validate data
    const validationResult = BulkUploadSchema.safeParse({ students: parsedData });
    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validationResult.error.issues.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      }, { status: 400 });
    }

    // Chunk data into batches of 100
    const chunkSize = 100;
    const chunks = [];
    for (let i = 0; i < parsedData.length; i += chunkSize) {
      chunks.push(parsedData.slice(i, i + chunkSize));
    }

    // Process each chunk
    const supabase = await createClient();
    let totalImported = 0;
    let totalFailed = 0;
    let allErrors: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Call Supabase RPC
      const { data, error } = await supabase.rpc('bulk_upload_students', {
        students_data: chunk,
      });

      if (error) {
        console.error('RPC error:', error);
        allErrors.push(`Chunk ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        totalFailed += chunk.length;
      } else {
        totalImported += data?.imported || 0;
        totalFailed += data?.failed || 0;
        if (data?.errors && data.errors.length > 0) {
          allErrors = allErrors.concat(data.errors);
        }
      }
    }

    // Return result
    return NextResponse.json({
      success: totalImported > 0,
      total: parsedData.length,
      imported: totalImported,
      failed: totalFailed,
      errors: allErrors.slice(0, 50),
      message: `${totalImported} students imported, ${totalFailed} failed`,
    });

  } catch (error: any) {
    console.error('Bulk upload error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
    }, { status: 500 });
  }
}