<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:supabase-migration-rules -->
# Supabase migration rules

- The canonical migration directory for this repository is `../supabase/migrations/`, not `okapi-agents/supabase/migrations/`, unless the user explicitly asks for isolated `okapi-agents` migration work.
- Before changing or applying migrations, inspect Supabase CLI help for the installed command syntax.
- Create new migration files with `npx supabase migration new <descriptive_name>` from the repository root. Do not invent timestamped migration filenames manually.
- Migrations should be idempotent when practical: use `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
- Always run `npx supabase migration list --linked` and `npx supabase db push --linked --dry-run` before pushing migrations.
- Never commit Supabase service role keys, database passwords, access tokens, or `.temp` CLI metadata.
<!-- END:supabase-migration-rules -->
