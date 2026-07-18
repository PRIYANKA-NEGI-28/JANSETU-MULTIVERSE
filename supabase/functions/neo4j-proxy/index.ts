import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const NEO4J_HOST = "https://b69298cf.databases.neo4j.io";
const NEO4J_USER = "b69298cf";
const NEO4J_PASSWORD = "sDYjxeTVvM6jZcokCE994SvFnA8ryjB3g3Kc63Itvi4";
const NEO4J_DATABASE = "b69298cf";

async function runCypher(statement: string, parameters: Record<string, unknown> = {}) {
  const auth = btoa(`${NEO4J_USER}:${NEO4J_PASSWORD}`);
  const url = `${NEO4J_HOST}/db/${NEO4J_DATABASE}/query/v2`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${auth}`,
      "Accept": "application/json",
    },
    body: JSON.stringify({ statement, parameters }),
  });

  const body = await res.json();

  if (!res.ok) {
    const msg = body?.errors?.[0]?.message || JSON.stringify(body);
    throw new Error(`Neo4j ${res.status}: ${msg}`);
  }

  const fields: string[] = body.data?.fields ?? [];
  const rows: unknown[][] = body.data?.values ?? [];

  return rows.map((row) => {
    const obj: Record<string, unknown> = {};
    fields.forEach((f, i) => {
      // Aura query/v2 wraps nodes as {$type, _id, _elementId, properties}
      const val = row[i];
      if (val && typeof val === "object") {
        const v = val as Record<string, unknown>;
        obj[f] = v.properties ?? v;
      } else {
        obj[f] = val;
      }
    });
    return obj;
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const { action, params } = await req.json();
    let result: unknown;

    switch (action) {

      case "createComplaint": {
        const now = new Date().toISOString();
        await runCypher(`
          MERGE (cit:Citizen {id: $citizenId})
          SET cit.name = $citizenName, cit.phone = $citizenPhone
          CREATE (comp:Complaint {
            id: $complaintId,
            complaint_number: $complaintNumber,
            citizen_name: $citizenName,
            citizen_phone: $citizenPhone,
            raw_text: $rawText,
            language: $language,
            issue_type: $issueType,
            summary: $summary,
            urgency: $urgency,
            department: $department,
            area: $area,
            ward: $ward,
            status: 'PENDING',
            similar_count: 1,
            is_cluster_head: false,
            created_at: $now,
            updated_at: $now
          })
          MERGE (t:IssueType {name: $issueType})
          MERGE (loc:Location {area: $area, ward: $ward})
          MERGE (dept:Department {name: $department})
          CREATE (cit)-[:REPORTED]->(comp)
          CREATE (comp)-[:HAS_TYPE]->(t)
          CREATE (comp)-[:LOCATED_AT]->(loc)
          CREATE (comp)-[:ASSIGNED_TO]->(dept)
        `, {
          citizenId: params.citizenId || `anon_${Date.now()}`,
          citizenName: params.citizenName,
          citizenPhone: params.citizenPhone || "",
          complaintId: params.complaintId,
          complaintNumber: params.complaintNumber,
          rawText: params.rawText,
          language: params.language,
          issueType: params.issueType,
          summary: params.summary,
          urgency: params.urgency,
          department: params.department,
          area: params.area,
          ward: params.ward,
          now,
        });

        // Build SIMILAR_TO relationships with same type + location
        const similar = await runCypher(`
          MATCH (comp:Complaint {id: $complaintId})-[:HAS_TYPE]->(t:IssueType)
          MATCH (comp)-[:LOCATED_AT]->(loc:Location)
          MATCH (other:Complaint)-[:HAS_TYPE]->(t)
          MATCH (other)-[:LOCATED_AT]->(loc)
          WHERE other.id <> $complaintId
          RETURN other.id AS otherId LIMIT 10
        `, { complaintId: params.complaintId });

        if (similar.length > 0) {
          for (const s of similar) {
            await runCypher(`
              MATCH (c1:Complaint {id: $id1}), (c2:Complaint {id: $id2})
              MERGE (c1)-[:SIMILAR_TO]->(c2)
              MERGE (c2)-[:SIMILAR_TO]->(c1)
            `, { id1: params.complaintId, id2: s.otherId as string });
          }
          await runCypher(`
            MATCH (c:Complaint {id: $complaintId})-[:SIMILAR_TO]-(rel:Complaint)
            WITH c, count(rel) + 1 AS total
            SET c.similar_count = total
            WITH c, total
            MATCH (c)-[:SIMILAR_TO]-(rel:Complaint)
            SET rel.similar_count = total
          `, { complaintId: params.complaintId });
        }

        result = { complaint_number: params.complaintNumber };
        break;
      }

      case "getAllComplaints": {
        const rows = await runCypher(`
          MATCH (comp:Complaint)
          RETURN comp
          ORDER BY comp.created_at DESC
          LIMIT 200
        `);
        result = rows.map((r) => r.comp);
        break;
      }

      case "getComplaintByNumber": {
        const rows = await runCypher(`
          MATCH (comp:Complaint {complaint_number: $num})
          RETURN comp
        `, { num: params.complaint_number });

        if (!rows.length) { result = null; break; }

        const comp = rows[0].comp as Record<string, unknown>;
        const simRows = await runCypher(`
          MATCH (c:Complaint {complaint_number: $num})-[:SIMILAR_TO]-(o:Complaint)
          RETURN o LIMIT 5
        `, { num: params.complaint_number });

        result = { ...comp, similar_complaints: simRows.map((r) => r.o) };
        break;
      }

      case "updateStatus": {
        const now = new Date().toISOString();
        await runCypher(`
          MATCH (comp:Complaint {id: $id})
          SET comp.status = $status, comp.updated_at = $now
        `, { id: params.id, status: params.status, now });

        if (params.status === "ESCALATED") {
          await runCypher(`
            MATCH (comp:Complaint {id: $id})
            CREATE (esc:Escalation {reason: 'SLA breach', escalated_at: $now})
            CREATE (comp)-[:ESCALATED_TO]->(esc)
          `, { id: params.id, now });
        }
        result = { success: true };
        break;
      }

      case "getDepartmentStats": {
        const rows = await runCypher(`
          MATCH (dept:Department)<-[:ASSIGNED_TO]-(comp:Complaint)
          WITH dept.name AS name,
               count(comp) AS total,
               sum(CASE WHEN comp.status = 'RESOLVED' THEN 1 ELSE 0 END) AS resolved,
               sum(CASE WHEN comp.status = 'PENDING' THEN 1 ELSE 0 END) AS pending,
               sum(CASE WHEN comp.status = 'ESCALATED' THEN 1 ELSE 0 END) AS escalated
          RETURN name, total, resolved, pending, escalated,
                 CASE WHEN total > 0 THEN round(resolved * 100.0 / total) ELSE 0 END AS trust_score
          ORDER BY trust_score DESC
        `);
        result = rows.map((r) => ({
          id: r.name,
          name: r.name,
          total_complaints: r.total,
          resolved_complaints: r.resolved,
          pending_count: r.pending,
          escalated_count: r.escalated,
          trust_score: r.trust_score,
          avg_resolution_days: 2.1,
        }));
        break;
      }

      case "getGraphStats": {
        const [tot, clust, esc, spots] = await Promise.all([
          runCypher("MATCH (c:Complaint) RETURN count(c) AS total"),
          runCypher("MATCH (c:Complaint) WHERE c.similar_count > 1 RETURN count(c) AS clustered"),
          runCypher("MATCH (c:Complaint {status:'ESCALATED'}) RETURN count(c) AS escalated"),
          runCypher(`
            MATCH (loc:Location)<-[:LOCATED_AT]-(c:Complaint)
            RETURN loc.area AS area, count(c) AS cnt
            ORDER BY cnt DESC LIMIT 5
          `),
        ]);
        result = {
          total: (tot[0]?.total as number) ?? 0,
          clustered: (clust[0]?.clustered as number) ?? 0,
          escalated: (esc[0]?.escalated as number) ?? 0,
          hotspots: spots,
        };
        break;
      }

      case "runEscalationCheck": {
        const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const rows = await runCypher(`
          MATCH (comp:Complaint)
          WHERE comp.status IN ['PENDING','ASSIGNED'] AND comp.created_at < $cutoff
          SET comp.status = 'ESCALATED', comp.updated_at = $now
          RETURN count(comp) AS count
        `, { cutoff, now: new Date().toISOString() });
        result = { escalated_count: (rows[0]?.count as number) ?? 0 };
        break;
      }

      case "initSchema": {
        for (const q of [
          "CREATE CONSTRAINT complaint_id IF NOT EXISTS FOR (c:Complaint) REQUIRE c.id IS UNIQUE",
          "CREATE CONSTRAINT complaint_number IF NOT EXISTS FOR (c:Complaint) REQUIRE c.complaint_number IS UNIQUE",
          "CREATE CONSTRAINT citizen_id IF NOT EXISTS FOR (c:Citizen) REQUIRE c.id IS UNIQUE",
          "CREATE CONSTRAINT officer_badge IF NOT EXISTS FOR (o:Officer) REQUIRE o.badge_number IS UNIQUE",
          "CREATE INDEX complaint_status IF NOT EXISTS FOR (c:Complaint) ON (c.status)",
          "CREATE INDEX complaint_area IF NOT EXISTS FOR (c:Complaint) ON (c.area)",
          "CREATE INDEX complaint_dept IF NOT EXISTS FOR (c:Complaint) ON (c.department)",
          "CREATE INDEX officer_dept IF NOT EXISTS FOR (o:Officer) ON (o.department)",
        ]) {
          await runCypher(q).catch(() => {/* already exists */});
        }
        result = { success: true };
        break;
      }

      // Officer management
      case "createOfficer": {
        const officerId = `officer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const now = new Date().toISOString();
        await runCypher(`
          CREATE (o:Officer {
            id: $id,
            name: $name,
            rank: $rank,
            department: $department,
            badge_number: $badgeNumber,
            phone: $phone,
            ward: $ward,
            is_active: true,
            created_at: $now
          })
          WITH o
          MATCH (dept:Department {name: $department})
          MERGE (o)-[:WORKS_FOR]->(dept)
        `, {
          id: officerId,
          name: params.name,
          rank: params.rank,
          department: params.department,
          badgeNumber: params.badge_number,
          phone: params.phone || "",
          ward: params.ward || "",
          now,
        });
        result = { id: officerId, badge_number: params.badge_number };
        break;
      }

      case "getAllOfficers": {
        const rows = await runCypher(`
          MATCH (o:Officer)
          WHERE o.is_active = true
          RETURN o
          ORDER BY o.department, o.rank
        `);
        result = rows.map((r) => r.o);
        break;
      }

      case "getOfficersByDepartment": {
        const rows = await runCypher(`
          MATCH (o:Officer {department: $dept, is_active: true})
          RETURN o
          ORDER BY o.rank
        `, { dept: params.department });
        result = rows.map((r) => r.o);
        break;
      }

      case "assignOfficer": {
        const now = new Date().toISOString();
        await runCypher(`
          MATCH (comp:Complaint {id: $complaintId})
          MATCH (off:Officer {id: $officerId})
          SET comp.status = 'ASSIGNED', comp.updated_at = $now
          MERGE (comp)-[:HANDLED_BY]->(off)
        `, { complaintId: params.complaintId, officerId: params.officerId, now });
        result = { success: true };
        break;
      }

      case "escalateComplaint": {
        const now = new Date().toISOString();
        await runCypher(`
          MATCH (comp:Complaint {id: $complaintId})
          MATCH (off:Officer {id: $escalationOfficerId})
          SET comp.status = 'ESCALATED', comp.updated_at = $now,
              comp.escalation_reason = $reason, comp.escalation_at = $now
          MERGE (comp)-[:ESCALATED_TO_OFFICER]->(off)
        `, {
          complaintId: params.complaintId,
          escalationOfficerId: params.escalationOfficerId,
          reason: params.reason || "SLA breach",
          now,
        });
        result = { success: true };
        break;
      }

      case "getComplaintWithOfficers": {
        const rows = await runCypher(`
          MATCH (comp:Complaint {complaint_number: $num})
          OPTIONAL MATCH (comp)-[:HANDLED_BY]->(assigned:Officer)
          OPTIONAL MATCH (comp)-[:ESCALATED_TO_OFFICER]->(escalation:Officer)
          RETURN comp, assigned, escalation
        `, { num: params.complaint_number });

        if (!rows.length) { result = null; break; }

        const row = rows[0];
        result = {
          ...row.comp,
          assigned_officer: row.assigned || null,
          escalation_officer: row.escalation || null,
        };
        break;
      }

      case "seedOfficers": {
        const officers = [
          // ── Municipal Corporation - Electrical Division (9) ──
          { name: "Rajesh Kumar", rank: "Lineman", department: "Municipal Corporation - Electrical Division", badge: "ELEC-001", phone: "9811001001", ward: "Ward 1" },
          { name: "Mohan Lal", rank: "Assistant Lineman", department: "Municipal Corporation - Electrical Division", badge: "ELEC-002", phone: "9811001002", ward: "Ward 3" },
          { name: "Suresh Sharma", rank: "Junior Engineer", department: "Municipal Corporation - Electrical Division", badge: "ELEC-003", phone: "9811001003", ward: "Ward 5" },
          { name: "Dinesh Verma", rank: "Assistant Engineer", department: "Municipal Corporation - Electrical Division", badge: "ELEC-004", phone: "9811001004", ward: "Ward 7" },
          { name: "Pradeep Kumar", rank: "Executive Engineer", department: "Municipal Corporation - Electrical Division", badge: "ELEC-005", phone: "9811001005", ward: "Ward 9" },
          { name: "Ashok Jain", rank: "Superintending Engineer", department: "Municipal Corporation - Electrical Division", badge: "ELEC-006", phone: "9811001006", ward: "Ward 11" },
          { name: "R.K. Gupta", rank: "Chief Engineer", department: "Municipal Corporation - Electrical Division", badge: "ELEC-007", phone: "9811001007", ward: "All Wards" },
          { name: "S.K. Agarwal", rank: "Additional Chief Engineer", department: "Municipal Corporation - Electrical Division", badge: "ELEC-008", phone: "9811001008", ward: "All Wards" },
          { name: "A.K. Saxena", rank: "Chief Electrical Officer", department: "Municipal Corporation - Electrical Division", badge: "ELEC-009", phone: "9811001009", ward: "All Wards" },

          // ── Public Works Department (PWD) (9) ──
          { name: "Ramesh Yadav", rank: "Work Inspector", department: "Public Works Department (PWD)", badge: "PWD-001", phone: "9811002001", ward: "Ward 2" },
          { name: "Harish Singh", rank: "Sub-Engineer", department: "Public Works Department (PWD)", badge: "PWD-002", phone: "9811002002", ward: "Ward 4" },
          { name: "Deepak Jain", rank: "Junior Engineer", department: "Public Works Department (PWD)", badge: "PWD-003", phone: "9811002003", ward: "Ward 6" },
          { name: "Manoj Kumar", rank: "Assistant Engineer", department: "Public Works Department (PWD)", badge: "PWD-004", phone: "9811002004", ward: "Ward 8" },
          { name: "Ramesh Chandra", rank: "Executive Engineer", department: "Public Works Department (PWD)", badge: "PWD-005", phone: "9811002005", ward: "Ward 10" },
          { name: "V.K. Pandey", rank: "Superintending Engineer", department: "Public Works Department (PWD)", badge: "PWD-006", phone: "9811002006", ward: "Ward 12" },
          { name: "S.P. Singh", rank: "Chief Engineer", department: "Public Works Department (PWD)", badge: "PWD-007", phone: "9811002007", ward: "All Wards" },
          { name: "B.B. Verma", rank: "Additional Chief Engineer", department: "Public Works Department (PWD)", badge: "PWD-008", phone: "9811002008", ward: "All Wards" },
          { name: "N.K. Mishra", rank: "Engineer-in-Chief", department: "Public Works Department (PWD)", badge: "PWD-009", phone: "9811002009", ward: "All Wards" },

          // ── Municipal Corporation - Sanitation Department (9) ──
          { name: "Kamal Kumar", rank: "Sweeper Supervisor", department: "Municipal Corporation - Sanitation Department", badge: "SAN-001", phone: "9811003001", ward: "Ward 1" },
          { name: "Bablu Singh", rank: "Sanitation Inspector", department: "Municipal Corporation - Sanitation Department", badge: "SAN-002", phone: "9811003002", ward: "Ward 3" },
          { name: "Sanjay Dubey", rank: "Health Inspector", department: "Municipal Corporation - Sanitation Department", badge: "SAN-003", phone: "9811003003", ward: "Ward 5" },
          { name: "Vinod Kumar", rank: "Assistant Sanitation Officer", department: "Municipal Corporation - Sanitation Department", badge: "SAN-004", phone: "9811003004", ward: "Ward 7" },
          { name: "Mahesh Gupta", rank: "Sanitation Officer", department: "Municipal Corporation - Sanitation Department", badge: "SAN-005", phone: "9811003005", ward: "Ward 9" },
          { name: "Rakesh Pandey", rank: "Deputy Sanitation Commissioner", department: "Municipal Corporation - Sanitation Department", badge: "SAN-006", phone: "9811003006", ward: "Ward 11" },
          { name: "Anil Tiwari", rank: "Sanitation Commissioner", department: "Municipal Corporation - Sanitation Department", badge: "SAN-007", phone: "9811003007", ward: "All Wards" },
          { name: "Prakash Sharma", rank: "Additional Commissioner", department: "Municipal Corporation - Sanitation Department", badge: "SAN-008", phone: "9811003008", ward: "All Wards" },
          { name: "O.P. Mehta", rank: "Chief Sanitation Officer", department: "Municipal Corporation - Sanitation Department", badge: "SAN-009", phone: "9811003009", ward: "All Wards" },

          // ── Delhi Jal Board / Water Supply Department (8) ──
          { name: "Imran Khan", rank: "Pipe Fitter", department: "Delhi Jal Board / Water Supply Department", badge: "JAL-001", phone: "9811004001", ward: "Ward 2" },
          { name: "Salim Ahmed", rank: "Field Worker", department: "Delhi Jal Board / Water Supply Department", badge: "JAL-002", phone: "9811004002", ward: "Ward 4" },
          { name: "Amit Singh", rank: "Junior Engineer", department: "Delhi Jal Board / Water Supply Department", badge: "JAL-003", phone: "9811004003", ward: "Ward 6" },
          { name: "Pradeep Tiwari", rank: "Assistant Engineer", department: "Delhi Jal Board / Water Supply Department", badge: "JAL-004", phone: "9811004004", ward: "Ward 8" },
          { name: "Suresh Yadav", rank: "Executive Engineer", department: "Delhi Jal Board / Water Supply Department", badge: "JAL-005", phone: "9811004005", ward: "Ward 10" },
          { name: "R.D. Sharma", rank: "Superintending Engineer", department: "Delhi Jal Board / Water Supply Department", badge: "JAL-006", phone: "9811004006", ward: "Ward 12" },
          { name: "V.K. Mishra", rank: "Chief Engineer", department: "Delhi Jal Board / Water Supply Department", badge: "JAL-007", phone: "9811004007", ward: "All Wards" },
          { name: "G.K. Agarwal", rank: "Member (Water)", department: "Delhi Jal Board / Water Supply Department", badge: "JAL-008", phone: "9811004008", ward: "All Wards" },

          // ── Municipal Corporation - Sewerage Division (8) ──
          { name: "Mukesh Kumar", rank: "Drain Cleaner", department: "Municipal Corporation - Sewerage Division", badge: "SEW-001", phone: "9811005001", ward: "Ward 1" },
          { name: "Sonu Verma", rank: "Sewer Worker", department: "Municipal Corporation - Sewerage Division", badge: "SEW-002", phone: "9811005002", ward: "Ward 3" },
          { name: "Dharampal", rank: "Junior Engineer", department: "Municipal Corporation - Sewerage Division", badge: "SEW-003", phone: "9811005003", ward: "Ward 5" },
          { name: "Rajeev Kumar", rank: "Assistant Engineer", department: "Municipal Corporation - Sewerage Division", badge: "SEW-004", phone: "9811005004", ward: "Ward 7" },
          { name: "Naresh Singh", rank: "Executive Engineer", department: "Municipal Corporation - Sewerage Division", badge: "SEW-005", phone: "9811005005", ward: "Ward 9" },
          { name: "A.K. Dubey", rank: "Superintending Engineer", department: "Municipal Corporation - Sewerage Division", badge: "SEW-006", phone: "9811005006", ward: "Ward 11" },
          { name: "P.K. Jain", rank: "Chief Engineer", department: "Municipal Corporation - Sewerage Division", badge: "SEW-007", phone: "9811005007", ward: "All Wards" },
          { name: "S.K. Goyal", rank: "Sewerage Commissioner", department: "Municipal Corporation - Sewerage Division", badge: "SEW-008", phone: "9811005008", ward: "All Wards" },

          // ── Electricity Distribution Company (DISCOM) (9) ──
          { name: "Faisal Ali", rank: "Wireman", department: "Electricity Distribution Company (DISCOM)", badge: "DISC-001", phone: "9811006001", ward: "Ward 2" },
          { name: "Arjun Mehta", rank: "Assistant Wireman", department: "Electricity Distribution Company (DISCOM)", badge: "DISC-002", phone: "9811006002", ward: "Ward 4" },
          { name: "Gopal Das", rank: "Junior Engineer", department: "Electricity Distribution Company (DISCOM)", badge: "DISC-003", phone: "9811006003", ward: "Ward 6" },
          { name: "Naveen Sharma", rank: "Assistant Engineer", department: "Electricity Distribution Company (DISCOM)", badge: "DISC-004", phone: "9811006004", ward: "Ward 8" },
          { name: "Rajiv Khanna", rank: "Executive Engineer", department: "Electricity Distribution Company (DISCOM)", badge: "DISC-005", phone: "9811006005", ward: "Ward 10" },
          { name: "M.S. Bhatia", rank: "Superintending Engineer", department: "Electricity Distribution Company (DISCOM)", badge: "DISC-006", phone: "9811006006", ward: "Ward 12" },
          { name: "H.S. Brar", rank: "Chief Engineer", department: "Electricity Distribution Company (DISCOM)", badge: "DISC-007", phone: "9811006007", ward: "All Wards" },
          { name: "P.S. Gill", rank: "Director (Operations)", department: "Electricity Distribution Company (DISCOM)", badge: "DISC-008", phone: "9811006008", ward: "All Wards" },
          { name: "T.S. Randhawa", rank: "Managing Director", department: "Electricity Distribution Company (DISCOM)", badge: "DISC-009", phone: "9811006009", ward: "All Wards" },

          // ── Municipal Corporation - Health & Sanitation (8) ──
          { name: "Rekha Devi", rank: "Sanitary Worker", department: "Municipal Corporation - Health & Sanitation", badge: "HLT-001", phone: "9811007001", ward: "Ward 1" },
          { name: "Geeta Kumari", rank: "Health Assistant", department: "Municipal Corporation - Health & Sanitation", badge: "HLT-002", phone: "9811007002", ward: "Ward 3" },
          { name: "Dr. Anjali Singh", rank: "Health Officer", department: "Municipal Corporation - Health & Sanitation", badge: "HLT-003", phone: "9811007003", ward: "Ward 5" },
          { name: "Dr. Manish Gupta", rank: "Senior Medical Officer", department: "Municipal Corporation - Health & Sanitation", badge: "HLT-004", phone: "9811007004", ward: "Ward 7" },
          { name: "Dr. Sunita Rani", rank: "Chief Medical Officer", department: "Municipal Corporation - Health & Sanitation", badge: "HLT-005", phone: "9811007005", ward: "Ward 9" },
          { name: "Dr. Rakesh Kumar", rank: "Deputy Health Commissioner", department: "Municipal Corporation - Health & Sanitation", badge: "HLT-006", phone: "9811007006", ward: "Ward 11" },
          { name: "Dr. P.K. Sharma", rank: "Additional Health Commissioner", department: "Municipal Corporation - Health & Sanitation", badge: "HLT-007", phone: "9811007007", ward: "All Wards" },
          { name: "Dr. N.K. Arora", rank: "Health Commissioner", department: "Municipal Corporation - Health & Sanitation", badge: "HLT-008", phone: "9811007008", ward: "All Wards" },

          // ── Municipal Corporation - Parks & Gardens (8) ──
          { name: "Bhola Prasad", rank: "Gardener", department: "Municipal Corporation - Parks & Gardens", badge: "PKG-001", phone: "9811008001", ward: "Ward 2" },
          { name: "Ram Lakhan", rank: "Mali", department: "Municipal Corporation - Parks & Gardens", badge: "PKG-002", phone: "9811008002", ward: "Ward 4" },
          { name: "Shiv Kumar", rank: "Garden Supervisor", department: "Municipal Corporation - Parks & Gardens", badge: "PKG-003", phone: "9811008003", ward: "Ward 6" },
          { name: "Devendra Singh", rank: "Assistant Horticulture Officer", department: "Municipal Corporation - Parks & Gardens", badge: "PKG-004", phone: "9811008004", ward: "Ward 8" },
          { name: "R.M. Dubey", rank: "Horticulture Officer", department: "Municipal Corporation - Parks & Gardens", badge: "PKG-005", phone: "9811008005", ward: "Ward 10" },
          { name: "S.K. Tiwari", rank: "Deputy Director (Horticulture)", department: "Municipal Corporation - Parks & Gardens", badge: "PKG-006", phone: "9811008006", ward: "Ward 12" },
          { name: "A.K. Nigam", rank: "Director (Horticulture)", department: "Municipal Corporation - Parks & Gardens", badge: "PKG-007", phone: "9811008007", ward: "All Wards" },
          { name: "R.P. Shukla", rank: "Chief Horticulture Officer", department: "Municipal Corporation - Parks & Gardens", badge: "PKG-008", phone: "9811008008", ward: "All Wards" },

          // ── Health Department / Medical Services (9) ──
          { name: "Sunita Kumari", rank: "Staff Nurse", department: "Health Department / Medical Services", badge: "MED-001", phone: "9811009001", ward: "Ward 1" },
          { name: "Dr. Priya Sharma", rank: "Junior Doctor", department: "Health Department / Medical Services", badge: "MED-002", phone: "9811009002", ward: "Ward 3" },
          { name: "Dr. Ajay Verma", rank: "Medical Officer", department: "Health Department / Medical Services", badge: "MED-003", phone: "9811009003", ward: "Ward 5" },
          { name: "Dr. Neha Gupta", rank: "Senior Medical Officer", department: "Health Department / Medical Services", badge: "MED-004", phone: "9811009004", ward: "Ward 7" },
          { name: "Dr. Vivek Singh", rank: "Chief Medical Officer", department: "Health Department / Medical Services", badge: "MED-005", phone: "9811009005", ward: "Ward 9" },
          { name: "Dr. Anand Kumar", rank: "Deputy CMO", department: "Health Department / Medical Services", badge: "MED-006", phone: "9811009006", ward: "Ward 11" },
          { name: "Dr. Kavita Bansal", rank: "Additional Director", department: "Health Department / Medical Services", badge: "MED-007", phone: "9811009007", ward: "All Wards" },
          { name: "Dr. S.P. Agarwal", rank: "Director (Health Services)", department: "Health Department / Medical Services", badge: "MED-008", phone: "9811009008", ward: "All Wards" },
          { name: "Dr. R.N. Das", rank: "Principal Secretary (Health)", department: "Health Department / Medical Services", badge: "MED-009", phone: "9811009009", ward: "All Wards" },

          // ── Public Works Department (PWD) - Infrastructure (8) ──
          { name: "Lal Bahadur", rank: "Site Supervisor", department: "Public Works Department (PWD) - Infrastructure", badge: "INFRA-001", phone: "9811010001", ward: "Ward 2" },
          { name: "Guddu Singh", rank: "Sub-Engineer", department: "Public Works Department (PWD) - Infrastructure", badge: "INFRA-002", phone: "9811010002", ward: "Ward 4" },
          { name: "Rajesh Malhotra", rank: "Junior Engineer", department: "Public Works Department (PWD) - Infrastructure", badge: "INFRA-003", phone: "9811010003", ward: "Ward 6" },
          { name: "Vipin Kumar", rank: "Assistant Engineer", department: "Public Works Department (PWD) - Infrastructure", badge: "INFRA-004", phone: "9811010004", ward: "Ward 8" },
          { name: "Sanjay Goel", rank: "Executive Engineer", department: "Public Works Department (PWD) - Infrastructure", badge: "INFRA-005", phone: "9811010005", ward: "Ward 10" },
          { name: "M.K. Srivastava", rank: "Superintending Engineer", department: "Public Works Department (PWD) - Infrastructure", badge: "INFRA-006", phone: "9811010006", ward: "Ward 12" },
          { name: "D.K. Bose", rank: "Chief Engineer", department: "Public Works Department (PWD) - Infrastructure", badge: "INFRA-007", phone: "9811010007", ward: "All Wards" },
          { name: "R.C. Sinha", rank: "Engineer-in-Chief", department: "Public Works Department (PWD) - Infrastructure", badge: "INFRA-008", phone: "9811010008", ward: "All Wards" },

          // ── Traffic Police / Municipal Corporation (9) ──
          { name: "Const. Ajay Kumar", rank: "Traffic Constable", department: "Traffic Police / Municipal Corporation", badge: "TRF-001", phone: "9811011001", ward: "Ward 1" },
          { name: "HC Suresh Pal", rank: "Head Constable", department: "Traffic Police / Municipal Corporation", badge: "TRF-002", phone: "9811011002", ward: "Ward 3" },
          { name: "ASI Rameshwar", rank: "Assistant Sub-Inspector", department: "Traffic Police / Municipal Corporation", badge: "TRF-003", phone: "9811011003", ward: "Ward 5" },
          { name: "SI Dinesh Pratap", rank: "Sub-Inspector", department: "Traffic Police / Municipal Corporation", badge: "TRF-004", phone: "9811011004", ward: "Ward 7" },
          { name: "Insp. Vikas Tomar", rank: "Inspector", department: "Traffic Police / Municipal Corporation", badge: "TRF-005", phone: "9811011005", ward: "Ward 9" },
          { name: "DSP Anil Rana", rank: "Deputy Superintendent", department: "Traffic Police / Municipal Corporation", badge: "TRF-006", phone: "9811011006", ward: "Ward 11" },
          { name: "SP R.K. Chauhan", rank: "Superintendent of Police", department: "Traffic Police / Municipal Corporation", badge: "TRF-007", phone: "9811011007", ward: "All Wards" },
          { name: "SSP M.S. Rawat", rank: "Senior SP", department: "Traffic Police / Municipal Corporation", badge: "TRF-008", phone: "9811011008", ward: "All Wards" },
          { name: "IG Pankaj Singh", rank: "Inspector General", department: "Traffic Police / Municipal Corporation", badge: "TRF-009", phone: "9811011009", ward: "All Wards" },

          // ── Municipal Corporation - Veterinary Services (8) ──
          { name: "Mohan Das", rank: "Animal Catcher", department: "Municipal Corporation - Veterinary Services", badge: "VET-001", phone: "9811012001", ward: "Ward 2" },
          { name: "Kishore Lal", rank: "Animal Handler", department: "Municipal Corporation - Veterinary Services", badge: "VET-002", phone: "9811012002", ward: "Ward 4" },
          { name: "Dr. Pooja Verma", rank: "Veterinary Assistant", department: "Municipal Corporation - Veterinary Services", badge: "VET-003", phone: "9811012003", ward: "Ward 6" },
          { name: "Dr. Arvind Kumar", rank: "Veterinary Officer", department: "Municipal Corporation - Veterinary Services", badge: "VET-004", phone: "9811012004", ward: "Ward 8" },
          { name: "Dr. Seema Gupta", rank: "Senior Veterinary Officer", department: "Municipal Corporation - Veterinary Services", badge: "VET-005", phone: "9811012005", ward: "Ward 10" },
          { name: "Dr. B.K. Singh", rank: "Chief Veterinary Officer", department: "Municipal Corporation - Veterinary Services", badge: "VET-006", phone: "9811012006", ward: "Ward 12" },
          { name: "Dr. A.K. Jain", rank: "Deputy Director (Veterinary)", department: "Municipal Corporation - Veterinary Services", badge: "VET-007", phone: "9811012007", ward: "All Wards" },
          { name: "Dr. R.P. Yadav", rank: "Director (Veterinary Services)", department: "Municipal Corporation - Veterinary Services", badge: "VET-008", phone: "9811012008", ward: "All Wards" },

          // ── Municipal Corporation - Health Department (Vector Control) (8) ──
          { name: "Ramesh Kumar", rank: "Fogging Operator", department: "Municipal Corporation - Health Department", badge: "VC-001", phone: "9811013001", ward: "Ward 1" },
          { name: "Suresh Chand", rank: "Field Assistant", department: "Municipal Corporation - Health Department", badge: "VC-002", phone: "9811013002", ward: "Ward 3" },
          { name: "Vinod Khatri", rank: "Vector Control Inspector", department: "Municipal Corporation - Health Department", badge: "VC-003", phone: "9811013003", ward: "Ward 5" },
          { name: "Dr. Rajesh Kumar", rank: "Assistant Health Officer", department: "Municipal Corporation - Health Department", badge: "VC-004", phone: "9811013004", ward: "Ward 7" },
          { name: "Dr. Anil Sharma", rank: "Health Officer", department: "Municipal Corporation - Health Department", badge: "VC-005", phone: "9811013005", ward: "Ward 9" },
          { name: "Dr. Kavita Rani", rank: "Senior Health Officer", department: "Municipal Corporation - Health Department", badge: "VC-006", phone: "9811013006", ward: "Ward 11" },
          { name: "Dr. S.K. Gupta", rank: "Chief Vector Control Officer", department: "Municipal Corporation - Health Department", badge: "VC-007", phone: "9811013007", ward: "All Wards" },
          { name: "Dr. N.P. Singh", rank: "Additional Municipal Commissioner (Health)", department: "Municipal Corporation - Health Department", badge: "VC-008", phone: "9811013008", ward: "All Wards" },

          // ── Municipal Corporation - Enforcement (8) ──
          { name: "Tejpal Singh", rank: "Enforcement Constable", department: "Municipal Corporation - Enforcement", badge: "ENF-001", phone: "9811014001", ward: "Ward 2" },
          { name: "Rajendra Kumar", rank: "Enforcement Inspector", department: "Municipal Corporation - Enforcement", badge: "ENF-002", phone: "9811014002", ward: "Ward 4" },
          { name: "Mukesh Tiwari", rank: "Zonal Inspector", department: "Municipal Corporation - Enforcement", badge: "ENF-003", phone: "9811014003", ward: "Ward 6" },
          { name: "Satish Kumar", rank: "Assistant Enforcement Officer", department: "Municipal Corporation - Enforcement", badge: "ENF-004", phone: "9811014004", ward: "Ward 8" },
          { name: "Arun Kumar", rank: "Enforcement Officer", department: "Municipal Corporation - Enforcement", badge: "ENF-005", phone: "9811014005", ward: "Ward 10" },
          { name: "D.K. Sharma", rank: "Deputy Enforcement Commissioner", department: "Municipal Corporation - Enforcement", badge: "ENF-006", phone: "9811014006", ward: "Ward 12" },
          { name: "S.P. Verma", rank: "Additional Commissioner (Enforcement)", department: "Municipal Corporation - Enforcement", badge: "ENF-007", phone: "9811014007", ward: "All Wards" },
          { name: "R.K. Gupta", rank: "Enforcement Commissioner", department: "Municipal Corporation - Enforcement", badge: "ENF-008", phone: "9811014008", ward: "All Wards" },

          // ── Food & Civil Supplies Department (8) ──
          { name: "Kamal Sharma", rank: "Field Assistant", department: "Food & Civil Supplies Department", badge: "FCS-001", phone: "9811015001", ward: "Ward 1" },
          { name: "Rajeev Kumar", rank: "Food Inspector", department: "Food & Civil Supplies Department", badge: "FCS-002", phone: "9811015002", ward: "Ward 3" },
          { name: "Suresh Pal", rank: "Senior Food Inspector", department: "Food & Civil Supplies Department", badge: "FCS-003", phone: "9811015003", ward: "Ward 5" },
          { name: "Vinod Kumar", rank: "Assistant Supply Officer", department: "Food & Civil Supplies Department", badge: "FCS-004", phone: "9811015004", ward: "Ward 7" },
          { name: "A.K. Dwivedi", rank: "Supply Officer", department: "Food & Civil Supplies Department", badge: "FCS-005", phone: "9811015005", ward: "Ward 9" },
          { name: "M.K. Shukla", rank: "Deputy Director (Supply)", department: "Food & Civil Supplies Department", badge: "FCS-006", phone: "9811015006", ward: "Ward 11" },
          { name: "R.D. Singh", rank: "Joint Commissioner (Food)", department: "Food & Civil Supplies Department", badge: "FCS-007", phone: "9811015007", ward: "All Wards" },
          { name: "N.K. Verma", rank: "Commissioner (Food & Civil Supplies)", department: "Food & Civil Supplies Department", badge: "FCS-008", phone: "9811015008", ward: "All Wards" },

          // ── Municipal Corporation - General Administration (8) ──
          { name: "Pooja Sharma", rank: "Clerk", department: "Municipal Corporation - General Administration", badge: "GA-001", phone: "9811016001", ward: "Ward 2" },
          { name: "Amit Verma", rank: "Assistant Clerk", department: "Municipal Corporation - General Administration", badge: "GA-002", phone: "9811016002", ward: "Ward 4" },
          { name: "Neha Singh", rank: "Office Superintendent", department: "Municipal Corporation - General Administration", badge: "GA-003", phone: "9811016003", ward: "Ward 6" },
          { name: "Rajesh Kumar", rank: "Assistant Director", department: "Municipal Corporation - General Administration", badge: "GA-004", phone: "9811016004", ward: "Ward 8" },
          { name: "S.K. Jain", rank: "Deputy Municipal Commissioner", department: "Municipal Corporation - General Administration", badge: "GA-005", phone: "9811016005", ward: "Ward 10" },
          { name: "A.K. Mishra", rank: "Additional Municipal Commissioner", department: "Municipal Corporation - General Administration", badge: "GA-006", phone: "9811016006", ward: "Ward 12" },
          { name: "V.K. Sharma", rank: "Municipal Commissioner", department: "Municipal Corporation - General Administration", badge: "GA-007", phone: "9811016007", ward: "All Wards" },
          { name: "Rohit Mehra", rank: "District Magistrate", department: "Municipal Corporation - General Administration", badge: "GA-008", phone: "9811016008", ward: "All Wards" },
        ];

        const now = new Date().toISOString();
        for (const o of officers) {
          const officerId = `officer_${o.badge.toLowerCase().replace(/-/g, '_')}`;
          await runCypher(`
            MERGE (off:Officer {badge_number: $badge})
            SET off.id = $id, off.name = $name, off.rank = $rank,
                off.department = $department, off.phone = $phone, off.ward = $ward,
                off.is_active = true, off.created_at = $now
            WITH off
            MATCH (dept:Department {name: $department})
            MERGE (off)-[:WORKS_FOR]->(dept)
          `, {
            id: officerId,
            name: o.name,
            rank: o.rank,
            department: o.department,
            badge: o.badge,
            phone: o.phone,
            ward: o.ward,
            now,
          }).catch(() => {/* skip duplicates */});
        }
        result = { seeded: officers.length };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify({ data: result, error: null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ data: null, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
