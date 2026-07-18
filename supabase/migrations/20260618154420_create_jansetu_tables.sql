
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  total_complaints integer DEFAULT 0,
  resolved_complaints integer DEFAULT 0,
  avg_resolution_days numeric(4,1) DEFAULT 0,
  pending_count integer DEFAULT 0,
  escalated_count integer DEFAULT 0,
  trust_score integer DEFAULT 75,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_departments" ON departments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_departments" ON departments FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_departments" ON departments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_departments" ON departments FOR DELETE TO anon, authenticated USING (true);

INSERT INTO departments (name, total_complaints, resolved_complaints, avg_resolution_days, pending_count, escalated_count, trust_score) VALUES
  ('Electricity Department', 80, 60, 2.1, 14, 6, 82),
  ('Public Works Department', 65, 45, 3.4, 15, 5, 76),
  ('Water & Sanitation', 92, 70, 1.8, 17, 5, 80),
  ('Municipal Corporation', 110, 78, 2.9, 24, 8, 74),
  ('Road Maintenance', 55, 38, 4.2, 13, 4, 72),
  ('Health Department', 40, 35, 1.2, 4, 1, 90)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_number text UNIQUE NOT NULL,
  citizen_name text NOT NULL,
  citizen_phone text,
  raw_text text NOT NULL,
  language text DEFAULT 'en',
  issue_type text NOT NULL,
  summary text NOT NULL,
  urgency text NOT NULL CHECK (urgency IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  department text NOT NULL,
  area text NOT NULL,
  ward text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'ESCALATED')),
  photo_url text,
  similar_count integer DEFAULT 1,
  is_cluster_head boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_complaints" ON complaints FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_complaints" ON complaints FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_complaints" ON complaints FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_complaints" ON complaints FOR DELETE TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION generate_complaint_number()
RETURNS text AS $$
BEGIN
  RETURN 'JS-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 9999 + 1)::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

ALTER TABLE complaints ALTER COLUMN complaint_number SET DEFAULT generate_complaint_number();

INSERT INTO complaints (complaint_number, citizen_name, citizen_phone, raw_text, language, issue_type, summary, urgency, department, area, ward, status, similar_count, is_cluster_head) VALUES
  ('JS-20260618-0001', 'Ramesh Kumar', '9876543210', 'Street light kharab hai raat ko andhera rehta hai', 'hi', 'Street Light', 'Street light not working causing safety issues at night', 'HIGH', 'Electricity Department', 'Sector 5', 'Ward 12', 'ASSIGNED', 15, true),
  ('JS-20260618-0002', 'Priya Sharma', '9876543211', 'Road par bada pothole hai accident ho sakta hai', 'hi', 'Road Damage', 'Large pothole on main road posing accident risk', 'HIGH', 'Road Maintenance', 'MG Road', 'Ward 8', 'IN_PROGRESS', 8, true),
  ('JS-20260618-0003', 'Amit Singh', '9876543212', 'Garbage not collected for 5 days, very bad smell', 'en', 'Waste Management', 'Garbage collection delayed for 5+ days causing hygiene issues', 'MEDIUM', 'Water & Sanitation', 'Green Colony', 'Ward 3', 'PENDING', 12, true),
  ('JS-20260618-0004', 'Sunita Devi', '9876543213', 'Water supply band hai 2 din se', 'hi', 'Water Supply', 'Water supply disrupted for 2 days affecting daily life', 'CRITICAL', 'Water & Sanitation', 'Shastri Nagar', 'Ward 15', 'ESCALATED', 20, true),
  ('JS-20260618-0005', 'Vikram Patel', '9876543214', 'Park mein lights nahi hain, unsafe lagta hai', 'hi', 'Street Light', 'Park has no lighting making it unsafe in evenings', 'MEDIUM', 'Electricity Department', 'Nehru Park Area', 'Ward 7', 'RESOLVED', 3, false),
  ('JS-20260618-0006', 'Meera Joshi', '9876543215', 'Sewage water overflowing on street', 'en', 'Sewage', 'Sewage overflow on residential street causing health hazard', 'CRITICAL', 'Municipal Corporation', 'Lajpat Nagar', 'Ward 11', 'ASSIGNED', 7, true),
  ('JS-20260618-0007', 'Deepak Verma', '9876543216', 'Electricity wire dangling low over road, dangerous', 'en', 'Electricity Hazard', 'Low hanging electric wire over road is a safety hazard', 'CRITICAL', 'Electricity Department', 'Civil Lines', 'Ward 2', 'IN_PROGRESS', 5, true),
  ('JS-20260618-0008', 'Anita Rao', '9876543217', 'Public toilet very dirty and no water supply', 'en', 'Sanitation', 'Public toilet facility in poor condition without water', 'MEDIUM', 'Municipal Corporation', 'Bus Stand Area', 'Ward 9', 'RESOLVED', 4, false)
;
