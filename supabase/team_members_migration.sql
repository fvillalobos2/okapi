-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS restaurant_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'manager' CHECK (role IN ('manager', 'viewer')),
  invited_by uuid REFERENCES auth.users(id),
  user_id uuid REFERENCES auth.users(id),
  invite_token uuid DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  invited_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE(restaurant_id, email)
);

CREATE INDEX IF NOT EXISTS rm_restaurant_id_idx ON restaurant_members(restaurant_id);
CREATE INDEX IF NOT EXISTS rm_user_id_idx ON restaurant_members(user_id);
CREATE INDEX IF NOT EXISTS rm_invite_token_idx ON restaurant_members(invite_token);

ALTER TABLE restaurant_members ENABLE ROW LEVEL SECURITY;

-- Owner can do everything with their restaurant's members
CREATE POLICY "owner_all_members" ON restaurant_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM restaurants WHERE id = restaurant_id AND user_id = auth.uid())
  );

-- Members can read their own accepted membership
CREATE POLICY "member_read_own" ON restaurant_members
  FOR SELECT USING (user_id = auth.uid());

-- Members can update their own record (to accept invite)
CREATE POLICY "member_accept_invite" ON restaurant_members
  FOR UPDATE USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Allow accepted members to SELECT the restaurant they belong to
CREATE POLICY "members_can_read_restaurant" ON restaurants
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM restaurant_members
      WHERE restaurant_id = restaurants.id
        AND user_id = auth.uid()
        AND accepted_at IS NOT NULL
    )
  );
