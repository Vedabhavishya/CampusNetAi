from collections import Counter
import datetime

def aggregate_clients(sessions: list) -> list:
    """
    Groups firewall sessions by client IP address and computes aggregate stats.
    """
    clients = {}
    now_str = datetime.datetime.utcnow().isoformat() + "Z"
    
    for s in sessions:
        src = s.get("source_ip")
        if not src:
            continue
            
        if src not in clients:
            clients[src] = {
                "client_ip": src,
                "total_sessions": 0,
                "total_upload_bytes": 0,
                "total_download_bytes": 0,
                "total_packets": 0,
                "protocols": [],
                "last_activity": now_str
            }
            
        c = clients[src]
        c["total_sessions"] += 1
        c["total_upload_bytes"] += s.get("bytes_in", 0)
        c["total_download_bytes"] += s.get("bytes_out", 0)
        c["total_packets"] += (s.get("packets_in", 0) + s.get("packets_out", 0))
        c["protocols"].append(s.get("protocol", "tcp"))
        
    res = []
    for src, c in clients.items():
        proto_counter = Counter(c["protocols"])
        most_used = proto_counter.most_common(1)[0][0] if c["protocols"] else "tcp"
        res.append({
            "client_ip": c["client_ip"],
            "total_sessions": c["total_sessions"],
            "total_upload_bytes": c["total_upload_bytes"],
            "total_download_bytes": c["total_download_bytes"],
            "total_packets": c["total_packets"],
            "most_used_protocol": most_used,
            "last_activity": c["last_activity"]
        })
    res.sort(key=lambda x: x["total_sessions"], reverse=True)
    return res
