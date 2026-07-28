-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table farms enable row level security;
alter table farm_members enable row level security;
alter table breeds enable row level security;
alter table lots enable row level security;
alter table paddocks enable row level security;
alter table animals enable row level security;
alter table animal_events enable row level security;
alter table weight_records enable row level security;
alter table reproductive_records enable row level security;
alter table tasks enable row level security;
alter table expenses enable row level security;
alter table sales enable row level security;
alter table imported_documents enable row level security;
alter table imported_rows enable row level security;
alter table imported_cells enable row level security;
alter table validation_issues enable row level security;
alter table import_approvals enable row level security;
alter table ai_conversations enable row level security;
alter table ai_messages enable row level security;

-- Helper: check if user is a member of a farm
create or replace function is_farm_member(p_farm_id uuid)
returns boolean as $$
  select exists (
    select 1 from farm_members
    where farm_id = p_farm_id
      and user_id = auth.uid()
  );
$$ language sql security definer stable;

-- Helper: check if user has a specific role or higher on a farm
create or replace function has_farm_role(p_farm_id uuid, p_min_role text)
returns boolean as $$
  select exists (
    select 1 from farm_members
    where farm_id = p_farm_id
      and user_id = auth.uid()
      and case p_min_role
        when 'viewer'  then role in ('viewer', 'worker', 'manager', 'owner')
        when 'worker'  then role in ('worker', 'manager', 'owner')
        when 'manager' then role in ('manager', 'owner')
        when 'owner'   then role = 'owner'
        else false
      end
  );
$$ language sql security definer stable;

-- ============================================================
-- PROFILES
-- ============================================================
create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- ============================================================
-- FARMS
-- ============================================================
create policy "Farm members can view farm"
  on farms for select using (is_farm_member(id));

create policy "Farm owners can update farm"
  on farms for update using (has_farm_role(id, 'owner'));

create policy "Authenticated users can create farms"
  on farms for insert with check (auth.uid() is not null);

-- ============================================================
-- FARM MEMBERS
-- ============================================================
create policy "Members can view their farm members"
  on farm_members for select using (is_farm_member(farm_id));

create policy "Owners can manage farm members"
  on farm_members for all using (has_farm_role(farm_id, 'owner'));

create policy "Self-insert allowed on farm creation"
  on farm_members for insert with check (user_id = auth.uid());

-- ============================================================
-- BREEDS
-- ============================================================
create policy "System breeds visible to all authenticated"
  on breeds for select using (
    is_system = true or is_farm_member(farm_id)
  );

create policy "Managers can manage farm breeds"
  on breeds for all using (
    farm_id is not null and has_farm_role(farm_id, 'manager')
  );

-- ============================================================
-- LOTS
-- ============================================================
create policy "Farm members can view lots"
  on lots for select using (is_farm_member(farm_id));

create policy "Workers and above can manage lots"
  on lots for all using (has_farm_role(farm_id, 'worker'));

-- ============================================================
-- PADDOCKS
-- ============================================================
create policy "Farm members can view paddocks"
  on paddocks for select using (is_farm_member(farm_id));

create policy "Workers and above can manage paddocks"
  on paddocks for all using (has_farm_role(farm_id, 'worker'));

-- ============================================================
-- ANIMALS
-- ============================================================
create policy "Farm members can view animals"
  on animals for select using (is_farm_member(farm_id));

create policy "Workers and above can insert animals"
  on animals for insert with check (has_farm_role(farm_id, 'worker'));

create policy "Workers and above can update animals"
  on animals for update using (has_farm_role(farm_id, 'worker'));

create policy "Managers can delete animals"
  on animals for delete using (has_farm_role(farm_id, 'manager'));

-- ============================================================
-- ANIMAL EVENTS
-- ============================================================
create policy "Farm members can view events"
  on animal_events for select using (is_farm_member(farm_id));

create policy "Workers and above can insert events"
  on animal_events for insert with check (has_farm_role(farm_id, 'worker'));

-- Events are immutable — no update/delete by users

-- ============================================================
-- WEIGHT RECORDS
-- ============================================================
create policy "Farm members can view weights"
  on weight_records for select using (is_farm_member(farm_id));

create policy "Workers and above can manage weights"
  on weight_records for all using (has_farm_role(farm_id, 'worker'));

-- ============================================================
-- REPRODUCTIVE RECORDS
-- ============================================================
create policy "Farm members can view reproductive records"
  on reproductive_records for select using (is_farm_member(farm_id));

create policy "Workers and above can manage reproductive records"
  on reproductive_records for all using (has_farm_role(farm_id, 'worker'));

-- ============================================================
-- TASKS
-- ============================================================
create policy "Farm members can view tasks"
  on tasks for select using (is_farm_member(farm_id));

create policy "Workers and above can manage tasks"
  on tasks for all using (has_farm_role(farm_id, 'worker'));

-- ============================================================
-- EXPENSES
-- ============================================================
create policy "Farm members can view expenses"
  on expenses for select using (is_farm_member(farm_id));

create policy "Workers and above can manage expenses"
  on expenses for all using (has_farm_role(farm_id, 'worker'));

-- ============================================================
-- SALES
-- ============================================================
create policy "Farm members can view sales"
  on sales for select using (is_farm_member(farm_id));

create policy "Managers can manage sales"
  on sales for all using (has_farm_role(farm_id, 'manager'));

-- ============================================================
-- IMPORTS
-- ============================================================
create policy "Farm members can view imported documents"
  on imported_documents for select using (is_farm_member(farm_id));

create policy "Workers and above can manage imported documents"
  on imported_documents for all using (has_farm_role(farm_id, 'worker'));

create policy "Farm members can view imported rows"
  on imported_rows for select using (is_farm_member(farm_id));

create policy "Workers and above can manage imported rows"
  on imported_rows for all using (has_farm_role(farm_id, 'worker'));

create policy "Farm members can view imported cells"
  on imported_cells for select using (
    exists (
      select 1 from imported_rows r
      where r.id = imported_cells.row_id
        and is_farm_member(r.farm_id)
    )
  );

create policy "Workers can manage imported cells"
  on imported_cells for all using (
    exists (
      select 1 from imported_rows r
      where r.id = imported_cells.row_id
        and has_farm_role(r.farm_id, 'worker')
    )
  );

create policy "Farm members can view validation issues"
  on validation_issues for select using (
    exists (
      select 1 from imported_rows r
      where r.id = validation_issues.row_id
        and is_farm_member(r.farm_id)
    )
  );

create policy "Farm members can view import approvals"
  on import_approvals for select using (
    exists (
      select 1 from imported_documents d
      where d.id = import_approvals.document_id
        and is_farm_member(d.farm_id)
    )
  );

create policy "Workers can create import approvals"
  on import_approvals for insert with check (
    exists (
      select 1 from imported_documents d
      where d.id = import_approvals.document_id
        and has_farm_role(d.farm_id, 'worker')
    )
  );

-- ============================================================
-- AI CONVERSATIONS
-- ============================================================
create policy "Users can view own conversations"
  on ai_conversations for select using (
    user_id = auth.uid() and is_farm_member(farm_id)
  );

create policy "Users can create conversations"
  on ai_conversations for insert with check (
    user_id = auth.uid() and is_farm_member(farm_id)
  );

create policy "Users can view messages in own conversations"
  on ai_messages for select using (
    exists (
      select 1 from ai_conversations c
      where c.id = ai_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

create policy "Users can insert messages in own conversations"
  on ai_messages for insert with check (
    exists (
      select 1 from ai_conversations c
      where c.id = ai_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );
