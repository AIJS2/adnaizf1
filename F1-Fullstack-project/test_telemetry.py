import asyncio
import sys
sys.path.append('backend')
from services.telemetry_service import process_telemetry_compare

def main():
    try:
        res = process_telemetry_compare(2026, 17, ['LEC', 'NOR', 'VER'], None)
        print('Success! Keys in result:', res.keys())
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
