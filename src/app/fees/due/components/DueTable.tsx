// H:\kindergarten-erp\src\app\fees\due\components\DueTable.tsx

"use client";

import { MoreVertical, Eye, Bell, MessageCircle, ChevronUp, ChevronDown, Users, CreditCard } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency, getDueColor, getUrgencyInfo } from "../utils/calculations";
import { DueStudent, SortField, SortOrder } from "../types";

interface DueTableProps {
  data: DueStudent[];
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  selectedIds: string[];
  isAllSelected: boolean;
  isIndeterminate: boolean;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onSendReminder: (student: DueStudent) => void;
  onViewStudent: (student: DueStudent) => void;
  onWhatsApp: (student: DueStudent) => void;
  onQuickPayment?: (student: DueStudent) => void;
}

const SortIcon = ({ field, currentField, order }: { field: SortField; currentField: SortField; order: SortOrder }) => {
  if (currentField !== field) return <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-100" />;
  return order === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
};

export function DueTable({
  data,
  sortField,
  sortOrder,
  onSort,
  selectedIds,
  isAllSelected,
  isIndeterminate,
  onToggleSelect,
  onToggleSelectAll,
  onSendReminder,
  onViewStudent,
  onWhatsApp,
  onQuickPayment,
}: DueTableProps) {
  const uniqueData = data.reduce((acc, current) => {
    const exists = acc.find(item => item.id === current.id);
    if (!exists) {
      acc.push(current);
    }
    return acc;
  }, [] as DueStudent[]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
              <TableHead className="w-10">
                <Checkbox
                  checked={isAllSelected}
                  data-state={isIndeterminate ? "indeterminate" : (isAllSelected ? "checked" : "unchecked")}
                  onCheckedChange={onToggleSelectAll}
                />
              </TableHead>
              <TableHead className="cursor-pointer group w-[180px]" onClick={() => onSort("name")}>
                <div className="flex items-center gap-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                  Student Name
                  <SortIcon field="name" currentField={sortField} order={sortOrder} />
                </div>
              </TableHead>
              <TableHead className="w-[100px] text-[10px] sm:text-xs font-bold uppercase tracking-wider hidden sm:table-cell">
                Admission No
              </TableHead>
              <TableHead className="w-[80px] text-[10px] sm:text-xs font-bold uppercase tracking-wider hidden md:table-cell">
                Roll
              </TableHead>
              <TableHead className="cursor-pointer group w-[100px]" onClick={() => onSort("class_name")}>
                <div className="flex items-center gap-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                  Class
                  <SortIcon field="class_name" currentField={sortField} order={sortOrder} />
                </div>
              </TableHead>
              <TableHead className="w-[80px] text-[10px] sm:text-xs font-bold uppercase tracking-wider hidden md:table-cell">
                Section
              </TableHead>
              <TableHead className="w-[100px] text-[10px] sm:text-xs font-bold uppercase tracking-wider hidden lg:table-cell">
                Father Name
              </TableHead>
              <TableHead className="w-[100px] text-[10px] sm:text-xs font-bold uppercase tracking-wider hidden md:table-cell">
                Mobile
              </TableHead>
              <TableHead className="w-[90px] text-[10px] sm:text-xs font-bold uppercase tracking-wider hidden lg:table-cell">
                Total Fees
              </TableHead>
              <TableHead className="w-[80px] text-[10px] sm:text-xs font-bold uppercase tracking-wider hidden lg:table-cell">
                Paid
              </TableHead>
              <TableHead className="cursor-pointer group w-[100px]" onClick={() => onSort("due_amount")}>
                <div className="flex items-center gap-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                  Due
                  <SortIcon field="due_amount" currentField={sortField} order={sortOrder} />
                </div>
              </TableHead>
              <TableHead className="cursor-pointer group w-[110px]" onClick={() => onSort("days_overdue")}>
                <div className="flex items-center gap-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                  Status
                  <SortIcon field="days_overdue" currentField={sortField} order={sortOrder} />
                </div>
              </TableHead>
              <TableHead className="text-right w-[130px] text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence>
              {uniqueData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center">
                        <Users className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-base font-medium">No due students found</p>
                      <p className="text-sm text-muted-foreground">All students have cleared their fees</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                uniqueData.map((student, index) => {
                  const urgencyInfo = getUrgencyInfo(student.days_overdue);
                  const isHighDue = student.due_amount > 500;

                  return (
                    <motion.tr
                      key={student.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.02, 0.2) }}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800 ${isHighDue ? 'bg-red-50/50 dark:bg-red-950/20' : ''}`}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.includes(student.id)}
                          onCheckedChange={() => onToggleSelect(student.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-xs sm:text-sm">
                        {student.student_name}
                        <div className="sm:hidden text-[10px] text-muted-foreground mt-0.5">
                          {student.admission_no} • {student.class_name}
                          {student.section_name ? ` (${student.section_name})` : ''}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs hidden sm:table-cell">
                        {student.admission_no}
                      </TableCell>
                      <TableCell className="font-mono text-xs hidden md:table-cell">
                        {student.class_roll || '-'}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">{student.class_name}</TableCell>
                      <TableCell className="text-xs sm:text-sm hidden md:table-cell">
                        {student.section_name || '-'}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm hidden lg:table-cell">
                        {student.father_name || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs hidden md:table-cell">
                        {student.phone || '-'}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm hidden lg:table-cell">
                        {formatCurrency(student.total_fees)}
                      </TableCell>
                      <TableCell className="text-green-600 dark:text-green-400 font-medium text-xs sm:text-sm hidden lg:table-cell">
                        {formatCurrency(student.total_paid)}
                      </TableCell>
                      <TableCell>
                        <Badge className={getDueColor(student.due_amount)}>
                          {formatCurrency(student.due_amount)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {urgencyInfo ? (
                          <Badge className={urgencyInfo.color}>
                            {urgencyInfo.label}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 border-green-200 dark:border-green-800">
                            Current
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {onQuickPayment && student.due_amount > 0 && (
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 sm:h-8 px-2 sm:px-2.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white text-[10px] sm:text-xs shadow-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onQuickPayment(student);
                              }}
                              title="Quick Payment"
                            >
                              <CreditCard className="h-3.5 w-3.5 sm:mr-1" />
                              <span className="hidden sm:inline">Pay</span>
                            </Button>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 sm:h-8 w-7 sm:w-8 p-0 text-muted-foreground hover:text-foreground"
                                title="Actions"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-lg rounded-lg min-w-[160px]"
                            >
                              <DropdownMenuItem
                                onClick={() => onSendReminder(student)}
                                className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 gap-2"
                              >
                                <Bell className="h-4 w-4 text-blue-600" />
                                <span>Send Reminder</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => onViewStudent(student)}
                                className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 gap-2"
                              >
                                <Eye className="h-4 w-4 text-purple-600" />
                                <span>View Details</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => onWhatsApp(student)}
                                className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 gap-2"
                                disabled={!student.phone}
                              >
                                <MessageCircle className="h-4 w-4 text-green-600" />
                                <span>WhatsApp</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </motion.tr>
                  );
                })
              )}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}