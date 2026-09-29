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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Loader2, 
  RefreshCw, 
  AlertCircle,
  Trophy,
  ArrowLeft,
  Save,
  Settings,
  Users,
  School,
  TrendingUp,
  Award,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

const supabase = createClient();

interface PositionRule {
  id: string;
  rule_name: string;
  position_type: string;
  min_gpa: number;
  max_position: number;
  tie_breaker: string;
  include_absent: boolean;
  is_active: boolean;
}

interface PositionSettings {
  merit_list_min_gpa: number;
  include_absent_students: boolean;
  tie_breaker_rule: string;
  show_section_rank: boolean;
  show_class_rank: boolean;
}

export default function PositionRulesPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PositionSettings>({
    merit_list_min_gpa: 3.0,
    include_absent_students: false,
    tie_breaker_rule: 'total_marks',
    show_section_rank: true,
    show_class_rank: true,
  });

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('exam_settings_new')
      .select('setting_value')
      .eq('setting_key', 'position_rules')
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
        setting_key: 'position_rules',
        setting_value: settings,
        description: 'Position and rank calculation rules for merit list',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'setting_key',
      });
    
    if (error) {
      console.error('Error saving position rules:', error);
      toast.error('Failed to save position rules');
    } else {
      toast.success('Position rules saved successfully');
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
        <div className="rounded-3xl bg-gradient-to-r from-amber-700 via-orange-700 to-yellow-800 p-6 shadow-2xl">
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
                <Trophy className="h-8 w-8" />
                Position Rules
                <Badge className="bg-orange-400 text-black ml-2">Settings</Badge>
              </h1>
              <p className="text-amber-100 mt-2">Configure merit list position calculation rules</p>
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

        {/* Main Settings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Merit List Settings */}
          <Card className="border-0 shadow-lg rounded-3xl bg-white dark:bg-gray-900">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="h-5 w-5 text-amber-600" />
                <h2 className="text-xl font-semibold">Merit List Settings</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label>Minimum GPA for Merit List</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={settings.merit_list_min_gpa}
                    onChange={(e) => setSettings({ ...settings, merit_list_min_gpa: parseFloat(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Students with GPA below this value will not appear in merit list
                  </p>
                </div>
                
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={settings.include_absent_students}
                    onCheckedChange={(checked) => setSettings({ ...settings, include_absent_students: checked as boolean })}
                  />
                  <Label className="cursor-pointer">Include Absent Students in Merit List</Label>
                </div>
                
                <div>
                  <Label>Tie Breaker Rule</Label>
                  <Select 
                    value={settings.tie_breaker_rule} 
                    onValueChange={(v) => setSettings({ ...settings, tie_breaker_rule: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="total_marks">Higher Total Marks</SelectItem>
                      <SelectItem value="percentage">Higher Percentage</SelectItem>
                      <SelectItem value="math_marks">Higher Math Marks</SelectItem>
                      <SelectItem value="science_marks">Higher Science Marks</SelectItem>
                      <SelectItem value="english_marks">Higher English Marks</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    How to break ties when students have same GPA
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Rank Display Settings */}
          <Card className="border-0 shadow-lg rounded-3xl bg-white dark:bg-gray-900">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Award className="h-5 w-5 text-amber-600" />
                <h2 className="text-xl font-semibold">Rank Display Settings</h2>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={settings.show_class_rank}
                    onCheckedChange={(checked) => setSettings({ ...settings, show_class_rank: checked as boolean })}
                  />
                  <Label className="cursor-pointer">Show Class Rank</Label>
                </div>
                
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={settings.show_section_rank}
                    onCheckedChange={(checked) => setSettings({ ...settings, show_section_rank: checked as boolean })}
                  />
                  <Label className="cursor-pointer">Show Section Rank</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info Card */}
        <Card className="rounded-3xl border-0 shadow-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
          <CardContent className="p-6">
            <h3 className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4" />
              How Position Calculation Works
            </h3>
            <div className="space-y-2 text-sm text-amber-700 dark:text-amber-300">
              <p>• <strong>Step 1:</strong> Students are sorted by GPA in descending order</p>
              <p>• <strong>Step 2:</strong> Students with same GPA are sorted by the tie breaker rule</p>
              <p>• <strong>Step 3:</strong> Ranks are assigned sequentially (1, 2, 3, ...)</p>
              <p>• <strong>Step 4:</strong> Students with same GPA get same rank (e.g., both get 1st if tied for top)</p>
              <p>• <strong>Step 5:</strong> The next rank is skipped (e.g., if two 1st, next is 3rd)</p>
            </div>
            
            <div className="mt-4 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
              <p className="text-sm font-medium">Example:</p>
              <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                <div className="font-semibold">Student</div>
                <div className="font-semibold">GPA</div>
                <div className="font-semibold">Rank</div>
                <div>John</div>
                <div>5.00</div>
                <div>1st</div>
                <div>Jane</div>
                <div>5.00</div>
                <div>1st</div>
                <div>Bob</div>
                <div>4.80</div>
                <div>3rd</div>
                <div>Alice</div>
                <div>4.70</div>
                <div>4th</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  );
}
