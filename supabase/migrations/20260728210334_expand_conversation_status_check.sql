-- expand_conversation_status_check
--
-- The original check constraint only allowed GCR booking statuses.
-- Expanding to include the CS agent conversation statuses used by Acuarium
-- and future CS-engine clients: open, assigned, resolved, archived.

ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_status_check;

ALTER TABLE conversations
  ADD CONSTRAINT conversations_status_check
  CHECK (status = ANY (ARRAY[
    'active'::text, 'booked'::text, 'cancelled'::text,
    'open'::text, 'assigned'::text, 'resolved'::text, 'archived'::text
  ]));
