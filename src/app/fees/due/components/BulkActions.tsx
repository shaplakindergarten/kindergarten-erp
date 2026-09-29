// H:\kindergarten-erp\src\app\fees\due\components\BulkActions.tsx

"use client";

import { Button } from "@/components/ui/button";
import { Send, Download, X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface BulkActionsProps {
  selectedCount: number;
  onClear: () => void;
  onBulkReminder: () => void;
  onExport: () => void;
  sendingReminders?: boolean;
}

export function BulkActions({
  selectedCount,
  onClear,
  onBulkReminder,
  onExport,
  sendingReminders = false
}: BulkActionsProps) {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 px-3 max-w-[calc(100vw-24px)]"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl rounded-full px-3 sm:px-5 py-2 sm:py-2.5 flex items-center gap-2 sm:gap-3">
            <span className="text-xs sm:text-sm font-medium whitespace-nowrap">
              <strong className="text-primary">{selectedCount}</strong>
              <span className="hidden sm:inline"> selected</span>
            </span>
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
            <Button
              size="sm"
              variant="ghost"
              onClick={onClear}
              className="gap-1 h-7 sm:h-8 px-2 sm:px-3 text-xs"
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
            <Button
              size="sm"
              onClick={onBulkReminder}
              disabled={sendingReminders}
              className="gap-1 h-7 sm:h-8 px-2 sm:px-3 text-xs bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
            >
              {sendingReminders ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">Bulk Reminder</span>
              <span className="sm:hidden">Send</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onExport}
              className="gap-1 h-7 sm:h-8 px-2 sm:px-3 text-xs border-slate-200 dark:border-slate-700"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}