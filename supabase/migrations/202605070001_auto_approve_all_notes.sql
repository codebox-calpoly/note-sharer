-- Auto-approve all pending notes
-- This migration approves all notes that are currently pending
-- and ensures future notes are auto-approved

UPDATE public.resources
SET status = 'active'
WHERE status = 'pending';

-- Add comment documenting the change
COMMENT ON COLUMN public.resources.status IS 'Resource status: pending (deprecated - all notes now auto-approved), active (approved and visible)';
