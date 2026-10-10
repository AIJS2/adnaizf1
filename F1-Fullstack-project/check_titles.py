import os
import re

directory = 'frontend/src/pages'
for filename in os.listdir(directory):
    if filename.endswith(".tsx"):
        filepath = os.path.join(directory, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace <title>{["Something", "Something"]}</title> with <title>SomethingSomething</title>
        # A simpler regex to match <title>{[ ... ]}</title>
        def replace_title(match):
            inner = match.group(1)
            # Remove quotes, commas and spaces between array elements if they are just strings
            clean = inner.replace('"', '').replace("'", "").replace(",", "").replace("[", "").replace("]", "").strip()
            return f"<title>{clean}</title>"
            
        # Wait, usually people write <title>{['Text', variable]}</title>. 
        # If there are variables, it's safer to use template literals: <title>{Text }</title>
        
        # Let's just do a simple replacement for typical React Helmet title arrays
        # Many people copy paste <title>{["Title", " | ", "Suffix"]}</title>
        # We can change it to <title>Title | Suffix</title> if there are no variables.
        
        # Let's see how it's actually written first.
