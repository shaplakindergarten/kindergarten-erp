"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Loader2,
  Printer,
  User,
  Package,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  LucideIcon
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency, formatDate } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { ResponsiveLayout } from "@/components/layout/responsive-layout"

const supabase = createClient()

// --- Types ---
type IssueStatus = 'requested' | 'approved' | 'issued' | 'returned'
type IssuedToType = 'staff' | 'student'

interface InventoryIssuance {
  id: string
  issuance_no: string
  issue_no?: string
  item_id: string
  item_type: 'asset' | 'consumable' | 'saleable'
  issued_to_type: IssuedToType
  issued_to_id: string
  issued_to_name: string
  quantity: number
  unit: string
  issuance_date: string
  purpose?: string | null
  status: IssueStatus
  created_at?: string
  updated_at?: string
}

interface InventoryItem {
  id: string
  item_code: string
  name: string
  unit: string
  purchase_price: number
  selling_price: number
  current_stock: number
}

interface SchoolSettings {
  school_name: string
  school_address: string
  school_phone: string
  school_email: string
  school_logo: string | null
}

interface PageProps {
  params: Promise<{ id: string }>
}

// --- Status Config Helper ---
const STATUS_CONFIG: Record<IssueStatus, { style: string; label: string; icon: LucideIcon }> = {
  requested: { style: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800', label: 'Requested', icon: Clock },
  approved: { style: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800', label: 'Approved', icon: CheckCircle2 },
  issued: { style: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800', label: 'Issued', icon: CheckCircle2 },
  returned: { style: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800', label: 'Returned', icon: XCircle }
}

// --- Printable Document Generator ---
const generatePrintHTML = (school: SchoolSettings, d: any) => `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Issuance Voucher - ${d.no}</title>
    <meta charset="UTF-8">
    <style>
      @page { 
        size: A4; 
        margin: 0.5in; 
      }
      
      * { 
        margin: 0; 
        padding: 0; 
        box-sizing: border-box; 
      }
      
      html, body {
        margin: 0;
        padding: 0;
        background: white;
      }
      
      body { 
        font-family: Arial, sans-serif; 
        color: #1a1a2e; 
        font-size: 12px; 
        line-height: 1.5; 
        background: white; 
      }
      
      .container { 
        width: 100%; 
        padding: 0;
      }
      
      .header { 
        text-align: center; 
        border-bottom: 2px solid #1a1a2e; 
        padding-bottom: 12px; 
        margin-bottom: 16px; 
      }
      
      .school-name { 
        font-size: 20px; 
        font-weight: 700; 
      }
      
      .school-address { 
        font-size: 11px; 
        color: #4b5563; 
        margin: 2px 0; 
      }
      
      .school-contact { 
        font-size: 10px; 
        color: #6b7280; 
      }
      
      .voucher-title { 
        font-size: 17px; 
        font-weight: 700; 
        margin-top: 8px; 
        padding: 4px 20px; 
        border-top: 1px solid #d1d5db; 
        border-bottom: 1px solid #d1d5db; 
        display: inline-block; 
        letter-spacing: 2px; 
      }
      
      .info-row { 
        display: flex; 
        justify-content: space-between; 
        padding: 8px 12px; 
        background: #f8fafc; 
        border-left: 3px solid #1a1a2e; 
        margin-bottom: 14px; 
        font-size: 12px; 
      }
      
      .details-row { 
        display: flex; 
        gap: 14px; 
        margin-bottom: 14px; 
      }
      
      .details-box { 
        flex: 1; 
        padding: 8px 12px; 
        border: 1px solid #d1d5db; 
      }
      
      .details-box .label { 
        font-size: 9px; 
        font-weight: 600; 
        color: #6b7280; 
        text-transform: uppercase; 
        letter-spacing: 0.5px; 
      }
      
      .details-box .value { 
        font-size: 14px; 
        font-weight: 600; 
        margin-top: 2px; 
      }
      
      .details-box .sub { 
        font-size: 11px; 
        color: #6b7280; 
      }
      
      .table-wrap { 
        margin-bottom: 14px; 
      }
      
      .table-wrap table { 
        width: 100%; 
        border-collapse: collapse; 
      }
      
      .table-wrap th { 
        background: #1a1a2e; 
        color: white; 
        padding: 6px 10px; 
        font-size: 10px; 
        font-weight: 600; 
        text-transform: uppercase; 
        white-space: nowrap;
      }
      
      .table-wrap th:not(:first-child), 
      .table-wrap td:not(:first-child) { 
        text-align: right; 
      }
      
      .table-wrap td { 
        padding: 6px 10px; 
        font-size: 12px; 
        border-bottom: 1px solid #e5e7eb; 
        white-space: nowrap;
      }
      
      .total-box { 
        background: #f1f5f9; 
        border: 2px solid #1a1a2e; 
        padding: 10px 16px; 
        display: flex; 
        justify-content: space-between; 
        margin-bottom: 14px; 
      }
      
      .total-box .label, 
      .total-box .amount { 
        font-size: 16px; 
        font-weight: 700; 
      }
      
      .purpose-box { 
        background: #fefce8; 
        border-left: 3px solid #eab308; 
        padding: 8px 12px; 
        margin-bottom: 14px; 
        font-size: 12px; 
      }
      
      .purpose-box strong { 
        color: #854d0e; 
      }
      
      .footer { 
        display: flex; 
        justify-content: space-between; 
        margin-top: 40px; 
        padding-top: 14px; 
        border-top: 1px solid #d1d5db;
      }
      
      .signature { 
        text-align: center; 
        min-width: 140px; 
      }
      
      .signature .line { 
        border-bottom: 1px solid #1a1a2e; 
        width: 140px; 
        margin: 0 auto 4px; 
        height: 30px; 
      }
      
      .signature .label { 
        font-size: 11px; 
        font-weight: 600; 
      }
      
      .signature .sub { 
        font-size: 9px; 
        color: #6b7280; 
      }
      
      @media print {
        html, body {
          margin: 0;
          padding: 0;
          background: white;
        }
        
        .container {
          padding: 0;
        }
        
        .info-row { 
          background: #f8fafc !important; 
          -webkit-print-color-adjust: exact !important; 
          print-color-adjust: exact !important; 
        }
        
        .table-wrap th { 
          background: #1a1a2e !important; 
          -webkit-print-color-adjust: exact !important; 
          print-color-adjust: exact !important; 
        }
        
        .total-box { 
          background: #f1f5f9 !important; 
          -webkit-print-color-adjust: exact !important; 
          print-color-adjust: exact !important; 
        }
        
        .purpose-box { 
          background: #fefce8 !important; 
          -webkit-print-color-adjust: exact !important; 
          print-color-adjust: exact !important; 
        }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="school-name">${school.school_name}</div>
        <div class="school-address">${school.school_address}</div>
        <div class="school-contact">
          ${school.school_phone ? `Phone: ${school.school_phone}` : ''} ${school.school_email ? `| Email: ${school.school_email}` : ''}
        </div>
        <div class="voucher-title">ISSUANCE VOUCHER</div>
      </div>
      
      <div class="info-row">
        <span><strong>Voucher No:</strong> ${d.no}</span>
        <span><strong>Date:</strong> ${d.date}</span>
        <span><strong>Status:</strong> ${d.statusText}</span>
      </div>
      
      <div class="details-row">
        <div class="details-box">
          <div class="label">Recipient</div>
          <div class="value">${d.name}</div>
          <div class="sub">${d.typeLabel} | Type: ${d.itemType}</div>
        </div>
        <div class="details-box">
          <div class="label">Item</div>
          <div class="value">${d.itemName}</div>
          <div class="sub">Code: ${d.itemCode} | Unit: ${d.unit}</div>
        </div>
      </div>
      
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:6%;text-align:center;">#</th>
              <th style="width:22%;text-align:left;">Item Code</th>
              <th style="width:30%;text-align:left;">Item Name</th>
              <th style="width:12%;text-align:right;">Issued Qty</th>
              <th style="width:15%;text-align:right;">Unit Price</th>
              <th style="width:15%;text-align:right;">Est. Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="text-align:center;">1</td>
              <td style="text-align:left;">${d.itemCode}</td>
              <td style="text-align:left;">${d.itemName}</td>
              <td style="text-align:right;">${d.qty}</td>
              <td style="text-align:right;">BDT ${d.price.toFixed(2)}</td>
              <td style="text-align:right;font-weight:600;">BDT ${d.total.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="total-box">
        <span class="label">Grand Total</span>
        <span class="amount">BDT ${d.total.toFixed(2)}</span>
      </div>
      
      ${d.purpose ? `<div class="purpose-box"><strong>Purpose:</strong> ${d.purpose}</div>` : ''}
      
      <div class="footer">
        <div class="signature">
          <div class="line"></div>
          <div class="label">Issued By</div>
          <div class="sub">(Signature)</div>
        </div>
        <div class="signature">
          <div class="line"></div>
          <div class="label">Received By</div>
          <div class="sub">(${d.name})</div>
        </div>
      </div>
    </div>
    <script>
      window.onload = function() {
        setTimeout(function() { 
          window.print(); 
        }, 300);
        window.onafterprint = function() { 
          window.close(); 
        };
      };
    </script>
  </body>
  </html>
`

export default function IssuanceDetailPage({ params }: PageProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [issuance, setIssuance] = useState<InventoryIssuance | null>(null)
  const [item, setItem] = useState<InventoryItem | null>(null)
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null)

  const resolvedParams = React.use(params)
  const issuanceId = resolvedParams.id

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [settingsRes, issuanceRes] = await Promise.all([
          supabase
            .from('school_settings')
            .select('school_name, school_address, school_phone, school_email, school_logo')
            .limit(1)
            .single(),
          supabase
            .from('inventory_issuances')
            .select('*')
            .eq('id', issuanceId)
            .single()
        ])

        if (!settingsRes.error && settingsRes.data) {
          setSchoolSettings(settingsRes.data as SchoolSettings)
        }

        if (issuanceRes.error) throw issuanceRes.error

        const issuanceRecord = issuanceRes.data as InventoryIssuance
        setIssuance(issuanceRecord)

        if (issuanceRecord.item_id) {
          const { data: itemData, error: itemError } = await supabase
            .from('inventory_items')
            .select('id, item_code, name, unit, purchase_price, selling_price, current_stock')
            .eq('id', issuanceRecord.item_id)
            .single()

          if (!itemError) setItem(itemData as InventoryItem)
        }
      } catch (error) {
        console.error('Error loading issuance:', error)
        toast.error('Failed to load issuance details')
        router.push('/inventory/issuances')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [issuanceId, router])

  const renderStatusBadge = (status: IssueStatus) => {
    const current = STATUS_CONFIG[status] || STATUS_CONFIG.requested
    const Icon = current.icon

    return (
      <Badge variant="outline" className={`px-2.5 py-1 text-xs font-semibold gap-1.5 rounded-full ${current.style}`}>
        <Icon className="h-3.5 w-3.5" />
        {current.label}
      </Badge>
    )
  }

  const renderTypeBadge = (type: IssuedToType) => (
    <Badge 
      variant="secondary" 
      className={
        type === 'staff' 
          ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200" 
          : "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-200"
      }
    >
      {type === 'staff' ? 'Staff' : 'Student'}
    </Badge>
  )

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=700,scrollbars=yes')
    if (!printWindow) {
      toast.error('Please allow popups for printing')
      return
    }

    const school = schoolSettings || {
      school_name: 'School Name',
      school_address: 'School Address',
      school_phone: '',
      school_email: '',
      school_logo: null
    }

    const printData = {
      no: issuance?.issuance_no || issuance?.issue_no || 'N/A',
      name: issuance?.issued_to_name || 'N/A',
      type: issuance?.issued_to_type || 'staff',
      typeLabel: issuance?.issued_to_type === 'staff' ? 'Staff' : 'Student',
      itemName: item?.name || 'Unknown Item',
      itemCode: item?.item_code || 'N/A',
      qty: issuance?.quantity || 0,
      unit: issuance?.unit || 'pcs',
      status: issuance?.status || 'issued',
      statusText: STATUS_CONFIG[issuance?.status || 'issued']?.label || issuance?.status,
      date: issuance?.issuance_date ? formatDate(issuance.issuance_date) : 'N/A',
      purpose: issuance?.purpose || '',
      price: item?.purchase_price || 0,
      total: (issuance?.quantity || 0) * (item?.purchase_price || 0),
      itemType: issuance?.item_type || 'asset'
    }

    printWindow.document.write(generatePrintHTML(school, printData))
    printWindow.document.close()
  }

  if (loading) {
    return (
      <ResponsiveLayout>
        <div className="flex flex-col items-center justify-center min-h-[500px] gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Fetching issuance details...</p>
        </div>
      </ResponsiveLayout>
    )
  }

  if (!issuance) {
    return (
      <ResponsiveLayout>
        <div className="flex flex-col items-center justify-center min-h-[500px] text-center p-6">
          <div className="p-4 bg-muted rounded-full mb-4">
            <Package className="h-12 w-12 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Issuance Record Not Found</h2>
          <p className="text-muted-foreground max-w-md mt-1 mb-6">
            The record you are looking for does not exist, has been deleted, or you don't have permission to view it.
          </p>
          <Button onClick={() => router.push('/inventory/issuances')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Issuance List
          </Button>
        </div>
      </ResponsiveLayout>
    )
  }

  return (
    <ResponsiveLayout>
      <div className="max-w-5xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8">
        
        {/* Screen Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link href="/inventory/issuances">
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="sr-only">Back</span>
                </Button>
              </Link>
              <h1 className="text-2xl font-bold tracking-tight">Issuance Voucher</h1>
            </div>
            <p className="text-xs text-muted-foreground pl-10">
              Manage and view inventory distribution voucher details
            </p>
          </div>

          <Button onClick={handlePrint} className="gap-2 shadow-sm">
            <Printer className="h-4 w-4" />
            Print Voucher
          </Button>
        </div>

        {/* Main Content */}
        <div className="bg-card text-card-foreground rounded-xl border shadow-sm overflow-hidden">
          
          {/* Voucher Header */}
          <div className="p-6 border-b bg-muted/20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Voucher No</span>
                  {renderStatusBadge(issuance.status)}
                </div>
                <h2 className="text-3xl font-extrabold font-mono tracking-tight mt-1 text-primary">
                  {issuance.issuance_no}
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground block text-xs">Issue Date:</span>
                  <span className="font-semibold">{formatDate(issuance.issuance_date)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Item Type:</span>
                  <span className="font-semibold capitalize">{issuance.item_type}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="p-6 space-y-6">
            
            {/* Recipient & Item Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-lg border p-4 bg-background space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" /> Recipient Details
                  </span>
                  {renderTypeBadge(issuance.issued_to_type)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">{issuance.issued_to_name}</h3>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    ID: {issuance.issued_to_id || "N/A"}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border p-4 bg-background space-y-3">
                <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Purpose / Remarks
                </span>
                <p className="text-sm font-medium text-foreground">
                  {issuance.purpose || "No specific purpose recorded for this transaction."}
                </p>
              </div>
            </div>

            {/* Item Table */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Issued Item Summary</h3>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Item Code</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead className="text-right">Issued Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Est. Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-mono text-xs font-medium">
                        {item?.item_code || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-sm">{item?.name || 'Unknown Item'}</div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-sm">
                        {issuance.quantity} <span className="text-xs font-normal text-muted-foreground">{issuance.unit}</span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatCurrency(item?.purchase_price || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold">
                        {formatCurrency((item?.purchase_price || 0) * issuance.quantity)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* System Notice */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-semibold text-amber-900 dark:text-amber-200">System Notice</p>
                <p className="text-amber-800/80 dark:text-amber-300/80">
                  This transaction is locked in the inventory log. Stock adjustments are automatically computed based on issuance state ({issuance.status}).
                </p>
              </div>
            </div>

          </div>
        </div>

      </div>
    </ResponsiveLayout>
  )
}