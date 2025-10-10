-- Add foreign key relationship between planned_visits and parks
ALTER TABLE planned_visits
ADD CONSTRAINT planned_visits_park_id_fkey
FOREIGN KEY (park_id) REFERENCES parks(id) ON DELETE CASCADE;