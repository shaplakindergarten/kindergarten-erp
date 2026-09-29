// H:\kindergarten-erp\src\app\fees\due\components\FiltersBar.tsx

"use client";

import { useState } from "react";
import { Search, X, Filter, ChevronDown, User, Hash, BookOpen, Users, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface FiltersBarProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  selectedClass: string;
  setSelectedClass: (value: string) => void;
  selectedSection: string;
  setSelectedSection: (value: string) => void;
  selectedDueLevel: string;
  setSelectedDueLevel: (value: string) => void;
  uniqueClasses: Array<{ id: string; name: string }>;
  uniqueSections: Array<{ id: string; name: string }>;
  totalResults: number;
  onReset: () => void;
  minDueAmount?: number;
  maxDueAmount?: number;
  setMinDueAmount?: (value: number) => void;
  setMaxDueAmount?: (value: number | undefined) => void;
}

const searchTypes = [
  { value: "name", label: "Student Name", icon: User, placeholder: "Search by student name..." },
  { value: "admission", label: "Admission No", icon: Hash, placeholder: "Search by admission number..." },
  { value: "roll", label: "Roll No", icon: BookOpen, placeholder: "Search by roll number..." },
  { value: "father", label: "Father Name", icon: Users, placeholder: "Search by father name..." },
  { value: "phone", label: "Mobile", icon: Phone, placeholder: "Search by mobile number..." },
];

export function FiltersBar({
  searchQuery,
  setSearchQuery,
  selectedClass,
  setSelectedClass,
  selectedSection,
  setSelectedSection,
  selectedDueLevel,
  setSelectedDueLevel,
  uniqueClasses = [],
  uniqueSections = [],
  totalResults,
  onReset,
  minDueAmount = 0,
  maxDueAmount,
  setMinDueAmount,
  setMaxDueAmount,
}: FiltersBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searchType, setSearchType] = useState("name");

  const hasActiveFilters = searchQuery || selectedClass !== "all" || selectedSection !== "all" || selectedDueLevel !== "all";

  const getPlaceholder = () => {
    const type = searchTypes.find(t => t.value === searchType);
    return type?.placeholder || "Search...";
  };

  const safeUniqueClasses = Array.isArray(uniqueClasses) ? uniqueClasses : [];
  const safeUniqueSections = Array.isArray(uniqueSections) ? uniqueSections : [];

  return (
    <div className="space-y-3 sm:space-y-4 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
      
      {/* Row 1: Search, Class, Section, Levels */}
      <div className="flex flex-col sm:flex-row flex-wrap md:flex-nowrap gap-2 sm:gap-3 items-stretch sm:items-center">
        
        {/* Search Input */}
        <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={getPlaceholder()}
            className="pl-9 pr-9 h-10 sm:h-11 text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus-visible:ring-primary"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        {/* Class Select */}
        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger className="w-full sm:w-[150px] md:w-[180px] h-10 sm:h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
            <SelectValue placeholder="All Classes" />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-lg">
            <SelectItem value="all">All Classes</SelectItem>
            {safeUniqueClasses.map(cls => (
              <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Section Select */}
        <Select value={selectedSection} onValueChange={setSelectedSection}>
          <SelectTrigger className="w-full sm:w-[150px] md:w-[180px] h-10 sm:h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
            <SelectValue placeholder="All Sections" />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-lg">
            <SelectItem value="all">All Sections</SelectItem>
            {safeUniqueSections.map(sec => (
              <SelectItem key={sec.id} value={sec.id}>{sec.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Due Level Select */}
        <Select value={selectedDueLevel} onValueChange={setSelectedDueLevel}>
          <SelectTrigger className="w-full sm:w-[160px] md:w-[200px] h-10 sm:h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
            <SelectValue placeholder="All Levels" />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-lg">
            <SelectItem value="all">📊 All Levels</SelectItem>
            <SelectItem value="critical">🔴 Critical (&gt;৳800)</SelectItem>
            <SelectItem value="high">🟠 High (৳501-800)</SelectItem>
            <SelectItem value="medium">🟡 Medium (৳201-500)</SelectItem>
            <SelectItem value="low">🟢 Low (৳1-200)</SelectItem>
          </SelectContent>
        </Select>

        {/* Advanced Toggle + Reset — side by side on mobile */}
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant={showAdvanced ? "default" : "outline"}
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="gap-2 h-10 sm:h-11 px-3 sm:px-4 flex-1 sm:flex-initial shrink-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Advanced</span>
            <ChevronDown className={cn("h-3 w-3 transition-transform", showAdvanced && "rotate-180")} />
          </Button>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              onClick={onReset}
              className="gap-1 h-10 sm:h-11 px-3 sm:px-4 shrink-0 text-destructive hover:bg-destructive/10"
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
          )}
        </div>
      </div>

      {/* Row 2: Advanced Filters Panel */}
      {showAdvanced && (
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 mt-2 animate-in fade-in slide-in-from-top-2">
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <label className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Search By
              </label>
              <Select value={searchType} onValueChange={setSearchType}>
                <SelectTrigger className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-lg">
                  {searchTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-3.5 w-3.5" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2 md:col-span-1">
              <label className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Search Value
              </label>
              <div className="relative">
                {searchTypes.find(t => t.value === searchType)?.icon && (
                  <div className="absolute left-3 top-1/2 -translate-y-1/2">
                    {(() => {
                      const Icon = searchTypes.find(t => t.value === searchType)?.icon;
                      return Icon ? <Icon className="h-4 w-4 text-muted-foreground" /> : null;
                    })()}
                  </div>
                )}
                <Input
                  placeholder={getPlaceholder()}
                  className="pl-9 h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Min Amount (৳)
              </label>
              <Input
                type="number"
                placeholder="0"
                className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                value={minDueAmount || ''}
                onChange={(e) => setMinDueAmount?.(parseInt(e.target.value) || 0)}
              />
            </div>

            <div>
              <label className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Max Amount (৳)
              </label>
              <Input
                type="number"
                placeholder="Any"
                className="h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                value={maxDueAmount || ''}
                onChange={(e) => setMaxDueAmount?.(parseInt(e.target.value) || undefined)}
              />
            </div>
          </div>

          <div className="flex justify-end mt-3 sm:mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
            <Button className="h-10 px-4 sm:px-6 gap-2 shadow-sm bg-primary hover:bg-primary/90">
              <Filter className="h-4 w-4" />
              Apply Filters
            </Button>
          </div>
        </div>
      )}

      {/* Results Count */}
      <div className="flex items-center justify-between pt-1">
        <div className="text-xs sm:text-sm text-muted-foreground">
          Found <span className="font-bold text-foreground">{totalResults}</span> student{totalResults !== 1 ? 's' : ''} with due fees
        </div>
      </div>
    </div>
  );
}