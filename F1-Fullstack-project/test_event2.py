import sys
sys.path.append('backend')
from datetime import datetime, timezone
import fastf1

event = fastf1.get_event(2026, 17)
now = datetime.utcnow()
latest_session = None

for i in range(5, 0, -1):
    s_date = event[f'Session{i}DateUtc']
    s_name = event[f'Session{i}']
    if s_date and s_date < now:
        latest_session = s_name
        break

print("Latest session:", latest_session)
