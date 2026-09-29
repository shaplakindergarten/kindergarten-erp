// H:\kindergarten-erp\src\app\fees\due\hooks\useDueList.ts

"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { dueService } from "../services/dueService";
import { DueStudent, DueFilters, DueStatsType, SortField, SortOrder } from "../types";
import { toast } from "sonner";

// ✅ Updated Due Level Logic (School Fee Structure: Monthly Fee = 400 Taka)
function getDueLevel(amount: number): string {
  if (amount > 800) return "critical";   // 3+ months due
  if (amount > 500) return "high";       // 2-3 months due
  if (amount > 200) return "medium";     // 1-2 months due
  if (amount > 0) return "low";          // up to 1 month due
  return "none";
}

export function useDueList() {
  const [dueList, setDueList] = useState<DueStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedSection, setSelectedSection] = useState("all");
  const [selectedDueLevel, setSelectedDueLevel] = useState<string>("all");
  const [minDueAmount, setMinDueAmount] = useState<number>(0);
  const [maxDueAmount, setMaxDueAmount] = useState<number | undefined>(undefined);
  const [activeTab, setActiveTab] = useState("all");
  const [sortField, setSortField] = useState<SortField>("due_amount");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [uniqueClasses, setUniqueClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [uniqueSections, setUniqueSections] = useState<Array<{ id: string; name: string }>>([]);
  
  // 📄 Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  
  // Refs to prevent multiple calls
  const isMounted = useRef(true);
  const isLoadingRef = useRef(false);
  const lastLoadTime = useRef<number>(0);
  
  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filters: DueFilters = useMemo(() => ({
    search: debouncedSearch || undefined,
    class_id: selectedClass !== "all" ? selectedClass : undefined,
    section_id: selectedSection !== "all" ? selectedSection : undefined,
    min_due: minDueAmount > 0 ? minDueAmount : undefined,
    max_due: maxDueAmount,
  }), [debouncedSearch, selectedClass, selectedSection, minDueAmount, maxDueAmount]);

  const loadDueList = useCallback(async (silent: boolean = false) => {
    // Prevent multiple simultaneous loads
    if (isLoadingRef.current) {
      console.log('Already loading, skipping...');
      return;
    }
    
    // Throttle: don't load more than once per 2 seconds
    const now = Date.now();
    if (now - lastLoadTime.current < 2000 && !silent) {
      console.log('Throttling: skipping load');
      return;
    }
    
    isLoadingRef.current = true;
    
    if (!silent) {
      setLoading(true);
    }
    
    try {
      console.log("Loading due list with filters:", filters);
      lastLoadTime.current = now;
      
      const data = await dueService.getDueStudents(filters);
      
      if (isMounted.current) {
        // ✅ Deduplicate data by student_id to prevent duplicate keys
        const uniqueData: DueStudent[] = [];
        const seenIds = new Set<string>();
        data.forEach((student) => {
          if (!seenIds.has(student.id)) {
            seenIds.add(student.id);
            uniqueData.push(student);
          }
        });
        
        console.log(`✅ Loaded ${uniqueData.length} unique due students`);
        console.log(`💰 Total due amount: ${uniqueData.reduce((sum, s) => sum + s.due_amount, 0)}`);
        
        setDueList(uniqueData);
        setLastSync(new Date());
        
        // Extract unique classes (UUID + name)
        const classes = [...new Map(
          uniqueData
            .filter(s => s.class_id && s.class_name)
            .map(s => [s.class_id, { id: s.class_id, name: s.class_name }])
        ).values()];
        setUniqueClasses(classes);
        
        // Extract unique sections (UUID + name)
        const sections = [...new Map(
          uniqueData
            .filter(s => s.section_id && s.section_name)
            .map(s => [s.section_id, { id: s.section_id, name: s.section_name }])
        ).values()];
        setUniqueSections(sections);
        
        if (!silent && uniqueData.length > 0) {
          console.log(`Loaded ${uniqueData.length} due students`);
        }
      }
    } catch (err) {
      console.error("Error loading due list:", err);
      if (!silent) {
        toast.error("Failed to load due list");
      }
      if (isMounted.current) {
        setDueList([]);
      }
    } finally {
      isLoadingRef.current = false;
      if (!silent) {
        setLoading(false);
      }
    }
  }, [filters]);

  // Initial load
  useEffect(() => {
    isMounted.current = true;
    loadDueList(false);
    
    return () => {
      isMounted.current = false;
    };
  }, [loadDueList]);

  // ✅ Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      console.log("🔄 Auto-refreshing due list...");
      loadDueList(true);
    }, 60000);

    return () => clearInterval(interval);
  }, [loadDueList]);

  // ✅ Updated filteredList with new due level logic
  const filteredList = useMemo(() => {
    return dueList.filter(student => {
      const matchesDueLevel = selectedDueLevel === "all" || 
        getDueLevel(student.due_amount) === selectedDueLevel;
      
      // Updated tab logic for school fee structure
      const matchesTab = activeTab === "all" || 
        (activeTab === "critical" && student.due_amount > 800) ||
        (activeTab === "high" && student.due_amount > 500 && student.due_amount <= 800) ||
        (activeTab === "medium" && student.due_amount > 200 && student.due_amount <= 500) ||
        (activeTab === "low" && student.due_amount > 0 && student.due_amount <= 200);
      
      // Min/max due amount filtering
      const matchesMinDue = minDueAmount === 0 || student.due_amount >= minDueAmount;
      const matchesMaxDue = !maxDueAmount || student.due_amount <= maxDueAmount;
      
      return matchesDueLevel && matchesTab && matchesMinDue && matchesMaxDue;
    });
  }, [dueList, selectedDueLevel, activeTab, minDueAmount, maxDueAmount]);

  const sortedList = useMemo(() => {
    return [...filteredList].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = a.student_name.localeCompare(b.student_name);
          break;
        case "due_amount":
          comparison = a.due_amount - b.due_amount;
          break;
        case "class_name":
          comparison = a.class_name.localeCompare(b.class_name);
          break;
        case "days_overdue":
          comparison = (a.days_overdue || 0) - (b.days_overdue || 0);
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [filteredList, sortField, sortOrder]);

  // 📄 Pagination computed values
  const totalPages = Math.max(1, Math.ceil(sortedList.length / pageSize));
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedList.slice(start, start + pageSize);
  }, [sortedList, currentPage, pageSize]);

  // ✅ Updated stats with correct total
  const stats: DueStatsType = useMemo(() => {
    const totalFees = filteredList.reduce((sum, s) => sum + s.total_fees, 0);
    const totalPaid = filteredList.reduce((sum, s) => sum + s.total_paid, 0);
    const totalDue = filteredList.reduce((sum, s) => sum + s.due_amount, 0);
    const totalAdvance = filteredList.reduce((sum, s) => sum + (s.advance_balance || 0), 0);
    const advanceCount = filteredList.filter(s => (s.advance_balance || 0) > 0).length;
    
    console.log('📊 Due Stats calculated:', {
      totalDue,
      totalFees,
      totalPaid,
      dueStudentsCount: filteredList.length,
      totalAdvance,
    });
    
    return {
      totalDue,
      totalFees,
      totalPaid,
      collectionRate: totalFees > 0 ? (totalPaid / totalFees) * 100 : 0,
      highDueCount: filteredList.filter(s => s.due_amount > 500 && s.due_amount <= 800).length,
      mediumDueCount: filteredList.filter(s => s.due_amount > 200 && s.due_amount <= 500).length,
      lowDueCount: filteredList.filter(s => s.due_amount > 0 && s.due_amount <= 200).length,
      criticalOverdue: filteredList.filter(s => s.due_amount > 800).length,
      due_students_count: filteredList.length,
      total_due: totalDue,
      collection_rate: totalFees > 0 ? (totalPaid / totalFees) * 100 : 0,
      advanceBalance: totalAdvance,
      advanceCount: advanceCount,
    };
  }, [filteredList]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  }, [sortField]);

  const refresh = useCallback(() => {
    loadDueList(false);
    toast.info("Refreshing due list...");
  }, [loadDueList]);

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedClass("all");
    setSelectedSection("all");
    setSelectedDueLevel("all");
    setMinDueAmount(0);
    setMaxDueAmount(undefined);
    setActiveTab("all");
  }, []);

  return {
    dueList,
    loading,
    filteredList,
    sortedList,
    // 📄 Pagination
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    paginatedList,
    uniqueClasses,
    uniqueSections,
    stats,
    lastSync,
    searchQuery,
    setSearchQuery,
    selectedClass,
    setSelectedClass,
    selectedSection,
    setSelectedSection,
    selectedDueLevel,
    setSelectedDueLevel,
    minDueAmount,
    setMinDueAmount,
    maxDueAmount,
    setMaxDueAmount,
    activeTab,
    setActiveTab,
    sortField,
    sortOrder,
    handleSort,
    refresh,
    resetFilters,
  };
}