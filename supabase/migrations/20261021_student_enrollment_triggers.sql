-- Create student_enrollments table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.student_enrollments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    student_id uuid NOT NULL,
    academic_year_id uuid,
    class_id uuid,
    section_id uuid,
    roll_no character varying(20),
    enrollment_status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    enrolled_on date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT student_enrollments_pkey PRIMARY KEY (id),
    CONSTRAINT student_enrollments_student_id_academic_year_id_key UNIQUE (student_id, academic_year_id)
);

-- ====================================================================
-- TRIGGER 1: Admission — AFTER INSERT on students
-- ====================================================================
CREATE OR REPLACE FUNCTION public.trg_sync_enrollment_on_admission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only create enrollment if both academic_year_id and class_id are set
    IF NEW.academic_year_id IS NOT NULL AND NEW.class_id IS NOT NULL THEN
        INSERT INTO public.student_enrollments (
            student_id,
            academic_year_id,
            class_id,
            section_id,
            roll_no,
            enrollment_status,
            enrolled_on
        )
        VALUES (
            NEW.id,
            NEW.academic_year_id,
            NEW.class_id,
            NEW.section_id,
            NEW.class_roll,
            'active',
            COALESCE(NEW.admission_date, CURRENT_DATE)
        )
        ON CONFLICT (student_id, academic_year_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_enrollment_on_admission
AFTER INSERT ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_enrollment_on_admission();

-- ====================================================================
-- TRIGGER 2: Class Change — AFTER UPDATE on students
-- ====================================================================
CREATE OR REPLACE FUNCTION public.trg_sync_enrollment_on_class_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only act if class_id, section_id, or academic_year_id changed
    IF (OLD.class_id IS DISTINCT FROM NEW.class_id)
       OR (OLD.section_id IS DISTINCT FROM NEW.section_id)
       OR (OLD.academic_year_id IS DISTINCT FROM NEW.academic_year_id) THEN

        IF NEW.academic_year_id IS NOT NULL AND NEW.class_id IS NOT NULL THEN
            -- Try to update the existing enrollment for the current academic year
            UPDATE public.student_enrollments
            SET
                class_id = NEW.class_id,
                section_id = NEW.section_id,
                roll_no = NEW.class_roll,
                updated_at = NOW()
            WHERE student_id = NEW.id
              AND academic_year_id = NEW.academic_year_id;

            -- If no row was updated, insert a new enrollment
            IF NOT FOUND THEN
                INSERT INTO public.student_enrollments (
                    student_id,
                    academic_year_id,
                    class_id,
                    section_id,
                    roll_no,
                    enrollment_status,
                    enrolled_on
                )
                VALUES (
                    NEW.id,
                    NEW.academic_year_id,
                    NEW.class_id,
                    NEW.section_id,
                    NEW.class_roll,
                    'active',
                    COALESCE(NEW.admission_date, CURRENT_DATE)
                )
                ON CONFLICT (student_id, academic_year_id) DO NOTHING;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Enrollment sync failed for student %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_enrollment_on_class_change
AFTER UPDATE OF class_id, section_id, academic_year_id ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_enrollment_on_class_change();

-- Grant permissions
GRANT ALL ON FUNCTION public.trg_sync_enrollment_on_admission() TO anon;
GRANT ALL ON FUNCTION public.trg_sync_enrollment_on_admission() TO authenticated;
GRANT ALL ON FUNCTION public.trg_sync_enrollment_on_admission() TO service_role;
GRANT ALL ON FUNCTION public.trg_sync_enrollment_on_class_change() TO anon;
GRANT ALL ON FUNCTION public.trg_sync_enrollment_on_class_change() TO authenticated;
GRANT ALL ON FUNCTION public.trg_sync_enrollment_on_class_change() TO service_role;
