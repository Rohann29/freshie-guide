import pdfplumber
import re
import json

pdf_path = "state_cutoffs.pdf" 

print("🧩 MAPPING CATEGORIES TO PERCENTILES...\n")
print("-" * 50)

# This list will hold all our perfect data ready for the database
extracted_data = []

with pdfplumber.open(pdf_path) as pdf:
    total_pages = len(pdf.pages)
    print(f"📄 Found {total_pages} pages. Starting extraction...")
    
    current_college_code = None
    current_branch_code = None
    active_categories = []
    
    # Loop through EVERY page in the PDF
    for i, page in enumerate(pdf.pages):
        # Print progress so we know it hasn't frozen!
        if i % 10 == 0:
            print(f"Scanning page {i + 1} of {total_pages}...")
            
        text = page.extract_text()
        
        if text:
            lines = text.split('\n')
            
            for line in lines:
                line = line.strip() 
                
                if re.match(r"^\d{4,5}\s+-", line):
                    current_college_code = line.split('-')[0].strip()
                
                elif re.match(r"^\d{9,10}\s+-", line):
                    current_branch_code = line.split('-')[0].strip()
                
                elif line.startswith("Stage"):
                    active_categories = line.replace("Stage", "").strip().split()
                
                elif re.search(r"\(\d{1,3}\.\d+\)", line):
                     percentiles = re.findall(r"\(\d{1,3}\.\d+\)", line)
                     clean_percentiles = [p.strip('()') for p in percentiles]
                     
                     for j in range(min(len(active_categories), len(clean_percentiles))):
                         data_point = {
                             "college_code": current_college_code,
                             "branch_code": current_branch_code,
                             "seat_type": active_categories[j],
                             "closing_percentile": float(clean_percentiles[j]),
                             "year": 2025,
                             "cap_round": 1
                         }
                         extracted_data.append(data_point)
                     
                     active_categories = []
# Print just the first 4 records beautifully formatted
print(json.dumps(extracted_data[:4], indent=2))

import os
from supabase import create_client, Client

# --- SUPABASE UPLOAD SETUP ---
# Replace these strings with your actual project URL and the SERVICE ROLE key you just copied
SUPABASE_URL = "https://miqyijdbfwsdxwpdizcc.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pcXlpamRiZndzZHh3cGRpemNjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzMzNzI3OCwiZXhwIjoyMDk4OTEzMjc4fQ.bwQAbeHHZPlFtry9IA0SWmFyTK-AG9nYp6-Mf355kU4"

print("\n🚀 CONNECTING TO SUPABASE...")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Upload the data in batches to avoid overwhelming the database
batch_size = 100
total_records = len(extracted_data)
print(f"Total records to upload: {total_records}")

for i in range(0, total_records, batch_size):
    batch = extracted_data[i:i + batch_size]
    
    # Insert the batch into our raw_cutoffs table
    data, count = supabase.table('raw_cutoffs').insert(batch).execute()
    print(f"Uploaded batch {i} to {i + len(batch)}...")

print("🎉 PIPELINE COMPLETE! All data uploaded to the cloud.")