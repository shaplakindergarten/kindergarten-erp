import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseSecretKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('fee_structures')
      .select(`
        *,
        academic_year:academic_years(id, year_name, name),
        class:classes(id, name),
        items:fee_structure_items(*)
      `)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('GET error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const { data: structure, error: structureError } = await supabaseAdmin
      .from('fee_structures')
      .insert({
        name: body.name,
        academic_year_id: body.academic_year_id,
        class_id: body.class_id,
        description: body.description,
        total_amount: body.total_amount,
        is_active: body.is_active ?? true
      })
      .select()
      .single()
    
    if (structureError) throw structureError
    
    if (body.items && body.items.length > 0) {
      const itemsWithStructureId = body.items.map((item: any) => ({
        fee_structure_id: structure.id,
        category_id: item.category_id,
        name: item.name,
        amount: item.amount,
        frequency: item.frequency
      }))
      
      const { error: itemsError } = await supabaseAdmin
        .from('fee_structure_items')
        .insert(itemsWithStructureId)
      
      if (itemsError) throw itemsError
    }
    
    const { data: completeStructure, error: fetchError } = await supabaseAdmin
      .from('fee_structures')
      .select(`
        *,
        academic_year:academic_years(id, year_name, name),
        class:classes(id, name),
        items:fee_structure_items(*)
      `)
      .eq('id', structure.id)
      .single()
    
    if (fetchError) throw fetchError
    
    return NextResponse.json(completeStructure)
  } catch (error: any) {
    console.error('POST error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { id, items, ...updates } = await request.json()
    
    const { error: updateError } = await supabaseAdmin
      .from('fee_structures')
      .update(updates)
      .eq('id', id)
    
    if (updateError) throw updateError
    
    if (items !== undefined) {
      await supabaseAdmin
        .from('fee_structure_items')
        .delete()
        .eq('fee_structure_id', id)
      
      if (items.length > 0) {
        const itemsWithStructureId = items.map((item: any) => ({
          fee_structure_id: id,
          category_id: item.category_id,
          name: item.name,
          amount: item.amount,
          frequency: item.frequency
        }))
        
        const { error: insertError } = await supabaseAdmin
          .from('fee_structure_items')
          .insert(itemsWithStructureId)
        
        if (insertError) throw insertError
      }
    }
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('PUT error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }
    
    await supabaseAdmin
      .from('fee_structure_items')
      .delete()
      .eq('fee_structure_id', id)
    
    const { error: structureError } = await supabaseAdmin
      .from('fee_structures')
      .delete()
      .eq('id', id)
    
    if (structureError) throw structureError
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('DELETE error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 })
  }
}