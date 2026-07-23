import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const form = await req.formData()
  const file = form.get('file') as File | null
  const priceItemId = form.get('price_item_id') as string | null
  const categoryId = form.get('category_id') as string | null
  const businessId = form.get('business_id') as string | null

  if (!file || (!priceItemId && !categoryId) || !businessId) {
    return NextResponse.json({ error: 'file, business_id y (price_item_id o category_id) son requeridos' }, { status: 400 })
  }
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Solo se aceptan archivos PDF' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const pathKey = categoryId ? `cat_${categoryId}` : priceItemId
  const path = `${businessId}/${pathKey}/${Date.now()}_${file.name}`
  const { error: upErr } = await supabaseAdmin().storage
    .from('product-docs')
    .upload(path, buffer, { contentType: 'application/pdf', upsert: true })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: urlData } = supabaseAdmin().storage.from('product-docs').getPublicUrl(path)
  const fileUrl = urlData.publicUrl

  let contentText = ''
  try {
    const base64 = buffer.toString('base64')
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
          { type: 'text', text: 'Extrae todo el texto relevante de este documento de producto. Incluye especificaciones, características, precios si los hay, y cualquier información útil para un agente de ventas. Sé exhaustivo.' },
        ],
      }],
    })
    contentText = msg.content[0].type === 'text' ? msg.content[0].text : ''
  } catch {
    contentText = `[Extracción automática falló]\n\nArchivo: ${file.name}`
  }

  const record: any = {
    business_id: businessId,
    filename: file.name,
    content_text: contentText,
    file_url: fileUrl,
  }
  if (categoryId) record.category_id = categoryId
  else record.price_item_id = priceItemId

  const { data, error } = await supabaseAdmin().from('product_documents').insert(record).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const { id } = await req.json()
  const { error } = await supabaseAdmin().from('product_documents').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
