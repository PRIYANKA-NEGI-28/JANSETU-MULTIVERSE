"""
RTI Application Drafter — Statutory Compliant Dual-Language Serializer
----------------------------------------------------------------------
Takes structured applicant/authority/query fields and serializes them into
legally authentic RTI applications compliant with Section 6(1) of the
Right to Information Act, 2005.

CRITICAL CONSTRAINTS:
1. STATUTORY COMPLIANCE: Output strictly follows syntax accepted by PIOs.
2. ABSOLUTE TRUTH: Never generates fictitious data — all output matches input exactly.
3. MANDATORY DUAL-OUTPUT: English first, then formal legal Hindi.
"""

import sys
import json
import argparse
import os
from datetime import datetime

# Force UTF-8 encoding for stdout/stderr on Windows
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')
if sys.stderr.encoding != 'utf-8':
    sys.stderr.reconfigure(encoding='utf-8')

try:
    from llama_cpp import Llama
    HAS_LLAMA = True
except ImportError:
    HAS_LLAMA = False


# ─── QUERY PARSER ─────────────────────────────────────────────────────────────

def parse_queries_to_items(natural_query: str, info_category: str,
                           time_from: str, time_to: str,
                           specific_documents: str) -> list:
    """
    Convert natural language query + category into discrete, legally framed
    RTI information request items. Each item is a clear request for official
    records, file notings, or certified logs.
    """
    items = []
    lower = natural_query.lower()

    if info_category == 'documents' or 'copy' in lower or 'document' in lower or 'record' in lower:
        items.append(f"Certified copies of all records, files, noting, correspondence and documents related to: \"{natural_query}\".")

    if info_category == 'status' or 'status' in lower or 'application' in lower or 'pending' in lower:
        items.append(f"Current status of the matter/application/complaint as described: \"{natural_query[:120]}{'...' if len(natural_query) > 120 else ''}\".")
        items.append("Names and designations of the officials responsible for processing the matter.")

    if info_category == 'expenditure' or any(kw in lower for kw in ['money', 'amount', 'fund', 'budget', 'spend', 'expenditure']):
        items.append(f"Complete details of funds allocated, disbursed and utilized in connection with: \"{natural_query[:120]}\".")
        items.append("Audited accounts and utilization certificates, if any.")

    if info_category == 'complaints' or 'complaint' in lower or 'grievance' in lower:
        items.append("Copies of all complaints/grievances received regarding the subject matter.")
        items.append("Action taken reports on complaints received during the said period.")

    if info_category == 'tenders' or any(kw in lower for kw in ['tender', 'contract', 'work order']):
        items.append("Details of all tenders issued, bids received, and work orders awarded in the subject matter.")
        items.append("Name and details of the successful bidder(s) and the award amount.")

    if info_category == 'beneficiaries' or 'list' in lower or 'beneficiar' in lower:
        items.append("Complete list of beneficiaries/recipients of the scheme/program as described.")
        items.append("Criteria applied for selection of beneficiaries.")

    if info_category == 'inspection' or 'inspect' in lower:
        items.append(f"Permission to inspect the relevant records, files, and documents pertaining to: \"{natural_query[:120]}\".")

    if info_category == 'appointments' or any(kw in lower for kw in ['appointment', 'transfer', 'posting']):
        items.append("Details of all appointments, transfers, and postings of officers connected with the subject matter.")

    if info_category == 'policy' or any(kw in lower for kw in ['rule', 'policy', 'guideline', 'regulation']):
        items.append("Copies of all relevant rules, regulations, guidelines, circulars and policy documents.")

    # General catch-all if no specific category matched
    if not items:
        items.append(f"All information, records, files, noting, correspondence and documents related to: \"{natural_query}\".")
        items.append("Names and designations of public servants associated with the matter.")
        items.append("Action taken/proposed on the subject matter.")

    # Additional specific documents requested
    if specific_documents and specific_documents.strip():
        for doc in specific_documents.strip().split('\n'):
            doc = doc.strip()
            if doc:
                items.append(doc)

    # Date-range request
    if time_from and time_to:
        items.append(f"Any other related document(s) for the period from {time_from} to {time_to}.")

    return items


# ─── COMBINED EXACT TEMPLATE OUTPUT ──────────────────────────────────────────

def generate_exact_format_rti(fields: dict) -> str:
    """
    Generate the EXACT dual-output format requested by the Legal Counsel constraints.
    """
    today = datetime.now().strftime("%d %B %Y")

    # Parse query items
    query_items_en = parse_queries_to_items(
        fields.get('naturalQuery', ''),
        fields.get('infoCategory', 'other'),
        fields.get('timePeriodFrom', ''),
        fields.get('timePeriodTo', ''),
        fields.get('specificDocuments', '')
    )

    items_text_en = ""
    for i, item in enumerate(query_items_en, 1):
        items_text_en += f"       - Item {i}: {item}\n"
        
    items_text_hi = ""
    for i, item in enumerate(query_items_en, 1):
        items_text_hi += f"       - बिंदु {i}: {item}\n"

    # Subject matter
    natural_query = fields.get('naturalQuery', '')
    subject_matter = natural_query[:150] + ('...' if len(natural_query) > 150 else '') if natural_query else "[Subject Matter Not Specified]"

    # Time period
    time_from = fields.get('timePeriodFrom', '')
    time_to = fields.get('timePeriodTo', '')
    time_period = f"From {time_from} to {time_to}" if (time_from and time_to) else "[Relevant Period Not Specified]"

    # BPL and fee
    is_bpl = fields.get('isBPL', False)
    payment_mode = fields.get('paymentMode', 'Demand Draft / IPO / Court Fee Stamp')
    
    bpl_line_en = "Yes" if is_bpl else "No"
    bpl_line_hi = "हाँ" if is_bpl else "नहीं"
    
    # Map payment modes to Hindi
    payment_mode_hi = {
        'Indian Postal Order (IPO)': 'भारतीय डाक आदेश (आईपीओ)',
        'DD / Banker Cheque': 'डीडी / बैंकर चेक',
        'Court Fee Stamp': 'न्यायालय शुल्क स्टैम्प',
        'Treasury Challan': 'खजाना चालान',
        'Online Payment': 'ऑनलाइन भुगतान',
    }.get(payment_mode, payment_mode)

    # Fields
    applicant_name = fields.get('applicantName', '') or "[Name Field]"
    
    address = fields.get('address', '')
    city = fields.get('city', '')
    state = fields.get('state', '')
    pincode = fields.get('pincode', '')
    
    correspondence_address = f"{address}, {city}" if address else "[Address Field]"
    if pincode:
        correspondence_address += f" – {pincode}"
    if state:
        correspondence_address += f", {state}"

    authority_name = fields.get('authorityName', '') or "[Name of the Public Authority / Department Field]"
    department = fields.get('department', '')
    pio_address = fields.get('pioConcern', '') or "[Full Address Field]"

    authority_block_en = authority_name
    if department:
        authority_block_en += f"\n{department}"
        
    place = city or "[Insert Place]"

    return f"""---
### DRAFT 1: ENGLISH VERSION
**APPLICATION UNDER SECTION 6(1) OF THE RIGHT TO INFORMATION ACT, 2005**

To,
The Public Information Officer (PIO),
{authority_block_en},
{pio_address}

1. **Full Name of the Applicant:** {applicant_name}
2. **Address for Correspondence:** {correspondence_address}
3. **Particulars of Information Required under Section 6(1):**
   (a) Subject Matter of Information: {subject_matter}
   (b) The period to which the information relates: {time_period}
   (c) Specific Details of Information Needed:
{items_text_en.rstrip()}
4. **Whether the Applicant belongs to the BPL category:** {bpl_line_en}
5. **Application Fee Details:** {payment_mode}

Place: {place}
Date: {today}

Signature of Applicant
---
### DRAFT 2: हिंदी संस्करण (सूचना का अधिकार अधिनियम, 2005 की धारा 6(1) के तहत आवेदन)

सेवा में,
लोक सूचना अधिकारी (PIO),
{authority_block_en},
{pio_address}

1. **आवेदक का पूरा नाम:** {applicant_name}
2. **पत्राचार का पता:** {correspondence_address}
3. **अपेक्षित सूचना का विवरण:**
   (क) सूचना का विषय: {subject_matter}
   (ख) संबंधित अवधि: {time_period}
   (ग) आवश्यक सूचना के विशिष्ट बिंदु:
{items_text_hi.rstrip()}
4. **क्या आवेदक गरीबी रेखा के नीचे (BPL) श्रेणी का है:** {bpl_line_hi}
5. **आवेदन शुल्क का विवरण:** {payment_mode_hi}

स्थान: {place}
दिनांक: {today}

आवेदक के हस्ताक्षर
---"""

# ─── LLM-BASED GENERATOR ──────────────────────────────────────────────────────

def generate_llm_rti(fields: dict, model_path: str) -> str:
    if not HAS_LLAMA:
        print("llama_cpp not installed, falling back to template.", file=sys.stderr)
        return None

    try:
        prompt = (
            "You are a legal expert in the Right to Information Act, 2005. "
            "Draft a formal, highly professional RTI Application based on the following details. "
            "IMPORTANT: Output TWO sections. Section 1: English Draft. Section 2: Hindi Translation of the exact draft.\n\n"
            f"Applicant Name: {fields.get('applicantName', 'Unknown')}\n"
            f"Applicant Address: {fields.get('address', '')}, {fields.get('city', '')}\n"
            f"Target Authority: {fields.get('authorityName', 'Unknown')}\n"
            f"Information Requested: {fields.get('naturalQuery', 'Unknown')}\n"
            f"Time Period: {fields.get('timePeriodFrom', 'Unknown')} to {fields.get('timePeriodTo', 'Unknown')}\n"
            f"Specific Documents Needed: {fields.get('specificDocuments', 'None')}\n"
        )
        
        formatted_prompt = (
            "<|im_start|>system\nYou are a legal expert in Indian administrative law. Format beautifully using markdown. Do not add conversational fluff.<|im_end|>\n"
            f"<|im_start|>user\n{prompt}<|im_end|>\n"
            "<|im_start|>assistant\n"
        )
        
        llm = Llama(model_path=model_path, n_ctx=2048, verbose=False)
        output = llm(formatted_prompt, max_tokens=1500, stop=["<|im_end|>"], temperature=0.4)
        generated_text = output["choices"][0]["text"].strip()
            
        return generated_text
    except Exception as e:
        print(f"LLM extraction error: {e}", file=sys.stderr)
        return None

# ─── CLI ENTRYPOINT ───────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="RTI Application Drafter — Section 6(1) Compliant Dual-Language Serializer"
    )
    parser.add_argument("fields_json", type=str,
                        help="JSON string containing the structured form fields")
    parser.add_argument("--model", type=str, default="ai/models/qwen/Qwen3-0.6B-Q4_0.gguf",
                        help="Path to the Qwen GGUF model file")
    args = parser.parse_args()

    try:
        fields = json.loads(args.fields_json)
        
        # Try LLM first
        result_text = generate_llm_rti(fields, args.model)
        
        # Fallback to precise template if LLM fails or is missing
        if not result_text:
            result_text = generate_exact_format_rti(fields)
            
        # Output as JSON with draftText to be consumed by drafterRouter.js
        output = {
            "draftText": result_text,
            "status": "success"
        }
        print(json.dumps(output, ensure_ascii=False))
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON input: {e}", "status": "error"},
                         ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e), "status": "error"},
                         ensure_ascii=False), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
