import sys
sys.path.append('backend')
import fastf1

event = fastf1.get_event(2026, 17)
print("Event name:", event['EventName'])
for i in range(1, 6):
    s_name = event[f'Session{i}']
    s_date = event[f'Session{i}DateUtc']
    print(f"Session {i}: {s_name} - {s_date}")

