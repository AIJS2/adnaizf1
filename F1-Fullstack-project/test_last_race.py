import sys
sys.path.append('backend')
import fastf1
import pandas as pd

fastf1.Cache.enable_cache('C:/Users/admminbaru/AppData/Local/Temp/fastf1')
schedule = fastf1.get_event_schedule(2024, include_testing=False)
now = pd.Timestamp.now(tz='UTC')
completed = schedule[schedule['EventDate'] < now.tz_localize(None)]
last_event = completed.iloc[-1]
session = fastf1.get_session(last_event.EventFormat, last_event.RoundNumber, 'R')
session.load(telemetry=False, weather=True, messages=True)

print("Status:", session.session_status)
print("Results cols:", session.results.columns)
print("Messages:", len(session.race_control_messages))
