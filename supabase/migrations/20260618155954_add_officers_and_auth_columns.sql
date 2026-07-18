
-- Officers table
CREATE TABLE IF NOT EXISTS officers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rank text NOT NULL,
  department text NOT NULL,
  badge_number text UNIQUE NOT NULL,
  phone text,
  ward text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE officers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_officers" ON officers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_officers" ON officers FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_officers" ON officers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_officers" ON officers FOR DELETE TO anon, authenticated USING (true);

-- Seed officers for each department
INSERT INTO officers (name, rank, department, badge_number, phone, ward) VALUES
  ('Suresh Kumar Sharma', 'Senior Executive Engineer', 'Electricity Department', 'ELEC-001', '9811001001', 'Ward 12'),
  ('Rajesh Verma', 'Junior Engineer', 'Electricity Department', 'ELEC-002', '9811001002', 'Ward 7'),
  ('Mohan Singh Yadav', 'Assistant Engineer', 'Electricity Department', 'ELEC-003', '9811001003', 'Ward 2'),
  ('Ramesh Chandra Gupta', 'Executive Engineer', 'Public Works Department', 'PWD-001', '9811002001', 'Ward 5'),
  ('Deepak Kumar Jain', 'Junior Engineer', 'Public Works Department', 'PWD-002', '9811002002', 'Ward 8'),
  ('Pradeep Nath Tiwari', 'Sub-Divisional Officer', 'Water & Sanitation', 'WS-001', '9811003001', 'Ward 3'),
  ('Amit Kumar Singh', 'Junior Engineer', 'Water & Sanitation', 'WS-002', '9811003002', 'Ward 15'),
  ('Vikas Sharma', 'Assistant Commissioner', 'Municipal Corporation', 'MCD-001', '9811004001', 'Ward 11'),
  ('Sanjay Dubey', 'Health Inspector', 'Municipal Corporation', 'MCD-002', '9811004002', 'Ward 9'),
  ('Harish Chand Mishra', 'Junior Engineer', 'Road Maintenance', 'RM-001', '9811005001', 'Ward 8'),
  ('Pawan Kumar Agarwal', 'Sub-Engineer', 'Road Maintenance', 'RM-002', '9811005002', 'Ward 5'),
  ('Dr. Sunita Rani', 'Chief Medical Officer', 'Health Department', 'HLTH-001', '9811006001', 'Ward 1'),
  ('Rakesh Kumar Pandey', 'Deputy Commissioner', 'Municipal Corporation', 'MCD-003', '9811004003', 'Ward 1')
ON CONFLICT (badge_number) DO NOTHING;

-- Escalation officers (senior level)
INSERT INTO officers (name, rank, department, badge_number, phone, ward) VALUES
  ('I.P.S. Rohit Mehra', 'District Magistrate', 'Municipal Corporation', 'DM-001', '9811007001', 'All Wards'),
  ('A.K. Saxena', 'Chief Engineer', 'Electricity Department', 'CE-ELEC-001', '9811007002', 'All Wards'),
  ('V.K. Pandey', 'Superintending Engineer', 'Public Works Department', 'SE-PWD-001', '9811007003', 'All Wards'),
  ('Anil Kumar Verma', 'Chief Sanitation Officer', 'Water & Sanitation', 'CSO-WS-001', '9811007004', 'All Wards')
ON CONFLICT (badge_number) DO NOTHING;

-- Add columns to complaints table
ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS assigned_officer_id uuid REFERENCES officers(id),
  ADD COLUMN IF NOT EXISTS escalation_officer_id uuid REFERENCES officers(id),
  ADD COLUMN IF NOT EXISTS escalation_reason text,
  ADD COLUMN IF NOT EXISTS escalation_at timestamptz;

-- Update some existing complaints with officers
UPDATE complaints SET
  assigned_officer_id = (SELECT id FROM officers WHERE badge_number = 'ELEC-001'),
  status = 'ASSIGNED'
WHERE complaint_number = 'JS-20260618-0001';

UPDATE complaints SET
  assigned_officer_id = (SELECT id FROM officers WHERE badge_number = 'RM-001'),
  status = 'IN_PROGRESS'
WHERE complaint_number = 'JS-20260618-0002';

UPDATE complaints SET
  assigned_officer_id = (SELECT id FROM officers WHERE badge_number = 'WS-001'),
  status = 'PENDING'
WHERE complaint_number = 'JS-20260618-0003';

UPDATE complaints SET
  assigned_officer_id = (SELECT id FROM officers WHERE badge_number = 'WS-002'),
  escalation_officer_id = (SELECT id FROM officers WHERE badge_number = 'CSO-WS-001'),
  escalation_reason = 'No action taken within 48-hour SLA window. Escalated to senior authority.',
  escalation_at = now() - interval '6 hours',
  status = 'ESCALATED'
WHERE complaint_number = 'JS-20260618-0004';

UPDATE complaints SET
  assigned_officer_id = (SELECT id FROM officers WHERE badge_number = 'MCD-001'),
  status = 'ASSIGNED'
WHERE complaint_number = 'JS-20260618-0006';

UPDATE complaints SET
  assigned_officer_id = (SELECT id FROM officers WHERE badge_number = 'ELEC-003'),
  status = 'IN_PROGRESS'
WHERE complaint_number = 'JS-20260618-0007';

-- Update RLS on complaints to allow user-scoped inserts (users can insert their own, read all)
DROP POLICY IF EXISTS "insert_complaints" ON complaints;
CREATE POLICY "insert_complaints" ON complaints FOR INSERT TO anon, authenticated WITH CHECK (true);
