// H:\kindergarten-erp\src\app\fees\due\components\ReminderDialog.tsx

"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Send, Loader2, MessageCircle, Mail, Phone, Bell } from "lucide-react";
import { formatCurrency } from "../utils/calculations";
import { DueStudent } from "../types";

interface ReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: DueStudent | null;
  onSend: (type: string) => void;
  sending?: boolean;
}

const reminderTypes = [
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "bg-gradient-to-r from-green-600 to-emerald-600", textColor: "text-green-600" },
  { value: "sms", label: "SMS", icon: Phone, color: "bg-gradient-to-r from-blue-600 to-cyan-600", textColor: "text-blue-600" },
  { value: "email", label: "Email", icon: Mail, color: "bg-gradient-to-r from-purple-600 to-indigo-600", textColor: "text-purple-600" },
  { value: "all", label: "All", icon: Send, color: "bg-gradient-to-r from-primary to-indigo-600", textColor: "text-primary" },
];

export function ReminderDialog({ open, onOpenChange, student, onSend, sending = false }: ReminderDialogProps) {
  const [reminderType, setReminderType] = useState("all");
  const [sent, setSent] = useState(false);

  if (!student) return null;

  const handleSend = () => {
    onSend(reminderType);
    setSent(true);
    setTimeout(() => {
      setSent(false);
      onOpenChange(false);
    }, 1500);
  };

  const selectedType = reminderTypes.find(t => t.value === reminderType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <div className={`p-4 sm:p-5 shrink-0 ${selectedType?.color || 'bg-gradient-to-r from-primary to-indigo-600'} text-white`}>
          <DialogTitle className="text-white text-base sm:text-lg flex items-center gap-2">
            <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
            Send Fee Reminder
          </DialogTitle>
          <DialogDescription className="text-white/80 text-xs sm:text-sm mt-1">
            Send payment reminder to {student.student_name}'s guardian
          </DialogDescription>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          <div className="p-3 sm:p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-muted-foreground">Student:</span>
              <span className="font-medium text-foreground">{student.student_name}</span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-muted-foreground">Admission No:</span>
              <span className="font-mono text-xs text-foreground">{student.admission_no}</span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-muted-foreground">Father's Name:</span>
              <span className="text-foreground">{student.father_name || 'N/A'}</span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-muted-foreground">Mobile:</span>
              <span className="font-mono text-foreground">{student.phone || 'N/A'}</span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm pt-2 border-t border-slate-200 dark:border-slate-700">
              <span className="text-muted-foreground">Due Amount:</span>
              <span className="font-bold text-red-600 dark:text-red-400">{formatCurrency(student.due_amount)}</span>
            </div>
            {student.days_overdue > 0 && (
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-muted-foreground">Days Overdue:</span>
                <span className="text-orange-600 dark:text-orange-400 font-medium">{student.days_overdue} days</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs sm:text-sm font-medium">Select Reminder Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {reminderTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setReminderType(type.value)}
                  className={`flex items-center justify-center gap-2 p-2 rounded-lg border transition-all ${
                    reminderType === type.value
                      ? `${type.color} text-white border-transparent shadow-md`
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-foreground'
                  }`}
                >
                  <type.icon className="h-4 w-4" />
                  <span className="text-xs sm:text-sm font-medium">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {selectedType && (
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Preview ({selectedType.label}):</p>
              <p className="text-[10px] sm:text-xs text-foreground">
                Dear {student.father_name || 'Guardian'}, fee reminder for {student.student_name}.
                Due: {formatCurrency(student.due_amount)}. Please clear at earliest.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 pt-0 gap-2 shrink-0 flex-col sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending} className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending} className={`gap-2 ${selectedType?.color} text-white border-0 w-full sm:w-auto`}>
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : sent ? (
              <Bell className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {sending ? "Sending..." : sent ? "Sent!" : `Send ${selectedType?.label}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}