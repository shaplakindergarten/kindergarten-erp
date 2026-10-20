


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";








ALTER SCHEMA "public" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."adjust_advance_on_new_dues"("p_student_id" "uuid", "p_academic_year_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_advance_record RECORD;
    v_due_record RECORD;
    v_adjust_amount NUMERIC;
    v_total_adjusted NUMERIC := 0;
    v_result jsonb := '[]'::jsonb;
BEGIN
    -- Loop through pending carry forward for this student
    FOR v_advance_record IN
        SELECT *
        FROM public.student_fee_advance
        WHERE student_id = p_student_id
          AND status = 'pending'
          AND remaining_balance > 0
        ORDER BY created_at ASC
    LOOP
        -- Find matching due in new academic year (same category)
        FOR v_due_record IN
            SELECT *
            FROM public.student_fee_dues
            WHERE student_id = p_student_id
              AND academic_year_id = p_academic_year_id
              AND category_id = v_advance_record.category_id
              AND due_amount > 0
            ORDER BY month ASC, due_date ASC
        LOOP
            EXIT WHEN v_advance_record.remaining_balance <= 0.01;
            
            v_adjust_amount := LEAST(
                v_advance_record.remaining_balance, 
                v_due_record.due_amount
            );
            
            IF v_adjust_amount > 0 THEN
                -- Update due
                UPDATE public.student_fee_dues
                SET 
                    paid_amount = paid_amount + v_adjust_amount,
                    due_amount = GREATEST(0, due_amount - v_adjust_amount),
                    status = CASE 
                        WHEN due_amount - v_adjust_amount <= 0 THEN 'paid'
                        ELSE 'partial'
                    END,
                    updated_at = NOW()
                WHERE id = v_due_record.id;
                
                -- Update advance balance
                UPDATE public.student_fee_advance
                SET 
                    remaining_balance = remaining_balance - v_adjust_amount,
                    status = CASE 
                        WHEN remaining_balance - v_adjust_amount <= 0 THEN 'used'
                        ELSE 'pending'
                    END,
                    updated_at = NOW()
                WHERE id = v_advance_record.id;
                
                v_advance_record.remaining_balance := v_advance_record.remaining_balance - v_adjust_amount;
                v_total_adjusted := v_total_adjusted + v_adjust_amount;
                
                v_result := v_result || jsonb_build_object(
                    'category_id', v_advance_record.category_id,
                    'month', v_due_record.month,
                    'amount', v_adjust_amount
                );
            END IF;
        END LOOP;
    END LOOP;
    
    RETURN jsonb_build_object(
        'student_id', p_student_id,
        'academic_year_id', p_academic_year_id,
        'total_adjusted', v_total_adjusted,
        'details', v_result
    );
END;
$$;


ALTER FUNCTION "public"."adjust_advance_on_new_dues"("p_student_id" "uuid", "p_academic_year_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_assign_fee_structure_to_new_student"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_fee_structure_id uuid;
    v_academic_year_id uuid;
BEGIN
    -- Current academic year নিন
    SELECT id INTO v_academic_year_id
    FROM public.academic_years
    WHERE is_current = true
    LIMIT 1;

    IF v_academic_year_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Class অনুযায়ী fee structure খুঁজুন
    SELECT id INTO v_fee_structure_id
    FROM public.fee_structures
    WHERE class_id = NEW.class_id
      AND academic_year_id = v_academic_year_id
      AND is_active = true
    LIMIT 1;

    IF v_fee_structure_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Fee structure assign করুন
    INSERT INTO public.fee_student_assignments (
        student_id,
        fee_structure_id,
        academic_year_id,
        assigned_date,
        effective_from,
        effective_to,
        is_active,
        notes
    ) VALUES (
        NEW.id,
        v_fee_structure_id,
        v_academic_year_id,
        CURRENT_DATE,
        CURRENT_DATE,
        NULL,
        true,
        'Auto-assigned on student creation'
    )
    ON CONFLICT (student_id, academic_year_id) WHERE is_active = true 
    DO NOTHING;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- কোনো error হলে student creation আটকাবে না
    RAISE WARNING 'auto_assign_fee_structure failed for student %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_assign_fee_structure_to_new_student"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_generate_dues_on_assignment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_academic_year RECORD;
    v_result JSONB;
BEGIN
    SELECT * INTO v_academic_year 
    FROM public.academic_years 
    WHERE id = NEW.academic_year_id;
    
    IF v_academic_year IS NULL THEN
        RAISE WARNING 'Academic year % not found for student %', 
            NEW.academic_year_id, NEW.student_id;
        RETURN NEW;
    END IF;
    
    IF NEW.is_active = true THEN
        BEGIN
            v_result := public.generate_dues_from_structure(
                NEW.student_id,
                NEW.academic_year_id,
                TO_CHAR(CURRENT_DATE, 'YYYY-MM')
            );
            
            RAISE NOTICE '✅ Dues generated for student %: % entries', 
                NEW.student_id, v_result->>'processed_entries';
                
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Dues generation failed for student %: %', 
                NEW.student_id, SQLERRM;
        END;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_generate_dues_on_assignment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_mark_student_leave_attendance"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- যখন ছুটির আবেদন Approved হবে, তখন স্বয়ংক্রিয়ভাবে অ্যাটেনডেন্স টেবিলে 'leave' মার্ক হবে
    IF NEW.status = 'Approved' THEN
        INSERT INTO public.student_attendance (student_id, date, status, remarks, marked_via)
        VALUES (NEW.student_id, NEW.start_date, 'leave', 'Leave Approved by Admin', 'auto')
        ON CONFLICT (student_id, date) 
        DO UPDATE SET status = 'leave', remarks = 'Leave Approved by Admin';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_mark_student_leave_attendance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_update_expired_leaves"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- মেয়াদ উত্তীর্ণ Approved লিভ গুলো Expired করুন
    UPDATE public.leaves
    SET status = 'expired'
    WHERE status = 'approved' 
    AND end_date < CURRENT_DATE;
    
    -- যেসব স্টাফের কোনো Active লিভ নেই, তাদের Active করুন
    UPDATE public.staff
    SET status = 'active'
    WHERE status = 'on_leave'
    AND NOT EXISTS (
        SELECT 1 FROM public.leaves 
        WHERE staff_id = staff.id 
        AND status = 'approved'
        AND start_date <= CURRENT_DATE
        AND end_date >= CURRENT_DATE
    );
END;
$$;


ALTER FUNCTION "public"."auto_update_expired_leaves"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_update_staff_status_on_leave"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- যখন লিভ Approved হয়
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        -- স্টাফের status 'on_leave' আপডেট করুন
        UPDATE public.staff 
        SET status = 'on_leave',
            updated_at = NOW()
        WHERE id = NEW.staff_id;
    
    -- যখন লিভ Rejected হয়
    ELSIF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
        -- স্টাফের status আবার 'active' করুন (যদি on_leave থাকে)
        UPDATE public.staff 
        SET status = 'active',
            updated_at = NOW()
        WHERE id = NEW.staff_id 
        AND status = 'on_leave';
    
    -- যখন লিভ শেষ হয়ে যায় (end_date < today)
    ELSIF NEW.status = 'approved' AND NEW.end_date < CURRENT_DATE THEN
        -- স্টাফের status 'active' করুন
        UPDATE public.staff 
        SET status = 'active',
            updated_at = NOW()
        WHERE id = NEW.staff_id 
        AND status = 'on_leave';
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_update_staff_status_on_leave"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_update_student_fee_structure"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF NEW.is_active = true AND 
       NEW.effective_from <= CURRENT_DATE AND 
       (NEW.effective_to IS NULL OR NEW.effective_to >= CURRENT_DATE) THEN
        UPDATE public.students 
        SET current_fee_structure_id = NEW.fee_structure_id
        WHERE id = NEW.student_id;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_update_student_fee_structure"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_setup_salaries"("p_salary_category_id" "uuid" DEFAULT NULL::"uuid", "p_effective_from" "date" DEFAULT CURRENT_DATE, "p_created_by" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("total_processed" integer, "total_created" integer, "total_skipped" integer, "total_failed" integer, "errors" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_staff RECORD;
    v_category_id UUID;
    v_count_created INTEGER := 0;
    v_count_skipped INTEGER := 0;
    v_count_failed INTEGER := 0;
    v_errors JSONB := '[]'::JSONB;
    v_error_obj JSONB;
    v_category RECORD;
BEGIN
    FOR v_staff IN 
        SELECT s.id, s.salary_category_id, s.joining_date
        FROM staff s
        WHERE s.status != 'resigned'
    LOOP
        BEGIN
            IF EXISTS (
                SELECT 1 FROM staff_salaries 
                WHERE staff_id = v_staff.id AND is_current = true
            ) THEN
                v_count_skipped := v_count_skipped + 1;
                CONTINUE;
            END IF;
            
            IF p_salary_category_id IS NOT NULL THEN
                v_category_id := p_salary_category_id;
            ELSE
                v_category_id := v_staff.salary_category_id;
            END IF;
            
            IF v_category_id IS NULL THEN
                v_count_failed := v_count_failed + 1;
                v_error_obj = JSONB_BUILD_OBJECT(
                    'staff_id', v_staff.id,
                    'error', 'No salary category assigned'
                );
                v_errors := v_errors || v_error_obj;
                CONTINUE;
            END IF;
            
            SELECT * INTO v_category
            FROM salary_categories
            WHERE id = v_category_id;
            
            IF v_category IS NULL THEN
                v_count_failed := v_count_failed + 1;
                v_error_obj = JSONB_BUILD_OBJECT(
                    'staff_id', v_staff.id,
                    'error', 'Category not found'
                );
                v_errors := v_errors || v_error_obj;
                CONTINUE;
            END IF;
            
            INSERT INTO staff_salaries (
                staff_id,
                salary_category_id,
                basic,
                hra,
                da,
                allowances,
                other_deductions,
                effective_from,
                created_by,
                is_current,
                version
            ) VALUES (
                v_staff.id,
                v_category_id,
                COALESCE(v_category.basic, 0),
                COALESCE(v_category.hra, 0),
                COALESCE(v_category.da, 0),
                COALESCE(v_category.allowances, 0),
                COALESCE(v_category.deductions, 0),
                p_effective_from,
                p_created_by,
                true,
                1
            );
            
            v_count_created := v_count_created + 1;
            
        EXCEPTION WHEN OTHERS THEN
            v_count_failed := v_count_failed + 1;
            v_error_obj = JSONB_BUILD_OBJECT(
                'staff_id', v_staff.id,
                'error', SQLERRM
            );
            v_errors := v_errors || v_error_obj;
        END;
    END LOOP;
    
    RETURN QUERY SELECT 
        v_count_created + v_count_skipped + v_count_failed AS total_processed,
        v_count_created AS total_created,
        v_count_skipped AS total_skipped,
        v_count_failed AS total_failed,
        v_errors AS errors;
END;
$$;


ALTER FUNCTION "public"."bulk_setup_salaries"("p_salary_category_id" "uuid", "p_effective_from" "date", "p_created_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_upload_students"("students_data" "jsonb", "user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
  v_student JSONB;
  v_class_id UUID;
  v_section_id UUID;
  v_student_id TEXT;
  v_admission_no TEXT;
  v_serial INTEGER;
  v_errors TEXT[] := '{}';
  v_success_count INTEGER := 0;
  v_failed_count INTEGER := 0;
  v_result JSONB;
  v_batch_size INTEGER := 100;
  v_counter INTEGER := 0;
  v_class_map JSONB;
  v_section_map JSONB;
BEGIN
  -- Create temporary table for batch insert
  CREATE TEMP TABLE temp_students (
    student_id TEXT,
    admission_no TEXT,
    name TEXT,
    name_bn TEXT,
    father_name TEXT,
    father_name_bn TEXT,
    mother_name TEXT,
    mother_name_bn TEXT,
    dob DATE,
    birth_cert_no TEXT,
    blood_group TEXT,
    particular_disease TEXT,
    gender TEXT,
    contact TEXT,
    village TEXT,
    post_office TEXT,
    police_station TEXT,
    district TEXT,
    class_roll TEXT,
    class_id UUID,
    section_id UUID,
    fathers_contact TEXT,
    mothers_contact TEXT,
    email TEXT,
    whatsapp TEXT,
    father_nid_no TEXT,
    mother_nid_no TEXT,
    status TEXT DEFAULT 'active',
    academic_year_id UUID,
    created_at TIMESTAMP DEFAULT NOW()
  );

  -- Load class mapping
  SELECT JSONB_OBJECT_AGG(LOWER(name), id) INTO v_class_map
  FROM classes;

  -- Load section mapping
  SELECT JSONB_OBJECT_AGG(
    LOWER(s.name) || '_' || c.id::TEXT,
    s.id
  ) INTO v_section_map
  FROM sections s
  JOIN classes c ON c.id = s.class_id;

  -- Process each student
  FOR v_student IN SELECT * FROM jsonb_array_elements(students_data)
  LOOP
    v_counter := v_counter + 1;
    
    BEGIN
      -- Get or create student_id
      v_student_id := v_student->>'student_id';
      IF v_student_id IS NULL OR v_student_id = '' THEN
        -- Generate student_id
        SELECT COALESCE(MAX(CAST(SUBSTRING(student_id FROM '(\d+)$') AS INTEGER)), 0) + 1
        INTO v_serial
        FROM students
        WHERE student_id LIKE (
          (EXTRACT(YEAR FROM NOW())::TEXT) || 
          UPPER(LEFT(v_student->>'class_name', 1)) || '%'
        );
        
        v_student_id := (EXTRACT(YEAR FROM NOW())::TEXT) || 
                       UPPER(LEFT(v_student->>'class_name', 1)) || 
                       LPAD(v_serial::TEXT, 3, '0');
      END IF;

      -- Get class ID
      v_class_id := v_class_map->>LOWER(v_student->>'class_name');
      IF v_class_id IS NULL THEN
        v_errors := v_errors || ('Row ' || v_counter || ': Class "' || v_student->>'class_name' || '" not found');
        v_failed_count := v_failed_count + 1;
        CONTINUE;
      END IF;

      -- Get section ID
      v_section_id := v_section_map->>(
        LOWER(v_student->>'section_name') || '_' || v_class_id::TEXT
      );
      IF v_section_id IS NULL THEN
        v_errors := v_errors || ('Row ' || v_counter || ': Section "' || v_student->>'section_name' || '" not found');
        v_failed_count := v_failed_count + 1;
        CONTINUE;
      END IF;

      -- Check for duplicate
      IF EXISTS (
        SELECT 1 FROM students 
        WHERE LOWER(name) = LOWER(v_student->>'name')
        AND LOWER(father_name) = LOWER(v_student->>'father_name')
        AND LOWER(mother_name) = LOWER(v_student->>'mother_name')
      ) THEN
        v_errors := v_errors || ('Row ' || v_counter || ': Duplicate student found - ' || v_student->>'name');
        v_failed_count := v_failed_count + 1;
        CONTINUE;
      END IF;

      -- Generate admission_no
      SELECT 'ERP-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || 
             LPAD((COALESCE(MAX(CAST(SUBSTRING(admission_no FROM '-(\d+)$') AS INTEGER)), 0) + 1)::TEXT, 3, '0')
      INTO v_admission_no
      FROM students
      WHERE admission_no LIKE 'ERP-' || EXTRACT(YEAR FROM NOW())::TEXT || '-%';

      -- Insert into temp table
      INSERT INTO temp_students (
        student_id, admission_no, name, name_bn, father_name, father_name_bn,
        mother_name, mother_name_bn, dob, birth_cert_no, blood_group,
        particular_disease, gender, contact, village, post_office,
        police_station, district, class_roll, class_id, section_id,
        fathers_contact, mothers_contact, email, whatsapp,
        father_nid_no, mother_nid_no, status, academic_year_id
      ) VALUES (
        v_student_id,
        v_admission_no,
        v_student->>'name',
        v_student->>'name_bn',
        v_student->>'father_name',
        v_student->>'father_name_bn',
        v_student->>'mother_name',
        v_student->>'mother_name_bn',
        (v_student->>'dob')::DATE,
        v_student->>'birth_cert_no',
        v_student->>'blood_group',
        v_student->>'particular_disease',
        v_student->>'gender',
        v_student->>'contact',
        v_student->>'village',
        v_student->>'post_office',
        v_student->>'police_station',
        v_student->>'district',
        v_student->>'class_roll',
        v_class_id,
        v_section_id,
        v_student->>'fathers_contact',
        v_student->>'mothers_contact',
        v_student->>'email',
        v_student->>'whatsapp',
        v_student->>'father_nid_no',
        v_student->>'mother_nid_no',
        'active',
        (SELECT id FROM academic_years WHERE is_current = true LIMIT 1)
      );

      v_success_count := v_success_count + 1;

      -- Batch insert every 100 rows
      IF v_counter % v_batch_size = 0 THEN
        INSERT INTO students SELECT * FROM temp_students;
        TRUNCATE temp_students;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || ('Row ' || v_counter || ': ' || SQLERRM);
      v_failed_count := v_failed_count + 1;
    END;
  END LOOP;

  -- Insert remaining records
  IF EXISTS (SELECT 1 FROM temp_students) THEN
    INSERT INTO students SELECT * FROM temp_students;
  END IF;

  -- Clean up
  DROP TABLE temp_students;

  -- Return result
  v_result := JSONB_BUILD_OBJECT(
    'success', v_success_count > 0,
    'total', v_success_count + v_failed_count,
    'imported', v_success_count,
    'failed', v_failed_count,
    'errors', v_errors,
    'message', CASE 
      WHEN v_success_count > 0 AND v_failed_count = 0 THEN 'All students imported successfully'
      WHEN v_success_count > 0 AND v_failed_count > 0 THEN v_success_count || ' students imported, ' || v_failed_count || ' failed'
      ELSE 'Import failed'
    END
  );

  RETURN v_result;
END;
$_$;


ALTER FUNCTION "public"."bulk_upload_students"("students_data" "jsonb", "user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_late_fine"("p_student_id" "uuid", "p_category_id" "uuid", "p_month" "text", "p_due_date" "date", "p_due_amount" numeric) RETURNS numeric
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
    v_days_overdue INT;
    v_fine_amount NUMERIC := 0;
    v_fine_rule RECORD;
    v_today DATE := CURRENT_DATE;
BEGIN
    -- Calculate days overdue
    v_days_overdue := (v_today - p_due_date);
    
    IF v_days_overdue <= 0 THEN
        RETURN 0;
    END IF;
    
    -- Find applicable fine rule
    SELECT * INTO v_fine_rule
    FROM public.fine_rules
    WHERE is_active = TRUE
        AND days_delay <= v_days_overdue
    ORDER BY days_delay DESC
    LIMIT 1;
    
    IF v_fine_rule IS NOT NULL THEN
        IF v_fine_rule.fine_type = 'percentage' THEN
            v_fine_amount := (p_due_amount * v_fine_rule.fine_value) / 100;
        ELSE
            v_fine_amount := v_fine_rule.fine_value;
        END IF;
        
        -- Apply max fine if set
        IF v_fine_rule.max_fine IS NOT NULL AND v_fine_amount > v_fine_rule.max_fine THEN
            v_fine_amount := v_fine_rule.max_fine;
        END IF;
    END IF;
    
    RETURN ROUND(v_fine_amount, 2);
END;
$$;


ALTER FUNCTION "public"."calculate_late_fine"("p_student_id" "uuid", "p_category_id" "uuid", "p_month" "text", "p_due_date" "date", "p_due_amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_monthly_fee_due"("p_student_id" "uuid", "p_academic_year_id" "uuid", "p_target_month" "text") RETURNS TABLE("month" "text", "total_expected" numeric, "total_paid" numeric, "total_due" numeric, "is_advance" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_target_date DATE;
    v_target_month INT;
    v_target_year INT;
    v_structure_id UUID;
    v_fee_total NUMERIC := 0;
    v_total_expected NUMERIC := 0;
    v_total_paid NUMERIC := 0;
    v_total_due NUMERIC := 0;
    v_is_advance BOOLEAN := FALSE;
    v_current_month INT := EXTRACT(MONTH FROM CURRENT_DATE);
    v_current_year INT := EXTRACT(YEAR FROM CURRENT_DATE);
    v_category RECORD;
    v_allocated_so_far NUMERIC := 0;
    v_category_expected NUMERIC := 0;
    v_category_paid NUMERIC := 0;
    v_category_due NUMERIC := 0;
BEGIN
    -- Parse target month
    v_target_month := SPLIT_PART(p_target_month, '-', 2)::INT;
    v_target_year := SPLIT_PART(p_target_month, '-', 1)::INT;
    v_target_date := (v_target_year || '-' || LPAD(v_target_month::TEXT, 2, '0') || '-01')::DATE;
    
    -- Check if this month is advance (future month)
    IF (v_target_year > v_current_year) OR (v_target_year = v_current_year AND v_target_month > v_current_month) THEN
        v_is_advance := TRUE;
    END IF;
    
    -- Get student's active fee structure
    SELECT fee_structure_id INTO v_structure_id
    FROM public.fee_student_assignments
    WHERE student_id = p_student_id
        AND academic_year_id = p_academic_year_id
        AND is_active = TRUE
        AND effective_from <= v_target_date
        AND (effective_to IS NULL OR effective_to >= v_target_date)
    LIMIT 1;
    
    IF v_structure_id IS NULL THEN
        RAISE NOTICE 'No active fee structure found for student % in month %', p_student_id, p_target_month;
        RETURN;
    END IF;
    
    -- Loop through categories and calculate expected amount for this month
    FOR v_category IN
        SELECT 
            fsi.category_id,
            fc.name,
            fc.frequency,
            fc.custom_schedule,
            fsi.amount,
            fc.due_day,
            fc.grace_days
        FROM public.fee_structure_items fsi
        JOIN public.fee_categories fc ON fc.id = fsi.category_id
        WHERE fsi.fee_structure_id = v_structure_id
            AND fc.is_active = TRUE
    LOOP
        -- Check if category applies to this month
        IF v_category.frequency = 'monthly' THEN
            v_category_expected := v_category.amount;
        ELSIF v_category.frequency = 'custom' THEN
            -- Check if month is in custom schedule
            IF EXISTS (
                SELECT 1 
                FROM jsonb_array_elements_text(v_category.custom_schedule->'months') m
                WHERE m::INT = v_target_month
            ) THEN
                v_category_expected := v_category.amount;
            ELSE
                v_category_expected := 0;
            END IF;
        ELSIF v_category.frequency = 'one_time' THEN
            -- One time fee: only if this is the first occurrence or specific month
            -- For simplicity, we check if there's already a record for this category
            IF NOT EXISTS (
                SELECT 1 FROM public.student_fee_dues
                WHERE student_id = p_student_id
                    AND category_id = v_category.category_id
                    AND academic_year_id = p_academic_year_id
            ) THEN
                v_category_expected := v_category.amount;
            ELSE
                v_category_expected := 0;
            END IF;
        ELSIF v_category.frequency = 'yearly' THEN
            -- Yearly fee: only in first month of academic year
            -- For simplicity, we check if month is January or academic year start
            IF v_target_month = 1 OR v_target_month = EXTRACT(MONTH FROM (SELECT start_date FROM academic_years WHERE id = p_academic_year_id)) THEN
                v_category_expected := v_category.amount;
            ELSE
                v_category_expected := 0;
            END IF;
        ELSIF v_category.frequency = 'quarterly' THEN
            -- Quarterly: months 1,4,7,10
            IF v_target_month IN (1,4,7,10) THEN
                v_category_expected := v_category.amount;
            ELSE
                v_category_expected := 0;
            END IF;
        ELSE
            v_category_expected := 0;
        END IF;
        
        -- Skip if no expected amount
        IF v_category_expected = 0 THEN
            CONTINUE;
        END IF;
        
        -- Get total paid for this category up to target month
        SELECT COALESCE(SUM(pa.amount), 0) INTO v_category_paid
        FROM public.payment_allocations pa
        JOIN public.fee_payments fp ON fp.id = pa.payment_id
        WHERE fp.student_id = p_student_id
            AND pa.category_id = v_category.category_id
            AND pa.month <= p_target_month
            AND fp.status != 'cancelled';
        
        -- Calculate due
        v_category_due := GREATEST(0, v_category_expected - v_category_paid);
        
        -- Insert or update student_fee_dues
        INSERT INTO public.student_fee_dues (
            student_id,
            category_id,
            academic_year_id,
            month,
            expected_amount,
            paid_amount,
            due_amount,
            due_date,
            is_advance,
            status,
            created_at,
            updated_at
        ) VALUES (
            p_student_id,
            v_category.category_id,
            p_academic_year_id,
            p_target_month,
            v_category_expected,
            v_category_paid,
            v_category_due,
            v_target_date + (v_category.due_day - 1)::INT,
            v_is_advance,
            CASE 
                WHEN v_category_due <= 0 THEN 'paid'
                WHEN v_category_paid > 0 THEN 'partial'
                ELSE 'pending'
            END,
            NOW(),
            NOW()
        )
        ON CONFLICT (student_id, category_id, month, academic_year_id) DO UPDATE SET
            expected_amount = EXCLUDED.expected_amount,
            paid_amount = EXCLUDED.paid_amount,
            due_amount = EXCLUDED.due_amount,
            due_date = EXCLUDED.due_date,
            is_advance = EXCLUDED.is_advance,
            status = EXCLUDED.status,
            updated_at = NOW();
        
        -- Accumulate totals
        v_total_expected := v_total_expected + v_category_expected;
        v_total_paid := v_total_paid + v_category_paid;
        v_total_due := v_total_due + v_category_due;
    END LOOP;
    
    -- Return summary
    RETURN QUERY SELECT 
        p_target_month,
        v_total_expected,
        v_total_paid,
        v_total_due,
        v_is_advance;
END;
$$;


ALTER FUNCTION "public"."calculate_monthly_fee_due"("p_student_id" "uuid", "p_academic_year_id" "uuid", "p_target_month" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_positions"("p_term_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Class rank (only passed students - using result_status and gpa)
    WITH ranked AS (
        SELECT 
            cr.id,
            ROW_NUMBER() OVER (PARTITION BY s.class_id ORDER BY cr.gpa DESC, cr.total_marks_obtained DESC) as rank
        FROM compiled_results cr
        JOIN students s ON s.id = cr.student_id
        WHERE cr.term_id = p_term_id
          AND cr.gpa >= 1.0  -- Consider GPA >= 1 as passed
          AND cr.result_status IN ('generated', 'published')
    )
    UPDATE compiled_results cr
    SET class_rank = r.rank
    FROM ranked r
    WHERE cr.id = r.id;
    
    -- Section rank
    WITH ranked AS (
        SELECT 
            cr.id,
            ROW_NUMBER() OVER (PARTITION BY s.section_id ORDER BY cr.gpa DESC, cr.total_marks_obtained DESC) as rank
        FROM compiled_results cr
        JOIN students s ON s.id = cr.student_id
        WHERE cr.term_id = p_term_id
          AND cr.gpa >= 1.0
          AND cr.result_status IN ('generated', 'published')
          AND s.section_id IS NOT NULL
    )
    UPDATE compiled_results cr
    SET section_rank = r.rank
    FROM ranked r
    WHERE cr.id = r.id;
    
    -- Merit position (overall)
    WITH ranked AS (
        SELECT 
            id,
            ROW_NUMBER() OVER (ORDER BY gpa DESC, total_marks_obtained DESC) as pos
        FROM compiled_results
        WHERE term_id = p_term_id
          AND gpa >= 1.0
          AND result_status IN ('generated', 'published')
    )
    UPDATE compiled_results cr
    SET merit_position = r.pos
    FROM ranked r
    WHERE cr.id = r.id;
END;
$$;


ALTER FUNCTION "public"."calculate_positions"("p_term_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_staff_salary"("p_staff_id" "uuid") RETURNS TABLE("basic_salary" numeric, "house_rent" numeric, "medical_allowance" numeric, "conveyance_allowance" numeric, "other_allowances" numeric, "total_allowances" numeric, "total_deductions" numeric, "net_salary" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_basic NUMERIC := 0;
  v_hr NUMERIC := 0;
  v_med NUMERIC := 0;
  v_conv NUMERIC := 0;
  v_other NUMERIC := 0;
  v_ded NUMERIC := 0;
  v_total_allow NUMERIC := 0;
  v_net NUMERIC := 0;
BEGIN
  -- Primary: use staff_salaries
  SELECT 
    COALESCE(ss.basic, 0),
    COALESCE(ss.hra, 0),
    COALESCE(ss.allowances, 0),
    0,
    COALESCE(ss.personal_allowance, 0) + COALESCE(ss.special_allowance, 0),
    COALESCE(ss.other_deductions, 0)
  INTO v_basic, v_hr, v_med, v_conv, v_other, v_ded
  FROM public.staff_salaries ss
  WHERE ss.staff_id = p_staff_id AND ss.is_current = true
  LIMIT 1;

  -- Fallback: salary_categories
  IF v_basic = 0 THEN
    SELECT 
      COALESCE(sc.basic, 0),
      COALESCE(sc.hra, 0),
      COALESCE(sc.da, 0),
      0,
      COALESCE(sc.allowances, 0),
      COALESCE(sc.deductions, 0)
    INTO v_basic, v_hr, v_med, v_conv, v_other, v_ded
    FROM public.staff st
    LEFT JOIN public.salary_categories sc ON sc.id = st.salary_category_id
    WHERE st.id = p_staff_id
    LIMIT 1;
  END IF;

  v_total_allow := v_hr + v_med + v_conv + v_other;
  v_net := (v_basic + v_total_allow) - v_ded;

  RETURN QUERY SELECT 
    v_basic, v_hr, v_med, v_conv, v_other, v_total_allow, v_ded, GREATEST(v_net, 0);
END;
$$;


ALTER FUNCTION "public"."calculate_staff_salary"("p_staff_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_staff_salary"("p_staff_id" "uuid", "p_date" "date" DEFAULT CURRENT_DATE) RETURNS TABLE("total" numeric, "components" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_salary RECORD;
  v_components JSONB;
BEGIN
  SELECT * INTO v_salary
  FROM staff_salaries
  WHERE staff_id = p_staff_id
    AND effective_from <= p_date
    AND (effective_to IS NULL OR effective_to >= p_date)
  ORDER BY effective_from DESC
  LIMIT 1;

  IF v_salary IS NULL THEN
    SELECT 
      sc.basic, sc.hra, sc.da, sc.allowances,
      0 AS personal_allowance, 0 AS special_allowance,
      sc.deductions AS other_deductions,
      COALESCE(sc.basic, 0) + COALESCE(sc.hra, 0) + COALESCE(sc.da, 0) + 
      COALESCE(sc.allowances, 0) - COALESCE(sc.deductions, 0) AS total_salary
    INTO v_salary
    FROM staff s
    LEFT JOIN salary_categories sc ON sc.id = s.salary_category_id
    WHERE s.id = p_staff_id;

    IF v_salary IS NULL THEN
      RETURN QUERY SELECT 0::DECIMAL, '{}'::JSONB;
      RETURN;
    END IF;
  END IF;

  v_components = JSONB_BUILD_OBJECT(
    'basic', COALESCE(v_salary.basic, 0),
    'hra', COALESCE(v_salary.hra, 0),
    'da', COALESCE(v_salary.da, 0),
    'allowances', COALESCE(v_salary.allowances, 0),
    'personal_allowance', COALESCE(v_salary.personal_allowance, 0),
    'special_allowance', COALESCE(v_salary.special_allowance, 0),
    'other_deductions', COALESCE(v_salary.other_deductions, 0)
  );

  RETURN QUERY SELECT 
    COALESCE(v_salary.total_salary, 0) AS total,
    v_components;
END;
$$;


ALTER FUNCTION "public"."calculate_staff_salary"("p_staff_id" "uuid", "p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_staff_salary"("p_staff_id" "uuid", "p_month" integer, "p_year" integer) RETURNS TABLE("basic_salary" numeric, "house_rent" numeric, "medical_allowance" numeric, "conveyance" numeric, "total_allowance" numeric, "total_deduction" numeric, "net_salary" numeric, "joining_date" "date", "resign_date" "date", "days_in_month" integer, "days_worked" integer, "is_pro_rata" boolean, "is_blocked" boolean, "block_reason" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_basic NUMERIC := 0;
  v_hr NUMERIC := 0;
  v_med NUMERIC := 0;
  v_conv NUMERIC := 0;
  v_tot_allow NUMERIC := 0;
  v_tot_ded NUMERIC := 0;
  v_net NUMERIC := 0;
  v_join_date date;
  v_resign date;
  v_month_start date;
  v_month_end date;
  v_days_in_month integer;
  v_days_worked integer := 0;
  v_effective_start date;
  v_effective_end date;
  v_is_pro_rata boolean := false;
  v_is_blocked boolean := false;
  v_block_reason text := null;
  v_ratio numeric;
BEGIN
  -- STEP 1: Salary components
  SELECT 
    COALESCE(ss.basic, 0),
    COALESCE(ss.hra, 0),
    COALESCE(ss.allowances, 0),
    COALESCE(ss.other_deductions, 0)
  INTO v_basic, v_hr, v_med, v_tot_ded
  FROM public.staff st
  LEFT JOIN public.staff_salaries ss ON ss.staff_id = st.id AND ss.is_current = TRUE
  WHERE st.id = p_staff_id
  LIMIT 1;

  IF v_basic = 0 THEN
    SELECT 
      COALESCE(sc.basic, 0),
      COALESCE(sc.hra, 0),
      COALESCE(sc.allowances, 0),
      COALESCE(sc.deductions, 0)
    INTO v_basic, v_hr, v_med, v_tot_ded
    FROM public.staff st
    LEFT JOIN public.salary_categories sc ON sc.id = st.salary_category_id
    WHERE st.id = p_staff_id
    LIMIT 1;
  END IF;

  v_tot_allow := v_hr + v_med;
  v_net := (v_basic + v_tot_allow) - v_tot_ded;

  -- STEP 2: Get joining/resign dates — ✅ FIX: table alias `s`
  SELECT 
    s.joining_date, 
    s.resign_date
  INTO v_join_date, v_resign
  FROM public.staff s
  WHERE s.id = p_staff_id;

  -- STEP 3: Month boundaries
  v_month_start := make_date(p_year, p_month, 1);
  v_month_end := (v_month_start + INTERVAL '1 month' - INTERVAL '1 day')::date;
  v_days_in_month := EXTRACT(DAY FROM v_month_end)::integer;

  -- STEP 4: Business rule validation
  IF v_join_date IS NULL THEN
    v_is_blocked := true;
    v_block_reason := 'joining_date_not_set';
  ELSIF v_month_end < v_join_date THEN
    v_is_blocked := true;
    v_block_reason := 'month_before_joining';
  END IF;

  IF NOT v_is_blocked 
     AND v_resign IS NOT NULL 
     AND v_month_start > v_resign THEN
    v_is_blocked := true;
    v_block_reason := 'month_after_resign';
  END IF;

  IF v_is_blocked THEN
    RETURN QUERY SELECT 
      0::numeric, 0::numeric, 0::numeric, 0::numeric,
      0::numeric, 0::numeric, 0::numeric,
      v_join_date, v_resign,
      v_days_in_month, 0,
      false, true, v_block_reason;
    RETURN;
  END IF;

  -- STEP 5: Pro-rata
  v_effective_start := v_month_start;
  v_effective_end := v_month_end;

  IF v_join_date > v_month_start THEN
    v_effective_start := v_join_date;
    v_is_pro_rata := true;
  END IF;

  IF v_resign IS NOT NULL AND v_resign < v_month_end THEN
    v_effective_end := v_resign;
    v_is_pro_rata := true;
  END IF;

  v_days_worked := (v_effective_end - v_effective_start)::integer + 1;
  IF v_days_worked < 0 THEN v_days_worked := 0; END IF;

  IF v_is_pro_rata AND v_days_worked < v_days_in_month THEN
    v_ratio := v_days_worked::numeric / v_days_in_month::numeric;
    v_basic := ROUND(v_basic * v_ratio, 2);
    v_hr := ROUND(v_hr * v_ratio, 2);
    v_med := ROUND(v_med * v_ratio, 2);
    v_conv := 0;
    v_tot_allow := ROUND(v_tot_allow * v_ratio, 2);
    v_tot_ded := ROUND(v_tot_ded * v_ratio, 2);
    v_net := ROUND(v_net * v_ratio, 2);
  END IF;

  -- STEP 6: Return
  RETURN QUERY SELECT 
    v_basic, v_hr, v_med, v_conv, v_tot_allow, v_tot_ded,
    GREATEST(v_net, 0),
    v_join_date, v_resign,
    v_days_in_month, v_days_worked,
    v_is_pro_rata, false, null::text;
END;
$$;


ALTER FUNCTION "public"."calculate_staff_salary"("p_staff_id" "uuid", "p_month" integer, "p_year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."carry_forward_due"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_current_academic_year RECORD;
    v_next_academic_year RECORD;
    v_student RECORD;
    v_due_amount NUMERIC;
BEGIN
    -- বর্তমান শিক্ষাবর্ষ বের করা
    SELECT * INTO v_current_academic_year
    FROM public.academic_years
    WHERE is_current = true
    LIMIT 1;
    
    IF v_current_academic_year IS NULL THEN
        RAISE EXCEPTION 'কোনো বর্তমান শিক্ষাবর্ষ খুঁজে পাওয়া যায়নি!';
    END IF;
    
    -- পরবর্তী শিক্ষাবর্ষ বের করা (যার start_date বর্তমানের end_date এর পরে)
    SELECT * INTO v_next_academic_year
    FROM public.academic_years
    WHERE start_date > v_current_academic_year.end_date
    ORDER BY start_date ASC
    LIMIT 1;
    
    IF v_next_academic_year IS NULL THEN
        RAISE NOTICE 'পরবর্তী শিক্ষাবর্ষ খুঁজে পাওয়া যায়নি!';
        RETURN;
    END IF;
    
    -- প্রতিটি সক্রিয় শিক্ষার্থীর জন্য বকেয়া ক্যারি ফরওয়ার্ড করা
    FOR v_student IN
        SELECT DISTINCT ft.student_id, 
               COALESCE(SUM(ft.due_amount), 0) AS total_due
        FROM public.fee_transactions ft
        JOIN public.fee_student_assignments fsa 
            ON fsa.student_id = ft.student_id 
            AND fsa.academic_year_id = v_current_academic_year.id
            AND fsa.is_active = true
        WHERE ft.due_amount > 0
          AND ft.status != 'cancelled'
        GROUP BY ft.student_id
        HAVING COALESCE(SUM(ft.due_amount), 0) > 0
    LOOP
        v_due_amount := v_student.total_due;
        
        -- পরবর্তী শিক্ষাবর্ষের জন্য একটি বিশেষ ইনভয়েস তৈরি করা (বকেয়া হিসেবে)
        INSERT INTO public.fee_invoices (
            student_id,
            academic_year_id,
            month,
            amount,
            discount_amount,
            fine_amount,
            total,
            paid_amount,
            due_amount,
            status,
            due_date,
            created_at,
            updated_at
        ) VALUES (
            v_student.student_id,
            v_next_academic_year.id,
            0,  -- 0 মানে বকেয়া ক্যারি ফরওয়ার্ড
            v_due_amount,
            0,
            0,
            v_due_amount,
            0,
            v_due_amount,
            'pending',
            v_next_academic_year.start_date + INTERVAL '15 days',
            NOW(),
            NOW()
        );
        
        -- লগ এন্ট্রি (ঐচ্ছিক)
        INSERT INTO public.migration_log (
            migration_name,
            status,
            details
        ) VALUES (
            'carry_forward_due',
            'success',
            format('Student %s: Due %s carried forward from %s to %s', 
                   v_student.student_id, v_due_amount, 
                   v_current_academic_year.year_name, 
                   v_next_academic_year.year_name)
        );
    END LOOP;
    
    RAISE NOTICE 'বকেয়া ক্যারি ফরওয়ার্ড সম্পন্ন হয়েছে!';
END;
$$;


ALTER FUNCTION "public"."carry_forward_due"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_balance_sheet_account"("p_account_name" character varying, "p_account_category" character varying, "p_opening_balance" numeric DEFAULT 0, "p_account_number" character varying DEFAULT NULL::character varying, "p_bank_name" character varying DEFAULT NULL::character varying, "p_branch_name" character varying DEFAULT NULL::character varying, "p_notes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_new_id uuid;
  v_subtype varchar(20);
BEGIN
  -- ─── Validation ─────────────────────────────────────────────
  IF p_account_name IS NULL OR TRIM(p_account_name) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Account name is required'
    );
  END IF;

  IF p_account_category NOT IN (
    'asset', 'fixed_asset', 'current_asset',
    'liability', 'payable', 'loan',
    'equity', 'capital', 'drawing'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid account_category. Allowed: asset, fixed_asset, current_asset, liability, payable, loan, equity, capital, drawing'
    );
  END IF;

  -- ─── Duplicate check ────────────────────────────────────────
  IF EXISTS (
    SELECT 1 FROM public.financial_accounts
    WHERE LOWER(account_name) = LOWER(TRIM(p_account_name))
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Account already exists with this name'
    );
  END IF;

  -- ─── type constraint bypass: সবসময় 'cash' সেট করব ──────────
  -- আসল classification থাকবে account_category-তে
  v_subtype := 'cash';

  -- ─── Insert ─────────────────────────────────────────────────
  INSERT INTO public.financial_accounts (
    account_name,
    account_number,
    type,
    bank_name,
    branch_name,
    current_balance,
    is_active,
    account_category,
    is_balance_sheet,
    updated_at
  ) VALUES (
    TRIM(p_account_name),
    p_account_number,
    v_subtype,
    p_bank_name,
    p_branch_name,
    COALESCE(p_opening_balance, 0),
    true,
    p_account_category,
    true,
    NOW()
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_new_id,
    'account_name', p_account_name,
    'account_category', p_account_category,
    'opening_balance', p_opening_balance,
    'message', 'Balance Sheet account created successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;


ALTER FUNCTION "public"."create_balance_sheet_account"("p_account_name" character varying, "p_account_category" character varying, "p_opening_balance" numeric, "p_account_number" character varying, "p_bank_name" character varying, "p_branch_name" character varying, "p_notes" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_balance_sheet_account"("p_account_name" character varying, "p_account_category" character varying, "p_opening_balance" numeric, "p_account_number" character varying, "p_bank_name" character varying, "p_branch_name" character varying, "p_notes" "text") IS 'Create a new Balance Sheet account (fixed_asset, liability, equity) without touching type constraint';



CREATE OR REPLACE FUNCTION "public"."create_inventory_issuance"("p_issued_to_type" "text", "p_issued_to_id" "uuid", "p_issued_to_name" "text", "p_items" "jsonb", "p_purpose" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_issuance_id UUID;
    v_issue_no TEXT;
    v_item JSONB;
    v_item_id UUID;
    v_quantity NUMERIC;
    v_affected INTEGER;
    v_current_stock NUMERIC;
    v_total_quantity NUMERIC := 0;
    v_unit TEXT;
    v_item_type TEXT;
    v_first_item_id UUID;
BEGIN
    -- Validate recipient type
    IF p_issued_to_type NOT IN ('staff', 'student') THEN
        RAISE EXCEPTION 'INVALID_RECIPIENT: Issued to type must be staff or student';
    END IF;

    -- Validate items
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'NO_ITEMS: At least one item is required';
    END IF;

    -- Get first item details
    v_first_item_id := (p_items->0->>'item_id')::UUID;
    
    -- Get item details
    SELECT item_type, unit INTO v_item_type, v_unit
    FROM public.inventory_items
    WHERE id = v_first_item_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'INVALID_ITEM: Item not found';
    END IF;

    -- Validate stock for all items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := (v_item->>'item_id')::UUID;
        v_quantity := (v_item->>'quantity')::NUMERIC;

        IF v_quantity IS NULL OR v_quantity <= 0 THEN
            RAISE EXCEPTION 'INVALID_QUANTITY: Quantity must be positive for item %', v_item_id;
        END IF;

        SELECT current_stock INTO v_current_stock
        FROM public.inventory_items
        WHERE id = v_item_id AND is_active = true
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'INVALID_ITEM: Item not found or inactive';
        END IF;

        IF v_current_stock < v_quantity THEN
            RAISE EXCEPTION 'INSUFFICIENT_STOCK: Item has % available, but % requested', 
                v_current_stock, v_quantity;
        END IF;

        v_total_quantity := v_total_quantity + v_quantity;
    END LOOP;

    -- Generate issuance number
    v_issuance_id := gen_random_uuid();
    v_issue_no := 'ISS-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || 
                  LPAD(floor(random() * 9999)::TEXT, 4, '0');

    -- Insert issuance header
    INSERT INTO public.inventory_issuances (
        id,
        issue_no,
        issuance_no,
        item_id,
        item_type,
        issued_to_type,
        issued_to_id,
        issued_to_name,
        quantity,
        unit,
        issuance_date,
        purpose,
        status,
        created_at
    ) VALUES (
        v_issuance_id,
        v_issue_no,
        v_issue_no,
        v_first_item_id,
        v_item_type,
        p_issued_to_type,
        p_issued_to_id,
        p_issued_to_name,
        v_total_quantity,
        v_unit,
        CURRENT_DATE,
        p_purpose,
        'issued',
        NOW()
    );

    -- Insert issuance items and update stock
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := (v_item->>'item_id')::UUID;
        v_quantity := (v_item->>'quantity')::NUMERIC;

        -- Insert issuance item
        INSERT INTO public.inventory_issuance_items (
            issuance_id,
            item_id,
            quantity,
            created_at
        ) VALUES (
            v_issuance_id,
            v_item_id,
            v_quantity,
            NOW()
        );

        -- Update stock
        UPDATE public.inventory_items
        SET current_stock = current_stock - v_quantity
        WHERE id = v_item_id AND current_stock >= v_quantity;

        GET DIAGNOSTICS v_affected = ROW_COUNT;
        IF v_affected = 0 THEN
            RAISE EXCEPTION 'INSUFFICIENT_STOCK: Item has insufficient stock';
        END IF;
    END LOOP;

    -- Return success response
    RETURN jsonb_build_object(
        'success', true,
        'issuance_id', v_issuance_id::TEXT,
        'issue_no', v_issue_no,
        'message', 'Issuance created successfully'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'message', 'Failed to create issuance'
        );
END;
$$;


ALTER FUNCTION "public"."create_inventory_issuance"("p_issued_to_type" "text", "p_issued_to_id" "uuid", "p_issued_to_name" "text", "p_items" "jsonb", "p_purpose" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_inventory_purchase"("p_supplier_id" "uuid", "p_purchase_date" "date", "p_narration" "text", "p_items" "jsonb", "p_status" "text" DEFAULT 'received'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_purchase_id UUID;
  v_total_amount NUMERIC(12,2) := 0;
  v_item JSONB;
  v_item_id UUID;
  v_quantity NUMERIC;
  v_unit_price NUMERIC;
  v_total_price NUMERIC;
BEGIN
  -- Validate supplier
  IF p_supplier_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_SUPPLIER: Supplier ID is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.inventory_suppliers
    WHERE id = p_supplier_id
  ) THEN
    RAISE EXCEPTION 'INVALID_SUPPLIER: Supplier not found';
  END IF;

  -- Validate items
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'NO_ITEMS: At least one item is required';
  END IF;

  -- Generate purchase ID
  v_purchase_id := gen_random_uuid();

  -- Validate items and calculate total
  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items)
  LOOP

    v_item_id := (v_item->>'item_id')::UUID;
    v_quantity := (v_item->>'quantity')::NUMERIC;
    v_unit_price := (v_item->>'purchase_price')::NUMERIC;

    IF NOT EXISTS (
      SELECT 1
      FROM public.inventory_items
      WHERE id = v_item_id
        AND is_active = true
    ) THEN
      RAISE EXCEPTION 'INVALID_ITEM: Item not found or inactive';
    END IF;

    IF v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION
        'INVALID_QUANTITY: Quantity must be positive for item %',
        v_item_id;
    END IF;

    IF v_unit_price IS NULL OR v_unit_price < 0 THEN
      RAISE EXCEPTION
        'INVALID_PRICE: Purchase price cannot be negative for item %',
        v_item_id;
    END IF;

    v_total_price := v_quantity * v_unit_price;
    v_total_amount := v_total_amount + v_total_price;

  END LOOP;

  -- Insert purchase header
  INSERT INTO public.inventory_purchases (
    id,
    purchase_no,
    supplier_id,
    purchase_date,
    narration,
    total_amount,
    status,
    created_at
  )
  VALUES (
    v_purchase_id,
    'PUR-' ||
      to_char(p_purchase_date, 'YYYYMMDD') ||
      '-' ||
      floor(random() * 1000)::TEXT,
    p_supplier_id,
    p_purchase_date,
    p_narration,
    v_total_amount,
    p_status,
    NOW()
  );

  -- Insert purchase items + increase stock
  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items)
  LOOP

    v_item_id := (v_item->>'item_id')::UUID;
    v_quantity := (v_item->>'quantity')::NUMERIC;
    v_unit_price := (v_item->>'purchase_price')::NUMERIC;
    v_total_price := v_quantity * v_unit_price;

    -- IMPORTANT:
    -- Database column is unit_price, not purchase_price
    INSERT INTO public.inventory_purchase_items (
      purchase_id,
      item_id,
      quantity,
      unit_price,
      total_price,
      created_at
    )
    VALUES (
      v_purchase_id,
      v_item_id,
      v_quantity,
      v_unit_price,
      v_total_price,
      NOW()
    );

    -- Increase stock
    UPDATE public.inventory_items
    SET current_stock = current_stock + v_quantity
    WHERE id = v_item_id;

  END LOOP;

  -- Update supplier due
  UPDATE public.inventory_suppliers
  SET current_due = current_due + v_total_amount
  WHERE id = p_supplier_id;

  RETURN jsonb_build_object(
    'success', true,
    'purchase_id', v_purchase_id::TEXT,
    'total_amount', v_total_amount
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '%', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."create_inventory_purchase"("p_supplier_id" "uuid", "p_purchase_date" "date", "p_narration" "text", "p_items" "jsonb", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_inventory_sale"("p_student_id" "uuid", "p_sale_date" "date", "p_narration" "text", "p_items" "jsonb", "p_status" "text" DEFAULT 'completed'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_sale_id UUID;
  v_total_amount NUMERIC(12,2) := 0;

  v_item JSONB;
  v_item_id UUID;
  v_quantity NUMERIC;
  v_unit_price NUMERIC;
  v_total_price NUMERIC;

  v_affected INTEGER;
  v_current_stock NUMERIC;
BEGIN

  -- ==========================================================
  -- Validate student
  -- ==========================================================

  IF p_student_id IS NULL THEN
    RAISE EXCEPTION
      'INVALID_STUDENT: Student ID is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.students
    WHERE id = p_student_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION
      'INVALID_STUDENT: Student not found or not active';
  END IF;

  -- ==========================================================
  -- Validate items
  -- ==========================================================

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION
      'NO_ITEMS: At least one item is required';
  END IF;

  v_sale_id := gen_random_uuid();

  -- ==========================================================
  -- Calculate total + validate stock
  -- ==========================================================

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items)
  LOOP

    v_item_id := (v_item->>'item_id')::UUID;
    v_quantity := (v_item->>'quantity')::NUMERIC;
    v_unit_price := (v_item->>'selling_price')::NUMERIC;

    IF v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION
        'INVALID_QUANTITY: Quantity must be positive for item %',
        v_item_id;
    END IF;

    IF v_unit_price IS NULL OR v_unit_price < 0 THEN
      RAISE EXCEPTION
        'INVALID_PRICE: Selling price cannot be negative for item %',
        v_item_id;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.inventory_items
      WHERE id = v_item_id
        AND item_type = 'saleable'
        AND is_active = true
    ) THEN
      RAISE EXCEPTION
        'INVALID_ITEM: Item not found, not saleable, or inactive';
    END IF;

    SELECT current_stock
    INTO v_current_stock
    FROM public.inventory_items
    WHERE id = v_item_id
    FOR UPDATE;

    IF v_current_stock < v_quantity THEN
      RAISE EXCEPTION
        'INSUFFICIENT_STOCK: Item % has % available, but % requested',
        v_item_id,
        v_current_stock,
        v_quantity;
    END IF;

    v_total_price := v_quantity * v_unit_price;
    v_total_amount := v_total_amount + v_total_price;

  END LOOP;

  -- ==========================================================
  -- Insert sale header
  -- ==========================================================

  INSERT INTO public.inventory_sales (
    id,
    invoice_no,
    sale_no,
    student_id,
    sale_date,
    subtotal,
    discount,
    net_amount,
    paid_amount,
    due_amount,
    status,
    narration,
    created_at
  )
  VALUES (
    v_sale_id,

    'INV-' ||
      to_char(p_sale_date, 'YYYYMMDD') ||
      '-' ||
      floor(random() * 1000)::TEXT,

    'SAL-' ||
      to_char(p_sale_date, 'YYYYMMDD') ||
      '-' ||
      floor(random() * 1000)::TEXT,

    p_student_id,
    p_sale_date,
    v_total_amount,
    0,
    v_total_amount,
    0,
    0,
    p_status,
    p_narration,
    NOW()
  );

  -- ==========================================================
  -- Insert sale items + atomic stock deduction
  -- ==========================================================

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items)
  LOOP

    v_item_id := (v_item->>'item_id')::UUID;
    v_quantity := (v_item->>'quantity')::NUMERIC;
    v_unit_price := (v_item->>'selling_price')::NUMERIC;

    v_total_price := v_quantity * v_unit_price;

    INSERT INTO public.inventory_sale_items (
      sale_id,
      item_id,
      quantity,
      unit_price,
      total_price,
      created_at
    )
    VALUES (
      v_sale_id,
      v_item_id,
      v_quantity,
      v_unit_price,
      v_total_price,
      NOW()
    );

    UPDATE public.inventory_items
    SET current_stock = current_stock - v_quantity
    WHERE id = v_item_id
      AND current_stock >= v_quantity;

    GET DIAGNOSTICS v_affected = ROW_COUNT;

    IF v_affected = 0 THEN
      RAISE EXCEPTION
        'INSUFFICIENT_STOCK: Item % has insufficient stock',
        v_item_id;
    END IF;

  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'sale_id', v_sale_id::TEXT,
    'net_amount', v_total_amount
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '%', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."create_inventory_sale"("p_student_id" "uuid", "p_sale_date" "date", "p_narration" "text", "p_items" "jsonb", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_leave_balance_on_staff_create"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    INSERT INTO public.leave_balances (staff_id, category_name, total_days, used_days, remaining_days)
    SELECT NEW.id, name, days_per_year, 0, days_per_year
    FROM public.leave_categories;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_leave_balance_on_staff_create"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_sale_and_restore_stock"("p_sale_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_sale_items RECORD;
  v_total_restored INTEGER := 0;
BEGIN
  FOR v_sale_items IN 
    SELECT item_id, quantity 
    FROM public.inventory_sale_items 
    WHERE sale_id = p_sale_id
  LOOP
    UPDATE public.inventory_items
    SET current_stock = current_stock + v_sale_items.quantity
    WHERE id = v_sale_items.item_id;
    
    v_total_restored := v_total_restored + 1;
  END LOOP;
  
  DELETE FROM public.inventory_sale_items WHERE sale_id = p_sale_id;
  DELETE FROM public.inventory_sales WHERE id = p_sale_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Sale deleted and stock restored',
    'items_restored', v_total_restored
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


ALTER FUNCTION "public"."delete_sale_and_restore_stock"("p_sale_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dev_backfill_salary_balances"("p_year" integer, "p_up_to_month" integer DEFAULT 12) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_month int;
  v_month_str text;
  v_r record;
  v_calc record;
  v_created int := 0;
  v_skipped int := 0;
BEGIN
  FOR v_month IN 1..p_up_to_month LOOP
    v_month_str := CASE v_month
      WHEN 1 THEN 'January'   WHEN 2 THEN 'February'
      WHEN 3 THEN 'March'     WHEN 4 THEN 'April'
      WHEN 5 THEN 'May'       WHEN 6 THEN 'June'
      WHEN 7 THEN 'July'      WHEN 8 THEN 'August'
      WHEN 9 THEN 'September' WHEN 10 THEN 'October'
      WHEN 11 THEN 'November' WHEN 12 THEN 'December'
    END;

    FOR v_r IN
      SELECT id FROM public.staff
      WHERE status IN ('active', 'on_leave')
        AND salary_category_id IS NOT NULL
    LOOP
      -- Skip if exists
      IF EXISTS (
        SELECT 1 FROM public.salary_balances
        WHERE staff_id = v_r.id 
          AND month = v_month_str 
          AND year = p_year
      ) THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      -- Calculate
      SELECT * INTO v_calc
      FROM public.calculate_staff_salary(v_r.id, v_month, p_year);

      IF v_calc.is_blocked THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      INSERT INTO public.salary_balances (
        staff_id, month, year, expected_salary,
        paid_amount, due_amount, balance, status, due_date
      ) VALUES (
        v_r.id, v_month_str, p_year, v_calc.net_salary,
        0, v_calc.net_salary, v_calc.net_salary, 'pending',
        (make_date(p_year, v_month, 1) + INTERVAL '1 month')::date
      );

      v_created := v_created + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'year', p_year,
    'up_to_month', p_up_to_month,
    'created', v_created,
    'skipped', v_skipped
  );
END;
$$;


ALTER FUNCTION "public"."dev_backfill_salary_balances"("p_year" integer, "p_up_to_month" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dev_generate_oct_2026"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_r record;
  v_calc record;
  v_prev_advance numeric := 0;
  v_net numeric;
  v_created int := 0;
BEGIN
  FOR v_r IN
    SELECT id, name FROM staff 
    WHERE status IN ('active', 'on_leave') 
      AND salary_category_id IS NOT NULL
  LOOP
    IF EXISTS (
      SELECT 1 FROM salary_balances 
      WHERE staff_id = v_r.id AND month = 'October' AND year = 2026
    ) THEN
      CONTINUE;
    END IF;

    SELECT * INTO v_calc FROM calculate_staff_salary(v_r.id, 10, 2026);
    
    IF v_calc.is_blocked THEN CONTINUE; END IF;

    -- Check for advance from Sep
    SELECT COALESCE(SUM(paid_amount - expected_salary), 0)
    INTO v_prev_advance
    FROM salary_balances
    WHERE staff_id = v_r.id
      AND paid_amount > expected_salary
      AND year = 2026
      AND CASE month
        WHEN 'January' THEN 1 WHEN 'February' THEN 2
        WHEN 'March' THEN 3 WHEN 'April' THEN 4
        WHEN 'May' THEN 5 WHEN 'June' THEN 6
        WHEN 'July' THEN 7 WHEN 'August' THEN 8
        WHEN 'September' THEN 9
        ELSE 0
      END < 10;

    v_net := GREATEST(0, v_calc.net_salary - v_prev_advance);

    INSERT INTO salary_balances (
      staff_id, month, year, expected_salary, paid_amount,
      due_amount, balance, status, due_date
    ) VALUES (
      v_r.id, 'October', 2026, v_net, 0, v_net, v_net,
      'pending', '2026-11-01'
    );
    v_created := v_created + 1;
  END LOOP;

  RETURN jsonb_build_object('created', v_created);
END;
$$;


ALTER FUNCTION "public"."dev_generate_oct_2026"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dev_reset_salary_test_data"("p_from_year" integer DEFAULT 2026) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_payments_deleted int := 0;
  v_balances_deleted int := 0;
  v_finance_deleted int := 0;
BEGIN
  -- ✅ Use source_type/source_id (existing columns)
  DELETE FROM public.finance_transactions 
  WHERE source_type = 'salary_payment'
    AND date >= make_date(p_from_year, 1, 1);
  GET DIAGNOSTICS v_finance_deleted = ROW_COUNT;
  
  -- Delete salary payments (trigger auto-handles finance cleanup + balance reset)
  DELETE FROM public.salary_payments 
  WHERE year >= p_from_year;
  GET DIAGNOSTICS v_payments_deleted = ROW_COUNT;
  
  -- Delete salary balances (they'll regenerate on next auto-gen)
  DELETE FROM public.salary_balances 
  WHERE year >= p_from_year;
  GET DIAGNOSTICS v_balances_deleted = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'from_year', p_from_year,
    'finance_deleted', v_finance_deleted,
    'payments_deleted', v_payments_deleted,
    'balances_deleted', v_balances_deleted
  );
END;
$$;


ALTER FUNCTION "public"."dev_reset_salary_test_data"("p_from_year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."edit_inventory_purchase"("p_purchase_id" "uuid", "p_supplier_id" "uuid", "p_purchase_date" "text", "p_narration" "text", "p_status" "text", "p_items" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_total_amount NUMERIC(12,2) := 0;
    v_item JSONB;
    v_item_id UUID;
    v_quantity NUMERIC;
    v_unit_price NUMERIC;
    v_total_price NUMERIC;
    v_purchase_date DATE;
BEGIN
    -- Convert text to date
    v_purchase_date := p_purchase_date::DATE;
    
    -- Validate supplier
    IF NOT EXISTS (SELECT 1 FROM public.inventory_suppliers WHERE id = p_supplier_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Supplier not found');
    END IF;
    
    -- Validate items
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No items provided');
    END IF;
    
    -- Delete existing purchase items
    DELETE FROM public.inventory_purchase_items WHERE purchase_id = p_purchase_id;
    
    -- Process items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := (v_item->>'item_id')::UUID;
        v_quantity := (v_item->>'quantity')::NUMERIC;
        v_unit_price := (v_item->>'unit_price')::NUMERIC;
        
        IF v_unit_price IS NULL THEN
            v_unit_price := (v_item->>'purchase_price')::NUMERIC;
        END IF;
        
        IF v_quantity <= 0 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Invalid quantity');
        END IF;
        
        v_total_price := v_quantity * v_unit_price;
        v_total_amount := v_total_amount + v_total_price;
        
        INSERT INTO public.inventory_purchase_items (
            purchase_id, item_id, quantity, unit_price, total_price, created_at
        ) VALUES (
            p_purchase_id, v_item_id, v_quantity, v_unit_price, v_total_price, NOW()
        );
    END LOOP;
    
    -- Update purchase header
    UPDATE public.inventory_purchases
    SET 
        supplier_id = p_supplier_id,
        purchase_date = v_purchase_date,
        narration = p_narration,
        status = p_status,
        total_amount = v_total_amount,
        updated_at = NOW()
    WHERE id = p_purchase_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'purchase_id', p_purchase_id::TEXT,
        'total_amount', v_total_amount
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


ALTER FUNCTION "public"."edit_inventory_purchase"("p_purchase_id" "uuid", "p_supplier_id" "uuid", "p_purchase_date" "text", "p_narration" "text", "p_status" "text", "p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fee_structure_version_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO fee_structure_versions (structure_id, version, name, categories, description, created_by, created_at)
  VALUES (NEW.id, NEW.version, NEW.name, NEW.categories, NEW.description, COALESCE(NEW.created_by, auth.uid()), NEW.created_at);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fee_structure_version_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fix_month_format"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
  v_updated_count INTEGER := 0;
  v_record RECORD;
  v_new_month TEXT;
  v_month_num TEXT;
BEGIN
  -- ১. Exam Fee - Monthly এর মাস ঠিক করুন (সব একসাথে)
  UPDATE payment_allocations
  SET month = REGEXP_REPLACE(month, '\((\d+)\)', '\1', 'g')
  WHERE category_id IN (SELECT id FROM fee_categories WHERE name ILIKE '%exam%monthly%')
    AND month ~ '\([0-9]+\)';
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Exam Fee - Monthly updated: % records', v_updated_count;
  
  -- ২. Exam Fee - Semester এর মাস ঠিক করুন
  UPDATE payment_allocations
  SET month = REGEXP_REPLACE(month, '\((\d+)\)', '\1', 'g')
  WHERE category_id IN (SELECT id FROM fee_categories WHERE name ILIKE '%exam%semester%')
    AND month ~ '\([0-9]+\)';
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Exam Fee - Semester updated: % records', v_updated_count;
  
  -- ৩. সব ভুল ফরম্যাটের মাস আপডেট করুন (যেখানে সংখ্যা ১ ডিজিট)
  UPDATE payment_allocations
  SET month = 
    SUBSTRING(month, 1, 5) || 
    CASE 
      WHEN LENGTH(SUBSTRING(month, 6)) = 1 THEN '0' || SUBSTRING(month, 6)
      WHEN LENGTH(SUBSTRING(month, 6)) = 2 AND SUBSTRING(month, 6, 1) != '0' THEN SUBSTRING(month, 6)
      ELSE SUBSTRING(month, 6)
    END
  WHERE month ~ '^[0-9]{4}-[0-9]{1,2}$'
    AND LENGTH(month) < 7;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Single digit months fixed: % records', v_updated_count;
  
  RETURN v_updated_count;
END;
$_$;


ALTER FUNCTION "public"."fix_month_format"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_auto_assign_fee_structure"("p_student_id" "uuid", "p_academic_year_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_academic_year_id uuid;
    v_fee_structure_id uuid;
    v_class_id uuid;
    v_existing_assignment_id uuid;
BEGIN
    IF p_academic_year_id IS NULL THEN
        SELECT id INTO v_academic_year_id
        FROM public.academic_years
        WHERE is_current = true
        LIMIT 1;
    ELSE
        v_academic_year_id := p_academic_year_id;
    END IF;

    IF v_academic_year_id IS NULL THEN
        RAISE NOTICE 'No academic year found for student %', p_student_id;
        RETURN NULL;
    END IF;

    SELECT class_id INTO v_class_id
    FROM public.students
    WHERE id = p_student_id;

    IF v_class_id IS NULL THEN
        RAISE NOTICE 'No class found for student %', p_student_id;
        RETURN NULL;
    END IF;

    SELECT id INTO v_fee_structure_id
    FROM public.fee_structures
    WHERE class_id = v_class_id
      AND academic_year_id = v_academic_year_id
      AND is_active = true
    LIMIT 1;

    IF v_fee_structure_id IS NULL THEN
        RAISE NOTICE 'No fee structure found for class % in year %', 
            v_class_id, v_academic_year_id;
        RETURN NULL;
    END IF;

    SELECT id INTO v_existing_assignment_id
    FROM public.fee_student_assignments
    WHERE student_id = p_student_id
      AND academic_year_id = v_academic_year_id
      AND is_active = true
    LIMIT 1;

    IF v_existing_assignment_id IS NOT NULL THEN
        RETURN v_existing_assignment_id;
    END IF;

    INSERT INTO public.fee_student_assignments (
        student_id,
        fee_structure_id,
        academic_year_id,
        assigned_date,
        effective_from,
        effective_to,
        is_active,
        notes
    ) VALUES (
        p_student_id,
        v_fee_structure_id,
        v_academic_year_id,
        CURRENT_DATE,
        COALESCE(
            (SELECT start_date FROM public.academic_years WHERE id = v_academic_year_id),
            CURRENT_DATE
        ),
        (SELECT end_date FROM public.academic_years WHERE id = v_academic_year_id),
        true,
        'Auto-assigned'
    )
    RETURNING id INTO v_existing_assignment_id;

    RETURN v_existing_assignment_id;
END;
$$;


ALTER FUNCTION "public"."fn_auto_assign_fee_structure"("p_student_id" "uuid", "p_academic_year_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_bulk_assign_all_students"("p_academic_year_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_academic_year_id uuid;
    v_student RECORD;
    v_assigned int := 0;
    v_skipped int := 0;
    v_errors int := 0;
    v_result uuid;
BEGIN
    IF p_academic_year_id IS NULL THEN
        SELECT id INTO v_academic_year_id
        FROM public.academic_years
        WHERE is_current = true
        LIMIT 1;
    ELSE
        v_academic_year_id := p_academic_year_id;
    END IF;

    IF v_academic_year_id IS NULL THEN
        RETURN jsonb_build_object('error', 'No academic year found');
    END IF;

    FOR v_student IN
        SELECT id, name 
        FROM public.students
        WHERE status = 'active'
    LOOP
        BEGIN
            v_result := public.fn_auto_assign_fee_structure(
                v_student.id, 
                v_academic_year_id
            );
            
            IF v_result IS NULL THEN
                v_skipped := v_skipped + 1;
            ELSE
                v_assigned := v_assigned + 1;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_errors := v_errors + 1;
            RAISE WARNING 'Failed for student %: %', v_student.name, SQLERRM;
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'academic_year_id', v_academic_year_id,
        'total_assigned', v_assigned,
        'total_skipped', v_skipped,
        'total_errors', v_errors
    );
END;
$$;


ALTER FUNCTION "public"."fn_bulk_assign_all_students"("p_academic_year_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_create_double_entry"("p_voucher_type" character varying, "p_voucher_date" "date", "p_financial_account_id" "uuid", "p_counter_account_id" "uuid", "p_amount" numeric, "p_is_income" boolean, "p_party_name" character varying DEFAULT NULL::character varying, "p_reference_no" character varying DEFAULT NULL::character varying, "p_narration" "text" DEFAULT NULL::"text", "p_description" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_voucher_id uuid;
  v_voucher_no varchar(50);
  v_prefix     varchar(10);
BEGIN
  -- Validation
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive, got %', p_amount;
  END IF;
  IF p_financial_account_id IS NULL THEN
    RAISE EXCEPTION 'Financial account ID is required';
  END IF;
  IF p_counter_account_id IS NULL THEN
    RAISE EXCEPTION 'Counter account ID is required';
  END IF;

  -- Prefix by type
  v_prefix := CASE p_voucher_type
    WHEN 'receipt'  THEN 'RCPT'
    WHEN 'payment'  THEN 'PAY'
    WHEN 'journal'  THEN 'JV'
    WHEN 'transfer' THEN 'TRF'
    ELSE 'VCH'
  END;

  v_voucher_no := public.fn_generate_voucher_no(v_prefix, p_voucher_date);

  -- Insert voucher header
  INSERT INTO public.vouchers (
    voucher_no, voucher_type, voucher_date,
    financial_account_id, total_amount,
    paid_to_received_from, reference_no, narration
  ) VALUES (
    v_voucher_no, p_voucher_type, p_voucher_date,
    p_financial_account_id, p_amount,
    p_party_name, p_reference_no, p_narration
  ) RETURNING id INTO v_voucher_id;

  -- Insert 2 journal entries
  IF p_is_income THEN
    -- INCOME: Cash DEBIT, Counter CREDIT
    INSERT INTO public.journal_entries (voucher_id, account_id, debit, credit, description)
    VALUES
      (v_voucher_id, p_financial_account_id, p_amount, 0,        COALESCE(p_description, 'Cash received')),
      (v_voucher_id, p_counter_account_id,   0,        p_amount, COALESCE(p_description, 'Income'));
  ELSE
    -- EXPENSE: Counter DEBIT, Cash CREDIT
    INSERT INTO public.journal_entries (voucher_id, account_id, debit, credit, description)
    VALUES
      (v_voucher_id, p_counter_account_id,    p_amount, 0,        COALESCE(p_description, 'Expense')),
      (v_voucher_id, p_financial_account_id, 0,        p_amount, COALESCE(p_description, 'Cash paid'));
  END IF;

  RETURN v_voucher_id;
END;
$$;


ALTER FUNCTION "public"."fn_create_double_entry"("p_voucher_type" character varying, "p_voucher_date" "date", "p_financial_account_id" "uuid", "p_counter_account_id" "uuid", "p_amount" numeric, "p_is_income" boolean, "p_party_name" character varying, "p_reference_no" character varying, "p_narration" "text", "p_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_create_transfer"("p_from_account_id" "uuid", "p_to_account_id" "uuid", "p_amount" numeric, "p_date" "date", "p_narration" "text" DEFAULT NULL::"text", "p_reference_no" character varying DEFAULT NULL::character varying) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_voucher_id uuid;
  v_voucher_no varchar(50);
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be positive';
  END IF;
  IF p_from_account_id IS NULL OR p_to_account_id IS NULL
     OR p_from_account_id = p_to_account_id THEN
    RAISE EXCEPTION 'Invalid from/to accounts';
  END IF;

  v_voucher_no := public.fn_generate_voucher_no('TRF', p_date);

  INSERT INTO public.vouchers (
    voucher_no, voucher_type, voucher_date,
    financial_account_id, total_amount, narration, reference_no
  ) VALUES (
    v_voucher_no, 'transfer', p_date,
    p_from_account_id, p_amount,
    COALESCE(p_narration, 'Fund Transfer'), p_reference_no
  ) RETURNING id INTO v_voucher_id;

  -- Debit destination, Credit source
  INSERT INTO public.journal_entries (voucher_id, account_id, debit, credit, description)
  VALUES
    (v_voucher_id, p_to_account_id,   p_amount, 0,        'Transfer IN'),
    (v_voucher_id, p_from_account_id, 0,        p_amount, 'Transfer OUT');

  RETURN v_voucher_id;
END;
$$;


ALTER FUNCTION "public"."fn_create_transfer"("p_from_account_id" "uuid", "p_to_account_id" "uuid", "p_amount" numeric, "p_date" "date", "p_narration" "text", "p_reference_no" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_default_cash_account"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id
  FROM public.financial_accounts
  WHERE is_active = true AND type = 'cash'
  ORDER BY created_at ASC
  LIMIT 1;

  -- Fallback: any active account
  IF v_id IS NULL THEN
    SELECT id INTO v_id
    FROM public.financial_accounts
    WHERE is_active = true
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."fn_default_cash_account"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_generate_voucher_no"("p_prefix" character varying, "p_date" "date" DEFAULT CURRENT_DATE) RETURNS character varying
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_no      varchar(50);
  v_attempt int := 0;
BEGIN
  LOOP
    v_attempt := v_attempt + 1;
    v_no := p_prefix || '-' || TO_CHAR(p_date, 'YYMMDD') || '-' ||
            LPAD(FLOOR(RANDOM() * 99999)::text, 5, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.vouchers WHERE voucher_no = v_no);
    EXIT WHEN v_attempt >= 20;
  END LOOP;
  RETURN v_no;
END;
$$;


ALTER FUNCTION "public"."fn_generate_voucher_no"("p_prefix" character varying, "p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_recalc_account_balance"("p_account_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF p_account_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.financial_accounts
  SET current_balance = COALESCE((
    SELECT SUM(
      CASE 
        WHEN ft.type = 'income'  THEN ft.amount
        WHEN ft.type = 'expense' THEN -ft.amount
        ELSE 0
      END
    )
    FROM public.finance_transactions ft
    WHERE ft.account_id = p_account_id
  ), 0),
  updated_at = NOW()
  WHERE id = p_account_id;
END;
$$;


ALTER FUNCTION "public"."fn_recalc_account_balance"("p_account_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_seed_system_account"("p_name" character varying, "p_account_category" character varying, "p_is_balance_sheet" boolean DEFAULT false) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.financial_accounts
  WHERE account_name = p_name LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.financial_accounts (
      account_name, type, current_balance,
      is_active, account_category, is_balance_sheet, updated_at
    ) VALUES (
      p_name, 'cash', 0,
      true, p_account_category, p_is_balance_sheet, NOW()
    ) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."fn_seed_system_account"("p_name" character varying, "p_account_category" character varying, "p_is_balance_sheet" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_system_account"("p_name" character varying) RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT id FROM public.financial_accounts WHERE account_name = p_name LIMIT 1;
$$;


ALTER FUNCTION "public"."fn_system_account"("p_name" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_validate_voucher_balance"() RETURNS TABLE("voucher_id" "uuid", "voucher_no" character varying, "total_debit" numeric, "total_credit" numeric, "imbalance" numeric)
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    v.id,
    v.voucher_no,
    COALESCE(SUM(je.debit),0),
    COALESCE(SUM(je.credit),0),
    COALESCE(SUM(je.debit),0) - COALESCE(SUM(je.credit),0)
  FROM public.vouchers v
  LEFT JOIN public.journal_entries je ON je.voucher_id=v.id
  GROUP BY v.id, v.voucher_no
  HAVING COALESCE(SUM(je.debit),0) <> COALESCE(SUM(je.credit),0);
$$;


ALTER FUNCTION "public"."fn_validate_voucher_balance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."format_month_display"("p_month" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $_$
DECLARE
  v_year TEXT;
  v_month_num INTEGER;
BEGIN
  IF p_month IS NULL OR p_month = '' OR p_month = 'null' THEN
    RETURN '—';
  END IF;
  
  -- 'YYYY-MM' ফরম্যাট চেক করুন
  IF p_month ~ '^\d{4}-\d{1,2}$' THEN
    v_year := SPLIT_PART(p_month, '-', 1);
    v_month_num := SPLIT_PART(p_month, '-', 2)::INTEGER;
    
    RETURN TO_CHAR(
      (v_year || '-' || LPAD(v_month_num::TEXT, 2, '0') || '-01')::DATE, 
      'Month YYYY'
    );
  END IF;
  
  -- যদি ইতিমধ্যেই মাসের নাম হয়
  RETURN p_month;
END;
$_$;


ALTER FUNCTION "public"."format_month_display"("p_month" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_dues_from_structure"("p_student_id" "uuid", "p_academic_year_id" "uuid", "p_up_to_month" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_result jsonb := '[]'::jsonb;
    v_structure_id uuid;
    v_category RECORD;
    v_month_num int;
    v_up_to_month_num int;
    v_up_to_year int;
    v_month_date date;
    v_month text;
    v_expected numeric := 0;
    v_paid numeric := 0;
    v_due numeric := 0;
    v_discount_amount numeric := 0;
    v_academic_year RECORD;
    v_current_month int := EXTRACT(MONTH FROM CURRENT_DATE);
    v_current_year int := EXTRACT(YEAR FROM CURRENT_DATE);
    v_processed int := 0;
    v_student RECORD;
    v_start_month_date date;
    v_end_month_date date;
    v_discount RECORD;
    v_advance_adjust_result jsonb;
BEGIN
    SELECT * INTO v_academic_year
    FROM public.academic_years
    WHERE id = p_academic_year_id;

    IF v_academic_year IS NULL THEN
        RETURN jsonb_build_object('error', 'Academic year not found');
    END IF;

    v_start_month_date := date_trunc('month', v_academic_year.start_date)::date;

    v_up_to_year := SPLIT_PART(p_up_to_month, '-', 1)::int;
    v_up_to_month_num := SPLIT_PART(p_up_to_month, '-', 2)::int;
    v_end_month_date := (v_up_to_year || '-' || LPAD(v_up_to_month_num::text, 2, '0') || '-01')::date;

    SELECT s.id, s.class_id, s.section_id
    INTO v_student
    FROM public.students s
    WHERE s.id = p_student_id;

    SELECT fee_structure_id INTO v_structure_id
    FROM public.fee_student_assignments
    WHERE student_id = p_student_id
      AND academic_year_id = p_academic_year_id
      AND is_active = TRUE
    LIMIT 1;

    IF v_structure_id IS NULL THEN
        RETURN jsonb_build_object('error', 'No active fee structure');
    END IF;

    v_month_date := v_start_month_date;
    WHILE v_month_date <= v_end_month_date
    LOOP
        v_month := TO_CHAR(v_month_date, 'YYYY-MM');
        v_month_num := EXTRACT(MONTH FROM v_month_date)::int;

        FOR v_category IN
            SELECT 
                fsi.category_id,
                fc.name,
                fc.frequency,
                fc.custom_schedule,
                fc.due_day,
                fsi.amount
            FROM public.fee_structure_items fsi
            JOIN public.fee_categories fc ON fc.id = fsi.category_id
            WHERE fsi.fee_structure_id = v_structure_id
              AND fc.is_active = TRUE
        LOOP
            v_expected := 0;

            -- Monthly
            IF v_category.frequency = 'monthly' THEN
                v_expected := v_category.amount;

            -- Custom
            ELSIF v_category.frequency = 'custom' THEN
                IF v_category.custom_schedule IS NOT NULL 
                   AND v_category.custom_schedule ? 'months'
                   AND EXISTS (
                       SELECT 1 
                       FROM jsonb_array_elements_text(v_category.custom_schedule->'months') m
                       WHERE m::int = v_month_num
                   ) 
                THEN
                    IF v_category.custom_schedule ? 'amount_per_month' THEN
                        v_expected := (v_category.custom_schedule->>'amount_per_month')::numeric;
                    ELSE
                        v_expected := v_category.amount;
                    END IF;
                END IF;

            -- One Time
            ELSIF v_category.frequency = 'one_time' THEN
                IF v_month_date = v_start_month_date THEN
                    v_expected := v_category.amount;
                END IF;

            -- Yearly
            ELSIF v_category.frequency = 'yearly' THEN
                IF v_month_date = v_start_month_date THEN
                    v_expected := v_category.amount;
                END IF;

            -- Quarterly
            ELSIF v_category.frequency = 'quarterly' THEN
                IF v_month_num IN (1,4,7,10) THEN
                    v_expected := v_category.amount;
                END IF;
            END IF;

            IF v_expected = 0 THEN
                CONTINUE;
            END IF;

            v_discount_amount := 0;

            FOR v_discount IN
                SELECT * FROM public.fee_discounts fd
                WHERE fd.is_active = TRUE
                  AND (fd.valid_from IS NULL OR fd.valid_from <= v_month_date)
                  AND (fd.valid_to IS NULL OR fd.valid_to >= v_month_date)
                  AND (
                      fd.scope_type = 'all'
                      OR (fd.scope_type = 'class' AND fd.scope_class_id = v_student.class_id)
                      OR (fd.scope_type = 'section' AND fd.scope_section_id = v_student.section_id)
                      OR (fd.scope_type = 'student' AND v_student.id = ANY(fd.scope_student_ids))
                  )
                  AND (
                      fd.applicable_categories = '[]'::jsonb
                      OR fd.applicable_categories @> to_jsonb(ARRAY[v_category.category_id::text])
                      OR fd.applicable_categories @> to_jsonb(ARRAY[v_category.name])
                  )
            LOOP
                IF v_discount.type = 'percentage' THEN
                    v_discount_amount := v_discount_amount + (v_expected * v_discount.value / 100);
                ELSE
                    v_discount_amount := v_discount_amount + v_discount.value;
                END IF;
            END LOOP;

            IF v_discount_amount > v_expected THEN
                v_discount_amount := v_expected;
            END IF;

            v_paid := 0;
            v_due := GREATEST(0, v_expected - v_discount_amount - v_paid);

            INSERT INTO public.student_fee_dues (
                student_id,
                category_id,
                academic_year_id,
                month,
                expected_amount,
                paid_amount,
                due_amount,
                discount_amount,
                due_date,
                is_advance,
                status,
                created_at,
                updated_at
            ) VALUES (
                p_student_id,
                v_category.category_id,
                p_academic_year_id,
                v_month,
                v_expected,
                v_paid,
                v_due,
                v_discount_amount,
                (v_month_date + (COALESCE(v_category.due_day, 15) - 1)),
                (EXTRACT(YEAR FROM v_month_date)::int > v_current_year) OR 
                    (EXTRACT(YEAR FROM v_month_date)::int = v_current_year 
                     AND v_month_num > v_current_month),
                CASE 
                    WHEN v_due <= 0 THEN 'paid'
                    WHEN v_paid > 0 THEN 'partial'
                    WHEN v_month_date < CURRENT_DATE THEN 'overdue'
                    ELSE 'pending'
                END,
                NOW(),
                NOW()
            )
            ON CONFLICT (student_id, category_id, month, academic_year_id) 
            DO UPDATE SET
                expected_amount = EXCLUDED.expected_amount,
                discount_amount = EXCLUDED.discount_amount,
                due_date = EXCLUDED.due_date,
                is_advance = EXCLUDED.is_advance,
                updated_at = NOW();

            v_result := v_result || jsonb_build_object(
                'month', v_month,
                'category', v_category.name,
                'expected', v_expected,
                'discount', v_discount_amount,
                'paid', v_paid,
                'due', v_due
            );
            v_processed := v_processed + 1;
        END LOOP;

        v_month_date := v_month_date + INTERVAL '1 month';
    END LOOP;

    -- ══════════════════════════════════════════════════════════════
    -- 🆕 AUTO-ADJUST CARRY FORWARD ADVANCE
    -- If there's pending carry forward for this student,
    -- apply it to newly generated dues in same category
    -- ══════════════════════════════════════════════════════════════
    SELECT public.adjust_advance_on_new_dues(p_student_id, p_academic_year_id)
    INTO v_advance_adjust_result;

    RETURN jsonb_build_object(
        'student_id', p_student_id,
        'processed_entries', v_processed,
        'advance_adjustment', v_advance_adjust_result,
        'details', v_result
    );
END;
$$;


ALTER FUNCTION "public"."generate_dues_from_structure"("p_student_id" "uuid", "p_academic_year_id" "uuid", "p_up_to_month" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_monthly_dues_for_all"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_academic_year_id UUID;
    v_student RECORD;
    v_result JSONB := '[]'::JSONB;
    v_count INT := 0;
    v_errors JSONB := '[]'::JSONB;
    v_next_month TEXT;
BEGIN
    -- Get current academic year
    SELECT id INTO v_academic_year_id
    FROM public.academic_years
    WHERE is_current = TRUE
    LIMIT 1;
    
    IF v_academic_year_id IS NULL THEN
        RAISE EXCEPTION 'No current academic year found';
    END IF;
    
    -- Calculate next month
    v_next_month := TO_CHAR(CURRENT_DATE + INTERVAL '1 month', 'YYYY-MM');
    
    -- Loop through all active students
    FOR v_student IN
        SELECT id, student_id, name
        FROM public.students
        WHERE status = 'active'
    LOOP
        BEGIN
            PERFORM public.generate_dues_from_structure(
                v_student.id,
                v_academic_year_id,
                v_next_month
            );
            
            v_count := v_count + 1;
            v_result := v_result || jsonb_build_object(
                'student_id', v_student.student_id,
                'name', v_student.name,
                'status', 'success'
            );
        EXCEPTION WHEN OTHERS THEN
            v_errors := v_errors || jsonb_build_object(
                'student_id', v_student.student_id,
                'name', v_student.name,
                'error', SQLERRM
            );
        END;
    END LOOP;
    
    RETURN jsonb_build_object(
        'total_students', v_count,
        'success_count', v_count - jsonb_array_length(v_errors),
        'error_count', jsonb_array_length(v_errors),
        'errors', v_errors,
        'details', v_result
    );
END;
$$;


ALTER FUNCTION "public"."generate_monthly_dues_for_all"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_monthly_invoices"() RETURNS TABLE("total_generated" integer, "total_skipped" integer, "message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_current_month INT := EXTRACT(MONTH FROM CURRENT_DATE);
    v_current_year INT := EXTRACT(YEAR FROM CURRENT_DATE);
    v_count_generated INT := 0;
    v_count_skipped INT := 0;
    v_student RECORD;
BEGIN
    FOR v_student IN
        SELECT 
            s.id AS student_id,
            s.class_id,
            fsa.academic_year_id,
            fs.total_amount,
            fsa.fee_structure_id,
            s.name AS student_name
        FROM students s
        JOIN fee_student_assignments fsa ON fsa.student_id = s.id
        JOIN fee_structures fs ON fs.id = fsa.fee_structure_id
        WHERE fsa.is_active = true
          AND s.status = 'active'
    LOOP
        -- চেক করা আগের মাসের ইনভয়েস আছে কিনা
        IF NOT EXISTS (
            SELECT 1 FROM fee_invoices
            WHERE student_id = v_student.student_id
              AND month = v_current_month
              AND EXTRACT(YEAR FROM created_at) = v_current_year
        ) THEN
            -- নতুন ইনভয়েস তৈরি
            INSERT INTO fee_invoices (
                student_id,
                academic_year_id,
                month,
                amount,
                total,
                paid_amount,
                due_amount,
                status,
                due_date,
                created_at,
                updated_at
            ) VALUES (
                v_student.student_id,
                v_student.academic_year_id,
                v_current_month,
                COALESCE(v_student.total_amount, 0),
                COALESCE(v_student.total_amount, 0),
                0,
                COALESCE(v_student.total_amount, 0),
                'pending',
                CURRENT_DATE + INTERVAL '15 days',
                NOW(),
                NOW()
            );
            
            v_count_generated := v_count_generated + 1;
        ELSE
            v_count_skipped := v_count_skipped + 1;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT 
        v_count_generated,
        v_count_skipped,
        format('Generated %s invoices, Skipped %s (already exist)', 
               v_count_generated, v_count_skipped)::TEXT;
END;
$$;


ALTER FUNCTION "public"."generate_monthly_invoices"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_monthly_salary_balances"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_current_month int := EXTRACT(MONTH FROM CURRENT_DATE)::int;
  v_current_year int := EXTRACT(YEAR FROM CURRENT_DATE)::int;
  v_month_str text;
  v_r record;
  v_calc record;
  v_due_date date;
  v_created int := 0;
  v_skipped int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_prev_advance numeric := 0;
  v_net_after_advance numeric := 0;
BEGIN
  v_month_str := CASE v_current_month
    WHEN 1  THEN 'January'   WHEN 2  THEN 'February'
    WHEN 3  THEN 'March'     WHEN 4  THEN 'April'
    WHEN 5  THEN 'May'       WHEN 6  THEN 'June'
    WHEN 7  THEN 'July'      WHEN 8  THEN 'August'
    WHEN 9  THEN 'September' WHEN 10 THEN 'October'
    WHEN 11 THEN 'November'  WHEN 12 THEN 'December'
  END;

  v_due_date := (make_date(v_current_year, v_current_month, 1) 
                 + INTERVAL '1 month')::date;

  FOR v_r IN
    SELECT id, name FROM public.staff
    WHERE status IN ('active', 'on_leave')
      AND salary_category_id IS NOT NULL
  LOOP
    BEGIN
      -- Get calculated salary (business-rule applied)
      SELECT * INTO v_calc
      FROM public.calculate_staff_salary(v_r.id, v_current_month, v_current_year);

      IF v_calc.is_blocked THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      -- Skip if already exists
      IF EXISTS (
        SELECT 1 FROM public.salary_balances
        WHERE staff_id = v_r.id 
          AND month = v_month_str
          AND year = v_current_year
      ) THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      -- ✅ NEW: Check previous months' overpayment (advance)
      -- Uses month_order CASE for correct chronological comparison
      SELECT COALESCE(SUM(paid_amount - expected_salary), 0)
      INTO v_prev_advance
      FROM public.salary_balances
      WHERE staff_id = v_r.id
        AND paid_amount > expected_salary
        AND (
          (year < v_current_year)
          OR (
            year = v_current_year 
            AND CASE month
                  WHEN 'January'   THEN 1  WHEN 'February' THEN 2
                  WHEN 'March'     THEN 3  WHEN 'April'    THEN 4
                  WHEN 'May'       THEN 5  WHEN 'June'     THEN 6
                  WHEN 'July'      THEN 7  WHEN 'August'   THEN 8
                  WHEN 'September' THEN 9  WHEN 'October'  THEN 10
                  WHEN 'November'  THEN 11 WHEN 'December' THEN 12
                  ELSE 0
                END < v_current_month
          )
        );

      -- Adjust net salary for advance
      v_net_after_advance := GREATEST(0, v_calc.net_salary - v_prev_advance);

      -- Insert pending salary balance with advance adjustment
      INSERT INTO public.salary_balances (
        staff_id, month, year,
        expected_salary, paid_amount, due_amount, balance,
        status, due_date, updated_at
      ) VALUES (
        v_r.id, v_month_str, v_current_year,
        v_net_after_advance,
        0, v_net_after_advance, v_net_after_advance,
        'pending', v_due_date, NOW()
      );

      v_created := v_created + 1;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object(
        'staff_id', v_r.id,
        'staff_name', v_r.name,
        'error', SQLERRM
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'month', v_month_str,
    'year', v_current_year,
    'due_date', v_due_date,
    'created', v_created,
    'skipped', v_skipped,
    'errors_count', jsonb_array_length(v_errors),
    'errors', v_errors
  );
END;
$$;


ALTER FUNCTION "public"."generate_monthly_salary_balances"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_receipt_number"("p_prefix" character varying DEFAULT 'P'::character varying) RETURNS character varying
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_receipt_no VARCHAR(20);
  v_attempt INTEGER := 0;
  v_max_attempts INTEGER := 20;
BEGIN
  -- Loop for uniqueness
  FOR v_attempt IN 1..v_max_attempts LOOP
    -- Simple format: YYMMDD-PREFIX-RANDOM
    -- e.g., 260913-P-12345 = 14 chars
    v_receipt_no := 
      TO_CHAR(CURRENT_DATE, 'YYMMDD') || '-' || 
      LEFT(p_prefix, 3) || '-' || 
      LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    
    -- Hard truncation to 20 chars (safety)
    v_receipt_no := LEFT(v_receipt_no, 20);
    
    -- Check uniqueness
    IF NOT EXISTS (SELECT 1 FROM public.fee_payments WHERE receipt_no = v_receipt_no) THEN
      RETURN v_receipt_no;
    END IF;
  END LOOP;
  
  -- Ultimate fallback: microsecond-based
  v_receipt_no := TO_CHAR(CURRENT_DATE, 'YYMMDD') || '-' ||
                  LPAD((EXTRACT(EPOCH FROM CLOCK_TIMESTAMP())::BIGINT % 100000000000)::TEXT, 12, '0');
  
  v_receipt_no := LEFT(v_receipt_no, 20);
  RETURN v_receipt_no;
END;
$$;


ALTER FUNCTION "public"."generate_receipt_number"("p_prefix" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_section_results"("p_term_id" "uuid", "p_class_id" "uuid", "p_section_id" "uuid", "p_subject_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS TABLE("success" boolean, "message" "text", "students_processed" integer, "subjects_processed" integer, "errors" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_academic_year_id UUID;
    v_total_students INTEGER;
    v_subject_ids UUID[];
    v_student RECORD;
    v_subject RECORD;
    v_total_marks NUMERIC;
    v_total_full_marks NUMERIC;
    v_percentage NUMERIC;
    v_grade RECORD;
    v_failed_subjects JSONB;
    v_has_failed_compulsory BOOLEAN;
    v_processed_count INTEGER := 0;
    v_error_count INTEGER := 0;
    v_errors JSONB := '[]'::JSONB;
BEGIN
    -- Get academic year from term
    SELECT academic_year_id INTO v_academic_year_id 
    FROM public.exam_terms WHERE id = p_term_id;
    
    IF v_academic_year_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Invalid term ID'::TEXT, 0, 0, '[]'::JSONB;
        RETURN;
    END IF;
    
    -- Get total students count
    SELECT COUNT(*) INTO v_total_students
    FROM public.students
    WHERE class_id = p_class_id 
        AND section_id = p_section_id
        AND status = 'active';
    
    IF v_total_students = 0 THEN
        RETURN QUERY SELECT FALSE, 'No students found in this section'::TEXT, 0, 0, '[]'::JSONB;
        RETURN;
    END IF;
    
    -- Get subject IDs to process
    IF p_subject_ids IS NULL OR array_length(p_subject_ids, 1) = 0 THEN
        SELECT ARRAY_AGG(es.id) INTO v_subject_ids
        FROM public.exam_subjects es
        WHERE es.term_id = p_term_id AND es.class_id = p_class_id;
    ELSE
        v_subject_ids := p_subject_ids;
    END IF;
    
    IF v_subject_ids IS NULL OR array_length(v_subject_ids, 1) = 0 THEN
        RETURN QUERY SELECT FALSE, 'No subjects found'::TEXT, 0, 0, '[]'::JSONB;
        RETURN;
    END IF;
    
    -- Update term status
    UPDATE public.exam_terms SET result_status = 'generating' WHERE id = p_term_id;
    
    -- Process each subject
    FOR v_subject IN 
        SELECT es.id, s.name as subject_name
        FROM public.exam_subjects es
        JOIN public.subjects s ON s.id = es.subject_id
        WHERE es.id = ANY(v_subject_ids)
    LOOP
        -- Process all students
        FOR v_student IN 
            SELECT s.id, s.name
            FROM public.students s
            WHERE s.class_id = p_class_id 
                AND s.section_id = p_section_id
                AND s.status = 'active'
        LOOP
            BEGIN
                -- Calculate overall results for this student
                WITH subject_results AS (
                    SELECT 
                        COALESCE(smn.marks_obtained, 0) as marks_obtained,
                        es.full_marks,
                        es.pass_marks,
                        es.subject_type,
                        s2.name as subject_name,
                        s2.id as subject_id
                    FROM public.student_marks_new smn
                    JOIN public.exam_subjects es ON es.id = smn.exam_subject_id
                    JOIN public.subjects s2 ON s2.id = es.subject_id
                    WHERE smn.student_id = v_student.id
                        AND smn.term_id = p_term_id
                        AND smn.entry_status = 'locked'
                ),
                total_calc AS (
                    SELECT 
                        COALESCE(SUM(marks_obtained), 0) as total_marks,
                        COALESCE(SUM(full_marks), 0) as total_full
                    FROM subject_results
                ),
                failed_calc AS (
                    SELECT 
                        JSONB_AGG(
                            JSONB_BUILD_OBJECT(
                                'subject_id', subject_id,
                                'subject_name', subject_name,
                                'subject_type', subject_type,
                                'marks_obtained', marks_obtained,
                                'pass_marks', pass_marks
                            )
                        ) FILTER (WHERE marks_obtained < pass_marks) as failed_subjects,
                        BOOL_OR(subject_type = 'compulsory' AND marks_obtained < pass_marks) as has_failed_compulsory
                    FROM subject_results
                )
                SELECT 
                    tc.total_marks,
                    tc.total_full,
                    COALESCE(fc.failed_subjects, '[]'::JSONB),
                    COALESCE(fc.has_failed_compulsory, FALSE)
                INTO v_total_marks, v_total_full_marks, v_failed_subjects, v_has_failed_compulsory
                FROM total_calc tc
                CROSS JOIN failed_calc fc;
                
                -- Calculate overall percentage and grade
                IF v_total_full_marks > 0 THEN
                    v_percentage := (v_total_marks / v_total_full_marks) * 100;
                ELSE
                    v_percentage := 0;
                END IF;
                
                -- Get grade
                SELECT grade_name, grade_point INTO v_grade
                FROM public.get_grade_from_percentage(v_percentage, v_academic_year_id);
                
                -- Insert or update compiled_results (without pass_fail_status)
                INSERT INTO public.compiled_results (
                    student_id, term_id, academic_year_id,
                    total_marks_obtained, total_full_marks, percentage,
                    gpa, letter_grade, result_status,
                    failed_subjects, has_failed_compulsory,
                    updated_at
                ) VALUES (
                    v_student.id, p_term_id, v_academic_year_id,
                    v_total_marks, v_total_full_marks, v_percentage,
                    v_grade.grade_point, v_grade.grade_name, 'generated',
                    v_failed_subjects, v_has_failed_compulsory,
                    NOW()
                ) ON CONFLICT (student_id, term_id) DO UPDATE SET
                    total_marks_obtained = EXCLUDED.total_marks_obtained,
                    total_full_marks = EXCLUDED.total_full_marks,
                    percentage = EXCLUDED.percentage,
                    gpa = EXCLUDED.gpa,
                    letter_grade = EXCLUDED.letter_grade,
                    result_status = EXCLUDED.result_status,
                    failed_subjects = EXCLUDED.failed_subjects,
                    has_failed_compulsory = EXCLUDED.has_failed_compulsory,
                    updated_at = EXCLUDED.updated_at;
                
                v_processed_count := v_processed_count + 1;
                
            EXCEPTION WHEN OTHERS THEN
                v_error_count := v_error_count + 1;
                v_errors := v_errors || JSONB_BUILD_OBJECT(
                    'student', v_student.name,
                    'subject', v_subject.subject_name,
                    'error', SQLERRM
                );
            END;
        END LOOP;
    END LOOP;
    
    -- Calculate positions after all subjects processed
    PERFORM public.calculate_positions(p_term_id);
    
    -- Update final status
    IF v_error_count > 0 THEN
        UPDATE public.exam_terms SET result_status = 'generated_with_errors' WHERE id = p_term_id;
        RETURN QUERY SELECT 
            FALSE, 
            format('Completed with %s errors', v_error_count)::TEXT,
            v_processed_count,
            array_length(v_subject_ids, 1),
            v_errors;
    ELSE
        UPDATE public.exam_terms SET result_status = 'generated' WHERE id = p_term_id;
        RETURN QUERY SELECT 
            TRUE, 
            'Successfully generated results'::TEXT,
            v_processed_count,
            array_length(v_subject_ids, 1),
            '[]'::JSONB;
    END IF;
    
    RETURN;
END;
$$;


ALTER FUNCTION "public"."generate_section_results"("p_term_id" "uuid", "p_class_id" "uuid", "p_section_id" "uuid", "p_subject_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_student_id"("p_class_name" character varying, "p_academic_year" integer) RETURNS character varying
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
  v_class_initial VARCHAR(2);
  v_prefix VARCHAR(20);
  v_last_serial INTEGER;
  v_new_serial INTEGER;
  v_student_id VARCHAR(20);
BEGIN
  -- Get class initial
  v_class_initial := UPPER(LEFT(p_class_name, 1));
  
  -- Create prefix
  v_prefix := p_academic_year || '-' || v_class_initial || '-';
  
  -- Get last serial number
  SELECT COALESCE(MAX(CAST(SUBSTRING(student_id FROM '(\d+)$') AS INTEGER)), 0)
  INTO v_last_serial
  FROM public.students
  WHERE student_id LIKE v_prefix || '%';
  
  -- Generate new serial
  v_new_serial := v_last_serial + 1;
  
  -- Create student ID
  v_student_id := v_prefix || LPAD(v_new_serial::TEXT, 3, '0');
  
  RETURN v_student_id;
END;
$_$;


ALTER FUNCTION "public"."generate_student_id"("p_class_name" character varying, "p_academic_year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_student_monthly_dues"("p_student_id" "uuid", "p_academic_year_id" "uuid", "p_up_to_month" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_current_month TEXT;
    v_start_month TEXT;
    v_month TEXT;
    v_result JSONB := '[]'::JSONB;
    v_academic_year RECORD;
    v_target_month INT;
    v_target_year INT;
    v_current_year INT := EXTRACT(YEAR FROM CURRENT_DATE);
    v_current_month_num INT := EXTRACT(MONTH FROM CURRENT_DATE);
    v_up_to_month_num INT;
    v_up_to_year INT;
    v_month_date DATE;
    v_month_record RECORD;
    v_processed_months INT := 0;
BEGIN
    -- Get academic year details
    SELECT * INTO v_academic_year
    FROM public.academic_years
    WHERE id = p_academic_year_id;
    
    IF v_academic_year IS NULL THEN
        RAISE EXCEPTION 'Academic year not found';
    END IF;
    
    -- Parse up_to_month
    v_up_to_year := SPLIT_PART(p_up_to_month, '-', 1)::INT;
    v_up_to_month_num := SPLIT_PART(p_up_to_month, '-', 2)::INT;
    
    -- Start from academic year start date
    v_start_month := TO_CHAR(v_academic_year.start_date, 'YYYY-MM');
    
    -- Loop through each month from start to up_to_month
    v_month_date := v_academic_year.start_date;
    WHILE v_month_date <= (v_up_to_year || '-' || LPAD(v_up_to_month_num::TEXT, 2, '0') || '-01')::DATE
    LOOP
        v_month := TO_CHAR(v_month_date, 'YYYY-MM');
        
        -- Calculate due for this month
        SELECT * INTO v_month_record
        FROM public.calculate_monthly_fee_due(
            p_student_id,
            p_academic_year_id,
            v_month
        );
        
        IF v_month_record IS NOT NULL THEN
            v_result := v_result || jsonb_build_object(
                'month', v_month,
                'total_expected', v_month_record.total_expected,
                'total_paid', v_month_record.total_paid,
                'total_due', v_month_record.total_due,
                'is_advance', v_month_record.is_advance
            );
            v_processed_months := v_processed_months + 1;
        END IF;
        
        -- Move to next month
        v_month_date := v_month_date + INTERVAL '1 month';
    END LOOP;
    
    RETURN jsonb_build_object(
        'student_id', p_student_id,
        'processed_months', v_processed_months,
        'details', v_result
    );
END;
$$;


ALTER FUNCTION "public"."generate_student_monthly_dues"("p_student_id" "uuid", "p_academic_year_id" "uuid", "p_up_to_month" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_term_result"("p_term_id" "uuid") RETURNS TABLE("processed_students" integer, "passed_count" integer, "failed_count" integer)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    rec RECORD;

    v_total_marks NUMERIC;
    v_total_full_marks NUMERIC;

    v_percentage NUMERIC;
    v_grade RECORD;

    v_has_failed_compulsory BOOLEAN;

    v_optional_bonus NUMERIC;
    v_final_gpa NUMERIC;

    v_passed INT := 0;
    v_failed INT := 0;

BEGIN

FOR rec IN
(
    SELECT DISTINCT student_id
    FROM student_marks_new
    WHERE term_id = p_term_id
)
LOOP

    ------------------------------------------------------------
    -- 1. COMPULSORY TOTAL ONLY
    ------------------------------------------------------------
    SELECT
        COALESCE(SUM(sm.marks_obtained),0),
        COALESCE(SUM(es.full_marks),0)
    INTO v_total_marks, v_total_full_marks
    FROM student_marks_new sm
    JOIN exam_subjects es ON es.subject_id = sm.subject_id
    WHERE sm.term_id = p_term_id
      AND sm.student_id = rec.student_id
      AND es.subject_type = 'compulsory';

    ------------------------------------------------------------
    -- 2. FAIL CHECK (<33 any compulsory)
    ------------------------------------------------------------
    SELECT EXISTS (
        SELECT 1
        FROM student_marks_new sm
        JOIN exam_subjects es ON es.subject_id = sm.subject_id
        WHERE sm.term_id = p_term_id
          AND sm.student_id = rec.student_id
          AND es.subject_type = 'compulsory'
          AND sm.marks_obtained < es.pass_marks
    )
    INTO v_has_failed_compulsory;

    ------------------------------------------------------------
    -- 3. PERCENTAGE
    ------------------------------------------------------------
    IF v_total_full_marks = 0 THEN
        v_percentage := 0;
    ELSE
        v_percentage := (v_total_marks / v_total_full_marks) * 100;
    END IF;

    ------------------------------------------------------------
    -- 4. GRADE FROM grading_rules
    ------------------------------------------------------------
    SELECT *
    INTO v_grade
    FROM grading_rules
    WHERE v_percentage BETWEEN min_mark AND max_mark
      AND is_active = TRUE
    LIMIT 1;

    ------------------------------------------------------------
    -- 5. OPTIONAL BONUS (FIXED)
    ------------------------------------------------------------
    SELECT COALESCE(SUM(
        CASE
            WHEN sm.marks_obtained >= 33 THEN 0.2
            ELSE 0
        END
    ),0)
    INTO v_optional_bonus
    FROM student_marks_new sm
    JOIN exam_subjects es ON es.subject_id = sm.subject_id
    WHERE sm.term_id = p_term_id
      AND sm.student_id = rec.student_id
      AND es.subject_type = 'optional';

    ------------------------------------------------------------
    -- 6. FINAL GPA
    ------------------------------------------------------------
    v_final_gpa := COALESCE(v_grade.grade_point,0);

    IF v_has_failed_compulsory THEN
        v_final_gpa := 0;
    ELSE
        v_final_gpa := v_final_gpa + v_optional_bonus;
    END IF;

    IF v_final_gpa > 5 THEN
        v_final_gpa := 5;
    END IF;

    ------------------------------------------------------------
    -- 7. UPSERT RESULT
    ------------------------------------------------------------
    INSERT INTO compiled_results (
        term_id,
        student_id,
        total_marks_obtained,
        total_full_marks,
        percentage,
        gpa,
        grade,
        is_failed
    )
    VALUES (
        p_term_id,
        rec.student_id,
        v_total_marks,
        v_total_full_marks,
        v_percentage,
        v_final_gpa,
        v_grade.grade_name,
        v_has_failed_compulsory
    )
    ON CONFLICT (term_id, student_id)
    DO UPDATE SET
        total_marks_obtained = EXCLUDED.total_marks_obtained,
        total_full_marks = EXCLUDED.total_full_marks,
        percentage = EXCLUDED.percentage,
        gpa = EXCLUDED.gpa,
        grade = EXCLUDED.grade,
        is_failed = EXCLUDED.is_failed;

    ------------------------------------------------------------
    -- 8. COUNTER
    ------------------------------------------------------------
    IF v_has_failed_compulsory THEN
        v_failed := v_failed + 1;
    ELSE
        v_passed := v_passed + 1;
    END IF;

END LOOP;

RETURN QUERY SELECT
    (v_passed + v_failed)::INT,
    v_passed,
    v_failed;

END;
$$;


ALTER FUNCTION "public"."generate_term_result"("p_term_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_student_due_details"("p_academic_year_id" "uuid" DEFAULT NULL::"uuid", "p_class_id" "uuid" DEFAULT NULL::"uuid", "p_section_id" "uuid" DEFAULT NULL::"uuid", "p_status" "text" DEFAULT 'active'::"text") RETURNS TABLE("student_id" "uuid", "admission_no" "text", "student_name" "text", "class_name" "text", "section_name" "text", "month" "text", "category_name" "text", "expected_amount" numeric, "paid_amount" numeric, "due_amount" numeric, "fine_amount" numeric, "discount_amount" numeric, "status" "text", "due_date" "date", "is_advance" boolean, "days_overdue" integer, "total_due" numeric, "net_due" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    WITH student_list AS (
        SELECT 
            s.id,
            s.student_id AS admission_no,
            s.name AS student_name,
            c.name AS class_name,
            sec.name AS section_name
        FROM public.students s
        LEFT JOIN public.classes c ON c.id = s.class_id
        LEFT JOIN public.sections sec ON sec.id = s.section_id
        WHERE s.status = p_status
            AND (p_class_id IS NULL OR s.class_id = p_class_id)
            AND (p_section_id IS NULL OR s.section_id = p_section_id)
    ),
    student_total AS (
        SELECT 
            sfd.student_id,
            COALESCE(SUM(sfd.due_amount), 0) AS total_due
        FROM public.student_fee_dues sfd
        WHERE (p_academic_year_id IS NULL OR sfd.academic_year_id = p_academic_year_id)
        GROUP BY sfd.student_id
    ),
    advance_total AS (
        SELECT 
            fp.student_id,
            COALESCE(SUM(pa.amount), 0) AS total_advance
        FROM public.payment_allocations pa
        JOIN public.fee_payments fp ON fp.id = pa.payment_id
        WHERE pa.allocation_type IN ('advance', 'advance_global')
        GROUP BY fp.student_id
    )
    SELECT 
        sl.id AS student_id,
        sl.admission_no::TEXT,
        sl.student_name::TEXT,
        sl.class_name::TEXT,
        sl.section_name::TEXT,
        sfd.month::TEXT,
        COALESCE(fc.name, 'N/A')::TEXT AS category_name,
        sfd.expected_amount,
        sfd.paid_amount,
        sfd.due_amount,
        sfd.fine_amount,
        sfd.discount_amount,
        sfd.status::TEXT,
        sfd.due_date,
        sfd.is_advance,
        CASE 
            WHEN sfd.due_date < CURRENT_DATE AND sfd.due_amount > 0 
            THEN (CURRENT_DATE - sfd.due_date)::INTEGER
            ELSE 0
        END AS days_overdue,
        COALESCE(st.total_due, 0) AS total_due,
        GREATEST(0, COALESCE(st.total_due, 0) - COALESCE(adv.total_advance, 0)) AS net_due
    FROM student_list sl
    JOIN public.student_fee_dues sfd ON sfd.student_id = sl.id
    LEFT JOIN public.fee_categories fc ON fc.id = sfd.category_id
    LEFT JOIN student_total st ON st.student_id = sl.id
    LEFT JOIN advance_total adv ON adv.student_id = sl.id
    WHERE (p_academic_year_id IS NULL OR sfd.academic_year_id = p_academic_year_id)
        AND sfd.due_amount > 0
    ORDER BY net_due DESC, sfd.month ASC, fc.name ASC;
END;
$$;


ALTER FUNCTION "public"."get_all_student_due_details"("p_academic_year_id" "uuid", "p_class_id" "uuid", "p_section_id" "uuid", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_student_fee_summary"("p_academic_year_id" "uuid" DEFAULT NULL::"uuid", "p_class_id" "uuid" DEFAULT NULL::"uuid", "p_section_id" "uuid" DEFAULT NULL::"uuid", "p_status" "text" DEFAULT 'active'::"text") RETURNS TABLE("student_id" "uuid", "admission_no" "text", "student_name" "text", "class_name" "text", "section_name" "text", "total_expected" numeric, "total_paid" numeric, "total_due" numeric, "total_fine" numeric, "total_discount" numeric, "total_advance" numeric, "net_due" numeric, "paid_months" integer, "partial_months" integer, "pending_months" integer, "overdue_months" integer, "total_months" integer, "due_status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    WITH student_list AS (
        SELECT 
            s.id,
            s.student_id AS admission_no,
            s.name AS student_name,
            c.name AS class_name,
            sec.name AS section_name,
            s.class_id,
            s.section_id
        FROM public.students s
        LEFT JOIN public.classes c ON c.id = s.class_id
        LEFT JOIN public.sections sec ON sec.id = s.section_id
        WHERE s.status = p_status
            AND (p_class_id IS NULL OR s.class_id = p_class_id)
            AND (p_section_id IS NULL OR s.section_id = p_section_id)
    ),
    fee_summary AS (
        SELECT 
            sfd.student_id,
            COALESCE(SUM(sfd.expected_amount), 0) AS total_expected,
            COALESCE(SUM(sfd.paid_amount), 0) AS total_paid,
            COALESCE(SUM(sfd.due_amount), 0) AS total_due,
            COALESCE(SUM(sfd.fine_amount), 0) AS total_fine,
            COALESCE(SUM(sfd.discount_amount), 0) AS total_discount,
            COUNT(CASE WHEN sfd.status = 'paid' THEN 1 END) AS paid_months,
            COUNT(CASE WHEN sfd.status = 'partial' THEN 1 END) AS partial_months,
            COUNT(CASE WHEN sfd.status = 'pending' THEN 1 END) AS pending_months,
            COUNT(CASE WHEN sfd.status = 'overdue' THEN 1 END) AS overdue_months,
            COUNT(*) AS total_months
        FROM public.student_fee_dues sfd
        WHERE (p_academic_year_id IS NULL OR sfd.academic_year_id = p_academic_year_id)
        GROUP BY sfd.student_id
    ),
    advance_summary AS (
        SELECT 
            fp.student_id,
            COALESCE(SUM(pa.amount), 0) AS total_advance
        FROM public.payment_allocations pa
        JOIN public.fee_payments fp ON fp.id = pa.payment_id
        WHERE pa.allocation_type IN ('advance', 'advance_global')
        GROUP BY fp.student_id
    )
    SELECT 
        sl.id AS student_id,
        sl.admission_no,
        sl.student_name,
        sl.class_name,
        sl.section_name,
        COALESCE(fs.total_expected, 0) AS total_expected,
        COALESCE(fs.total_paid, 0) AS total_paid,
        COALESCE(fs.total_due, 0) AS total_due,
        COALESCE(fs.total_fine, 0) AS total_fine,
        COALESCE(fs.total_discount, 0) AS total_discount,
        COALESCE(adv.total_advance, 0) AS total_advance,
        GREATEST(0, COALESCE(fs.total_due, 0) - COALESCE(adv.total_advance, 0)) AS net_due,
        COALESCE(fs.paid_months, 0) AS paid_months,
        COALESCE(fs.partial_months, 0) AS partial_months,
        COALESCE(fs.pending_months, 0) AS pending_months,
        COALESCE(fs.overdue_months, 0) AS overdue_months,
        COALESCE(fs.total_months, 0) AS total_months,
        CASE 
            WHEN COALESCE(fs.total_due, 0) <= 0 THEN '✅ Paid'
            WHEN COALESCE(fs.overdue_months, 0) > 0 THEN '⚠️ Overdue'
            WHEN COALESCE(fs.partial_months, 0) > 0 THEN '🟡 Partial'
            ELSE '🔴 Pending'
        END AS due_status
    FROM student_list sl
    LEFT JOIN fee_summary fs ON fs.student_id = sl.id
    LEFT JOIN advance_summary adv ON adv.student_id = sl.id
    ORDER BY net_due DESC;
END;
$$;


ALTER FUNCTION "public"."get_all_student_fee_summary"("p_academic_year_id" "uuid", "p_class_id" "uuid", "p_section_id" "uuid", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_class_highest_marks"("p_class_id" "uuid", "p_exam_id" "uuid") RETURNS TABLE("subject_id" "uuid", "max_marks" numeric)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT sm.subject_id, MAX(sm.ct_marks + sm.exam_marks)::NUMERIC
    FROM student_marks sm
    JOIN students s ON sm.student_id = s.id
    WHERE s.class_id = p_class_id AND sm.exam_type_id = p_exam_id
    GROUP BY sm.subject_id;
END;
$$;


ALTER FUNCTION "public"."get_class_highest_marks"("p_class_id" "uuid", "p_exam_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_academic_year"() RETURNS TABLE("id" "uuid", "name" character varying, "year_name" character varying)
    LANGUAGE "sql" STABLE
    AS $$
  SELECT id, name, year_name 
  FROM public.academic_years 
  WHERE is_current = true 
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_current_academic_year"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_uid"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT auth.uid();
$$;


ALTER FUNCTION "public"."get_current_uid"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_daily_payments"("p_date" "date") RETURNS TABLE("id" "uuid", "receipt_no" character varying, "student_id" "uuid", "student_name" character varying, "admission_no" character varying, "roll_no" character varying, "class_name" character varying, "section_name" character varying, "father_name" character varying, "phone" character varying, "amount" numeric, "payment_method" character varying, "transaction_id" character varying, "payment_date" timestamp with time zone, "created_at" timestamp with time zone, "collected_by" character varying, "note" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fp.id,
    fp.receipt_no,
    fp.student_id,
    COALESCE(s.name, 'Unknown') AS student_name,
    COALESCE(s.admission_no, '') AS admission_no,
    COALESCE(s.roll_no, '') AS roll_no,
    COALESCE(c.name, 'N/A') AS class_name,
    COALESCE(sec.name, 'N/A') AS section_name,
    COALESCE(s.father_name, s.fathers_contact, '') AS father_name,
    COALESCE(s.fathers_contact, s.mothers_contact, '') AS phone,
    fp.amount,
    fp.payment_method,
    fp.transaction_id,
    fp.payment_date,
    fp.created_at,
    fp.collected_by,
    fp.note
  FROM fee_payments fp
  LEFT JOIN students s ON s.id = fp.student_id
  LEFT JOIN classes c ON c.id = s.class_id
  LEFT JOIN sections sec ON sec.id = s.section_id
  WHERE DATE(fp.created_at) = p_date OR DATE(fp.payment_date) = p_date
  ORDER BY fp.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_daily_payments"("p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_due_filter_options"() RETURNS TABLE("classes" json, "sections" json, "due_ranges" json)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  -- Get all classes with due student counts
  RETURN QUERY
  SELECT 
    (SELECT JSON_AGG(
      JSON_BUILD_OBJECT(
        'id', c.id,
        'name', c.name,
        'due_count', COUNT(DISTINCT s.id)
      )
     ) FROM classes c
     LEFT JOIN students s ON s.class_id = c.id
     LEFT JOIN fee_transactions ft ON ft.student_id = s.id AND ft.due_amount > 0
     GROUP BY c.id) AS classes,
     
    (SELECT JSON_AGG(
      JSON_BUILD_OBJECT(
        'id', sec.id,
        'name', sec.name,
        'class_id', sec.class_id
      )
     ) FROM sections sec) AS sections,
     
    (SELECT JSON_AGG(
      JSON_BUILD_OBJECT(
        'label', range_label,
        'min', min_val,
        'max', max_val
      )
     ) FROM (VALUES 
      ('Below 1000', 0, 1000),
      ('1000 - 5000', 1000, 5000),
      ('5000 - 10000', 5000, 10000),
      ('Above 10000', 10000, NULL)
     ) AS ranges(range_label, min_val, max_val)) AS due_ranges;
END;
$$;


ALTER FUNCTION "public"."get_due_filter_options"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_due_students"("p_class_id" "uuid" DEFAULT NULL::"uuid", "p_section_id" "uuid" DEFAULT NULL::"uuid", "p_search" "text" DEFAULT NULL::"text", "p_min_due" numeric DEFAULT NULL::numeric, "p_max_due" numeric DEFAULT NULL::numeric, "p_status" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 1000, "p_offset" integer DEFAULT 0) RETURNS TABLE("student_id" "uuid", "student_name" "text", "admission_no" "text", "roll_no" "text", "class_id" "uuid", "class_name" "text", "section_id" "uuid", "section_name" "text", "father_name" "text", "mother_name" "text", "phone" "text", "email" "text", "total_fees" numeric, "total_paid" numeric, "due_amount" numeric, "last_payment_date" timestamp with time zone, "days_overdue" integer, "overdue_status" "text", "student_status" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  WITH 
  -- 1. Get all fee transactions per student
  fee_summary AS (
    SELECT 
      ft.student_id,
      SUM(ft.amount) AS total_fees,
      SUM(ft.paid_amount) AS total_paid,
      SUM(ft.due_amount) AS due_amount,
      STRING_AGG(DISTINCT ft.status, ',') AS statuses,
      MIN(ft.due_date) AS earliest_due_date
    FROM fee_transactions ft
    WHERE ft.status != 'cancelled'
    GROUP BY ft.student_id
    HAVING SUM(ft.due_amount) > 0
  ),
  
  -- 2. Get last payment date
  last_payment AS (
    SELECT DISTINCT ON (fp.student_id)
      fp.student_id,
      fp.payment_date AS last_payment_date
    FROM fee_payments fp
    ORDER BY fp.student_id, fp.payment_date DESC
  ),
  
  -- 3. Main query with all joins
  due_students AS (
    SELECT 
      -- Student Info
      s.id AS student_id,
      s.name AS student_name,
      s.admission_no,
      s.roll_no,
      
      -- Class & Section
      c.id AS class_id,
      c.name AS class_name,
      sec.id AS section_id,
      sec.name AS section_name,
      
      -- Contact Info
      s.father_name,
      s.mother_name,
      COALESCE(s.fathers_contact, s.mothers_contact, s.contact) AS phone,
      s.email,
      
      -- Fee Summary
      COALESCE(fs.total_fees, 0) AS total_fees,
      COALESCE(fs.total_paid, 0) AS total_paid,
      COALESCE(fs.due_amount, 0) AS due_amount,
      
      -- Payment Tracking
      lp.last_payment_date,
      
      -- Days overdue calculation
      CASE 
        WHEN fs.earliest_due_date IS NULL THEN 0
        WHEN fs.earliest_due_date < CURRENT_DATE 
        THEN EXTRACT(DAY FROM (CURRENT_DATE - fs.earliest_due_date))
        ELSE 0
      END AS days_overdue,
      
      -- Status
      s.status AS student_status,
      s.created_at
      
    FROM students s
    LEFT JOIN classes c ON c.id = s.class_id
    LEFT JOIN sections sec ON sec.id = s.section_id
    LEFT JOIN fee_summary fs ON fs.student_id = s.id
    LEFT JOIN last_payment lp ON lp.student_id = s.id
    
    WHERE s.status = 'active'
      AND COALESCE(fs.due_amount, 0) > 0
  )
  
  -- Apply filters
  SELECT 
    ds.student_id,
    ds.student_name,
    ds.admission_no,
    ds.roll_no,
    ds.class_id,
    ds.class_name,
    ds.section_id,
    ds.section_name,
    ds.father_name,
    ds.mother_name,
    ds.phone,
    ds.email,
    ds.total_fees,
    ds.total_paid,
    ds.due_amount,
    ds.last_payment_date,
    ds.days_overdue,
    CASE 
      WHEN ds.days_overdue > 30 THEN 'Critical'
      WHEN ds.days_overdue > 15 THEN 'High'
      WHEN ds.days_overdue > 7 THEN 'Medium'
      WHEN ds.days_overdue > 0 THEN 'Low'
      ELSE 'Current'
    END AS overdue_status,
    ds.student_status,
    ds.created_at
  FROM due_students ds
  WHERE 
    (p_class_id IS NULL OR ds.class_id = p_class_id)
    AND (p_section_id IS NULL OR ds.section_id = p_section_id)
    AND (p_search IS NULL OR (
      ds.student_name ILIKE '%' || p_search || '%' OR
      ds.admission_no ILIKE '%' || p_search || '%' OR
      ds.roll_no ILIKE '%' || p_search || '%' OR
      ds.father_name ILIKE '%' || p_search || '%' OR
      ds.phone ILIKE '%' || p_search || '%'
    ))
    AND (p_min_due IS NULL OR ds.due_amount >= p_min_due)
    AND (p_max_due IS NULL OR ds.due_amount <= p_max_due)
    AND (p_status IS NULL OR ds.overdue_status = p_status)
  ORDER BY ds.due_amount DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;


ALTER FUNCTION "public"."get_due_students"("p_class_id" "uuid", "p_section_id" "uuid", "p_search" "text", "p_min_due" numeric, "p_max_due" numeric, "p_status" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_due_students_summary"("p_academic_year_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "name" character varying, "admission_no" character varying, "class_name" character varying, "section_name" character varying, "total_due" numeric)
    LANGUAGE "sql"
    AS $$
  SELECT 
    s.id,
    s.name,
    s.admission_no,
    c.name AS class_name,
    sec.name AS section_name,
    COALESCE(SUM(fi.due_amount), 0) AS total_due
  FROM students s
  LEFT JOIN classes c ON c.id = s.class_id
  LEFT JOIN sections sec ON sec.id = s.section_id
  LEFT JOIN fee_invoices fi ON fi.student_id = s.id
    AND (p_academic_year_id IS NULL OR fi.academic_year_id = p_academic_year_id)
  WHERE s.status = 'active'
  GROUP BY s.id, s.name, s.admission_no, c.name, sec.name
  HAVING COALESCE(SUM(fi.due_amount), 0) > 0
  ORDER BY total_due DESC;
$$;


ALTER FUNCTION "public"."get_due_students_summary"("p_academic_year_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_generation_summary"("p_term_id" "uuid", "p_class_id" "uuid", "p_section_id" "uuid") RETURNS TABLE("term_name" character varying, "class_name" character varying, "section_name" character varying, "total_students" bigint, "total_subjects" bigint, "locked_subjects_count" bigint, "is_generated" boolean, "subjects" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
    v_total_students BIGINT;
BEGIN
    -- Get total students
    SELECT COUNT(*) INTO v_total_students
    FROM public.students
    WHERE class_id = p_class_id 
        AND section_id = p_section_id
        AND status = 'active';
    
    RETURN QUERY
    SELECT 
        et.name,
        c.name,
        sec.name,
        v_total_students,
        COUNT(DISTINCT es.id)::BIGINT,
        COUNT(DISTINCT CASE 
            WHEN (
                SELECT COUNT(*) 
                FROM public.student_marks_new smn
                WHERE smn.exam_subject_id = es.id
                    AND smn.entry_status = 'locked'
                    AND smn.term_id = p_term_id
            ) = v_total_students 
            THEN es.id 
        END)::BIGINT,
        EXISTS(SELECT 1 FROM public.compiled_results WHERE term_id = p_term_id LIMIT 1),
        COALESCE(
            (SELECT JSONB_AGG(
                JSONB_BUILD_OBJECT(
                    'exam_subject_id', es.id,
                    'subject_name', s.name,
                    'full_marks', es.full_marks,
                    'pass_marks', es.pass_marks,
                    'total_students', v_total_students,
                    'locked_count', COALESCE(lock_stats.locked_count, 0),
                    'is_fully_locked', COALESCE(lock_stats.locked_count = v_total_students AND v_total_students > 0, FALSE)
                ) ORDER BY s.name
            )
            FROM public.exam_subjects es
            JOIN public.subjects s ON s.id = es.subject_id
            LEFT JOIN LATERAL (
                SELECT COUNT(DISTINCT smn.student_id) as locked_count
                FROM public.student_marks_new smn
                WHERE smn.exam_subject_id = es.id
                    AND smn.entry_status = 'locked'
                    AND smn.term_id = p_term_id
            ) lock_stats ON TRUE
            WHERE es.term_id = p_term_id AND es.class_id = p_class_id),
            '[]'::JSONB
        ) as subjects
    FROM public.exam_terms et
    CROSS JOIN public.classes c
    CROSS JOIN public.sections sec
    LEFT JOIN public.exam_subjects es ON es.term_id = p_term_id AND es.class_id = p_class_id
    LEFT JOIN public.subjects s ON s.id = es.subject_id
    WHERE et.id = p_term_id
        AND c.id = p_class_id
        AND sec.id = p_section_id
    GROUP BY et.name, c.name, sec.name;
END;
$$;


ALTER FUNCTION "public"."get_generation_summary"("p_term_id" "uuid", "p_class_id" "uuid", "p_section_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_gpa_from_percentage"("p_percentage" numeric) RETURNS numeric
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
    v_gpa NUMERIC;
BEGIN
    SELECT grade_point INTO v_gpa
    FROM public.grading_rules
    WHERE p_percentage BETWEEN min_mark AND max_mark
    ORDER BY academic_year_id NULLS LAST
    LIMIT 1;
    
    RETURN COALESCE(v_gpa, 0.00);
END;
$$;


ALTER FUNCTION "public"."get_gpa_from_percentage"("p_percentage" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_grade_from_gpa"("p_gpa" numeric) RETURNS TABLE("grade_name" character varying, "grade_point" numeric, "remarks" character varying)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gs.grade_name::VARCHAR,
        gs.grade_point::NUMERIC,
        gs.remarks::VARCHAR
    FROM public.grading_system gs
    WHERE p_gpa BETWEEN gs.grade_point - 0.01 AND gs.grade_point + 0.99
    ORDER BY gs.grade_point DESC
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            CASE 
                WHEN p_gpa >= 5.00 THEN 'A+'::VARCHAR
                WHEN p_gpa >= 4.00 THEN 'A'::VARCHAR
                WHEN p_gpa >= 3.50 THEN 'A-'::VARCHAR
                WHEN p_gpa >= 3.00 THEN 'B'::VARCHAR
                WHEN p_gpa >= 2.00 THEN 'C'::VARCHAR
                WHEN p_gpa >= 1.00 THEN 'D'::VARCHAR
                ELSE 'F'::VARCHAR
            END AS grade_name,
            FLOOR(p_gpa * 2) / 2 AS grade_point,
            CASE 
                WHEN p_gpa >= 5.00 THEN 'Excellent'::VARCHAR
                WHEN p_gpa >= 4.00 THEN 'Very Good'::VARCHAR
                WHEN p_gpa >= 3.50 THEN 'Good'::VARCHAR
                WHEN p_gpa >= 3.00 THEN 'Satisfactory'::VARCHAR
                WHEN p_gpa >= 2.00 THEN 'Average'::VARCHAR
                WHEN p_gpa >= 1.00 THEN 'Pass'::VARCHAR
                ELSE 'Fail'::VARCHAR
            END AS remarks;
    END IF;
END;
$$;


ALTER FUNCTION "public"."get_grade_from_gpa"("p_gpa" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_grade_from_percentage"("p_percentage" numeric) RETURNS character varying
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
    v_grade VARCHAR;
BEGIN
    SELECT grade_name INTO v_grade
    FROM public.grading_rules
    WHERE p_percentage BETWEEN min_mark AND max_mark
    ORDER BY academic_year_id NULLS LAST
    LIMIT 1;
    
    RETURN COALESCE(v_grade, 'F');
END;
$$;


ALTER FUNCTION "public"."get_grade_from_percentage"("p_percentage" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_grade_from_percentage"("p_percentage" numeric, "p_academic_year_id" "uuid") RETURNS TABLE("grade_name" character varying, "grade_point" numeric)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    RETURN QUERY
    SELECT gr.grade_name, gr.grade_point
    FROM public.grading_rules gr
    WHERE (gr.academic_year_id = p_academic_year_id OR gr.academic_year_id IS NULL)
        AND p_percentage BETWEEN gr.min_mark AND gr.max_mark
    ORDER BY gr.academic_year_id NULLS LAST
    LIMIT 1;
    
    -- Fallback if no grade found
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'F'::VARCHAR(5), 0.00::NUMERIC(3,2);
    END IF;
END;
$$;


ALTER FUNCTION "public"."get_grade_from_percentage"("p_percentage" numeric, "p_academic_year_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_month_range"("p_category_id" "uuid", "p_payment_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_months TEXT[];
  v_frequency TEXT;
  v_custom_months JSONB;
  v_month_count INTEGER;
  v_month_text TEXT;
  v_result TEXT;
  v_year TEXT;
  v_month_num INTEGER;
  v_month_name TEXT;
  v_clean_month TEXT;
BEGIN
  -- ক্যাটাগরির ফ্রিকোয়েন্সি বের করুন
  SELECT frequency, custom_schedule INTO v_frequency, v_custom_months
  FROM fee_categories
  WHERE id = p_category_id;
  
  -- monthly ফি জন্য মাসের তালিকা তৈরি করুন
  IF v_frequency = 'monthly' THEN
    SELECT ARRAY_AGG(month ORDER BY month) INTO v_months
    FROM payment_allocations
    WHERE payment_id = p_payment_id AND category_id = p_category_id
    AND month IS NOT NULL AND month != 'null';
    
    v_month_count := array_length(v_months, 1);
    
    IF v_month_count = 1 THEN
      -- এক মাস
      v_year := SPLIT_PART(v_months[1], '-', 1);
      v_month_num := SPLIT_PART(v_months[1], '-', 2)::INTEGER;
      RETURN TO_CHAR(
        (v_year || '-' || LPAD(v_month_num::TEXT, 2, '0') || '-01')::DATE, 
        'Month YYYY'
      );
    ELSIF v_month_count > 1 THEN
      -- একাধিক মাস
      v_result := '';
      v_year := SPLIT_PART(v_months[1], '-', 1);
      
      FOR i IN 1..v_month_count LOOP
        v_clean_month := REPLACE(REPLACE(REPLACE(v_months[i], '(', ''), ')', ''), ' ', '');
        v_month_num := SPLIT_PART(v_clean_month, '-', 2)::INTEGER;
        v_month_name := TO_CHAR(
          (v_year || '-' || LPAD(v_month_num::TEXT, 2, '0') || '-01')::DATE, 
          'Month'
        );
        v_month_name := TRIM(v_month_name);
        
        IF i > 1 THEN
          v_result := v_result || ', ';
        END IF;
        v_result := v_result || v_month_name;
      END LOOP;
      
      RETURN v_result || ' ' || v_year;
    END IF;
  END IF;
  
  -- custom ফ্রিকোয়েন্সির জন্য
  IF v_frequency = 'custom' AND v_custom_months IS NOT NULL THEN
    -- payment_allocations থেকে আসল ডেটা নিন
    SELECT ARRAY_AGG(month ORDER BY month) INTO v_months
    FROM payment_allocations
    WHERE payment_id = p_payment_id AND category_id = p_category_id
    AND month IS NOT NULL AND month != 'null';
    
    IF v_months IS NOT NULL AND array_length(v_months, 1) > 0 THEN
      v_month_count := array_length(v_months, 1);
      v_result := '';
      v_year := SPLIT_PART(v_months[1], '-', 1);
      
      FOR i IN 1..v_month_count LOOP
        v_clean_month := REPLACE(REPLACE(REPLACE(v_months[i], '(', ''), ')', ''), ' ', '');
        v_month_num := SPLIT_PART(v_clean_month, '-', 2)::INTEGER;
        v_month_name := TO_CHAR(
          (v_year || '-' || LPAD(v_month_num::TEXT, 2, '0') || '-01')::DATE, 
          'Month'
        );
        v_month_name := TRIM(v_month_name);
        
        IF i > 1 THEN
          v_result := v_result || ', ';
        END IF;
        v_result := v_result || v_month_name;
      END LOOP;
      
      RETURN v_result || ' ' || v_year;
    ELSE
      -- custom_schedule থেকে ডেটা ব্যবহার করুন
      SELECT ARRAY_AGG(m::TEXT ORDER BY m::INTEGER) INTO v_months
      FROM jsonb_array_elements_text(v_custom_months->'months') m;
      
      IF v_months IS NOT NULL AND array_length(v_months, 1) > 0 THEN
        v_result := '';
        v_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
        
        FOR i IN 1..array_length(v_months, 1) LOOP
          v_month_num := v_months[i]::INTEGER;
          v_month_name := TO_CHAR(
            (v_year || '-' || LPAD(v_month_num::TEXT, 2, '0') || '-01')::DATE, 
            'Month'
          );
          v_month_name := TRIM(v_month_name);
          
          IF i > 1 THEN
            v_result := v_result || ', ';
          END IF;
          v_result := v_result || v_month_name;
        END LOOP;
        
        RETURN v_result || ' ' || v_year;
      END IF;
    END IF;
  END IF;
  
  -- ডিফল্ট: একক মাস দেখান
  SELECT month INTO v_month_text
  FROM payment_allocations
  WHERE payment_id = p_payment_id AND category_id = p_category_id
  AND month IS NOT NULL AND month != 'null'
  LIMIT 1;
  
  IF v_month_text IS NOT NULL THEN
    v_clean_month := REPLACE(REPLACE(REPLACE(v_month_text, '(', ''), ')', ''), ' ', '');
    v_year := SPLIT_PART(v_clean_month, '-', 1);
    v_month_num := SPLIT_PART(v_clean_month, '-', 2)::INTEGER;
    RETURN TO_CHAR(
      (v_year || '-' || LPAD(v_month_num::TEXT, 2, '0') || '-01')::DATE, 
      'Month YYYY'
    );
  END IF;
  
  RETURN '—';
END;
$$;


ALTER FUNCTION "public"."get_month_range"("p_category_id" "uuid", "p_payment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_monthly_payroll_report"("p_month" integer, "p_year" integer) RETURNS TABLE("total_staff" integer, "total_payroll_payable" numeric, "total_paid_amount" numeric, "total_due_amount" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT sb.staff_id)::INT AS total_staff,
        COALESCE(SUM(sb.expected_salary), 0) AS total_payroll_payable,  -- ✅ FIXED
        COALESCE(SUM(sb.paid_amount), 0) AS total_paid_amount,
        COALESCE(SUM(sb.due_amount), 0) AS total_due_amount
    FROM public.salary_balances sb
    WHERE sb.month = (
      CASE p_month
        WHEN 1  THEN 'January'   WHEN 2  THEN 'February'
        WHEN 3  THEN 'March'     WHEN 4  THEN 'April'
        WHEN 5  THEN 'May'       WHEN 6  THEN 'June'
        WHEN 7  THEN 'July'      WHEN 8  THEN 'August'
        WHEN 9  THEN 'September' WHEN 10 THEN 'October'
        WHEN 11 THEN 'November'  WHEN 12 THEN 'December'
        ELSE p_month::text
      END
    )
    AND sb.year = p_year;
END;
$$;


ALTER FUNCTION "public"."get_monthly_payroll_report"("p_month" integer, "p_year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_staff_payslip_data"("p_staff_id" "uuid", "p_month" integer, "p_year" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_result JSONB;
  v_month_str text;
BEGIN
  v_month_str := CASE p_month
    WHEN 1  THEN 'January'   WHEN 2  THEN 'February'
    WHEN 3  THEN 'March'     WHEN 4  THEN 'April'
    WHEN 5  THEN 'May'       WHEN 6  THEN 'June'
    WHEN 7  THEN 'July'      WHEN 8  THEN 'August'
    WHEN 9  THEN 'September' WHEN 10 THEN 'October'
    WHEN 11 THEN 'November'  WHEN 12 THEN 'December'
    ELSE p_month::text
  END;

  SELECT jsonb_build_object(
    'staff_id', st.id,
    'staff_name', st.name,
    'designation', st.designation,
    'joining_date', st.joining_date,
    'resign_date', st.resign_date,
    'month', p_month,
    'year', p_year,
    'basic_salary', COALESCE(calc.basic_salary, 0),
    'house_rent', COALESCE(calc.house_rent, 0),
    'medical_allowance', COALESCE(calc.medical_allowance, 0),
    'conveyance', COALESCE(calc.conveyance, 0),
    'total_allowance', COALESCE(calc.total_allowance, 0),
    'total_deduction', COALESCE(calc.total_deduction, 0),
    -- ✅ FIX: use expected_salary as fallback instead of balance
    'net_salary', COALESCE(sb.expected_salary, calc.net_salary, 0),
    'paid_amount', COALESCE(sb.paid_amount, 0),
    'due_amount', COALESCE(sb.due_amount, calc.net_salary, 0),
    'status', COALESCE(sb.status, 'unpaid'),
    'due_date', sb.due_date,
    'is_pro_rata', COALESCE(calc.is_pro_rata, false),
    'days_worked', COALESCE(calc.days_worked, 0),
    'days_in_month', COALESCE(calc.days_in_month, 30),
    'is_blocked', COALESCE(calc.is_blocked, false),
    'block_reason', calc.block_reason
  ) INTO v_result
  FROM public.staff st
  LEFT JOIN public.calculate_staff_salary(st.id, p_month, p_year) calc ON true
  LEFT JOIN public.salary_balances sb 
         ON sb.staff_id = st.id 
         AND sb.month = v_month_str
         AND sb.year = p_year
  WHERE st.id = p_staff_id;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_staff_payslip_data"("p_staff_id" "uuid", "p_month" integer, "p_year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_student_due_details"("p_student_id" "uuid", "p_academic_year_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("month" "text", "category_name" "text", "expected_amount" numeric, "paid_amount" numeric, "due_amount" numeric, "fine_amount" numeric, "discount_amount" numeric, "status" "text", "due_date" "date", "is_advance" boolean, "days_overdue" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sfd.month::TEXT,
        COALESCE(fc.name, 'N/A')::TEXT AS category_name,
        sfd.expected_amount,
        sfd.paid_amount,
        sfd.due_amount,
        sfd.fine_amount,
        sfd.discount_amount,
        sfd.status::TEXT,
        sfd.due_date,
        sfd.is_advance,
        CASE 
            WHEN sfd.due_date < CURRENT_DATE AND sfd.due_amount > 0 
            THEN (CURRENT_DATE - sfd.due_date)::INTEGER
            ELSE 0
        END AS days_overdue
    FROM public.student_fee_dues sfd
    LEFT JOIN public.fee_categories fc ON fc.id = sfd.category_id
    WHERE sfd.student_id = p_student_id
        AND (p_academic_year_id IS NULL OR sfd.academic_year_id = p_academic_year_id)
        AND sfd.due_amount > 0
    ORDER BY sfd.month ASC, fc.name ASC;
END;
$$;


ALTER FUNCTION "public"."get_student_due_details"("p_student_id" "uuid", "p_academic_year_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_student_fee_summary"("p_student_id" "uuid", "p_academic_year_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_result jsonb;
    v_categories jsonb := '[]'::jsonb;
    v_category_map jsonb := '{}'::jsonb;
    v_total_expected numeric := 0;
    v_total_paid numeric := 0;
    v_total_due numeric := 0;
    v_total_fine numeric := 0;
    v_total_discount numeric := 0;
    v_total_advance numeric := 0;
    v_records RECORD;
    v_existing jsonb;
    v_months jsonb;
BEGIN
    -- ─────────────────────────────────────────
    -- 1. Loop through student_fee_dues
    -- ─────────────────────────────────────────
    FOR v_records IN
        SELECT 
            sfd.category_id,
            COALESCE(fc.name, 'Unknown') AS category_name,
            sfd.month,
            sfd.expected_amount,
            sfd.paid_amount,
            sfd.due_amount,
            sfd.fine_amount,
            sfd.discount_amount,
            sfd.status,
            sfd.due_date,
            sfd.is_advance
        FROM public.student_fee_dues sfd
        LEFT JOIN public.fee_categories fc ON fc.id = sfd.category_id
        WHERE sfd.student_id = p_student_id
          AND (p_academic_year_id IS NULL OR sfd.academic_year_id = p_academic_year_id)
        ORDER BY sfd.month ASC
    LOOP
        v_total_expected := v_total_expected + COALESCE(v_records.expected_amount, 0);
        v_total_paid := v_total_paid + COALESCE(v_records.paid_amount, 0);
        v_total_due := v_total_due + COALESCE(v_records.due_amount, 0);
        v_total_fine := v_total_fine + COALESCE(v_records.fine_amount, 0);
        v_total_discount := v_total_discount + COALESCE(v_records.discount_amount, 0);

        IF v_records.category_id IS NOT NULL THEN
            IF NOT v_category_map ? (v_records.category_id::text) THEN
                -- নতুন category entry
                v_category_map := v_category_map || jsonb_build_object(
                    v_records.category_id::text,
                    jsonb_build_object(
                        'category_id', v_records.category_id,
                        'category_name', v_records.category_name,
                        'total_expected', COALESCE(v_records.expected_amount, 0),
                        'total_paid', COALESCE(v_records.paid_amount, 0),
                        'total_due', COALESCE(v_records.due_amount, 0),
                        'total_fine', COALESCE(v_records.fine_amount, 0),
                        'total_discount', COALESCE(v_records.discount_amount, 0),
                        'months', jsonb_build_array(
                            jsonb_build_object(
                                'month', v_records.month,
                                'expected', COALESCE(v_records.expected_amount, 0),
                                'paid', COALESCE(v_records.paid_amount, 0),
                                'due', COALESCE(v_records.due_amount, 0),
                                'fine', COALESCE(v_records.fine_amount, 0),
                                'discount', COALESCE(v_records.discount_amount, 0),
                                'status', v_records.status,
                                'due_date', v_records.due_date,
                                'is_advance', v_records.is_advance
                            )
                        )
                    )
                );
            ELSE
                -- Existing category — aggregate
                v_existing := v_category_map -> (v_records.category_id::text);
                v_existing := jsonb_set(v_existing, '{total_expected}',
                    to_jsonb(((v_existing->>'total_expected')::numeric + COALESCE(v_records.expected_amount, 0))));
                v_existing := jsonb_set(v_existing, '{total_paid}',
                    to_jsonb(((v_existing->>'total_paid')::numeric + COALESCE(v_records.paid_amount, 0))));
                v_existing := jsonb_set(v_existing, '{total_due}',
                    to_jsonb(((v_existing->>'total_due')::numeric + COALESCE(v_records.due_amount, 0))));
                v_existing := jsonb_set(v_existing, '{total_fine}',
                    to_jsonb(((v_existing->>'total_fine')::numeric + COALESCE(v_records.fine_amount, 0))));
                v_existing := jsonb_set(v_existing, '{total_discount}',
                    to_jsonb(((v_existing->>'total_discount')::numeric + COALESCE(v_records.discount_amount, 0))));
                
                v_months := v_existing->'months';
                v_months := v_months || jsonb_build_object(
                    'month', v_records.month,
                    'expected', COALESCE(v_records.expected_amount, 0),
                    'paid', COALESCE(v_records.paid_amount, 0),
                    'due', COALESCE(v_records.due_amount, 0),
                    'fine', COALESCE(v_records.fine_amount, 0),
                    'discount', COALESCE(v_records.discount_amount, 0),
                    'status', v_records.status,
                    'due_date', v_records.due_date,
                    'is_advance', v_records.is_advance
                );
                v_existing := jsonb_set(v_existing, '{months}', v_months);
                v_category_map := v_category_map || jsonb_build_object(v_records.category_id::text, v_existing);
            END IF;
        END IF;
    END LOOP;

    -- ─────────────────────────────────────────
    -- 2. Build categories array
    -- ─────────────────────────────────────────
    IF v_category_map != '{}'::jsonb THEN
        SELECT jsonb_agg(value) INTO v_categories FROM jsonb_each(v_category_map);
    END IF;

    -- ─────────────────────────────────────────
    -- 3. Advance total (fee_payments-এ academic_year_id নেই!)
    --    তাই payment_allocations-এর month বা filter ছাড়াই
    -- ─────────────────────────────────────────
    SELECT COALESCE(SUM(pa.amount), 0)
    INTO v_total_advance
    FROM public.payment_allocations pa
    JOIN public.fee_payments fp ON fp.id = pa.payment_id
    WHERE fp.student_id = p_student_id
      AND pa.allocation_type = ANY (ARRAY['advance', 'advance_global'])
      AND pa.amount > 0;

    -- ─────────────────────────────────────────
    -- 4. Build final result (same structure রাখা)
    -- ─────────────────────────────────────────
    v_result := jsonb_build_object(
        'summary', jsonb_build_object(
            'total_expected', v_total_expected,
            'total_paid', v_total_paid,
            'total_due', v_total_due,
            'total_fine', v_total_fine,
            'total_discount', v_total_discount,
            'total_advance', v_total_advance,
            'net_due', GREATEST(0, v_total_due - v_total_advance)
        ),
        'category_breakdown', v_categories,
        'total_months_with_due', (
            SELECT COUNT(DISTINCT month)
            FROM public.student_fee_dues
            WHERE student_id = p_student_id
              AND (p_academic_year_id IS NULL OR academic_year_id = p_academic_year_id)
              AND due_amount > 0
        )
    );

    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_student_fee_summary"("p_student_id" "uuid", "p_academic_year_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_student_rank"("p_class_id" "uuid", "p_exam_id" "uuid", "p_student_id" "uuid") RETURNS TABLE("rank_string" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_rank INT;
BEGIN
    WITH ranked_students AS (
        SELECT student_id, 
               RANK() OVER (ORDER BY SUM(ct_marks + exam_marks) DESC) as student_rank
        FROM student_marks
        WHERE exam_type_id = p_exam_id
        GROUP BY student_id
    )
    SELECT student_rank INTO v_rank FROM ranked_students WHERE student_id = p_student_id;
    
    -- পজিশন সাফিক্স (1st, 2nd, 3rd) ফরম্যাট করা
    IF v_rank = 1 THEN rank_string := '1st';
    ELSIF v_rank = 2 THEN rank_string := '2nd';
    ELSIF v_rank = 3 THEN rank_string := '3rd';
    ELSE rank_string := v_rank || 'th';
    END IF;
    
    RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."get_student_rank"("p_class_id" "uuid", "p_exam_id" "uuid", "p_student_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_tabulation_sheet"("p_term_id" "uuid", "p_class_id" "uuid", "p_section_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("student_id" "uuid", "class_roll" character varying, "student_name" character varying, "father_name" character varying, "mother_name" character varying, "admission_no" character varying, "photo_url" "text", "subjects" "jsonb", "total_marks_obtained" bigint, "total_full_marks" bigint, "percentage" numeric, "gpa" numeric, "letter_grade" character varying, "section_rank" bigint, "class_rank" bigint, "pass_fail_status" "text", "failed_subjects" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_academic_year_id UUID;
    v_elective_bonus_points INTEGER := 2;
BEGIN
    -- Get academic year
    SELECT academic_year_id INTO v_academic_year_id
    FROM public.exam_terms
    WHERE id = p_term_id;

    IF v_academic_year_id IS NULL THEN
        RAISE EXCEPTION 'Invalid term_id: %', p_term_id;
    END IF;

    -- Get bonus policy
    SELECT COALESCE(
        (setting_value->>'elective_bonus_points')::INTEGER,
        v_elective_bonus_points
    )
    INTO v_elective_bonus_points
    FROM public.exam_settings_new
    WHERE academic_year_id = v_academic_year_id
      AND setting_key = 'bonus_policy';

    RETURN QUERY
    WITH student_marks AS (
        SELECT
            s.id AS student_id,
            s.class_roll AS roll_no,
            s.name,
            s.father_name,
            s.mother_name,
            s.student_id AS admission_no,  -- এখানে ঠিক করা হয়েছে (admission_no এর পরিবর্তে student_id)
            s.student_photo_url AS photo_url,
            s.section_id,
            es.id AS exam_subject_id,
            es.subject_id,
            sub.name AS subject_name,
            es.subject_type,
            es.full_marks,
            es.pass_marks,
            COALESCE(sm.marks_obtained, 0) AS marks_obtained,
            COALESCE(sm.is_absent, false) AS is_absent,
            COALESCE(
                (SELECT gr.grade_point 
                 FROM public.grading_rules gr
                 WHERE (gr.academic_year_id = v_academic_year_id OR gr.academic_year_id IS NULL)
                   AND COALESCE(sm.marks_obtained, 0) BETWEEN gr.min_mark AND gr.max_mark
                 ORDER BY gr.academic_year_id NULLS LAST
                 LIMIT 1),
                0.00
            ) AS grade_point,
            COALESCE(
                (SELECT gr.grade_name 
                 FROM public.grading_rules gr
                 WHERE (gr.academic_year_id = v_academic_year_id OR gr.academic_year_id IS NULL)
                   AND COALESCE(sm.marks_obtained, 0) BETWEEN gr.min_mark AND gr.max_mark
                 ORDER BY gr.academic_year_id NULLS LAST
                 LIMIT 1),
                'F'
            ) AS grade_name,
            (NOT COALESCE(sm.is_absent, false) AND COALESCE(sm.marks_obtained, 0) >= es.pass_marks) AS is_passed,
            ROUND((COALESCE(sm.marks_obtained, 0) * 100.0 / NULLIF(es.full_marks, 0))::NUMERIC, 2) AS subject_percentage,
            (SELECT MAX(sm2.marks_obtained) 
             FROM public.student_marks_new sm2
             WHERE sm2.exam_subject_id = es.id
               AND sm2.term_id = p_term_id
               AND sm2.entry_status IN ('locked', 'verified')
               AND sm2.is_absent = false) AS highest_marks
        FROM public.students s
        CROSS JOIN public.exam_subjects es
        JOIN public.subjects sub ON sub.id = es.subject_id
        LEFT JOIN public.student_marks_new sm
            ON sm.student_id = s.id
            AND sm.exam_subject_id = es.id
            AND sm.term_id = p_term_id
            AND sm.entry_status IN ('locked', 'verified')
        WHERE s.status = 'active'
          AND s.class_id = p_class_id
          AND (p_section_id IS NULL OR s.section_id = p_section_id)
          AND es.term_id = p_term_id
          AND es.class_id = p_class_id
          AND (es.section_id IS NULL OR es.section_id = p_section_id OR p_section_id IS NULL)
    ),
    aggregated AS (
        SELECT
            sm.student_id,
            sm.roll_no,
            sm.name,
            sm.father_name,
            sm.mother_name,
            sm.admission_no,
            sm.photo_url,
            sm.section_id,
            SUM(sm.marks_obtained) AS total_marks_obtained,
            SUM(sm.full_marks) AS total_full_marks,
            ROUND((SUM(sm.marks_obtained) * 100.0 / NULLIF(SUM(sm.full_marks), 0))::NUMERIC, 2) AS percentage,
            ARRAY_AGG(
                CASE WHEN sm.subject_type = 'compulsory' 
                     AND NOT sm.is_absent 
                     AND sm.is_passed 
                THEN sm.grade_point ELSE NULL END
            ) FILTER (WHERE sm.subject_type = 'compulsory') AS compulsory_gps,
            COUNT(CASE WHEN sm.subject_type = 'compulsory' THEN 1 END) AS compulsory_count,
            ARRAY_AGG(
                CASE WHEN sm.subject_type IN ('elective', 'optional') 
                     AND NOT sm.is_absent 
                     AND sm.is_passed 
                THEN sm.grade_point ELSE NULL END
            ) FILTER (WHERE sm.subject_type IN ('elective', 'optional')) AS elective_gps,
            BOOL_OR(sm.subject_type = 'compulsory' AND (NOT sm.is_passed OR sm.is_absent)) AS has_failed,
            JSONB_AGG(
                JSONB_BUILD_OBJECT(
                    'subject_name', sm.subject_name,
                    'subject_type', sm.subject_type,
                    'full_marks', sm.full_marks,
                    'marks_obtained', sm.marks_obtained,
                    'pass_marks', sm.pass_marks,
                    'percentage', sm.subject_percentage,
                    'is_absent', sm.is_absent,
                    'is_passed', sm.is_passed,
                    'grade', sm.grade_name,
                    'grade_point', sm.grade_point,
                    'highest_marks', sm.highest_marks
                )
                ORDER BY sm.subject_name
            ) AS subjects_json,
            JSONB_AGG(
                JSONB_BUILD_OBJECT(
                    'subject_id', sm.subject_id,
                    'subject_name', sm.subject_name,
                    'subject_type', sm.subject_type,
                    'marks_obtained', sm.marks_obtained,
                    'pass_marks', sm.pass_marks,
                    'percentage', sm.subject_percentage,
                    'is_absent', sm.is_absent,
                    'grade', sm.grade_name
                )
            ) FILTER (WHERE NOT sm.is_passed OR sm.is_absent) AS failed_subjects_json
        FROM student_marks sm
        GROUP BY sm.student_id, sm.roll_no, sm.name, sm.father_name, 
                 sm.mother_name, sm.admission_no, sm.photo_url, sm.section_id
    ),
    gpa_calc AS (
        SELECT
            a.*,
            COALESCE(
                ROUND(
                    (SELECT COALESCE(SUM(gp), 0) FROM unnest(a.compulsory_gps) AS gp WHERE gp IS NOT NULL)::NUMERIC 
                    / NULLIF(a.compulsory_count, 0),
                    2
                ),
                0
            ) AS compulsory_gpa,
            COALESCE(
                (SELECT COALESCE(SUM(GREATEST(0, gp - v_elective_bonus_points)), 0) 
                 FROM unnest(a.elective_gps) AS gp 
                 WHERE gp IS NOT NULL),
                0
            ) AS elective_bonus
        FROM aggregated a
    ),
    final_calc AS (
        SELECT
            gc.*,
            CASE
                WHEN gc.has_failed OR gc.compulsory_count = 0 THEN 0.00
                ELSE LEAST(
                    ROUND(
                        (gc.compulsory_gpa * gc.compulsory_count + gc.elective_bonus) 
                        / gc.compulsory_count,
                        2
                    ),
                    5.00
                )
            END AS final_gpa,
            CASE
                WHEN gc.has_failed THEN 'Failed'
                ELSE 'Passed'
            END AS pass_fail_status
        FROM gpa_calc gc
    ),
    with_grade AS (
        SELECT
            fc.*,
            COALESCE(
                (SELECT grade_name FROM public.get_grade_from_gpa(fc.final_gpa) LIMIT 1),
                'F'
            ) AS letter_grade
        FROM final_calc fc
    ),
    ranked AS (
        SELECT
            wg.student_id,
            ROW_NUMBER() OVER (ORDER BY wg.final_gpa DESC, wg.total_marks_obtained DESC) AS class_rank,
            ROW_NUMBER() OVER (PARTITION BY wg.section_id ORDER BY wg.final_gpa DESC, wg.total_marks_obtained DESC) AS section_rank
        FROM with_grade wg
    )
    SELECT
        wg.student_id,
        wg.roll_no::VARCHAR AS class_roll,
        wg.name::VARCHAR AS student_name,
        wg.father_name::VARCHAR,
        wg.mother_name::VARCHAR,
        wg.admission_no::VARCHAR,  -- এখানে admission_no হিসেবে আউটপুট দিচ্ছে
        wg.photo_url::TEXT,
        wg.subjects_json::JSONB AS subjects,
        wg.total_marks_obtained::BIGINT,
        wg.total_full_marks::BIGINT,
        wg.percentage::NUMERIC(5,2),
        wg.final_gpa::NUMERIC(3,2) AS gpa,
        wg.letter_grade::VARCHAR(5),
        COALESCE(r.section_rank, 0)::BIGINT AS section_rank,
        COALESCE(r.class_rank, 0)::BIGINT AS class_rank,
        wg.pass_fail_status::TEXT,
        COALESCE(wg.failed_subjects_json, '[]'::JSONB) AS failed_subjects
    FROM with_grade wg
    LEFT JOIN ranked r ON r.student_id = wg.student_id
    ORDER BY wg.final_gpa DESC, wg.total_marks_obtained DESC;
END;
$$;


ALTER FUNCTION "public"."get_tabulation_sheet"("p_term_id" "uuid", "p_class_id" "uuid", "p_section_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_academic_year_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- যদি নতুন রেকর্ডে is_current = true হয়
    IF NEW.is_current = true AND (OLD.is_current = false OR OLD.is_current IS NULL) THEN
        
        -- পুরানো শিক্ষাবর্ষের বকেয়া ক্যারি ফরওয়ার্ড করো
        PERFORM public.carry_forward_due();
        
        -- নতুন শিক্ষাবর্ষের জন্য ইনভয়েস তৈরি করো (ঐচ্ছিক)
        PERFORM public.generate_monthly_invoices();
        
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_academic_year_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_current_staff_salary"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.is_current = TRUE THEN
        UPDATE public.staff_salaries
        SET is_current = FALSE
        WHERE staff_id = NEW.staff_id AND id <> NEW.id;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_current_staff_salary"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_requested_role text;
  v_safe_role text;
BEGIN
  v_requested_role := LOWER(COALESCE(NEW.raw_user_meta_data->>'role', 'staff'));

  -- ✅ Only valid roles from constraint (admin blocked for security)
  IF v_requested_role IN (
    'teacher',
    'staff',
    'accountant',
    'store',
    'student',
    'user'
  ) THEN
    v_safe_role := v_requested_role;
  ELSE
    -- Log warning for admin/invalid roles
    RAISE WARNING 'handle_new_user: invalid role "%" for user %, falling back to staff',
      v_requested_role, NEW.id;
    v_safe_role := 'staff';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    v_safe_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("roles" "text"[]) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_catalog'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role::text = ANY(roles)
    LIMIT 1
  );
$$;


ALTER FUNCTION "public"."has_role"("roles" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_role text;
  v_jwt_role text;
BEGIN
  -- service_role bypass
  v_jwt_role := current_setting('request.jwt.claim.role', true);
  IF v_jwt_role = 'service_role' THEN
    RETURN true;
  END IF;

  -- postgres superuser bypass
  IF current_user = 'postgres' THEN
    RETURN true;
  END IF;

  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = v_user_id
  LIMIT 1;

  RETURN (v_role = 'admin');
END;
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_student_user"("p_student_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.students
  SET user_id = p_user_id, updated_at = NOW()
  WHERE id = p_student_id;

  -- Also update profile with student_id reference (optional)
  UPDATE public.profiles
  SET role = 'student'
  WHERE id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."link_student_user"("p_student_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lock_term_marks"("p_term_id" "uuid", "p_class_id" "uuid", "p_subject_id" "uuid", "p_locked_by" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    UPDATE student_marks_new
    SET 
        entry_status = 'locked',
        locked_by = p_locked_by,
        locked_at = NOW()
    WHERE term_id = p_term_id
      AND exam_subject_id IN (
          SELECT id FROM exam_subjects 
          WHERE term_id = p_term_id 
            AND class_id = p_class_id 
            AND subject_id = p_subject_id
      )
      AND entry_status = 'verified';
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RETURN v_updated_count;
END;
$$;


ALTER FUNCTION "public"."lock_term_marks"("p_term_id" "uuid", "p_class_id" "uuid", "p_subject_id" "uuid", "p_locked_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_fee_assignment_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_changes JSONB := '{}'::jsonb;
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.fee_assignment_history (
            assignment_id, student_id, action,
            new_structure_id, new_effective_from, new_effective_to,
            new_is_active, changed_by, reason
        ) VALUES (
            NEW.id, NEW.student_id, 'INSERT',
            NEW.fee_structure_id, NEW.effective_from, NEW.effective_to,
            NEW.is_active, auth.uid(), 'Assignment created'
        );
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.fee_structure_id IS DISTINCT FROM NEW.fee_structure_id THEN
            v_changes = jsonb_set(v_changes, '{fee_structure_id}', 
                jsonb_build_object('old', OLD.fee_structure_id, 'new', NEW.fee_structure_id));
        END IF;
        
        IF OLD.effective_from IS DISTINCT FROM NEW.effective_from THEN
            v_changes = jsonb_set(v_changes, '{effective_from}', 
                jsonb_build_object('old', OLD.effective_from, 'new', NEW.effective_from));
        END IF;
        
        IF OLD.effective_to IS DISTINCT FROM NEW.effective_to THEN
            v_changes = jsonb_set(v_changes, '{effective_to}', 
                jsonb_build_object('old', OLD.effective_to, 'new', NEW.effective_to));
        END IF;
        
        IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
            v_changes = jsonb_set(v_changes, '{is_active}', 
                jsonb_build_object('old', OLD.is_active, 'new', NEW.is_active));
        END IF;
        
        IF v_changes != '{}'::jsonb THEN
            INSERT INTO public.fee_assignment_history (
                assignment_id, student_id, action,
                old_structure_id, new_structure_id,
                old_effective_from, new_effective_from,
                old_effective_to, new_effective_to,
                old_is_active, new_is_active, changes, changed_by
            ) VALUES (
                NEW.id, NEW.student_id, 'UPDATE',
                OLD.fee_structure_id, NEW.fee_structure_id,
                OLD.effective_from, NEW.effective_from,
                OLD.effective_to, NEW.effective_to,
                OLD.is_active, NEW.is_active, v_changes, auth.uid()
            );
        END IF;
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        -- ✅ FIX: assignment_id = NULL (row deleted)
        INSERT INTO public.fee_assignment_history (
            assignment_id, student_id, action,
            old_structure_id, old_effective_from, old_effective_to,
            old_is_active, changed_by, reason
        ) VALUES (
            NULL, OLD.student_id, 'DELETE',
            OLD.fee_structure_id, OLD.effective_from, OLD.effective_to,
            OLD.is_active, auth.uid(), 'Assignment deleted'
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."log_fee_assignment_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_salary_version_history"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.total_salary IS DISTINCT FROM NEW.total_salary) THEN
        INSERT INTO salary_version_history (
            salary_id,
            staff_id,
            old_total,
            new_total,
            changed_by,
            change_reason
        ) VALUES (
            NEW.id,
            NEW.staff_id,
            OLD.total_salary,
            NEW.total_salary,
            auth.uid(),
            'Salary updated'
        );
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_salary_version_history"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_due_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM pg_notify(
    'due_changes',
    JSON_BUILD_OBJECT(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'student_id', COALESCE(NEW.student_id, OLD.student_id),
      'timestamp', NOW()
    )::TEXT
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_due_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."populate_student_fee_dues_from_transactions"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_count INT := 0;
    v_errors JSONB := '[]'::JSONB;
    v_record RECORD;
    v_academic_year_id UUID;
    v_month TEXT;
    v_category_id UUID;
    v_student_id UUID;
BEGIN
    -- Get current academic year
    SELECT id INTO v_academic_year_id
    FROM public.academic_years
    WHERE is_current = TRUE
    LIMIT 1;
    
    IF v_academic_year_id IS NULL THEN
        RAISE EXCEPTION 'No current academic year found';
    END IF;
    
    -- Loop through fee_transactions with due_amount
    FOR v_record IN
        SELECT 
            ft.student_id,
            ft.category_id,
            ft.month,
            ft.due_amount,
            ft.amount,
            ft.paid_amount,
            ft.status,
            ft.due_date,
            ft.discount,
            ft.fine
        FROM public.fee_transactions ft
        WHERE ft.due_amount > 0
          AND ft.status != 'cancelled'
          AND ft.student_id IS NOT NULL
        ORDER BY ft.student_id, ft.month
    LOOP
        BEGIN
            v_student_id := v_record.student_id;
            v_category_id := v_record.category_id;
            v_month := v_record.month;
            
            -- Insert or update into student_fee_dues
            INSERT INTO public.student_fee_dues (
                student_id,
                category_id,
                academic_year_id,
                month,
                expected_amount,
                paid_amount,
                due_amount,
                discount_amount,
                fine_amount,
                status,
                due_date,
                paid_date,
                is_advance,
                created_at,
                updated_at
            ) VALUES (
                v_student_id,
                v_category_id,
                v_academic_year_id,
                v_month,
                v_record.amount,
                v_record.paid_amount,
                v_record.due_amount,
                COALESCE(v_record.discount, 0),
                COALESCE(v_record.fine, 0),
                CASE 
                    WHEN v_record.due_amount <= 0 THEN 'paid'
                    WHEN v_record.paid_amount > 0 THEN 'partial'
                    WHEN v_record.due_date < CURRENT_DATE THEN 'overdue'
                    ELSE 'pending'
                END,
                v_record.due_date,
                CASE WHEN v_record.due_amount <= 0 THEN CURRENT_DATE ELSE NULL END,
                FALSE,
                NOW(),
                NOW()
            )
            ON CONFLICT (student_id, category_id, month, academic_year_id) DO UPDATE SET
                expected_amount = EXCLUDED.expected_amount,
                paid_amount = EXCLUDED.paid_amount,
                due_amount = EXCLUDED.due_amount,
                discount_amount = EXCLUDED.discount_amount,
                fine_amount = EXCLUDED.fine_amount,
                status = EXCLUDED.status,
                due_date = EXCLUDED.due_date,
                updated_at = NOW();
            
            v_count := v_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            v_errors := v_errors || jsonb_build_object(
                'student_id', v_record.student_id,
                'month', v_record.month,
                'error', SQLERRM
            );
        END;
    END LOOP;
    
    RETURN jsonb_build_object(
        'total_processed', v_count,
        'errors', v_errors
    );
END;
$$;


ALTER FUNCTION "public"."populate_student_fee_dues_from_transactions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_role_escalation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_caller_role text;
  v_jwt_role text;
BEGIN
  v_jwt_role := current_setting('request.jwt.claim.role', true);

  IF v_jwt_role = 'service_role' OR v_jwt_role IS NULL OR v_jwt_role = '' THEN
    RETURN NEW;
  END IF;

  IF OLD.role IS DISTINCT FROM NEW.role THEN
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'Role change not permitted';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_role_escalation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_advance_payment_manual"("p_student_id" "uuid", "p_amount" numeric, "p_payment_method" character varying, "p_receipt_no" character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_current_month INT;
    v_next_month INT;
    v_advance_amount NUMERIC;
    v_invoice_id UUID;
    v_academic_year_id UUID;
BEGIN
    v_current_month := EXTRACT(MONTH FROM CURRENT_DATE);
    v_next_month := v_current_month + 1;
    v_advance_amount := p_amount - 1630;
    
    -- Academic Year পাওয়া
    SELECT academic_year_id INTO v_academic_year_id
    FROM public.fee_student_assignments 
    WHERE student_id = p_student_id AND is_active = true 
    LIMIT 1;
    
    -- অ্যাডভান্স ব্যালেন্স ইনসার্ট/আপডেট
    INSERT INTO public.advance_payments (student_id, amount, remaining_balance)
    VALUES (p_student_id, v_advance_amount, v_advance_amount)
    ON CONFLICT (id) DO UPDATE
    SET remaining_balance = advance_payments.remaining_balance + v_advance_amount,
        updated_at = NOW()
    WHERE advance_payments.student_id = p_student_id;
    
    -- অ্যাডভান্স ইনভয়েস তৈরি
    INSERT INTO public.fee_invoices (
        student_id,
        academic_year_id,
        month,
        amount,
        total,
        paid_amount,
        due_amount,
        status,
        due_date,
        is_advance_invoice,
        created_at,
        updated_at
    ) VALUES (
        p_student_id,
        v_academic_year_id,
        v_next_month,
        v_advance_amount,
        v_advance_amount,
        0,
        v_advance_amount,
        'pending',
        CURRENT_DATE + INTERVAL '15 days',
        true,
        NOW(),
        NOW()
    ) RETURNING id INTO v_invoice_id;
    
    RETURN JSONB_BUILD_OBJECT(
        'success', true,
        'invoice_id', v_invoice_id,
        'advance_amount', v_advance_amount,
        'next_month', v_next_month
    );
END;
$$;


ALTER FUNCTION "public"."process_advance_payment_manual"("p_student_id" "uuid", "p_amount" numeric, "p_payment_method" character varying, "p_receipt_no" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_fee_payment"("p_payment_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_payment RECORD;
    v_student_id UUID;
    v_academic_year_id UUID;
    v_academic_year RECORD;
    v_payment_date DATE;
    v_amount NUMERIC;
    v_discount_amount NUMERIC;
    v_fine_amount NUMERIC;
    v_net_amount NUMERIC;
    v_payment_month TEXT;
    v_remaining_amount NUMERIC;
    v_allocated_amount NUMERIC;
    v_due_record RECORD;
    v_total_allocated NUMERIC := 0;
    v_result JSONB := '[]'::JSONB;
    v_allocations JSONB;
    v_alloc_record RECORD;
    v_category_id UUID;
    v_requested_amount NUMERIC;
    v_has_allocations BOOLEAN := FALSE;
    v_advance_month DATE;
    v_advance_month_end DATE;
    v_category_monthly_amount NUMERIC;
    v_category_frequency TEXT;
    v_category_custom_schedule JSONB;
    v_category_due_day INT;
BEGIN
    -- ══════════════════════════════════════════════════════════════
    -- STEP 0: Load payment + allocations
    -- ══════════════════════════════════════════════════════════════
    SELECT 
        fp.*,
        COALESCE(fp.discount_amount, 0) as discount_amount,
        COALESCE(fp.fine_amount, 0) as fine_amount,
        COALESCE(fp.paid_amount, fp.amount) as paid_amount
    INTO v_payment
    FROM public.fee_payments fp
    WHERE fp.id = p_payment_id
    FOR UPDATE;
    
    IF v_payment IS NULL THEN
        RAISE EXCEPTION 'Payment not found: %', p_payment_id;
    END IF;
    
    v_student_id := v_payment.student_id;
    v_payment_date := COALESCE(v_payment.payment_date, CURRENT_DATE);
    v_amount := v_payment.amount;
    v_discount_amount := v_payment.discount_amount;
    v_fine_amount := v_payment.fine_amount;
    v_net_amount := v_amount - v_discount_amount + v_fine_amount;
    v_payment_month := TO_CHAR(v_payment_date, 'YYYY-MM');
    v_remaining_amount := v_net_amount;
    v_allocations := v_payment.allocations;
    
    -- ══════════════════════════════════════════════════════════════
    -- STEP 1: Get academic year
    -- ══════════════════════════════════════════════════════════════
    SELECT academic_year_id INTO v_academic_year_id
    FROM public.fee_student_assignments
    WHERE student_id = v_student_id
        AND is_active = TRUE
        AND effective_from <= v_payment_date
        AND (effective_to IS NULL OR effective_to >= v_payment_date)
    LIMIT 1;
    
    IF v_academic_year_id IS NULL THEN
        RAISE EXCEPTION 'No active fee assignment found for student %', v_student_id;
    END IF;
    
    SELECT * INTO v_academic_year 
    FROM public.academic_years 
    WHERE id = v_academic_year_id;
    
    -- ══════════════════════════════════════════════════════════════
    -- STEP 2: Clean previous allocations
    -- ══════════════════════════════════════════════════════════════
    DELETE FROM public.payment_allocations WHERE payment_id = p_payment_id;
    
    -- ══════════════════════════════════════════════════════════════
    -- STEP 3: Check if frontend sent allocations
    -- ══════════════════════════════════════════════════════════════
    IF v_allocations IS NOT NULL 
       AND jsonb_typeof(v_allocations) = 'array' 
       AND jsonb_array_length(v_allocations) > 0 THEN
        v_has_allocations := TRUE;
    END IF;
    
    -- ══════════════════════════════════════════════════════════════
    -- BRANCH A: CATEGORY-BASED ALLOCATION
    -- ══════════════════════════════════════════════════════════════
    IF v_has_allocations THEN
        FOR v_alloc_record IN 
            SELECT 
                (value->>'category_id')::uuid AS category_id,
                (value->>'amount')::numeric AS amount
            FROM jsonb_array_elements(v_allocations)
        LOOP
            v_category_id := v_alloc_record.category_id;
            v_requested_amount := v_alloc_record.amount;
            
            CONTINUE WHEN v_requested_amount <= 0.01;
            EXIT WHEN v_remaining_amount <= 0.01;
            
            v_requested_amount := LEAST(v_requested_amount, v_remaining_amount);
            
            -- ─────────────────────────────────────────────────────────
            -- PHASE 1: Clear existing dues (month ASC)
            -- student_fee_dues update হবে
            -- ─────────────────────────────────────────────────────────
            FOR v_due_record IN
                SELECT *
                FROM public.student_fee_dues
                WHERE student_id = v_student_id
                    AND academic_year_id = v_academic_year_id
                    AND category_id = v_category_id
                    AND due_amount > 0
                ORDER BY month ASC, due_date ASC
            LOOP
                EXIT WHEN v_requested_amount <= 0.01;
                
                v_allocated_amount := LEAST(v_requested_amount, v_due_record.due_amount);
                
                IF v_allocated_amount > 0 THEN
                    INSERT INTO public.payment_allocations (
                        payment_id, category_id, amount, month, allocation_type
                    ) VALUES (
                        p_payment_id, v_due_record.category_id, v_allocated_amount,
                        v_due_record.month, 'due'
                    );
                    
                    UPDATE public.student_fee_dues
                    SET 
                        paid_amount = paid_amount + v_allocated_amount,
                        due_amount = GREATEST(0, due_amount - v_allocated_amount),
                        status = CASE 
                            WHEN due_amount - v_allocated_amount <= 0 THEN 'paid'
                            ELSE 'partial'
                        END,
                        updated_at = NOW()
                    WHERE id = v_due_record.id;
                    
                    v_requested_amount := v_requested_amount - v_allocated_amount;
                    v_remaining_amount := v_remaining_amount - v_allocated_amount;
                    v_total_allocated := v_total_allocated + v_allocated_amount;
                    
                    v_result := v_result || jsonb_build_object(
                        'category_id', v_due_record.category_id,
                        'month', v_due_record.month,
                        'amount', v_allocated_amount,
                        'type', 'due'
                    );
                END IF;
            END LOOP;
            
            -- ─────────────────────────────────────────────────────────
            -- PHASE 2: Advance (same category, same academic year)
            -- ✅ FIX: NO student_fee_dues modification
            -- শুধু payment_allocations-এ entry থাকবে
            -- ─────────────────────────────────────────────────────────
            IF v_requested_amount > 0.01 THEN
                -- Get category details
                SELECT 
                    fc.frequency, 
                    fc.custom_schedule, 
                    fc.due_day
                INTO v_category_frequency, v_category_custom_schedule, v_category_due_day
                FROM public.fee_categories fc
                WHERE fc.id = v_category_id;
                
                -- Get category's structure amount
                SELECT fsi.amount INTO v_category_monthly_amount
                FROM public.fee_student_assignments fsa
                JOIN public.fee_structure_items fsi ON fsi.fee_structure_id = fsa.fee_structure_id
                WHERE fsa.student_id = v_student_id
                  AND fsa.academic_year_id = v_academic_year_id
                  AND fsa.is_active = TRUE
                  AND fsi.category_id = v_category_id
                LIMIT 1;
                
                IF v_category_monthly_amount IS NULL OR v_category_monthly_amount <= 0 THEN
                    v_category_monthly_amount := 0;
                END IF;
                
                -- Iterate months from next month to academic year end
                v_advance_month := (v_payment_month || '-01')::DATE + INTERVAL '1 month';
                v_advance_month_end := v_academic_year.end_date;
                
                WHILE v_advance_month <= v_advance_month_end 
                      AND v_requested_amount > 0.01 
                LOOP
                    DECLARE
                        v_month_text TEXT := TO_CHAR(v_advance_month, 'YYYY-MM');
                        v_month_num INT := EXTRACT(MONTH FROM v_advance_month)::INT;
                        v_expected NUMERIC := 0;
                        v_alloc NUMERIC := 0;
                    BEGIN
                        -- Determine expected amount for this month based on frequency
                        IF v_category_frequency = 'monthly' THEN
                            v_expected := v_category_monthly_amount;
                        ELSIF v_category_frequency = 'custom' THEN
                            IF v_category_custom_schedule IS NOT NULL 
                               AND v_category_custom_schedule ? 'months' 
                               AND EXISTS (
                                   SELECT 1 
                                   FROM jsonb_array_elements_text(v_category_custom_schedule->'months') m
                                   WHERE m::int = v_month_num
                               ) THEN
                                IF v_category_custom_schedule ? 'amount_per_month' THEN
                                    v_expected := (v_category_custom_schedule->>'amount_per_month')::numeric;
                                ELSE
                                    v_expected := v_category_monthly_amount;
                                END IF;
                            END IF;
                        ELSIF v_category_frequency = 'yearly' THEN
                            IF v_month_num = EXTRACT(MONTH FROM v_academic_year.start_date)::int THEN
                                v_expected := v_category_monthly_amount;
                            END IF;
                        ELSIF v_category_frequency = 'quarterly' THEN
                            IF v_month_num IN (1, 4, 7, 10) THEN
                                v_expected := v_category_monthly_amount;
                            END IF;
                        END IF;
                        
                        -- ✅ FIX: Only INSERT into payment_allocations
                        -- DO NOT touch student_fee_dues
                        IF v_expected > 0 THEN
                            v_alloc := LEAST(v_requested_amount, v_expected);
                            
                            IF v_alloc > 0 THEN
                                INSERT INTO public.payment_allocations (
                                    payment_id, category_id, amount, month, allocation_type
                                ) VALUES (
                                    p_payment_id, v_category_id, v_alloc, v_month_text, 'advance'
                                );
                                
                                v_requested_amount := v_requested_amount - v_alloc;
                                v_remaining_amount := v_remaining_amount - v_alloc;
                                v_total_allocated := v_total_allocated + v_alloc;
                                
                                v_result := v_result || jsonb_build_object(
                                    'category_id', v_category_id,
                                    'month', v_month_text,
                                    'amount', v_alloc,
                                    'type', 'advance'
                                );
                            END IF;
                        END IF;
                    END;
                    
                    v_advance_month := v_advance_month + INTERVAL '1 month';
                END LOOP;
            END IF;
            
            -- ─────────────────────────────────────────────────────────
            -- PHASE 3: Carry forward to next academic year
            -- ─────────────────────────────────────────────────────────
            IF v_requested_amount > 0.01 THEN
                INSERT INTO public.student_fee_advance (
                    student_id, category_id, payment_id, amount, remaining_balance,
                    source_academic_year_id, status
                ) VALUES (
                    v_student_id, v_category_id, p_payment_id, v_requested_amount, v_requested_amount,
                    v_academic_year_id, 'pending'
                );
                
                v_result := v_result || jsonb_build_object(
                    'category_id', v_category_id,
                    'month', NULL,
                    'amount', v_requested_amount,
                    'type', 'carry_forward'
                );
                
                v_remaining_amount := v_remaining_amount - v_requested_amount;
                v_total_allocated := v_total_allocated + v_requested_amount;
                v_requested_amount := 0;
            END IF;
        END LOOP;
    END IF;
    
    -- ══════════════════════════════════════════════════════════════
    -- STEP 4: Update fee_payments
    -- ══════════════════════════════════════════════════════════════
    UPDATE public.fee_payments
    SET paid_amount = v_total_allocated,
        updated_at = NOW()
    WHERE id = p_payment_id;
    
    -- ══════════════════════════════════════════════════════════════
    -- STEP 5: Fee transaction
    -- ══════════════════════════════════════════════════════════════
    DELETE FROM public.fee_transactions WHERE receipt_no = v_payment.receipt_no;
    
    INSERT INTO public.fee_transactions (
        student_id, category_id, amount, paid_amount, payment_date,
        payment_method, receipt_no, status, due_date, due_amount,
        discount, fine, fee_structure_id, month, created_at, updated_at
    ) VALUES (
        v_student_id, NULL, v_amount, v_total_allocated, v_payment_date,
        v_payment.payment_method, v_payment.receipt_no,
        CASE 
            WHEN v_total_allocated >= v_amount THEN 'paid'
            WHEN v_total_allocated > 0 THEN 'partial'
            ELSE 'pending'
        END,
        v_payment_date + INTERVAL '15 days',
        GREATEST(0, v_amount - v_total_allocated),
        v_discount_amount, v_fine_amount,
        (SELECT fee_structure_id FROM public.fee_student_assignments 
         WHERE student_id = v_student_id AND is_active = TRUE LIMIT 1),
        v_payment_month, NOW(), NOW()
    );
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'payment_id', p_payment_id,
        'total_amount', v_amount,
        'total_allocated', v_total_allocated,
        'remaining', v_remaining_amount,
        'has_allocations', v_has_allocations,
        'details', v_result
    );
END;
$$;


ALTER FUNCTION "public"."process_fee_payment"("p_payment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_partial_payment"("p_invoice_id" "uuid", "p_amount" numeric, "p_payment_method" character varying, "p_receipt_no" character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_invoice RECORD;
    v_new_due NUMERIC;
    v_new_status VARCHAR;
    v_payment_id UUID;
BEGIN
    SELECT * INTO v_invoice FROM public.fee_invoices WHERE id = p_invoice_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN JSONB_BUILD_OBJECT('success', false, 'error', 'Invoice not found');
    END IF;
    
    v_new_due := GREATEST(0, v_invoice.due_amount - p_amount);
    v_new_status := CASE 
        WHEN v_new_due <= 0 THEN 'paid'
        WHEN p_amount > 0 THEN 'partial'
        ELSE 'pending'
    END;
    
    INSERT INTO public.fee_payments (student_id, amount, payment_method, receipt_no, payment_date, fee_transaction_id)
    VALUES (v_invoice.student_id, p_amount, p_payment_method, p_receipt_no, NOW(), p_invoice_id)
    RETURNING id INTO v_payment_id;
    
    UPDATE public.fee_invoices
    SET paid_amount = paid_amount + p_amount,
        due_amount = v_new_due,
        status = v_new_status,
        version = version + 1,
        updated_at = NOW()
    WHERE id = p_invoice_id;
    
    RETURN JSONB_BUILD_OBJECT('success', true, 'payment_id', v_payment_id, 'remaining_due', v_new_due, 'status', v_new_status);
END;
$$;


ALTER FUNCTION "public"."process_partial_payment"("p_invoice_id" "uuid", "p_amount" numeric, "p_payment_method" character varying, "p_receipt_no" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."publish_term_results"("p_term_id" "uuid", "p_published_by" "uuid", "p_notes" "text" DEFAULT NULL::"text") RETURNS TABLE("success" boolean, "message" "text", "published_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_published_count INTEGER;
BEGIN
    -- Update all compiled_results for this term
    UPDATE public.compiled_results
    SET 
        is_published = TRUE,
        published_at = NOW()
    WHERE term_id = p_term_id
        AND result_status IN ('generated', 'published')
        AND (is_published = FALSE OR is_published IS NULL);
    
    GET DIAGNOSTICS v_published_count = ROW_COUNT;
    
    -- Update term status
    UPDATE public.exam_terms 
    SET result_status = 'published' 
    WHERE id = p_term_id;
    
    -- Return success
    RETURN QUERY SELECT TRUE, format('Successfully published %s results', v_published_count), v_published_count;
    
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, SQLERRM, 0;
END;
$$;


ALTER FUNCTION "public"."publish_term_results"("p_term_id" "uuid", "p_published_by" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."queue_staff_auth_creation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_email text;
    v_role text;
BEGIN
    -- Skip if staff already has user_id (linked auth)
    IF NEW.user_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Generate email (fallback: employee_id or name @kindererp.local)
    v_email := COALESCE(
        NULLIF(TRIM(NEW.email), ''),
        LOWER(COALESCE(NULLIF(NEW.employee_id, ''), NEW.name)) || '@kindererp.local'
    );

    -- Sanitize role — only allow teacher/staff/accountant/store
    v_role := LOWER(COALESCE(NEW.role, 'teacher'));
    IF v_role NOT IN ('teacher', 'staff', 'accountant', 'store') THEN
        v_role := 'staff';
    END IF;

    -- Queue (ON CONFLICT skip — duplicate হলে ignore)
    INSERT INTO public.pending_auth_creation (
        entity_type, entity_id, email, full_name, role
    ) VALUES (
        'staff', NEW.id, v_email, NEW.name, v_role
    )
    ON CONFLICT DO NOTHING;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'queue_staff_auth_creation failed for staff %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."queue_staff_auth_creation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."queue_student_auth_creation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_email text;
BEGIN
    -- Skip if student already has user_id
    IF NEW.user_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Generate email (fallback: student_id @kindererp.local)
    v_email := COALESCE(
        NULLIF(TRIM(NEW.email), ''),
        LOWER(NEW.student_id) || '@kindererp.local'
    );

    INSERT INTO public.pending_auth_creation (
        entity_type, entity_id, email, full_name, role
    ) VALUES (
        'student', NEW.id, v_email, NEW.name, 'student'
    )
    ON CONFLICT DO NOTHING;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'queue_student_auth_creation failed for student %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."queue_student_auth_creation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resync_all_finance_data"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_fee_count      int := 0;
  v_sale_count     int := 0;
  v_purchase_count int := 0;
  v_salary_count   int := 0;
  v_acc_count      int := 0;
  r RECORD;
BEGIN
  -- Re-run all backfills
  INSERT INTO public.finance_transactions (
    type, head_id, account_id, amount, date, description,
    payment_mode, reference, source_type, source_id, reference_id, created_at
  )
  SELECT 'income',
    (SELECT id FROM public.income_heads WHERE code='INC-FEE' LIMIT 1),
    public.fn_default_cash_account(),
    fp.amount, COALESCE(fp.payment_date::date, CURRENT_DATE),
    'Fee Payment (Receipt: '||fp.receipt_no||')',
    COALESCE(fp.payment_method,'cash'), fp.receipt_no,
    'fee_payment', fp.id::text, fp.id::text, fp.created_at
  FROM public.fee_payments fp
  WHERE NOT EXISTS (
    SELECT 1 FROM public.finance_transactions ft
    WHERE ft.source_type='fee_payment' AND ft.source_id=fp.id::text
  );
  GET DIAGNOSTICS v_fee_count = ROW_COUNT;

  INSERT INTO public.finance_transactions (
    type, head_id, account_id, amount, date, description,
    payment_mode, reference, source_type, source_id, reference_id, created_at
  )
  SELECT 'income',
    (SELECT id FROM public.income_heads WHERE code='INC-INV-SALE' LIMIT 1),
    public.fn_default_cash_account(),
    COALESCE(s.net_amount,0), COALESCE(s.sale_date,CURRENT_DATE),
    'Inventory Sale (Invoice: '||s.invoice_no||')',
    'cash', s.invoice_no,
    'inventory_sale', s.id::text, s.id::text, s.created_at
  FROM public.inventory_sales s
  WHERE s.status='completed'
    AND NOT EXISTS (
      SELECT 1 FROM public.finance_transactions ft
      WHERE ft.source_type='inventory_sale' AND ft.source_id=s.id::text
    );
  GET DIAGNOSTICS v_sale_count = ROW_COUNT;

  INSERT INTO public.finance_transactions (
    type, head_id, account_id, amount, date, description,
    payment_mode, reference, source_type, source_id, reference_id, created_at
  )
  SELECT 'expense',
    (SELECT id FROM public.expense_heads WHERE code='EXP-INV-PURCHASE' LIMIT 1),
    public.fn_default_cash_account(),
    COALESCE(p.total_amount,0), COALESCE(p.purchase_date,CURRENT_DATE),
    'Inventory Purchase (PO: '||p.purchase_no||')',
    'cash', p.purchase_no,
    'inventory_purchase', p.id::text, p.id::text, p.created_at
  FROM public.inventory_purchases p
  WHERE p.status='received'
    AND NOT EXISTS (
      SELECT 1 FROM public.finance_transactions ft
      WHERE ft.source_type='inventory_purchase' AND ft.source_id=p.id::text
    );
  GET DIAGNOSTICS v_purchase_count = ROW_COUNT;

  INSERT INTO public.finance_transactions (
    type, head_id, account_id, amount, date, description,
    payment_mode, reference, source_type, source_id, reference_id, created_at
  )
  SELECT 'expense',
    (SELECT id FROM public.expense_heads WHERE code='EXP-SALARY' LIMIT 1),
    public.fn_default_cash_account(),
    sp.amount, COALESCE(sp.payment_date,CURRENT_DATE),
    'Salary Payment ('||sp.month||' '||sp.year||')',
    COALESCE(sp.payment_method,'cash'), NULL,
    'salary_payment', sp.id::text, sp.id::text, sp.created_at
  FROM public.salary_payments sp
  WHERE NOT EXISTS (
    SELECT 1 FROM public.finance_transactions ft
    WHERE ft.source_type IN ('salary_payment','salary')
      AND (ft.source_id=sp.id::text OR ft.reference_id=sp.id::text)
  );
  GET DIAGNOSTICS v_salary_count = ROW_COUNT;

  -- Recalc all accounts
  FOR r IN SELECT id FROM public.financial_accounts WHERE is_active = true
  LOOP
    PERFORM public.fn_recalc_account_balance(r.id);
    v_acc_count := v_acc_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'fee_payments_synced',      v_fee_count,
    'inventory_sales_synced',   v_sale_count,
    'inventory_purchases_synced', v_purchase_count,
    'salary_payments_synced',   v_salary_count,
    'accounts_recalculated',    v_acc_count,
    'message', 'All finance sources synced to finance_transactions'
  );
END;
$$;


ALTER FUNCTION "public"."resync_all_finance_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."return_issuance_and_restore_stock"("p_issuance_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_issuance RECORD;
  v_item_id UUID;
  v_quantity NUMERIC;
BEGIN
  -- ইস্যু ডিটেইলস পান
  SELECT * INTO v_issuance
  FROM public.inventory_issuances
  WHERE id = p_issuance_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Issuance not found');
  END IF;
  
  -- যদি ইতিমধ্যে returned হয়ে থাকে
  IF v_issuance.status = 'returned' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Issuance already returned');
  END IF;
  
  v_item_id := v_issuance.item_id;
  v_quantity := v_issuance.quantity;
  
  -- স্টক বাড়ান
  UPDATE public.inventory_items
  SET current_stock = current_stock + v_quantity
  WHERE id = v_item_id;
  
  -- ইস্যু স্ট্যাটাস আপডেট করুন (updated_at বাদ দিয়ে)
  UPDATE public.inventory_issuances
  SET status = 'returned'
  WHERE id = p_issuance_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Item returned and stock restored',
    'stock_restored', v_quantity,
    'item_id', v_item_id
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


ALTER FUNCTION "public"."return_issuance_and_restore_stock"("p_issuance_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reverse_payment"("p_payment_id" "uuid", "p_reason" "text", "p_approved_by" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_payment RECORD;
    v_invoice RECORD;
    v_refund_id UUID;
BEGIN
    SELECT * INTO v_payment FROM public.fee_payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN JSONB_BUILD_OBJECT('success', false, 'error', 'Payment not found');
    END IF;
    
    SELECT * INTO v_invoice FROM public.fee_invoices WHERE id = v_payment.fee_transaction_id FOR UPDATE;
    
    INSERT INTO public.payment_refunds (payment_id, invoice_id, refund_amount, reason, status, approved_by, approved_at)
    VALUES (p_payment_id, v_payment.fee_transaction_id, v_payment.amount, p_reason, 'approved', p_approved_by, NOW())
    RETURNING id INTO v_refund_id;
    
    UPDATE public.fee_invoices
    SET paid_amount = paid_amount - v_payment.amount,
        due_amount = GREATEST(0, total - (paid_amount - v_payment.amount)),
        status = CASE 
            WHEN total - (paid_amount - v_payment.amount) <= 0 THEN 'paid'
            WHEN paid_amount - v_payment.amount > 0 THEN 'partial'
            ELSE 'pending'
        END,
        updated_at = NOW()
    WHERE id = v_payment.fee_transaction_id;
    
    RETURN JSONB_BUILD_OBJECT('success', true, 'refund_id', v_refund_id);
END;
$$;


ALTER FUNCTION "public"."reverse_payment"("p_payment_id" "uuid", "p_reason" "text", "p_approved_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_academic_year_dates"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    -- শিক্ষাবর্ষের শুরুর ও শেষের তারিখ বের করা
    SELECT start_date, end_date 
    INTO v_start_date, v_end_date
    FROM public.academic_years
    WHERE id = NEW.academic_year_id;
    
    -- যদি effective_from NULL হয় বা ভর্তি তারিখের চেয়ে বড় হয়, তাহলে শিক্ষাবর্ষের শুরুর তারিখ সেট করো
    IF NEW.effective_from IS NULL OR NEW.effective_from > v_start_date THEN
        NEW.effective_from := v_start_date;
    END IF;
    
    -- যদি effective_to NULL হয়, তাহলে শিক্ষাবর্ষের শেষ তারিখ সেট করো
    IF NEW.effective_to IS NULL THEN
        NEW.effective_to := v_end_date;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_academic_year_dates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_attendance_on_leave_date_correction"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- যদি ছুটির শেষ তারিখ ছোট/পরিবর্তন করা হয়, তবে পুরানো বাড়তি দিনের জন্য অ্যাটেনডেন্স লগ রিলিজ হবে
    IF (OLD.end_date IS DISTINCT FROM NEW.end_date AND NEW.status = 'Approved') THEN
        -- এখানে আপনার অ্যাটেনডেন্স লগ আপডেট করার লজিক ব্যাকএন্ড ট্রিগার হিসেবে কাজ করবে
        -- উদাহরণস্বরূপ: DELETE FROM public.student_attendance WHERE student_id = NEW.student_id AND date > NEW.end_date;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_attendance_on_leave_date_correction"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_fee_payment_to_finance"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_account_id       uuid;
  v_counter_acct_id  uuid;
  v_student_name     text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Clean up: delete voucher + journal entries by reference
    DELETE FROM public.vouchers
    WHERE reference_no = 'FEE-' || OLD.id::text;
    RETURN OLD;
  END IF;

  v_account_id := public.fn_default_cash_account();
  v_counter_acct_id := public.fn_system_account('Fee Income');

  SELECT name INTO v_student_name FROM public.students WHERE id = NEW.student_id;

  IF v_account_id IS NULL OR v_counter_acct_id IS NULL THEN
    RAISE WARNING 'sync_fee_payment: missing accounts for %', NEW.id;
    RETURN NEW;
  END IF;

  -- Delete previous voucher if this is an UPDATE
  DELETE FROM public.vouchers WHERE reference_no = 'FEE-' || NEW.id::text;

  PERFORM public.fn_create_double_entry(
    'receipt',
    COALESCE(NEW.payment_date::date, CURRENT_DATE),
    v_account_id,
    v_counter_acct_id,
    NEW.amount,
    true,
    COALESCE(v_student_name, 'Student'),
    'FEE-' || NEW.id::text,
    'Fee Payment',
    'Receipt ' || NEW.receipt_no
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Fee payment sync failed: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."sync_fee_payment_to_finance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_inventory_purchase_to_finance"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_account_id      uuid;
  v_counter_acct_id uuid;
  v_supplier_name   text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.vouchers WHERE reference_no = 'PUR-' || OLD.id::text;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' THEN
    DELETE FROM public.vouchers WHERE reference_no = 'PUR-' || NEW.id::text;
    RETURN NEW;
  END IF;

  v_account_id := public.fn_default_cash_account();
  v_counter_acct_id := public.fn_system_account('Inventory Purchase Expense');

  SELECT company_name INTO v_supplier_name
  FROM public.inventory_suppliers WHERE id = NEW.supplier_id;

  IF v_account_id IS NULL OR v_counter_acct_id IS NULL THEN
    RAISE WARNING 'sync_inventory_purchase: missing accounts for %', NEW.id;
    RETURN NEW;
  END IF;

  DELETE FROM public.vouchers WHERE reference_no = 'PUR-' || NEW.id::text;

  PERFORM public.fn_create_double_entry(
    'payment',
    COALESCE(NEW.purchase_date, CURRENT_DATE),
    v_account_id,
    v_counter_acct_id,
    COALESCE(NEW.total_amount, 0),
    false,
    COALESCE(v_supplier_name, 'Supplier'),
    'PUR-' || NEW.id::text,
    'Inventory Purchase',
    'PO ' || NEW.purchase_no
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Inventory purchase sync failed: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."sync_inventory_purchase_to_finance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_inventory_sale_to_finance"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_account_id      uuid;
  v_counter_acct_id uuid;
  v_student_name    text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.vouchers WHERE reference_no = 'SALE-' || OLD.id::text;
    RETURN OLD;
  END IF;

  -- If cancelled/returned, delete voucher
  IF TG_OP = 'UPDATE' AND NEW.status IN ('cancelled', 'returned') THEN
    DELETE FROM public.vouchers WHERE reference_no = 'SALE-' || NEW.id::text;
    RETURN NEW;
  END IF;

  v_account_id := public.fn_default_cash_account();
  v_counter_acct_id := public.fn_system_account('Inventory Sale Income');

  SELECT name INTO v_student_name FROM public.students WHERE id = NEW.student_id;

  IF v_account_id IS NULL OR v_counter_acct_id IS NULL THEN
    RAISE WARNING 'sync_inventory_sale: missing accounts for %', NEW.id;
    RETURN NEW;
  END IF;

  DELETE FROM public.vouchers WHERE reference_no = 'SALE-' || NEW.id::text;

  PERFORM public.fn_create_double_entry(
    'receipt',
    COALESCE(NEW.sale_date, CURRENT_DATE),
    v_account_id,
    v_counter_acct_id,
    COALESCE(NEW.net_amount, 0),
    true,
    COALESCE(v_student_name, 'Student'),
    'SALE-' || NEW.id::text,
    'Inventory Sale',
    'Invoice ' || NEW.invoice_no
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Inventory sale sync failed: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."sync_inventory_sale_to_finance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_salary_expense_on_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        -- reference_id বা source_id যেকোনো একটি দিয়েই খুঁজুন
        DELETE FROM public.finance_transactions
        WHERE (reference_id = OLD.id::TEXT OR source_id = OLD.id::TEXT)
          AND source_type = 'salary_payment';
        RETURN OLD;
        
    ELSIF (TG_OP = 'UPDATE') THEN
        -- reference_id বা source_id যেকোনো একটি দিয়েই আপডেট করুন
        UPDATE public.finance_transactions
        SET 
            amount = NEW.amount,
            date = COALESCE(NEW.payment_date, CURRENT_DATE),
            payment_mode = COALESCE(NEW.payment_method, 'cash'),
            reference = NEW.reference_no,
            description = 'Salary Payment for Staff ID: ' || NEW.staff_id,
            updated_at = NOW()
        WHERE (reference_id = NEW.id::TEXT OR source_id = NEW.id::TEXT)
          AND source_type = 'salary_payment';
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."sync_salary_expense_on_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_salary_payment_to_finance"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_account_id      uuid;
  v_counter_acct_id uuid;
  v_staff_name      text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.vouchers WHERE reference_no = 'SAL-' || OLD.id::text;
    RETURN OLD;
  END IF;

  v_account_id := public.fn_default_cash_account();
  v_counter_acct_id := public.fn_system_account('Salary Expense');

  SELECT name INTO v_staff_name FROM public.staff WHERE id = NEW.staff_id;

  IF v_account_id IS NULL OR v_counter_acct_id IS NULL THEN
    RAISE WARNING 'sync_salary_payment: missing accounts for %', NEW.id;
    RETURN NEW;
  END IF;

  DELETE FROM public.vouchers WHERE reference_no = 'SAL-' || NEW.id::text;

  PERFORM public.fn_create_double_entry(
    'payment',
    COALESCE(NEW.payment_date, CURRENT_DATE),
    v_account_id,
    v_counter_acct_id,
    NEW.amount,
    false,
    COALESCE(v_staff_name, 'Staff'),
    'SAL-' || NEW.id::text,
    'Salary Payment',
    'Salary ' || NEW.month || ' ' || NEW.year::text   -- ✅ FIX: ::text cast
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Salary payment sync failed: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."sync_salary_payment_to_finance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_voucher_to_finance"("p_voucher_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_voucher RECORD;
  v_entry RECORD;
  v_account RECORD;
  v_synced int := 0;
  v_skipped int := 0;
  v_net_effect numeric;
  v_tx_type varchar(20);
  v_tx_amount numeric;
BEGIN
  -- ─── Load voucher ─────────────────────────────────────────
  SELECT * INTO v_voucher 
  FROM public.vouchers 
  WHERE id = p_voucher_id;
  
  IF v_voucher IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Voucher not found: ' || p_voucher_id
    );
  END IF;
  
  -- ─── Delete previous mirror entries (if re-syncing) ────────
  DELETE FROM public.finance_transactions
  WHERE source_type = 'voucher' 
    AND source_id = p_voucher_id::text;
  
  -- ─── Loop through journal entries ─────────────────────────
  FOR v_entry IN
    SELECT * 
    FROM public.journal_entries 
    WHERE voucher_id = p_voucher_id
      AND account_id IS NOT NULL
  LOOP
    -- Load account from financial_accounts
    SELECT * INTO v_account
    FROM public.financial_accounts
    WHERE id = v_entry.account_id;
    
    -- Skip if not a financial_account (e.g., old chart_of_accounts id)
    IF v_account IS NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;
    
    -- Skip Cash / Bank / Mobile Bank — already handled by 
    -- fee_payment / salary / inventory triggers
    IF v_account.type IN ('cash', 'bank', 'mobile_bank') 
       AND v_account.account_category = 'asset' THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;
    
    -- ─── Determine net effect ────────────────────────────────
    -- For assets (fixed_asset, current_asset): 
    --     Debit increases asset → but that's not income/expense
    --     So we skip pure-asset accounts to avoid double-counting
    -- 
    -- For liability / equity: 
    --     Credit increases liability/equity
    --     We record this as "income" (mirror) so balance sheet shows it
    --
    -- For expense-type: 
    --     Debit increases expense → record as "expense"
    --
    -- Actual logic: We look at the debit/credit to infer the effect:
    --   - If Debit > Credit and account is expense → expense
    --   - If Credit > Debit and account is liability/equity/revenue → income
    --   - For fixed_asset: debit increases asset → we need a mirror entry
    --     We record as 'expense' (asset purchase consumes resource)
    --   - For drawing: debit increases drawing → we record as 'expense'
    
    v_net_effect := COALESCE(v_entry.debit, 0) - COALESCE(v_entry.credit, 0);
    
    IF v_net_effect = 0 THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;
    
    -- Categorize based on account_category
    IF v_account.account_category IN ('fixed_asset', 'current_asset', 'asset') THEN
      -- Asset increase (debit) → money spent → 'expense'
      -- Asset decrease (credit) → money received → 'income'
      IF v_net_effect > 0 THEN
        v_tx_type := 'expense';
        v_tx_amount := v_net_effect;
      ELSE
        v_tx_type := 'income';
        v_tx_amount := ABS(v_net_effect);
      END IF;
      
    ELSIF v_account.account_category IN ('liability', 'loan', 'payable') THEN
      -- Liability increase (credit) → money received → 'income'
      -- Liability decrease (debit) → money paid → 'expense'
      IF v_net_effect < 0 THEN
        v_tx_type := 'income';
        v_tx_amount := ABS(v_net_effect);
      ELSE
        v_tx_type := 'expense';
        v_tx_amount := v_net_effect;
      END IF;
      
    ELSIF v_account.account_category IN ('equity', 'capital') THEN
      -- Equity/Capital increase (credit) → 'income'
      -- Equity decrease (debit) → 'expense'
      IF v_net_effect < 0 THEN
        v_tx_type := 'income';
        v_tx_amount := ABS(v_net_effect);
      ELSE
        v_tx_type := 'expense';
        v_tx_amount := v_net_effect;
      END IF;
      
    ELSIF v_account.account_category = 'drawing' THEN
      -- Drawings increase (debit) → 'expense'
      IF v_net_effect > 0 THEN
        v_tx_type := 'expense';
        v_tx_amount := v_net_effect;
      ELSE
        v_tx_type := 'income';
        v_tx_amount := ABS(v_net_effect);
      END IF;
      
    ELSE
      -- Fallback: debit = expense, credit = income
      IF v_net_effect > 0 THEN
        v_tx_type := 'expense';
        v_tx_amount := v_net_effect;
      ELSE
        v_tx_type := 'income';
        v_tx_amount := ABS(v_net_effect);
      END IF;
    END IF;
    
    -- ─── Insert mirror entry ─────────────────────────────────
    INSERT INTO public.finance_transactions (
      type,
      account_id,
      amount,
      date,
      description,
      reference,
      source_type,
      source_id,
      reference_id,
      created_at
    ) VALUES (
      v_tx_type,
      v_account.id,
      v_tx_amount,
      v_voucher.voucher_date,
      COALESCE(v_voucher.narration, '') || 
        CASE WHEN v_entry.description IS NOT NULL 
             THEN ' - ' || v_entry.description 
             ELSE '' END,
      v_voucher.voucher_no,
      'voucher',
      p_voucher_id::text,
      p_voucher_id::text,
      NOW()
    );
    
    v_synced := v_synced + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'voucher_id', p_voucher_id,
    'voucher_no', v_voucher.voucher_no,
    'synced_entries', v_synced,
    'skipped_entries', v_skipped,
    'message', 'Voucher synced to finance_transactions'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'voucher_id', p_voucher_id
  );
END;
$$;


ALTER FUNCTION "public"."sync_voucher_to_finance"("p_voucher_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_voucher_to_finance"("p_voucher_id" "uuid") IS 'Sync a voucher''s journal entries to finance_transactions for Balance Sheet integration';



CREATE OR REPLACE FUNCTION "public"."trg_auto_assign_on_new_student"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    PERFORM public.fn_auto_assign_fee_structure(NEW.id);
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Auto fee assignment failed for student %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_auto_assign_on_new_student"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_auto_reassign_on_assignment_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_academic_year_id uuid;
    v_structure_id uuid;
    v_class_id uuid;
    v_student_status text;
    v_new_assignment_id uuid;
BEGIN
    SELECT class_id, status 
    INTO v_class_id, v_student_status
    FROM public.students
    WHERE id = OLD.student_id;
    
    IF v_class_id IS NULL OR v_student_status != 'active' THEN
        RETURN OLD;
    END IF;
    
    v_academic_year_id := COALESCE(
        OLD.academic_year_id,
        (SELECT id FROM public.academic_years WHERE is_current = true LIMIT 1)
    );
    
    IF v_academic_year_id IS NULL THEN
        RETURN OLD;
    END IF;
    
    SELECT id INTO v_structure_id
    FROM public.fee_structures
    WHERE class_id = v_class_id
      AND academic_year_id = v_academic_year_id
      AND is_active = true
    LIMIT 1;
    
    IF v_structure_id IS NULL THEN
        RETURN OLD;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM public.fee_student_assignments
        WHERE student_id = OLD.student_id
          AND academic_year_id = v_academic_year_id
          AND is_active = true
    ) THEN
        RETURN OLD;
    END IF;
    
    v_new_assignment_id := public.fn_auto_assign_fee_structure(
        OLD.student_id,
        v_academic_year_id
    );
    
    IF v_new_assignment_id IS NOT NULL THEN
        BEGIN
            PERFORM public.generate_dues_from_structure(
                OLD.student_id,
                v_academic_year_id,
                TO_CHAR(NOW(), 'YYYY-MM')
            );
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Dues generation failed for %: %', OLD.student_id, SQLERRM;
        END;
    END IF;
    
    RETURN OLD;
    
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Auto-reassign failed for %: %', OLD.student_id, SQLERRM;
    RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."trg_auto_reassign_on_assignment_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_auto_reassign_on_class_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF (OLD.class_id IS DISTINCT FROM NEW.class_id) THEN
        UPDATE public.fee_student_assignments
        SET is_active = false,
            effective_to = CURRENT_DATE,
            updated_at = NOW()
        WHERE student_id = NEW.id
          AND is_active = true;

        PERFORM public.fn_auto_assign_fee_structure(NEW.id);
    END IF;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Auto re-assignment failed for student %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_auto_reassign_on_class_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_recalc_account_balance"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.fn_recalc_account_balance(OLD.account_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- If account_id changed, recalc BOTH old and new
    IF OLD.account_id IS DISTINCT FROM NEW.account_id THEN
      PERFORM public.fn_recalc_account_balance(OLD.account_id);
    END IF;
    PERFORM public.fn_recalc_account_balance(NEW.account_id);
    RETURN NEW;
  ELSE
    PERFORM public.fn_recalc_account_balance(NEW.account_id);
    RETURN NEW;
  END IF;
END;
$$;


ALTER FUNCTION "public"."trg_recalc_account_balance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_recalc_from_journal"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_account_category text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.financial_accounts fa
    SET current_balance = COALESCE((
      SELECT SUM(
        CASE
          WHEN fa.account_category IN ('asset','current_asset','fixed_asset','expense','drawing')
            THEN COALESCE(je.debit, 0) - COALESCE(je.credit, 0)
          ELSE COALESCE(je.credit, 0) - COALESCE(je.debit, 0)
        END
      )
      FROM public.journal_entries je
      WHERE je.account_id = fa.id
    ), 0),
    updated_at = NOW()
    WHERE fa.id = OLD.account_id;
    RETURN OLD;
  END IF;

  -- INSERT or UPDATE: recalc for NEW account_id
  UPDATE public.financial_accounts fa
  SET current_balance = COALESCE((
    SELECT SUM(
      CASE
        WHEN fa.account_category IN ('asset','current_asset','fixed_asset','expense','drawing')
          THEN COALESCE(je.debit, 0) - COALESCE(je.credit, 0)
        ELSE COALESCE(je.credit, 0) - COALESCE(je.debit, 0)
      END
    )
    FROM public.journal_entries je
    WHERE je.account_id = fa.id
  ), 0),
  updated_at = NOW()
  WHERE fa.id = NEW.account_id;

  -- If account_id changed, also recalc old
  IF TG_OP = 'UPDATE' AND OLD.account_id IS DISTINCT FROM NEW.account_id THEN
    UPDATE public.financial_accounts fa
    SET current_balance = COALESCE((
      SELECT SUM(
        CASE
          WHEN fa.account_category IN ('asset','current_asset','fixed_asset','expense','drawing')
            THEN COALESCE(je.debit, 0) - COALESCE(je.credit, 0)
          ELSE COALESCE(je.credit, 0) - COALESCE(je.debit, 0)
        END
      )
      FROM public.journal_entries je
      WHERE je.account_id = fa.id
    ), 0),
    updated_at = NOW()
    WHERE fa.id = OLD.account_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_recalc_from_journal"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_process_fee_payment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Trigger function reads NEW.allocations inside process_fee_payment
    PERFORM public.process_fee_payment(NEW.id);
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_process_fee_payment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_update_payment_allocations"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Skip nested triggers
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;
    
    -- 🔴 ADD THIS: Skip if only paid_amount changed (STEP 4 UPDATE)
    -- Only reprocess if user actually edited amount/discount/fine/payment_date
    IF (OLD.amount IS DISTINCT FROM NEW.amount) OR
       (OLD.discount_amount IS DISTINCT FROM NEW.discount_amount) OR
       (OLD.fine_amount IS DISTINCT FROM NEW.fine_amount) OR
       (OLD.payment_date IS DISTINCT FROM NEW.payment_date) THEN
        
        -- 🔴 Only reprocess if paid_amount is NOT changing from 0 to amount
        -- (i.e., only if user manually edited the payment, not trigger processing)
        IF OLD.paid_amount IS DISTINCT FROM NEW.paid_amount 
           AND OLD.amount IS NOT DISTINCT FROM NEW.amount
           AND OLD.discount_amount IS NOT DISTINCT FROM NEW.discount_amount
           AND OLD.fine_amount IS NOT DISTINCT FROM NEW.fine_amount
           AND OLD.payment_date IS NOT DISTINCT FROM NEW.payment_date THEN
            -- paid_amount changed but nothing else → skip (likely internal)
            RETURN NEW;
        END IF;
        
        DELETE FROM public.payment_allocations WHERE payment_id = NEW.id;
        DELETE FROM public.fee_transactions WHERE receipt_no = NEW.receipt_no;
        
        PERFORM public.process_fee_payment(NEW.id);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_update_payment_allocations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_certificate_templates_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_certificate_templates_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_daily_due_status"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_due RECORD;
    v_fine_amount NUMERIC;
    v_today DATE := CURRENT_DATE;
    v_updated_count INT := 0;
BEGIN
    -- Update overdue status and calculate fines
    FOR v_due IN
        SELECT *
        FROM public.student_fee_dues
        WHERE status IN ('pending', 'partial')
            AND due_date < v_today
            AND due_amount > 0.01
    LOOP
        -- Calculate fine
        v_fine_amount := public.calculate_late_fine(
            v_due.student_id,
            v_due.category_id,
            v_due.month,
            v_due.due_date,
            v_due.due_amount
        );
        
        -- Update due record
        UPDATE public.student_fee_dues
        SET 
            status = 'overdue',
            fine_amount = v_fine_amount,
            updated_at = NOW()
        WHERE id = v_due.id
            AND status IN ('pending', 'partial')
            AND due_amount > 0.01;
            
        v_updated_count := v_updated_count + 1;
    END LOOP;
    
    -- Log the update (optional)
    IF v_updated_count > 0 THEN
        RAISE NOTICE 'Updated % overdue dues with fines', v_updated_count;
    END IF;
END;
$$;


ALTER FUNCTION "public"."update_daily_due_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_exam_settings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_exam_settings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_fee_assignment_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_fee_assignment_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_fines_for_overdue"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_updated INT := 0;
    v_due RECORD;
    v_fine_amount NUMERIC;
BEGIN
    FOR v_due IN
        SELECT *
        FROM public.student_fee_dues
        WHERE status = 'overdue'
            AND due_amount > 0
            AND fine_amount = 0
    LOOP
        v_fine_amount := public.calculate_late_fine(
            v_due.student_id,
            v_due.category_id,
            v_due.month,
            v_due.due_date,
            v_due.due_amount
        );
        
        IF v_fine_amount > 0 THEN
            UPDATE public.student_fee_dues
            SET fine_amount = v_fine_amount,
                updated_at = NOW()
            WHERE id = v_due.id;
            
            v_updated := v_updated + 1;
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object(
        'updated_count', v_updated,
        'message', 'Fines updated successfully'
    );
END;
$$;


ALTER FUNCTION "public"."update_fines_for_overdue"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_leave_balance_on_approval"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    leave_days INTEGER;
BEGIN
    IF NEW.status = 'approved' AND (OLD.status != 'approved' OR OLD.status IS NULL) THEN
        leave_days := (NEW.end_date - NEW.start_date) + 1;
        
        UPDATE public.leave_balances
        SET 
            used_days = used_days + leave_days,
            remaining_days = total_days - (used_days + leave_days),
            updated_at = NOW()
        WHERE staff_id = NEW.staff_id AND category_name = NEW.type;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_leave_balance_on_approval"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_salary_balance_on_payment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_net_salary NUMERIC := 0;
    v_total_paid NUMERIC := 0;
    v_due NUMERIC := 0;
    v_signed_balance NUMERIC := 0;
    v_status TEXT := 'unpaid';
    v_month_int INT;
    v_staff_id UUID;
    v_payment_month TEXT;
    v_payment_year INT;
    v_is_blocked boolean := false;
    v_block_reason text;
    v_due_date date;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_staff_id := OLD.staff_id;
        v_payment_month := OLD.month;
        v_payment_year := OLD.year;
    ELSE
        v_staff_id := NEW.staff_id;
        v_payment_month := NEW.month;
        v_payment_year := NEW.year;
    END IF;

    v_month_int := CASE 
        WHEN v_payment_month ILIKE 'January'   THEN 1
        WHEN v_payment_month ILIKE 'February'  THEN 2
        WHEN v_payment_month ILIKE 'March'     THEN 3
        WHEN v_payment_month ILIKE 'April'     THEN 4
        WHEN v_payment_month ILIKE 'May'       THEN 5
        WHEN v_payment_month ILIKE 'June'      THEN 6
        WHEN v_payment_month ILIKE 'July'      THEN 7
        WHEN v_payment_month ILIKE 'August'    THEN 8
        WHEN v_payment_month ILIKE 'September' THEN 9
        WHEN v_payment_month ILIKE 'October'   THEN 10
        WHEN v_payment_month ILIKE 'November'  THEN 11
        WHEN v_payment_month ILIKE 'December'  THEN 12
        ELSE v_payment_month::INT
    END;

    IF TG_OP != 'DELETE' THEN
        SELECT net_salary, is_blocked, block_reason
        INTO v_net_salary, v_is_blocked, v_block_reason
        FROM public.calculate_staff_salary(v_staff_id, v_month_int, v_payment_year);

        IF v_is_blocked THEN
            RAISE EXCEPTION 'Cannot pay salary for % % — %', 
                v_payment_month, v_payment_year, 
                COALESCE(v_block_reason, 'outside employment period');
        END IF;
    END IF;

    v_due_date := (make_date(v_payment_year, v_month_int, 1) + INTERVAL '1 month')::date;

    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM public.salary_payments
    WHERE staff_id = v_staff_id 
      AND month = v_payment_month
      AND year = v_payment_year;

    IF v_net_salary = 0 THEN
        v_net_salary := v_total_paid;
    END IF;

    -- ✅ CHANGED: keep SIGNED balance (negative = advance)
    v_signed_balance := v_net_salary - v_total_paid;
    v_due := GREATEST(0, v_signed_balance);

    IF v_signed_balance <= 0 AND v_total_paid > 0 THEN
        v_status := 'paid';
    ELSIF v_total_paid > 0 THEN
        v_status := 'partial';
    ELSE
        v_status := 'unpaid';
    END IF;

    INSERT INTO public.salary_balances (
        staff_id, month, year, expected_salary, paid_amount, 
        due_amount, balance, status, due_date, updated_at
    )
    VALUES (
        v_staff_id, v_payment_month, v_payment_year, v_net_salary,
        v_total_paid, v_due, v_signed_balance,
        v_status, v_due_date, NOW()
    )
    ON CONFLICT (staff_id, month, year) DO UPDATE SET
        expected_salary = EXCLUDED.expected_salary,
        paid_amount = EXCLUDED.paid_amount,
        due_amount = EXCLUDED.due_amount,
        balance = EXCLUDED.balance,
        status = EXCLUDED.status,
        due_date = EXCLUDED.due_date,
        updated_at = NOW();

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Salary balance update failed: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."update_salary_balance_on_payment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_staff_on_promotion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE public.staff
    SET 
        designation = NEW.new_designation,
        salary_category_id = NEW.new_salary_category_id,
        updated_at = NOW()
    WHERE id = NEW.staff_id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_staff_on_promotion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_staff_status_on_leave"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- যখন লিভ Approved হবে
    IF NEW.status = 'approved' AND (OLD.status != 'approved' OR OLD.status IS NULL) THEN
        -- স্টাফের স্ট্যাটাস 'on_leave' এ আপডেট করুন
        UPDATE public.staff
        SET 
            status = 'on_leave',
            updated_at = NOW()
        WHERE id = NEW.staff_id;
    
    -- যখন লিভ Rejected হবে বা Expired হবে
    ELSIF NEW.status = 'rejected' OR NEW.status = 'expired' THEN
        -- চেক করুন স্টাফের অন্য কোন Approved লিভ আছে কিনা
        IF NOT EXISTS (
            SELECT 1 FROM public.leaves 
            WHERE staff_id = NEW.staff_id 
            AND status = 'approved' 
            AND id != NEW.id
            AND start_date <= CURRENT_DATE
            AND end_date >= CURRENT_DATE
        ) THEN
            -- যদি না থাকে, স্ট্যাটাস 'active' এ ফেরান
            UPDATE public.staff
            SET 
                status = 'active',
                updated_at = NOW()
            WHERE id = NEW.staff_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_staff_status_on_leave"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_mark_status_transition"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Once locked, cannot change ANY field
    IF OLD.entry_status = 'locked' THEN
        RAISE EXCEPTION 'Cannot modify locked marks. Status: %, ID: %', OLD.entry_status, OLD.id;
    END IF;
    
    -- Draft → only submitted allowed
    IF OLD.entry_status = 'draft' AND NEW.entry_status NOT IN ('submitted', 'draft') THEN
        RAISE EXCEPTION 'Invalid transition: draft can only go to submitted. Current: %, New: %', 
            OLD.entry_status, NEW.entry_status;
    END IF;
    
    -- Submitted → only verified allowed
    IF OLD.entry_status = 'submitted' AND NEW.entry_status NOT IN ('verified', 'submitted') THEN
        RAISE EXCEPTION 'Invalid transition: submitted can only go to verified. Current: %, New: %', 
            OLD.entry_status, NEW.entry_status;
    END IF;
    
    -- Verified → only locked allowed
    IF OLD.entry_status = 'verified' AND NEW.entry_status NOT IN ('locked', 'verified') THEN
        RAISE EXCEPTION 'Invalid transition: verified can only go to locked. Current: %, New: %', 
            OLD.entry_status, NEW.entry_status;
    END IF;
    
    -- Log status change (audit) - only if audit_logs table exists
    -- (Skip if table doesn't exist yet)
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_mark_status_transition"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."academic_years" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "year_name" character varying(50) NOT NULL,
    "name" character varying(100),
    "start_date" "date",
    "end_date" "date",
    "is_active" boolean DEFAULT true,
    "is_current" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."academic_years" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."account_credentials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "email" "text" NOT NULL,
    "password" "text" NOT NULL,
    "full_name" "text",
    "role" "text",
    "entity_type" "text",
    "entity_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_downloaded" boolean DEFAULT false,
    "last_downloaded_at" timestamp with time zone,
    "download_count" integer DEFAULT 0
);


ALTER TABLE "public"."account_credentials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid",
    "user_id" "uuid",
    "employee_id" character varying(50),
    "name" character varying(255) NOT NULL,
    "name_bn" character varying(255),
    "designation" character varying(100),
    "qualification" character varying(255),
    "experience" integer,
    "dob" "date",
    "gender" character varying(20),
    "nid_no" character varying(50),
    "blood_group" character varying(10),
    "address" "text",
    "contact" character varying(20),
    "email" character varying(100),
    "photo_url" "text",
    "salary_category_id" "uuid",
    "salary" numeric(10,2),
    "role" character varying(50) DEFAULT 'teacher'::character varying,
    "status" character varying(20) DEFAULT 'active'::character varying,
    "joining_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "resign_date" "date",
    "resign_reason" "text",
    "father_name" character varying(255),
    "mother_name" character varying(255),
    "village" character varying(255),
    "post_office" character varying(255),
    "police_station" character varying(255),
    "district" character varying(100),
    "bank_name" character varying(255),
    "account_number" character varying(50),
    "phone" character varying(20),
    "emergency_contact" character varying(20),
    "remarks" "text",
    CONSTRAINT "staff_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'on_leave'::character varying, 'resigned'::character varying, 'terminated'::character varying])::"text"[])))
);


ALTER TABLE "public"."staff" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."active_staff" AS
 SELECT "id",
    "organization_id",
    "user_id",
    "employee_id",
    "name",
    "name_bn",
    "designation",
    "qualification",
    "experience",
    "dob",
    "gender",
    "nid_no",
    "blood_group",
    "address",
    "contact",
    "email",
    "photo_url",
    "salary_category_id",
    "salary",
    "role",
    "status",
    "joining_date",
    "created_at",
    "updated_at",
    "resign_date",
    "resign_reason",
    "father_name",
    "mother_name",
    "village",
    "post_office",
    "police_station",
    "district",
    "bank_name",
    "account_number",
    "phone",
    "emergency_contact",
    "remarks"
   FROM "public"."staff"
  WHERE (("status")::"text" <> 'resigned'::"text");


ALTER VIEW "public"."active_staff" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."address_districts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."address_districts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."address_police_stations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."address_police_stations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."address_post_offices" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."address_post_offices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."address_villages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."address_villages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."advance_installments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "advance_id" "uuid",
    "month" "text" NOT NULL,
    "year" integer NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "paid_at" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."advance_installments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."advance_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "remaining_balance" numeric(12,2) NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."advance_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance_holidays" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "holiday_date" "date" NOT NULL,
    "type" "text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_optional" boolean DEFAULT false
);


ALTER TABLE "public"."attendance_holidays" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance_settings" (
    "id" "text" DEFAULT 'general_settings'::"text" NOT NULL,
    "is_friday_off" boolean DEFAULT true,
    "is_saturday_off" boolean DEFAULT false,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "school_start_time" time without time zone DEFAULT '08:00:00'::time without time zone,
    "late_after" time without time zone DEFAULT '08:15:00'::time without time zone,
    "half_day_after" time without time zone DEFAULT '11:00:00'::time without time zone,
    "school_end_time" time without time zone DEFAULT '14:00:00'::time without time zone,
    "sms_notification_enabled" boolean DEFAULT true
);


ALTER TABLE "public"."attendance_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" character varying(100) NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "action" character varying(50) NOT NULL,
    "old_data" "jsonb",
    "new_data" "jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."certificate_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "template_type" character varying(50),
    "header_html" "text",
    "body_html" "text",
    "footer_html" "text",
    "signature_settings" "jsonb" DEFAULT '{"date": true, "teacher_signature": true, "principal_signature": true}'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "paper_size" character varying(20) DEFAULT 'A4'::character varying,
    "orientation" character varying(20) DEFAULT 'landscape'::character varying,
    "font_title" character varying(100) DEFAULT 'Cinzel'::character varying,
    "font_body" character varying(100) DEFAULT 'Inter'::character varying,
    "font_signature" character varying(100) DEFAULT 'Alex Brush'::character varying,
    "font_size" character varying(20) DEFAULT '16px'::character varying,
    "line_height" character varying(20) DEFAULT '1.6'::character varying,
    "text_align" character varying(20) DEFAULT 'center'::character varying,
    "border_style" character varying(50) DEFAULT 'golden'::character varying,
    "border_width" character varying(20) DEFAULT '12px'::character varying,
    "border_color" character varying(20) DEFAULT '#d4af37'::character varying,
    "background_color" character varying(20) DEFAULT '#ffffff'::character varying,
    "watermark_type" character varying(20) DEFAULT 'text'::character varying,
    "watermark_text" "text" DEFAULT 'OFFICIAL DIPLOMA'::"text",
    "watermark_opacity" numeric(3,2) DEFAULT 0.08,
    "watermark_rotation" integer DEFAULT '-25'::integer,
    "watermark_scale" numeric(3,2) DEFAULT 1.0,
    "school_logo_url" "text",
    "show_header" boolean DEFAULT true,
    "show_footer" boolean DEFAULT true,
    "margins" "jsonb" DEFAULT '{"top": "20mm", "left": "20mm", "right": "20mm", "bottom": "20mm"}'::"jsonb",
    "padding" "jsonb" DEFAULT '{"top": "15mm", "left": "15mm", "right": "15mm", "bottom": "15mm"}'::"jsonb",
    "signatures" "jsonb" DEFAULT '[]'::"jsonb",
    "custom_css" "text",
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."certificate_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chart_of_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" character varying(20) NOT NULL,
    "name" character varying(255) NOT NULL,
    "account_type" character varying(50) NOT NULL,
    "parent_id" "uuid",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chart_of_accounts_account_type_check" CHECK ((("account_type")::"text" = ANY ((ARRAY['asset'::character varying, 'liability'::character varying, 'equity'::character varying, 'revenue'::character varying, 'expense'::character varying])::"text"[])))
);


ALTER TABLE "public"."chart_of_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid",
    "name" character varying(100) NOT NULL,
    "numeric_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."classes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."compiled_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid",
    "term_id" "uuid",
    "academic_year_id" "uuid",
    "total_marks_obtained" numeric(7,2),
    "total_full_marks" numeric(7,2),
    "percentage" numeric(5,2),
    "gpa" numeric(3,2),
    "letter_grade" character varying(5),
    "class_rank" integer,
    "section_rank" integer,
    "result_status" character varying(20) DEFAULT 'pending'::character varying,
    "is_published" boolean DEFAULT false,
    "published_at" timestamp without time zone,
    "failed_subjects" "jsonb" DEFAULT '[]'::"jsonb",
    "has_failed_compulsory" boolean DEFAULT false,
    "merit_position" integer,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."compiled_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fee_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" "text",
    "amount" numeric(12,2) DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "frequency" character varying(50) DEFAULT 'monthly'::character varying,
    "custom_schedule" "jsonb",
    "created_date" "date" DEFAULT CURRENT_DATE,
    "due_day" integer DEFAULT 15,
    "grace_days" integer DEFAULT 0,
    "fine_rule_id" "uuid",
    CONSTRAINT "fee_categories_frequency_check" CHECK ((("frequency")::"text" = ANY ((ARRAY['monthly'::character varying, 'quarterly'::character varying, 'yearly'::character varying, 'one_time'::character varying, 'custom'::character varying])::"text"[])))
);


ALTER TABLE "public"."fee_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fee_structure_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fee_structure_id" "uuid",
    "category_id" "uuid",
    "amount" numeric(12,2) NOT NULL,
    "is_optional" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "frequency" character varying(50) DEFAULT 'monthly'::character varying,
    "name" character varying(255),
    CONSTRAINT "fee_structure_items_amount_check" CHECK (("amount" >= (0)::numeric))
);


ALTER TABLE "public"."fee_structure_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fee_structures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(200) NOT NULL,
    "academic_year_id" "uuid",
    "class_id" "uuid",
    "total_amount" numeric(12,2) DEFAULT 0,
    "description" "text",
    "version" integer DEFAULT 1,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."fee_structures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fee_student_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "fee_structure_id" "uuid" NOT NULL,
    "academic_year_id" "uuid" NOT NULL,
    "assigned_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "effective_from" "date" NOT NULL,
    "effective_to" "date",
    "is_active" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."fee_student_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sections" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "class_id" "uuid",
    "name" character varying(50) NOT NULL,
    "capacity" integer DEFAULT 40,
    "class_teacher_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "organization_id" "uuid"
);


ALTER TABLE "public"."sections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."students" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid",
    "user_id" "uuid",
    "student_id" character varying(50) NOT NULL,
    "name" character varying(255) NOT NULL,
    "father_name" character varying(255) NOT NULL,
    "mother_name" character varying(255) NOT NULL,
    "name_bn" character varying(255),
    "father_name_bn" character varying(255),
    "mother_name_bn" character varying(255),
    "dob" "date" NOT NULL,
    "birth_cert_no" character varying(50),
    "blood_group" character varying(10),
    "gender" character varying(20) NOT NULL,
    "particular_disease" "text",
    "contact" character varying(20) NOT NULL,
    "address" "text",
    "village" character varying(255),
    "post_office" character varying(255),
    "police_station" character varying(255),
    "district" character varying(100),
    "class_id" "uuid" NOT NULL,
    "section_id" "uuid" NOT NULL,
    "class_roll" character varying(20),
    "academic_year_id" "uuid",
    "admission_date" "date",
    "fathers_contact" character varying(20),
    "mothers_contact" character varying(20),
    "email" character varying(100),
    "whatsapp" character varying(20),
    "student_photo_url" "text",
    "status" character varying(20) DEFAULT 'active'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "father_nid_no" character varying(100),
    "mother_nid_no" character varying(100),
    "rfid_uid" "text",
    "qr_code" "text",
    "student_group" "text",
    "permanent_village" character varying(255),
    "permanent_post_office" character varying(255),
    "permanent_police_station" character varying(255),
    "permanent_district" character varying(100),
    "current_fee_structure_id" "uuid",
    CONSTRAINT "students_student_group_check" CHECK (("student_group" = ANY (ARRAY['science'::"text", 'humanities'::"text", 'commerce'::"text", NULL::"text"])))
);


ALTER TABLE "public"."students" OWNER TO "postgres";


COMMENT ON COLUMN "public"."students"."student_group" IS 'Student group: science, humanities, commerce, or null';



CREATE OR REPLACE VIEW "public"."current_fee_assignments" AS
 SELECT "fsa"."id" AS "assignment_id",
    "s"."id" AS "student_id",
    "s"."student_id" AS "student_number",
    "s"."name" AS "student_name",
    "s"."class_id",
    "c"."name" AS "class_name",
    "s"."section_id",
    "sec"."name" AS "section_name",
    "fsa"."fee_structure_id",
    "fs"."name" AS "fee_structure_name",
    "fs"."total_amount" AS "structure_total",
    "fs"."academic_year_id",
    "ay"."year_name" AS "academic_year",
    "fsa"."assigned_date",
    "fsa"."effective_from",
    "fsa"."effective_to",
    "fsa"."is_active",
    "fsa"."created_at",
    COALESCE(( SELECT "jsonb_agg"("jsonb_build_object"('id', "fsi"."id", 'category_id', "fsi"."category_id", 'category_name', "fc"."name", 'amount', "fsi"."amount", 'frequency', "fsi"."frequency")) AS "jsonb_agg"
           FROM ("public"."fee_structure_items" "fsi"
             LEFT JOIN "public"."fee_categories" "fc" ON (("fc"."id" = "fsi"."category_id")))
          WHERE ("fsi"."fee_structure_id" = "fsa"."fee_structure_id")), '[]'::"jsonb") AS "items",
    ( SELECT "count"(*) AS "count"
           FROM "public"."fee_structure_items"
          WHERE ("fee_structure_items"."fee_structure_id" = "fsa"."fee_structure_id")) AS "total_items"
   FROM ((((("public"."fee_student_assignments" "fsa"
     JOIN "public"."students" "s" ON (("s"."id" = "fsa"."student_id")))
     JOIN "public"."classes" "c" ON (("c"."id" = "s"."class_id")))
     LEFT JOIN "public"."sections" "sec" ON (("sec"."id" = "s"."section_id")))
     JOIN "public"."fee_structures" "fs" ON (("fs"."id" = "fsa"."fee_structure_id")))
     JOIN "public"."academic_years" "ay" ON (("ay"."id" = "fsa"."academic_year_id")))
  WHERE (("fsa"."is_active" = true) AND (("fsa"."effective_to" IS NULL) OR ("fsa"."effective_to" >= CURRENT_DATE)))
  ORDER BY "s"."name";


ALTER VIEW "public"."current_fee_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."salary_categories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid",
    "name" character varying(100) NOT NULL,
    "basic" numeric(10,2) DEFAULT 0,
    "hra" numeric(10,2) DEFAULT 0,
    "da" numeric(10,2) DEFAULT 0,
    "allowances" numeric(10,2) DEFAULT 0,
    "deductions" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true,
    "due_day" integer DEFAULT 1
);


ALTER TABLE "public"."salary_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_salaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_id" "uuid",
    "salary_category_id" "uuid",
    "basic" numeric,
    "hra" numeric,
    "da" numeric,
    "allowances" numeric,
    "personal_allowance" numeric DEFAULT 0,
    "special_allowance" numeric DEFAULT 0,
    "other_deductions" numeric DEFAULT 0,
    "effective_from" "date",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "effective_to" "date",
    "is_current" boolean DEFAULT true,
    "version" integer DEFAULT 1,
    "created_by" "uuid",
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "total_salary" numeric(12,2) GENERATED ALWAYS AS (((((((COALESCE("basic", (0)::numeric) + COALESCE("hra", (0)::numeric)) + COALESCE("da", (0)::numeric)) + COALESCE("allowances", (0)::numeric)) + COALESCE("personal_allowance", (0)::numeric)) + COALESCE("special_allowance", (0)::numeric)) - COALESCE("other_deductions", (0)::numeric))) STORED,
    CONSTRAINT "valid_effective_dates" CHECK ((("effective_to" IS NULL) OR ("effective_to" >= "effective_from")))
);


ALTER TABLE "public"."staff_salaries" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."current_staff_salaries" AS
 SELECT "s"."id" AS "staff_id",
    "s"."name" AS "staff_name",
    "s"."employee_id",
    "s"."designation",
    "s"."photo_url",
    "s"."status",
    "ss"."id" AS "salary_id",
    "ss"."salary_category_id",
    "sc"."name" AS "category_name",
    "ss"."basic",
    "ss"."hra",
    "ss"."da",
    "ss"."allowances",
    "ss"."personal_allowance",
    "ss"."special_allowance",
    "ss"."other_deductions",
    "ss"."total_salary",
    "ss"."effective_from",
    "ss"."is_current",
    "ss"."version"
   FROM (("public"."staff" "s"
     LEFT JOIN "public"."staff_salaries" "ss" ON ((("ss"."staff_id" = "s"."id") AND ("ss"."is_current" = true))))
     LEFT JOIN "public"."salary_categories" "sc" ON (("sc"."id" = "ss"."salary_category_id")))
  WHERE (("s"."status")::"text" <> 'resigned'::"text");


ALTER VIEW "public"."current_staff_salaries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exam_settings_new" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "academic_year_id" "uuid",
    "setting_key" character varying(100) NOT NULL,
    "setting_value" "jsonb" NOT NULL,
    "description" "text",
    "updated_by" "uuid",
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."exam_settings_new" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exam_subjects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "term_id" "uuid",
    "class_id" "uuid",
    "section_id" "uuid",
    "subject_id" "uuid",
    "subject_type" character varying(20) DEFAULT 'compulsory'::character varying,
    "full_marks" numeric(5,2) NOT NULL,
    "pass_marks" numeric(5,2) NOT NULL,
    "order_index" integer DEFAULT 0,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."exam_subjects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exam_terms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "academic_year_id" "uuid",
    "name" character varying(100) NOT NULL,
    "term_code" character varying(50) NOT NULL,
    "weightage_percentage" numeric(5,2) DEFAULT 100.00,
    "start_date" "date",
    "end_date" "date",
    "status" character varying(20) DEFAULT 'upcoming'::character varying,
    "result_status" character varying(20) DEFAULT 'draft'::character varying,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."exam_terms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expense_heads" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid",
    "name" character varying(100) NOT NULL,
    "type" character varying(50),
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "code" character varying(50),
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."expense_heads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fee_assignment_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assignment_id" "uuid",
    "student_id" "uuid" NOT NULL,
    "action" character varying(50) NOT NULL,
    "old_structure_id" "uuid",
    "new_structure_id" "uuid",
    "old_effective_from" "date",
    "new_effective_from" "date",
    "old_effective_to" "date",
    "new_effective_to" "date",
    "old_is_active" boolean,
    "new_is_active" boolean,
    "changes" "jsonb" DEFAULT '{}'::"jsonb",
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reason" "text"
);


ALTER TABLE "public"."fee_assignment_history" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."fee_assignment_summary" AS
 SELECT "c"."id" AS "class_id",
    "c"."name" AS "class_name",
    "count"(DISTINCT "s"."id") AS "total_students",
    "count"(DISTINCT "fsa"."id") AS "assigned_students",
    ("count"(DISTINCT "s"."id") - "count"(DISTINCT "fsa"."id")) AS "unassigned_students",
    "count"(DISTINCT "fs"."id") AS "distinct_structures_used",
    "round"(((("count"(DISTINCT "fsa"."id"))::numeric / (NULLIF("count"(DISTINCT "s"."id"), 0))::numeric) * (100)::numeric), 2) AS "assignment_percentage"
   FROM ((("public"."classes" "c"
     LEFT JOIN "public"."students" "s" ON ((("s"."class_id" = "c"."id") AND (("s"."status")::"text" = 'active'::"text"))))
     LEFT JOIN "public"."fee_student_assignments" "fsa" ON ((("fsa"."student_id" = "s"."id") AND ("fsa"."is_active" = true) AND (("fsa"."effective_to" IS NULL) OR ("fsa"."effective_to" >= CURRENT_DATE)))))
     LEFT JOIN "public"."fee_structures" "fs" ON (("fs"."id" = "fsa"."fee_structure_id")))
  WHERE ("c"."id" IN ( SELECT DISTINCT "students"."class_id"
           FROM "public"."students"
          WHERE (("students"."status")::"text" = 'active'::"text")))
  GROUP BY "c"."id", "c"."name"
  ORDER BY "c"."name";


ALTER VIEW "public"."fee_assignment_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fee_discounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "type" character varying(20),
    "value" numeric(10,2) NOT NULL,
    "applicable_on" character varying(50) DEFAULT 'all'::character varying,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "applicable_categories" "jsonb" DEFAULT '[]'::"jsonb",
    "scope_type" character varying(20) DEFAULT 'all'::character varying,
    "scope_class_id" "uuid",
    "scope_section_id" "uuid",
    "scope_student_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "sibling_group_id" "uuid",
    "valid_from" "date",
    "valid_to" "date",
    CONSTRAINT "fee_discounts_scope_type_check" CHECK ((("scope_type")::"text" = ANY ((ARRAY['all'::character varying, 'class'::character varying, 'section'::character varying, 'student'::character varying, 'sibling'::character varying])::"text"[]))),
    CONSTRAINT "fee_discounts_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['percentage'::character varying, 'fixed'::character varying])::"text"[])))
);


ALTER TABLE "public"."fee_discounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fee_invoice_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "discount_amount" numeric(12,2) DEFAULT 0,
    "paid_amount" numeric(12,2) DEFAULT 0,
    "due_amount" numeric(12,2) NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "fee_invoice_items_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'partial'::character varying, 'paid'::character varying, 'waived'::character varying])::"text"[])))
);


ALTER TABLE "public"."fee_invoice_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fee_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid",
    "academic_year_id" "uuid",
    "month" integer NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "discount_amount" numeric(10,2) DEFAULT 0,
    "discount_reason" "text",
    "fine_amount" numeric(10,2) DEFAULT 0,
    "total" numeric(10,2) NOT NULL,
    "paid_amount" numeric(10,2) DEFAULT 0,
    "due_amount" numeric(10,2) NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "due_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "previous_due" numeric(12,2) DEFAULT 0,
    "version" integer DEFAULT 1,
    "is_advance_invoice" boolean DEFAULT false,
    "advance_source_payment_id" "uuid",
    CONSTRAINT "fee_invoices_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'partial'::character varying, 'paid'::character varying])::"text"[])))
);


ALTER TABLE "public"."fee_invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fee_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fee_transaction_id" "uuid",
    "student_id" "uuid",
    "amount" numeric(10,2) NOT NULL,
    "payment_method" character varying(50) DEFAULT 'cash'::character varying,
    "receipt_no" character varying(50) NOT NULL,
    "note" "text",
    "payment_date" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "discount_amount" numeric(10,2) DEFAULT 0,
    "fine_amount" numeric(10,2) DEFAULT 0,
    "is_advance" boolean DEFAULT false,
    "advance_month" integer,
    "paid_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "allocations" "jsonb"
);

ALTER TABLE ONLY "public"."fee_payments" REPLICA IDENTITY FULL;


ALTER TABLE "public"."fee_payments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."fee_payments"."allocations" IS 'Frontend-selected category allocations. Format: [{"category_id": "uuid", "amount": 500}, ...]';



CREATE TABLE IF NOT EXISTS "public"."fee_structure_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "structure_id" "uuid",
    "version" integer NOT NULL,
    "name" character varying(255) NOT NULL,
    "categories" "jsonb" NOT NULL,
    "description" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."fee_structure_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fee_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid",
    "category_id" "uuid",
    "amount" numeric(12,2) NOT NULL,
    "paid_amount" numeric(12,2) DEFAULT 0,
    "payment_date" "date" DEFAULT CURRENT_DATE,
    "payment_method" character varying(50),
    "receipt_no" character varying(50),
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "due_date" "date",
    "remarks" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "invoice_no" character varying(50),
    "month" character varying(7),
    "transaction_type" character varying(20) DEFAULT 'regular'::character varying,
    "due_amount" numeric(12,2) DEFAULT 0,
    "discount" numeric(10,2) DEFAULT 0,
    "fine" numeric(10,2) DEFAULT 0,
    "discount_id" "uuid",
    "fine_rule_id" "uuid",
    "fee_structure_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "check_transaction_type" CHECK ((("transaction_type")::"text" = ANY ((ARRAY['regular'::character varying, 'advance'::character varying, 'adjustment'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."fee_transactions" REPLICA IDENTITY FULL;


ALTER TABLE "public"."fee_transactions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."fee_transactions"."discount_id" IS 'Reference to the discount rule applied';



COMMENT ON COLUMN "public"."fee_transactions"."fine_rule_id" IS 'Reference to the fine rule applied';



CREATE TABLE IF NOT EXISTS "public"."finance_heads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "name" character varying(100) NOT NULL,
    "type" character varying(50),
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "code" character varying(50),
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."finance_heads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_transactions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid",
    "type" character varying(20) NOT NULL,
    "head_id" "uuid",
    "amount" numeric(10,2) NOT NULL,
    "date" "date" NOT NULL,
    "description" "text",
    "payment_mode" character varying(50),
    "reference" character varying(100),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "source_type" character varying(50),
    "source_id" "text",
    "account_id" "uuid",
    "reference_id" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_transfer" boolean DEFAULT false,
    CONSTRAINT "finance_transactions_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['income'::character varying, 'expense'::character varying])::"text"[])))
);


ALTER TABLE "public"."finance_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financial_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_name" character varying(100) NOT NULL,
    "account_number" character varying(50),
    "type" character varying(50) NOT NULL,
    "bank_name" character varying(100),
    "branch_name" character varying(100),
    "current_balance" numeric(12,2) DEFAULT 0.00,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "account_type" character varying(20),
    "account_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "account_category" character varying(20) DEFAULT 'asset'::character varying,
    "is_balance_sheet" boolean DEFAULT true,
    CONSTRAINT "financial_accounts_account_category_check" CHECK ((("account_category")::"text" = ANY ((ARRAY['asset'::character varying, 'current_asset'::character varying, 'fixed_asset'::character varying, 'liability'::character varying, 'payable'::character varying, 'loan'::character varying, 'equity'::character varying, 'capital'::character varying, 'drawing'::character varying, 'revenue'::character varying, 'expense'::character varying])::"text"[]))),
    CONSTRAINT "financial_accounts_account_type_check" CHECK ((("account_type")::"text" = ANY ((ARRAY['cash'::character varying, 'bank'::character varying, 'mobile_bank'::character varying])::"text"[]))),
    CONSTRAINT "financial_accounts_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['cash'::character varying, 'bank'::character varying, 'mobile_bank'::character varying])::"text"[])))
);


ALTER TABLE "public"."financial_accounts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."financial_accounts"."account_category" IS 'Balance Sheet classification: asset | liability | equity';



COMMENT ON COLUMN "public"."financial_accounts"."is_balance_sheet" IS 'If true, appears in Balance Sheet report (default: true)';



CREATE TABLE IF NOT EXISTS "public"."fine_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "days_delay" integer NOT NULL,
    "fine_type" character varying(20),
    "fine_value" numeric(10,2) NOT NULL,
    "max_fine" numeric(10,2),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "fine_rules_fine_type_check" CHECK ((("fine_type")::"text" = ANY ((ARRAY['percentage'::character varying, 'fixed'::character varying])::"text"[])))
);


ALTER TABLE "public"."fine_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."grading_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "academic_year_id" "uuid",
    "grade_name" character varying(5) NOT NULL,
    "min_mark" numeric(5,2) NOT NULL,
    "max_mark" numeric(5,2) NOT NULL,
    "grade_point" numeric(3,2) NOT NULL,
    "remarks" character varying(50),
    "is_default" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."grading_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."grading_system" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "grade_name" character varying(5) NOT NULL,
    "min_mark" numeric(5,2) NOT NULL,
    "max_mark" numeric(5,2) NOT NULL,
    "grade_point" numeric(3,2) NOT NULL,
    "remarks" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."grading_system" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."income_heads" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid",
    "name" character varying(100) NOT NULL,
    "type" character varying(50),
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "code" character varying(50),
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."income_heads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "item_type" character varying(20),
    "is_active" boolean DEFAULT true,
    CONSTRAINT "inventory_categories_item_type_check" CHECK ((("item_type")::"text" = ANY ((ARRAY['asset'::character varying, 'consumable'::character varying, 'saleable'::character varying])::"text"[])))
);


ALTER TABLE "public"."inventory_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_issuance_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "issuance_id" "uuid",
    "item_id" "uuid",
    "quantity" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."inventory_issuance_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_issuances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "issue_no" character varying(50) NOT NULL,
    "issued_to_staff_id" "uuid",
    "issued_date" "date" DEFAULT CURRENT_DATE,
    "purpose" "text",
    "status" character varying(20) DEFAULT 'issued'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "issuance_no" character varying(50),
    "item_id" "uuid",
    "item_type" character varying(20),
    "issued_to_type" character varying(20),
    "issued_to_id" "uuid",
    "issued_to_name" character varying(200),
    "quantity" numeric(15,2),
    "unit" character varying(20),
    "issuance_date" "date",
    CONSTRAINT "inventory_issuances_issued_to_type_check" CHECK ((("issued_to_type")::"text" = ANY ((ARRAY['staff'::character varying, 'student'::character varying])::"text"[]))),
    CONSTRAINT "inventory_issuances_item_type_check" CHECK ((("item_type")::"text" = ANY ((ARRAY['asset'::character varying, 'consumable'::character varying, 'saleable'::character varying])::"text"[]))),
    CONSTRAINT "inventory_issuances_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['requested'::character varying, 'approved'::character varying, 'issued'::character varying, 'returned'::character varying])::"text"[])))
);


ALTER TABLE "public"."inventory_issuances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_code" character varying(50) NOT NULL,
    "name" character varying(255) NOT NULL,
    "category_id" "uuid",
    "item_type" character varying(50) NOT NULL,
    "unit" character varying(20) DEFAULT 'Pcs'::character varying,
    "purchase_price" numeric(10,2) DEFAULT 0.00,
    "selling_price" numeric(10,2) DEFAULT 0.00,
    "current_stock" numeric(10,2) DEFAULT 0.00,
    "reorder_level" numeric(10,2) DEFAULT 5.00,
    "location_rack" character varying(100),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true,
    CONSTRAINT "inventory_items_item_type_check" CHECK ((("item_type")::"text" = ANY ((ARRAY['asset'::character varying, 'consumable'::character varying, 'saleable'::character varying])::"text"[])))
);


ALTER TABLE "public"."inventory_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_purchase_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "purchase_id" "uuid",
    "item_id" "uuid",
    "quantity" numeric(10,2) NOT NULL,
    "unit_price" numeric(10,2) NOT NULL,
    "total_price" numeric(12,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "purchase_price" numeric(15,2)
);


ALTER TABLE "public"."inventory_purchase_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "purchase_no" character varying(50) NOT NULL,
    "supplier_id" "uuid",
    "purchase_date" "date" DEFAULT CURRENT_DATE,
    "total_amount" numeric(12,2) DEFAULT 0.00,
    "paid_amount" numeric(12,2) DEFAULT 0.00,
    "due_amount" numeric(12,2) DEFAULT 0.00,
    "voucher_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "narration" "text",
    CONSTRAINT "inventory_purchases_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'received'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."inventory_purchases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_sale_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sale_id" "uuid",
    "item_id" "uuid",
    "quantity" numeric(10,2) NOT NULL,
    "unit_price" numeric(10,2) NOT NULL,
    "total_price" numeric(12,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."inventory_sale_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_sales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_no" character varying(50) NOT NULL,
    "student_id" "uuid",
    "sale_date" "date" DEFAULT CURRENT_DATE,
    "subtotal" numeric(12,2) DEFAULT 0.00,
    "discount" numeric(12,2) DEFAULT 0.00,
    "net_amount" numeric(12,2) DEFAULT 0.00,
    "paid_amount" numeric(12,2) DEFAULT 0.00,
    "due_amount" numeric(12,2) DEFAULT 0.00,
    "voucher_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sale_no" character varying(50),
    "status" character varying(20) DEFAULT 'completed'::character varying,
    "narration" "text",
    CONSTRAINT "inventory_sales_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['completed'::character varying, 'cancelled'::character varying, 'returned'::character varying])::"text"[])))
);


ALTER TABLE "public"."inventory_sales" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_name" character varying(255) NOT NULL,
    "contact_person" character varying(100),
    "phone" character varying(20),
    "email" character varying(100),
    "address" "text",
    "current_due" numeric(12,2) DEFAULT 0.00,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" character varying(20) DEFAULT 'active'::character varying
);


ALTER TABLE "public"."inventory_suppliers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_transactions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "product_id" "uuid",
    "type" character varying(20) NOT NULL,
    "quantity" integer NOT NULL,
    "price" numeric(10,2),
    "date" "date" NOT NULL,
    "remarks" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."inventory_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."journal_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "voucher_id" "uuid",
    "account_id" "uuid",
    "debit" numeric(12,2) DEFAULT 0.00,
    "credit" numeric(12,2) DEFAULT 0.00,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."journal_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leave_balances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "category_name" "text" NOT NULL,
    "total_days" integer DEFAULT 0,
    "used_days" integer DEFAULT 0,
    "remaining_days" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."leave_balances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leave_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "days_per_year" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."leave_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leaves" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "staff_id" "uuid",
    "type" character varying(50) NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "reason" "text",
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_type" "text" DEFAULT 'staff'::"text",
    "student_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "check_leave_user_identity" CHECK (((("user_type" = 'student'::"text") AND ("student_id" IS NOT NULL)) OR (("user_type" = 'staff'::"text") AND ("staff_id" IS NOT NULL)))),
    CONSTRAINT "leaves_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::"text"[]))),
    CONSTRAINT "leaves_user_type_check" CHECK (("user_type" = ANY (ARRAY['student'::"text", 'staff'::"text"])))
);


ALTER TABLE "public"."leaves" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."migration_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "migration_name" character varying(100) NOT NULL,
    "executed_at" timestamp with time zone DEFAULT "now"(),
    "status" character varying(20) DEFAULT 'success'::character varying,
    "details" "text"
);


ALTER TABLE "public"."migration_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notices" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "type" "text" DEFAULT 'general'::"text",
    "pinned" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_history" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "student_id" "uuid",
    "guardian_name" "text",
    "channel" "text" NOT NULL,
    "message" "text" NOT NULL,
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notification_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enable_sms" boolean DEFAULT false,
    "enable_email" boolean DEFAULT true,
    "payment_notification" boolean DEFAULT true,
    "advance_notification" boolean DEFAULT true,
    "increment_notification" boolean DEFAULT true,
    "promotion_notification" boolean DEFAULT true,
    "sms_api_key" "text",
    "sms_sender_id" "text",
    "email_host" "text",
    "email_port" "text",
    "email_user" "text",
    "email_pass" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."notification_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid",
    "type" character varying(50),
    "title" character varying(255) NOT NULL,
    "message" "text",
    "recipient_type" character varying(50),
    "recipient_id" "uuid",
    "sent_at" timestamp with time zone,
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'sent'::"text",
    "channel" "text" DEFAULT 'general'::"text"
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "address" "text",
    "phone" character varying(20),
    "email" character varying(100),
    "logo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_allocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "month" "text",
    "allocation_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."payment_allocations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_refunds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "refund_amount" numeric(12,2) NOT NULL,
    "refund_date" timestamp without time zone DEFAULT "now"(),
    "reason" "text",
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "approved_by" "uuid",
    "approved_at" timestamp without time zone,
    "processed_at" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "refund_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'completed'::character varying])::"text"[])))
);


ALTER TABLE "public"."payment_refunds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pending_admissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reference_no" character varying(50) NOT NULL,
    "name" character varying(255) NOT NULL,
    "name_bn" character varying(255),
    "father_name" character varying(255) NOT NULL,
    "mother_name" character varying(255) NOT NULL,
    "dob" "date" NOT NULL,
    "gender" character varying(20) NOT NULL,
    "blood_group" character varying(10),
    "particular_disease" "text",
    "birth_cert_no" character varying(50),
    "class_id" "uuid",
    "section_id" "uuid",
    "academic_year_id" "uuid",
    "village" character varying(255),
    "post_office" character varying(255),
    "police_station" character varying(255),
    "district" character varying(100),
    "permanent_village" character varying(255),
    "permanent_post_office" character varying(255),
    "permanent_police_station" character varying(255),
    "permanent_district" character varying(100),
    "contact" character varying(20) NOT NULL,
    "fathers_contact" character varying(20),
    "mothers_contact" character varying(20),
    "email" character varying(100),
    "whatsapp" character varying(20),
    "photo_url" "text",
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "rejection_reason" "text",
    "source" character varying(50) DEFAULT 'public_form'::character varying,
    "applied_at" timestamp with time zone DEFAULT "now"(),
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "approved_student_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "father_name_bn" character varying(255),
    "mother_name_bn" character varying(255),
    "father_nid_no" character varying(100),
    "mother_nid_no" character varying(100),
    CONSTRAINT "pending_admissions_gender_check" CHECK ((("gender")::"text" = ANY ((ARRAY['male'::character varying, 'female'::character varying, 'other'::character varying])::"text"[]))),
    CONSTRAINT "pending_admissions_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'reviewing'::character varying, 'approved'::character varying, 'rejected'::character varying])::"text"[])))
);


ALTER TABLE "public"."pending_admissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pending_auth_creation" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "role" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "attempts" integer DEFAULT 0,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "processed_at" timestamp with time zone,
    CONSTRAINT "pending_auth_creation_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['staff'::"text", 'student'::"text"]))),
    CONSTRAINT "pending_auth_creation_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."pending_auth_creation" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid",
    "name" character varying(255) NOT NULL,
    "sku" character varying(50),
    "category" character varying(100),
    "description" "text",
    "purchase_price" numeric(10,2),
    "sale_price" numeric(10,2),
    "quantity" integer DEFAULT 0,
    "min_quantity" integer DEFAULT 0,
    "unit" character varying(20),
    "photo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" character varying(255) NOT NULL,
    "full_name" character varying(255),
    "phone" character varying(20),
    "avatar_url" "text",
    "organization_id" "uuid",
    "role" character varying(50) DEFAULT 'admin'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "nid_no" "text",
    "blood_group" "text",
    "gender" "text",
    "dob" "date",
    "father_name" "text",
    "mother_name" "text",
    "address" "text",
    CONSTRAINT "profiles_role_check" CHECK ((("role")::"text" = ANY ((ARRAY['admin'::character varying, 'teacher'::character varying, 'staff'::character varying, 'accountant'::character varying, 'store'::character varying, 'student'::character varying, 'user'::character varying])::"text"[])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."questions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid",
    "subject_id" "uuid",
    "type" character varying(20) NOT NULL,
    "question" "text" NOT NULL,
    "options" "jsonb",
    "correct_answer" "text",
    "marks" integer DEFAULT 1,
    "difficulty" character varying(20) DEFAULT 'medium'::character varying,
    "tags" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."result_publish_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "term_id" "uuid",
    "class_id" "uuid",
    "section_id" "uuid",
    "published_by" "uuid",
    "published_at" timestamp without time zone DEFAULT "now"(),
    "notification_sent" boolean DEFAULT false,
    "notes" "text"
);


ALTER TABLE "public"."result_publish_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_menu_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "role" "text" NOT NULL,
    "menu_key" "text" NOT NULL,
    "can_view" boolean DEFAULT true,
    "can_manage" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."role_menu_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(50) NOT NULL,
    "permissions" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."salary_advances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_id" "uuid",
    "amount" numeric(10,2) NOT NULL,
    "advance_date" "date" NOT NULL,
    "reason" "text",
    "total_installments" integer DEFAULT 1,
    "paid_installments" integer DEFAULT 0,
    "installment_amount" numeric(10,2),
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."salary_advances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."salary_balances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_id" "uuid",
    "month" "text" NOT NULL,
    "year" integer NOT NULL,
    "expected_salary" numeric(10,2) NOT NULL,
    "paid_amount" numeric(10,2) DEFAULT 0,
    "balance" numeric(10,2) DEFAULT 0,
    "adjustment_from" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "due_amount" numeric DEFAULT 0,
    "due_date" "date" NOT NULL
);


ALTER TABLE "public"."salary_balances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."salary_increments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_id" "uuid",
    "old_salary" numeric(10,2) NOT NULL,
    "new_salary" numeric(10,2) NOT NULL,
    "increment_percentage" numeric(5,2),
    "effective_from" "date" NOT NULL,
    "reason" "text",
    "created_by" "uuid",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."salary_increments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."salary_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_id" "uuid",
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "sent_via" "text" DEFAULT 'email'::"text",
    "sent_at" timestamp without time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'sent'::"text",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."salary_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."salary_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_id" "uuid",
    "amount" numeric(10,2) NOT NULL,
    "month" "text" NOT NULL,
    "year" integer NOT NULL,
    "payment_date" "date" NOT NULL,
    "payment_method" "text" DEFAULT 'cash'::"text",
    "status" "text" DEFAULT 'paid'::"text",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."salary_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."salary_promotions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_id" "uuid",
    "old_designation" "text" NOT NULL,
    "new_designation" "text" NOT NULL,
    "old_salary_category_id" "uuid",
    "new_salary_category_id" "uuid",
    "effective_from" "date" NOT NULL,
    "increment_amount" numeric(10,2),
    "reason" "text",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."salary_promotions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."salary_version_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "salary_id" "uuid",
    "staff_id" "uuid",
    "old_total" numeric(12,2),
    "new_total" numeric(12,2),
    "changed_by" "uuid",
    "change_reason" "text",
    "changed_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."salary_version_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scholarship_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "discount_id" "uuid" NOT NULL,
    "academic_year_id" "uuid" NOT NULL,
    "percentage" numeric(5,2) NOT NULL,
    "amount" numeric(12,2),
    "reason" "text",
    "approved_by" "uuid",
    "approved_at" timestamp without time zone,
    "valid_from" "date",
    "valid_to" "date",
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "scholarship_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'expired'::character varying])::"text"[])))
);


ALTER TABLE "public"."scholarship_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."school_settings" (
    "id" integer NOT NULL,
    "school_name" character varying(255) DEFAULT 'Shapla Kindergarten & Pre-cadet'::character varying,
    "school_address" "text" DEFAULT 'Nowtala, Madhaiya Bazar, Chandina, Cumilla'::"text",
    "school_phone" character varying(50) DEFAULT '01923253454'::character varying,
    "school_email" character varying(255) DEFAULT 'shapla.kindergarten@gmail.com'::character varying,
    "school_logo" "text",
    "school_watermark" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "half_day_after" time without time zone DEFAULT '11:00:00'::time without time zone,
    "is_friday_off" boolean DEFAULT true,
    "is_saturday_off" boolean DEFAULT false,
    "sms_notification_enabled" boolean DEFAULT true,
    "school_start_time" time without time zone DEFAULT '08:00:00'::time without time zone,
    "late_after" time without time zone DEFAULT '08:15:00'::time without time zone,
    "school_end_time" time without time zone DEFAULT '14:00:00'::time without time zone
);


ALTER TABLE "public"."school_settings" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."school_settings_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."school_settings_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."school_settings_id_seq" OWNED BY "public"."school_settings"."id";



CREATE TABLE IF NOT EXISTS "public"."sibling_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_name" character varying(100),
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."sibling_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_attendance" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "staff_id" "uuid",
    "date" "date" NOT NULL,
    "status" character varying(20) NOT NULL,
    "remarks" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "check_in" time without time zone,
    "check_out" time without time zone,
    CONSTRAINT "staff_attendance_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['present'::character varying, 'absent'::character varying, 'late'::character varying, 'leave'::character varying, 'holiday'::character varying, 'active'::character varying, 'inactive'::character varying])::"text"[])))
);


ALTER TABLE "public"."staff_attendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_attendance" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "student_id" "uuid",
    "date" "date" NOT NULL,
    "status" character varying(20) NOT NULL,
    "remarks" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "marked_by" "text",
    "marked_via" "text" DEFAULT 'manual'::"text",
    "check_in" time without time zone,
    "check_out" time without time zone,
    CONSTRAINT "student_attendance_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['present'::character varying, 'absent'::character varying, 'late'::character varying, 'leave'::character varying, 'holiday'::character varying, 'Present'::character varying, 'Absent'::character varying])::"text"[])))
);


ALTER TABLE "public"."student_attendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_fee_advance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "payment_id" "uuid",
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "remaining_balance" numeric(12,2) DEFAULT 0 NOT NULL,
    "source_academic_year_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "student_fee_advance_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'used'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."student_fee_advance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_fee_dues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "academic_year_id" "uuid" NOT NULL,
    "month" "text" NOT NULL,
    "expected_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "paid_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "due_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "discount_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "fine_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "due_date" "date" NOT NULL,
    "paid_date" "date",
    "is_advance" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."student_fee_dues" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_leave_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "leave_id" "uuid",
    "file_path" "text" NOT NULL,
    "file_name" character varying(255),
    "uploaded_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."student_leave_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_leaves" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "leave_type" character varying(50) NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "reason" "text" NOT NULL,
    "status" character varying(20) DEFAULT 'Pending'::character varying,
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "student_leaves_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['Pending'::character varying, 'Approved'::character varying, 'Rejected'::character varying])::"text"[])))
);


ALTER TABLE "public"."student_leaves" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_marks_new" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid",
    "term_id" "uuid",
    "exam_subject_id" "uuid",
    "marks_obtained" numeric(5,2) DEFAULT 0,
    "is_absent" boolean DEFAULT false,
    "entry_status" character varying(20) DEFAULT 'draft'::character varying,
    "entered_by" "uuid",
    "entered_at" timestamp without time zone DEFAULT "now"(),
    "locked_by" "uuid",
    "locked_at" timestamp without time zone,
    "remarks" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."student_marks_new" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."student_overview" AS
 SELECT "s"."id",
    "s"."student_id",
    "s"."name",
    "s"."name_bn",
    "s"."father_name",
    "s"."mother_name",
    "s"."dob",
    "s"."gender",
    "s"."contact",
    "s"."email",
    "s"."village",
    "s"."post_office",
    "s"."police_station",
    "s"."district",
    "s"."permanent_village",
    "s"."permanent_post_office",
    "s"."permanent_police_station",
    "s"."permanent_district",
    "c"."name" AS "class_name",
    "sec"."name" AS "section_name",
    "s"."class_roll",
    "ay"."name" AS "academic_year_name",
    "s"."admission_date",
    "s"."status",
    "s"."created_at",
    "s"."student_photo_url"
   FROM ((("public"."students" "s"
     LEFT JOIN "public"."classes" "c" ON (("c"."id" = "s"."class_id")))
     LEFT JOIN "public"."sections" "sec" ON (("sec"."id" = "s"."section_id")))
     LEFT JOIN "public"."academic_years" "ay" ON (("ay"."id" = "s"."academic_year_id")))
  WHERE (("s"."status")::"text" = 'active'::"text");


ALTER VIEW "public"."student_overview" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_siblings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid",
    "sibling_group_id" "uuid",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."student_siblings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subjects" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid",
    "name" character varying(100) NOT NULL,
    "code" character varying(20),
    "class_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "subject_type" "text",
    CONSTRAINT "subjects_subject_type_check" CHECK (("subject_type" = ANY (ARRAY['compulsory'::"text", 'elective'::"text", 'group_science'::"text", 'group_humanities'::"text", 'group_commerce'::"text", NULL::"text"])))
);


ALTER TABLE "public"."subjects" OWNER TO "postgres";


COMMENT ON COLUMN "public"."subjects"."subject_type" IS 'Subject type: compulsory, elective, group_science, group_humanities, group_commerce, group';



CREATE TABLE IF NOT EXISTS "public"."teacher_profiles" (
    "id" integer NOT NULL,
    "user_id" "uuid",
    "school_id" integer,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "role" "text" DEFAULT 'teacher'::"text",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."teacher_profiles" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."teacher_profiles_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."teacher_profiles_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."teacher_profiles_id_seq" OWNED BY "public"."teacher_profiles"."id";



CREATE OR REPLACE VIEW "public"."v_due_summary" AS
 WITH "student_total" AS (
         SELECT "sfd"."student_id",
            "sfd"."academic_year_id",
            COALESCE("sum"("sfd"."due_amount"), (0)::numeric) AS "total_due",
            "count"(
                CASE
                    WHEN ("sfd"."status" = 'overdue'::"text") THEN 1
                    ELSE NULL::integer
                END) AS "overdue_months",
            "count"(
                CASE
                    WHEN ("sfd"."status" = 'pending'::"text") THEN 1
                    ELSE NULL::integer
                END) AS "pending_months",
            "count"(
                CASE
                    WHEN ("sfd"."status" = 'partial'::"text") THEN 1
                    ELSE NULL::integer
                END) AS "partial_months",
            "count"(
                CASE
                    WHEN ("sfd"."status" = 'paid'::"text") THEN 1
                    ELSE NULL::integer
                END) AS "paid_months",
            "min"("sfd"."due_date") AS "earliest_due_date",
            COALESCE("sum"("sfd"."expected_amount"), (0)::numeric) AS "total_expected",
            COALESCE("sum"("sfd"."paid_amount"), (0)::numeric) AS "total_paid",
            COALESCE("sum"("sfd"."fine_amount"), (0)::numeric) AS "total_fine",
            COALESCE("sum"("sfd"."discount_amount"), (0)::numeric) AS "total_discount"
           FROM "public"."student_fee_dues" "sfd"
          GROUP BY "sfd"."student_id", "sfd"."academic_year_id"
        ), "advance_total" AS (
         SELECT "fp"."student_id",
            COALESCE("sum"("pa"."amount"), (0)::numeric) AS "total_advance"
           FROM ("public"."payment_allocations" "pa"
             JOIN "public"."fee_payments" "fp" ON (("fp"."id" = "pa"."payment_id")))
          WHERE ("pa"."allocation_type" = ANY (ARRAY['advance'::"text", 'advance_global'::"text"]))
          GROUP BY "fp"."student_id"
        ), "student_info" AS (
         SELECT "s"."id" AS "student_id",
            "s"."student_id" AS "admission_no",
            "s"."name" AS "student_name",
            "s"."class_roll" AS "roll_no",
            "s"."class_id",
            "s"."section_id",
            "s"."father_name",
            "s"."mothers_contact" AS "phone",
            "s"."status" AS "student_status",
            "c"."name" AS "class_name",
            "sec"."name" AS "section_name"
           FROM (("public"."students" "s"
             LEFT JOIN "public"."classes" "c" ON (("c"."id" = "s"."class_id")))
             LEFT JOIN "public"."sections" "sec" ON (("sec"."id" = "s"."section_id")))
          WHERE (("s"."status")::"text" = 'active'::"text")
        )
 SELECT "si"."student_id",
    "si"."admission_no",
    "si"."student_name",
    "si"."roll_no",
    "si"."class_id",
    "si"."class_name",
    "si"."section_id",
    "si"."section_name",
    "si"."father_name",
    "si"."phone",
    "si"."student_status",
    "st"."academic_year_id",
    COALESCE("st"."total_expected", (0)::numeric) AS "total_expected",
    COALESCE("st"."total_paid", (0)::numeric) AS "total_paid",
    COALESCE("st"."total_due", (0)::numeric) AS "total_due",
    COALESCE("st"."total_fine", (0)::numeric) AS "total_fine",
    COALESCE("st"."total_discount", (0)::numeric) AS "total_discount",
    COALESCE("st"."paid_months", (0)::bigint) AS "paid_months",
    COALESCE("st"."partial_months", (0)::bigint) AS "partial_months",
    COALESCE("st"."pending_months", (0)::bigint) AS "pending_months",
    COALESCE("st"."overdue_months", (0)::bigint) AS "overdue_months",
    "st"."earliest_due_date",
    COALESCE("adv"."total_advance", (0)::numeric) AS "total_advance",
    GREATEST((0)::numeric, (COALESCE("st"."total_due", (0)::numeric) - COALESCE("adv"."total_advance", (0)::numeric))) AS "net_due",
        CASE
            WHEN (COALESCE("st"."total_due", (0)::numeric) <= (0)::numeric) THEN '✅ Paid'::"text"
            WHEN (COALESCE("st"."overdue_months", (0)::bigint) > 0) THEN '⚠️ Overdue'::"text"
            WHEN (COALESCE("st"."partial_months", (0)::bigint) > 0) THEN '🟡 Partial'::"text"
            ELSE '🔴 Pending'::"text"
        END AS "overall_status"
   FROM (("student_info" "si"
     LEFT JOIN "student_total" "st" ON (("st"."student_id" = "si"."student_id")))
     LEFT JOIN "advance_total" "adv" ON (("adv"."student_id" = "si"."student_id")))
  ORDER BY GREATEST((0)::numeric, (COALESCE("st"."total_due", (0)::numeric) - COALESCE("adv"."total_advance", (0)::numeric))) DESC;


ALTER VIEW "public"."v_due_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_fee_dashboard" AS
 SELECT "s"."id" AS "student_id",
    "s"."name" AS "student_name",
    "s"."student_id" AS "student_number",
    "c"."name" AS "class_name",
    "sec"."name" AS "section_name",
    "fi"."month",
    "fi"."amount" AS "monthly_fee",
    COALESCE(( SELECT "sum"("fee_payments"."amount") AS "sum"
           FROM "public"."fee_payments"
          WHERE (("fee_payments"."student_id" = "s"."id") AND ("fee_payments"."is_advance" = false) AND (EXTRACT(month FROM "fee_payments"."payment_date") = ("fi"."month")::numeric))), (0)::numeric) AS "regular_paid",
    COALESCE(( SELECT "sum"("fee_payments"."amount") AS "sum"
           FROM "public"."fee_payments"
          WHERE (("fee_payments"."student_id" = "s"."id") AND ("fee_payments"."is_advance" = true))), (0)::numeric) AS "advance_paid",
    "fi"."due_amount",
    "fi"."status",
    "fi"."due_date",
        CASE
            WHEN ((COALESCE(( SELECT "sum"("fee_payments"."amount") AS "sum"
               FROM "public"."fee_payments"
              WHERE (("fee_payments"."student_id" = "s"."id") AND ("fee_payments"."is_advance" = true))), (0)::numeric) > (0)::numeric) AND (COALESCE(( SELECT "sum"("fee_payments"."amount") AS "sum"
               FROM "public"."fee_payments"
              WHERE (("fee_payments"."student_id" = "s"."id") AND ("fee_payments"."is_advance" = false) AND (EXTRACT(month FROM "fee_payments"."payment_date") = ("fi"."month")::numeric))), (0)::numeric) = (0)::numeric)) THEN '✅ Advance'::"text"
            WHEN (("fi"."status")::"text" = 'paid'::"text") THEN '✅ Paid'::"text"
            WHEN (("fi"."status")::"text" = 'partial'::"text") THEN '⚠️ Partial'::"text"
            ELSE '❌ Due'::"text"
        END AS "status_label",
        CASE
            WHEN (("fi"."due_date" < CURRENT_DATE) AND ("fi"."due_amount" > (0)::numeric)) THEN '⚠️ Overdue'::"text"
            ELSE 'Current'::"text"
        END AS "overdue_status"
   FROM ((("public"."fee_invoices" "fi"
     JOIN "public"."students" "s" ON (("s"."id" = "fi"."student_id")))
     JOIN "public"."classes" "c" ON (("c"."id" = "s"."class_id")))
     LEFT JOIN "public"."sections" "sec" ON (("sec"."id" = "s"."section_id")))
  WHERE ("fi"."month" = (EXTRACT(month FROM CURRENT_DATE))::integer);


ALTER VIEW "public"."v_fee_dashboard" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_fee_dashboard_stats" AS
 SELECT ( SELECT "count"(*) AS "count"
           FROM "public"."students"
          WHERE (("students"."status")::"text" = 'active'::"text")) AS "total_students",
    ( SELECT "count"(DISTINCT "student_fee_dues"."student_id") AS "count"
           FROM "public"."student_fee_dues"
          WHERE ("student_fee_dues"."due_amount" > (0)::numeric)) AS "students_with_due",
    ( SELECT "count"(DISTINCT "student_fee_dues"."student_id") AS "count"
           FROM "public"."student_fee_dues"
          WHERE ("student_fee_dues"."status" = 'overdue'::"text")) AS "overdue_students",
    ( SELECT "count"(DISTINCT "student_fee_dues"."student_id") AS "count"
           FROM "public"."student_fee_dues"
          WHERE (("student_fee_dues"."status" = 'paid'::"text") AND ("student_fee_dues"."due_amount" = (0)::numeric))) AS "fully_paid_students",
    ( SELECT COALESCE("sum"("student_fee_dues"."due_amount"), (0)::numeric) AS "coalesce"
           FROM "public"."student_fee_dues") AS "total_due",
    ( SELECT COALESCE("sum"("student_fee_dues"."due_amount"), (0)::numeric) AS "coalesce"
           FROM "public"."student_fee_dues"
          WHERE ("student_fee_dues"."status" = 'overdue'::"text")) AS "overdue_amount",
    ( SELECT COALESCE("sum"("student_fee_dues"."expected_amount"), (0)::numeric) AS "coalesce"
           FROM "public"."student_fee_dues") AS "total_expected",
    ( SELECT COALESCE("sum"("student_fee_dues"."paid_amount"), (0)::numeric) AS "coalesce"
           FROM "public"."student_fee_dues") AS "total_paid",
    ( SELECT "count"(*) AS "count"
           FROM "public"."student_fee_dues"
          WHERE ("student_fee_dues"."month" = "to_char"((CURRENT_DATE)::timestamp with time zone, 'YYYY-MM'::"text"))) AS "current_month_invoices",
    ( SELECT COALESCE("sum"("student_fee_dues"."due_amount"), (0)::numeric) AS "coalesce"
           FROM "public"."student_fee_dues"
          WHERE ("student_fee_dues"."month" = "to_char"((CURRENT_DATE)::timestamp with time zone, 'YYYY-MM'::"text"))) AS "current_month_due";


ALTER VIEW "public"."v_fee_dashboard_stats" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_invoice_dashboard" AS
 SELECT "fi"."id" AS "invoice_id",
    "s"."id" AS "student_id",
    "s"."name" AS "student_name",
    "s"."student_id" AS "student_number",
    "c"."name" AS "class_name",
    "sec"."name" AS "section_name",
    "fi"."month",
    "to_char"(("to_date"(("fi"."month")::"text", 'MM'::"text"))::timestamp with time zone, 'Month'::"text") AS "month_name",
    "fi"."amount" AS "total_fee",
    "fi"."paid_amount",
    "fi"."due_amount",
    "fi"."status",
    "fi"."due_date",
    "fi"."created_at",
    "fi"."updated_at",
        CASE
            WHEN (("fi"."due_date" < CURRENT_DATE) AND (("fi"."status")::"text" <> 'paid'::"text")) THEN 'overdue'::"text"
            ELSE 'current'::"text"
        END AS "overdue_status",
        CASE
            WHEN (("fi"."due_date" < CURRENT_DATE) AND (("fi"."status")::"text" <> 'paid'::"text")) THEN (CURRENT_DATE - "fi"."due_date")
            ELSE 0
        END AS "days_overdue"
   FROM ((("public"."fee_invoices" "fi"
     JOIN "public"."students" "s" ON (("s"."id" = "fi"."student_id")))
     LEFT JOIN "public"."classes" "c" ON (("c"."id" = "s"."class_id")))
     LEFT JOIN "public"."sections" "sec" ON (("sec"."id" = "s"."section_id")))
  WHERE ("fi"."month" = (EXTRACT(month FROM CURRENT_DATE))::integer);


ALTER VIEW "public"."v_invoice_dashboard" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_monthly_invoice" AS
 SELECT "s"."id" AS "student_id",
    "s"."student_id" AS "admission_no",
    "s"."name" AS "student_name",
    "s"."class_roll" AS "roll_no",
    "c"."id" AS "class_id",
    "c"."name" AS "class_name",
    "sec"."id" AS "section_id",
    "sec"."name" AS "section_name",
    "sdf"."month",
    "sdf"."category_id",
    "fc"."name" AS "category_name",
    "sdf"."expected_amount" AS "total_fee",
    "sdf"."paid_amount" AS "paid",
    "sdf"."due_amount" AS "due",
    "sdf"."fine_amount" AS "fine",
    "sdf"."discount_amount" AS "discount",
    "sdf"."status",
    "sdf"."due_date",
    "sdf"."is_advance",
        CASE
            WHEN (("sdf"."due_date" < CURRENT_DATE) AND ("sdf"."due_amount" > (0)::numeric)) THEN (CURRENT_DATE - "sdf"."due_date")
            ELSE 0
        END AS "days_overdue",
    "to_char"(("to_date"("sdf"."month", 'YYYY-MM'::"text"))::timestamp with time zone, 'Month YYYY'::"text") AS "month_name"
   FROM (((("public"."student_fee_dues" "sdf"
     JOIN "public"."students" "s" ON (("s"."id" = "sdf"."student_id")))
     LEFT JOIN "public"."classes" "c" ON (("c"."id" = "s"."class_id")))
     LEFT JOIN "public"."sections" "sec" ON (("sec"."id" = "s"."section_id")))
     LEFT JOIN "public"."fee_categories" "fc" ON (("fc"."id" = "sdf"."category_id")))
  WHERE (("s"."status")::"text" = 'active'::"text")
  ORDER BY "sdf"."month" DESC, "s"."name";


ALTER VIEW "public"."v_monthly_invoice" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_payment_allocation_details" AS
 SELECT "pa"."id",
    "pa"."payment_id",
    "pa"."category_id",
    "fc"."name" AS "category_name",
    "fc"."frequency",
    "pa"."amount",
    "pa"."month",
    "pa"."allocation_type",
    COALESCE("public"."get_month_range"("pa"."category_id", "pa"."payment_id"), "public"."format_month_display"("pa"."month"), '—'::"text") AS "month_display"
   FROM ("public"."payment_allocations" "pa"
     LEFT JOIN "public"."fee_categories" "fc" ON (("fc"."id" = "pa"."category_id")));


ALTER VIEW "public"."v_payment_allocation_details" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_payment_receipt" AS
 SELECT "fp"."receipt_no",
    "fp"."payment_date",
    "fp"."student_id",
    "s"."name" AS "student_name",
    "s"."student_id" AS "admission_no",
    "c"."name" AS "class_name",
    "sec"."name" AS "section_name",
    "fp"."amount" AS "paid_amount",
    "fp"."discount_amount",
    "fp"."fine_amount",
    (("fp"."amount" - "fp"."discount_amount") + "fp"."fine_amount") AS "net_amount",
    "fc"."name" AS "category_name",
    "fc"."frequency",
    "pa"."month",
    "pa"."amount" AS "allocated_amount",
    "pa"."allocation_type",
        CASE
            WHEN ("pa"."month" IS NULL) THEN 'Advance Payment'::"text"
            ELSE "to_char"(("to_date"(("pa"."month" || '-01'::"text"), 'YYYY-MM-DD'::"text"))::timestamp with time zone, 'Month YYYY'::"text")
        END AS "month_display"
   FROM ((((("public"."fee_payments" "fp"
     LEFT JOIN "public"."payment_allocations" "pa" ON (("pa"."payment_id" = "fp"."id")))
     LEFT JOIN "public"."fee_categories" "fc" ON (("fc"."id" = "pa"."category_id")))
     LEFT JOIN "public"."students" "s" ON (("s"."id" = "fp"."student_id")))
     LEFT JOIN "public"."classes" "c" ON (("c"."id" = "s"."class_id")))
     LEFT JOIN "public"."sections" "sec" ON (("sec"."id" = "s"."section_id")))
  ORDER BY "fp"."receipt_no", "pa"."month";


ALTER VIEW "public"."v_payment_receipt" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_staff_salaries" AS
 SELECT "st"."id" AS "staff_id",
    "st"."name" AS "staff_name",
    "st"."employee_id",
    "st"."designation",
    "st"."photo_url",
    "st"."status",
    "sal"."id" AS "salary_id",
    "sal"."salary_category_id",
    "cat"."name" AS "category_name",
    COALESCE("sal"."basic", (0)::numeric) AS "basic",
    COALESCE("sal"."hra", (0)::numeric) AS "hra",
    COALESCE("sal"."da", (0)::numeric) AS "da",
    COALESCE("sal"."allowances", (0)::numeric) AS "allowances",
    COALESCE("sal"."personal_allowance", (0)::numeric) AS "personal_allowance",
    COALESCE("sal"."special_allowance", (0)::numeric) AS "special_allowance",
    COALESCE("sal"."other_deductions", (0)::numeric) AS "other_deductions",
    ((((((COALESCE("sal"."basic", (0)::numeric) + COALESCE("sal"."hra", (0)::numeric)) + COALESCE("sal"."da", (0)::numeric)) + COALESCE("sal"."allowances", (0)::numeric)) + COALESCE("sal"."personal_allowance", (0)::numeric)) + COALESCE("sal"."special_allowance", (0)::numeric)) - COALESCE("sal"."other_deductions", (0)::numeric)) AS "total_salary",
    "sal"."effective_from",
    "sal"."is_current",
    "sal"."version"
   FROM (("public"."staff" "st"
     LEFT JOIN "public"."staff_salaries" "sal" ON ((("st"."id" = "sal"."staff_id") AND ("sal"."is_current" = true))))
     LEFT JOIN "public"."salary_categories" "cat" ON (("sal"."salary_category_id" = "cat"."id")));


ALTER VIEW "public"."v_staff_salaries" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_student_advance_balance" AS
 SELECT "s"."id" AS "student_id",
    "s"."name" AS "student_name",
    "s"."student_id" AS "student_number",
    "c"."name" AS "class_name",
    COALESCE(( SELECT "sum"("fee_payments"."amount") AS "sum"
           FROM "public"."fee_payments"
          WHERE (("fee_payments"."student_id" = "s"."id") AND ("fee_payments"."is_advance" = true))), (0)::numeric) AS "total_advance_paid",
    COALESCE(( SELECT "sum"("fee_payments"."amount") AS "sum"
           FROM "public"."fee_payments"
          WHERE (("fee_payments"."student_id" = "s"."id") AND ("fee_payments"."is_advance" = false))), (0)::numeric) AS "total_regular_paid",
    COALESCE(( SELECT "sum"("fee_invoices"."amount") AS "sum"
           FROM "public"."fee_invoices"
          WHERE (("fee_invoices"."student_id" = "s"."id") AND ("fee_invoices"."month" = (EXTRACT(month FROM CURRENT_DATE))::integer))), (0)::numeric) AS "current_month_fee",
    (COALESCE(( SELECT "sum"("fee_payments"."amount") AS "sum"
           FROM "public"."fee_payments"
          WHERE (("fee_payments"."student_id" = "s"."id") AND ("fee_payments"."is_advance" = true))), (0)::numeric) - COALESCE(( SELECT "sum"("fee_invoices"."amount") AS "sum"
           FROM "public"."fee_invoices"
          WHERE (("fee_invoices"."student_id" = "s"."id") AND ("fee_invoices"."month" = (EXTRACT(month FROM CURRENT_DATE))::integer))), (0)::numeric)) AS "advance_balance"
   FROM ("public"."students" "s"
     LEFT JOIN "public"."classes" "c" ON (("c"."id" = "s"."class_id")))
  WHERE ((("s"."status")::"text" = 'active'::"text") AND (COALESCE(( SELECT "sum"("fee_payments"."amount") AS "sum"
           FROM "public"."fee_payments"
          WHERE (("fee_payments"."student_id" = "s"."id") AND ("fee_payments"."is_advance" = true))), (0)::numeric) > (0)::numeric))
  ORDER BY (COALESCE(( SELECT "sum"("fee_payments"."amount") AS "sum"
           FROM "public"."fee_payments"
          WHERE (("fee_payments"."student_id" = "s"."id") AND ("fee_payments"."is_advance" = true))), (0)::numeric) - COALESCE(( SELECT "sum"("fee_invoices"."amount") AS "sum"
           FROM "public"."fee_invoices"
          WHERE (("fee_invoices"."student_id" = "s"."id") AND ("fee_invoices"."month" = (EXTRACT(month FROM CURRENT_DATE))::integer))), (0)::numeric)) DESC;


ALTER VIEW "public"."v_student_advance_balance" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_student_due_summary" AS
 WITH "student_total" AS (
         SELECT "sfd"."student_id",
            COALESCE("sum"("sfd"."due_amount"), (0)::numeric) AS "total_due",
            "count"(
                CASE
                    WHEN ("sfd"."status" = 'overdue'::"text") THEN 1
                    ELSE NULL::integer
                END) AS "overdue_count",
            "count"(
                CASE
                    WHEN ("sfd"."status" = 'pending'::"text") THEN 1
                    ELSE NULL::integer
                END) AS "pending_count",
            "count"(
                CASE
                    WHEN ("sfd"."status" = 'partial'::"text") THEN 1
                    ELSE NULL::integer
                END) AS "partial_count",
            "min"("sfd"."due_date") AS "earliest_due_date"
           FROM "public"."student_fee_dues" "sfd"
          GROUP BY "sfd"."student_id"
        ), "advance_total" AS (
         SELECT "fp"."student_id",
            COALESCE("sum"("pa"."amount"), (0)::numeric) AS "total_advance"
           FROM ("public"."payment_allocations" "pa"
             JOIN "public"."fee_payments" "fp" ON (("fp"."id" = "pa"."payment_id")))
          WHERE ("pa"."allocation_type" = ANY (ARRAY['advance'::"text", 'advance_global'::"text"]))
          GROUP BY "fp"."student_id"
        )
 SELECT "s"."id" AS "student_id",
    "s"."student_id" AS "admission_no",
    "s"."name" AS "student_name",
    "c"."name" AS "class_name",
    "sec"."name" AS "section_name",
    COALESCE("st"."total_due", (0)::numeric) AS "total_due",
    COALESCE("adv"."total_advance", (0)::numeric) AS "total_advance",
    GREATEST((0)::numeric, (COALESCE("st"."total_due", (0)::numeric) - COALESCE("adv"."total_advance", (0)::numeric))) AS "net_due",
    COALESCE("st"."overdue_count", (0)::bigint) AS "overdue_count",
    COALESCE("st"."pending_count", (0)::bigint) AS "pending_count",
    COALESCE("st"."partial_count", (0)::bigint) AS "partial_count",
    "st"."earliest_due_date",
        CASE
            WHEN (COALESCE("st"."total_due", (0)::numeric) <= (0)::numeric) THEN '✅ Paid'::"text"
            WHEN (COALESCE("st"."overdue_count", (0)::bigint) > 0) THEN '⚠️ Overdue'::"text"
            WHEN (COALESCE("st"."partial_count", (0)::bigint) > 0) THEN '🟡 Partial'::"text"
            ELSE '🔴 Pending'::"text"
        END AS "due_status"
   FROM (((("public"."students" "s"
     LEFT JOIN "public"."classes" "c" ON (("c"."id" = "s"."class_id")))
     LEFT JOIN "public"."sections" "sec" ON (("sec"."id" = "s"."section_id")))
     LEFT JOIN "student_total" "st" ON (("st"."student_id" = "s"."id")))
     LEFT JOIN "advance_total" "adv" ON (("adv"."student_id" = "s"."id")))
  WHERE (("s"."status")::"text" = 'active'::"text")
  ORDER BY GREATEST((0)::numeric, (COALESCE("st"."total_due", (0)::numeric) - COALESCE("adv"."total_advance", (0)::numeric))) DESC;


ALTER VIEW "public"."v_student_due_summary" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_student_due_with_carry_forward" AS
 SELECT "s"."id" AS "student_id",
    "s"."name" AS "student_name",
    "s"."student_id" AS "admission_no",
    "c"."name" AS "class_name",
    "sec"."name" AS "section_name",
    "ay"."year_name" AS "academic_year",
    COALESCE(( SELECT "sum"("ft"."due_amount") AS "sum"
           FROM "public"."fee_transactions" "ft"
          WHERE (("ft"."student_id" = "s"."id") AND (("ft"."status")::"text" <> 'cancelled'::"text"))), (0)::numeric) AS "current_due",
    COALESCE(( SELECT "sum"("fi"."due_amount") AS "sum"
           FROM "public"."fee_invoices" "fi"
          WHERE (("fi"."student_id" = "s"."id") AND ("fi"."month" = 0))), (0)::numeric) AS "carried_forward_due",
    (COALESCE(( SELECT "sum"("ft"."due_amount") AS "sum"
           FROM "public"."fee_transactions" "ft"
          WHERE (("ft"."student_id" = "s"."id") AND (("ft"."status")::"text" <> 'cancelled'::"text"))), (0)::numeric) + COALESCE(( SELECT "sum"("fi"."due_amount") AS "sum"
           FROM "public"."fee_invoices" "fi"
          WHERE (("fi"."student_id" = "s"."id") AND ("fi"."month" = 0))), (0)::numeric)) AS "total_due"
   FROM ((("public"."students" "s"
     LEFT JOIN "public"."classes" "c" ON (("c"."id" = "s"."class_id")))
     LEFT JOIN "public"."sections" "sec" ON (("sec"."id" = "s"."section_id")))
     LEFT JOIN "public"."academic_years" "ay" ON (("ay"."id" = "s"."academic_year_id")))
  WHERE (("s"."status")::"text" = 'active'::"text")
  ORDER BY (COALESCE(( SELECT "sum"("ft"."due_amount") AS "sum"
           FROM "public"."fee_transactions" "ft"
          WHERE (("ft"."student_id" = "s"."id") AND (("ft"."status")::"text" <> 'cancelled'::"text"))), (0)::numeric) + COALESCE(( SELECT "sum"("fi"."due_amount") AS "sum"
           FROM "public"."fee_invoices" "fi"
          WHERE (("fi"."student_id" = "s"."id") AND ("fi"."month" = 0))), (0)::numeric)) DESC;


ALTER VIEW "public"."v_student_due_with_carry_forward" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vouchers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "voucher_no" character varying(50) NOT NULL,
    "voucher_type" character varying(20) NOT NULL,
    "voucher_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "financial_account_id" "uuid",
    "total_amount" numeric(12,2) DEFAULT 0.00 NOT NULL,
    "paid_to_received_from" character varying(255),
    "reference_no" character varying(100),
    "narration" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "vouchers_voucher_type_check" CHECK ((("voucher_type")::"text" = ANY ((ARRAY['receipt'::character varying, 'payment'::character varying, 'journal'::character varying, 'transfer'::character varying])::"text"[])))
);


ALTER TABLE "public"."vouchers" OWNER TO "postgres";


ALTER TABLE ONLY "public"."school_settings" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."school_settings_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."teacher_profiles" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."teacher_profiles_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."academic_years"
    ADD CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."account_credentials"
    ADD CONSTRAINT "account_credentials_email_unique" UNIQUE ("email");



ALTER TABLE ONLY "public"."account_credentials"
    ADD CONSTRAINT "account_credentials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."address_districts"
    ADD CONSTRAINT "address_districts_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."address_districts"
    ADD CONSTRAINT "address_districts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."address_police_stations"
    ADD CONSTRAINT "address_police_stations_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."address_police_stations"
    ADD CONSTRAINT "address_police_stations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."address_post_offices"
    ADD CONSTRAINT "address_post_offices_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."address_post_offices"
    ADD CONSTRAINT "address_post_offices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."address_villages"
    ADD CONSTRAINT "address_villages_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."address_villages"
    ADD CONSTRAINT "address_villages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."advance_installments"
    ADD CONSTRAINT "advance_installments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."advance_payments"
    ADD CONSTRAINT "advance_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance_holidays"
    ADD CONSTRAINT "attendance_holidays_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance_settings"
    ADD CONSTRAINT "attendance_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."certificate_templates"
    ADD CONSTRAINT "certificate_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chart_of_accounts"
    ADD CONSTRAINT "chart_of_accounts_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."chart_of_accounts"
    ADD CONSTRAINT "chart_of_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compiled_results"
    ADD CONSTRAINT "compiled_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compiled_results"
    ADD CONSTRAINT "compiled_results_student_id_term_id_key" UNIQUE ("student_id", "term_id");



ALTER TABLE ONLY "public"."exam_settings_new"
    ADD CONSTRAINT "exam_settings_new_academic_year_id_setting_key_key" UNIQUE ("academic_year_id", "setting_key");



ALTER TABLE ONLY "public"."exam_settings_new"
    ADD CONSTRAINT "exam_settings_new_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exam_subjects"
    ADD CONSTRAINT "exam_subjects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exam_subjects"
    ADD CONSTRAINT "exam_subjects_term_id_class_id_section_id_subject_id_key" UNIQUE ("term_id", "class_id", "section_id", "subject_id");



ALTER TABLE ONLY "public"."exam_terms"
    ADD CONSTRAINT "exam_terms_academic_year_id_term_code_key" UNIQUE ("academic_year_id", "term_code");



ALTER TABLE ONLY "public"."exam_terms"
    ADD CONSTRAINT "exam_terms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expense_heads"
    ADD CONSTRAINT "expense_heads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fee_assignment_history"
    ADD CONSTRAINT "fee_assignment_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fee_categories"
    ADD CONSTRAINT "fee_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fee_discounts"
    ADD CONSTRAINT "fee_discounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fee_invoice_items"
    ADD CONSTRAINT "fee_invoice_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fee_invoices"
    ADD CONSTRAINT "fee_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fee_payments"
    ADD CONSTRAINT "fee_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fee_payments"
    ADD CONSTRAINT "fee_payments_receipt_no_unique" UNIQUE ("receipt_no");



ALTER TABLE ONLY "public"."fee_structure_items"
    ADD CONSTRAINT "fee_structure_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fee_structure_versions"
    ADD CONSTRAINT "fee_structure_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fee_structures"
    ADD CONSTRAINT "fee_structures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fee_student_assignments"
    ADD CONSTRAINT "fee_student_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fee_transactions"
    ADD CONSTRAINT "fee_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fee_transactions"
    ADD CONSTRAINT "fee_transactions_receipt_no_key" UNIQUE ("receipt_no");



ALTER TABLE ONLY "public"."finance_heads"
    ADD CONSTRAINT "finance_heads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_transactions"
    ADD CONSTRAINT "finance_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financial_accounts"
    ADD CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fine_rules"
    ADD CONSTRAINT "fine_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."grading_rules"
    ADD CONSTRAINT "grading_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."grading_system"
    ADD CONSTRAINT "grading_system_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."income_heads"
    ADD CONSTRAINT "income_heads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_categories"
    ADD CONSTRAINT "inventory_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_issuance_items"
    ADD CONSTRAINT "inventory_issuance_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_issuances"
    ADD CONSTRAINT "inventory_issuances_issue_no_key" UNIQUE ("issue_no");



ALTER TABLE ONLY "public"."inventory_issuances"
    ADD CONSTRAINT "inventory_issuances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_item_code_key" UNIQUE ("item_code");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_purchase_items"
    ADD CONSTRAINT "inventory_purchase_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_purchases"
    ADD CONSTRAINT "inventory_purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_purchases"
    ADD CONSTRAINT "inventory_purchases_purchase_no_key" UNIQUE ("purchase_no");



ALTER TABLE ONLY "public"."inventory_sale_items"
    ADD CONSTRAINT "inventory_sale_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_sales"
    ADD CONSTRAINT "inventory_sales_invoice_no_key" UNIQUE ("invoice_no");



ALTER TABLE ONLY "public"."inventory_sales"
    ADD CONSTRAINT "inventory_sales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_sales"
    ADD CONSTRAINT "inventory_sales_sale_no_key" UNIQUE ("sale_no");



ALTER TABLE ONLY "public"."inventory_suppliers"
    ADD CONSTRAINT "inventory_suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leave_balances"
    ADD CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leave_balances"
    ADD CONSTRAINT "leave_balances_staff_id_category_name_key" UNIQUE ("staff_id", "category_name");



ALTER TABLE ONLY "public"."leave_categories"
    ADD CONSTRAINT "leave_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."leave_categories"
    ADD CONSTRAINT "leave_categories_name_unique" UNIQUE ("name");



ALTER TABLE ONLY "public"."leave_categories"
    ADD CONSTRAINT "leave_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leaves"
    ADD CONSTRAINT "leaves_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."migration_log"
    ADD CONSTRAINT "migration_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notices"
    ADD CONSTRAINT "notices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_history"
    ADD CONSTRAINT "notification_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_settings"
    ADD CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_allocations"
    ADD CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_refunds"
    ADD CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pending_admissions"
    ADD CONSTRAINT "pending_admissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pending_admissions"
    ADD CONSTRAINT "pending_admissions_reference_no_key" UNIQUE ("reference_no");



ALTER TABLE ONLY "public"."pending_auth_creation"
    ADD CONSTRAINT "pending_auth_creation_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."result_publish_log"
    ADD CONSTRAINT "result_publish_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_menu_permissions"
    ADD CONSTRAINT "role_menu_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_menu_permissions"
    ADD CONSTRAINT "role_menu_permissions_role_menu_key_key" UNIQUE ("role", "menu_key");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."salary_advances"
    ADD CONSTRAINT "salary_advances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."salary_balances"
    ADD CONSTRAINT "salary_balances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."salary_balances"
    ADD CONSTRAINT "salary_balances_staff_id_month_year_key" UNIQUE ("staff_id", "month", "year");



ALTER TABLE ONLY "public"."salary_categories"
    ADD CONSTRAINT "salary_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."salary_increments"
    ADD CONSTRAINT "salary_increments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."salary_notifications"
    ADD CONSTRAINT "salary_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."salary_payments"
    ADD CONSTRAINT "salary_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."salary_promotions"
    ADD CONSTRAINT "salary_promotions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."salary_version_history"
    ADD CONSTRAINT "salary_version_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scholarship_applications"
    ADD CONSTRAINT "scholarship_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."school_settings"
    ADD CONSTRAINT "school_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sections"
    ADD CONSTRAINT "sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sibling_groups"
    ADD CONSTRAINT "sibling_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_attendance"
    ADD CONSTRAINT "staff_attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_attendance"
    ADD CONSTRAINT "staff_attendance_staff_id_date_key" UNIQUE ("staff_id", "date");



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_employee_id_key" UNIQUE ("employee_id");



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_salaries"
    ADD CONSTRAINT "staff_salaries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_attendance"
    ADD CONSTRAINT "student_attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_attendance"
    ADD CONSTRAINT "student_attendance_student_id_date_key" UNIQUE ("student_id", "date");



ALTER TABLE ONLY "public"."student_fee_advance"
    ADD CONSTRAINT "student_fee_advance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_fee_dues"
    ADD CONSTRAINT "student_fee_dues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_fee_dues"
    ADD CONSTRAINT "student_fee_dues_unique_key" UNIQUE ("student_id", "category_id", "month", "academic_year_id");



ALTER TABLE ONLY "public"."student_leave_attachments"
    ADD CONSTRAINT "student_leave_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_leaves"
    ADD CONSTRAINT "student_leaves_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_marks_new"
    ADD CONSTRAINT "student_marks_new_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_marks_new"
    ADD CONSTRAINT "student_marks_new_student_id_term_id_exam_subject_id_key" UNIQUE ("student_id", "term_id", "exam_subject_id");



ALTER TABLE ONLY "public"."student_siblings"
    ADD CONSTRAINT "student_siblings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_siblings"
    ADD CONSTRAINT "student_siblings_student_id_sibling_group_id_key" UNIQUE ("student_id", "sibling_group_id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_admission_no_key" UNIQUE ("student_id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_qr_code_key" UNIQUE ("qr_code");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_rfid_uid_key" UNIQUE ("rfid_uid");



ALTER TABLE ONLY "public"."subjects"
    ADD CONSTRAINT "subjects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teacher_profiles"
    ADD CONSTRAINT "teacher_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "unique_class_section_roll" UNIQUE ("class_id", "section_id", "class_roll");



ALTER TABLE ONLY "public"."salary_payments"
    ADD CONSTRAINT "unique_staff_month_year" UNIQUE ("staff_id", "month", "year");



ALTER TABLE ONLY "public"."salary_balances"
    ADD CONSTRAINT "unique_staff_monthly_salary" UNIQUE ("staff_id", "year", "month");



ALTER TABLE ONLY "public"."fee_transactions"
    ADD CONSTRAINT "unique_student_category_month" UNIQUE ("student_id", "category_id", "month");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "unique_student_identity" UNIQUE ("name", "father_name", "mother_name");



ALTER TABLE ONLY "public"."academic_years"
    ADD CONSTRAINT "unique_year_name" UNIQUE ("year_name");



ALTER TABLE ONLY "public"."vouchers"
    ADD CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vouchers"
    ADD CONSTRAINT "vouchers_voucher_no_key" UNIQUE ("voucher_no");



CREATE INDEX "idx_account_credentials_created" ON "public"."account_credentials" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_account_credentials_email" ON "public"."account_credentials" USING "btree" ("email");



CREATE INDEX "idx_account_credentials_entity" ON "public"."account_credentials" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_advance_payments_student" ON "public"."advance_payments" USING "btree" ("student_id");



CREATE INDEX "idx_attendance_date" ON "public"."student_attendance" USING "btree" ("date");



CREATE INDEX "idx_attendance_holidays_date" ON "public"."attendance_holidays" USING "btree" ("holiday_date");



CREATE INDEX "idx_attendance_student_date" ON "public"."student_attendance" USING "btree" ("student_id", "date");



CREATE INDEX "idx_audit_logs_entity" ON "public"."audit_logs" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_compiled_results_published" ON "public"."compiled_results" USING "btree" ("is_published");



CREATE INDEX "idx_compiled_results_rank" ON "public"."compiled_results" USING "btree" ("class_rank");



CREATE INDEX "idx_compiled_results_status" ON "public"."compiled_results" USING "btree" ("result_status");



CREATE INDEX "idx_compiled_results_student" ON "public"."compiled_results" USING "btree" ("student_id");



CREATE INDEX "idx_compiled_results_term" ON "public"."compiled_results" USING "btree" ("term_id");



CREATE INDEX "idx_exam_subjects_class" ON "public"."exam_subjects" USING "btree" ("class_id");



CREATE INDEX "idx_exam_subjects_section" ON "public"."exam_subjects" USING "btree" ("section_id");



CREATE INDEX "idx_exam_subjects_term" ON "public"."exam_subjects" USING "btree" ("term_id");



CREATE INDEX "idx_exam_terms_academic_year" ON "public"."exam_terms" USING "btree" ("academic_year_id");



CREATE INDEX "idx_exam_terms_result_status" ON "public"."exam_terms" USING "btree" ("result_status");



CREATE INDEX "idx_exam_terms_status" ON "public"."exam_terms" USING "btree" ("status");



CREATE INDEX "idx_fee_assignment_history_action" ON "public"."fee_assignment_history" USING "btree" ("action");



CREATE INDEX "idx_fee_assignment_history_assignment" ON "public"."fee_assignment_history" USING "btree" ("assignment_id");



CREATE INDEX "idx_fee_assignment_history_student" ON "public"."fee_assignment_history" USING "btree" ("student_id");



CREATE INDEX "idx_fee_categories_custom" ON "public"."fee_categories" USING "gin" ("custom_schedule");



CREATE INDEX "idx_fee_categories_frequency" ON "public"."fee_categories" USING "btree" ("frequency");



CREATE INDEX "idx_fee_invoices_academic_year" ON "public"."fee_invoices" USING "btree" ("academic_year_id");



CREATE INDEX "idx_fee_invoices_due_date" ON "public"."fee_invoices" USING "btree" ("due_date");



CREATE INDEX "idx_fee_invoices_status" ON "public"."fee_invoices" USING "btree" ("status");



CREATE INDEX "idx_fee_invoices_student" ON "public"."fee_invoices" USING "btree" ("student_id");



CREATE INDEX "idx_fee_payments_fee_transaction_id" ON "public"."fee_payments" USING "btree" ("fee_transaction_id");



CREATE INDEX "idx_fee_payments_payment_date" ON "public"."fee_payments" USING "btree" ("payment_date");



CREATE INDEX "idx_fee_payments_receipt_no" ON "public"."fee_payments" USING "btree" ("receipt_no");



CREATE INDEX "idx_fee_payments_student_date" ON "public"."fee_payments" USING "btree" ("student_id", "payment_date" DESC);



CREATE INDEX "idx_fee_payments_student_id" ON "public"."fee_payments" USING "btree" ("student_id");



CREATE INDEX "idx_fee_status" ON "public"."fee_transactions" USING "btree" ("status");



CREATE INDEX "idx_fee_structure_items_category" ON "public"."fee_structure_items" USING "btree" ("category_id");



CREATE INDEX "idx_fee_structure_items_structure" ON "public"."fee_structure_items" USING "btree" ("fee_structure_id");



CREATE INDEX "idx_fee_structure_items_structure_id" ON "public"."fee_structure_items" USING "btree" ("fee_structure_id");



CREATE INDEX "idx_fee_structure_versions_structure" ON "public"."fee_structure_versions" USING "btree" ("structure_id");



CREATE INDEX "idx_fee_structures_academic_year" ON "public"."fee_structures" USING "btree" ("academic_year_id");



CREATE INDEX "idx_fee_structures_active" ON "public"."fee_structures" USING "btree" ("is_active");



CREATE INDEX "idx_fee_structures_class" ON "public"."fee_structures" USING "btree" ("class_id");



CREATE INDEX "idx_fee_student_assignments_academic_year" ON "public"."fee_student_assignments" USING "btree" ("academic_year_id");



CREATE INDEX "idx_fee_student_assignments_active" ON "public"."fee_student_assignments" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_fee_student_assignments_effective_dates" ON "public"."fee_student_assignments" USING "btree" ("effective_from", "effective_to");



CREATE INDEX "idx_fee_student_assignments_structure" ON "public"."fee_student_assignments" USING "btree" ("fee_structure_id");



CREATE INDEX "idx_fee_student_assignments_student" ON "public"."fee_student_assignments" USING "btree" ("student_id");



CREATE UNIQUE INDEX "idx_fee_student_assignments_unique_active" ON "public"."fee_student_assignments" USING "btree" ("student_id", "academic_year_id") WHERE ("is_active" = true);



CREATE INDEX "idx_fee_transactions_discount_id" ON "public"."fee_transactions" USING "btree" ("discount_id");



CREATE INDEX "idx_fee_transactions_due_amount" ON "public"."fee_transactions" USING "btree" ("due_amount") WHERE ("due_amount" > (0)::numeric);



CREATE INDEX "idx_fee_transactions_due_date" ON "public"."fee_transactions" USING "btree" ("due_date") WHERE (("status")::"text" = ANY ((ARRAY['pending'::character varying, 'partial'::character varying])::"text"[]));



CREATE INDEX "idx_fee_transactions_fee_structure" ON "public"."fee_transactions" USING "btree" ("fee_structure_id");



CREATE INDEX "idx_fee_transactions_fine_rule_id" ON "public"."fee_transactions" USING "btree" ("fine_rule_id");



CREATE INDEX "idx_fee_transactions_month" ON "public"."fee_transactions" USING "btree" ("month");



CREATE INDEX "idx_fee_transactions_receipt" ON "public"."fee_transactions" USING "btree" ("receipt_no");



CREATE INDEX "idx_fee_transactions_status" ON "public"."fee_transactions" USING "btree" ("status");



CREATE INDEX "idx_fee_transactions_student" ON "public"."fee_transactions" USING "btree" ("student_id");



CREATE INDEX "idx_fee_transactions_student_month" ON "public"."fee_transactions" USING "btree" ("student_id", "month");



CREATE INDEX "idx_fee_transactions_student_status" ON "public"."fee_transactions" USING "btree" ("student_id", "status") WHERE (("status")::"text" <> 'cancelled'::"text");



CREATE UNIQUE INDEX "idx_finance_salary_reference_unique" ON "public"."finance_transactions" USING "btree" ("reference_id") WHERE ((("source_type")::"text" = ANY ((ARRAY['salary_payment'::character varying, 'salary'::character varying])::"text"[])) AND ("reference_id" IS NOT NULL));



CREATE INDEX "idx_finance_transactions_date" ON "public"."finance_transactions" USING "btree" ("date");



CREATE UNIQUE INDEX "idx_finance_transactions_fee_payment_unique" ON "public"."finance_transactions" USING "btree" ("source_type", "source_id") WHERE ((("source_type")::"text" = 'fee_payment'::"text") AND ("source_id" IS NOT NULL));



CREATE INDEX "idx_finance_transactions_source" ON "public"."finance_transactions" USING "btree" ("source_type", "source_id");



CREATE INDEX "idx_finance_transactions_type" ON "public"."finance_transactions" USING "btree" ("type");



CREATE INDEX "idx_finance_transactions_type_date" ON "public"."finance_transactions" USING "btree" ("type", "date");



CREATE INDEX "idx_financial_accounts_name" ON "public"."financial_accounts" USING "btree" ("account_name");



CREATE INDEX "idx_grading_rules_academic_year" ON "public"."grading_rules" USING "btree" ("academic_year_id");



CREATE INDEX "idx_invoice_items_invoice" ON "public"."fee_invoice_items" USING "btree" ("invoice_id");



CREATE INDEX "idx_journal_entries_account_id" ON "public"."journal_entries" USING "btree" ("account_id");



CREATE INDEX "idx_journal_entries_voucher_id" ON "public"."journal_entries" USING "btree" ("voucher_id");



CREATE INDEX "idx_leaves_staff_id" ON "public"."leaves" USING "btree" ("staff_id");



CREATE INDEX "idx_payment_allocations_category" ON "public"."payment_allocations" USING "btree" ("category_id");



CREATE INDEX "idx_payment_allocations_payment" ON "public"."payment_allocations" USING "btree" ("payment_id");



CREATE INDEX "idx_payment_refunds_payment" ON "public"."payment_refunds" USING "btree" ("payment_id");



CREATE INDEX "idx_pending_admissions_applied" ON "public"."pending_admissions" USING "btree" ("applied_at" DESC);



CREATE INDEX "idx_pending_admissions_class" ON "public"."pending_admissions" USING "btree" ("class_id");



CREATE INDEX "idx_pending_admissions_ref" ON "public"."pending_admissions" USING "btree" ("reference_no");



CREATE INDEX "idx_pending_admissions_status" ON "public"."pending_admissions" USING "btree" ("status");



CREATE UNIQUE INDEX "idx_pending_auth_entity_unique" ON "public"."pending_auth_creation" USING "btree" ("entity_type", "entity_id") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "idx_pending_auth_status" ON "public"."pending_auth_creation" USING "btree" ("status") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_salary_advances_staff_id" ON "public"."salary_advances" USING "btree" ("staff_id");



CREATE INDEX "idx_salary_balances_staff_date" ON "public"."salary_balances" USING "btree" ("staff_id", "year", "month");



CREATE INDEX "idx_salary_balances_staff_month_year" ON "public"."salary_balances" USING "btree" ("staff_id", "month", "year");



CREATE INDEX "idx_salary_increments_staff_id" ON "public"."salary_increments" USING "btree" ("staff_id");



CREATE INDEX "idx_salary_notifications_staff_id" ON "public"."salary_notifications" USING "btree" ("staff_id");



CREATE INDEX "idx_salary_payments_staff_month_year" ON "public"."salary_payments" USING "btree" ("staff_id", "month", "year");



CREATE INDEX "idx_salary_payments_staff_period" ON "public"."salary_payments" USING "btree" ("staff_id", "year", "month");



CREATE INDEX "idx_salary_promotions_staff_id" ON "public"."salary_promotions" USING "btree" ("staff_id");



CREATE INDEX "idx_scholarship_student" ON "public"."scholarship_applications" USING "btree" ("student_id");



CREATE INDEX "idx_sections_class_id" ON "public"."sections" USING "btree" ("class_id");



CREATE INDEX "idx_staff_organization" ON "public"."staff" USING "btree" ("organization_id");



CREATE INDEX "idx_staff_salaries_category_id" ON "public"."staff_salaries" USING "btree" ("salary_category_id");



CREATE INDEX "idx_staff_salaries_current" ON "public"."staff_salaries" USING "btree" ("staff_id", "is_current");



CREATE INDEX "idx_staff_salaries_effective" ON "public"."staff_salaries" USING "btree" ("effective_from", "effective_to");



CREATE INDEX "idx_staff_salaries_staff_current" ON "public"."staff_salaries" USING "btree" ("staff_id", "is_current");



CREATE INDEX "idx_staff_salaries_staff_id" ON "public"."staff_salaries" USING "btree" ("staff_id");



CREATE INDEX "idx_student_attendance_date" ON "public"."student_attendance" USING "btree" ("date");



CREATE INDEX "idx_student_attendance_student_date" ON "public"."student_attendance" USING "btree" ("student_id", "date");



CREATE INDEX "idx_student_class" ON "public"."students" USING "btree" ("class_id");



CREATE INDEX "idx_student_fee_advance_category" ON "public"."student_fee_advance" USING "btree" ("category_id");



CREATE INDEX "idx_student_fee_advance_status" ON "public"."student_fee_advance" USING "btree" ("status");



CREATE INDEX "idx_student_fee_advance_student" ON "public"."student_fee_advance" USING "btree" ("student_id");



CREATE INDEX "idx_student_fee_dues_academic_year" ON "public"."student_fee_dues" USING "btree" ("academic_year_id");



CREATE INDEX "idx_student_fee_dues_due_date" ON "public"."student_fee_dues" USING "btree" ("due_date");



CREATE INDEX "idx_student_fee_dues_month" ON "public"."student_fee_dues" USING "btree" ("month");



CREATE INDEX "idx_student_fee_dues_status" ON "public"."student_fee_dues" USING "btree" ("status");



CREATE INDEX "idx_student_fee_dues_student" ON "public"."student_fee_dues" USING "btree" ("student_id");



CREATE INDEX "idx_student_marks_status" ON "public"."student_marks_new" USING "btree" ("entry_status");



CREATE INDEX "idx_student_marks_student" ON "public"."student_marks_new" USING "btree" ("student_id");



CREATE INDEX "idx_student_marks_subject" ON "public"."student_marks_new" USING "btree" ("exam_subject_id");



CREATE INDEX "idx_student_marks_term" ON "public"."student_marks_new" USING "btree" ("term_id");



CREATE INDEX "idx_student_marks_term_status" ON "public"."student_marks_new" USING "btree" ("term_id", "entry_status");



CREATE INDEX "idx_student_search" ON "public"."students" USING "btree" ("name", "student_id");



CREATE INDEX "idx_students_class" ON "public"."students" USING "btree" ("class_id");



CREATE INDEX "idx_students_class_section" ON "public"."students" USING "btree" ("class_id", "section_id") WHERE (("status")::"text" = 'active'::"text");



CREATE INDEX "idx_students_current_fee_structure" ON "public"."students" USING "btree" ("current_fee_structure_id");



CREATE INDEX "idx_students_name" ON "public"."students" USING "btree" ("name");



CREATE INDEX "idx_students_organization" ON "public"."students" USING "btree" ("organization_id");



CREATE INDEX "idx_students_qr" ON "public"."students" USING "btree" ("qr_code");



CREATE INDEX "idx_students_rfid" ON "public"."students" USING "btree" ("rfid_uid");



CREATE INDEX "idx_students_section" ON "public"."students" USING "btree" ("section_id");



CREATE INDEX "idx_students_section_id" ON "public"."students" USING "btree" ("section_id");



CREATE INDEX "idx_students_status" ON "public"."students" USING "btree" ("status");



CREATE INDEX "idx_students_status_class" ON "public"."students" USING "btree" ("status", "class_id");



CREATE INDEX "idx_students_student_id" ON "public"."students" USING "btree" ("student_id");



CREATE UNIQUE INDEX "idx_unique_current_salary" ON "public"."staff_salaries" USING "btree" ("staff_id") WHERE ("is_current" = true);



CREATE UNIQUE INDEX "idx_unique_holiday_date" ON "public"."attendance_holidays" USING "btree" ("holiday_date");



CREATE UNIQUE INDEX "unique_student_leave_date_idx" ON "public"."student_leaves" USING "btree" ("student_id", "start_date", "end_date");



CREATE OR REPLACE TRIGGER "auto_update_student_fee_structure_trigger" AFTER INSERT OR UPDATE ON "public"."fee_student_assignments" FOR EACH ROW WHEN (("new"."is_active" = true)) EXECUTE FUNCTION "public"."auto_update_student_fee_structure"();



CREATE OR REPLACE TRIGGER "log_fee_assignment_changes_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."fee_student_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."log_fee_assignment_changes"();



CREATE OR REPLACE TRIGGER "salary_version_history_trigger" AFTER UPDATE ON "public"."staff_salaries" FOR EACH ROW EXECUTE FUNCTION "public"."log_salary_version_history"();



CREATE OR REPLACE TRIGGER "trg_auto_assign_fee_structure" AFTER INSERT ON "public"."students" FOR EACH ROW EXECUTE FUNCTION "public"."auto_assign_fee_structure_to_new_student"();



CREATE OR REPLACE TRIGGER "trg_auto_assign_on_new_student" AFTER INSERT ON "public"."students" FOR EACH ROW EXECUTE FUNCTION "public"."trg_auto_assign_on_new_student"();



CREATE OR REPLACE TRIGGER "trg_auto_reassign_on_assignment_delete" AFTER DELETE ON "public"."fee_student_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."trg_auto_reassign_on_assignment_delete"();



CREATE OR REPLACE TRIGGER "trg_auto_reassign_on_class_change" AFTER UPDATE OF "class_id" ON "public"."students" FOR EACH ROW EXECUTE FUNCTION "public"."trg_auto_reassign_on_class_change"();



CREATE OR REPLACE TRIGGER "trg_generate_dues_on_assignment" AFTER INSERT ON "public"."fee_student_assignments" FOR EACH ROW WHEN (("new"."is_active" = true)) EXECUTE FUNCTION "public"."auto_generate_dues_on_assignment"();



CREATE OR REPLACE TRIGGER "trg_handle_current_staff_salary" BEFORE INSERT OR UPDATE ON "public"."staff_salaries" FOR EACH ROW EXECUTE FUNCTION "public"."handle_current_staff_salary"();



CREATE OR REPLACE TRIGGER "trg_prevent_role_escalation" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_role_escalation"();



CREATE OR REPLACE TRIGGER "trg_queue_staff_auth" AFTER INSERT ON "public"."staff" FOR EACH ROW EXECUTE FUNCTION "public"."queue_staff_auth_creation"();



CREATE OR REPLACE TRIGGER "trg_queue_student_auth" AFTER INSERT ON "public"."students" FOR EACH ROW EXECUTE FUNCTION "public"."queue_student_auth_creation"();



CREATE OR REPLACE TRIGGER "trg_recalc_acct_balance" AFTER INSERT OR DELETE OR UPDATE ON "public"."finance_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."trg_recalc_account_balance"();



CREATE OR REPLACE TRIGGER "trg_recalc_from_journal" AFTER INSERT OR DELETE OR UPDATE ON "public"."journal_entries" FOR EACH ROW EXECUTE FUNCTION "public"."trg_recalc_from_journal"();



CREATE OR REPLACE TRIGGER "trg_set_academic_year_dates" BEFORE INSERT OR UPDATE OF "academic_year_id", "effective_from", "effective_to" ON "public"."fee_student_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."set_academic_year_dates"();



CREATE OR REPLACE TRIGGER "trg_sync_fee_payment_to_finance" AFTER INSERT OR DELETE OR UPDATE ON "public"."fee_payments" FOR EACH ROW EXECUTE FUNCTION "public"."sync_fee_payment_to_finance"();



CREATE OR REPLACE TRIGGER "trg_sync_inventory_purchase_to_finance" AFTER INSERT OR DELETE OR UPDATE ON "public"."inventory_purchases" FOR EACH ROW EXECUTE FUNCTION "public"."sync_inventory_purchase_to_finance"();



CREATE OR REPLACE TRIGGER "trg_sync_inventory_sale_to_finance" AFTER INSERT OR DELETE OR UPDATE ON "public"."inventory_sales" FOR EACH ROW EXECUTE FUNCTION "public"."sync_inventory_sale_to_finance"();



CREATE OR REPLACE TRIGGER "trg_sync_salary_payment" AFTER INSERT OR DELETE OR UPDATE ON "public"."salary_payments" FOR EACH ROW EXECUTE FUNCTION "public"."sync_salary_payment_to_finance"();



CREATE OR REPLACE TRIGGER "trg_update_salary_balance" AFTER INSERT OR DELETE OR UPDATE ON "public"."salary_payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_salary_balance_on_payment"();



CREATE OR REPLACE TRIGGER "trigger_auto_mark_leave" AFTER UPDATE ON "public"."student_leaves" FOR EACH ROW EXECUTE FUNCTION "public"."auto_mark_student_leave_attendance"();



CREATE OR REPLACE TRIGGER "trigger_auto_update_staff_status" AFTER UPDATE ON "public"."leaves" FOR EACH ROW EXECUTE FUNCTION "public"."auto_update_staff_status_on_leave"();



CREATE OR REPLACE TRIGGER "trigger_create_leave_balance" AFTER INSERT ON "public"."staff" FOR EACH ROW EXECUTE FUNCTION "public"."create_leave_balance_on_staff_create"();



CREATE OR REPLACE TRIGGER "trigger_due_changes_transactions" AFTER UPDATE ON "public"."fee_transactions" FOR EACH ROW WHEN (("old"."due_amount" <> "new"."due_amount")) EXECUTE FUNCTION "public"."notify_due_changes"();



CREATE OR REPLACE TRIGGER "trigger_process_fee_payment" AFTER INSERT ON "public"."fee_payments" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_process_fee_payment"();



CREATE OR REPLACE TRIGGER "trigger_sync_attendance_on_leave_date_correction" AFTER UPDATE OF "end_date" ON "public"."student_leaves" FOR EACH ROW EXECUTE FUNCTION "public"."sync_attendance_on_leave_date_correction"();



CREATE OR REPLACE TRIGGER "trigger_update_leave_balance" AFTER UPDATE ON "public"."leaves" FOR EACH ROW EXECUTE FUNCTION "public"."update_leave_balance_on_approval"();



CREATE OR REPLACE TRIGGER "trigger_update_payment_allocations" AFTER UPDATE ON "public"."fee_payments" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_update_payment_allocations"();



CREATE OR REPLACE TRIGGER "trigger_update_staff_on_promotion" AFTER INSERT ON "public"."salary_promotions" FOR EACH ROW EXECUTE FUNCTION "public"."update_staff_on_promotion"();



CREATE OR REPLACE TRIGGER "trigger_update_staff_status_on_leave" AFTER UPDATE OF "status" ON "public"."leaves" FOR EACH ROW EXECUTE FUNCTION "public"."update_staff_status_on_leave"();



CREATE OR REPLACE TRIGGER "trigger_update_staff_status_on_leave_insert" AFTER INSERT ON "public"."leaves" FOR EACH ROW EXECUTE FUNCTION "public"."update_staff_status_on_leave"();



CREATE OR REPLACE TRIGGER "update_certificate_templates_updated_at" BEFORE UPDATE ON "public"."certificate_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_certificate_templates_updated_at"();



CREATE OR REPLACE TRIGGER "update_fee_student_assignments_updated_at" BEFORE UPDATE ON "public"."fee_student_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_fee_assignment_updated_at"();



CREATE OR REPLACE TRIGGER "update_leaves_updated_at" BEFORE UPDATE ON "public"."leaves" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pending_admissions_updated_at" BEFORE UPDATE ON "public"."pending_admissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "validate_mark_status" BEFORE UPDATE ON "public"."student_marks_new" FOR EACH ROW EXECUTE FUNCTION "public"."validate_mark_status_transition"();



ALTER TABLE ONLY "public"."account_credentials"
    ADD CONSTRAINT "account_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."advance_installments"
    ADD CONSTRAINT "advance_installments_advance_id_fkey" FOREIGN KEY ("advance_id") REFERENCES "public"."salary_advances"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."advance_payments"
    ADD CONSTRAINT "advance_payments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."chart_of_accounts"
    ADD CONSTRAINT "chart_of_accounts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."compiled_results"
    ADD CONSTRAINT "compiled_results_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id");



ALTER TABLE ONLY "public"."compiled_results"
    ADD CONSTRAINT "compiled_results_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."compiled_results"
    ADD CONSTRAINT "compiled_results_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "public"."exam_terms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exam_settings_new"
    ADD CONSTRAINT "exam_settings_new_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id");



ALTER TABLE ONLY "public"."exam_settings_new"
    ADD CONSTRAINT "exam_settings_new_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."exam_subjects"
    ADD CONSTRAINT "exam_subjects_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exam_subjects"
    ADD CONSTRAINT "exam_subjects_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id");



ALTER TABLE ONLY "public"."exam_subjects"
    ADD CONSTRAINT "exam_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id");



ALTER TABLE ONLY "public"."exam_subjects"
    ADD CONSTRAINT "exam_subjects_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "public"."exam_terms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exam_terms"
    ADD CONSTRAINT "exam_terms_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expense_heads"
    ADD CONSTRAINT "expense_heads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fee_assignment_history"
    ADD CONSTRAINT "fee_assignment_history_assignment_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."fee_student_assignments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fee_assignment_history"
    ADD CONSTRAINT "fee_assignment_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fee_assignment_history"
    ADD CONSTRAINT "fee_assignment_history_student_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fee_categories"
    ADD CONSTRAINT "fee_categories_fine_rule_id_fkey" FOREIGN KEY ("fine_rule_id") REFERENCES "public"."fine_rules"("id");



ALTER TABLE ONLY "public"."fee_discounts"
    ADD CONSTRAINT "fee_discounts_scope_class_id_fkey" FOREIGN KEY ("scope_class_id") REFERENCES "public"."classes"("id");



ALTER TABLE ONLY "public"."fee_discounts"
    ADD CONSTRAINT "fee_discounts_scope_section_id_fkey" FOREIGN KEY ("scope_section_id") REFERENCES "public"."sections"("id");



ALTER TABLE ONLY "public"."fee_invoice_items"
    ADD CONSTRAINT "fee_invoice_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."fee_categories"("id");



ALTER TABLE ONLY "public"."fee_invoice_items"
    ADD CONSTRAINT "fee_invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."fee_invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fee_invoices"
    ADD CONSTRAINT "fee_invoices_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fee_payments"
    ADD CONSTRAINT "fee_payments_fee_transaction_id_fkey" FOREIGN KEY ("fee_transaction_id") REFERENCES "public"."fee_transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fee_payments"
    ADD CONSTRAINT "fee_payments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fee_structure_items"
    ADD CONSTRAINT "fee_structure_items_fee_structure_id_fkey" FOREIGN KEY ("fee_structure_id") REFERENCES "public"."fee_structures"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fee_structure_versions"
    ADD CONSTRAINT "fee_structure_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."fee_structures"
    ADD CONSTRAINT "fee_structures_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fee_structures"
    ADD CONSTRAINT "fee_structures_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fee_student_assignments"
    ADD CONSTRAINT "fee_student_assignments_academic_year_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fee_student_assignments"
    ADD CONSTRAINT "fee_student_assignments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fee_student_assignments"
    ADD CONSTRAINT "fee_student_assignments_structure_fkey" FOREIGN KEY ("fee_structure_id") REFERENCES "public"."fee_structures"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fee_student_assignments"
    ADD CONSTRAINT "fee_student_assignments_student_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fee_transactions"
    ADD CONSTRAINT "fee_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."fee_categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."fee_transactions"
    ADD CONSTRAINT "fee_transactions_discount_id_fkey" FOREIGN KEY ("discount_id") REFERENCES "public"."fee_discounts"("id");



ALTER TABLE ONLY "public"."fee_transactions"
    ADD CONSTRAINT "fee_transactions_fee_structure_id_fkey" FOREIGN KEY ("fee_structure_id") REFERENCES "public"."fee_structures"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fee_transactions"
    ADD CONSTRAINT "fee_transactions_fine_rule_id_fkey" FOREIGN KEY ("fine_rule_id") REFERENCES "public"."fine_rules"("id");



ALTER TABLE ONLY "public"."fee_transactions"
    ADD CONSTRAINT "fee_transactions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."finance_transactions"
    ADD CONSTRAINT "finance_transactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chart_of_accounts"
    ADD CONSTRAINT "fk_chart_of_accounts_parent" FOREIGN KEY ("parent_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fee_payments"
    ADD CONSTRAINT "fk_fee_payments_student" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "fk_journal_entries_voucher" FOREIGN KEY ("voucher_id") REFERENCES "public"."vouchers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."grading_rules"
    ADD CONSTRAINT "grading_rules_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id");



ALTER TABLE ONLY "public"."income_heads"
    ADD CONSTRAINT "income_heads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_issuance_items"
    ADD CONSTRAINT "inventory_issuance_items_issuance_id_fkey" FOREIGN KEY ("issuance_id") REFERENCES "public"."inventory_issuances"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_issuance_items"
    ADD CONSTRAINT "inventory_issuance_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id");



ALTER TABLE ONLY "public"."inventory_issuances"
    ADD CONSTRAINT "inventory_issuances_issued_to_staff_id_fkey" FOREIGN KEY ("issued_to_staff_id") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."inventory_categories"("id");



ALTER TABLE ONLY "public"."inventory_purchase_items"
    ADD CONSTRAINT "inventory_purchase_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id");



ALTER TABLE ONLY "public"."inventory_purchase_items"
    ADD CONSTRAINT "inventory_purchase_items_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "public"."inventory_purchases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_purchases"
    ADD CONSTRAINT "inventory_purchases_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."inventory_suppliers"("id");



ALTER TABLE ONLY "public"."inventory_purchases"
    ADD CONSTRAINT "inventory_purchases_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "public"."vouchers"("id");



ALTER TABLE ONLY "public"."inventory_sale_items"
    ADD CONSTRAINT "inventory_sale_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id");



ALTER TABLE ONLY "public"."inventory_sale_items"
    ADD CONSTRAINT "inventory_sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."inventory_sales"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_sales"
    ADD CONSTRAINT "inventory_sales_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id");



ALTER TABLE ONLY "public"."inventory_sales"
    ADD CONSTRAINT "inventory_sales_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "public"."vouchers"("id");



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "public"."vouchers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leave_balances"
    ADD CONSTRAINT "leave_balances_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leaves"
    ADD CONSTRAINT "leaves_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leaves"
    ADD CONSTRAINT "leaves_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_history"
    ADD CONSTRAINT "notification_history_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_allocations"
    ADD CONSTRAINT "payment_allocations_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."fee_categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payment_allocations"
    ADD CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."fee_payments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_refunds"
    ADD CONSTRAINT "payment_refunds_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."payment_refunds"
    ADD CONSTRAINT "payment_refunds_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."fee_invoices"("id");



ALTER TABLE ONLY "public"."payment_refunds"
    ADD CONSTRAINT "payment_refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."fee_payments"("id");



ALTER TABLE ONLY "public"."pending_admissions"
    ADD CONSTRAINT "pending_admissions_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pending_admissions"
    ADD CONSTRAINT "pending_admissions_approved_student_id_fkey" FOREIGN KEY ("approved_student_id") REFERENCES "public"."students"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pending_admissions"
    ADD CONSTRAINT "pending_admissions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pending_admissions"
    ADD CONSTRAINT "pending_admissions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pending_admissions"
    ADD CONSTRAINT "pending_admissions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id");



ALTER TABLE ONLY "public"."result_publish_log"
    ADD CONSTRAINT "result_publish_log_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id");



ALTER TABLE ONLY "public"."result_publish_log"
    ADD CONSTRAINT "result_publish_log_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."result_publish_log"
    ADD CONSTRAINT "result_publish_log_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id");



ALTER TABLE ONLY "public"."result_publish_log"
    ADD CONSTRAINT "result_publish_log_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "public"."exam_terms"("id");



ALTER TABLE ONLY "public"."salary_advances"
    ADD CONSTRAINT "salary_advances_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."salary_balances"
    ADD CONSTRAINT "salary_balances_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."salary_categories"
    ADD CONSTRAINT "salary_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."salary_increments"
    ADD CONSTRAINT "salary_increments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "public"."salary_increments"
    ADD CONSTRAINT "salary_increments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."salary_notifications"
    ADD CONSTRAINT "salary_notifications_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."salary_payments"
    ADD CONSTRAINT "salary_payments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."salary_promotions"
    ADD CONSTRAINT "salary_promotions_new_salary_category_id_fkey" FOREIGN KEY ("new_salary_category_id") REFERENCES "public"."salary_categories"("id");



ALTER TABLE ONLY "public"."salary_promotions"
    ADD CONSTRAINT "salary_promotions_old_salary_category_id_fkey" FOREIGN KEY ("old_salary_category_id") REFERENCES "public"."salary_categories"("id");



ALTER TABLE ONLY "public"."salary_promotions"
    ADD CONSTRAINT "salary_promotions_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."salary_version_history"
    ADD CONSTRAINT "salary_version_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."salary_version_history"
    ADD CONSTRAINT "salary_version_history_salary_id_fkey" FOREIGN KEY ("salary_id") REFERENCES "public"."staff_salaries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."salary_version_history"
    ADD CONSTRAINT "salary_version_history_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scholarship_applications"
    ADD CONSTRAINT "scholarship_applications_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id");



ALTER TABLE ONLY "public"."scholarship_applications"
    ADD CONSTRAINT "scholarship_applications_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."scholarship_applications"
    ADD CONSTRAINT "scholarship_applications_discount_id_fkey" FOREIGN KEY ("discount_id") REFERENCES "public"."fee_discounts"("id");



ALTER TABLE ONLY "public"."scholarship_applications"
    ADD CONSTRAINT "scholarship_applications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id");



ALTER TABLE ONLY "public"."sections"
    ADD CONSTRAINT "sections_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sections"
    ADD CONSTRAINT "sections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."staff_attendance"
    ADD CONSTRAINT "staff_attendance_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_salaries"
    ADD CONSTRAINT "staff_salaries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."staff_salaries"
    ADD CONSTRAINT "staff_salaries_salary_category_id_fkey" FOREIGN KEY ("salary_category_id") REFERENCES "public"."salary_categories"("id");



ALTER TABLE ONLY "public"."staff_salaries"
    ADD CONSTRAINT "staff_salaries_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."student_attendance"
    ADD CONSTRAINT "student_attendance_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_fee_advance"
    ADD CONSTRAINT "student_fee_advance_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."fee_categories"("id");



ALTER TABLE ONLY "public"."student_fee_advance"
    ADD CONSTRAINT "student_fee_advance_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."fee_payments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."student_fee_advance"
    ADD CONSTRAINT "student_fee_advance_source_academic_year_id_fkey" FOREIGN KEY ("source_academic_year_id") REFERENCES "public"."academic_years"("id");



ALTER TABLE ONLY "public"."student_fee_advance"
    ADD CONSTRAINT "student_fee_advance_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_fee_dues"
    ADD CONSTRAINT "student_fee_dues_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id");



ALTER TABLE ONLY "public"."student_fee_dues"
    ADD CONSTRAINT "student_fee_dues_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."fee_categories"("id");



ALTER TABLE ONLY "public"."student_fee_dues"
    ADD CONSTRAINT "student_fee_dues_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_leave_attachments"
    ADD CONSTRAINT "student_leave_attachments_leave_id_fkey" FOREIGN KEY ("leave_id") REFERENCES "public"."student_leaves"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_leaves"
    ADD CONSTRAINT "student_leaves_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_marks_new"
    ADD CONSTRAINT "student_marks_new_entered_by_fkey" FOREIGN KEY ("entered_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."student_marks_new"
    ADD CONSTRAINT "student_marks_new_exam_subject_id_fkey" FOREIGN KEY ("exam_subject_id") REFERENCES "public"."exam_subjects"("id");



ALTER TABLE ONLY "public"."student_marks_new"
    ADD CONSTRAINT "student_marks_new_locked_by_fkey" FOREIGN KEY ("locked_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."student_marks_new"
    ADD CONSTRAINT "student_marks_new_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_marks_new"
    ADD CONSTRAINT "student_marks_new_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "public"."exam_terms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_siblings"
    ADD CONSTRAINT "student_siblings_sibling_group_id_fkey" FOREIGN KEY ("sibling_group_id") REFERENCES "public"."sibling_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_siblings"
    ADD CONSTRAINT "student_siblings_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_current_fee_structure_id_fkey" FOREIGN KEY ("current_fee_structure_id") REFERENCES "public"."fee_structures"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."subjects"
    ADD CONSTRAINT "subjects_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id");



ALTER TABLE ONLY "public"."subjects"
    ADD CONSTRAINT "subjects_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vouchers"
    ADD CONSTRAINT "vouchers_financial_account_id_fkey" FOREIGN KEY ("financial_account_id") REFERENCES "public"."financial_accounts"("id");



ALTER TABLE "public"."academic_years" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "academic_years_admin_write" ON "public"."academic_years" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "academic_years_read_public" ON "public"."academic_years" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."account_credentials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."address_districts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "address_districts_admin_write" ON "public"."address_districts" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "address_districts_read_auth" ON "public"."address_districts" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."address_police_stations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "address_police_stations_admin_write" ON "public"."address_police_stations" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "address_police_stations_read_auth" ON "public"."address_police_stations" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."address_post_offices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "address_post_offices_admin_write" ON "public"."address_post_offices" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "address_post_offices_read_auth" ON "public"."address_post_offices" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."address_villages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "address_villages_admin_write" ON "public"."address_villages" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "address_villages_read_auth" ON "public"."address_villages" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "admin_credentials_access" ON "public"."account_credentials" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."advance_installments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "advance_installments_admin_all" ON "public"."advance_installments" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."advance_payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "advance_payments_admin_accountant_all" ON "public"."advance_payments" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"]));



ALTER TABLE "public"."attendance_holidays" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "attendance_holidays_admin_write" ON "public"."attendance_holidays" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "attendance_holidays_read_auth" ON "public"."attendance_holidays" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."attendance_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "attendance_settings_admin_write" ON "public"."attendance_settings" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "attendance_settings_read_all_auth" ON "public"."attendance_settings" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_admin_read" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



ALTER TABLE "public"."certificate_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "certificate_templates_admin_write" ON "public"."certificate_templates" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "certificate_templates_read_auth" ON "public"."certificate_templates" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."chart_of_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chart_of_accounts_admin_accountant_all" ON "public"."chart_of_accounts" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"]));



ALTER TABLE "public"."classes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "classes_admin_write" ON "public"."classes" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "classes_read_public" ON "public"."classes" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."compiled_results" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "compiled_results_admin_teacher_all" ON "public"."compiled_results" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'teacher'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'teacher'::"text"]));



CREATE POLICY "compiled_results_student_own" ON "public"."compiled_results" FOR SELECT TO "authenticated" USING (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."exam_settings_new" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "exam_settings_new_admin_write" ON "public"."exam_settings_new" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "exam_settings_new_read_auth" ON "public"."exam_settings_new" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."exam_subjects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "exam_subjects_admin_write" ON "public"."exam_subjects" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "exam_subjects_read_auth" ON "public"."exam_subjects" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."exam_terms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "exam_terms_admin_write" ON "public"."exam_terms" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "exam_terms_read_auth" ON "public"."exam_terms" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."expense_heads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expense_heads_admin_accountant_all" ON "public"."expense_heads" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"]));



ALTER TABLE "public"."fee_assignment_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fee_assignment_history_admin_all" ON "public"."fee_assignment_history" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."fee_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fee_categories_admin_write" ON "public"."fee_categories" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "fee_categories_read_auth" ON "public"."fee_categories" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."fee_discounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fee_discounts_admin_all" ON "public"."fee_discounts" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "fee_discounts_authenticated_read" ON "public"."fee_discounts" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."fee_invoice_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fee_invoice_items_admin_accountant_all" ON "public"."fee_invoice_items" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"]));



ALTER TABLE "public"."fee_invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fee_invoices_admin_accountant_all" ON "public"."fee_invoices" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"]));



ALTER TABLE "public"."fee_payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fee_payments_admin_accountant_all" ON "public"."fee_payments" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"]));



CREATE POLICY "fee_payments_student_own" ON "public"."fee_payments" FOR SELECT TO "authenticated" USING (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."fee_structure_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fee_structure_items_admin_write" ON "public"."fee_structure_items" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "fee_structure_items_read_auth" ON "public"."fee_structure_items" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."fee_structure_versions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fee_structure_versions_admin_write" ON "public"."fee_structure_versions" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "fee_structure_versions_read_auth" ON "public"."fee_structure_versions" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."fee_structures" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fee_structures_admin_write" ON "public"."fee_structures" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "fee_structures_read_auth" ON "public"."fee_structures" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."fee_student_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fee_student_assignments_accountant_read" ON "public"."fee_student_assignments" FOR SELECT TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"]));



CREATE POLICY "fee_student_assignments_admin_all" ON "public"."fee_student_assignments" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."fee_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fee_transactions_admin_accountant_all" ON "public"."fee_transactions" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"]));



ALTER TABLE "public"."finance_heads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "finance_heads_admin_accountant_all" ON "public"."finance_heads" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"]));



ALTER TABLE "public"."finance_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "finance_transactions_admin_accountant_all" ON "public"."finance_transactions" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"]));



ALTER TABLE "public"."financial_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "financial_accounts_admin_accountant_all" ON "public"."financial_accounts" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"]));



ALTER TABLE "public"."fine_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fine_rules_admin_all" ON "public"."fine_rules" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "fine_rules_authenticated_read" ON "public"."fine_rules" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."grading_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "grading_rules_admin_write" ON "public"."grading_rules" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "grading_rules_read_auth" ON "public"."grading_rules" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."grading_system" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "grading_system_admin_write" ON "public"."grading_system" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "grading_system_read_auth" ON "public"."grading_system" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."income_heads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "income_heads_admin_accountant_all" ON "public"."income_heads" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"]));



ALTER TABLE "public"."inventory_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_categories_admin_store_all" ON "public"."inventory_categories" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'store'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'store'::"text"]));



ALTER TABLE "public"."inventory_issuance_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_issuance_items_admin_store_all" ON "public"."inventory_issuance_items" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'store'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'store'::"text"]));



ALTER TABLE "public"."inventory_issuances" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_issuances_admin_store_all" ON "public"."inventory_issuances" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'store'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'store'::"text"]));



ALTER TABLE "public"."inventory_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_items_admin_store_all" ON "public"."inventory_items" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'store'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'store'::"text"]));



ALTER TABLE "public"."inventory_purchase_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_purchase_items_admin_store_all" ON "public"."inventory_purchase_items" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'store'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'store'::"text"]));



ALTER TABLE "public"."inventory_purchases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_purchases_admin_store_all" ON "public"."inventory_purchases" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'store'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'store'::"text"]));



ALTER TABLE "public"."inventory_sale_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_sale_items_admin_store_all" ON "public"."inventory_sale_items" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'store'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'store'::"text"]));



ALTER TABLE "public"."inventory_sales" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_sales_admin_store_all" ON "public"."inventory_sales" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'store'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'store'::"text"]));



ALTER TABLE "public"."inventory_suppliers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_suppliers_admin_store_all" ON "public"."inventory_suppliers" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'store'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'store'::"text"]));



ALTER TABLE "public"."inventory_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_transactions_admin_store_all" ON "public"."inventory_transactions" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'store'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'store'::"text"]));



ALTER TABLE "public"."journal_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "journal_entries_admin_accountant_all" ON "public"."journal_entries" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"]));



ALTER TABLE "public"."leave_balances" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leave_balances_admin_all" ON "public"."leave_balances" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "leave_balances_self_read" ON "public"."leave_balances" FOR SELECT TO "authenticated" USING (("staff_id" IN ( SELECT "staff"."id"
   FROM "public"."staff"
  WHERE ("staff"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."leave_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leave_categories_admin_write" ON "public"."leave_categories" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "leave_categories_read_all_auth" ON "public"."leave_categories" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."leaves" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leaves_admin_all" ON "public"."leaves" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "leaves_self_read" ON "public"."leaves" FOR SELECT TO "authenticated" USING ((("staff_id" IN ( SELECT "staff"."id"
   FROM "public"."staff"
  WHERE ("staff"."user_id" = "auth"."uid"()))) OR ("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."migration_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "migration_log_admin_read" ON "public"."migration_log" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



ALTER TABLE "public"."notices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notices_admin_write" ON "public"."notices" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "notices_read_auth" ON "public"."notices" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."notification_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notification_history_admin_all" ON "public"."notification_history" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."notification_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notification_settings_admin_only" ON "public"."notification_settings" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_admin_all" ON "public"."notifications" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "notifications_self_read" ON "public"."notifications" FOR SELECT TO "authenticated" USING ((("recipient_id" = "auth"."uid"()) OR "public"."is_admin"()));



ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organizations_admin_write" ON "public"."organizations" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "organizations_read_auth" ON "public"."organizations" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."payment_allocations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_allocations_admin_accountant_all" ON "public"."payment_allocations" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"]));



ALTER TABLE "public"."payment_refunds" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_refunds_admin_accountant_all" ON "public"."payment_refunds" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"]));



ALTER TABLE "public"."pending_admissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pending_admissions_delete_admin_only" ON "public"."pending_admissions" FOR DELETE TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text"]));



CREATE POLICY "pending_admissions_insert_public" ON "public"."pending_admissions" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "pending_admissions_select_admin_teacher" ON "public"."pending_admissions" FOR SELECT TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'teacher'::"text"]));



CREATE POLICY "pending_admissions_update_admin_teacher" ON "public"."pending_admissions" FOR UPDATE TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'teacher'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'teacher'::"text"]));



CREATE POLICY "pending_auth_admin_all" ON "public"."pending_auth_creation" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."pending_auth_creation" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "products_admin_store_all" ON "public"."products" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'store'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'store'::"text"]));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_admin_all" ON "public"."profiles" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."questions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "questions_admin_teacher_all" ON "public"."questions" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'teacher'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'teacher'::"text"]));



ALTER TABLE "public"."result_publish_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "result_publish_log_admin_all" ON "public"."result_publish_log" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."role_menu_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "role_menu_perms_delete" ON "public"."role_menu_permissions" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "role_menu_perms_insert" ON "public"."role_menu_permissions" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "role_menu_perms_read" ON "public"."role_menu_permissions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "role_menu_perms_update" ON "public"."role_menu_permissions" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "roles_admin_write" ON "public"."roles" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "roles_read_auth" ON "public"."roles" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."salary_advances" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "salary_advances_admin_all" ON "public"."salary_advances" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."salary_balances" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "salary_balances_admin_all" ON "public"."salary_balances" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."salary_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "salary_categories_accountant_read" ON "public"."salary_categories" FOR SELECT TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"]));



CREATE POLICY "salary_categories_admin_all" ON "public"."salary_categories" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."salary_increments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "salary_increments_admin_all" ON "public"."salary_increments" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."salary_notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "salary_notifications_admin_all" ON "public"."salary_notifications" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "salary_notifications_select" ON "public"."salary_notifications" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR ("staff_id" IN ( SELECT "staff"."id"
   FROM "public"."staff"
  WHERE ("staff"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."salary_payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "salary_payments_accountant_read" ON "public"."salary_payments" FOR SELECT TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"]));



CREATE POLICY "salary_payments_admin_all" ON "public"."salary_payments" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."salary_promotions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "salary_promotions_admin_all" ON "public"."salary_promotions" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."salary_version_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "salary_version_history_admin_all" ON "public"."salary_version_history" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."scholarship_applications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "scholarship_applications_admin_accountant_all" ON "public"."scholarship_applications" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"]));



ALTER TABLE "public"."school_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "school_settings_admin_write" ON "public"."school_settings" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "school_settings_anon_read" ON "public"."school_settings" FOR SELECT TO "anon" USING (true);



CREATE POLICY "school_settings_public_read" ON "public"."school_settings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "school_settings_read_auth" ON "public"."school_settings" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."sections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sections_admin_write" ON "public"."sections" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "sections_read_public" ON "public"."sections" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."sibling_groups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sibling_groups_admin_teacher_all" ON "public"."sibling_groups" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'teacher'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'teacher'::"text"]));



ALTER TABLE "public"."staff" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_attendance" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staff_attendance_admin_all" ON "public"."staff_attendance" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "staff_attendance_self_read" ON "public"."staff_attendance" FOR SELECT TO "authenticated" USING (("staff_id" IN ( SELECT "staff"."id"
   FROM "public"."staff"
  WHERE ("staff"."user_id" = "auth"."uid"()))));



CREATE POLICY "staff_delete_admin" ON "public"."staff" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "staff_insert_admin" ON "public"."staff" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."staff_salaries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staff_salaries_accountant_read" ON "public"."staff_salaries" FOR SELECT TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"]));



CREATE POLICY "staff_salaries_admin_only" ON "public"."staff_salaries" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "staff_select_by_role" ON "public"."staff" FOR SELECT TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'teacher'::"text", 'accountant'::"text"]));



CREATE POLICY "staff_update_admin" ON "public"."staff" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."student_attendance" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_attendance_admin_teacher_all" ON "public"."student_attendance" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'teacher'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'teacher'::"text"]));



CREATE POLICY "student_attendance_student_own" ON "public"."student_attendance" FOR SELECT TO "authenticated" USING (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."student_fee_advance" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_fee_advance_admin_accountant_all" ON "public"."student_fee_advance" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"]));



ALTER TABLE "public"."student_fee_dues" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_fee_dues_admin_accountant_all" ON "public"."student_fee_dues" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"]));



CREATE POLICY "student_fee_dues_student_own" ON "public"."student_fee_dues" FOR SELECT TO "authenticated" USING (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."student_leave_attachments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_leave_attachments_admin_teacher_all" ON "public"."student_leave_attachments" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'teacher'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'teacher'::"text"]));



ALTER TABLE "public"."student_leaves" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_leaves_admin_teacher_all" ON "public"."student_leaves" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'teacher'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'teacher'::"text"]));



CREATE POLICY "student_leaves_staff_read" ON "public"."student_leaves" FOR SELECT TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'teacher'::"text", 'staff'::"text"]));



CREATE POLICY "student_marks_admin_teacher_all" ON "public"."student_marks_new" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'teacher'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'teacher'::"text"]));



ALTER TABLE "public"."student_marks_new" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_marks_student_own" ON "public"."student_marks_new" FOR SELECT TO "authenticated" USING (("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."student_siblings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "student_siblings_admin_teacher_all" ON "public"."student_siblings" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'teacher'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'teacher'::"text"]));



ALTER TABLE "public"."students" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "students_delete_by_admin" ON "public"."students" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "students_insert_by_admin" ON "public"."students" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "students_select_by_role" ON "public"."students" FOR SELECT TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'teacher'::"text", 'accountant'::"text", 'staff'::"text"]));



CREATE POLICY "students_update_by_admin" ON "public"."students" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "students_view_own" ON "public"."students" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."subjects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subjects_admin_write" ON "public"."subjects" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "subjects_read_auth" ON "public"."subjects" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."teacher_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "teacher_profiles_admin_all" ON "public"."teacher_profiles" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "teacher_profiles_self_read" ON "public"."teacher_profiles" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."vouchers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vouchers_admin_accountant_all" ON "public"."vouchers" TO "authenticated" USING ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"])) WITH CHECK ("public"."has_role"(ARRAY['admin'::"text", 'accountant'::"text"]));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."fee_payments";






REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT ALL ON SCHEMA "public" TO PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."create_balance_sheet_account"("p_account_name" character varying, "p_account_category" character varying, "p_opening_balance" numeric, "p_account_number" character varying, "p_bank_name" character varying, "p_branch_name" character varying, "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_balance_sheet_account"("p_account_name" character varying, "p_account_category" character varying, "p_opening_balance" numeric, "p_account_number" character varying, "p_bank_name" character varying, "p_branch_name" character varying, "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_balance_sheet_account"("p_account_name" character varying, "p_account_category" character varying, "p_opening_balance" numeric, "p_account_number" character varying, "p_bank_name" character varying, "p_branch_name" character varying, "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_inventory_issuance"("p_issued_to_type" "text", "p_issued_to_id" "uuid", "p_issued_to_name" "text", "p_items" "jsonb", "p_purpose" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_inventory_issuance"("p_issued_to_type" "text", "p_issued_to_id" "uuid", "p_issued_to_name" "text", "p_items" "jsonb", "p_purpose" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."create_inventory_purchase"("p_supplier_id" "uuid", "p_purchase_date" "date", "p_narration" "text", "p_items" "jsonb", "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_inventory_purchase"("p_supplier_id" "uuid", "p_purchase_date" "date", "p_narration" "text", "p_items" "jsonb", "p_status" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."create_inventory_sale"("p_student_id" "uuid", "p_sale_date" "date", "p_narration" "text", "p_items" "jsonb", "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_inventory_sale"("p_student_id" "uuid", "p_sale_date" "date", "p_narration" "text", "p_items" "jsonb", "p_status" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."delete_sale_and_restore_stock"("p_sale_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_sale_and_restore_stock"("p_sale_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_sale_and_restore_stock"("p_sale_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_dues_from_structure"("p_student_id" "uuid", "p_academic_year_id" "uuid", "p_up_to_month" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_dues_from_structure"("p_student_id" "uuid", "p_academic_year_id" "uuid", "p_up_to_month" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_dues_from_structure"("p_student_id" "uuid", "p_academic_year_id" "uuid", "p_up_to_month" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_receipt_number"("p_prefix" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."generate_receipt_number"("p_prefix" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_receipt_number"("p_prefix" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_student_id"("p_class_name" character varying, "p_academic_year" integer) TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_current_academic_year"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_current_uid"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_gpa_from_percentage"("p_percentage" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_gpa_from_percentage"("p_percentage" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."get_gpa_from_percentage"("p_percentage" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_grade_from_gpa"("p_gpa" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_grade_from_gpa"("p_gpa" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."get_grade_from_gpa"("p_gpa" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_grade_from_percentage"("p_percentage" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_grade_from_percentage"("p_percentage" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."get_grade_from_percentage"("p_percentage" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_student_fee_summary"("p_student_id" "uuid", "p_academic_year_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_student_fee_summary"("p_student_id" "uuid", "p_academic_year_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_student_fee_summary"("p_student_id" "uuid", "p_academic_year_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("roles" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("roles" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("roles" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";



GRANT ALL ON FUNCTION "public"."resync_all_finance_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."resync_all_finance_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."return_issuance_and_restore_stock"("p_issuance_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."return_issuance_and_restore_stock"("p_issuance_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."return_issuance_and_restore_stock"("p_issuance_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_voucher_to_finance"("p_voucher_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_voucher_to_finance"("p_voucher_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_voucher_to_finance"("p_voucher_id" "uuid") TO "service_role";
























GRANT ALL ON TABLE "public"."academic_years" TO "anon";
GRANT ALL ON TABLE "public"."academic_years" TO "authenticated";
GRANT ALL ON TABLE "public"."academic_years" TO "service_role";
GRANT ALL ON TABLE "public"."academic_years" TO PUBLIC;



GRANT ALL ON TABLE "public"."account_credentials" TO "authenticated";
GRANT ALL ON TABLE "public"."account_credentials" TO "service_role";



GRANT ALL ON TABLE "public"."staff" TO "anon";
GRANT ALL ON TABLE "public"."staff" TO "authenticated";
GRANT ALL ON TABLE "public"."staff" TO "service_role";
GRANT ALL ON TABLE "public"."staff" TO PUBLIC;



GRANT ALL ON TABLE "public"."active_staff" TO "anon";
GRANT ALL ON TABLE "public"."active_staff" TO "authenticated";
GRANT ALL ON TABLE "public"."active_staff" TO "service_role";



GRANT ALL ON TABLE "public"."address_districts" TO "anon";
GRANT ALL ON TABLE "public"."address_districts" TO "authenticated";
GRANT ALL ON TABLE "public"."address_districts" TO "service_role";
GRANT ALL ON TABLE "public"."address_districts" TO PUBLIC;



GRANT ALL ON TABLE "public"."address_police_stations" TO "anon";
GRANT ALL ON TABLE "public"."address_police_stations" TO "authenticated";
GRANT ALL ON TABLE "public"."address_police_stations" TO "service_role";
GRANT ALL ON TABLE "public"."address_police_stations" TO PUBLIC;



GRANT ALL ON TABLE "public"."address_post_offices" TO "anon";
GRANT ALL ON TABLE "public"."address_post_offices" TO "authenticated";
GRANT ALL ON TABLE "public"."address_post_offices" TO "service_role";
GRANT ALL ON TABLE "public"."address_post_offices" TO PUBLIC;



GRANT ALL ON TABLE "public"."address_villages" TO "anon";
GRANT ALL ON TABLE "public"."address_villages" TO "authenticated";
GRANT ALL ON TABLE "public"."address_villages" TO "service_role";
GRANT ALL ON TABLE "public"."address_villages" TO PUBLIC;



GRANT ALL ON TABLE "public"."advance_installments" TO "anon";
GRANT ALL ON TABLE "public"."advance_installments" TO "authenticated";
GRANT ALL ON TABLE "public"."advance_installments" TO "service_role";
GRANT ALL ON TABLE "public"."advance_installments" TO PUBLIC;



GRANT ALL ON TABLE "public"."advance_payments" TO "anon";
GRANT ALL ON TABLE "public"."advance_payments" TO "authenticated";



GRANT ALL ON TABLE "public"."attendance_holidays" TO "anon";
GRANT ALL ON TABLE "public"."attendance_holidays" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance_holidays" TO "service_role";



GRANT ALL ON TABLE "public"."attendance_settings" TO "anon";
GRANT ALL ON TABLE "public"."attendance_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance_settings" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";
GRANT ALL ON TABLE "public"."audit_logs" TO PUBLIC;



GRANT ALL ON TABLE "public"."certificate_templates" TO "anon";
GRANT ALL ON TABLE "public"."certificate_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."certificate_templates" TO "service_role";



GRANT ALL ON TABLE "public"."chart_of_accounts" TO "anon";
GRANT ALL ON TABLE "public"."chart_of_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."chart_of_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."classes" TO "anon";
GRANT ALL ON TABLE "public"."classes" TO "authenticated";
GRANT ALL ON TABLE "public"."classes" TO "service_role";
GRANT ALL ON TABLE "public"."classes" TO PUBLIC;



GRANT ALL ON TABLE "public"."compiled_results" TO "anon";
GRANT ALL ON TABLE "public"."compiled_results" TO "authenticated";
GRANT ALL ON TABLE "public"."compiled_results" TO "service_role";



GRANT ALL ON TABLE "public"."fee_categories" TO PUBLIC;
GRANT ALL ON TABLE "public"."fee_categories" TO "anon";
GRANT ALL ON TABLE "public"."fee_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."fee_categories" TO "service_role";



GRANT ALL ON TABLE "public"."fee_structure_items" TO "anon";
GRANT ALL ON TABLE "public"."fee_structure_items" TO "authenticated";
GRANT ALL ON TABLE "public"."fee_structure_items" TO "service_role";
GRANT ALL ON TABLE "public"."fee_structure_items" TO PUBLIC;



GRANT ALL ON TABLE "public"."fee_structures" TO "anon";
GRANT ALL ON TABLE "public"."fee_structures" TO "authenticated";
GRANT ALL ON TABLE "public"."fee_structures" TO "service_role";



GRANT ALL ON TABLE "public"."fee_student_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."fee_student_assignments" TO "anon";
GRANT ALL ON TABLE "public"."fee_student_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."sections" TO "anon";
GRANT ALL ON TABLE "public"."sections" TO "authenticated";
GRANT ALL ON TABLE "public"."sections" TO "service_role";
GRANT ALL ON TABLE "public"."sections" TO PUBLIC;



GRANT ALL ON TABLE "public"."students" TO "anon";
GRANT ALL ON TABLE "public"."students" TO "authenticated";
GRANT ALL ON TABLE "public"."students" TO "service_role";
GRANT ALL ON TABLE "public"."students" TO PUBLIC;



GRANT ALL ON TABLE "public"."current_fee_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."current_fee_assignments" TO "anon";
GRANT ALL ON TABLE "public"."current_fee_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."salary_categories" TO "anon";
GRANT ALL ON TABLE "public"."salary_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."salary_categories" TO "service_role";
GRANT ALL ON TABLE "public"."salary_categories" TO PUBLIC;



GRANT ALL ON TABLE "public"."staff_salaries" TO "anon";
GRANT ALL ON TABLE "public"."staff_salaries" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_salaries" TO "service_role";
GRANT ALL ON TABLE "public"."staff_salaries" TO PUBLIC;



GRANT ALL ON TABLE "public"."current_staff_salaries" TO "authenticated";
GRANT ALL ON TABLE "public"."current_staff_salaries" TO "anon";
GRANT ALL ON TABLE "public"."current_staff_salaries" TO "service_role";



GRANT ALL ON TABLE "public"."exam_settings_new" TO "anon";
GRANT ALL ON TABLE "public"."exam_settings_new" TO "authenticated";
GRANT ALL ON TABLE "public"."exam_settings_new" TO "service_role";



GRANT ALL ON TABLE "public"."exam_subjects" TO "anon";
GRANT ALL ON TABLE "public"."exam_subjects" TO "authenticated";
GRANT ALL ON TABLE "public"."exam_subjects" TO "service_role";



GRANT ALL ON TABLE "public"."exam_terms" TO "anon";
GRANT ALL ON TABLE "public"."exam_terms" TO "authenticated";
GRANT ALL ON TABLE "public"."exam_terms" TO "service_role";



GRANT ALL ON TABLE "public"."expense_heads" TO "anon";
GRANT ALL ON TABLE "public"."expense_heads" TO "authenticated";
GRANT ALL ON TABLE "public"."expense_heads" TO "service_role";
GRANT ALL ON TABLE "public"."expense_heads" TO PUBLIC;



GRANT ALL ON TABLE "public"."fee_assignment_history" TO "authenticated";
GRANT ALL ON TABLE "public"."fee_assignment_history" TO "anon";
GRANT ALL ON TABLE "public"."fee_assignment_history" TO "service_role";



GRANT ALL ON TABLE "public"."fee_assignment_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."fee_assignment_summary" TO "anon";
GRANT ALL ON TABLE "public"."fee_assignment_summary" TO "service_role";



GRANT ALL ON TABLE "public"."fee_discounts" TO "anon";
GRANT ALL ON TABLE "public"."fee_discounts" TO "authenticated";
GRANT ALL ON TABLE "public"."fee_discounts" TO "service_role";
GRANT ALL ON TABLE "public"."fee_discounts" TO PUBLIC;



GRANT ALL ON TABLE "public"."fee_invoice_items" TO "anon";
GRANT ALL ON TABLE "public"."fee_invoice_items" TO "authenticated";



GRANT ALL ON TABLE "public"."fee_invoices" TO "anon";
GRANT ALL ON TABLE "public"."fee_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."fee_invoices" TO "service_role";
GRANT ALL ON TABLE "public"."fee_invoices" TO PUBLIC;



GRANT ALL ON TABLE "public"."fee_payments" TO "anon";
GRANT ALL ON TABLE "public"."fee_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."fee_payments" TO "service_role";



GRANT ALL ON TABLE "public"."fee_structure_versions" TO "anon";
GRANT ALL ON TABLE "public"."fee_structure_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."fee_structure_versions" TO "service_role";
GRANT ALL ON TABLE "public"."fee_structure_versions" TO PUBLIC;



GRANT ALL ON TABLE "public"."fee_transactions" TO "anon";
GRANT ALL ON TABLE "public"."fee_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."fee_transactions" TO "service_role";
GRANT ALL ON TABLE "public"."fee_transactions" TO PUBLIC;



GRANT ALL ON TABLE "public"."finance_heads" TO "anon";
GRANT ALL ON TABLE "public"."finance_heads" TO "authenticated";



GRANT ALL ON TABLE "public"."finance_transactions" TO "anon";
GRANT ALL ON TABLE "public"."finance_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_transactions" TO "service_role";
GRANT ALL ON TABLE "public"."finance_transactions" TO PUBLIC;



GRANT ALL ON TABLE "public"."financial_accounts" TO "anon";
GRANT ALL ON TABLE "public"."financial_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."fine_rules" TO "anon";
GRANT ALL ON TABLE "public"."fine_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."fine_rules" TO "service_role";
GRANT ALL ON TABLE "public"."fine_rules" TO PUBLIC;



GRANT ALL ON TABLE "public"."grading_rules" TO "anon";
GRANT ALL ON TABLE "public"."grading_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."grading_rules" TO "service_role";



GRANT ALL ON TABLE "public"."grading_system" TO "anon";
GRANT ALL ON TABLE "public"."grading_system" TO "authenticated";
GRANT ALL ON TABLE "public"."grading_system" TO "service_role";



GRANT ALL ON TABLE "public"."income_heads" TO "anon";
GRANT ALL ON TABLE "public"."income_heads" TO "authenticated";
GRANT ALL ON TABLE "public"."income_heads" TO "service_role";
GRANT ALL ON TABLE "public"."income_heads" TO PUBLIC;



GRANT ALL ON TABLE "public"."inventory_categories" TO "anon";
GRANT ALL ON TABLE "public"."inventory_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_categories" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_issuance_items" TO "anon";
GRANT ALL ON TABLE "public"."inventory_issuance_items" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_issuance_items" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_issuances" TO "anon";
GRANT ALL ON TABLE "public"."inventory_issuances" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_issuances" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_items" TO "anon";
GRANT ALL ON TABLE "public"."inventory_items" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_items" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_purchase_items" TO "anon";
GRANT ALL ON TABLE "public"."inventory_purchase_items" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_purchase_items" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_purchases" TO "anon";
GRANT ALL ON TABLE "public"."inventory_purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_purchases" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_sale_items" TO "anon";
GRANT ALL ON TABLE "public"."inventory_sale_items" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_sale_items" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_sales" TO "anon";
GRANT ALL ON TABLE "public"."inventory_sales" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_sales" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_suppliers" TO "anon";
GRANT ALL ON TABLE "public"."inventory_suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_transactions" TO "anon";
GRANT ALL ON TABLE "public"."inventory_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_transactions" TO "service_role";
GRANT ALL ON TABLE "public"."inventory_transactions" TO PUBLIC;



GRANT ALL ON TABLE "public"."journal_entries" TO "anon";
GRANT ALL ON TABLE "public"."journal_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."journal_entries" TO "service_role";



GRANT ALL ON TABLE "public"."leave_balances" TO "anon";
GRANT ALL ON TABLE "public"."leave_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."leave_balances" TO "service_role";



GRANT ALL ON TABLE "public"."leave_categories" TO "anon";
GRANT ALL ON TABLE "public"."leave_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."leave_categories" TO "service_role";
GRANT ALL ON TABLE "public"."leave_categories" TO PUBLIC;



GRANT ALL ON TABLE "public"."leaves" TO "anon";
GRANT ALL ON TABLE "public"."leaves" TO "authenticated";
GRANT ALL ON TABLE "public"."leaves" TO "service_role";
GRANT ALL ON TABLE "public"."leaves" TO PUBLIC;



GRANT ALL ON TABLE "public"."migration_log" TO "anon";
GRANT ALL ON TABLE "public"."migration_log" TO "authenticated";
GRANT ALL ON TABLE "public"."migration_log" TO "service_role";



GRANT ALL ON TABLE "public"."notices" TO "anon";
GRANT ALL ON TABLE "public"."notices" TO "authenticated";
GRANT ALL ON TABLE "public"."notices" TO "service_role";



GRANT ALL ON TABLE "public"."notification_history" TO "anon";
GRANT ALL ON TABLE "public"."notification_history" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_history" TO "service_role";



GRANT ALL ON TABLE "public"."notification_settings" TO "anon";
GRANT ALL ON TABLE "public"."notification_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_settings" TO "service_role";
GRANT ALL ON TABLE "public"."notification_settings" TO PUBLIC;



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";
GRANT ALL ON TABLE "public"."notifications" TO PUBLIC;



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";
GRANT ALL ON TABLE "public"."organizations" TO PUBLIC;



GRANT ALL ON TABLE "public"."payment_allocations" TO "anon";
GRANT ALL ON TABLE "public"."payment_allocations" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_allocations" TO "service_role";



GRANT ALL ON TABLE "public"."payment_refunds" TO "anon";
GRANT ALL ON TABLE "public"."payment_refunds" TO "authenticated";



GRANT INSERT ON TABLE "public"."pending_admissions" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."pending_admissions" TO "authenticated";



GRANT ALL ON TABLE "public"."pending_auth_creation" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."pending_auth_creation" TO "authenticated";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";
GRANT ALL ON TABLE "public"."products" TO PUBLIC;



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";
GRANT ALL ON TABLE "public"."profiles" TO PUBLIC;



GRANT ALL ON TABLE "public"."questions" TO "anon";
GRANT ALL ON TABLE "public"."questions" TO "authenticated";
GRANT ALL ON TABLE "public"."questions" TO "service_role";
GRANT ALL ON TABLE "public"."questions" TO PUBLIC;



GRANT ALL ON TABLE "public"."result_publish_log" TO "anon";
GRANT ALL ON TABLE "public"."result_publish_log" TO "authenticated";
GRANT ALL ON TABLE "public"."result_publish_log" TO "service_role";



GRANT ALL ON TABLE "public"."role_menu_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."role_menu_permissions" TO "anon";
GRANT ALL ON TABLE "public"."role_menu_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."salary_advances" TO "anon";
GRANT ALL ON TABLE "public"."salary_advances" TO "authenticated";
GRANT ALL ON TABLE "public"."salary_advances" TO "service_role";
GRANT ALL ON TABLE "public"."salary_advances" TO PUBLIC;



GRANT ALL ON TABLE "public"."salary_balances" TO "anon";
GRANT ALL ON TABLE "public"."salary_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."salary_balances" TO "service_role";
GRANT ALL ON TABLE "public"."salary_balances" TO PUBLIC;



GRANT ALL ON TABLE "public"."salary_increments" TO "anon";
GRANT ALL ON TABLE "public"."salary_increments" TO "authenticated";
GRANT ALL ON TABLE "public"."salary_increments" TO "service_role";
GRANT ALL ON TABLE "public"."salary_increments" TO PUBLIC;



GRANT ALL ON TABLE "public"."salary_notifications" TO "anon";
GRANT ALL ON TABLE "public"."salary_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."salary_notifications" TO "service_role";
GRANT ALL ON TABLE "public"."salary_notifications" TO PUBLIC;



GRANT ALL ON TABLE "public"."salary_payments" TO "anon";
GRANT ALL ON TABLE "public"."salary_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."salary_payments" TO "service_role";
GRANT ALL ON TABLE "public"."salary_payments" TO PUBLIC;



GRANT ALL ON TABLE "public"."salary_promotions" TO "anon";
GRANT ALL ON TABLE "public"."salary_promotions" TO "authenticated";
GRANT ALL ON TABLE "public"."salary_promotions" TO "service_role";
GRANT ALL ON TABLE "public"."salary_promotions" TO PUBLIC;



GRANT ALL ON TABLE "public"."salary_version_history" TO "anon";
GRANT ALL ON TABLE "public"."salary_version_history" TO "authenticated";
GRANT ALL ON TABLE "public"."salary_version_history" TO "service_role";



GRANT ALL ON TABLE "public"."scholarship_applications" TO "anon";
GRANT ALL ON TABLE "public"."scholarship_applications" TO "authenticated";



GRANT ALL ON TABLE "public"."school_settings" TO "anon";
GRANT ALL ON TABLE "public"."school_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."school_settings" TO "service_role";



GRANT ALL ON SEQUENCE "public"."school_settings_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."school_settings_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."school_settings_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."sibling_groups" TO "anon";
GRANT ALL ON TABLE "public"."sibling_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."sibling_groups" TO "service_role";



GRANT ALL ON TABLE "public"."staff_attendance" TO "anon";
GRANT ALL ON TABLE "public"."staff_attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_attendance" TO "service_role";
GRANT ALL ON TABLE "public"."staff_attendance" TO PUBLIC;



GRANT ALL ON TABLE "public"."student_attendance" TO "anon";
GRANT ALL ON TABLE "public"."student_attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."student_attendance" TO "service_role";
GRANT ALL ON TABLE "public"."student_attendance" TO PUBLIC;



GRANT ALL ON TABLE "public"."student_fee_advance" TO "anon";
GRANT ALL ON TABLE "public"."student_fee_advance" TO "authenticated";
GRANT ALL ON TABLE "public"."student_fee_advance" TO "service_role";



GRANT ALL ON TABLE "public"."student_fee_dues" TO "anon";
GRANT ALL ON TABLE "public"."student_fee_dues" TO "authenticated";



GRANT ALL ON TABLE "public"."student_leave_attachments" TO "anon";
GRANT ALL ON TABLE "public"."student_leave_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."student_leave_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."student_leaves" TO "anon";
GRANT ALL ON TABLE "public"."student_leaves" TO "authenticated";
GRANT ALL ON TABLE "public"."student_leaves" TO "service_role";



GRANT ALL ON TABLE "public"."student_marks_new" TO "anon";
GRANT ALL ON TABLE "public"."student_marks_new" TO "authenticated";
GRANT ALL ON TABLE "public"."student_marks_new" TO "service_role";



GRANT ALL ON TABLE "public"."student_overview" TO "authenticated";
GRANT ALL ON TABLE "public"."student_overview" TO "anon";
GRANT ALL ON TABLE "public"."student_overview" TO "service_role";



GRANT ALL ON TABLE "public"."student_siblings" TO "anon";
GRANT ALL ON TABLE "public"."student_siblings" TO "authenticated";
GRANT ALL ON TABLE "public"."student_siblings" TO "service_role";



GRANT ALL ON TABLE "public"."subjects" TO "anon";
GRANT ALL ON TABLE "public"."subjects" TO "authenticated";
GRANT ALL ON TABLE "public"."subjects" TO "service_role";
GRANT ALL ON TABLE "public"."subjects" TO PUBLIC;



GRANT ALL ON TABLE "public"."teacher_profiles" TO "anon";
GRANT ALL ON TABLE "public"."teacher_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."teacher_profiles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."teacher_profiles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."teacher_profiles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."teacher_profiles_id_seq" TO "service_role";



GRANT SELECT ON TABLE "public"."v_due_summary" TO "anon";
GRANT SELECT ON TABLE "public"."v_due_summary" TO "authenticated";
GRANT SELECT ON TABLE "public"."v_due_summary" TO "service_role";



GRANT SELECT ON TABLE "public"."v_fee_dashboard" TO "anon";
GRANT SELECT ON TABLE "public"."v_fee_dashboard" TO "authenticated";
GRANT SELECT ON TABLE "public"."v_fee_dashboard" TO "service_role";



GRANT SELECT ON TABLE "public"."v_fee_dashboard_stats" TO "anon";
GRANT SELECT ON TABLE "public"."v_fee_dashboard_stats" TO "authenticated";
GRANT SELECT ON TABLE "public"."v_fee_dashboard_stats" TO "service_role";



GRANT SELECT ON TABLE "public"."v_invoice_dashboard" TO "anon";
GRANT SELECT ON TABLE "public"."v_invoice_dashboard" TO "authenticated";
GRANT SELECT ON TABLE "public"."v_invoice_dashboard" TO "service_role";



GRANT SELECT ON TABLE "public"."v_monthly_invoice" TO "anon";
GRANT SELECT ON TABLE "public"."v_monthly_invoice" TO "authenticated";
GRANT SELECT ON TABLE "public"."v_monthly_invoice" TO "service_role";



GRANT SELECT ON TABLE "public"."v_payment_allocation_details" TO "anon";
GRANT SELECT ON TABLE "public"."v_payment_allocation_details" TO "authenticated";
GRANT SELECT ON TABLE "public"."v_payment_allocation_details" TO "service_role";



GRANT SELECT ON TABLE "public"."v_payment_receipt" TO "anon";
GRANT SELECT ON TABLE "public"."v_payment_receipt" TO "authenticated";
GRANT SELECT ON TABLE "public"."v_payment_receipt" TO "service_role";



GRANT SELECT ON TABLE "public"."v_staff_salaries" TO "anon";
GRANT SELECT ON TABLE "public"."v_staff_salaries" TO "authenticated";
GRANT SELECT ON TABLE "public"."v_staff_salaries" TO "service_role";



GRANT SELECT ON TABLE "public"."v_student_advance_balance" TO "anon";
GRANT SELECT ON TABLE "public"."v_student_advance_balance" TO "authenticated";
GRANT SELECT ON TABLE "public"."v_student_advance_balance" TO "service_role";



GRANT SELECT ON TABLE "public"."v_student_due_summary" TO "anon";
GRANT SELECT ON TABLE "public"."v_student_due_summary" TO "authenticated";
GRANT SELECT ON TABLE "public"."v_student_due_summary" TO "service_role";



GRANT SELECT ON TABLE "public"."v_student_due_with_carry_forward" TO "anon";
GRANT SELECT ON TABLE "public"."v_student_due_with_carry_forward" TO "authenticated";
GRANT SELECT ON TABLE "public"."v_student_due_with_carry_forward" TO "service_role";



GRANT ALL ON TABLE "public"."vouchers" TO "anon";
GRANT ALL ON TABLE "public"."vouchers" TO "authenticated";
GRANT ALL ON TABLE "public"."vouchers" TO "service_role";


































