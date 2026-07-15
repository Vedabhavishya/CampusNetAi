import datetime

def generate_events(previous_sessions: list, current_sessions: list, interfaces: list, routes: list, previous_interfaces: list = None, previous_routes: list = None) -> list:
    """
    Compares telemetry deltas between polling cycles and generates events.
    Splits them into realtime (sessions) and historical (topology/routing) alerts.
    """
    events = []
    now_str = datetime.datetime.utcnow().isoformat() + "Z"
    
    # 1. Session events (Realtime)
    prev_ids = {s.get("session_id"): s for s in previous_sessions}
    curr_ids = {s.get("session_id"): s for s in current_sessions}
    
    # Session Open
    for sid, s in curr_ids.items():
        if sid not in prev_ids:
            events.append({
                "type": "realtime",
                "event": "Session Open",
                "message": f"New session created: {s.get('source_ip')}:{s.get('source_port')} -> {s.get('destination_ip')}:{s.get('destination_port')} ({s.get('protocol', '').upper()})",
                "timestamp": now_str,
                "severity": "info"
            })
            
    # Session Close
    for sid, s in prev_ids.items():
        if sid not in curr_ids:
            events.append({
                "type": "realtime",
                "event": "Session Close",
                "message": f"Session terminated: {s.get('source_ip')}:{s.get('source_port')} -> {s.get('destination_ip')}:{s.get('destination_port')} ({s.get('protocol', '').upper()})",
                "timestamp": now_str,
                "severity": "info"
            })
            
    # 2. Interface down events (Historical)
    prev_ifaces = {i.get("interface"): i for i in (previous_interfaces or [])}
    for iface in interfaces:
        name = iface.get("interface")
        link = iface.get("link")
        prev = prev_ifaces.get(name)
        if prev and prev.get("link") == "up" and link == "down":
            events.append({
                "type": "historical",
                "event": "Interface Down",
                "message": f"Interface {name} link status transitioned to DOWN",
                "timestamp": now_str,
                "severity": "critical"
            })
            
    # 3. Route change events (Historical)
    prev_r_map = {r.get("destination"): r for r in (previous_routes or [])}
    for r in routes:
        dest = r.get("destination")
        gw = r.get("gateway")
        prev = prev_r_map.get(dest)
        if prev and prev.get("gateway") != gw:
            events.append({
                "type": "historical",
                "event": "Route Changed",
                "message": f"Routing path for {dest} modified to gateway {gw}",
                "timestamp": now_str,
                "severity": "warning"
            })
            
    return events
