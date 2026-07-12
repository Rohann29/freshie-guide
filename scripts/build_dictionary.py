import pdfplumber
import re
import json

pdf_path = "state_cutoffs.pdf" 
output_json = "colleges.json"

print("🔍 SPINNING UP THE DECODER...\n")

# This dictionary will store our data like: {"01002": "Government College..."}
college_dict = {}

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
                
                # Regex magic: Looks for exactly 4-5 digits, followed by a dash, then text
                match = re.match(r"^(\d{4,5})\s*-\s*(.+)$", line)
                
                if match:
                    code = match.group(1).strip()
                    name = match.group(2).strip()
                    
                    # Save it to our dictionary (this automatically prevents duplicates!)
                    college_dict[code] = name

print(f"\n✅ SUCCESS! Found {len(college_dict)} unique colleges.")

# Save the dictionary to a JSON file
with open(output_json, "w", encoding="utf-8") as f:
    json.dump(college_dict, f, indent=4)

print(f"📦 Saved perfectly to {output_json}")