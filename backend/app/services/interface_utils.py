import re
from typing import Iterable

def is_physical_switch_port(iface_name: str, available_interfaces: Iterable[str]) -> bool:
    """
    Determines if an interface name is a configurable physical switch port.
    
    Rules:
    - Excludes logical subinterfaces containing a dot (.).
    - Whitelists ge*, xe*, and et* naming conventions.
    - If ge* interfaces exist, xe* and et* interfaces are treated as uplinks
      and excluded, unless the device only exposes xe*/et* interfaces.
    """
    if not iface_name or "." in iface_name:
        return False
        
    # Whitelist physical interface patterns
    # Match ge-X/Y/Z, xe-X/Y/Z, et-X/Y/Z or geX, xeX, etX
    is_physical = bool(re.match(r"^(ge|xe|et)-\d+/\d+/\d+$", iface_name) or re.match(r"^(ge|xe|et)\d+$", iface_name))
    if not is_physical:
        return False
        
    # Gather all valid physical interface candidates from available_interfaces
    candidates = []
    for name in available_interfaces:
        if name and "." not in name:
            if re.match(r"^(ge|xe|et)-\d+/\d+/\d+$", name) or re.match(r"^(ge|xe|et)\d+$", name):
                candidates.append(name)
                
    # If one or more ge interfaces exist, treat xe* and et* as uplinks and exclude them
    has_ge = any(name.startswith("ge") for name in candidates)
    if has_ge and (iface_name.startswith("xe") or iface_name.startswith("et")):
        return False
        
    return True
