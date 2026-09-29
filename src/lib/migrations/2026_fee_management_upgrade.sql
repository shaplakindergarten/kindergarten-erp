-- ============================================
-- FEE MANAGEMENT UPGRADE - MIGRATION
-- Created: 2026-09-01
-- ============================================

-- ১. নতুন টেবিল
CREATE TABLE IF NOT EXISTS public.advance_payments (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES students(id),
    amount NUMERIC(12,2) NOT NULL,
    remaining_balance NUMERIC(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fee_invoice_items (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    invoice_id UUID NOT NULL REFERENCES fee_invoices(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES fee_categories(id),
    amount NUMERIC(12,2) NOT NULL,
    discount_amount NUMERIC(12,2) DEFAULT 0,
    paid_amount NUMERIC(12,2) DEFAULT 0,
    due_amount NUMERIC(12,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fee_invoice_items_status_check 
        CHECK (status IN ('pending', 'partial', 'paid', 'waived'))
);

CREATE TABLE IF NOT EXISTS public.payment_refunds (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    payment_id UUID NOT NULL REFERENCES fee_payments(id),
    invoice_id UUID NOT NULL REFERENCES fee_invoices(id),
    refund_amount NUMERIC(12,2) NOT NULL,
    refund_date TIMESTAMP DEFAULT NOW(),
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMP,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT refund_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'completed'))
);

CREATE TABLE IF NOT EXISTS public.scholarship_applications (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES students(id),
    discount_id UUID NOT NULL REFERENCES fee_discounts(id),
    academic_year_id UUID NOT NULL REFERENCES academic_years(id),
    percentage NUMERIC(5,2) NOT NULL,
    amount NUMERIC(12,2),
    reason TEXT,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMP,
    valid_from DATE,
    valid_to DATE,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT scholarship_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'expired'))
);

-- ২. বিদ্যমান টেবিলে নতুন কলাম
ALTER TABLE public.fee_invoices 
ADD COLUMN IF NOT EXISTS previous_due NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS version INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_advance_invoice BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS advance_source_payment_id UUID;

-- ৩. RLS সক্রিয়
ALTER TABLE public.advance_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scholarship_applications ENABLE ROW LEVEL SECURITY;

-- ৪. RLS পলিসি
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.advance_payments;
CREATE POLICY "Enable all for authenticated users" 
ON public.advance_payments FOR ALL 
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.fee_invoice_items;
CREATE POLICY "Enable all for authenticated users" 
ON public.fee_invoice_items FOR ALL 
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.payment_refunds;
CREATE POLICY "Enable all for authenticated users" 
ON public.payment_refunds FOR ALL 
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.scholarship_applications;
CREATE POLICY "Enable all for authenticated users" 
ON public.scholarship_applications FOR ALL 
USING (auth.role() = 'authenticated');

-- ৫. ইনডেক্স
CREATE INDEX IF NOT EXISTS idx_advance_payments_student ON public.advance_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.fee_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_payment ON public.payment_refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_scholarship_student ON public.scholarship_applications(student_id);

-- ৬. ফাংশন
CREATE OR REPLACE FUNCTION public.process_partial_payment(
    p_invoice_id UUID,
    p_amount NUMERIC,
    p_payment_method VARCHAR,
    p_receipt_no VARCHAR
)
RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.reverse_payment(
    p_payment_id UUID,
    p_reason TEXT,
    p_approved_by UUID
)
RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.process_advance_payment_manual(
    p_student_id UUID,
    p_amount NUMERIC,
    p_payment_method VARCHAR,
    p_receipt_no VARCHAR
)
RETURNS JSONB AS $$
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
    
    SELECT academic_year_id INTO v_academic_year_id
    FROM public.fee_student_assignments 
    WHERE student_id = p_student_id AND is_active = true 
    LIMIT 1;
    
    INSERT INTO public.advance_payments (student_id, amount, remaining_balance)
    VALUES (p_student_id, v_advance_amount, v_advance_amount)
    ON CONFLICT (id) DO UPDATE
    SET remaining_balance = advance_payments.remaining_balance + v_advance_amount,
        updated_at = NOW()
    WHERE advance_payments.student_id = p_student_id;
    
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ৭. সুপাবেস রিয়েলটাইমে যোগ করা
ALTER PUBLICATION supabase_realtime ADD TABLE public.advance_payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fee_invoice_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_refunds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scholarship_applications;