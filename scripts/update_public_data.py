#!/usr/bin/env python3
import json, urllib.request, re
from datetime import datetime, timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/live-signals.json'
UA='AustinHomeIntelligence/1.0 (https://austinhomeintelligence.com)'

def get(url):
    req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'application/geo+json, application/json'})
    with urllib.request.urlopen(req,timeout=20) as r: return json.load(r)

def wind_num(s):
    nums=[int(x) for x in re.findall(r'\d+',s or '')]
    return max(nums) if nums else 0

try:
    point=get('https://api.weather.gov/points/30.2672,-97.7431')
    forecast=get(point['properties']['forecast'])
    periods=forecast['properties']['periods'][:14]
    temps=[p['temperature'] for p in periods]
    max_t=max(temps); min_t=min(temps)
    precip=max((p.get('probabilityOfPrecipitation') or {}).get('value') or 0 for p in periods)
    max_w=max(wind_num(p.get('windSpeed','')) for p in periods)
    risks={
      'heat':{'value':f'{max_t}°F max','level':'High' if max_t>=100 else 'Elevated' if max_t>=95 else 'Moderate' if max_t>=88 else 'Low'},
      'freeze':{'value':f'{min_t}°F min','level':'High' if min_t<=28 else 'Elevated' if min_t<=32 else 'Low'},
      'rain':{'value':f'{precip}% peak','level':'High' if precip>=70 else 'Elevated' if precip>=50 else 'Moderate' if precip>=30 else 'Low'},
      'wind':{'value':f'{max_w} mph max','level':'High' if max_w>=35 else 'Elevated' if max_w>=25 else 'Moderate' if max_w>=18 else 'Low'}
    }
    now=datetime.now(timezone.utc)
    payload={'generated_at':now.isoformat(),'generated_at_display':now.strftime('%b %d, %Y %H:%M UTC'),'location':'Austin, Texas','window':'NWS forecast periods, approximately 7 days','risks':risks,'sources':['https://api.weather.gov/points/30.2672,-97.7431','https://www.weather.gov/ewx/'],'limitations':'These are near-term environmental signals, not predictions that a home component will fail.'}
    OUT.write_text(json.dumps(payload,indent=2))
    print('updated',OUT)
except Exception as e:
    print('update failed:',e)
    raise
