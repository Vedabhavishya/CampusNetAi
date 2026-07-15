def aggregate_bandwidth(sessions: list) -> dict:
    """
    Computes global firewall bandwidth stats and per-client bandwidth usage.
    """
    total_up = 0
    total_down = 0
    client_usage = {}
    
    for s in sessions:
        src = s.get("source_ip")
        up = s.get("bytes_in", 0)
        down = s.get("bytes_out", 0)
        total_up += up
        total_down += down
        
        if src:
            if src not in client_usage:
                client_usage[src] = {
                    "client_ip": src,
                    "upload": 0,
                    "download": 0,
                    "total": 0
                }
            u = client_usage[src]
            u["upload"] += up
            u["download"] += down
            u["total"] += (up + down)
            
    clients_list = list(client_usage.values())
    clients_list.sort(key=lambda x: x["total"], reverse=True)
    
    return {
        "total_upload_bytes": total_up,
        "total_download_bytes": total_down,
        "total_throughput_bytes": total_up + total_down,
        "client_bandwidth_usage": clients_list
    }
