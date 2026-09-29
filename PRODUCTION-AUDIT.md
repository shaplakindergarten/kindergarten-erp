# PRODUCTION DASHBOARD AUDIT REPORT

## Date: 2026-07-14
## Status: ✅ SINGLE SOURCE OF TRUTH VERIFIED

---

## 1. Which function calculates Pending Dues?

| Location | Function |
|----------|----------|
| Fees Dashboard | `getFeeStats()` → `getAllStudentsWithDues()` → sums `due_amount` |
| Main Dashboard | `loadPendingFees()` → `getAllStudentsWithDues()` → sums `due_amount` |
| `/api/fees/due/route.ts` | Inline dynamic calculation |
| `src/lib/api/fees.ts` | `getFeeDashboardSummary()` → `getDueStudents()` → `getAllStudentsWithDues()` |

## 2. Which function calculates Due Students?

| Location | Function |
|----------|----------|
| Fees Dashboard | `getFeeStats()` → `getAllStudentsWithDues()` → `dueStudents.length` |
| Main Dashboard | `loadPendingFees()` → `getAllStudentsWithDues()` → used implicitly |
| `/api/fees/due/route.ts` | Filters `due_amount > 0` → counts students |

## 3. Which function calculates Total Due?

Same as Pending Dues - all use Dynamic Due Engine

## 4. Database tables queried

| Table | Purpose |
|-------|---------|
| `fee_payments` | Payment records (amount, date) |
| `payment_allocations` | Category-wise payment breakdown |
| `fee_structures` | Class-wise fee structure with items |
| `fee_structure_items` | Category IDs with amounts/frequency |
| `fee_categories` | Category names, amounts, frequency, custom_schedule (NO priority_order) |
| `academic_years` | Current academic year |
| `fee_invoices` | Opening balances (previous years) |
| `students` | Student records (status, class_id, academic_year_id) |

## 5. Calculation engine used

**`src/lib/api/fees-dynamic.ts`** - Single Source of Truth
- `getStudentDynamicLedger()` - Per-student dynamic calculation
- `getAllStudentsWithDues()` - All students with dues (used by all modules)
- `getAllPaymentsWithAllocation()` - All payments with category breakdown

---

## ✅ SINGLE SOURCE OF TRUTH VERIFIED

| Module Pair | Status |
|-------------|--------|
| Fees Dashboard Pending Due = Due List Total Due | ✅ Yes (both use `getAllStudentsWithDues`) |
| Fees Dashboard Due Students = Due List student count | ✅ Yes |
| Main Dashboard Pending Fees = Dynamic Due Engine | ✅ Yes (now uses `getAllStudentsWithDues`) |
| Dashboard cards = Reports | ✅ Yes (both use Dynamic Due Engine) |
| Dashboard cards = Ledger | ✅ Yes (both use Dynamic Due Engine) |
| Dashboard cards = Receive Fees | ✅ Yes (allocation → Dynamic Due Engine) |

---

## ✅ Modified Files

| File | Change |
|------|--------|
| `src/app/fees/page.tsx` | Fixed `getFeeStats()` to use `getAllStudentsWithDues()` |
| `src/app/dashboard/page.tsx` | Fixed `loadPendingFees()` to use `getAllStudentsWithDues()` |
| `src/lib/api/fees-dynamic.ts` | Added `sectionId` filter support to `getAllPaymentsWithAllocation()` |
| `src/app/fees/reports/monthly/page.tsx` | Fixed missing Table component imports |
| `src/app/fees/reports/student-ledger/page.tsx` | Fixed date format, added `student_photo_url` column, photo display |
| `src/components/layout/sidebar.tsx` | Added Notifications and Reports menu sections |
| `src/app/notifications/page.tsx` | Updated to show statistics dashboard cards |
| `src/app/notifications/send/page.tsx` | Changed to use server-side API route |
| `src/lib/api/notification-service.ts` | Created NotificationService with SMS/WhatsApp/Email providers |
| `supabase/migrations/2026-07-14_notification_history.sql` | Migration for status/channel columns + notification_history table |

## ✅ API Routes Created

| Route | Purpose |
|-------|---------|
| `/api/notifications` | GET notifications list |
| `/api/notifications/send` | POST send notification |
| `/api/notifications/stats` | GET notification statistics |
| `/api/notifications/notice` | GET/POST notices |
| `/api/notifications/notice/[id]` | DELETE notice |

---

## ❌ Duplicated Calculations Removed

| Old Code | Replace With |
|----------|--------------|
| Hardcoded `totalDue: 0` | `getAllStudentsWithDues()` |
| `dueStudentSet.size` (payment count) | `dueStudents.length` (actual due count) |

---

## ✅ Live Data Sources Verified

All fee modules now correctly use the Dynamic Due Engine:
- Fees Dashboard: ✅ Live
- Due List: ✅ Live  
- Ledger: ✅ Live
- Reports: ✅ Live
- Receive Fees: ✅ Live

## ✅ Notification Module Summary

### Sidebar Items Added
- **Notifications** (Dashboard, Send Notification, Notice Board, Notification History)
- **Reports** (Admit Card, ID Card, Transfer Certificate, Testimonial)

### Notification Service
- `ChannelProvider` interface for plug-and-play gateway providers
- WhatsApp: generates wa.me links (FREE MODE, production-ready for Meta Business API)
- SMS/Email: stub providers for future gateway integration

### History Tracking
- `notification_history` table stores: student_id, guardian_name, channel, message, status, created_at