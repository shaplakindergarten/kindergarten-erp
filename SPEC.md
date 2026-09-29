# Kindergarten ERP - Complete System Specification

## 1. Concept & Vision

A comprehensive, free, and open-source Kindergarten ERP system designed for educational institutions in Bangladesh and beyond. The system provides a complete school management solution with a child-friendly, colorful yet professional interface that makes administrative tasks intuitive and efficient. Built with modern technology stack (Next.js, Supabase, Vercel) ensuring scalability, reliability, and zero hosting costs.

## 2. Design Language

### Aesthetic Direction
Playful yet professional - combining the warmth and creativity appropriate for early childhood education with the clarity needed for administrative work. Think of a modern children's museum meets efficient corporate dashboard.

### Color Palette
```
Primary:     #6366F1 (Indigo - Trust & Education)
Secondary:   #10B981 (Emerald - Growth & Success)
Accent:      #F59E0B (Amber - Warmth & Energy)
Background:  #F8FAFC (Slate 50 - Clean & Bright)
Surface:     #FFFFFF (White - Cards & Panels)
Text:        #1E293B (Slate 800 - Primary Text)
Text Muted:  #64748B (Slate 500 - Secondary Text)
Success:     #22C55E (Green)
Warning:     #EAB308 (Yellow)
Error:       #EF4444 (Red)
Info:        #3B82F6 (Blue)
```

### Typography
- **Headings**: Poppins (600, 700) - Friendly, modern, excellent readability
- **Body**: Inter (400, 500, 600) - Clean, professional, great for data
- **Monospace**: JetBrains Mono - For codes and IDs

### Spatial System
- Base unit: 4px
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64px
- Border radius: 8px (small), 12px (medium), 16px (large), 24px (xl)
- Card shadows: `0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)`

### Motion Philosophy
- Micro-interactions: 150ms ease-out
- Page transitions: 200ms ease-in-out
- Modal animations: 250ms cubic-bezier(0.4, 0, 0.2, 1)
- Hover effects: subtle scale(1.02) with shadow elevation
- Loading states: skeleton shimmer animation

### Visual Assets
- **Icons**: Lucide React (consistent, well-designed, MIT licensed)
- **Illustrations**: Custom SVG icons with playful style for empty states
- **Charts**: Recharts for data visualization
- **Decorative**: Subtle gradient backgrounds, rounded shapes

## 3. Layout & Structure

### Application Shell
```
┌─────────────────────────────────────────────────────────────┐
│  Sidebar (240px)  │           Main Content Area             │
│  ┌─────────────┐  │  ┌─────────────────────────────────────┐ │
│  │   Logo      │  │  │  Top Bar (Search, Notifications)   │ │
│  │             │  │  └─────────────────────────────────────┘ │
│  │  Navigation │  │  ┌─────────────────────────────────────┐ │
│  │  - Dashboard│  │  │                                     │ │
│  │  - Students│  │  │         Page Content                │ │
│  │  - Fees    │  │  │                                     │ │
│  │  - Staff   │  │  │                                     │ │
│  │  - Attend. │  │  │                                     │ │
│  │  - Exam    │  │  │                                     │ │
│  │  - Finance │  │  │                                     │ │
│  │  - Reports │  │  │                                     │ │
│  │  - Settings│  │  └─────────────────────────────────────┘ │
│  └─────────────┘  │                                         │
└─────────────────────────────────────────────────────────────┘
```

### Responsive Strategy
- **Desktop (1280px+)**: Full sidebar, multi-column layouts
- **Tablet (768px-1279px)**: Collapsible sidebar, 2-column grids
- **Mobile (<768px)**: Bottom navigation, single column, drawer menus

### Page Structure Pattern
1. Page header (title, breadcrumbs, primary action)
2. Filter/Search bar (when applicable)
3. Data cards/Sections
4. Tables/Grids with pagination
5. Action modals/drawers

## 4. Features & Interactions

### 4.1 Authentication
- Email/Password login with Supabase Auth
- Password reset functionality
- Session management with JWT
- Role-based access control (Admin, Teacher, Accountant, Parent)

### 4.2 Dashboard
- **Stats Cards**: Total students, today's attendance, fees collection, staff count
- **Quick Actions**: Add student, mark attendance, record fees
- **Charts**: Monthly enrollment trend, fees collection chart, attendance percentage
- **Recent Activities**: Last 10 system activities
- **Upcoming**: Today's birthdays, upcoming exams, pending tasks

### 4.3 Student Management

#### New Admission Form
- Multi-step form wizard
- Fields: Name, Father's Name, Mother's Name, DOB, Gender, Address, Contact, Photo
- Class/Section selection
- Previous school info (optional)
- Document upload (Birth certificate, Photo)
- Auto-generate Student ID

#### Student List
- Paginated table with search & filters
- Columns: Photo, ID, Name, Class, Section, Father Name, Contact, Status
- Actions: View, Edit, Promote, Release, Print
- Bulk selection for bulk actions

#### Bulk Upload
- Excel template download
- Drag & drop upload zone
- Validation preview with error highlighting
- Import progress indicator
- Error report download

#### Promotion/Demotion
- Select class to promote
- Preview students with current class
- Select target class
- Bulk promotion with confirmation
- History tracking

#### Student Release/Transfer
- Release form with reason
- TC (Transfer Certificate) generation
- Clearance check (fees, library, etc.)
- Export to PDF

#### Class & Section Setup
- Class management (Nursery to Class 8)
- Section creation per class (A, B, C...)
- Capacity setting
- Teacher assignment to sections

### 4.4 Fees Management

#### Fees Categories
- Category name, amount, frequency
- One-time, Monthly, Quarterly, Annual options
- Class-specific fees
- Discount rules (sibling, scholarship)

#### Fees Received
- Student search
- Select fees category
- Amount input with due calculation
- Payment method (Cash, Bank, Mobile Banking)
- Receipt generation
- Print/Download receipt

#### Fees Ledger
- Student-wise transaction history
- Date range filter
- Running balance display
- Export to Excel

#### Fees Due List
- Automatic due calculation
- Class-wise due report
- Send reminder functionality
- Aging analysis (0-30, 31-60, 61-90, 90+ days)

### 4.5 Teacher & Staff Management

#### Add Teacher/Staff
- Profile form: Name, DOB, Qualification, Experience, Contact
- Role selection (Teacher, Admin Staff, Support Staff)
- Subject assignment (for teachers)
- Salary category assignment
- Document upload (Certificate, ID)

#### Profiles
- Complete profile view
- Employment history
- Salary records
- Leave history
- Performance notes

#### List View
- Filterable table
- Role-based filtering
- Status (Active, On Leave, Terminated)
- Quick actions

#### Vacations
- Leave request submission
- Leave type (Sick, Casual, Maternity, Unpaid)
- Approval workflow
- Leave balance tracking
- Calendar view

#### Salary Setup
- Salary category creation
- Basic, HRA, DA, allowances configuration
- Deductions setup
- Tax configuration

#### Salary Payment
- Select employee
- Auto-calculate salary
- Adjustments
- Payment mode
- Payslip generation

### 4.6 Attendance Management

#### Student Attendance
- Date picker
- Class/Section filter
- Mark all present/absent
- Individual marking
- Biometric integration placeholder (API ready)
- Face recognition placeholder (API ready)
- Late arrival marking

#### Teacher Attendance
- Employee selection
- Date picker
- Mark attendance
- Biometric/Face placeholder

#### Reports
- Daily attendance summary
- Monthly percentage report
- Class-wise analysis
- Student-wise attendance history
- Charts and graphs

### 4.7 Examination Management

#### Exam Categories
- Category name (Weekly, Monthly, Term, Final)
- Weightage configuration
- Pass marks setting

#### Mark & Grading Setup
- Subject-wise marks
- Grading system (A+, A, B+, B, C, D, F)
- Grade to GPA conversion
- Subject combination

#### Academic Transcript
- Student selection
- Select exams
- Auto-generate transcript
- Print/PDF export
- Grade calculation

#### Tabulation Sheet
- Class/Section selection
- Exam selection
- Auto-populate marks
- Rank calculation
- Pass/Fail status
- Print ready format

#### Merit List
- Class-wise ranking
- Subject-wise toppers
- Position certificates

### 4.8 Inventory Management

#### Product Buy
- Product name, category, quantity
- Supplier selection
- Purchase price
- Bill upload
- Stock update

#### Product Sale
- Product selection
- Quantity
- Sale price
- Customer info
- Receipt generation

#### Stock List
- Real-time inventory
- Low stock alerts
- Category filter
- Search
- Update stock manually

#### Sales Report
- Date range
- Category-wise
- Profit calculation
- Export options

### 4.9 Finance Management

#### Cash Book
- Date-wise transactions
- Cash in hand
- Running balance
- Filter by type
- Print format

#### Income Heads
- Configure income categories
- Student fees (linked)
- Product sales (linked)
- Donations
- Other income

#### Expense Heads
- Salary payments (linked)
- Administrative expenses
- Utility bills
- Stationery
- Maintenance
- Other expenses

#### Income Entry
- Select income head
- Amount, date, description
- Payment mode
- Attach receipt

#### Expense Entry
- Select expense head
- Amount, date, description
- Vendor/supplier
- Attach bill

#### Reports
- Income report (date range)
- Expense report
- Monthly summary
- Annual balance sheet
- Profit & Loss statement
- Charts visualization

### 4.10 Notification Management

#### Send Notifications
- Select recipients (Student/Staff/All)
- Notification type (Due, Attendance, Result, General)
- Message composer
- Preview
- Schedule (Now/Scheduled)
- Delivery method (In-app, Email placeholder)

#### WhatsApp Integration
- WhatsApp Business API placeholder
- Template messages
- Bulk sending
- Delivery status

#### Notice Board
- Create notices
- Pin important
- Category (Academic, Event, Holiday, Urgent)
- Publish date
- Expiry date

#### Notification History
- Sent notifications log
- Delivery status
- Read receipts
- Resend option

### 4.11 Academic Reports

#### Testimonial Generate
- Student selection
- Template selection
- Auto-fill details
- Custom remarks
- Principal signature placeholder
- Print/PDF

#### Transfer Certificate
- Student selection
- Reason for leaving
- Clearance status
- Generate TC
- Print format as per education board

#### Admit Card
- Select exam
- Select students
- Auto-generate with photo
- Roll number
- Exam details
- Print bulk

#### ID Card Generate
- Template selection
- Student/Staff selection
- Auto-generate
- Print format (Multiple per page)
- Barcode/QR code

### 4.12 Question Management

#### Question Bank
- Create questions
- Subject-wise organization
- Question types (MCQ, Short, Long)
- Difficulty level
- Tags
- Import from Excel

#### Question Generate
- Manual: Select subject, type, enter question
- Automatic: AI placeholder (OpenAI API ready)
- Random question selection
- Auto-generate test papers

### 4.13 Master Settings

#### Admin Roles
- Create roles (Super Admin, Admin, Teacher, Accountant)
- Assign permissions per role
- Role hierarchy

#### Users Settings
- User list
- Create user
- Assign role
- Reset password
- Active/Inactive status

#### Permissions
- Module-wise permissions
- CRUD permissions
- View-only options
- Custom permission sets

#### School Settings
- School name
- Address
- Contact info
- Logo upload
- Founder's message
- Affiliation details

#### Academic Year Setup
- Current session
- Term/Semester configuration
- Holiday calendar
- Exam schedule template

#### Language Settings
- Default language selection
- Multi-language support ready (i18n structure)
- RTL support placeholder

## 5. Component Inventory

### Buttons
- **Primary**: Indigo background, white text, hover darken
- **Secondary**: White background, indigo border, hover fill
- **Danger**: Red background for destructive actions
- **Ghost**: Transparent, text only
- **Icon Button**: Square, icon centered
- **States**: Default, Hover, Active, Disabled, Loading

### Form Elements
- **Input**: 40px height, 12px padding, focus ring indigo
- **Select**: Custom dropdown with search
- **Checkbox/Radio**: Custom styled
- **Date Picker**: Calendar popup
- **File Upload**: Drag & drop zone
- **Textarea**: Auto-resize
- **States**: Default, Focus, Error, Disabled, Success

### Cards
- **Stat Card**: Icon, value, label, trend indicator
- **Data Card**: Header, content, actions
- **Profile Card**: Avatar, info, actions
- **Action Card**: Large icon, title, description

### Tables
- **Data Table**: Sortable, selectable, paginated
- **Actions**: Inline actions menu
- **States**: Loading skeleton, Empty state, Error state

### Modals
- **Confirmation Modal**: Icon, message, actions
- **Form Modal**: Title, form, actions
- **Preview Modal**: Content preview, actions
- **Drawer**: Side panel for forms

### Navigation
- **Sidebar**: Collapsible, icon+text, nested menu
- **Breadcrumbs**: Path display
- **Tabs**: Horizontal tab navigation
- **Pagination**: Page numbers, prev/next

### Feedback
- **Toast**: Success, Error, Warning, Info
- **Alert**: Inline feedback
- **Progress**: Linear, circular
- **Skeleton**: Loading placeholders

### Data Display
- **Badge**: Status indicators
- **Avatar**: User photos with fallback
- **Charts**: Line, Bar, Pie, Area
- **Calendar**: Event display
- **Timeline**: Activity history

## 6. Technical Approach

### Stack
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **State**: Zustand for global state
- **Forms**: React Hook Form + Zod validation
- **Tables**: TanStack Table
- **Charts**: Recharts
- **Icons**: Lucide React
- **PDF**: @react-pdf/renderer
- **Excel**: xlsx library

### Backend
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage (files, images)
- **Realtime**: Supabase Realtime (notifications)

### API Structure
```
/api/
  /auth/
    /login
    /register
    /reset-password
  /students/
  /teachers/
  /attendance/
  /fees/
  /exams/
  /inventory/
  /finance/
  /notifications/
  /reports/
  /settings/
```

### Database Schema (Core Tables)
```sql
-- Organizations
organizations
  - id, name, address, phone, email, logo_url, created_at

-- Users & Auth
users
  - id, email, password_hash, role_id, organization_id, created_at

roles
  - id, name, permissions (jsonb), created_at

-- Academic
academic_years
  - id, organization_id, name, start_date, end_date, is_active

classes
  - id, organization_id, name, numeric_order, created_at

sections
  - id, class_id, name, capacity, class_teacher_id

-- Students
students
  - id, organization_id, user_id, admission_no, name, father's_name, mother's_name,
    dob, gender, address, contact, photo_url, class_id, section_id,
    academic_year_id, status, created_at

-- Staff
staff
  - id, organization_id, user_id, employee_id, name, designation,
    qualification, experience, dob, gender, address, contact,
    photo_url, salary_category_id, status, created_at

-- Attendance
student_attendance
  - id, student_id, date, status (present/absent/late), remarks

staff_attendance
  - id, staff_id, date, status, remarks

-- Fees
fee_categories
  - id, organization_id, name, amount, frequency, class_id

fee_transactions
  - id, student_id, category_id, amount, paid_amount, date,
    payment_method, receipt_no, academic_year_id

-- Examinations
exams
  - id, organization_id, name, type, start_date, end_date, academic_year_id

exam_results
  - id, exam_id, student_id, subject_id, marks, grade

-- Inventory
products
  - id, organization_id, name, category, purchase_price, sale_price, quantity

inventory_transactions
  - id, product_id, type (buy/sale), quantity, price, date, remarks

-- Finance
income_heads
  - id, organization_id, name, type

expense_heads
  - id, organization_id, name, type

finance_transactions
  - id, organization_id, type (income/expense), head_id, amount,
    date, description, payment_mode, reference

-- Salary
salary_categories
  - id, organization_id, name, basic, hra, da, allowances, deductions

salary_payments
  - id, staff_id, category_id, amount, date, payment_method

-- Notifications
notifications
  - id, organization_id, type, title, message, recipient_type,
    sent_at, created_at

-- Leaves
leaves
  - id, staff_id, type, start_date, end_date, reason, status, approved_by

-- Settings
school_settings
  - id, organization_id, settings (jsonb)
```

### Deployment
- **Platform**: Vercel (Frontend)
- **Database**: Supabase Cloud (Free tier)
- **Storage**: Supabase Storage (Free tier)
- **Domain**: Vercel subdomain (free) or custom domain

### Security
- Row Level Security (RLS) in Supabase
- Role-based access control
- Input validation (Zod)
- XSS prevention
- CSRF protection
- Secure headers

## 7. File Structure
```
kindergarten-erp/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx (Dashboard)
│   │   │   ├── students/
│   │   │   ├── teachers/
│   │   │   ├── attendance/
│   │   │   ├── fees/
│   │   │   ├── exams/
│   │   │   ├── inventory/
│   │   │   ├── finance/
│   │   │   ├── reports/
│   │   │   ├── notifications/
│   │   │   └── settings/
│   │   ├── api/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/ (shadcn components)
│   │   ├── layout/
│   │   ├── forms/
│   │   ├── tables/
│   │   └── charts/
│   ├── lib/
│   │   ├── supabase/
│   │   ├── utils/
│   │   └── validations/
│   ├── store/
│   ├── types/
│   └── hooks/
├── public/
├── supabase/
│   └── migrations/
├── package.json
├── tailwind.config.ts
├── next.config.js
└── README.md
```

## 8. Implementation Priority

### Phase 1 - Core Setup
1. Project initialization
2. Supabase setup & migrations
3. Authentication
4. Layout & navigation
5. Dashboard

### Phase 2 - Student Module
6. Student CRUD
7. Class/Section setup
8. Bulk upload
9. Promotion/Release

### Phase 3 - Staff Module
10. Staff CRUD
11. Salary setup
12. Leave management

### Phase 4 - Operations
13. Attendance
14. Fees
15. Exams

### Phase 5 - Finance & Reports
16. Inventory
17. Finance management
18. Reports generation

### Phase 6 - Communication
19. Notifications
20. Notice board

### Phase 7 - Settings
21. Master settings
22. Role management
23. School configuration
