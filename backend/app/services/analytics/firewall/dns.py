from ...resolvers.dns_resolver import AsyncDNSResolver

def aggregate_dns(sessions: list) -> list:
    """
    Filters DNS sessions (ports 53, 853, or common servers) and groups by client/server.
    """
    dns_groups = {}
    resolver = AsyncDNSResolver()
    
    for s in sessions:
        dst_port = s.get("destination_port")
        dst_ip = s.get("destination_ip")
        
        # Check standard DNS (53), DNS over TLS (853), or common resolver IPs
        is_dns = (dst_port == 53 or dst_port == 853 or dst_ip in ["8.8.8.8", "8.8.4.4", "1.1.1.1"])
        if not is_dns:
            continue
            
        src = s.get("source_ip")
        if not src or not dst_ip:
            continue
            
        key = (src, dst_ip)
        if key not in dns_groups:
            dns_groups[key] = {
                "client_ip": src,
                "dns_server": dst_ip,
                "query_count": 0,
                "bytes": 0
            }
            
        g = dns_groups[key]
        g["query_count"] += 1
        g["bytes"] += (s.get("bytes_in", 0) + s.get("bytes_out", 0))
        
    res = []
    for key, g in dns_groups.items():
        server_ip = g["dns_server"]
        server_name = resolver.resolve(server_ip)
        resolved_server = f"{server_name} ({server_ip})" if server_name != server_ip else server_ip
        
        res.append({
            "client_ip": g["client_ip"],
            "dns_server": resolved_server,
            "query_count": g["query_count"],
            "bytes": g["bytes"]
        })
    res.sort(key=lambda x: x["query_count"], reverse=True)
    return res
