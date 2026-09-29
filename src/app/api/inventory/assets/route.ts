// src/app/api/inventory/assets/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseSecretKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(supabaseUrl!, supabaseSecretKey!, {
  auth: { autoRefreshToken: false, persistSession: false }
})

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const category = searchParams.get('category')

    let query = supabaseAdmin
      .from('inventory_items')
      .select(`
        *,
        category:inventory_categories(name)
      `)
      .eq('item_type', 'asset')

    if (status === 'active') {
      query = query.eq('is_active', true)
    } else if (status === 'inactive') {
      query = query.eq('is_active', false)
    }

    if (category) {
      query = query.eq('category_id', category)
    }

    const { data, error } = await query.order('name')

    if (error) throw error

    return NextResponse.json({
      success: true,
      data
    })

  } catch (error: any) {
    console.error('Asset API error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { 
      name, 
      item_code, 
      category_id, 
      item_type,
      unit,
      purchase_price,
      selling_price,
      current_stock,
      reorder_level,
      location_rack,
      description
    } = body

    if (!name || !item_code) {
      return NextResponse.json(
        { success: false, error: 'Name and code are required' },
        { status: 400 }
      )
    }

    // Check if code already exists
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('inventory_items')
      .select('id')
      .eq('item_code', item_code)
      .maybeSingle()

    if (checkError) {
      console.error('Check error:', checkError)
    }

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Item code already exists' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('inventory_items')
      .insert({
        name,
        item_code,
        category_id: category_id || null,
        item_type: item_type || 'asset',
        unit: unit || 'Pcs',
        purchase_price: purchase_price || 0,
        selling_price: selling_price || 0,
        current_stock: current_stock || 0,
        reorder_level: reorder_level || 5,
        location_rack: location_rack || null,
        description: description || null,
        is_active: true
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      data,
      message: 'Asset created successfully'
    })

  } catch (error: any) {
    console.error('Asset creation error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}