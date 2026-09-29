// src/app/students/promotion/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Users, 
  GraduationCap, 
  ArrowDown, 
  ChevronLeft, 
  ChevronRight 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { useToastStore } from "@/store/useStore";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Student {
  id: string;
  name: string;
  father_name: string;
  class_id: string;
  class_name: string;
  section_id: string;
  section_name: string;
  class_roll: string;
  student_id: string;
}

interface Class {
  id: string;
  name: string;
  numeric_order: number;
  sections: { id: string; name: string }[];
}

export default function PromotionPage() {
  const router = useRouter();
  const addToast = useToastStore((state) => state.addToast);
  
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [targetClassId, setTargetClassId] = useState<string>("");
  const [targetSectionId, setTargetSectionId] = useState<string>("");
  const [targetSections, setTargetSections] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [actionType, setActionType] = useState<"promote" | "demote">("promote");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedClassId && selectedClassId !== "all") {
      const filtered = students.filter(s => s.class_id === selectedClassId);
      setFilteredStudents(filtered);
      setSelectedStudents([]);
    } else {
      setFilteredStudents(students);
    }
    setCurrentPage(1); // Reset to page 1 on filter change
  }, [selectedClassId, students]);

  useEffect(() => {
    if (targetClassId) {
      const cls = classes.find(c => c.id === targetClassId);
      setTargetSections(cls?.sections || []);
      setTargetSectionId("");
    }
  }, [targetClassId, classes]);

  async function loadData() {
    setLoadingData(true);
    try {
      const supabase = createClient();
      
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select(`
          id,
          name,
          father_name,
          class_id,
          section_id,
          class_roll,
          student_id,
          class:classes(id, name),
          section:sections(id, name)
        `)
        .eq('status', 'active')
        .order('name');

      if (studentsError) throw studentsError;

      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('*, sections(id, name)')
        .order('numeric_order', { ascending: true });

      if (classesError) throw classesError;

      const mappedStudents = (studentsData || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        father_name: s.father_name,
        class_id: s.class_id,
        class_name: s.class?.name || "",
        section_id: s.section_id,
        section_name: s.section?.name || "",
        class_roll: s.class_roll,
        student_id: s.student_id,
      }));

      setStudents(mappedStudents);
      setFilteredStudents(mappedStudents);
      setClasses(classesData || []);
      
    } catch (err) {
      console.error("Failed to load data:", err);
      addToast({
        type: "error",
        title: "Error",
        message: "Failed to load data",
      });
    } finally {
      setLoadingData(false);
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStudents(filteredStudents.map(s => s.id));
    } else {
      setSelectedStudents([]);
    }
  };

  const handlePromote = async () => {
    if (selectedStudents.length === 0) {
      addToast({
        type: "error",
        title: "No Selection",
        message: "Please select students to promote",
      });
      return;
    }

    if (!targetClassId) {
      addToast({
        type: "error",
        title: "No Target Class",
        message: "Please select target class",
      });
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      
      const updateData: any = {
        class_id: targetClassId,
      };
      
      if (targetSectionId && targetSectionId !== "none") {
        updateData.section_id = targetSectionId;
      }
      
      const { error } = await supabase
        .from('students')
        .update(updateData)
        .in('id', selectedStudents);

      if (error) throw error;

      addToast({
        type: "success",
        title: "Success",
        message: `${selectedStudents.length} students ${actionType}d successfully`,
      });
      
      setSelectedStudents([]);
      setSelectedClassId("");
      setTargetClassId("");
      setTargetSectionId("");
      loadData();
      
    } catch (err) {
      console.error("Failed to promote:", err);
      addToast({
        type: "error",
        title: "Error",
        message: "Failed to promote students",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDemote = async () => {
    if (selectedStudents.length === 0) {
      addToast({
        type: "error",
        title: "No Selection",
        message: "Please select students to demote",
      });
      return;
    }

    if (!targetClassId) {
      addToast({
        type: "error",
        title: "No Target Class",
        message: "Please select target class",
      });
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to demote ${selectedStudents.length} student(s) to a lower class?`);
    if (!confirmed) return;

    setLoading(true);
    try {
      const supabase = createClient();
      
      const updateData: any = {
        class_id: targetClassId,
      };
      
      if (targetSectionId && targetSectionId !== "none") {
        updateData.section_id = targetSectionId;
      }
      
      const { error } = await supabase
        .from('students')
        .update(updateData)
        .in('id', selectedStudents);

      if (error) throw error;

      addToast({
        type: "success",
        title: "Success",
        message: `${selectedStudents.length} students demoted successfully`,
      });
      
      setSelectedStudents([]);
      setSelectedClassId("");
      setTargetClassId("");
      setTargetSectionId("");
      loadData();
      
    } catch (err) {
      console.error("Failed to demote:", err);
      addToast({
        type: "error",
        title: "Error",
        message: "Failed to demote students",
      });
    } finally {
      setLoading(false);
    }
  };

  // Pagination Logic
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentStudents = filteredStudents.slice(startIndex, startIndex + itemsPerPage);

  if (loadingData) {
    return (
      <ResponsiveLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading students...</p>
          </div>
        </div>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout>
      <div className="space-y-6 p-4 max-w-7xl mx-auto">

        {/* HEADER - GRADIENT */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 rounded-lg shadow-lg p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.back()}
                className="text-white hover:bg-white/20"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-white font-heading">
                  Student Promotion / Demotion
                </h1>
                <p className="text-white/80">
                  Promote or demote students to different classes
                </p>
              </div>
            </div>
            <Badge className="bg-white/20 text-white border border-white/30">
              <GraduationCap className="h-3 w-3 mr-1" />
              Batch Action
            </Badge>
          </div>
        </div>

        {/* GRID - 3 CARDS */}
        <div className="grid gap-6 md:grid-cols-3">

          {/* CARD 1: FILTER */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-t-lg">
              <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-500" />
                Filter Students
              </CardTitle>
              <CardDescription className="text-gray-500 dark:text-gray-400">
                Select class to view students
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-gray-700 dark:text-gray-300">Current Class</Label>
                  <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                    <SelectTrigger className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600">
                      <SelectValue placeholder="All Classes" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
                      <SelectItem value="all" className="text-gray-900 dark:text-white">All Classes</SelectItem>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id} className="text-gray-900 dark:text-white">
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Total Students:</span>
                  <Badge variant="outline" className="border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/30">
                    {filteredStudents.length}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CARD 2: TARGET */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-t-lg">
              <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-green-500" />
                Target Class
              </CardTitle>
              <CardDescription className="text-gray-500 dark:text-gray-400">
                Select where to move students
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-gray-700 dark:text-gray-300">Target Class <span className="text-red-500">*</span></Label>
                  <Select value={targetClassId} onValueChange={setTargetClassId}>
                    <SelectTrigger className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600">
                      <SelectValue placeholder="Select target class" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id} className="text-gray-900 dark:text-white">
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-700 dark:text-gray-300">Target Section (Optional)</Label>
                  <Select value={targetSectionId} onValueChange={setTargetSectionId} disabled={!targetClassId}>
                    <SelectTrigger className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600">
                      <SelectValue placeholder={targetClassId ? "Select section" : "Select class first"} />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
                      <SelectItem value="none" className="text-gray-900 dark:text-white">Same Section</SelectItem>
                      {targetSections.map((sec) => (
                        <SelectItem key={sec.id} value={sec.id} className="text-gray-900 dark:text-white">
                          {sec.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CARD 3: ACTIONS */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-t-lg">
              <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                <ArrowDown className="h-5 w-5 text-amber-500" />
                Actions
              </CardTitle>
              <CardDescription className="text-gray-500 dark:text-gray-400">
                Perform promotion or demotion
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Selected:</span>
                  <Badge className={cn(
                    selectedStudents.length > 0 ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                  )}>
                    {selectedStudents.length} students
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    onClick={handlePromote} 
                    disabled={selectedStudents.length === 0 || !targetClassId || loading}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white disabled:opacity-50"
                  >
                    <GraduationCap className="h-4 w-4 mr-2" />
                    Promote
                  </Button>
                  <Button 
                    onClick={handleDemote} 
                    disabled={selectedStudents.length === 0 || !targetClassId || loading}
                    variant="outline"
                    className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                  >
                    <ArrowDown className="h-4 w-4 mr-2" />
                    Demote
                  </Button>
                </div>
                {loading && (
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-500 border-t-transparent"></div>
                    Processing...
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* STUDENT TABLE */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700/50 rounded-t-lg pb-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-500" />
                Students List
                <Badge variant="outline" className="ml-2 border-gray-300 dark:border-gray-600">
                  {filteredStudents.length}
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filteredStudents.length > 0 && selectedStudents.length === filteredStudents.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">Select All</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 p-0 sm:p-6">
            {filteredStudents.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-16 w-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                <p className="text-gray-500 dark:text-gray-400">No students found in this class</p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block border border-gray-200 dark:border-gray-700 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30">
                      <tr>
                        <th className="p-3 text-left w-12 text-gray-700 dark:text-gray-300">
                          <input
                            type="checkbox"
                            checked={filteredStudents.length > 0 && selectedStudents.length === filteredStudents.length}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                          />
                        </th>
                        <th className="p-3 text-left text-gray-700 dark:text-gray-300 font-semibold">Student ID</th>
                        <th className="p-3 text-left text-gray-700 dark:text-gray-300 font-semibold">Name</th>
                        <th className="p-3 text-left text-gray-700 dark:text-gray-300 font-semibold">Father's Name</th>
                        <th className="p-3 text-left text-gray-700 dark:text-gray-300 font-semibold">Current Class</th>
                        <th className="p-3 text-left text-gray-700 dark:text-gray-300 font-semibold">Section</th>
                        <th className="p-3 text-left text-gray-700 dark:text-gray-300 font-semibold">Roll</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentStudents.map((student) => (
                        <tr 
                          key={student.id} 
                          className={cn(
                            "border-t border-gray-100 dark:border-gray-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors",
                            selectedStudents.includes(student.id) && "bg-indigo-50/30 dark:bg-indigo-950/10"
                          )}
                        >
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={selectedStudents.includes(student.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedStudents([...selectedStudents, student.id]);
                                } else {
                                  setSelectedStudents(selectedStudents.filter(id => id !== student.id));
                                }
                              }}
                              className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="p-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                            {student.student_id || "-"}
                          </td>
                          <td className="p-3 font-medium text-gray-900 dark:text-white">
                            {student.name}
                          </td>
                          <td className="p-3 text-gray-600 dark:text-gray-400">
                            {student.father_name}
                          </td>
                          <td className="p-3">
                            <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800">
                              {student.class_name}
                            </Badge>
                          </td>
                          <td className="p-3 text-gray-600 dark:text-gray-400">
                            {student.section_name || "-"}
                          </td>
                          <td className="p-3 text-gray-600 dark:text-gray-400">
                            {student.class_roll || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3 px-3 pt-3">
                  {currentStudents.map((student) => (
                    <div 
                      key={student.id}
                      className={cn(
                        "p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800",
                        selectedStudents.includes(student.id) && "border-indigo-300 dark:border-indigo-700 bg-indigo-50/30 dark:bg-indigo-950/10"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(student.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStudents([...selectedStudents, student.id]);
                            } else {
                              setSelectedStudents(selectedStudents.filter(id => id !== student.id));
                            }
                          }}
                          className="h-4 w-4 mt-1 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">{student.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Father: {student.father_name || "-"}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">ID: {student.student_id || "-"}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 text-xs">
                              {student.class_name}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              Sec: {student.section_name || "-"}
                            </Badge>
                            {student.class_roll && (
                              <Badge variant="outline" className="text-xs">
                                Roll: {student.class_roll}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Pagination Controls */}
            {filteredStudents.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 mt-2 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-center sm:text-left">
                  Showing <span className="font-medium">{startIndex + 1}</span> to{" "}
                  <span className="font-medium">
                    {Math.min(startIndex + itemsPerPage, filteredStudents.length)}
                  </span>{" "}
                  of <span className="font-medium">{filteredStudents.length}</span> students
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="h-8 px-3 text-xs flex items-center gap-1 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                      .map((page, index, array) => {
                        const showEllipsis = index > 0 && page - array[index - 1] > 1;
                        return (
                          <div key={page} className="flex items-center">
                            {showEllipsis && <span className="px-1 text-xs text-gray-400">...</span>}
                            <Button
                              variant={currentPage === page ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(page)}
                              className={cn(
                                "h-8 w-8 text-xs p-0",
                                currentPage === page
                                  ? "bg-indigo-600 text-white"
                                  : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                              )}
                            >
                              {page}
                            </Button>
                          </div>
                        );
                      })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="h-8 px-3 text-xs flex items-center gap-1 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </ResponsiveLayout>
  );
}