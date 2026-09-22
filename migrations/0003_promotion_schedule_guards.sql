CREATE TRIGGER promotions_no_overlap_insert
BEFORE INSERT ON promotions
WHEN NEW.paused = 0
  AND EXISTS (
    SELECT 1 FROM promotions existing
    WHERE existing.paused = 0
      AND existing.start_at < NEW.end_at
      AND existing.end_at > NEW.start_at
  )
BEGIN
  SELECT RAISE(ABORT, 'PROMOTION_SCHEDULE_OVERLAP');
END;

CREATE TRIGGER promotions_no_overlap_update
BEFORE UPDATE OF start_at, end_at, paused ON promotions
WHEN NEW.paused = 0
  AND EXISTS (
    SELECT 1 FROM promotions existing
    WHERE existing.id != NEW.id
      AND existing.paused = 0
      AND existing.start_at < NEW.end_at
      AND existing.end_at > NEW.start_at
  )
BEGIN
  SELECT RAISE(ABORT, 'PROMOTION_SCHEDULE_OVERLAP');
END;
