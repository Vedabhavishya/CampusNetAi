import unittest
from unittest.mock import MagicMock, patch
import os
import sys

# Ensure backend directory is in the path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../..")))

from app.services.collectors.parsers.srx_parser import SRXParser
from app.services.collectors.telemetry_cache import telemetry_cache
from app.services.collectors.srx_collector import SRXCollector
from app.services.collectors.ssh_manager import SSHManager

class TestCollectorsFramework(unittest.TestCase):
    def setUp(self):
        self.parser = SRXParser()

    def test_srx_parser_version(self):
        version_output = """
Hostname: test-firewall
Model: srx300
Junos: 21.4R3-S3.4
JUNOS Software Release [21.4R3-S3.4]
"""
        parsed = self.parser.parse_version(version_output)
        self.assertEqual(parsed["hostname"], "test-firewall")
        self.assertEqual(parsed["model"], "SRX300")
        self.assertEqual(parsed["junos"], "21.4R3-S3.4")

    def test_srx_parser_uptime(self):
        uptime_output = """
Current time: 2026-07-12 17:00:00 UTC
System booted: 2026-06-01 10:00:00 UTC (6 hours ago)
Protocols started: 2026-06-01 10:01:00 UTC (5 hours, 59 mins ago)
"""
        uptime = self.parser.parse_uptime(uptime_output)
        self.assertEqual(uptime, "6 hours")

    def test_srx_parser_chassis(self):
        chassis_output = """
Routing Engine 0 status:
  Temperature                 38 degrees C / 100 degrees F
  CPU temperature             42 degrees C / 107 degrees F
  Total memory              4096 MB (4096MB memory installed)
  Memory utilization          35 percent
  CPU status:
    User                      10 percent
    Kernel                     5 percent
    Idle                      85 percent
"""
        parsed = self.parser.parse_chassis(chassis_output)
        self.assertEqual(parsed["temperature"]["system"], 38)
        self.assertEqual(parsed["temperature"]["cpu"], 42)
        self.assertEqual(parsed["cpu"]["idle"], 85)
        self.assertEqual(parsed["cpu"]["user"], 10)
        self.assertEqual(parsed["cpu"]["kernel"], 5)
        self.assertEqual(parsed["memory"]["usage"], 35)
        self.assertEqual(parsed["memory"]["total"], 4096)
        self.assertEqual(parsed["memory"]["used"], 1433)

    def test_srx_parser_interfaces(self):
        interfaces_output = """
Interface               Admin Link Proto    Local                 Remote
ge-0/0/0.0              up    up   inet     203.0.113.2/24
ge-0/0/1.0              up    up   inet     10.10.10.1/24
ge-0/0/2.0              down  down inet     10.10.20.1/24
"""
        parsed = self.parser.parse_interfaces(interfaces_output)
        self.assertEqual(len(parsed), 3)
        self.assertEqual(parsed[0]["interface"], "ge-0/0/0.0")
        self.assertEqual(parsed[0]["admin"], "up")
        self.assertEqual(parsed[0]["link"], "up")
        self.assertEqual(parsed[0]["ip"], "203.0.113.2/24")
        self.assertEqual(parsed[2]["admin"], "down")
        self.assertEqual(parsed[2]["link"], "down")

    def test_srx_parser_routes(self):
        routes_output = """
inet.0: 3 destinations, 3 routes (3 active, 0 holddown, 0 hidden)
+ = Active Route, - = Last Active, * = Both

0.0.0.0/0          *[Static/5] 05:50:00
                    > to 203.0.113.1 via ge-0/0/0.0
10.10.10.0/24      *[Direct/0] 06:12:04
                    > via ge-0/0/1.0
"""
        parsed = self.parser.parse_routes(routes_output)
        self.assertEqual(len(parsed), 2)
        self.assertEqual(parsed[0]["destination"], "0.0.0.0/0")
        self.assertEqual(parsed[0]["gateway"], "203.0.113.1")
        self.assertEqual(parsed[0]["interface"], "ge-0/0/0.0")
        self.assertEqual(parsed[1]["destination"], "10.10.10.0/24")
        self.assertEqual(parsed[1]["gateway"], "Direct")
        self.assertEqual(parsed[1]["interface"], "ge-0/0/1.0")

    def test_srx_parser_security(self):
        zones_output = """
Security zone: trust
  Interfaces:
    ge-0/0/1.0
    ge-0/0/2.0
Security zone: untrust
  Interfaces:
    ge-0/0/0.0
"""
        policies_output = """
From zone: trust, To zone: untrust
  Policy: Allow-Web, State: enabled, Type: administrative, Action: permit
From zone: untrust, To zone: trust
  Policy: Block-All, State: enabled, Type: administrative, Action: deny
"""
        parsed = self.parser.parse_security(zones_output, policies_output)
        self.assertEqual(len(parsed["zones"]), 2)
        self.assertEqual(parsed["zones"][0]["zone"], "trust")
        self.assertEqual(parsed["zones"][0]["interfaces"], ["ge-0/0/1.0", "ge-0/0/2.0"])
        self.assertEqual(len(parsed["policies"]), 2)
        self.assertEqual(parsed["policies"][0]["policyName"], "Allow-Web")
        self.assertEqual(parsed["policies"][0]["state"], "enabled")

    def test_srx_parser_sessions_arp(self):
        sessions_output = """
Total sessions: 1482
"""
        arp_output = """
MAC Address       Address         Interface           Flags
00:0b:82:11:a3:f1 192.168.1.1     ge-0/0/0.0          [none]
00:15:5d:83:b2:1a 10.10.10.122    ge-0/0/1.0          [none]
"""
        parsed = self.parser.parse_sessions_arp(sessions_output, arp_output)
        self.assertEqual(parsed["active_sessions"], 1482)
        self.assertEqual(parsed["arp_entries_count"], 2)

    def test_telemetry_cache(self):
        telemetry_cache.set("test-device", {"status": "online", "health": 100})
        cached = telemetry_cache.get("test-device")
        self.assertIsNotNone(cached)
        self.assertEqual(cached["status"], "online")
        
        # Test clear
        telemetry_cache.clear()
        self.assertIsNone(telemetry_cache.get("test-device"))

    @patch('app.services.collectors.srx_collector.SSHManager')
    def test_srx_collector_mock_fallback(self, mock_ssh_manager_class):
        mock_ssh = mock_ssh_manager_class.return_value
        mock_ssh.connect.side_effect = Exception("Connection Timed Out")
        
        # Enable mock fallback in environment
        os.environ["USE_MOCK_FALLBACK"] = "true"
        collector = SRXCollector()
        status = collector.collect()
        
        self.assertEqual(status["status"], "online")
        self.assertEqual(status["model"], "Juniper SRX300 (Mock)")

    @patch('app.services.collectors.srx_collector.SSHManager')
    def test_srx_collector_no_mock_fallback(self, mock_ssh_manager_class):
        mock_ssh = mock_ssh_manager_class.return_value
        mock_ssh.connect.return_value = False
        
        # Disable mock fallback in environment
        os.environ["USE_MOCK_FALLBACK"] = "false"
        collector = SRXCollector()
        status = collector.collect()
        
        self.assertEqual(status["connected"], False)
        self.assertEqual(status["status"], "offline")
        self.assertEqual(status["reason"], "SSH Connection Failed")

if __name__ == '__main__':
    unittest.main()
