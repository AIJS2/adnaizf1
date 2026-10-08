import sys
import fastf1
import pandas as pd

fastf1.Cache.enable_cache("cache")

session = fastf1.get_session(2023, 1, 'R')
session.load(telemetry=False, weather=False, messages=False)

lap_chart = []
gap_chart = []
lap_df = session.laps[['LapNumber', 'Driver', 'Position', 'Time']].dropna(subset=['LapNumber', 'Driver', 'Position'])
lap_numbers = sorted(lap_df['LapNumber'].unique().astype(int))
for lap_num in lap_numbers:
    lap_rows = lap_df[lap_df['LapNumber'] == lap_num]
    gap_entry = {"lap": int(lap_num)}
    leader_row = lap_rows[lap_rows['Position'] == 1]
    leader_time = None
    if not leader_row.empty:
        leader_time = leader_row.iloc[0]['Time']

    for _, row in lap_rows.iterrows():
        drv = str(row['Driver'])
        if leader_time is not None and pd.notna(row.get('Time')) and pd.notna(leader_time):
            gap = (row['Time'] - leader_time).total_seconds()
            if gap >= 0 and gap < 180:
                gap_entry[drv] = round(gap, 3)

    if len(gap_entry) > 1:
        gap_chart.append(gap_entry)

print("Gap Chart len:", len(gap_chart))
print("Sample:", gap_chart[0] if gap_chart else "Empty")
