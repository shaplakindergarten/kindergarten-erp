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
      income_head_id, financial_account_id, amount, date,
      payment_mode, reference_no, description, received_from
    } = body

    if (!income_head_id || !financial_account_id || !amount || amount <= 0 || !received_from) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    const txDate = date || new Date().toISOString().split('T')[0]
    const refNo = reference_no || `INC-${Date.now()}`

    // Resolve "Misc Income" counter account
    const { data: counterAcct } = await supabaseAdmin
      .from('financial_accounts')
      .select('id')
      .eq('account_name', 'Misc Income')
      .maybeSingle()

    if (!counterAcct) {
      return NextResponse.json({ success: false, error: 'System account "Misc Income" not found' }, { status: 500 })
    }

    // Single atomic RPC — creates voucher + 2 journal entries
    const { data: voucherId, error: rpcErr } = await supabaseAdmin.rpc('fn_create_double_entry', {
      p_voucher_type: 'receipt',
      p_voucher_date: txDate,
      p_financial_account_id: financial_account_id,
      p_counter_account_id: counterAcct.id,
      p_amount: amount,
      p_is_income: true,
      p_party_name: received_from,
      p_reference_no: refNo,
      p_narration: description || `Income from ${received_from}`,
      p_description: description || `Income from ${received_from}`,
    })

    if (rpcErr) {
      console.error('RPC error:', rpcErr)
      return NextResponse.json({ success: false, error: rpcErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      voucher_id: voucherId,
      message: 'Income recorded with double-entry'
    })
  } catch (error: any) {
    console.error('Income API error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}