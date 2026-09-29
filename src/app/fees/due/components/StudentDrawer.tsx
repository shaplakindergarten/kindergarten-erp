// H:\kindergarten-erp\src\app\fees\due\components\StudentDrawer.tsx

"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Bell, MessageCircle, Phone, Mail, Calendar, Clock, Wallet, CreditCard } from "lucide-react";
import { formatCurrency, getDueColor } from "../utils/calculations";
import { DueStudent } from "../types";
import { Badge } from "@/components/ui/badge";

interface StudentDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: DueStudent | null;
  advanceBalance?: number;
  onSendReminder: (student: DueStudent) => void;
  onWhatsApp: (student: DueStudent) => void;
}

export function StudentDrawer({
  open,
  onOpenChange,
  student,
  advanceBalance = 0,
  onSendReminder,
  onWhatsApp
}: StudentDrawerProps) {
  if (!student) return null;

  const hasAdvance = advanceBalance > 0;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-md max-h-[90vh] mx-auto bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 flex flex-col">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 sm:p-5 text-white shrink-0">
          <DrawerTitle className="text-white text-lg sm:text-xl flex items-center gap-2">
            <span className="truncate">{student.student_name}</span>
            {hasAdvance && (
              <Badge className="bg-yellow-400 text-yellow-900 border-0 text-[10px] sm:text-xs font-bold shrink-0">
                ⚡ Advance
              </Badge>
            )}
          </DrawerTitle>
          <DrawerDescription className="text-white/80 text-xs sm:text-sm mt-1">
            Admission: {student.admission_no} | Roll: {student.class_roll || 'N/A'}
          </DrawerDescription>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Quick Info Cards */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <p className="text-[10px] sm:text-xs text-muted-foreground">Class & Section</p>
              <p className="font-medium text-xs sm:text-sm mt-1 text-foreground">
                {student.class_name} - {student.section_name}
              </p>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <p className="text-[10px] sm:text-xs text-muted-foreground">Due Amount</p>
              <p className={`font-bold text-xs sm:text-sm mt-1 ${getDueColor(student.due_amount)}`}>
                {formatCurrency(student.due_amount)}
              </p>
            </div>
          </div>

          {/* Advance Balance Card */}
          <div className={`p-3 sm:p-4 rounded-xl border-2 ${hasAdvance ? 'border-yellow-400 bg-yellow-50/50 dark:bg-yellow-950/20' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Wallet className={`h-4 w-4 sm:h-5 sm:w-5 shrink-0 ${hasAdvance ? 'text-yellow-600' : 'text-muted-foreground'}`} />
                <span className="text-xs sm:text-sm font-medium text-foreground">Advance Balance</span>
              </div>
              <span className={`text-sm sm:text-lg font-bold whitespace-nowrap ${hasAdvance ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground'}`}>
                {hasAdvance ? formatCurrency(advanceBalance) : 'No Advance'}
              </span>
            </div>
            {hasAdvance && (
              <p className="text-[10px] sm:text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                💡 Advance payment — adjustable against future fees.
              </p>
            )}
          </div>

          {/* Contact Information */}
          <div className="space-y-3">
            <h4 className="text-xs sm:text-sm font-semibold flex items-center gap-2 text-foreground">
              <span className="w-1 h-4 bg-indigo-600 rounded-full"></span>
              Contact Information
            </h4>
            <div className="space-y-2 text-xs sm:text-sm">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1 text-foreground truncate">{student.phone || 'N/A'}</span>
                {student.phone && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[10px] sm:text-xs text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30 shrink-0"
                    onClick={() => onWhatsApp(student)}
                  >
                    <MessageCircle className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-foreground truncate">{student.email || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-foreground truncate">Father: {student.father_name || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-foreground">Days Overdue: {student.days_overdue > 0 ? `${student.days_overdue} days` : 'Current'}</span>
              </div>
            </div>
          </div>

          <Separator className="bg-slate-200 dark:bg-slate-700" />

          {/* Fee Summary */}
          <div className="space-y-3">
            <h4 className="text-xs sm:text-sm font-semibold flex items-center gap-2 text-foreground">
              <span className="w-1 h-4 bg-emerald-600 rounded-full"></span>
              Fee Summary
            </h4>
            <div className="space-y-2 text-xs sm:text-sm bg-slate-100 dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Fees:</span>
                <span className="font-medium text-foreground">{formatCurrency(student.total_fees)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Paid:</span>
                <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(student.total_paid)}</span>
              </div>
              {hasAdvance && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Advance Balance:</span>
                  <span className="font-medium text-yellow-600 dark:text-yellow-400">{formatCurrency(advanceBalance)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                <span className="text-muted-foreground">Net Due:</span>
                <span className={`font-bold ${student.due_amount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {formatCurrency(Math.max(0, student.due_amount - advanceBalance))}
                </span>
              </div>
            </div>
          </div>

          <Separator className="bg-slate-200 dark:bg-slate-700" />

          {/* Quick Actions */}
          <div className="space-y-3 shrink-0">
            <h4 className="text-xs sm:text-sm font-semibold flex items-center gap-2 text-foreground">
              <span className="w-1 h-4 bg-purple-600 rounded-full"></span>
              Quick Actions
            </h4>
            <div className="flex flex-col gap-2">
              <Button
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md"
                onClick={() => {
                  onSendReminder(student);
                  onOpenChange(false);
                }}
              >
                <Bell className="h-4 w-4 mr-2" />
                Send Reminder
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 dark:text-green-400"
                  onClick={() => onWhatsApp(student)}
                  disabled={!student.phone}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  WhatsApp
                </Button>
                {hasAdvance && (
                  <Button
                    variant="outline"
                    className="flex-1 border-yellow-500 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-950/30 dark:text-yellow-400"
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Adjust
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}