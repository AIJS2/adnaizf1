from fastapi import APIRouter, Query
import httpx
import logging
from typing import Optional, Dict, Any

router = APIRouter(prefix="/api/team_radio", tags=["Team Radio"])

logger = logging.getLogger(__name__)

@router.get("")
async def get_team_radio(
    driver_number: Optional[int] = Query(
        None, description="Driver number to filter by"
    ),
    session_key: Optional[str] = Query(
        None,
        description="Session key to filter by (e.g. 9158, 'latest', or 'previous')",
    ),
) -> Dict[str, Any]:
    """
    Fetch team radio communications from OpenF1 API.
    Returns empty array if the upstream API is unavailable or returns no data.
    """
    url = "https://api.openf1.org/v1/team_radio"
    params = {}

    if driver_number is not None:
        params["driver_number"] = driver_number

    if session_key == "previous":
        # Dinamis: Ambil session sebelumnya yang sudah selesai
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                sess_resp = await client.get("https://api.openf1.org/v1/sessions")
                if sess_resp.status_code == 200:
                    sessions = sess_resp.json()
                    from datetime import datetime, timezone
                    now = datetime.now(timezone.utc)
                    past_sessions = []
                    for s in sessions:
                        date_end_str = s.get("date_end")
                        if date_end_str:
                            try:
                                date_end = datetime.fromisoformat(date_end_str.replace('Z', '+00:00'))
                                if date_end < now:
                                    past_sessions.append(s)
                            except Exception:
                                pass
                    
                    if len(past_sessions) >= 1:
                        params["session_key"] = past_sessions[-1]["session_key"]
                    else:
                        params["session_key"] = "latest"
                else:
                    params["session_key"] = "latest"
        except Exception:
            params["session_key"] = "latest"
    elif session_key == "latest" or session_key is None:
        params["session_key"] = "latest"
    else:
        params["session_key"] = session_key

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Jika request adalah 'latest', cek dulu apakah benar-benar ada sesi live
            if params["session_key"] == "latest":
                sess_check = await client.get("https://api.openf1.org/v1/sessions?session_key=latest")
                if sess_check.status_code == 200:
                    sess_data = sess_check.json()
                    if sess_data and len(sess_data) > 0:
                        date_end_str = sess_data[0].get("date_end")
                        if date_end_str:
                            from datetime import datetime, timezone
                            # format: '2026-10-09T13:14:00+00:00'
                            date_end = datetime.fromisoformat(date_end_str.replace('Z', '+00:00'))
                            now = datetime.now(timezone.utc)
                            if now > date_end:
                                # Sesi sudah berakhir, kembalikan kosong untuk 'latest'
                                return {
                                    "status": "success",
                                    "source": "empty",
                                    "session_used": "latest",
                                    "warning": "No live session currently running.",
                                    "data": [],
                                }

            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()

            return {
                "status": "success",
                "source": "openf1",
                "session_used": params.get("session_key"),
                "data": data if isinstance(data, list) else [],
            }

    except (httpx.RequestError, httpx.HTTPStatusError) as e:
        logger.error(
            f"OpenF1 API failed for team_radio: {str(e)}. Returning empty data."
        )

        return {
            "status": "success",
            "source": "empty",
            "session_used": params.get("session_key"),
            "warning": "External API offline or returned error.",
            "data": [],
        }
