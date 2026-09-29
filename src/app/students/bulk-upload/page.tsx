// src/app/students/bulk-upload/page.tsx
"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  FileCheck,
  FileX,
  Clock,
  Users,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Progress, AnimatedProgress, ProgressSteps } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { useToastStore } from "@/store/useStore";
import { cn } from "@/lib/utils";

// ============================
// TYPES
// ============================

interface UploadResult {
  success: boolean;
  message: string;
  total: number;
  imported: number;
  failed: number;
  errors?: string[];
}

interface UploadStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

// ============================
// MAIN COMPONENT
// ============================

export default function BulkUploadPage() {
  const router = useRouter();
  const addToast = useToastStore((state) => state.addToast);

  // ============================
  // STATE
  // ============================
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ============================
  // STEPS CONFIG
  // ============================
  const steps: UploadStep[] = [
    { id: '1', label: 'Select File', status: 'pending' },
    { id: '2', label: 'Validate', status: 'pending' },
    { id: '3', label: 'Upload', status: 'pending' },
    { id: '4', label: 'Complete', status: 'pending' },
  ];

  // ============================
  // HELPERS
  // ============================
  const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

  const getStepStatus = (stepIndex: number): 'pending' | 'active' | 'completed' | 'error' => {
    if (stepIndex < currentStep) return 'completed';
    if (stepIndex === currentStep) return 'active';
    return 'pending';
  };

  // ============================
  // DOWNLOAD TEMPLATE
  // ============================
  const downloadTemplate = useCallback(() => {
    const template = [
      {
        "Name": "John Doe",
        "Name (Bangla)": "জন ডো",
        "Father's Name": "Mr. Doe",
        "Father's Name (Bangla)": "মি. ডো",
        "Mother's Name": "Mrs. Doe",
        "Mother's Name (Bangla)": "মিসেস ডো",
        "Date of Birth": "2015-05-15",
        "Gender": "Male",
        "Blood Group": "O+",
        "Contact Number": "017XXXXXXXX",
        "District": "Dhaka",
        "Police Station": "Gulshan",
        "Post Office": "Gulshan-1",
        "Village": "Uttar Badda",
        "Class": "One",
        "Section": "A",
        "Class Roll": "1",
        "Father's Contact": "018XXXXXXXX",
        "Mother's Contact": "019XXXXXXXX",
        "Email": "student@example.com",
        "WhatsApp": "017XXXXXXXX",
        "Birth Certificate No": "123456789",
        "Father's NID": "1234567890123",
        "Mother's NID": "1234567890124",
      },
    ];

    // Create CSV
    const headers = Object.keys(template[0]);
    const csvRows = [
      headers.join(','),
      ...template.map(row => headers.map(h => {
        const val = row[h as keyof typeof row] || '';
        return `"${val}"`;
      }).join(','))
    ];
    const csvString = csvRows.join('\n');
    
    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `student_bulk_upload_template_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    addToast({
      type: 'success',
      title: 'Template Downloaded',
      message: 'Fill the template with student data and upload.',
    });
  }, [addToast]);

  // ============================
  // FILE HANDLING
  // ============================
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    await processFile(selectedFile);
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const droppedFile = e.dataTransfer.files?.[0];
    if (!droppedFile) return;
    await processFile(droppedFile);
  }, []);

  const processFile = async (selectedFile: File) => {
    // Check extension
    const ext = '.' + selectedFile.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      addToast({
        type: 'error',
        title: 'Invalid File',
        message: 'Please upload Excel (.xlsx, .xls) or CSV file',
      });
      return;
    }

    // Check file size (max 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      addToast({
        type: 'error',
        title: 'File Too Large',
        message: 'File size must be less than 10MB',
      });
      return;
    }

    setFile(selectedFile);
    setResult(null);
    setProgress(0);
    setCurrentStep(1);
    setUploadedCount(0);
    setTotalCount(0);

    // Preview first few rows
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      const response = await fetch('/api/students/preview', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const data = await response.json();
        setPreviewData(data.preview || []);
        setTotalCount(data.total || 0);
        addToast({
          type: 'success',
          title: 'File Loaded',
          message: `${data.total || 0} records found in file`,
        });
      } else {
        const error = await response.json();
        addToast({
          type: 'error',
          title: 'Preview Failed',
          message: error.error || 'Failed to preview file',
        });
      }
    } catch (error) {
      console.error('Preview error:', error);
    }
  };

  // ============================
  // UPLOAD FILE
  // ============================
  const handleUpload = async () => {
    if (!file) {
      addToast({
        type: 'error',
        title: 'No File',
        message: 'Please select a file to upload',
      });
      return;
    }

    setUploading(true);
    setProgress(10);
    setCurrentStep(2);

    try {
      const formData = new FormData();
      formData.append('file', file);

      setProgress(30);
      setCurrentStep(3);

      const response = await fetch('/api/students/bulk-upload', {
        method: 'POST',
        body: formData,
      });

      setProgress(80);

      const data = await response.json();

      setProgress(100);
      setCurrentStep(4);
      setUploadedCount(data.imported || 0);

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setResult({
        success: data.success,
        message: data.message,
        total: data.total || 0,
        imported: data.imported || 0,
        failed: data.failed || 0,
        errors: data.errors || [],
      });

      // Update steps status
      if (data.imported > 0 && data.failed === 0) {
        steps.forEach((_, index) => {
          if (index < 4) steps[index].status = 'completed';
        });
      }

      if (data.imported > 0) {
        addToast({
          type: 'success',
          title: 'Upload Complete',
          message: `${data.imported} students imported successfully!`,
          duration: 5000,
        });
      }

      if (data.failed > 0) {
        addToast({
          type: 'warning',
          title: 'Partial Success',
          message: `${data.failed} records failed to import. Download error report.`,
          duration: 5000,
        });
      }

    } catch (error: any) {
      setProgress(0);
      setCurrentStep(3);
      steps.forEach((step) => {
        if (step.status === 'active') step.status = 'error';
      });
      
      addToast({
        type: 'error',
        title: 'Upload Failed',
        message: error.message || 'An unexpected error occurred',
      });
      
      setResult({
        success: false,
        message: error.message || 'Upload failed',
        total: 0,
        imported: 0,
        failed: 0,
        errors: [error.message || 'Unknown error'],
      });
    } finally {
      setUploading(false);
    }
  };

  // ============================
  // RESET
  // ============================
  const resetForm = () => {
    setFile(null);
    setResult(null);
    setProgress(0);
    setPreviewData([]);
    setCurrentStep(0);
    setUploadedCount(0);
    setTotalCount(0);
    steps.forEach((step) => step.status = 'pending');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ============================
  // DOWNLOAD ERROR REPORT
  // ============================
  const downloadErrorReport = () => {
    if (!result?.errors?.length) return;
    
    const content = [
      '═══════════════════════════════════════════',
      '   STUDENT BULK UPLOAD ERROR REPORT',
      '═══════════════════════════════════════════',
      '',
      `📅 Generated: ${new Date().toLocaleString()}`,
      '',
      '📊 SUMMARY',
      '───────────────────────────────────────────',
      `Total Records   : ${result.total}`,
      `✅ Imported     : ${result.imported}`,
      `❌ Failed      : ${result.failed}`,
      `📈 Success Rate: ${result.total > 0 ? Math.round((result.imported / result.total) * 100) : 0}%`,
      '',
      '───────────────────────────────────────────',
      '❌ ERROR DETAILS',
      '───────────────────────────────────────────',
      '',
      ...result.errors.map((err, i) => `  ${String(i + 1).padStart(3, '0')}. ${err}`),
      '',
      '═══════════════════════════════════════════',
      '  Please fix the errors and try again.',
      '  Contact support if you need assistance.',
      '═══════════════════════════════════════════',
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk_upload_errors_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    addToast({
      type: 'success',
      title: 'Report Downloaded',
      message: 'Error report downloaded successfully',
    });
  };

  // ============================
  // RENDER
  // ============================
  return (
    <ResponsiveLayout>
      <div className="space-y-6 p-4 max-w-7xl mx-auto">

        {/* ============================================================
            HEADER - GRADIENT
        ============================================================ */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 rounded-lg shadow-lg p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                asChild
                className="text-white hover:bg-white/20"
              >
                <Link href="/students/list">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-white font-heading">
                  Bulk Upload Students
                </h1>
                <p className="text-white/80">
                  Upload multiple students at once using Excel or CSV file
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Badge className="bg-white/20 text-white border border-white/30">
                ⚡ PRO ERP
              </Badge>
              <Badge className="bg-green-500/30 text-green-100 border border-green-400/30">
                <Users className="h-3 w-3 mr-1" />
                Batch Upload
              </Badge>
            </div>
          </div>
        </div>

        {/* ============================================================
            STEPS PROGRESS
        ============================================================ */}
        <div className="px-2">
          <ProgressSteps 
            steps={steps.map((step, index) => ({
              ...step,
              status: getStepStatus(index)
            }))}
            currentStep={currentStep}
          />
        </div>

        {/* ============================================================
            MAIN GRID
        ============================================================ */}
        <div className="grid gap-6 md:grid-cols-2">

          {/* ============================================================
              LEFT CARD - TEMPLATE
          ============================================================ */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                <FileSpreadsheet className="h-5 w-5 text-indigo-500" />
                Download Template
              </CardTitle>
              <CardDescription className="text-gray-500 dark:text-gray-400">
                Download the template and fill with student data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Template Button */}
              <Button
                onClick={downloadTemplate}
                variant="outline"
                className="w-full border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:border-indigo-300"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Template (CSV)
              </Button>
              
              {/* Required Fields */}
              <div className="text-sm">
                <p className="font-medium mb-2 text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  Required Fields
                </p>
                <ul className="grid grid-cols-2 gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <li className="flex items-center gap-1">
                    <span className="text-red-500">*</span> Name
                  </li>
                  <li className="flex items-center gap-1">
                    <span className="text-red-500">*</span> Father's Name
                  </li>
                  <li className="flex items-center gap-1">
                    <span className="text-red-500">*</span> Mother's Name
                  </li>
                  <li className="flex items-center gap-1">
                    <span className="text-red-500">*</span> Date of Birth
                  </li>
                  <li className="flex items-center gap-1">
                    <span className="text-red-500">*</span> Gender
                  </li>
                  <li className="flex items-center gap-1">
                    <span className="text-red-500">*</span> Contact Number
                  </li>
                  <li className="flex items-center gap-1">
                    <span className="text-red-500">*</span> Class
                  </li>
                  <li className="flex items-center gap-1">
                    <span className="text-red-500">*</span> Section
                  </li>
                </ul>
              </div>

              {/* Tips */}
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                  <span className="text-base">💡</span>
                  <span>
                    <strong>Date format:</strong> YYYY-MM-DD (e.g., 2015-05-15)<br />
                    <strong>Supported:</strong> 15-05-2015, 15/05/2015, 2015-05-15
                  </span>
                </p>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span>Max 1000 records</span>
                </div>
                <div className="flex items-center gap-1">
                  <FileCheck className="h-3 w-3" />
                  <span>.xlsx, .xls, .csv</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>~2-5 mins</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ============================================================
              RIGHT CARD - UPLOAD
          ============================================================ */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                <Upload className="h-5 w-5 text-indigo-500" />
                Upload File
              </CardTitle>
              <CardDescription className="text-gray-500 dark:text-gray-400">
                Upload your filled Excel or CSV file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drop Zone */}
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200",
                  dragActive && "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20 scale-[1.01]",
                  file && !dragActive && "border-green-500 bg-green-50 dark:bg-green-950/20",
                  !file && !dragActive && "border-gray-300 dark:border-gray-600 hover:border-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  id="file-upload"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  {file ? (
                    <>
                      <div className="relative">
                        <FileCheck className="h-12 w-12 text-green-500 mb-3" />
                        <div className="absolute -top-1 -right-1">
                          <Badge className="bg-green-500 text-white text-xs px-1.5 py-0.5">
                            {totalCount || '?'} records
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {(file.size / 1024).toFixed(1)} KB • Ready to upload
                      </p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-12 w-12 text-gray-400 mb-3" />
                      <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                        Click to select or drag and drop
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Excel (.xlsx, .xls) or CSV files only
                      </p>
                    </>
                  )}
                </label>
              </div>

              {/* Preview */}
              {previewData.length > 0 && (
                <div className="text-sm">
                  <p className="font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-indigo-500" />
                    Preview (first {Math.min(previewData.length, 3)} rows)
                  </p>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 overflow-x-auto max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700">
                    <pre className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                      {JSON.stringify(previewData.slice(0, 3), null, 2)}
                    </pre>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Showing {Math.min(previewData.length, 3)} of {totalCount} records
                  </p>
                </div>
              )}

              {/* Progress Bar */}
              {uploading && (
                <div className="pt-2">
                  <AnimatedProgress
                    value={progress}
                    max={100}
                    label={
                      currentStep === 2 ? '📋 Validating file...' :
                      currentStep === 3 ? '📤 Uploading to database...' :
                      '✅ Processing complete'
                    }
                    status={
                      progress === 100 ? 'success' :
                      currentStep === 4 ? 'success' :
                      'loading'
                    }
                    showPercentage
                  />
                  <p className="text-xs text-gray-400 mt-1 text-center">
                    {progress < 30 && 'Preparing data...'}
                    {progress >= 30 && progress < 60 && 'Validating records...'}
                    {progress >= 60 && progress < 90 && 'Importing to database...'}
                    {progress >= 90 && progress < 100 && 'Finalizing...'}
                    {progress === 100 && '✅ Complete!'}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={handleUpload}
                  disabled={!file || uploading}
                  className={cn(
                    "flex-1 transition-all",
                    !file || uploading ? "opacity-50 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
                  )}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {progress < 100 ? `Uploading... ${Math.round(progress)}%` : 'Processing...'}
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      {file ? 'Start Upload' : 'Select File First'}
                    </>
                  )}
                </Button>
                {file && !uploading && (
                  <Button
                    variant="outline"
                    onClick={resetForm}
                    className="border-gray-300 dark:border-gray-600"
                  >
                    Reset
                  </Button>
                )}
              </div>

              {/* Upload Stats */}
              {uploading && progress > 0 && progress < 100 && (
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>⏳ Processing...</span>
                  <span>{Math.round(progress)}% complete</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ============================================================
            RESULT CARD
        ============================================================ */}
        {result && (
          <Card className={cn(
            "border-2 shadow-lg transition-all duration-500",
            result.success && result.failed === 0 && "border-green-200 dark:border-green-800",
            result.success && result.failed > 0 && "border-yellow-200 dark:border-yellow-800",
            !result.success && "border-red-200 dark:border-red-800"
          )}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                {result.success && result.failed === 0 && (
                  <CheckCircle className="h-6 w-6 text-green-500" />
                )}
                {result.success && result.failed > 0 && (
                  <AlertCircle className="h-6 w-6 text-yellow-500" />
                )}
                {!result.success && (
                  <XCircle className="h-6 w-6 text-red-500" />
                )}
                Upload Result
                <Badge className={cn(
                  "ml-2",
                  result.success && result.failed === 0 && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
                  result.success && result.failed > 0 && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
                  !result.success && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                )}>
                  {result.success && result.failed === 0 ? '✅ Success' :
                   result.success && result.failed > 0 ? '⚠️ Partial' :
                   '❌ Failed'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {result.total}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1">
                    <Users className="h-3 w-3" />
                    Total Records
                  </p>
                </div>
                <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-lg text-center border border-green-200 dark:border-green-800">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {result.imported}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 flex items-center justify-center gap-1">
                    <UserPlus className="h-3 w-3" />
                    Imported
                  </p>
                </div>
                <div className={cn(
                  "p-3 rounded-lg text-center border",
                  result.failed > 0 ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800" : "bg-gray-50 dark:bg-gray-700/50"
                )}>
                  <p className={cn(
                    "text-2xl font-bold",
                    result.failed > 0 ? "text-red-600 dark:text-red-400" : "text-gray-400"
                  )}>
                    {result.failed}
                  </p>
                  <p className={cn(
                    "text-xs flex items-center justify-center gap-1",
                    result.failed > 0 ? "text-red-600 dark:text-red-400" : "text-gray-400"
                  )}>
                    <FileX className="h-3 w-3" />
                    Failed
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg text-center border border-blue-200 dark:border-blue-800">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {result.total > 0 ? Math.round((result.imported / result.total) * 100) : 0}%
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center justify-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Success Rate
                  </p>
                </div>
              </div>

              {/* Message */}
              <p className={cn(
                "text-sm font-medium p-2 rounded-lg",
                result.success && result.failed === 0 && "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20",
                result.success && result.failed > 0 && "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/20",
                !result.success && "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20"
              )}>
                {result.message}
              </p>

              {/* Errors */}
              {result.errors && result.errors.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Errors ({result.errors.length})
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={downloadErrorReport}
                      className="border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download Report
                    </Button>
                  </div>
                  <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3 max-h-40 overflow-y-auto border border-red-200 dark:border-red-800">
                    <ul className="list-disc list-inside space-y-1 text-sm text-red-600 dark:text-red-400">
                      {result.errors.slice(0, 20).map((err, idx) => (
                        <li key={idx} className="break-all">{err}</li>
                      ))}
                      {result.errors.length > 20 && (
                        <li className="text-gray-500 dark:text-gray-400">
                          ... and {result.errors.length - 20} more errors
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ============================================================
            ACTION BUTTONS
        ============================================================ */}
        {result && (
          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={resetForm}
              className="border-gray-300 dark:border-gray-600"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload More
            </Button>
            {result.imported > 0 && (
              <>
                <Button
                  variant="outline"
                  onClick={() => router.push('/students/list')}
                  className="border-gray-300 dark:border-gray-600"
                >
                  <Users className="h-4 w-4 mr-2" />
                  View All Students
                </Button>
                <Button
                  onClick={() => router.push('/students/list')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Go to Student List
                </Button>
              </>
            )}
          </div>
        )}

        {/* ============================================================
            INFO BANNER
        ============================================================ */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                ⚡ Bulk Upload Tips
              </h4>
              <ul className="text-xs text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                <li>• Maximum <strong>1000 records</strong> per upload</li>
                <li>• File size limit: <strong>10MB</strong></li>
                <li>• Class and Section names must match existing data</li>
                <li>• Duplicate students are automatically detected</li>
                <li>• Download error report for failed records</li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </ResponsiveLayout>
  );
}
