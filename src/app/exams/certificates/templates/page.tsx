'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Award,
  AlertCircle,
  ArrowLeft,
  Eye,
  Printer,
  Sparkles,
  Code2,
  CheckCircle2,
  XCircle,
  Maximize2,
  FileText,
  Building2,
  School,
  LayoutTemplate,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import Image from 'next/image';

const supabase = createClient();

// ============================================
// TYPES
// ============================================
interface SignatureSettings {
  principal_signature: boolean;
  teacher_signature: boolean;
  date: boolean;
  seal: boolean;
}

interface CertificateTemplate {
  id: string;
  name: string;
  template_type: string;
  header_html: string;
  body_html: string;
  footer_html: string;
  signature_settings: SignatureSettings;
  is_active: boolean;
  created_at: string;
}

interface SchoolSettings {
  name: string;
  address: string;
  email: string;
  phone: string;
  logo_url: string;
}

const TEMPLATE_TYPES = [
  { value: 'testimonial', label: 'Testimonial', icon: '📜', color: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  { value: 'transfer_certificate', label: 'Transfer Certificate', icon: '📄', color: 'from-slate-500 to-gray-600', bg: 'bg-slate-50 dark:bg-slate-800/30' },
  { value: 'certificate', label: 'Certificate', icon: '🏅', color: 'from-amber-500 to-orange-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
];

// Default Templates with exact text from images
const DEFAULT_TEMPLATES = {
  testimonial: {
    header: `<div style="text-align: center; padding: 20px 20px 15px 20px; border-bottom: 2px solid #1e293b;">
  <div style="display: flex; justify-content: center; align-items: center; gap: 15px; margin-bottom: 8px;">
    <div style="width: 60px; height: 60px; border-radius: 50%; border: 3px solid #1e3a8a; background: linear-gradient(135deg, #eff6ff, #dbeafe); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
      <span style="font-size: 28px; font-weight: 900; color: #1e3a8a;">🏫</span>
    </div>
    <div style="text-align: center;">
      <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; letter-spacing: 1px; font-family: 'Times New Roman', serif; text-transform: uppercase;">{{school_name}}</h1>
      <p style="font-size: 13px; color: #475569; margin: 2px 0; font-family: 'Times New Roman', serif;">{{school_address}}</p>
      <p style="font-size: 12px; color: #64748b; margin: 0; font-family: 'Times New Roman', serif;">📧 {{school_email}} | 📞 {{school_phone}}</p>
    </div>
  </div>
  <div style="display: inline-block; background: #1e3a8a; color: #ffffff; padding: 4px 35px; font-size: 18px; font-weight: 700; border-radius: 2px; font-family: 'Times New Roman', serif; letter-spacing: 3px; margin-top: 6px;">
    Testimonial
  </div>
</div>`,
    body: `<div style="font-family: 'Times New Roman', serif; padding: 25px 20px; line-height: 2.2; color: #1e293b;">
  <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 15px; padding: 10px 15px; background: #f8fafc; border-radius: 4px; border-left: 3px solid #1e3a8a;">
    <span><strong>Serial No.</strong> {{serial_no}}</span>
    <span><strong>Date :</strong> {{date}}</span>
  </div>

  <p style="text-indent: 40px; font-size: 15px; margin: 8px 0; text-align: justify;">
    It is hereby certified that <strong style="font-size: 17px; color: #1e3a8a;">{{student_name}}</strong>,
    was a student of Class <strong>{{class_name}}</strong> of this institution. 
    In the year <strong>{{exam_year}}</strong>, he appeared in the examination from this institution
    and passed with distinction, obtaining Letter Grade <strong>{{grade}}</strong> and GPA <strong>{{gpa}}</strong>. 
    His Roll Number is <strong>{{roll_no}}</strong> and his date of birth is <strong>{{dob}}</strong>.
  </p>

  <p style="text-indent: 40px; font-size: 15px; margin: 8px 0; text-align: justify;">
    He is a Bangladeshi by birth. To the best of my knowledge, he has not been
    involved in any anti-state activities.
  </p>

  <p style="text-indent: 40px; font-size: 15px; margin: 8px 0; text-align: justify;">
    I wish him a bright future and all-round well-being, as he possesses moral
    character.
  </p>
</div>`,
    footer: `<div style="margin-top: 20px; padding-top: 15px; border-top: 2px dashed #cbd5e1; display: flex; justify-content: flex-end; padding-right: 20px;">
  <div style="text-align: center; min-width: 200px;">
    <div style="border-bottom: 2px solid #1e293b; width: 180px; margin: 0 auto 6px auto; height: 35px;"></div>
    <p style="font-size: 13px; font-weight: 600; color: #0f172a; margin: 0;">Headmaster's (In Charge) Signature</p>
  </div>
</div>`,
  },
  transfer_certificate: {
    header: `<div style="text-align: center; padding: 20px 20px 15px 20px; border-bottom: 2px solid #1e293b;">
  <div style="display: flex; justify-content: center; align-items: center; gap: 15px; margin-bottom: 8px;">
    <div style="width: 60px; height: 60px; border-radius: 50%; border: 3px solid #0f172a; background: linear-gradient(135deg, #f8fafc, #e2e8f0); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
      <span style="font-size: 28px; font-weight: 900; color: #0f172a;">📋</span>
    </div>
    <div style="text-align: center;">
      <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; letter-spacing: 1px; font-family: 'Times New Roman', serif; text-transform: uppercase;">{{school_name}}</h1>
      <p style="font-size: 13px; color: #475569; margin: 2px 0; font-family: 'Times New Roman', serif;">{{school_address}}</p>
      <p style="font-size: 12px; color: #64748b; margin: 0; font-family: 'Times New Roman', serif;">📧 {{school_email}} | 📞 {{school_phone}}</p>
    </div>
  </div>
  <div style="display: inline-block; background: #0f172a; color: #ffffff; padding: 4px 35px; font-size: 18px; font-weight: 700; border-radius: 2px; font-family: 'Times New Roman', serif; letter-spacing: 3px; margin-top: 6px;">
    Transfer Certificate
  </div>
</div>`,
    body: `<div style="font-family: 'Times New Roman', serif; padding: 25px 20px; line-height: 2.2; color: #1e293b;">
  <p style="text-indent: 40px; font-size: 15px; margin: 8px 0; text-align: justify;">
    It is hereby certified that <strong style="font-size: 17px; color: #1e3a8a;">{{student_name}}</strong>, 
    ID No. <strong>{{student_id}}</strong>, son of <strong>{{father_name}}</strong> and <strong>{{mother_name}}</strong>, 
    resident of <strong>{{address}}</strong>, was a student of Class <strong>{{class_name}}</strong> in this institution. 
    According to the admission register, his date of birth is <strong>{{dob}}</strong>. 
    He has cleared all dues and left the institution after completing his studies.
  </p>

  <p style="text-indent: 40px; font-size: 15px; margin: 8px 0; text-align: justify;">
    He is a Bangladeshi by birth. To the best of my knowledge, he has not been
    involved in any anti-state activities.
  </p>

  <p style="text-indent: 40px; font-size: 15px; margin: 8px 0; text-align: justify;">
    I wish him a bright future and all-round well-being, as he possesses moral
    character.
  </p>
</div>`,
    footer: `<div style="margin-top: 20px; padding-top: 15px; border-top: 2px dashed #cbd5e1; display: flex; justify-content: flex-end; padding-right: 20px;">
  <div style="text-align: center; min-width: 200px;">
    <div style="border-bottom: 2px solid #1e293b; width: 180px; margin: 0 auto 6px auto; height: 35px;"></div>
    <p style="font-size: 13px; font-weight: 600; color: #0f172a; margin: 0;">Headmaster's (In Charge) Signature</p>
  </div>
</div>`,
  },
  certificate: {
    header: `<div style="text-align: center; padding: 20px 20px 15px 20px; border-bottom: 2px solid #1e293b;">
  <div style="display: flex; justify-content: center; align-items: center; gap: 15px; margin-bottom: 8px;">
    <div style="width: 60px; height: 60px; border-radius: 50%; border: 3px solid #b8860b; background: linear-gradient(135deg, #fefce8, #fef3c7); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
      <span style="font-size: 28px; font-weight: 900; color: #b8860b;">🎓</span>
    </div>
    <div style="text-align: center;">
      <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; letter-spacing: 1px; font-family: 'Times New Roman', serif; text-transform: uppercase;">{{school_name}}</h1>
      <p style="font-size: 13px; color: #475569; margin: 2px 0; font-family: 'Times New Roman', serif;">{{school_address}}</p>
      <p style="font-size: 12px; color: #64748b; margin: 0; font-family: 'Times New Roman', serif;">📧 {{school_email}} | 📞 {{school_phone}}</p>
    </div>
  </div>
  <div style="display: inline-block; background: #b8860b; color: #ffffff; padding: 4px 35px; font-size: 18px; font-weight: 700; border-radius: 2px; font-family: 'Times New Roman', serif; letter-spacing: 3px; margin-top: 6px;">
    Certificate
  </div>
  <p style="font-size: 14px; font-weight: 600; color: #1e293b; margin: 6px 0 0 0; font-family: 'Times New Roman', serif;">Examination - {{exam_year}}</p>
</div>`,
    body: `<div style="font-family: 'Times New Roman', serif; padding: 25px 20px; line-height: 2.2; color: #1e293b;">
  <p style="text-indent: 40px; font-size: 15px; margin: 8px 0; text-align: justify;">
    This is certified that <strong style="font-size: 17px; color: #1e3a8a;">{{student_name}}</strong> 
    class <strong>{{class_name}}</strong> section <strong>{{section_name}}</strong>. 
    Roll no <strong>{{roll_no}}</strong>. Date of birth <strong>{{dob}}</strong>, 
    Gender <strong>{{gender}}</strong>, Religion <strong>{{religion}}</strong>, 
    Blood Group <strong>{{blood_group}}</strong>. Registration no <strong>{{reg_no}}</strong>. 
    Son/Daughter of <strong>{{father_name}}</strong>. Address <strong>{{address}}</strong>.
  </p>

  <p style="text-indent: 40px; font-size: 15px; margin: 8px 0; text-align: justify;">
    He/She is successfully completed the examination of <strong>{{passed_class}}</strong>.
  </p>
</div>`,
    footer: `<div style="margin-top: 20px; padding-top: 15px; border-top: 2px dashed #cbd5e1; display: flex; justify-content: space-around; align-items: flex-end; gap: 10px; flex-wrap: wrap;">
  <div style="text-align: center; min-width: 120px;">
    <div style="border-bottom: 2px solid #1e293b; width: 140px; margin: 0 auto 6px auto; height: 35px;"></div>
    <p style="font-size: 12px; font-weight: 600; color: #0f172a; margin: 0;">Anamul Haque</p>
    <p style="font-size: 10px; color: #64748b; margin: 0;">Signature</p>
  </div>
  <div style="text-align: center; min-width: 120px;">
    <div style="border-bottom: 2px solid #1e293b; width: 140px; margin: 0 auto 6px auto; height: 35px;"></div>
    <p style="font-size: 12px; font-weight: 600; color: #0f172a; margin: 0;">Md. Sharif Uddin</p>
    <p style="font-size: 10px; color: #64748b; margin: 0;">Signature</p>
  </div>
  <div style="text-align: center; min-width: 120px;">
    <div style="border-bottom: 2px solid #1e293b; width: 140px; margin: 0 auto 6px auto; height: 35px;"></div>
    <p style="font-size: 12px; font-weight: 600; color: #0f172a; margin: 0;">A. B. M. Younus Khan</p>
    <p style="font-size: 10px; color: #64748b; margin: 0;">Signature</p>
  </div>
</div>`,
  },
};

// Helper function to get default template
const getDefaultTemplate = (type: string) => {
  return DEFAULT_TEMPLATES[type as keyof typeof DEFAULT_TEMPLATES] || DEFAULT_TEMPLATES.testimonial;
};

export default function CertificateTemplatesPage() {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [open, setOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CertificateTemplate | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>({
    name: 'Shapla Kindergarten & Pre-Cadet',
    address: 'Station Road, Tongi, Gazipur, Dhaka',
    email: 'shaplakindergarten@gmail.com',
    phone: '+880 1923-253454',
    logo_url: ''
  });

  const [formData, setFormData] = useState({
    name: '',
    template_type: 'testimonial' as string,
    header_html: '',
    body_html: '',
    footer_html: '',
    signature_settings: {
      principal_signature: true,
      teacher_signature: true,
      date: true,
      seal: true,
    },
    is_active: true,
  });

  // --- Data Fetching ---
  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('certificate_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error('Error fetching templates:', err);
      toast.error('Failed to load certificate templates');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSchoolSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('school_settings')
        .select('school_name, school_address, school_email, school_phone, school_logo')
        .limit(1)
        .maybeSingle();
      
      if (!error && data) {
        setSchoolSettings({
          name: data.school_name || 'Shapla Kindergarten & Pre-Cadet',
          address: data.school_address || 'Station Road, Tongi, Gazipur, Dhaka',
          email: data.school_email || 'shaplakindergarten@gmail.com',
          phone: data.school_phone || '+880 1923-253454',
          logo_url: data.school_logo || ''
        });
      }
    } catch (err) {
      console.error('Error fetching school settings:', err);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
    fetchSchoolSettings();
  }, [fetchTemplates, fetchSchoolSettings]);

  // --- Form Handling ---
  const resetForm = () => {
    setEditingTemplate(null);
    const defaultTemplate = getDefaultTemplate('testimonial');
    setFormData({
      name: '',
      template_type: 'testimonial',
      header_html: defaultTemplate.header,
      body_html: defaultTemplate.body,
      footer_html: defaultTemplate.footer,
      signature_settings: {
        principal_signature: true,
        teacher_signature: true,
        date: true,
        seal: true,
      },
      is_active: true,
    });
  };

  const loadDefaultTemplate = (type: string) => {
    const defaultTemplate = getDefaultTemplate(type);
    setFormData((prev) => ({
      ...prev,
      header_html: defaultTemplate.header,
      body_html: defaultTemplate.body,
      footer_html: defaultTemplate.footer,
    }));
  };

  const handleSave = async () => {
    if (!formData.name || !formData.template_type) {
      toast.error('Please enter template name and select type');
      return;
    }

    setLoading(true);

    try {
      const templateData = {
        name: formData.name,
        template_type: formData.template_type,
        header_html: formData.header_html,
        body_html: formData.body_html,
        footer_html: formData.footer_html,
        signature_settings: formData.signature_settings,
        is_active: formData.is_active,
      };

      let result;
      if (editingTemplate) {
        result = await supabase
          .from('certificate_templates')
          .update(templateData)
          .eq('id', editingTemplate.id);
      } else {
        result = await supabase
          .from('certificate_templates')
          .insert([templateData]);
      }

      if (result.error) throw result.error;

      toast.success(editingTemplate ? 'Template updated successfully' : 'Template created successfully');
      setOpen(false);
      resetForm();
      fetchTemplates();
    } catch (err) {
      console.error('Error saving template:', err);
      toast.error('Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    setLoading(true);
    const { error } = await supabase.from('certificate_templates').delete().eq('id', id);

    if (error) {
      toast.error('Failed to delete template');
    } else {
      toast.success('Template deleted');
      fetchTemplates();
    }
    setLoading(false);
  };

  const handleEdit = (template: CertificateTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      template_type: template.template_type,
      header_html: template.header_html || '',
      body_html: template.body_html || '',
      footer_html: template.footer_html || '',
      signature_settings: template.signature_settings || {
        principal_signature: true,
        teacher_signature: true,
        date: true,
        seal: true,
      },
      is_active: template.is_active,
    });
    setOpen(true);
  };

  // --- Preview Generation ---
  const renderCertificateHtml = useCallback((template: Partial<CertificateTemplate>) => {
    const previewData = {
      serial_no: '2540029783',
      student_name: 'MD TANVIR KHAN',
      father_name: 'Md. Yousuf Alam',
      mother_name: 'Mrs. Shahina Alam',
      class_name: 'Six',
      passed_class: 'Six',
      section_name: 'A',
      exam_name: 'Annual Examination 2025',
      exam_year: '2025',
      roll_no: '01',
      reg_no: '2025-001-2345',
      dob: '18 May 2015',
      gender: 'Male',
      religion: 'Islam',
      blood_group: 'O+',
      address: 'Station Road, Tongi, Gazipur',
      position: '1',
      position_suffix: 'st',
      gpa: '5.00',
      grade: 'A+',
      date: '20 December 2025',
      school_name: schoolSettings.name,
      school_address: schoolSettings.address,
      school_email: schoolSettings.email,
      school_phone: schoolSettings.phone,
      student_id: '2540029783',
    };

    let borderStyleCss = `
      border: 3px solid #1e3a8a;
      outline: 6px solid #fbbf24;
      outline-offset: -12px;
      padding: 35px 45px;
      border-radius: 4px;
      background: #ffffff;
    `;

    if (template.template_type === 'certificate') {
      borderStyleCss = `
        border: 20px solid #b8860b;
        border-image: repeating-linear-gradient(45deg, #b8860b, #b8860b 10px, #d4af37 10px, #d4af37 20px, #b8860b 20px) 30;
        padding: 30px 35px;
        background: #faf9f6;
        border-radius: 8px;
      `;
    } else if (template.template_type === 'transfer_certificate') {
      borderStyleCss = `
        border: 2px solid #0f172a;
        padding: 35px 40px;
        background: #ffffff;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.05);
      `;
    }

    // Add logo to header if available
    let headerHtml = template.header_html || '';
    if (schoolSettings.logo_url) {
      // Replace the emoji with actual logo
      headerHtml = headerHtml.replace(
        /<span style="font-size: 28px; font-weight: 900; color: #[a-fA-F0-9]+;">[^<]*<\/span>/,
        `<img src="${schoolSettings.logo_url}" alt="School Logo" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 3px solid #1e3a8a;" />`
      );
    }

    let html = `
      <div id="print-certificate-area" style="
        font-family: 'Times New Roman', Georgia, serif;
        background: #ffffff;
        box-sizing: border-box;
        position: relative;
        width: 100%;
        min-height: 580px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        ${borderStyleCss}
      ">
        <div>
          ${headerHtml}
          ${template.body_html || ''}
        </div>
        <div>
          ${template.footer_html || ''}
        </div>
      </div>
    `;

    Object.entries(previewData).forEach(([key, value]) => {
      html = html.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    });

    return html;
  }, [schoolSettings]);

  const handlePreview = (template: CertificateTemplate) => {
    setPreviewHtml(renderCertificateHtml(template));
    setPreviewOpen(true);
  };

  const getTemplateTypeBadge = (type: string) => {
    const t = TEMPLATE_TYPES.find((item) => item.value === type);
    return (
      <Badge variant="outline" className={`bg-gradient-to-r ${t?.color || 'from-gray-500 to-gray-600'} text-white border-0 px-3 py-1 text-xs font-semibold rounded-full shadow-sm`}>
        <span className="mr-1.5">{t?.icon || '📜'}</span>
        <span>{t?.label || type}</span>
      </Badge>
    );
  };

  const currentFormPreviewHtml = useMemo(() => {
    return renderCertificateHtml(formData);
  }, [formData, renderCertificateHtml]);

  return (
    <ResponsiveLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-10 px-3 sm:px-4 lg:px-6">
        {/* Header Section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 p-6 sm:p-8 shadow-2xl">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500 rounded-full blur-3xl translate-x-20 -translate-y-20"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500 rounded-full blur-3xl -translate-x-20 translate-y-20"></div>
          </div>
          <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <Link href="/exams/dashboard">
                  <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10 -ml-2">
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Dashboard
                  </Button>
                </Link>
                <Link href="/exams/settings/print">
                  <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10">
                    <Printer className="h-4 w-4 mr-1" />
                    Print Settings
                  </Button>
                </Link>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-3 text-white">
                <LayoutTemplate className="h-8 w-8 text-amber-400" />
                Certificate Templates
              </h1>
              <p className="text-indigo-200 text-sm mt-1">Manage Testimonial, Transfer Certificate & Certificate templates</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Button
                onClick={() => {
                  resetForm();
                  setOpen(true);
                }}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold border-0 shadow-lg shadow-amber-500/25 w-full sm:w-auto"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Template
              </Button>
              <Button
                onClick={fetchTemplates}
                disabled={loading}
                variant="outline"
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 w-full sm:w-auto"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Templates Table */}
        <Card className="border-0 shadow-xl rounded-2xl overflow-hidden bg-white dark:bg-gray-900">
          {loading && templates.length === 0 ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
            </div>
          ) : templates.length === 0 ? (
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/40 dark:to-amber-800/40 flex items-center justify-center mb-4 text-amber-500">
                <Award className="h-12 w-12" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Templates Found</h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-sm text-sm mb-6">
                Create Testimonial, Transfer Certificate, or Certificate templates for your institution.
              </p>
              <Button onClick={() => { resetForm(); setOpen(true); }} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25">
                <Plus className="mr-2 h-4 w-4" />
                Create Template
              </Button>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/60 dark:to-gray-800/40">
                  <TableRow>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300">Template Name</TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300 hidden md:table-cell">Type</TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300 hidden sm:table-cell">Status</TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300 hidden lg:table-cell">Created</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors group">
                      <TableCell className="font-semibold text-gray-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{TEMPLATE_TYPES.find(t => t.value === template.template_type)?.icon || '📄'}</span>
                          {template.name}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{getTemplateTypeBadge(template.template_type)}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {template.is_active ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-full">
                            <XCircle className="w-3.5 h-3.5" /> Inactive
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-gray-500 dark:text-gray-400 text-sm">
                        {new Date(template.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </TableCell>
                      <TableCell className="text-right space-x-1 whitespace-nowrap">
                        <Button variant="ghost" size="icon" title="Preview" onClick={() => handlePreview(template)} className="hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 dark:hover:text-indigo-400">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Edit" onClick={() => handleEdit(template)} className="hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950 dark:hover:text-amber-400">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Delete" onClick={() => handleDelete(template.id)} className="hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950 dark:hover:text-rose-400">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        {/* CREATE / EDIT DIALOG */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-6xl max-h-[92vh] h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-white dark:bg-gray-900 border-0 rounded-2xl shadow-2xl w-[95vw] sm:w-full">
            <DialogHeader className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex-shrink-0">
              <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2 text-indigo-950 dark:text-indigo-300">
                <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                {editingTemplate ? 'Edit Template' : 'Create New Template'}
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
              {/* Form Settings Left */}
              <div className="lg:col-span-5 p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 border-r border-gray-100 dark:border-gray-800">
                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="grid grid-cols-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-4">
                    <TabsTrigger value="basic" className="text-xs font-medium">Basic Info</TabsTrigger>
                    <TabsTrigger value="content" className="text-xs font-medium">HTML Content</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic" className="space-y-4">
                    <div>
                      <Label className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">Template Name *</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Shapla Testimonial Format"
                        className="mt-1 dark:bg-gray-800 dark:border-gray-700"
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">Template Type *</Label>
                      <Select
                        value={formData.template_type}
                        onValueChange={(v) => {
                          setFormData({ ...formData, template_type: v });
                          loadDefaultTemplate(v);
                          // Auto-set name based on type
                          const typeNames: Record<string, string> = {
                            testimonial: 'Testimonial',
                            transfer_certificate: 'Transfer Certificate',
                            certificate: 'Certificate'
                          };
                          if (!editingTemplate) {
                            setFormData(prev => ({
                              ...prev,
                              name: `${schoolSettings.name} - ${typeNames[v] || v}`
                            }));
                          }
                        }}
                      >
                        <SelectTrigger className="mt-1 dark:bg-gray-800 dark:border-gray-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TEMPLATE_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              <span className="mr-2">{type.icon}</span>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                      <div>
                        <Label className="font-semibold text-sm dark:text-gray-200">Status Active</Label>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Enable this template for printing</p>
                      </div>
                      <Switch
                        checked={formData.is_active}
                        onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                      />
                    </div>

                    <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800">
                      <p className="text-xs text-blue-600 dark:text-blue-400 flex items-start gap-1.5">
                        <span className="text-base">💡</span>
                        <span>Use <code className="bg-blue-100 dark:bg-blue-900/50 px-1.5 py-0.5 rounded text-[10px] font-mono">&#123;&#123;variable&#125;&#125;</code> for dynamic content like <code className="bg-blue-100 dark:bg-blue-900/50 px-1.5 py-0.5 rounded text-[10px] font-mono">&#123;&#123;student_name&#125;&#125;</code></span>
                      </p>
                    </div>

                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
                      <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                        <span className="text-base">📋</span>
                        <span>This template supports: <strong>Testimonial</strong>, <strong>Transfer Certificate</strong>, and <strong>Certificate</strong> formats with full school branding.</span>
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="content" className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <Label className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">Header HTML</Label>
                        <Code2 className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                      </div>
                      <Textarea
                        value={formData.header_html}
                        onChange={(e) => setFormData({ ...formData, header_html: e.target.value })}
                        rows={3}
                        className="font-mono text-xs bg-slate-900 text-emerald-400 rounded-xl resize-none dark:bg-slate-950"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <Label className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">Body HTML *</Label>
                        <Code2 className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                      </div>
                      <Textarea
                        value={formData.body_html}
                        onChange={(e) => setFormData({ ...formData, body_html: e.target.value })}
                        rows={5}
                        className="font-mono text-xs bg-slate-900 text-emerald-400 rounded-xl resize-none dark:bg-slate-950"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <Label className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">Footer HTML</Label>
                        <Code2 className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                      </div>
                      <Textarea
                        value={formData.footer_html}
                        onChange={(e) => setFormData({ ...formData, footer_html: e.target.value })}
                        rows={3}
                        className="font-mono text-xs bg-slate-900 text-emerald-400 rounded-xl resize-none dark:bg-slate-950"
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>

              {/* Live Preview Right Column */}
              <div className="lg:col-span-7 p-4 sm:p-6 bg-slate-100 dark:bg-slate-950 overflow-y-auto flex flex-col">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" /> Live Preview
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-white dark:bg-gray-800 text-slate-700 dark:text-slate-300">Auto Refresh</Badge>
                </div>
                <div className="flex-1 bg-white dark:bg-gray-900 rounded-xl shadow-inner p-3 sm:p-4 overflow-y-auto min-h-[400px] border border-gray-200 dark:border-gray-800">
                  <div className="scale-[0.7] sm:scale-75 md:scale-90 lg:scale-100 origin-top" dangerouslySetInnerHTML={{ __html: currentFormPreviewHtml }} />
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-3 sm:p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex flex-col sm:flex-row justify-end gap-2 flex-shrink-0">
              <Button variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto order-2 sm:order-1 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={loading} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold shadow-lg shadow-indigo-500/25 w-full sm:w-auto order-1 sm:order-2">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingTemplate ? 'Update Template' : 'Create Template'}
                {!loading && <Save className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* FULL PRINT PREVIEW DIALOG */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="sm:max-w-4xl max-h-[95vh] overflow-y-auto bg-slate-900 text-white border-0 p-4 sm:p-6 w-[95vw] sm:w-full">
            <DialogHeader className="flex flex-row justify-between items-center border-b border-slate-800 pb-4">
              <DialogTitle className="text-base sm:text-lg font-bold text-slate-200 flex items-center gap-2">
                <Maximize2 className="h-4 w-4 text-amber-400" /> Certificate Preview
              </DialogTitle>
            </DialogHeader>

            <div className="py-4 sm:py-6 flex justify-center bg-slate-950 p-3 sm:p-4 rounded-xl border border-slate-800 overflow-x-auto">
              <div className="w-full max-w-[800px] bg-white text-slate-900 rounded-lg overflow-hidden shadow-2xl">
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setPreviewOpen(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800 w-full sm:w-auto order-2 sm:order-1">
                Close
              </Button>
              <Button
                onClick={() => {
                  const printContent = document.getElementById('print-certificate-area');
                  if (!printContent) return;
                  const win = window.open('', '', 'width=900,height=650');
                  if (win) {
                    win.document.write(`
                      <html>
                        <head>
                          <title>Certificate</title>
                          <style>
                            @page { size: A4 portrait; margin: 8mm; }
                            body { font-family: 'Times New Roman', Georgia, serif; margin: 0; padding: 0; background: #ffffff; }
                            #print-certificate-area { max-width: 100%; }
                            @media print {
                              .no-print { display: none; }
                            }
                          </style>
                        </head>
                        <body>
                          ${printContent.outerHTML}
                          <script>
                            window.onload = function() { 
                              window.print(); 
                              setTimeout(function() { window.close(); }, 500);
                            }
                          <\/script>
                        </body>
                      </html>
                    `);
                    win.document.close();
                  }
                }}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold gap-2 shadow-lg shadow-emerald-600/25 w-full sm:w-auto order-1 sm:order-2"
              >
                <Printer className="h-4 w-4" />
                Print Certificate
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ResponsiveLayout>
  );
}
