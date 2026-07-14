import unittest
from unittest.mock import MagicMock, patch
import os
import sys

# Ensure backend directory is in the path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../..")))

from app.services.collectors.parsers.ex4100_parser import EX4100Parser
from app.services.collectors.ex4100_collector import EX4100Collector
from app.services.collectors.telemetry_cache import telemetry_cache
from app.services.collectors.commands import EX4100_COMMANDS

class TestEX4100Collector(unittest.TestCase):
    def setUp(self):
        self.parser = EX4100Parser()

    def test_ex4100_parser_version(self):
        version_output = """
Hostname: test-switch
Model: ex4100-24t
Junos: 22.4R1.10
JUNOS Software Release [22.4R1.10]
"""
        parsed = self.parser.parse_version(version_output)
        self.assertEqual(parsed["hostname"], "test-switch")
        self.assertEqual(parsed["model"], "EX4100-24T")
        self.assertEqual(parsed["junos"], "22.4R1.10")

    def test_ex4100_parser_uptime(self):
        uptime_output = """
System booted: 2026-02-21 08:30:10 UTC (142 days, 2 hours ago)
"""
        uptime = self.parser.parse_uptime(uptime_output)
        self.assertEqual(uptime, "142 days, 2 hours")

    def test_ex4100_parser_chassis(self):
        chassis_output = """
Routing Engine 0 status:
  Temperature                 38 degrees C / 100 degrees F
  CPU temperature             42 degrees C / 107 degrees F
  Total memory              8192 MB (8192MB memory installed)
  Memory utilization          42 percent
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
        self.assertEqual(parsed["memory"]["usage"], 42)
        self.assertEqual(parsed["memory"]["total"], 8192)
        self.assertEqual(parsed["memory"]["used"], 3440)

    def test_ex4100_parser_interfaces(self):
        interfaces_output = """
Interface               Admin Link Proto    Local                 Remote
ge-0/0/0.0              up    up   eth-switch
ge-0/0/1.0              up    up   eth-switch
ge-0/0/2.0              down  down eth-switch
vlan.0                  up    up   inet     10.10.10.2/24
"""
        parsed = self.parser.parse_interfaces(interfaces_output)
        self.assertEqual(len(parsed), 4)
        self.assertEqual(parsed[0]["interface"], "ge-0/0/0.0")
        self.assertEqual(parsed[0]["admin"], "up")
        self.assertEqual(parsed[0]["link"], "up")
        self.assertEqual(parsed[3]["interface"], "vlan.0")
        self.assertEqual(parsed[3]["ip"], "10.10.10.2/24")

    def test_ex4100_parser_vlans(self):
        vlans_output = """
VLAN Name        Tag     Interfaces
default          1       ge-0/0/2.0, ge-0/0/3.0
vlan-10          10      ae0.0*, ge-0/0/4.0
vlan-20          20      ae1.0*, ge-0/0/5.0
"""
        parsed = self.parser.parse_vlans(vlans_output)
        self.assertEqual(len(parsed), 3)
        self.assertEqual(parsed[0]["name"], "default")
        self.assertEqual(parsed[0]["id"], 1)
        self.assertEqual(parsed[0]["vlan_id"], 1)
        self.assertEqual(parsed[0]["members"], ["ge-0/0/2.0", "ge-0/0/3.0"])
        self.assertEqual(parsed[1]["name"], "vlan-10")
        self.assertEqual(parsed[1]["id"], 10)
        self.assertEqual(parsed[1]["members"], ["ae0.0", "ge-0/0/4.0"])

    def test_ex4100_parser_vlans_multiline(self):
        vlans_output = """
default          1
                 ge-0/0/0.0
                 ge-0/0/1.0
                 ge-0/0/2.0
"""
        parsed = self.parser.parse_vlans(vlans_output)
        self.assertEqual(len(parsed), 1)
        self.assertEqual(parsed[0]["name"], "default")
        self.assertEqual(parsed[0]["vlan_id"], 1)
        self.assertEqual(parsed[0]["members"], ["ge-0/0/0.0", "ge-0/0/1.0", "ge-0/0/2.0"])

    def test_ex4100_parser_vlans_single(self):
        vlans_output = """
vlan-99          99      ge-0/0/12.0
"""
        parsed = self.parser.parse_vlans(vlans_output)
        self.assertEqual(len(parsed), 1)
        self.assertEqual(parsed[0]["name"], "vlan-99")
        self.assertEqual(parsed[0]["vlan_id"], 99)
        self.assertEqual(parsed[0]["members"], ["ge-0/0/12.0"])

    def test_ex4100_parser_vlans_different_spacing(self):
        vlans_output = """
Routing Instance: default
VLAN Name	Tag	State	Interfaces
vlan-100	100	Active	ae0.0,
			ge-0/0/10.0*
vlan-200        200     Active  -
"""
        parsed = self.parser.parse_vlans(vlans_output)
        self.assertEqual(len(parsed), 2)
        self.assertEqual(parsed[0]["name"], "vlan-100")
        self.assertEqual(parsed[0]["vlan_id"], 100)
        self.assertEqual(parsed[0]["members"], ["ae0.0", "ge-0/0/10.0"])
        self.assertEqual(parsed[1]["name"], "vlan-200")
        self.assertEqual(parsed[1]["vlan_id"], 200)
        self.assertEqual(parsed[1]["members"], [])

    def test_ex4100_parser_vlans_live_format(self):
        vlans_output = """
Routing instance        VLAN name             Tag          Interfaces
default-switch          FACULTY               20       
                                                           ge-0/0/9.0*
default-switch          MGMT                  99       
                                                           ge-0/0/12.0*
                                                           ge-0/0/9.0*
default-switch          default               1        
                                                           ge-0/0/0.0
                                                           ge-0/0/1.0
"""
        parsed = self.parser.parse_vlans(vlans_output)
        self.assertEqual(len(parsed), 3)
        self.assertEqual(parsed[0]["name"], "FACULTY")
        self.assertEqual(parsed[0]["vlan_id"], 20)
        self.assertEqual(parsed[0]["members"], ["ge-0/0/9.0"])
        self.assertEqual(parsed[1]["name"], "MGMT")
        self.assertEqual(parsed[1]["vlan_id"], 99)
        self.assertEqual(parsed[1]["members"], ["ge-0/0/12.0", "ge-0/0/9.0"])
        self.assertEqual(parsed[2]["name"], "default")
        self.assertEqual(parsed[2]["vlan_id"], 1)
        self.assertEqual(parsed[2]["members"], ["ge-0/0/0.0", "ge-0/0/1.0"])

    def test_ex4100_parser_mac_table(self):
        mac_output = """
Ethernet-switching table: 2 entries
  VLAN/BD                MAC address       Type       Age      Interfaces
  vlan-10                00:15:5d:83:b2:1a D          -        ge-0/0/4.0
  vlan-20                f4:0f:24:d1:88:c2 D          -        ge-0/0/5.0
"""
        parsed = self.parser.parse_mac_table(mac_output)
        self.assertEqual(len(parsed), 2)
        self.assertEqual(parsed[0]["mac_address"], "00:15:5d:83:b2:1a")
        self.assertEqual(parsed[0]["vlan"], "vlan-10")
        self.assertEqual(parsed[0]["interface"], "ge-0/0/4.0")
        self.assertEqual(parsed[0]["type"], "Dynamic")

    def test_ex4100_parser_lldp(self):
        lldp_output = """
Local Interface    Parent Interface    Chassis Id          Port info          System Name
ge-0/0/0.0         -                   00:0b:82:11:a3:f1   ge-0/0/0.0         srx300 firewall
ge-0/0/1.0         -                   00:0b:82:33:c5:11   ge-0/0/4.0         ex2300 switch
"""
        parsed = self.parser.parse_lldp(lldp_output)
        self.assertEqual(len(parsed), 2)
        self.assertEqual(parsed[0]["local_interface"], "ge-0/0/0.0")
        self.assertEqual(parsed[0]["neighbor_hostname"], "srx300 firewall")
        self.assertEqual(parsed[0]["neighbor_interface"], "ge-0/0/0.0")
        self.assertEqual(parsed[0]["neighbor_chassis_id"], "00:0b:82:11:a3:f1")

    def test_ex4100_parser_interface_stats(self):
        stats_output = """
Physical interface: ge-0/0/0, Enabled, Physical link is Up
  Link status: Up
  Speed: 1000mbps, Duplex: Full-duplex
  Input packets: 124802, Output packets: 98402
  Input bytes: 14820491, Output bytes: 11029402
  Input errors: 0, Output errors: 0
  Input drops: 0, Output drops: 0
  Carrier transitions: 1
  Input MAC statistics:
    CRC errors: 0
  Input bandwidth  : 1500 bps
  Output bandwidth : 2500 bps
"""
        parsed = self.parser.parse_interface_stats(stats_output)
        self.assertIn("ge-0/0/0", parsed["ports"])
        p = parsed["ports"]["ge-0/0/0"]
        self.assertEqual(p["speed"], "1000mbps")
        self.assertEqual(p["duplex"], "Full-duplex")
        self.assertEqual(p["rx_bytes"], 14820491)
        self.assertEqual(p["tx_bytes"], 11029402)
        self.assertEqual(p["input_errors"], 0)
        self.assertEqual(p["crc_errors"], 0)
        self.assertEqual(parsed["aggregate"]["total_rx"], 14820491)
        self.assertEqual(parsed["aggregate"]["total_tx"], 11029402)

    def test_parser_validation_empty_input(self):
        self.assertEqual(self.parser.parse_version(""), {
            "model": "EX4100-24T",
            "junos": "22.4R1.10",
            "hostname": "ex4100 router",
            "vendor": "Juniper",
            "device_type": "Core Switch"
        })
        self.assertEqual(self.parser.parse_uptime(""), "142 days, 2 hours")
        self.assertEqual(self.parser.parse_chassis(""), {
            "cpu": {"user": 0, "kernel": 0, "idle": 100},
            "memory": {"total": 8192, "used": 0, "usage": 0},
            "temperature": {"system": 38, "cpu": 42}
        })
        self.assertEqual(self.parser.parse_interfaces(""), [])
        self.assertEqual(self.parser.parse_vlans(""), [])
        self.assertEqual(self.parser.parse_mac_table(""), [])
        self.assertEqual(self.parser.parse_lldp(""), [])
        self.assertEqual(self.parser.parse_interface_stats("")["ports"], {})
 
    @patch('app.services.collectors.ex4100_collector.SSHManager')
    def test_ex4100_collector_mock_fallback(self, mock_ssh_manager_class):
        mock_ssh = mock_ssh_manager_class.return_value
        mock_ssh.connect.side_effect = Exception("Connection Failed")
        
        os.environ["USE_MOCK_FALLBACK"] = "true"
        collector = EX4100Collector()
        status = collector.collect()
        
        self.assertEqual(status["status"], "online")
        self.assertEqual(status["model"], "Juniper EX4400-24T (Mock)")
        self.assertEqual(status["telemetry"]["hostname"], "ex4100 router")
        self.assertEqual(len(status["telemetry"]["vlans"]), 1)

    @patch('app.services.collectors.ex4100_collector.SSHManager')
    def test_ex4100_collector_partial_failures(self, mock_ssh_manager_class):
        mock_ssh = mock_ssh_manager_class.return_value
        mock_ssh.connect.return_value = True
        
        # Mock run_command to succeed for version and uptime but raise for routing_engine
        def side_effect(cmd, timeout=10):
            if "show version" in cmd:
                return "Model: ex4100-24t\nHostname: test-switch\nJunos: 22.4R1.10"
            elif "show system uptime" in cmd:
                return "System booted: 2026-02-21 08:30:10 UTC (142 days, 2 hours ago)"
            elif "show chassis routing-engine" in cmd:
                raise Exception("Command Timeout")
            return "" # Empty/default for others
            
        mock_ssh.run_command.side_effect = side_effect
        
        os.environ["USE_MOCK_FALLBACK"] = "false"
        collector = EX4100Collector()
        status = collector.collect()
        
        self.assertEqual(status["status"], "online")
        self.assertEqual(status["model"], "EX4100-24T")
        # Health score must be calculated: 100 - 5 (for 1 command failure) = 95
        self.assertEqual(status["health_score"], 95)
        self.assertEqual(status["telemetry"]["hostname"], "test-switch")
        self.assertEqual(status["collector"]["commands_failed"], 1)

    def test_calculate_health_score(self):
        from app.services.collectors.base_collector import calculate_health_score
        
        # Connected, normal state -> 100
        score = calculate_health_score(
            connected=True, cpu_usage=10.0, memory_usage=20.0, temperature=35.0,
            down_interfaces_count=0, error_interfaces_count=0, command_failures_count=0
        )
        self.assertEqual(score, 100)
        
        # Offline state -> 0
        score_offline = calculate_health_score(
            connected=False, cpu_usage=10.0, memory_usage=20.0, temperature=35.0,
            down_interfaces_count=0, error_interfaces_count=0, command_failures_count=0
        )
        self.assertEqual(score_offline, 0)
        
        # High CPU (critical > 90) -> -20
        # High Memory (warning > 80) -> -10
        # Temp (critical > 70) -> -25
        # 1 down interface -> -1
        # 1 error interface -> -2
        # 1 failed command -> -5
        # Expected: 100 - 20 - 10 - 25 - 1 - 2 - 5 = 37
        score_degraded = calculate_health_score(
            connected=True, cpu_usage=95.0, memory_usage=85.0, temperature=72.0,
            down_interfaces_count=1, error_interfaces_count=1, command_failures_count=1
        )
        self.assertEqual(score_degraded, 37)

    @patch('app.services.collectors.ex4100_collector.SSHManager')
    def test_performance_history_capping_and_accounting(self, mock_ssh_manager_class):
        mock_ssh = mock_ssh_manager_class.return_value
        mock_ssh.connect.return_value = True
        
        # Mock run_command to succeed with standard values
        def side_effect(cmd, timeout=10):
            if "show version" in cmd:
                return "Model: ex4100-24t\nHostname: test-switch\nJunos: 22.4R1.10"
            elif "show system uptime" in cmd:
                return "System booted: 2026-02-21 08:30:10 UTC (142 days, 2 hours ago)"
            return "some output"
            
        mock_ssh.run_command.side_effect = side_effect
        
        from app.services.collectors.telemetry_cache import telemetry_cache
        telemetry_cache.clear()
        
        os.environ["USE_MOCK_FALLBACK"] = "false"
        collector = EX4100Collector()
        
        # 11 consecutive polls
        for _ in range(11):
            status = collector.collect()
            
        # Verify capped history size
        history = telemetry_cache.get_history(collector.device_id)
        self.assertEqual(len(history), 10)
        
        # Verify metrics accounting
        current_perf = status["telemetry"]["performance"]["current"]
        commands = current_perf["commands"]
        
        # Verify total_bytes_received equals sum of command bytes
        expected_bytes = sum(c["bytes"] for c in commands)
        self.assertEqual(current_perf["total_bytes_received"], expected_bytes)
        
        # Verify commands_executed equals count of attempted commands
        self.assertEqual(current_perf["commands_executed"], len(commands))
        
        # Verify accounting sum
        successful_count = sum(1 for c in commands if c["success"])
        self.assertEqual(current_perf["commands_failed"] + successful_count, current_perf["commands_executed"])
        
        # Verify raw output dictionary contains success info
        raw_cmd_key = list(status["raw"].keys())[0]
        self.assertTrue(status["raw"][raw_cmd_key]["success"])
        self.assertIsNotNone(status["raw"][raw_cmd_key]["output"])

if __name__ == '__main__':
    unittest.main()
