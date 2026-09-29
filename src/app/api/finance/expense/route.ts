import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      expense_head_id, financial_account_id, amount, date,
      payment_mode, reference_no, description, paid_to
    } = body

    if (!expense_head_id || !financial_account_id || !amount || amount <= 0 || !paid_to) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    const txDate = date || new Date().toISOString().split('T')[0]
    const refNo = reference_no || `EXP-${Date.now()}`

    // Resolve "Misc Expense" counter account
    const { data: counterAcct } = await supabaseAdmin
      .from('financial_accounts')
      .select('id')
      .eq('account_name', 'Misc Expense')
      .maybeSingle()

    if (!counterAcct) {
      return NextResponse.json({ success: false, error: 'System account "Misc Expense" not found' }, { status: 500 })
    }

    const { data: voucherId, error: rpcErr } = await supabaseAdmin.rpc('fn_create_double_entry', {
      p_voucher_type: 'payment',
      p_voucher_date: txDate,
      p_financial_account_id: financial_account_id,
      p_counter_account_id: counterAcct.id,
      p_amount: amount,
      p_is_income: false,
      p_party_name: paid_to,
      p_reference_no: refNo,
      p_narration: description || `Payment to ${paid_to}`,
      p_description: description || `Payment to ${paid_to}`,
    })

    if (rpcErr) {
      console.error('RPC error:', rpcErr)
      return NextResponse.json({ success: false, error: rpcErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      voucher_id: voucherId,
      message: 'Expense recorded with double-entry'
    })
  } catch (error: any) {
    console.error('Expense API error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}