# Central registry for physical hardware SSH command templates

SRX_COMMANDS = {
    "version": "show version",
    "uptime": "show system uptime",
    "cpu": "show chassis routing-engine",
    "interfaces": "show interfaces terse",
    "routes": "show route",
    "zones": "show security zones",
    "policies": "show security policies",
    "sessions": "show security flow session summary",
    "arp": "show arp"
}

# Future EX Switch Command Registry Placeholder
EX_COMMANDS = {
    "version": "show version",
    "uptime": "show system uptime",
    "chassis": "show chassis environment",
    "interfaces": "show interfaces terse",
    "vlans": "show vlans",
    "lldp": "show lldp neighbors"
}

# Future Standalone AP Command Registry Placeholder
AP_COMMANDS = {
    "version": "uname -a",
    "uptime": "uptime",
    "wireless": "iwconfig",
    "clients": "hostapd_cli all_config"
}
