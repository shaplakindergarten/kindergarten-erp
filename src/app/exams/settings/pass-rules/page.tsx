'use client';

import { useState, useEffect, useCallback } from 'react';
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Loader2, 
  RefreshCw, 
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Save,
  Settings,
  Users,
  School,
  TrendingUp,
  Award,
  HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

const supabase = createClient();

interface PassRule {
  id: string;
  rule_name: string;
  rule_type: string;
  min_percentage: number;
  min_gpa: number;
  required_subjects_pass: number;
  allow_elective_fail: boolean;
  grace_mark: number;
  is_active: boolean;
}

interface PassSettings {
  overall_pass_percentage: number;
  overall_pass_gpa: number;
  minimum_subjects_pass: number;
  allow_grace_mark: boolean;
  grace_mark_value: number;
  elective_fail_allowed: boolean;
  compulsory_subject_mandatory: boolean;
}

export default function PassRulesPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PassSettings>({
    overall_pass_percentage: 33,
    overall_pass_gpa: 1.0,
    minimum_subjects_pass: 0,
    allow_grace_mark: false,
    grace_mark_value: 0,
    elective_fail_allowed: true,
    compulsory_subject_mandatory: true,
  });

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('exam_settings_new')
      .select('setting_value')
      .eq('setting_key', 'pass_rules')
      .maybeSingle();
    
    if (!error && data) {
      setSettings({
        ...settings,
        ...data.setting_value,
      });
    }
    
    setLoading(false);
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    
    const { error } = await supabase
      .from('exam_settings_new')
      .upsert({
        setting_key: 'pass_rules',
        setting_value: settings,
        description: 'Pass/Fail criteria for examination results',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'setting_key',
      });
    
    if (error) {
      console.error('Error saving pass rules:', error);
      toast.error('Failed to save pass rules');
    } else {
      toast.success('Pass rules saved successfully');
    }
    
    setSaving(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <ResponsiveLayout>
      <div className="space-y-6">
        
        {/* Header */}
        <div className="rounded-3xl bg-gradient-to-r from-green-700 via-emerald-700 to-teal-800 p-6 shadow-2xl">
          <div className="flex flex-col lg:flex-row gap-4 justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link href="/exams/dashboard">
                  <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/20 -ml-2">
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Dashboard
                  </Button>
                </Link>
              </div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <CheckCircle className="h-8 w-8" />
                Pass Rules
                <Badge className="bg-emerald-400 text-black ml-2">Settings</Badge>
              </h1>
              <p className="text-green-100 mt-2">Configure pass/fail criteria for examinations</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={saveSettings}
                disabled={saving}
                className="bg-white/20 hover:bg-white/30 text-white border-0"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Changes
              </Button>
              <Button 
                onClick={fetchSettings} 
                disabled={loading}
                variant="outline" 
                className="bg-white/20 hover:bg-white/30 text-white border-0"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Refresh
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Overall Pass Criteria */}
          <Card className="border-0 shadow-lg rounded-3xl bg-white dark:bg-gray-900">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <h2 className="text-xl font-semibold">Overall Pass Criteria</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label>Minimum Percentage for Pass</Label>
                  <Input
                    type="number"
                    step="1"
                    value={settings.overall_pass_percentage}
                    onChange={(e) => setSettings({ ...settings, overall_pass_percentage: parseFloat(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Student must achieve at least this percentage to pass
                  </p>
                </div>
                
                <div>
                  <Label>Minimum GPA for Pass</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={settings.overall_pass_gpa}
                    onChange={(e) => setSettings({ ...settings, overall_pass_gpa: parseFloat(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Student must achieve at least this GPA to pass
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Subject Pass Criteria */}
          <Card className="border-0 shadow-lg rounded-3xl bg-white dark:bg-gray-900">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <School className="h-5 w-5 text-green-600" />
                <h2 className="text-xl font-semibold">Subject Pass Criteria</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label>Minimum Subjects Required to Pass</Label>
                  <Input
                    type="number"
                    step="1"
                    value={settings.minimum_subjects_pass}
                    onChange={(e) => setSettings({ ...settings, minimum_subjects_pass: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Number of subjects student must pass (0 = no minimum)
                  </p>
                </div>
                
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={settings.elective_fail_allowed}
                    onCheckedChange={(checked) => setSettings({ ...settings, elective_fail_allowed: checked as boolean })}
                  />
                  <Label className="cursor-pointer">Allow Failure in Elective Subjects</Label>
                </div>
                
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={settings.compulsory_subject_mandatory}
                    onCheckedChange={(checked) => setSettings({ ...settings, compulsory_subject_mandatory: checked as boolean })}
                  />
                  <Label className="cursor-pointer">Mandatory Pass in All Compulsory Subjects</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Grace Mark Settings */}
        <Card className="border-0 shadow-lg rounded-3xl bg-white dark:bg-gray-900">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Award className="h-5 w-5 text-green-600" />
              <h2 className="text-xl font-semibold">Grace Mark Settings</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={settings.allow_grace_mark}
                  onCheckedChange={(checked) => setSettings({ ...settings, allow_grace_mark: checked as boolean })}
                />
                <Label className="cursor-pointer">Allow Grace Marks for Failing Students</Label>
              </div>
              
              {settings.allow_grace_mark && (
                <div className="ml-6">
                  <Label>Grace Mark Value</Label>
                  <Input
                    type="number"
                    step="1"
                    value={settings.grace_mark_value}
                    onChange={(e) => setSettings({ ...settings, grace_mark_value: parseFloat(e.target.value) || 0 })}
                    className="max-w-xs"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Additional marks added to failing students to help them pass
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="rounded-3xl border-0 shadow-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
          <CardContent className="p-6">
            <h3 className="font-semibold text-green-800 dark:text-green-300 flex items-center gap-2 mb-3">
              <HelpCircle className="h-4 w-4" />
              How Pass/Fail is Determined
            </h3>
            <div className="space-y-2 text-sm text-green-700 dark:text-green-300">
              <p>• <strong>Step 1:</strong> Check if student meets overall percentage requirement</p>
              <p>• <strong>Step 2:</strong> Check if student meets overall GPA requirement</p>
              <p>• <strong>Step 3:</strong> Check if student has passed minimum number of subjects</p>
              <p>• <strong>Step 4:</strong> Check if all compulsory subjects are passed (if required)</p>
              <p>• <strong>Step 5:</strong> Apply grace marks if enabled</p>
            </div>
            
            <div className="mt-4 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
              <p className="text-sm font-medium">Result Status Types:</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs mt-2">
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  <span><strong>Passed</strong> - Student meets all criteria</span>
                </div>
                <div className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-yellow-600" />
                  <span><strong>Passed with Elective Fail</strong> - Elective failed but allowed</span>
                </div>
                <div className="flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-red-600" />
                  <span><strong>Failed</strong> - Does not meet criteria</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  );
}
