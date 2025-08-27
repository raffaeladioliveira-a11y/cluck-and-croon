-- Add ranking columns to room_participants table
ALTER TABLE public.room_participants
ADD COLUMN IF NOT EXISTS correct_answers INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_answers INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_response_time DECIMAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_response_time DECIMAL DEFAULT 0;

-- Update avg_response_time calculation trigger function
CREATE OR REPLACE FUNCTION update_participant_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate average response time when total_answers > 0
  IF NEW.total_answers > 0 THEN
    NEW.avg_response_time = NEW.total_response_time / NEW.total_answers;
  ELSE
    NEW.avg_response_time = 0;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic avg_response_time calculation
DROP TRIGGER IF EXISTS trigger_update_participant_stats ON public.room_participants;
CREATE TRIGGER trigger_update_participant_stats
  BEFORE UPDATE ON public.room_participants
  FOR EACH ROW
  EXECUTE FUNCTION update_participant_stats();