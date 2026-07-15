from ...detectors.firewall_detector import ApplicationDetector

def aggregate_applications(sessions: list) -> list:
    """
    Groups firewall sessions by classified application name and computes totals.
    """
    detector = ApplicationDetector()
    apps = {}
    
    for s in sessions:
        dst_port = s.get("destination_port")
        proto = s.get("protocol", "tcp")
        app_name = detector.detect(dst_port, proto)
        
        if app_name not in apps:
            apps[app_name] = {
                "application": app_name,
                "session_count": 0,
                "bytes": 0,
                "packets": 0
            }
            
        a = apps[app_name]
        a["session_count"] += 1
        a["bytes"] += (s.get("bytes_in", 0) + s.get("bytes_out", 0))
        a["packets"] += (s.get("packets_in", 0) + s.get("packets_out", 0))
        
    res = list(apps.values())
    res.sort(key=lambda x: x["session_count"], reverse=True)
    return res
