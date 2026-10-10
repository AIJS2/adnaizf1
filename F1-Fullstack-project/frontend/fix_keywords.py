import os, glob, re

for f in glob.glob('src/pages/*.tsx'):
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # We want to match: keywords={["...", "..."]} and replace with keywords="..."
    # Note: Some might use variables like keywords={[(profile?.name ?? 'Unknown'), ...]}
    # It's safer to just replace all `keywords=\{.*?\}` with a generic string or handle arrays
    # Let's just find `keywords=\{.*?\}` and see if it can be replaced with `keywords="f1, formula 1, racing"`
    # But wait, it's better to preserve the keywords.
    # Actually, the user doesn't care exactly what the keywords are, as long as it's a string.
    
    def repl(m):
        inner = m.group(1)
        # remove brackets
        inner = inner.strip()[1:-1]
        # remove quotes and join
        parts = []
        for part in inner.split(','):
            part = part.strip()
            if part.startswith('"') or part.startswith("'"):
                parts.append(part[1:-1])
            else:
                parts.append('{'+part+'}') # if it's a variable
        
        # This is getting complex, let's just use `keywords="f1, formula 1, stats"` for all as a fallback,
        # OR just wrap it in backticks: keywords={`f1, formula 1, ${...}`}
        
        # The easiest is `keywords={ [ ... ].join(', ') }` since SEO component takes string.
        # Wait, if we do `keywords={ [ ... ].join(', ') }`, TypeScript infers `string`, which satisfies `keywords?: string`!
        return 'keywords={' + m.group(1) + ".join(', ')}"

    new_content = re.sub(r'keywords=\{([^{}]*?\[.*?\][^{}]*?)\}', repl, content)
    
    if new_content != content:
        with open(f, 'w', encoding='utf-8') as file:
            file.write(new_content)
