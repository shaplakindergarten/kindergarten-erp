import { createClient } from '@/lib/supabase/server'
import type { Product, InventoryTransaction, ExpenseHead, IncomeHead } from '@/types'

// ============================================
// Product CRUD Operations
// ============================================

export async function getProducts() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name')
  
  if (error) throw error
  return data
}

export async function getProductById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function createProduct(product: Partial<Product>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .insert({
      name: product.name,
      category: product.category,
      purchase_price: product.purchase_price,
      sale_price: product.sale_price,
      quantity: product.quantity || 0,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateProduct(id: string, product: Partial<Product>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .update({
      name: product.name,
      category: product.category,
      purchase_price: product.purchase_price,
      sale_price: product.sale_price,
      quantity: product.quantity,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteProduct(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// ============================================
// Inventory Transactions
// ============================================

export async function getInventoryTransactions(filters?: { productId?: string; type?: 'buy' | 'sale' }) {
  const supabase = await createClient()
  let query = supabase
    .from('inventory_transactions')
    .select(`
      *,
      product:products(id, name, category)
    `)
    .order('date', { ascending: false })

  if (filters?.productId) query = query.eq('product_id', filters.productId)
  if (filters?.type) query = query.eq('type', filters.type)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function recordPurchase(params: {
  productId: string
  quantity: number
  price: number
  date?: string
  remarks?: string
}) {
  const supabase = await createClient()
  const { quantity, price, date = new Date().toISOString(), remarks } = params

  const { data, error } = await supabase
    .from('inventory_transactions')
    .insert({
      product_id: params.productId,
      type: 'buy',
      quantity,
      price,
      date,
      remarks: remarks || null,
    })
    .select()
    .single()

  if (error) throw error

  const { data: product, error: fetchError } = await supabase
    .from('products')
    .select('quantity')
    .eq('id', params.productId)
    .single()

  if (fetchError) throw fetchError

  await supabase
    .from('products')
    .update({ quantity: (product?.quantity || 0) + quantity })
    .eq('id', params.productId)

  return data
}

export async function recordSale(params: {
  productId: string
  quantity: number
  price: number
  date?: string
  remarks?: string
}) {
  const supabase = await createClient()
  const { quantity, price, date = new Date().toISOString(), remarks } = params

  const { data, error } = await supabase
    .from('inventory_transactions')
    .insert({
      product_id: params.productId,
      type: 'sale',
      quantity,
      price,
      date,
      remarks: remarks || null,
    })
    .select()
    .single()

  if (error) throw error

  const { data: product, error: fetchError } = await supabase
    .from('products')
    .select('quantity')
    .eq('id', params.productId)
    .single()

  if (fetchError) throw fetchError

  await supabase
    .from('products')
    .update({ quantity: Math.max(0, (product?.quantity || 0) - quantity) })
    .eq('id', params.productId)

  return data
}

export async function recordBulkPurchase(transactions: Array<{
  productId: string
  quantity: number
  price: number
  date?: string
  remarks?: string
}>) {
  const results: any[] = []

  for (const tx of transactions) {
    const result = await recordPurchase(tx)
    results.push(result)
  }

  return results
}

export async function recordBulkSale(transactions: Array<{
  productId: string
  quantity: number
  price: number
  date?: string
  remarks?: string
}>) {
  const results: any[] = []

  for (const tx of transactions) {
    const result = await recordSale(tx)
    results.push(result)
  }

  return results
}

export async function getInventoryStats() {
  const supabase = await createClient()
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('quantity, purchase_price, sale_price')

  if (productsError) throw productsError

  const totalItems = products?.length || 0
  const totalQuantity = products?.reduce((sum, p) => sum + (p.quantity || 0), 0) || 0
  const totalValue = products?.reduce((sum, p) => sum + (p.purchase_price || 0) * (p.quantity || 0), 0) || 0
  const totalRetailValue = products?.reduce((sum, p) => sum + (p.sale_price || 0) * (p.quantity || 0), 0) || 0
  const { data: transactions, error: txError } = await supabase
    .from('inventory_transactions')
    .select('type, quantity, price')

  if (txError) throw txError

  const totalPurchaseAmount = transactions?.filter(t => t.type === 'buy').reduce((sum, t) => sum + ((t.price || 0) * (t.quantity || 0)), 0) || 0
  const totalSaleAmount = transactions?.filter(t => t.type === 'sale').reduce((sum, t) => sum + ((t.price || 0) * (t.quantity || 0)), 0) || 0
  return {
    totalItems,
    totalQuantity,
    totalValue,
    totalRetailValue,
    potentialRevenue: totalRetailValue - totalValue,
    totalPurchaseAmount,
    totalSaleAmount,
  }
}

export async function getOrCreateExpenseHead(name: string, type: ExpenseHead['type'] = 'other') {
  const supabase = await createClient()

  const { data: existing, error: fetchError } = await supabase
    .from('expense_heads')
    .select('*')
    .eq('name', name)
    .maybeSingle()

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw fetchError
  }

  if (existing) {
    return existing
  }

  const { data, error } = await supabase
    .from('expense_heads')
    .insert({ name, type })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getOrCreateIncomeHead(name: string, type: IncomeHead['type'] = 'product_sale') {
  const supabase = await createClient()

  const { data: existing, error: fetchError } = await supabase
    .from('income_heads')
    .select('*')
    .eq('name', name)
    .maybeSingle()

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw fetchError
  }

  if (existing) {
    return existing
  }

  const { data, error } = await supabase
    .from('income_heads')
    .insert({ name, type })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function linkFinanceTransactionToAccount(params: {
  transactionId: string
  accountId: string
  amount: number
  description?: string
}) {
  const supabase = await createClient()
  const { transactionId, accountId, amount, description } = params

  const { data, error } = await supabase
    .from('finance_transactions')
    .update({
      account_id: accountId,
      amount,
      description: description || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', transactionId)
    .select()
    .single()

  if (error) throw error
  return data
}
