// src/lib/api/finance.ts
// Finance ERP Integration API client
//
// NOTE: Fee payment & salary payment integration is now handled
// by DATABASE TRIGGERS (sync_fee_payment_to_finance,
// sync_salary_payment_to_finance). Those triggers automatically
// create finance_transactions + vouchers + journal_entries.
//
// This client only exposes manual income / expense / transfer.

// ============================================
// Manual Income Entry
// ============================================
export async function createManualIncome(
  amount: number,
  incomeHeadId: string,
  financialAccountId: string,
  date: string,
  paymentMode: string,
  description: string,
  receivedFrom: string,
  referenceNo?: string
): Promise<{ success: boolean; data?: any; message?: string; voucher_id?: string }> {
  try {
    const response = await fetch('/api/finance/income', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        income_head_id: incomeHeadId,
        financial_account_id: financialAccountId,
        amount,
        date,
        payment_mode: paymentMode,
        description,
        received_from: receivedFrom,
        reference_no: referenceNo,
      })
    })

    const result = await response.json()
    return result
  } catch (error) {
    console.error('Manual income error:', error)
    return { success: false, message: 'Failed to record income' }
  }
}

// ============================================
// Manual Expense Entry
// ============================================
export async function createManualExpense(
  amount: number,
  expenseHeadId: string,
  financialAccountId: string,
  date: string,
  paymentMode: string,
  description: string,
  paidTo: string,
  referenceNo?: string
): Promise<{ success: boolean; data?: any; message?: string; voucher_id?: string }> {
  try {
    const response = await fetch('/api/finance/expense', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expense_head_id: expenseHeadId,
        financial_account_id: financialAccountId,
        amount,
        date,
        payment_mode: paymentMode,
        description,
        paid_to: paidTo,
        reference_no: referenceNo,
      })
    })

    const result = await response.json()
    return result
  } catch (error) {
    console.error('Manual expense error:', error)
    return { success: false, message: 'Failed to record expense' }
  }
}

// ============================================
// Cash / Bank Transfer
// ============================================
export async function createCashTransfer(params: {
  fromAccountId: string
  toAccountId: string
  amount: number
  date: string
  referenceNo?: string
  description?: string
}): Promise<{ success: boolean; data?: any; message?: string }> {
  try {
    const response = await fetch('/api/finance/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    })

    const result = await response.json()
    return result
  } catch (error) {
    console.error('Transfer error:', error)
    return { success: false, message: 'Transfer failed' }
  }
}