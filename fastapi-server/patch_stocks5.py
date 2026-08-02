import re

FILE_PATH = "/var/www/idx.mytriv.com/fastapi-server/routers/stocks.py"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    content = f.read()

# Replace a.change_index as selisih with a.close_index - a.change_index as selisih
content = content.replace("a.change_index as selisih", "a.close_index - a.change_index as selisih")

with open(FILE_PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("Patch 5 applied successfully.")
