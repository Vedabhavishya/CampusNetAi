from collections import Counter

def aggregate_destinations(sessions: list) -> list:
    """
    Groups firewall sessions by destination IP address and computes aggregate stats.
    """
    destinations = {}
    for s in sessions:
        dst = s.get("destination_ip")
        src = s.get("source_ip")
        if not dst:
            continue
            
        if dst not in destinations:
            destinations[dst] = {
                "destination_ip": dst,
                "connection_count": 0,
                "total_bytes": 0,
                "protocols": [],
                "clients": []
            }
            
        d = destinations[dst]
        d["connection_count"] += 1
        d["total_bytes"] += (s.get("bytes_in", 0) + s.get("bytes_out", 0))
        d["protocols"].append(s.get("protocol", "tcp"))
        if src:
            d["clients"].append(src)
            
    res = []
    for dst, d in destinations.items():
        proto_counts = dict(Counter(d["protocols"]))
        client_counts = Counter(d["clients"])
        top_cls = [item[0] for item in client_counts.most_common(3)]
        
        res.append({
            "destination_ip": d["destination_ip"],
            "connection_count": d["connection_count"],
            "total_bytes": d["total_bytes"],
            "protocol_distribution": proto_counts,
            "top_clients": top_cls
        })
    res.sort(key=lambda x: x["connection_count"], reverse=True)
    return res
