import unittest
from unittest.mock import MagicMock, patch
import os
import sys

# Ensure backend directory is in the path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../..")))

from app.services.collectors.parsers.ex2300_parser import EX2300Parser
from app.services.collectors.ex2300_collector import EX2300Collector
from app.services.collectors.telemetry_cache import telemetry_cache

class TestEX2300Collector(unittest.TestCase):
    def setUp(self):
        self.parser = EX2300Parser()

    def test_ex2300_parser_version_real_junos(self):
        # actual switch output simulation for EX2300-C-12P running JunOS 21.4R3-S7.6
        version_output = """
Hostname: cn-as-lobby
Model: ex2300-c-12p
Junos: 21.4R3-S7.6
JUNOS Software Release [21.4R3-S7.6]
"""
        parsed = self.parser.parse_version(version_output)
        self.assertEqual(parsed["hostname"], "cn-as-lobby")
        self.assertEqual(parsed["model"], "EX2300-C-12P")
        self.assertEqual(parsed["junos"], "21.4R3-S7.6")
        self.assertEqual(parsed["device_type"], "Access Switch")

    def test_ex2300_parser_version_fallback(self):
        # Empty version output fallback verification
        parsed = self.parser.parse_version("")
        self.assertEqual(parsed["model"], "EX2300-C-12P")
        self.assertEqual(parsed["junos"], "21.4R3-S7.6")
        self.assertEqual(parsed["device_type"], "Access Switch")

    def test_ex2300_collector_mock_fallback_12p(self):
        # Verify mock fallback dynamic port count matching EX2300-C-12P
        collector = EX2300Collector()
        mock_data = {
            "health_score": 95,
            "cpu_usage": 15,
            "memory_usage": 40,
            "uptime": "10 days, 2 hours",
            "model": "Juniper EX2300-C-12P",
            "version": "JunOS 21.4R3-S7.6"
        }
        
        # Call get_mock_telemetry
        result = collector.get_mock_telemetry("192.168.99.3", 1000, mock_data, [])
        self.assertEqual(result["model"], "Juniper EX2300-C-12P")
        self.assertEqual(result["inventory"]["model"], "Juniper EX2300-C-12P")
        
        # Assert ge-0/0/0 to ge-0/0/11 exist, and total interfaces is 14 (12 + 2 uplinks)
        interfaces = result["telemetry"]["interfaces"]
        self.assertEqual(len(interfaces), 14)
        self.assertEqual(interfaces[0]["interface"], "ge-0/0/0")
        self.assertEqual(interfaces[11]["interface"], "ge-0/0/11")
        self.assertEqual(interfaces[12]["interface"], "xe-0/0/0")
        self.assertEqual(interfaces[13]["interface"], "xe-0/0/1")

    def test_ex2300_collector_mock_fallback_48p(self):
        # Verify mock fallback dynamic port count matching EX2300-48P
        collector = EX2300Collector()
        mock_data = {
            "health_score": 95,
            "cpu_usage": 15,
            "memory_usage": 40,
            "uptime": "10 days, 2 hours",
            "model": "Juniper EX2300-48P",
            "version": "JunOS 21.2R3.5"
        }
        
        result = collector.get_mock_telemetry("192.168.99.3", 1000, mock_data, [])
        self.assertEqual(result["model"], "Juniper EX2300-48P")
        
        # Total interfaces should be 50 (48 + 2 uplinks)
        interfaces = result["telemetry"]["interfaces"]
        self.assertEqual(len(interfaces), 50)
        self.assertEqual(interfaces[0]["interface"], "ge-0/0/0")
        self.assertEqual(interfaces[47]["interface"], "ge-0/0/47")
        self.assertEqual(interfaces[48]["interface"], "xe-0/0/0")
        self.assertEqual(interfaces[49]["interface"], "xe-0/0/1")

if __name__ == "__main__":
    unittest.main()
