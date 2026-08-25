import pdfplumber
import re
import json
import os
import sys
from supabase import create_client, Client

# Ensure UTF-8 output on Windows
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Default PDF and round (can be overridden via CLI args e.g. python extract_data.py ai_cap1.pdf 1)
pdf_path = sys.argv[1] if len(sys.argv) > 1 else "ai_cap1.pdf"
current_round = int(sys.argv[2]) if len(sys.argv) > 2 else 1

# If relative path doesn't exist, check within the script directory
if not os.path.exists(pdf_path):
    script_dir = os.path.dirname(os.path.abspath(__file__))
    potential_path = os.path.join(script_dir, pdf_path)
    if os.path.exists(potential_path):
        pdf_path = potential_path

print(f"[*] EXTRACTING CUTOFF DATA FROM {pdf_path} (CAP Round {current_round})...\n")
print("-" * 50)

extracted_data = []

with pdfplumber.open(pdf_path) as pdf:
    total_pages = len(pdf.pages)
    print(f"[i] Found {total_pages} pages. Starting extraction...")
    
    current_college_code = None
    current_branch_code = None
    active_categories = []
    
    for i, page in enumerate(pdf.pages):
        if (i + 1) % 20 == 0 or i == 0 or i == total_pages - 1:
            print(f"Scanning page {i + 1} of {total_pages}...")
            
        text = page.extract_text()
        if not text:
            continue
            
        lines = text.split('\n')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # --- CASE 1: All India (AI) PDF Format ---
            # Line format example:
            # "1 15312 (86.6844102) 0110124210 01101 - Shri Sant Gajanan Maharaj... Computer Science and JEE AI to AI AI"
            ai_match = re.search(r'\((\d{1,3}\.\d+)\)\s+([0-9A-Za-z]{9,11})\s+([0-9A-Za-z]{4,5})\s*-\s*(.+)', line)
            if ai_match:
                percentile_val = float(ai_match.group(1))
                branch_code_val = ai_match.group(2)
                college_code_val = ai_match.group(3)
                
                # Seat type for All India seats
                seat_type = "AI"
                
                data_point = {
                    "college_code": college_code_val,
                    "branch_code": branch_code_val,
                    "seat_type": seat_type,
                    "closing_percentile": percentile_val,
                    "year": 2025,
                    "cap_round": current_round
                }
                extracted_data.append(data_point)
                continue
            
            # --- CASE 2: State PDF Format ---
            if re.match(r"^\d{4,5}\s+-", line):
                current_college_code = line.split('-')[0].strip()
            
            elif re.match(r"^\d{9,10}\s+-", line):
                current_branch_code = line.split('-')[0].strip()
            
            elif line.startswith("Stage"):
                active_categories = line.replace("Stage", "").strip().split()
            
            elif re.search(r"\(\d{1,3}\.\d+\)", line) and active_categories:
                percentiles = re.findall(r"\(\d{1,3}\.\d+\)", line)
                clean_percentiles = [p.strip('()') for p in percentiles]
                
                for j in range(min(len(active_categories), len(clean_percentiles))):
                    data_point = {
                        "college_code": current_college_code,
                        "branch_code": current_branch_code,
                        "seat_type": active_categories[j],
                        "closing_percentile": float(clean_percentiles[j]),
                        "year": 2025,
                        "cap_round": current_round
                    }
                    extracted_data.append(data_point)
                
                active_categories = []

print(f"\n[+] Extraction Complete! Captured {len(extracted_data)} total records.")
print("\nSample records:")
print(json.dumps(extracted_data[:3], indent=2))

# --- SUPABASE UPLOAD SETUP ---
SUPABASE_URL = "https://miqyijdbfwsdxwpdizcc.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pcXlpamRiZndzZHh3cGRpemNjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzMzNzI3OCwiZXhwIjoyMDk4OTEzMjc4fQ.bwQAbeHHZPlFtry9IA0SWmFyTK-AG9nYp6-Mf355kU4"

print("\n[*] CONNECTING TO SUPABASE...")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Upload the data in batches to avoid overwhelming the database
batch_size = 100
total_records = len(extracted_data)
print(f"Total records to upload: {total_records}")

for i in range(0, total_records, batch_size):
    batch = extracted_data[i:i + batch_size]
    
    # Insert the batch into raw_cutoffs table
    data, count = supabase.table('raw_cutoffs').insert(batch).execute()
    print(f"Uploaded batch {i + 1} to {min(i + len(batch), total_records)} / {total_records}...")

print("[+] PIPELINE COMPLETE! All data uploaded to the cloud.")