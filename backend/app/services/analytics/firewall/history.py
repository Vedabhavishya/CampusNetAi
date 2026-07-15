import os

FIREWALL_HISTORY_LIMIT = int(os.getenv("FIREWALL_HISTORY_LIMIT", "100"))

def maintain_closed_sessions(previous_closed: list, current_sessions: list, previous_sessions: list) -> list:
    """
    Identifies sessions that just closed and appends them to the rolling closed_sessions list.
    """
    closed_sessions = list(previous_closed)
    curr_ids = {s.get("session_id") for s in current_sessions}
    
    for s in previous_sessions:
        if s.get("session_id") not in curr_ids:
            closed_sessions.append(s)
            
    if len(closed_sessions) > FIREWALL_HISTORY_LIMIT:
        closed_sessions = closed_sessions[-FIREWALL_HISTORY_LIMIT:]
        
    return closed_sessions
