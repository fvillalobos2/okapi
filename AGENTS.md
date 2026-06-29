<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:supabase-migration-rules -->
# Supabase migration rules

- The canonical migration directory is `supabase/migrations/` at the repository root. Do not use `okapi-agents/supabase/migrations/` for new migration work unless the user explicitly asks for that isolated app context.
- Before changing or applying migrations, inspect Supabase CLI help for the exact installed command syntax, for example `npx supabase db push --help` or `npx supabase migration repair --help`.
- Create new migration files with `npx supabase migration new <descriptive_name>`. Do not invent timestamped migration filenames manually.
- Migrations should be safe to run against partially prepared databases when practical: use `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
- If a migration adds a table to `supabase_realtime`, wrap `alter publication supabase_realtime add table ...` in a `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` block so reruns do not fail.
- Always run `npx supabase migration list --linked` before pushing to compare local and remote migration history.
- Always run `npx supabase db push --linked --dry-run` before `npx supabase db push --linked`.
- If the remote history contains a migration version that is not present locally, stop and inspect it. Only use `npx supabase migration repair --linked --status reverted <version>` when the remote history is known to be stale or from an accidental/obsolete migration.
- Never commit Supabase service role keys, database passwords, access tokens, or `.temp` CLI metadata. Secrets must live in environment variables.
<!-- END:supabase-migration-rules -->
