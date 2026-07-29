-- business_documents
-- Adds doc_type to product_documents so general business docs (guides, analyses)
-- can be stored separately from product-level PDFs and loaded as agent context.

alter table product_documents
  add column if not exists doc_type text not null default 'product',
  add column if not exists content_text text,
  add column if not exists category_id uuid references product_categories(id) on delete set null;

create index if not exists idx_product_documents_general
  on product_documents(business_id, doc_type);
