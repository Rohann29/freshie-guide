import pdfplumber
import re
import json

pdf_path = "state_cutoffs.pdf" 
output_json = "branches.json"

print("🔍 SPINNING UP THE BRANCH DECODER...\n")

# This dictionary will store our data like: {"0100219110": "Civil Engineering"}
branch_dict = {}

with pdfplumber.open(pdf_path) as pdf:
    total_pages = len(pdf.pages)
    
    for i, page in enumerate(pdf.pages):
        if i % 50 == 0:
            print(f"Scanning page {i + 1} of {total_pages}...")
            
        text = page.extract_text()
        if text:
            lines = text.split('\n')
            for line in lines:
                line = line.strip()
                
                # Regex magic: Looks for exactly 9-10 digits, followed by a dash, then text
                match = re.match(r"^(\d{9,10})\s*-\s*(.+)$", line)
                
                if match:
                    code = match.group(1).strip()
                    name = match.group(2).strip()
                    
                    branch_dict[code] = name

print(f"\n✅ SUCCESS! Found {len(branch_dict)} unique branch codes.")

with open(output_json, "w", encoding="utf-8") as f:
    json.dump(branch_dict, f, indent=4)

print(f"📦 Saved perfectly to {output_json}")