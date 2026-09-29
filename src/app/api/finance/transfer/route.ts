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
    const { fromAccountId, toAccountId, amount, date, referenceNo, description } = body

    if (!fromAccountId || !toAccountId || !amount || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    if (fromAccountId === toAccountId) {
      return NextResponse.json({ success: false, error: 'From and To accounts cannot be same' }, { status: 400 })
    }

    const txDate = date || new Date().toISOString().split('T')[0]

    const { data: voucherId, error: rpcErr } = await supabaseAdmin.rpc('fn_create_transfer', {
      p_from_account_id: fromAccountId,
      p_to_account_id: toAccountId,
      p_amount: amount,
      p_date: txDate,
      p_narration: description || 'Fund Transfer',
      p_reference_no: referenceNo || null,
    })

    if (rpcErr) {
      console.error('Transfer RPC error:', rpcErr)
      return NextResponse.json({ success: false, error: rpcErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      voucher_id: voucherId,
      message: 'Transfer completed'
    })
  } catch (error: any) {
    console.error('Transfer API error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}