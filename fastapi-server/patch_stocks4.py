import re

FILE_PATH = "/var/www/idx.mytriv.com/fastapi-server/routers/stocks.py"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    content = f.read()

# Replace days logic in /index and /broker
old_logic = 'days = 7 if period == "1week" else 30 if period == "1month" else 90'
new_logic = 'days = 1 if period == "1day" else 7 if period == "1week" else 30 if period == "1month" else 90'

content = content.replace(old_logic, new_logic)

with open(FILE_PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("Patch 4 applied successfully.")
