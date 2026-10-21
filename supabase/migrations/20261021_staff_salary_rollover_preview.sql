CREATE OR REPLACE FUNCTION public.preview_staff_salary_rollover()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_active_staff', (
      SELECT COUNT(*) FROM public.staff WHERE status = 'active'
    ),
    'staff_with_structure', (
      SELECT COUNT(DISTINCT s.id)
      FROM public.staff s
      JOIN public.staff_salaries ss ON ss.staff_id = s.id AND ss.is_current = true
      WHERE s.status = 'active'
    ),
    'staff_without_structure', (
      SELECT COUNT(*) FROM public.staff s
      WHERE s.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM public.staff_salaries ss 
          WHERE ss.staff_id = s.id AND ss.is_current = true
        )
    ),
    'total_monthly_salary', (
      SELECT COALESCE(SUM(ss.total_salary), 0)
      FROM public.staff_salaries ss
      JOIN public.staff s ON s.id = ss.staff_id
      WHERE ss.is_current = true AND s.status = 'active'
    ),
    'staff_list', (
      SELECT jsonb_agg(jsonb_build_object(
        'staff_id', s.id,
        'name', s.name,
        'designation', s.designation,
        'structure_id', ss.id,
        'basic', ss.basic,
        'total_salary', ss.total_salary,
        'effective_from', ss.effective_from,
        'has_structure', ss.id IS NOT NULL
      ) ORDER BY s.name)
      FROM public.staff s
      LEFT JOIN public.staff_salaries ss 
        ON ss.staff_id = s.id AND ss.is_current = true
      WHERE s.status = 'active'
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;
