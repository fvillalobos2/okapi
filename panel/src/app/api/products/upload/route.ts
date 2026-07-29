import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const form = await req.formData()
  const file = form.get('file') as File | null
  const priceItemId = form.get('price_item_id') as string | null
  const categoryId = form.get('category_id') as string | null
  const businessId = process.env.BUSINESS_ID!

  const docType = (form.get('doc_type') as string | null) || 'product'
  if (!file || (docType === 'product' && !priceItemId && !categoryId)) {
    return NextResponse.json({ error: 'file y (price_item_id o category_id) son requeridos para documentos de producto' }, { status: 400 })
  }
  const lname = file.name.toLowerCase()
  const isPdf = lname.endsWith('.pdf')
  const isText = lname.endsWith('.md') || lname.endsWith('.txt')
  if (!isPdf && !(isText && docType === 'general')) {
    return NextResponse.json({ error: 'Se aceptan PDF para productos; PDF, MD o TXT para documentos generales' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const pathKey = docType === 'general' ? 'general' : (categoryId ? `cat_${categoryId}` : priceItemId)
  const contentType = isPdf ? 'application/pdf' : 'text/plain'
  const path = `${businessId}/${pathKey}/${Date.now()}_${file.name}`
  const { error: upErr } = await supabaseAdmin().storage
    .from('product-pdfs')
    .upload(path, buffer, { contentType, upsert: true })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: urlData } = supabaseAdmin().storage.from('product-pdfs').getPublicUrl(path)
  const fileUrl = urlData.publicUrl

  let contentText = ''
  if (isText) {
    contentText = buffer.toString('utf-8')
  } else {
    try {
      const base64 = buffer.toString('base64')
      const extractPrompt = docType === 'general'
        ? 'Extrae todo el texto de este documento. Preserva la estructura, encabezados y listas. Sé exhaustivo.'
        : 'Extrae todo el texto relevante de este documento de producto. Incluye especificaciones, características, precios si los hay, y cualquier información útil para un agente de ventas. Sé exhaustivo.'
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
            { type: 'text', text: extractPrompt },
          ],
        }],
      })
      contentText = msg.content[0].type === 'text' ? msg.content[0].text : ''
    } catch {
      contentText = `[Extracción automática falló]\n\nArchivo: ${file.name}`
    }
  }

  const record: any = {
    business_id: businessId,
    filename: file.name,
    content_text: contentText,
    file_url: fileUrl,
    doc_type: docType,
  }
  if (docType === 'product') {
    if (categoryId) record.category_id = categoryId
    else record.price_item_id = priceItemId
  }

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
