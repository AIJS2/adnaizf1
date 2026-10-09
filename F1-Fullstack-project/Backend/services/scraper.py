import logging
def apply_f1_official_standings(data):
    import json
    import os
    import urllib.request
    from bs4 import BeautifulSoup

    year = data.get('year')
    if not year:
        return data
    
    official_drivers = {}
    official_teams = {}
    
    try:
        # Scrape Teams
        req_teams = urllib.request.Request(f'https://www.formula1.com/en/results/{year}/team', headers={'User-Agent': 'Mozilla/5.0'})
        html_teams = urllib.request.urlopen(req_teams).read().decode('utf-8')
        soup_teams = BeautifulSoup(html_teams, 'html.parser')
        table_teams = soup_teams.find('table')
        if table_teams:
            for row in table_teams.find_all('tr')[1:]:
                cols = row.find_all(['th', 'td'])
                if len(cols) >= 3:
                    t_name = cols[1].text.strip()
                    t_points = float(cols[2].text.strip())
                    official_teams[t_name] = t_points

        # Scrape Drivers
        req_drv = urllib.request.Request(f'https://www.formula1.com/en/results/{year}/drivers', headers={'User-Agent': 'Mozilla/5.0'})
        html_drv = urllib.request.urlopen(req_drv).read().decode('utf-8')
        soup_drv = BeautifulSoup(html_drv, 'html.parser')
        table_drv = soup_drv.find('table')
        if table_drv:
            for row in table_drv.find_all('tr')[1:]:
                cols = row.find_all(['th', 'td'])
                if len(cols) >= 5:
                    d_name = cols[1].text.strip().replace('\xa0', ' ')
                    # Clean up 3-letter abbreviations appended to name like "Kimi AntonelliANT"
                    import re
                    d_name = re.sub(r'[A-Z]{3}$', '', d_name)
                    
                    d_points = float(cols[4].text.strip())
                    official_drivers[d_name] = d_points
                    
        print(f"--> Live Scrape F1.com Success! Drivers: {len(official_drivers)}, Teams: {len(official_teams)}")
        
    except Exception as e:
        logging.error(f"Live Scrape failed for {year}, trying local fallback. Error: {e}", exc_info=True)
        fallback_file = f'f1_official_standings_{year}.json'
        if os.path.exists(fallback_file):
            with open(fallback_file, 'r') as f:
                official = json.load(f)
                official_teams = official.get('teams', {})
                official_drivers = official.get('drivers', {})

    if not official_teams and not official_drivers:
        return data # Fallback to FastF1

    try:
        # Update dashboard data
        if 'team_standings' in data:
            for t in data['team_standings']:
                if t['name'] in official_teams:
                    t['points'] = official_teams[t['name']]
            data['team_standings'] = sorted(data['team_standings'], key=lambda x: x['points'], reverse=True)
        if 'driver_standings' in data:
            for d in data['driver_standings']:
                if d['name'] in official_drivers:
                    d['points'] = official_drivers[d['name']]
            data['driver_standings'] = sorted(data['driver_standings'], key=lambda x: x['points'], reverse=True)
            
        # Update championship data
        if 'teams' in data:
            for t in data['teams']:
                if t['name'] in official_teams:
                    t['points'] = official_teams[t['name']]
            data['teams'] = sorted(data['teams'], key=lambda x: x['points'], reverse=True)
            for i, t in enumerate(data['teams']): t['position'] = i + 1
        if 'drivers' in data:
            for d in data['drivers']:
                if d['name'] in official_drivers:
                    d['points'] = official_drivers[d['name']]
            data['drivers'] = sorted(data['drivers'], key=lambda x: x['points'], reverse=True)
            for i, d in enumerate(data['drivers']): d['position'] = i + 1
    except Exception as e:
        logging.error(f"Failed to apply official standings: {e}", exc_info=True)
        
    return data


