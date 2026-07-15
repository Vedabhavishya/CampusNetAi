import os
import datetime
from .firewall.clients import aggregate_clients
from .firewall.destinations import aggregate_destinations
from .firewall.bandwidth import aggregate_bandwidth
from .firewall.dns import aggregate_dns
from .firewall.applications import aggregate_applications
from .firewall.events import generate_events
from .firewall.history import maintain_closed_sessions
from .firewall.anomaly import FirewallAnomalyDetector

EVENT_HISTORY_LIMIT = int(os.getenv("EVENT_HISTORY_LIMIT", "500"))

class FirewallAnalytics:
    """
    Façade that groups firewall submodules together for telemetry analytics.
    """
    def __init__(self):
        self.anomaly_detector = FirewallAnomalyDetector()

    def analyze(self, current_sessions: list, previous_sessions: list, interfaces: list, routes: list, previous_interfaces: list = None, previous_routes: list = None, previous_closed: list = None, previous_events: list = None) -> dict:
        # 1. Compute aggregations
        top_cls = aggregate_clients(current_sessions)
        top_dsts = aggregate_destinations(current_sessions)
        bw = aggregate_bandwidth(current_sessions)
        dns_act = aggregate_dns(current_sessions)
        apps = aggregate_applications(current_sessions)
        
        # 2. Compute events delta
        new_events = generate_events(
            previous_sessions, 
            current_sessions, 
            interfaces, 
            routes, 
            previous_interfaces, 
            previous_routes
        )
        
        # 3. Detect anomalies and translate to events
        anomalies = self.anomaly_detector.detect(current_sessions)
        now_str = datetime.datetime.utcnow().isoformat() + "Z"
        for a in anomalies:
            new_events.append({
                "type": "historical",
                "event": "Anomaly Detected",
                "message": f"[{a['category'].upper()}] {a['title']}: {a['description']} (Mitigation: {a['mitigation']})",
                "timestamp": now_str,
                "severity": a["severity"]
            })
            
        # Maintain events log queue
        events_list = list(previous_events or [])
        events_list.extend(new_events)
        if len(events_list) > EVENT_HISTORY_LIMIT:
            events_list = events_list[-EVENT_HISTORY_LIMIT:]
            
        # 4. Maintain closed sessions history log
        closed_list = maintain_closed_sessions(
            previous_closed or [], 
            current_sessions, 
            previous_sessions
        )
        
        return {
            "top_clients": top_cls,
            "top_destinations": top_dsts,
            "bandwidth": bw,
            "dns": dns_act,
            "applications": apps,
            "closed_sessions": closed_list,
            "events": events_list
        }
