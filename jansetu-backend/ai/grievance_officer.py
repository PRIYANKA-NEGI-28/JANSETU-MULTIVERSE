"""
Grievance Officer AI Pipeline
------------------------------
Processes raw citizen complaint text, extracts actionable facts (Who/What/Where/When/Remedy),
and generates a structured 3-section output:
  Section 1: Complaint Analysis Report
  Section 2: Formal English Grievance Draft
  Section 3: Formal Hindi Grievance Draft (औपचारिक शिकायत प्रारूप)

STRICT ZERO-CREATIVITY POLICY: Never invent, assume, or extrapolate data.
Missing details → "[INSERT DETAIL HERE]" placeholders.
"""

import sys
import json
import argparse
import os
import re
from datetime import datetime

# Force UTF-8 encoding for stdout/stderr on Windows
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')
if sys.stderr.encoding != 'utf-8':
    sys.stderr.reconfigure(encoding='utf-8')

# Try to import llama-cpp-python for GGUF model execution
try:
    from llama_cpp import Llama
    HAS_LLAMA_CPP = True
except ImportError:
    HAS_LLAMA_CPP = False


# ─── DEPARTMENT CLASSIFICATION RULES ─────────────────────────────────────────
ISSUE_RULES = [
    {
        "keywords": ["street light", "light kharab", "lamp", "bijli light", "andhera", "dark", "lighting", "bulb", "streetlight", "light not working", "light band", "light nhi"],
        "issue_type": "Street Light Failure",
        "department": "Municipal Corporation - Electrical Division",
        "department_hi": "नगर निगम - विद्युत प्रभाग",
        "base_urgency": "HIGH",
    },
    {
        "keywords": ["pothole", "road damage", "road kharab", "sadak", "crack", "broken road", "gaddha", "road repair", "damaged road", "gaddhe", "road mein gaddha", "potholes", "road surface"],
        "issue_type": "Road Damage / Pothole",
        "department": "Public Works Department (PWD)",
        "department_hi": "लोक निर्माण विभाग (PWD)",
        "base_urgency": "HIGH",
    },
    {
        "keywords": ["garbage", "kachra", "waste", "trash", "dump", "safai", "clean", "kachra uta", "garbage collection", "dustbin", "garbage dump", "kooda", "solid waste"],
        "issue_type": "Waste Management / Sanitation",
        "department": "Municipal Corporation - Sanitation Department",
        "department_hi": "नगर निगम - स्वच्छता विभाग",
        "base_urgency": "MEDIUM",
    },
    {
        "keywords": ["water", "paani", "supply band", "no water", "pani nahi", "leakage", "pipe", "water supply", "pani aata", "water pipeline", "water leakage", "tanker", "drinking water", "water problem", "water connection"],
        "issue_type": "Water Supply Disruption",
        "department": "Delhi Jal Board / Water Supply Department",
        "department_hi": "दिल्ली जल बोर्ड / जल आपूर्ति विभाग",
        "base_urgency": "HIGH",
    },
    {
        "keywords": ["sewage", "drainage", "nali", "overflow", "drain block", "sewer", "nali jam", "sewer line", "gutter block", "sewerage", "nali overflow"],
        "issue_type": "Sewage / Drainage Blockage",
        "department": "Municipal Corporation - Sewerage Division",
        "department_hi": "नगर निगम - मलनिकासी प्रभाग",
        "base_urgency": "CRITICAL",
    },
    {
        "keywords": ["electricity", "bijli", "wire", "current", "power cut", "transformer", "electric", "bijli ka taar", "hanging wire", "live wire", "shock", "danger wire", "power failure"],
        "issue_type": "Electricity Hazard",
        "department": "Electricity Distribution Company (DISCOM)",
        "department_hi": "विद्युत वितरण कंपनी (DISCOM)",
        "base_urgency": "CRITICAL",
    },
    {
        "keywords": ["toilet", "sanitation", "shauchalay", "public toilet", "hygiene", "shauchalaya", "community toilet", "cleanliness", "swachhata"],
        "issue_type": "Public Sanitation / Toilet",
        "department": "Municipal Corporation - Health & Sanitation",
        "department_hi": "नगर निगम - स्वास्थ्य एवं स्वच्छता विभाग",
        "base_urgency": "MEDIUM",
    },
    {
        "keywords": ["hospital", "health", "medical", "doctor", "medicine", "health center", "dispensary", "clinic", "treatment"],
        "issue_type": "Healthcare Facility",
        "department": "Health Department / Medical Services",
        "department_hi": "स्वास्थ्य विभाग / चिकित्सा सेवाएं",
        "base_urgency": "HIGH",
    },
    {
        "keywords": ["traffic", "signal", "jam", "traffic light", "accident", "speed breaker", "traffic signal", "traffic police", "road marking", "zebra crossing"],
        "issue_type": "Traffic & Road Safety",
        "department": "Traffic Police / Municipal Corporation",
        "department_hi": "यातायात पुलिस / नगर निगम",
        "base_urgency": "MEDIUM",
    },
    {
        "keywords": ["stray", "dog", "monkey", "animal", "stray dog", "kutta", "bandar", "stray animals", "dog menace", "animal attack", "kutte"],
        "issue_type": "Stray Animal Menace",
        "department": "Municipal Corporation - Veterinary Services",
        "department_hi": "नगर निगम - पशु चिकित्सा सेवाएं",
        "base_urgency": "MEDIUM",
    },
    {
        "keywords": ["mosquito", "dengue", "malaria", "fogging", "machhar", "mosquito breeding", "pest control"],
        "issue_type": "Vector / Pest Control",
        "department": "Municipal Corporation - Health Department",
        "department_hi": "नगर निगम - स्वास्थ्य विभाग",
        "base_urgency": "HIGH",
    },
    {
        "keywords": ["encroachment", "illegal", "occupation", "zabardasti", "illegal construction", "road pe dukan", "footpath pe"],
        "issue_type": "Illegal Encroachment",
        "department": "Municipal Corporation - Enforcement",
        "department_hi": "नगर निगम - प्रवर्तन विभाग",
        "base_urgency": "MEDIUM",
    },
    {
        "keywords": ["park", "garden", "tree", "bench", "playground", "park maintenance"],
        "issue_type": "Public Park / Green Space",
        "department": "Municipal Corporation - Parks & Gardens",
        "department_hi": "नगर निगम - उद्यान एवं वन विभाग",
        "base_urgency": "LOW",
    },
    {
        "keywords": ["bridge", "flyover", "underpass", "construction", "building", "bridge repair", "flyover repair"],
        "issue_type": "Infrastructure Damage",
        "department": "Public Works Department (PWD) - Infrastructure",
        "department_hi": "लोक निर्माण विभाग (PWD) - अवसंरचना",
        "base_urgency": "HIGH",
    },
    {
        "keywords": ["ration", "ration card", "aadhaar", "ration dukandar", "pds", "public distribution", "ration shop"],
        "issue_type": "Public Distribution System",
        "department": "Food & Civil Supplies Department",
        "department_hi": "खाद्य एवं नागरिक आपूर्ति विभाग",
        "base_urgency": "MEDIUM",
    },
]

RISK_ESCALATORS = [
    "accident", "dangerous", "hazard", "unsafe", "death", "injury", "fire", "emergency",
    "urgent", "critical", "khatarnak", "tehlik", "life threat", "serious", "immediate",
    "bahut kharab", "accident hua", "injury hui", "bachche", "children", "school",
]

# Conversational fluff to strip
FLUFF_PATTERNS = [
    r"\bplease help\b", r"\bplease\b", r"\bkindly\b", r"\bi am so tired\b",
    r"\bi am fed up\b", r"\bkya karun\b", r"\bhelp me\b", r"\bkoi sun lo\b",
    r"\bthank you\b", r"\bdhanyavaad\b", r"\bsuniye\b", r"\bsuno\b",
    r"\bbhai\b", r"\byaar\b", r"\bbhaisahab\b", r"\bmadam\b", r"\bsir\b",
    r"\barrey\b", r"\bhello\b", r"\bhi\b", r"\bnamaste\b",
]


# ─── FACT EXTRACTION (REGEX-BASED FALLBACK) ──────────────────────────────────

def strip_fluff(text: str) -> str:
    """Remove conversational/emotional fluff, keep actionable content."""
    cleaned = text
    for pattern in FLUFF_PATTERNS:
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)
    # Collapse whitespace
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def extract_dates(text: str) -> str:
    """Extract date patterns from text."""
    patterns = [
        r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b",
        r"\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\s+\d{2,4}\b",
        r"\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{2,4}\b",
        r"\b\d+\s+(?:din|days?|weeks?|months?|hafte|mahine)\s+(?:se|ago|pehle|since|for|back)\b",
        r"\bfor\s+\d+\s+(?:din|days?|weeks?|months?|hafte|mahine|years?)\b",
        r"\b\d+\s+(?:din|days?|weeks?|months?|hafte|mahine|years?)\b",
        r"\blast\s+(?:week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b",
        r"\byesterday\b", r"\btoday\b", r"\btomorrow\b",
        r"\bkal\b", r"\bparson\b", r"\baaj\b",
    ]
    found = []
    lower = text.lower()
    for pat in patterns:
        matches = re.findall(pat, lower, re.IGNORECASE)
        found.extend(matches)
    # Deduplicate while preserving order
    seen = set()
    unique = []
    for item in found:
        if item not in seen:
            seen.add(item)
            unique.append(item)
    if unique:
        return "; ".join(unique)
    return "[INSERT DATE/TIMELINE HERE]"


def extract_location(text: str) -> str:
    """Extract location references from text."""
    patterns = [
        r"(?:near|at|in|behind|front of|opposite|beside|next to|behind|across from)\s+([A-Z][a-zA-Z\s]+(?:road|street|market|colony|nagar|park|chowk|sector|block|ward|area|circle|gate|mohalla|gali|lane|bazaar|marg|path|vihar|enclave|puram))",
        r"(?:sector|ward|block)\s*[-]?\s*\d+[a-zA-Z]?",
        r"(?:mohalle|mohalla|gali|colony|nagar|vihar|enclave|puram|sector)\s+[a-zA-Z0-9\s]+",
        r"(?:pin(?:code)?)\s*[-:]?\s*\d{6}",
    ]
    found = []
    for pat in patterns:
        matches = re.findall(pat, text, re.IGNORECASE)
        found.extend(matches)
    if found:
        return "; ".join([m.strip() for m in found])
    
    # Try simpler location keywords
    location_keywords = ["road", "street", "market", "colony", "nagar", "park", "chowk",
                         "sector", "block", "ward", "area", "mohalla", "gali", "lane",
                         "bazaar", "marg", "vihar", "enclave", "puram"]
    words = text.split()
    for i, word in enumerate(words):
        if word.lower() in location_keywords:
            start = max(0, i - 2)
            end = min(len(words), i + 2)
            loc = " ".join(words[start:end])
            found.append(loc.strip())
    
    if found:
        return "; ".join(found)
    return "[INSERT LOCATION HERE]"


def extract_names(text: str) -> list:
    """Extract person names referenced in the text."""
    patterns = [
        r"(?:my name is|mera naam|i am|main)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)",
        r"(?:mr\.|mrs\.|ms\.|shri|smt\.?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)",
    ]
    found = []
    for pat in patterns:
        matches = re.findall(pat, text, re.IGNORECASE)
        found.extend(matches)
    return found


def extract_remedy(text: str) -> list:
    """Extract what the citizen wants done."""
    patterns = [
        r"(?:should|must|need to|chahiye|karo|kardo|kijiye|please|repair|fix|remove|clean|install|replace|investigate|action)\s+(.+?)(?:[.,!]|$)",
    ]
    found = []
    lower = text.lower()
    remedy_keywords = ["repair", "fix", "remove", "clean", "install", "replace", "investigate",
                        "action", "theek karo", "hatao", "saaf karo", "lagao", "badlo",
                        "jaanch karo", "karvao", "banwao"]
    
    for keyword in remedy_keywords:
        if keyword in lower:
            # Get the sentence containing this keyword
            sentences = re.split(r'[.!?]', text)
            for sent in sentences:
                if keyword in sent.lower():
                    found.append(sent.strip())
                    break
    
    return found if found else []


def classify_issue(text: str) -> dict:
    """Classify the complaint type using keyword matching."""
    lower = text.lower()
    best_match = None
    best_score = 0
    
    for rule in ISSUE_RULES:
        score = 0
        for keyword in rule["keywords"]:
            if keyword.lower() in lower:
                score += 1
        if score > best_score:
            best_score = score
            best_match = rule
    
    if best_match:
        return best_match
    
    return {
        "issue_type": "General Civic Complaint",
        "department": "Municipal Corporation - General Administration",
        "department_hi": "नगर निगम - सामान्य प्रशासन",
        "base_urgency": "MEDIUM",
    }


def compute_urgency(base: str, text: str) -> str:
    """Compute urgency, escalating if risk keywords are present."""
    lower = text.lower()
    risk_count = sum(1 for r in RISK_ESCALATORS if r in lower)
    
    levels = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    idx = levels.index(base)
    
    if risk_count >= 2 and base != "CRITICAL":
        idx = min(idx + 1, 3)
    
    return levels[idx]


# ─── LLM-BASED EXTRACTION (WHEN MODEL AVAILABLE) ─────────────────────────────

def extract_facts_via_llm(raw_text: str, model_path: str) -> dict:
    """Use local Qwen GGUF model to intelligently extract facts from messy text."""
    if not HAS_LLAMA_CPP or not os.path.exists(model_path):
        return None
    
    try:
        llm = Llama(
            model_path=model_path,
            n_ctx=2048,
            n_threads=6,
            verbose=False
        )
        
        extraction_prompt = f"""You are a strict fact-extraction engine. Extract ONLY the facts present in this citizen complaint text. Do NOT invent or assume any data.

TEXT: "{raw_text}"

Extract and return ONLY in this exact JSON format:
{{
  "incident_details": "<what happened, chronologically>",
  "location": "<specific location mentioned or null>",
  "date_timeline": "<any dates or time references or null>",
  "affected_parties": "<who is affected or null>",
  "remedy_sought": "<what action the citizen wants or null>"
}}

Return null for any field where the information is NOT explicitly present in the text. Do not guess."""

        response = llm.create_chat_completion(
            messages=[
                {"role": "system", "content": "You extract facts from text. Return only valid JSON. Never invent data."},
                {"role": "user", "content": extraction_prompt}
            ],
            max_tokens=512,
            temperature=0.1  # Very low temperature for factual extraction
        )
        
        result_text = response['choices'][0]['message']['content'].strip()
        
        # Try to parse JSON from the response
        json_match = re.search(r'\{[^{}]*\}', result_text, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        
    except Exception as e:
        print(f"LLM extraction error (falling back to regex): {e}", file=sys.stderr)
    
    return None


# ─── TEMPLATE GENERATORS ─────────────────────────────────────────────────────

def generate_english_draft(analysis: dict) -> str:
    """Generate formal English grievance draft from extracted data."""
    today = datetime.now().strftime("%d %B %Y")
    
    return f"""SUBJECT: FORMAL PUBLIC GRIEVANCE REGARDING {analysis['nature_of_grievance'].upper()}

Date: {today}

To,
The Competent Grievance Redressal Authority / Head of Department,
{analysis['target_department']},
{analysis['department_address']}

Sir/Madam,

I am writing to formally lodge a grievance regarding {analysis['nature_of_grievance']}.

The relevant factual details are outlined below:

1. Details of Incident/Issue: {analysis['incident_details']}

2. Location of Occurrence: {analysis['location']}

3. Date/Timeline of Occurrence: {analysis['date_timeline']}

4. Impact/Grievance Details: {analysis['impact_details']}

Therefore, I request the competent authority to take immediate corrective action, specifically:
{analysis['remedy_text']}

I request that this grievance be acknowledged within 7 working days and appropriate corrective action be initiated forthwith. Failure to address this matter may necessitate escalation to higher authorities and/or filing of a formal complaint under the applicable civic grievance redressal mechanism.

Yours faithfully,

{analysis['applicant_name']}
{analysis['applicant_contact']}

Date: {today}"""


def generate_hindi_draft(analysis: dict) -> str:
    """Generate formal Hindi grievance draft (administrative Hindi)."""
    today = datetime.now().strftime("%d %B %Y")
    
    # Map urgency to Hindi
    urgency_hi = {
        "LOW": "सामान्य",
        "MEDIUM": "मध्यम",
        "HIGH": "उच्च",
        "CRITICAL": "अत्यंत गंभीर"
    }
    
    return f"""विषय: {analysis['nature_of_grievance_hi']} के संबंध में औपचारिक सार्वजनिक शिकायत

दिनांक: {today}

सेवा में,
सक्षम शिकायत निवारण प्राधिकारी / विभागाध्यक्ष,
{analysis['target_department_hi']},
{analysis['department_address']}

महोदय/महोदया,

मैं {analysis['nature_of_grievance_hi']} के संबंध में औपचारिक रूप से शिकायत दर्ज करना चाहता/चाहती हूँ।

संबंधित तथ्यात्मक विवरण निम्नलिखित हैं:

1. घटना/समस्या का विवरण: {analysis['incident_details']}

2. घटना स्थल: {analysis['location']}

3. घटना की तिथि/समयरेखा: {analysis['date_timeline']}

4. प्रभाव/शिकायत विवरण: {analysis['impact_details']}

अतः, मैं सक्षम प्राधिकारी से तत्काल सुधारात्मक कार्रवाई का अनुरोध करता/करती हूँ, विशेष रूप से:
{analysis['remedy_text_hi']}

मैं अनुरोध करता/करती हूँ कि इस शिकायत की 7 कार्य दिवसों के भीतर पावती दी जाए और उचित सुधारात्मक कार्रवाई तत्काल प्रारंभ की जाए। इस मामले पर ध्यान न दिए जाने की स्थिति में उच्च अधिकारियों के पास मामला बढ़ाना और/या लागू नागरिक शिकायत निवारण तंत्र के तहत औपचारिक शिकायत दर्ज करना आवश्यक हो सकता है।

तत्काल कार्रवाई की अपेक्षा में,
प्राथमिकता स्तर: {urgency_hi.get(analysis['urgency'], 'मध्यम')}

भवदीय/भवदीया,

{analysis['applicant_name']}
{analysis['applicant_contact']}

दिनांक: {today}"""


# ─── MAIN PIPELINE ────────────────────────────────────────────────────────────

def process_grievance(raw_text: str, applicant_name: str = None, applicant_phone: str = None,
                      applicant_address: str = None, model_path: str = "ai/models/qwen/Qwen3-0.6B-Q4_0.gguf") -> dict:
    """
    Main grievance processing pipeline.
    Takes raw citizen text and produces the complete 3-section output.
    """
    # Normalize model path
    if not os.path.isabs(model_path):
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        model_path = os.path.join(base_dir, model_path)
    
    # Step 1: Strip conversational fluff
    cleaned_text = strip_fluff(raw_text)
    
    # Step 2: Classify the issue
    classification = classify_issue(raw_text)  # Use raw text for classification (keywords may be in fluff)
    urgency = compute_urgency(classification["base_urgency"], raw_text)
    
    # Step 3: Extract facts (try LLM first, fall back to regex)
    llm_facts = extract_facts_via_llm(raw_text, model_path)
    
    if llm_facts:
        incident_details = llm_facts.get("incident_details") or cleaned_text
        location = llm_facts.get("location") or extract_location(raw_text)
        date_timeline = llm_facts.get("date_timeline") or extract_dates(raw_text)
        remedies_raw = llm_facts.get("remedy_sought")
        remedies = [remedies_raw] if remedies_raw else extract_remedy(raw_text)
        llm_used = True
    else:
        incident_details = cleaned_text
        location = extract_location(raw_text)
        date_timeline = extract_dates(raw_text)
        remedies = extract_remedy(raw_text)
        llm_used = False
    
    # Step 4: Apply Zero-Creativity placeholders
    if not location or location == "null":
        location = "[INSERT LOCATION HERE]"
    if not date_timeline or date_timeline == "null":
        date_timeline = "[INSERT DATE/TIMELINE HERE]"
    if not applicant_name:
        applicant_name = "[INSERT APPLICANT NAME HERE]"
    if not applicant_phone:
        applicant_contact = "[INSERT CONTACT INFORMATION HERE]"
    else:
        applicant_contact = f"Phone: {applicant_phone}"
        if applicant_address:
            applicant_contact += f"\nAddress: {applicant_address}"
    
    # Build remedy text (deduplicated)
    if remedies:
        seen_remedies = set()
        unique_remedies = []
        for r in remedies:
            r_clean = r.strip()
            if r_clean and r_clean.lower() not in seen_remedies:
                seen_remedies.add(r_clean.lower())
                unique_remedies.append(r_clean)
        remedy_lines = [f"- {r}" for r in unique_remedies]
        remedy_text = "\n".join(remedy_lines) if remedy_lines else "- [INSERT SPECIFIC REMEDY SOUGHT HERE]"
        remedy_text_hi = "\n".join(remedy_lines) if remedy_lines else "- [यहाँ विशिष्ट उपचार/कार्रवाई लिखें]"
    else:
        remedy_text = "- [INSERT SPECIFIC REMEDY SOUGHT HERE]"
        remedy_text_hi = "- [यहाँ विशिष्ट उपचार/कार्रवाई लिखें]"
    
    # Impact details derived from the issue type
    impact_map = {
        "Street Light Failure": "The non-functional street light(s) have created unsafe conditions, particularly during nighttime, posing a risk to pedestrians and residents.",
        "Road Damage / Pothole": "The damaged road surface and potholes are endangering vehicular and pedestrian traffic, causing risk of accidents and vehicle damage.",
        "Waste Management / Sanitation": "The accumulation of waste is creating unhygienic conditions, attracting pests, and posing a public health risk to the surrounding community.",
        "Water Supply Disruption": "The disruption in water supply is severely affecting daily household needs and the well-being of residents in the affected area.",
        "Sewage / Drainage Blockage": "The blocked drainage/sewage overflow is causing waterlogging, foul odor, and creating a serious public health hazard.",
        "Electricity Hazard": "The exposed/faulty electrical infrastructure poses an immediate threat to life and safety of citizens, especially children.",
        "Public Sanitation / Toilet": "The poor condition of sanitation facilities is compromising public hygiene standards and affecting the dignity of citizens.",
        "Healthcare Facility": "The inadequate healthcare facilities/services are impacting the health and well-being of community members.",
        "Traffic & Road Safety": "The traffic/road safety issue is disrupting normal movement and increasing accident risk for commuters.",
        "Stray Animal Menace": "The stray animal menace is causing fear and safety concerns among residents, particularly for children and elderly.",
        "Vector / Pest Control": "The pest/mosquito breeding conditions are raising the risk of vector-borne diseases such as dengue and malaria.",
        "Illegal Encroachment": "The illegal encroachment is obstructing public space, affecting pedestrian movement and the civic environment.",
        "Public Park / Green Space": "The poor maintenance of public green space is depriving citizens of recreational facilities.",
        "Infrastructure Damage": "The infrastructure damage poses structural safety risks and is disrupting civic services.",
        "Public Distribution System": "The issue with the public distribution system is affecting food security and entitlements of eligible citizens.",
    }
    
    impact_map_hi = {
        "Street Light Failure": "खराब स्ट्रीट लाइट(लाइटों) ने असुरक्षित स्थिति उत्पन्न कर दी है, विशेषकर रात्रि में, जो पैदल यात्रियों और निवासियों के लिए खतरा है।",
        "Road Damage / Pothole": "क्षतिग्रस्त सड़क की सतह और गड्ढे वाहन एवं पैदल यातायात को खतरे में डाल रहे हैं, दुर्घटनाओं और वाहन क्षति का जोखिम बढ़ा रहे हैं।",
        "Waste Management / Sanitation": "कचरे के ढेर अस्वच्छ स्थिति उत्पन्न कर रहे हैं, कीटों को आकर्षित कर रहे हैं और आसपास के समुदाय के लिए सार्वजनिक स्वास्थ्य जोखिम पैदा कर रहे हैं।",
        "Water Supply Disruption": "जल आपूर्ति में व्यवधान दैनिक घरेलू आवश्यकताओं और प्रभावित क्षेत्र के निवासियों के कल्याण को गंभीर रूप से प्रभावित कर रहा है।",
        "Sewage / Drainage Blockage": "अवरुद्ध नाली/मलनिकासी अतिप्रवाह जलभराव, दुर्गंध और गंभीर सार्वजनिक स्वास्थ्य खतरा उत्पन्न कर रहा है।",
        "Electricity Hazard": "खुले/दोषपूर्ण विद्युत अवसंरचना से नागरिकों, विशेषकर बच्चों की जान और सुरक्षा को तत्काल खतरा है।",
        "Public Sanitation / Toilet": "स्वच्छता सुविधाओं की खराब स्थिति सार्वजनिक स्वच्छता मानकों से समझौता कर रही है और नागरिकों की गरिमा को प्रभावित कर रही है।",
        "Healthcare Facility": "अपर्याप्त स्वास्थ्य सुविधाएं/सेवाएं समुदाय के सदस्यों के स्वास्थ्य और कल्याण को प्रभावित कर रही हैं।",
        "Traffic & Road Safety": "यातायात/सड़क सुरक्षा का मुद्दा सामान्य आवाजाही को बाधित कर रहा है और यात्रियों के लिए दुर्घटना का खतरा बढ़ा रहा है।",
        "Stray Animal Menace": "आवारा पशुओं का उपद्रव निवासियों में, विशेषकर बच्चों और बुजुर्गों में भय और सुरक्षा चिंता उत्पन्न कर रहा है।",
        "Vector / Pest Control": "कीट/मच्छर प्रजनन की स्थिति डेंगू और मलेरिया जैसे वेक्टर जनित रोगों का खतरा बढ़ा रही है।",
        "Illegal Encroachment": "अवैध अतिक्रमण सार्वजनिक स्थान को अवरुद्ध कर रहा है, पैदल यात्रियों की आवाजाही और नागरिक वातावरण को प्रभावित कर रहा है।",
        "Public Park / Green Space": "सार्वजनिक हरित स्थान के खराब रखरखाव से नागरिक मनोरंजक सुविधाओं से वंचित हो रहे हैं।",
        "Infrastructure Damage": "अवसंरचना क्षति संरचनात्मक सुरक्षा जोखिम उत्पन्न कर रही है और नागरिक सेवाओं को बाधित कर रही है।",
        "Public Distribution System": "सार्वजनिक वितरण प्रणाली में समस्या पात्र नागरिकों की खाद्य सुरक्षा और अधिकारों को प्रभावित कर रही है।",
    }
    
    impact = impact_map.get(classification["issue_type"], 
        f"The reported issue — {classification['issue_type'].lower()} — is adversely affecting civic life and requires immediate administrative attention.")
    impact_hi = impact_map_hi.get(classification["issue_type"],
        f"प्रस्तुत समस्या — {classification['issue_type'].lower()} — नागरिक जीवन को प्रतिकूल रूप से प्रभावित कर रही है और तत्काल प्रशासनिक ध्यान की आवश्यकता है।")
    
    # Nature of grievance in Hindi
    nature_hi_map = {
        "Street Light Failure": "स्ट्रीट लाइट खराबी",
        "Road Damage / Pothole": "सड़क क्षति / गड्ढा",
        "Waste Management / Sanitation": "कचरा प्रबंधन / स्वच्छता",
        "Water Supply Disruption": "जल आपूर्ति व्यवधान",
        "Sewage / Drainage Blockage": "मलनिकासी / नाली अवरोध",
        "Electricity Hazard": "विद्युत खतरा",
        "Public Sanitation / Toilet": "सार्वजनिक शौचालय / स्वच्छता",
        "Healthcare Facility": "स्वास्थ्य सुविधा",
        "Traffic & Road Safety": "यातायात एवं सड़क सुरक्षा",
        "Stray Animal Menace": "आवारा पशु उपद्रव",
        "Vector / Pest Control": "कीट / मच्छर नियंत्रण",
        "Illegal Encroachment": "अवैध अतिक्रमण",
        "Public Park / Green Space": "सार्वजनिक उद्यान / हरित स्थान",
        "Infrastructure Damage": "अवसंरचना क्षति",
        "Public Distribution System": "सार्वजनिक वितरण प्रणाली",
        "General Civic Complaint": "सामान्य नागरिक शिकायत",
    }
    
    # Build the analysis object
    analysis = {
        "nature_of_grievance": classification["issue_type"],
        "nature_of_grievance_hi": nature_hi_map.get(classification["issue_type"], classification["issue_type"]),
        "date_timeline": date_timeline,
        "target_department": classification["department"],
        "target_department_hi": classification.get("department_hi", classification["department"]),
        "department_address": "[INSERT DEPARTMENT ADDRESS HERE]",
        "urgency": urgency,
        "incident_details": incident_details,
        "location": location,
        "impact_details": impact,
        "impact_details_hi": impact_hi,
        "applicant_name": applicant_name,
        "applicant_contact": applicant_contact,
        "remedy_text": remedy_text,
        "remedy_text_hi": remedy_text_hi,
    }
    
    # Generate drafts
    english_draft = generate_english_draft(analysis)
    hindi_draft = generate_hindi_draft(analysis)
    
    # Build final structured output
    output = {
        "section_1_analysis": {
            "nature_of_grievance": classification["issue_type"],
            "incident_date_timeline": date_timeline,
            "target_department": classification["department"],
            "target_department_hi": classification.get("department_hi", classification["department"]),
            "urgency": urgency,
            "location": location,
            "raw_input_cleaned": cleaned_text,
        },
        "section_2_english_draft": english_draft,
        "section_3_hindi_draft": hindi_draft,
        "metadata": {
            "llm_used": llm_used if 'llm_used' in dir() else False,
            "model_path": model_path,
            "processing_device": "CPU (Local Qwen GGUF)" if (HAS_LLAMA_CPP and os.path.exists(model_path)) else "Regex/Template Fallback",
            "timestamp": datetime.now().isoformat(),
        },
        "status": "success"
    }
    
    return output


# ─── CLI ENTRYPOINT ───────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="AI Grievance Officer - Formal Dual-Language Draft Generator")
    parser.add_argument("raw_text", type=str, help="Raw citizen complaint text (messy/voice-to-text)")
    parser.add_argument("--name", type=str, default=None, help="Applicant name")
    parser.add_argument("--phone", type=str, default=None, help="Applicant phone")
    parser.add_argument("--address", type=str, default=None, help="Applicant address")
    parser.add_argument("--model", type=str, default="ai/models/qwen/Qwen3-0.6B-Q4_0.gguf",
                        help="Path to the Qwen GGUF model file")
    args = parser.parse_args()

    try:
        result = process_grievance(
            raw_text=args.raw_text,
            applicant_name=args.name,
            applicant_phone=args.phone,
            applicant_address=args.address,
            model_path=args.model
        )
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e), "status": "error"}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
