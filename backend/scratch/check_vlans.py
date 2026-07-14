import sys
import os

# Ensure backend directory is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.collectors.telemetry_cache import telemetry_cache

cached = telemetry_cache.get("dev-cs-1")
if cached:
    print("KEYS in cached:")
    print(cached.keys())
    
    if "telemetry" in cached:
        telemetry = cached["telemetry"]
        if telemetry:
            print("KEYS in telemetry:")
            print(telemetry.keys())
            
            # Print raw command output if stored in collector/debug
            # Oh, wait, in ex4100_collector.py, we store raw outputs on self._raw_telemetry,
            # but is it in the cached dict?
            # Let's print the entire cached dict (excluding interfaces to keep it small)!
            cached_copy = dict(cached)
            if "telemetry" in cached_copy and cached_copy["telemetry"]:
                t_copy = dict(cached_copy["telemetry"])
                if "interfaces" in t_copy:
                    t_copy["interfaces"] = f"<{len(t_copy['interfaces'])} interfaces>"
                cached_copy["telemetry"] = t_copy
            
            import pprint
            pprint.pprint(cached_copy)
else:
    print("No cache found for dev-cs-1")
