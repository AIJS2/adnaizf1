import fastf1
import pandas as pd
import logging

def process_telemetry_compare(year: int, round_number: int, driver_list: list, lap: int = None):
    session = fastf1.get_session(year, round_number, 'R')
    session.load(telemetry=True, laps=True, weather=False, messages=False)

    driver_data = {}
    binned_dfs = []

    ref_driver = driver_list[0]
    
    for drv in driver_list:
        drv_laps = session.laps.pick_drivers(drv)
        if drv_laps.empty:
            continue

        if lap is not None:
            lap_df = drv_laps.loc[drv_laps['LapNumber'] == lap]
            target_lap = lap_df.iloc[0] if not lap_df.empty else None
        else:
            target_lap = drv_laps.pick_fastest()

        if target_lap is None or pd.isna(target_lap.get('LapTime')):
            continue
            
        drv_info = session.get_driver(drv)
        team = str(drv_info.get('TeamName', '')) if drv_info is not None else ""
        name = f"{drv_info.get('FirstName', '')} {drv_info.get('LastName', '')}".strip() if drv_info is not None else drv

        tel = target_lap.get_telemetry()
        
        tel['Elapsed'] = (tel['Time'] - tel['Time'].iloc[0]).dt.total_seconds()
        tel['DRSActive'] = tel['DRS'].apply(lambda x: 1 if x in [10, 12, 14, 1] else 0) if 'DRS' in tel else 0
        
        s_filtered = tel[tel['Speed'] > 30]['Speed']
        min_speed = round(float(s_filtered.min()), 1) if not s_filtered.empty else round(float(tel['Speed'].min()), 1)
        
        driver_data[drv] = {
            "name": name,
            "team": team,
            "lap_time": str(target_lap['LapTime']).split("0 days ")[-1] if pd.notna(target_lap.get('LapTime')) else None,
            "compound": str(target_lap.get('Compound', 'UNKNOWN')),
            "max_speed": round(float(tel['Speed'].max()), 1),
            "min_speed": min_speed,
            "avg_speed": round(float(tel['Speed'].mean()), 1)
        }
        
        binned = tel.groupby(tel['Distance'] // 10 * 10).mean(numeric_only=True).reset_index(names='BinnedDist')
        binned.columns = [c if c == 'BinnedDist' else f"{c}_{drv}" for c in binned.columns]
        binned_dfs.append(binned)

    if not binned_dfs:
        raise ValueError("Tidak ada data telemetry untuk pembalap yang dipilih.")
        
    merged = binned_dfs[0]
    for df in binned_dfs[1:]:
        merged = pd.merge(merged, df, on='BinnedDist', how='outer').sort_values('BinnedDist')
        
    merged = merged.ffill().bfill().fillna(0)
    
    valid_drivers = list(driver_data.keys())
    data_points = []
    for _, row in merged.iterrows():
        pt = {"distance": int(row['BinnedDist'])}
        ref_elapsed = float(row.get(f'Elapsed_{ref_driver}', 0))
        
        max_speed = -1
        dominant = valid_drivers[0] if valid_drivers else None
        
        pt["x"] = float(row.get(f'X_{valid_drivers[0]}', 0))
        pt["y"] = float(row.get(f'Y_{valid_drivers[0]}', 0))

        for drv in valid_drivers:
            speed = round(float(row.get(f'Speed_{drv}', 0)), 1)
            elapsed = float(row.get(f'Elapsed_{drv}', 0))
            g = row.get(f'nGear_{drv}', 0)
            
            pt[f"speed_{drv}"] = speed
            pt[f"throttle_{drv}"] = round(float(row.get(f'Throttle_{drv}', 0)), 1)
            pt[f"brake_{drv}"] = 1 if row.get(f'Brake_{drv}', 0) > 0 else 0
            pt[f"gear_{drv}"] = int(g) if pd.notna(g) else 0
            pt[f"drs_{drv}"] = 1 if row.get(f'DRSActive_{drv}', 0) >= 0.5 else 0
            
            if drv != ref_driver:
                pt[f"delta_{drv}"] = round(elapsed - ref_elapsed, 3)
            
            if speed > max_speed:
                max_speed = speed
                dominant = drv
                
        pt["dominant_driver"] = dominant
        data_points.append(pt)
        
    # --- Smooth Dominant Driver (Mini-Sectors) ---
    chunk_size = 250
    chunks = {}
    for pt in data_points:
        c_idx = pt["distance"] // chunk_size
        if c_idx not in chunks:
            chunks[c_idx] = {drv: [] for drv in valid_drivers}
        for drv in valid_drivers:
            chunks[c_idx][drv].append(pt.get(f"speed_{drv}", 0))
    
    chunk_winners = {}
    for c_idx, drv_speeds in chunks.items():
        best_drv = valid_drivers[0] if valid_drivers else None
        best_avg = -1
        for drv, speeds in drv_speeds.items():
            if speeds:
                avg = sum(speeds) / len(speeds)
                if avg > best_avg:
                    best_avg = avg
                    best_drv = drv
        chunk_winners[c_idx] = best_drv
        
    for pt in data_points:
        c_idx = pt["distance"] // chunk_size
        pt["dominant_driver"] = chunk_winners.get(c_idx, valid_drivers[0] if valid_drivers else None)
        
    return {
        "drivers": valid_drivers,
        "driver_info": driver_data,
        "telemetry": data_points
    }

def get_telemetry_drivers_list(year: int, round_number: int):
    session = fastf1.get_session(year, round_number, 'R')
    session.load(telemetry=False, laps=False, weather=False, messages=False)
    drivers_list = []
    if hasattr(session, 'results') and not session.results.empty:
        for _, row in session.results.iterrows():
            abbr = row.get('Abbreviation')
            if pd.notna(abbr) and abbr:
                drivers_list.append({
                    "abbreviation": str(abbr),
                    "full_name": f"{row.get('FirstName', '')} {row.get('LastName', '')}".strip(),
                    "team_name": row.get('TeamName', '')
                })
    return drivers_list
