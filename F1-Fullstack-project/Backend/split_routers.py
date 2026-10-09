import os
import re

with open('routers/api.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Define the boundaries based on the section headers
sections = list(re.finditer(r'# =======================================================================\n# ---.*?--- \n# =======================================================================|# =======================================================================\n# ---.*?---\n# =======================================================================', content))

# Find clear cache manually since it lacks headers
clear_cache_start = content.find('def get_championship_cache_filename(year: int):')
if clear_cache_start == -1:
    clear_cache_start = content.find('def get_championship_cache_filename(year):')

endpoints = [
    ("dashboard", sections[0].start(), sections[1].start()),
    ("races", sections[1].start(), sections[2].start()),
    ("race_details", sections[2].start(), clear_cache_start),
    ("system", clear_cache_start, sections[3].start()),
    ("telemetry", sections[3].start(), sections[4].start()),
    ("championship", sections[4].start(), sections[5].start()),
    ("profiles", sections[5].start(), sections[6].start()),
    ("livetiming", sections[6].start(), len(content))
]

imports = content[:sections[0].start()]

for name, start, end in endpoints:
    with open(f'routers/{name}.py', 'w', encoding='utf-8') as f:
        f.write(imports + content[start:end])

