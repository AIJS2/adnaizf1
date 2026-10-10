import sys

with open('backend/routers/livetiming.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
in_block = False
for line in lines:
    if "if _broadcast_task is None or _broadcast_task.done():" in line:
        # Prepend async with
        indent = line[:line.find("if")]
        new_lines.append(indent + "async with _broadcast_lock:\n")
        new_lines.append(indent + "    if _broadcast_task is None or _broadcast_task.done():\n")
        in_block = True
    elif in_block:
        if line.strip() == "try:":
            in_block = False
            new_lines.append(line)
        else:
            if line.strip() == "":
                new_lines.append(line)
            else:
                new_lines.append("    " + line)
    else:
        new_lines.append(line)

with open('backend/routers/livetiming.py', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
