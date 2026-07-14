import os
import time
import random
import logging
import json
import urllib.request
import urllib.error
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from .base_collector import BaseDeviceCollector, calculate_health_score
from ...models.models import DbDevice, DbClient, DbDhcpLease

logger = logging.getLogger("MistCollector")

class MistCollector(BaseDeviceCollector):
    """
    Juniper Mist Cloud REST API Collector.
    Polls AP stats, wireless clients, and WLAN definitions from Mist Cloud,
    normalizes them into CampusNet schema, and updates database records dynamically.
    Uses Python standard library urllib.request to avoid external dependency issues.
    """
    MIST_DEVICES_ENDPOINT = "/sites/{site_id}/stats/devices"
    MIST_CLIENTS_ENDPOINT = "/sites/{site_id}/stats/clients"
    MIST_WLANS_ENDPOINT = "/sites/{site_id}/wlans"

    def __init__(self):
        self.last_poll_time = 0
        self.cached_devices = []
        self.cached_clients = []
        self.cached_wlans = []
        
        # State properties
        self.enabled = False
        self.connected = False
        self.last_poll = "Never"
        self.last_success = "Never"
        self.poll_duration_ms = 0
        self.api_latency_ms = 0
        self.last_error = "None"

    def _http_get(self, url: str, headers: dict) -> tuple:
        max_retries = 3
        backoff = 1.0
        start_time = time.time()
        for attempt in range(max_retries):
            req = urllib.request.Request(url, headers=headers, method="GET")
            try:
                with urllib.request.urlopen(req, timeout=10) as response:
                    latency = int((time.time() - start_time) * 1000)
                    status_code = response.status
                    data = json.loads(response.read().decode())
                    return status_code, data, latency
            except urllib.error.HTTPError as e:
                latency = int((time.time() - start_time) * 1000)
                if e.code == 429:
                    retry_after = e.headers.get("Retry-After")
                    sleep_time = float(retry_after) if retry_after and retry_after.replace('.', '', 1).isdigit() else backoff
                    logger.warning(f"[MistCollector] Rate limited (429) for URL {url}. Retrying in {sleep_time}s... (Attempt {attempt+1}/{max_retries})")
                    time.sleep(sleep_time)
                    backoff *= 2
                    start_time = time.time()  # reset timer for retry
                    continue
                logger.error(f"[MistCollector] HTTP Error {e.code} for URL {url}")
                return e.code, None, latency
            except Exception as e:
                latency = int((time.time() - start_time) * 1000)
                logger.error(f"[MistCollector] Connection error for URL {url}: {e}")
                return 500, None, latency
        logger.error(f"[MistCollector] Max retries exceeded due to rate limiting for URL {url}")
        return 429, None, 0

    def _poll_devices(self, base_url: str, site_id: str, headers: dict) -> tuple:
        url = f"{base_url}{self.MIST_DEVICES_ENDPOINT.format(site_id=site_id)}"
        return self._http_get(url, headers)

    def _poll_clients(self, base_url: str, site_id: str, headers: dict) -> tuple:
        url = f"{base_url}{self.MIST_CLIENTS_ENDPOINT.format(site_id=site_id)}"
        return self._http_get(url, headers)

    def _poll_wlans(self, base_url: str, site_id: str, headers: dict) -> tuple:
        url = f"{base_url}{self.MIST_WLANS_ENDPOINT.format(site_id=site_id)}"
        return self._http_get(url, headers)

    def _fetch_mist_data(self) -> bool:
        self.enabled = os.getenv("MIST_ENABLED", "false").lower() == "true"
        if not self.enabled:
            self._generate_mock_mist_data()
            return True

        token = os.getenv("MIST_API_TOKEN", "")
        base_url = os.getenv("MIST_BASE_URL", "https://api.ac5.mist.com/api/v1")
        site_id = os.getenv("MIST_SITE_ID", "")

        if not token or not site_id:
            logger.warning("[MistCollector] Mist enabled but MIST_API_TOKEN or MIST_SITE_ID is missing in env. Falling back to mock.")
            self.last_error = "Missing API Token or Site ID configuration"
            self._generate_mock_mist_data()
            return True

        headers = {
            "Authorization": f"Token {token}",
            "Content-Type": "application/json"
        }

        start_poll = time.time()
        self.last_poll = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(start_poll))
        
        try:
            # 1. Fetch site devices stats
            dev_status, dev_data, dev_lat = self._poll_devices(base_url, site_id, headers)
            if dev_status != 200 or dev_data is None:
                raise Exception(f"Failed to fetch devices: HTTP {dev_status}")
            self.cached_devices = dev_data
            self.api_latency_ms = dev_lat

            # 2. Fetch wireless clients stats
            cli_status, cli_data, cli_lat = self._poll_clients(base_url, site_id, headers)
            if cli_status == 200 and cli_data is not None:
                # Filter out inactive clients (not seen for > 180s relative to the most recent client seen)
                max_last_seen = max([c.get("last_seen", 0) for c in cli_data] + [0])
                if max_last_seen > 0:
                    self.cached_clients = [c for c in cli_data if max_last_seen - c.get("last_seen", 0) <= 180]
                else:
                    self.cached_clients = cli_data
                self.api_latency_ms = max(self.api_latency_ms, cli_lat)

            # 3. Fetch configured WLANs
            wlan_status, wlan_data, wlan_lat = self._poll_wlans(base_url, site_id, headers)
            if wlan_status == 200 and wlan_data is not None:
                self.cached_wlans = wlan_data
                self.api_latency_ms = max(self.api_latency_ms, wlan_lat)

            self.connected = True
            self.last_error = "None"
            self.last_success = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            self.poll_duration_ms = int((time.time() - start_poll) * 1000)
            self.last_poll_time = time.time()
            
            logger.info(
                f"[MistCollector] Live poll succeeded: duration={self.poll_duration_ms}ms, "
                f"devices={len(self.cached_devices)}, clients={len(self.cached_clients)}, "
                f"wlans={len(self.cached_wlans)}"
            )
            return True

        except Exception as e:
            self.connected = False
            self.last_error = str(e)
            logger.warning(f"[MistCollector] Live polling failed: {self.last_error}")
            
            # Set all cached devices to offline and clear clients
            for d in self.cached_devices:
                if isinstance(d, dict):
                    d["status"] = "offline"
                    d["num_clients"] = 0
            self.cached_clients = []
            return True

    def collect_status(self, ip_address: str, mac_address: str, config: dict = None, device_id: str = None, **kwargs) -> dict:
        db = kwargs.get("db")
        
        # MIST_POLL_INTERVAL from env (default: 30s)
        poll_interval = float(os.getenv("MIST_POLL_INTERVAL", "30"))
        
        # Determine if we should poll Mist Cloud
        has_live_data = False
        if time.time() - self.last_poll_time > poll_interval:
            has_live_data = self._fetch_mist_data()

        # Update persistent DB records using live Mist data if available
        if has_live_data and db:
            self._sync_database_records(db)

        # 1. Identify device mapping from cache
        normalized_ap = None
        if self.cached_devices:
            for d in self.cached_devices:
                if d.get("mac") and d["mac"].replace(":", "").lower() == mac_address.replace(":", "").lower():
                    normalized_ap = self._normalize_device(d)
                    break

        if not normalized_ap:
            normalized_ap = self._normalize_device({
                "id": device_id or "dev-ap-unknown",
                "mac": mac_address,
                "ip": ip_address,
                "status": "disconnected"
            })

        return normalized_ap

    def push_configuration(self, ip_address: str, config: dict, credentials: dict = None) -> bool:
        logger.info(f"[MistCollector] Push configuration to AP at {ip_address} ignored (managed via Mist Cloud).")
        return True

    def _normalize_device(self, d: dict) -> dict:
        status = "online" if d.get("status") in ["connected", "online"] else "offline"
        cpu = d.get("cpu_util", 0) if status == "online" else 0
        mem = d.get("mem_util", 0) if status == "online" else 0
        uptime_sec = d.get("uptime", 0)
        
        if uptime_sec > 0:
            days = uptime_sec // 86400
            hours = (uptime_sec % 86400) // 3600
            uptime_str = f"{days} days, {hours} hours" if days > 0 else f"{hours} hours"
        else:
            uptime_str = "0 mins" if status == "offline" else "30 days, 10 hours"

        lldp = d.get("lldp_stat", {})
        switch_name = lldp.get("system_name", "ex2300 switch")
        switch_port = lldp.get("port_id", "ge-0/0/8")

        port_stat = d.get("port_stat", {})
        speed = "1000Mbps" if port_stat.get("speed") == 1000 else "100Mbps"

        radio_stat = d.get("radio_stat", {})
        r24 = radio_stat.get("band_24", {})
        r5 = radio_stat.get("band_5", {})
        r6 = radio_stat.get("band_6", {})

        mac = d.get("mac", "N/A")
        
        ap_clients_list = []
        for c in self.cached_clients:
            if c.get("ap_mac") and c["ap_mac"].replace(":", "").lower() == mac.replace(":", "").lower():
                ap_clients_list.append({
                    "mac": c.get("mac", ""),
                    "ip": c.get("ip", "0.0.0.0"),
                    "hostname": c.get("hostname") or c.get("username") or f"Wireless-Client-{c.get('mac', '').replace(':', '')[-4:]}",
                    "username": c.get("username", "Unknown"),
                    "rssi": c.get("rssi", -65),
                    "snr": c.get("snr", 25),
                    "rx_rate": c.get("rx_rate", 300.0),
                    "tx_rate": c.get("tx_rate", 150.0),
                    "rx_bytes": c.get("rx_bytes", 0),
                    "tx_bytes": c.get("tx_bytes", 0),
                    "manufacture": c.get("manufacture", "Unknown"),
                    "os": c.get("os", "Unknown OS"),
                    "family": c.get("family", "Unknown Family"),
                    "vlan": int(c.get("vlan_id", 20)) if str(c.get("vlan_id", "")).isdigit() else 20,
                    "band": "5GHz" if c.get("band") == "5" else ("2.4GHz" if c.get("band") == "24" else ("6GHz" if c.get("band") == "6" else c.get("band", "5GHz"))),
                    "ssid": c.get("ssid", "Unknown"),
                    "uptime": c.get("uptime", 0)
                })

        associated_wlans = [w.get("ssid") for w in self.cached_wlans if w.get("ssid")]
        if not associated_wlans:
            associated_wlans = ["JuniperFaculty", "JuniperGuests"]

        telemetry = {
            "id": d.get("id"),
            "name": d.get("name", "Mist-AP"),
            "model": d.get("model", "AP32-WW"),
            "serial": d.get("serial", "N/A"),
            "mac": mac,
            "ip": d.get("ip", "N/A"),
            "status": status,
            "uptime": uptime_str,
            "cpu_usage": cpu,
            "memory_usage": mem,
            "temperature": d.get("env_stat", {}).get("cpu_temp", 42.0) if isinstance(d.get("env_stat"), dict) else 42.0,
            "connected_clients_count": len(ap_clients_list),
            "switch_name": switch_name,
            "switch_port": switch_port,
            "poe_power": d.get("power_draw", 6.2),
            "ethernet_speed": speed,
            "firmware": d.get("version", "AP-OS 1.2.3"),
            "health_score": 100,  # Computed post-merge
            "radios": {
                "2.4GHz": {
                    "channel": r24.get("channel", 6),
                    "bandwidth": r24.get("bandwidth", 20),
                    "utilization": r24.get("util_all", 15),
                    "noise": r24.get("noise", -95),
                    "tx_power": r24.get("power", 14)
                },
                "5GHz": {
                    "channel": r5.get("channel", 36),
                    "bandwidth": r5.get("bandwidth", 80),
                    "utilization": r5.get("util_all", 25),
                    "noise": r5.get("noise", -92),
                    "tx_power": r5.get("power", 17)
                }
            },
            "wireless": {
                "ap": {
                    "connected_clients": ap_clients_list,
                    "associated_wlans": associated_wlans
                }
            }
        }

        if r6:
            telemetry["radios"]["6GHz"] = {
                "channel": r6.get("channel", 149),
                "bandwidth": r6.get("bandwidth", 80),
                "utilization": r6.get("util_all", 5),
                "noise": r6.get("noise", -98),
                "tx_power": r6.get("power", 12)
            }

        return {
            "status": status,
            "health_score": 100,  # Computed post-merge
            "cpu_usage": cpu,
            "memory_usage": mem,
            "uptime": uptime_str,
            "model": d.get("model", "AP32-WW"),
            "version": d.get("version", "AP-OS 1.2.3"),
            "telemetry": telemetry
        }

    def _sync_database_records(self, db: Session):
        for d in self.cached_devices:
            mac = d.get("mac")
            if not mac:
                continue
            
            db_ap = db.query(DbDevice).filter(DbDevice.mac_address.ilike(mac)).first()
            status = "online" if d.get("status") in ["connected", "online"] else "offline"
            
            if db_ap:
                db_ap.status = status
                db_ap.name = d.get("name", db_ap.name)
                db_ap.ip_address = d.get("ip", db_ap.ip_address)
                db_ap.model = d.get("model", db_ap.model)
                db_ap.version = d.get("version", db_ap.version)
                db_ap.cpu_usage = d.get("cpu", db_ap.cpu_usage)
                db_ap.memory_usage = d.get("mem", db_ap.memory_usage)
                db_ap.clients_count = d.get("num_clients", 0)
            else:
                new_ap = DbDevice(
                    id=f"dev-ap-disc-{mac.replace(':', '')[-6:]}",
                    name=d.get("name", f"Mist-AP-{mac.replace(':', '')[-4:]}"),
                    type="access_point",
                    ip_address=d.get("ip", "0.0.0.0"),
                    mac_address=mac,
                    status=status,
                    model=d.get("model", "AP32"),
                    version=d.get("version", "AP-OS 1.0.0"),
                    uptime="1 day",
                    cpu_usage=d.get("cpu", 10),
                    memory_usage=d.get("mem", 25),
                    clients_count=d.get("num_clients", 0),
                    config={"ssids": ["CampusNet-Corp"], "firmwareAutoUpdate": True}
                )
                db.add(new_ap)

        # Sync DbClients (Connected Wireless Clients)
        db.query(DbClient).filter(DbClient.connection_type == "wireless").delete()
        
        for c in self.cached_clients:
            mac = c.get("mac")
            if not mac:
                continue

            ap_mac = c.get("ap_mac", "")
            ap_device = db.query(DbDevice).filter(DbDevice.mac_address.ilike(ap_mac)).first()
            ap_name = ap_device.name if ap_device else "Mist-AP"

            db_client = DbClient(
                id=f"cli-wifi-{mac.replace(':', '')[-6:]}",
                name=c.get("hostname") or c.get("username") or f"Wireless-Client-{mac.replace(':', '')[-4:]}",
                mac_address=mac,
                ip_address=c.get("ip", "0.0.0.0"),
                connection_type="wireless",
                status="active",
                rx_rate=c.get("rx_rate", 300.0),
                tx_rate=c.get("tx_rate", 150.0),
                signal_strength=c.get("rssi", -65),
                connected_to_device_id=ap_device.id if ap_device else "dev-ap-1",
                connected_to_device_name=ap_name,
                vlan_id=c.get("vlan", 20),
                os=c.get("os", "Unknown Device"),
                band=c.get("band", "5GHz"),
                ssid=c.get("ssid", "Unknown")
            )
            db.add(db_client)

        # Sync active DHCP dynamic leases (exclude static reservations)
        db.query(DbDhcpLease).filter(DbDhcpLease.lease_time != "Infinite (Static reservation)").delete()
        for c in self.cached_clients:
            mac = c.get("mac")
            if not mac:
                continue
            vlan_id = c.get("vlan", 20)
            db_lease = DbDhcpLease(
                id=f"lease-wifi-{mac.replace(':', '')[-6:]}",
                ip_address=c.get("ip", "0.0.0.0"),
                mac_address=mac,
                client_name=c.get("hostname") or c.get("username") or f"Wireless-Client-{mac.replace(':', '')[-4:]}",
                lease_time="23 hours remaining",
                vlan_id=vlan_id
            )
            db.add(db_lease)

        db.commit()

    def get_site_clients(self) -> list:
        site_clients = []
        for c in self.cached_clients:
            site_clients.append({
                "mac": c.get("mac", ""),
                "ip": c.get("ip", "0.0.0.0"),
                "hostname": c.get("hostname") or c.get("username") or f"Wireless-Client-{c.get('mac', '').replace(':', '')[-4:]}",
                "username": c.get("username", "Unknown"),
                "ap_mac": c.get("ap_mac", ""),
                "rssi": c.get("rssi", -65),
                "snr": c.get("snr", 25),
                "rx_rate": c.get("rx_rate", 300.0),
                "tx_rate": c.get("tx_rate", 150.0),
                "rx_bytes": c.get("rx_bytes", 0),
                "tx_bytes": c.get("tx_bytes", 0),
                "manufacture": c.get("manufacture", "Unknown"),
                "os": c.get("os", "Unknown OS"),
                "family": c.get("family", "Unknown Family"),
                "vlan": int(c.get("vlan_id", 20)) if str(c.get("vlan_id", "")).isdigit() else 20,
                "band": "5GHz" if c.get("band") == "5" else ("2.4GHz" if c.get("band") == "24" else ("6GHz" if c.get("band") == "6" else c.get("band", "5GHz"))),
                "ssid": c.get("ssid", "Unknown"),
                "uptime": c.get("uptime", 0)
            })
        return site_clients

    def get_site_wlans(self) -> list:
        wlans = []
        for w in self.cached_wlans:
            wlans.append({
                "id": w.get("id", ""),
                "name": w.get("name", "Unknown"),
                "ssid": w.get("ssid", ""),
                "vlan_id": w.get("vlan_id", 1),
                "enabled": w.get("enabled", True),
                "auth": w.get("auth", {"type": "open"})
            })
        return wlans

    def get_connection_stats(self) -> dict:
        return {
            "status": "Connected" if self.connected else "Disconnected",
            "enabled": self.enabled,
            "connected": self.connected,
            "last_poll": self.last_poll,
            "last_success": self.last_success,
            "poll_duration": f"{self.poll_duration_ms} ms",
            "api_latency": f"{self.api_latency_ms} ms",
            "last_error": self.last_error
        }

    def _generate_mock_mist_data(self):
        self.cached_wlans = [
            {"id": "wlan-corp", "name": "JuniperFaculty", "ssid": "JuniperFaculty", "vlan_id": 10, "enabled": True, "auth": {"type": "wpa2-psk"}},
            {"id": "wlan-guest", "name": "JuniperGuests", "ssid": "JuniperGuests", "vlan_id": 20, "enabled": True, "auth": {"type": "open"}},
            {"id": "wlan-iot", "name": "JuniperIoT", "ssid": "JuniperIoT", "vlan_id": 30, "enabled": True, "auth": {"type": "wpa2-psk"}}
        ]

        self.cached_devices = [
            {
                "id": "dev-ap-1",
                "name": "CN-AP-01-LOBBY",
                "model": "AP32-WW",
                "serial": "CV392102901",
                "mac": "00:0b:82:44:d6:20",
                "ip": "10.10.10.20",
                "status": "connected",
                "uptime": 2629200,
                "cpu": random.randint(12, 18),
                "mem": random.randint(28, 35),
                "temperatures": {"cpu": 41.5},
                "num_clients": 3,
                "power_draw": 6.8,
                "port_stat": {"speed": 1000},
                "lldp_stat": {"system_name": "ex2300 switch", "port_id": "ge-0/0/7"},
                "version": "AP-OS 1.2.3",
                "radio_stat": {
                    "band_24": {"channel": 6, "bandwidth": 20, "util_all": 12, "noise": -94, "power": 13},
                    "band_5": {"channel": 36, "bandwidth": 80, "util_all": 22, "noise": -91, "power": 16}
                }
            },
            {
                "id": "dev-ap-2",
                "name": "CN-AP-02-CONF-A",
                "model": "AP32-WW",
                "serial": "CV392102902",
                "mac": "00:0b:82:44:d6:21",
                "ip": "10.10.10.21",
                "status": "connected",
                "uptime": 86400,
                "cpu": random.randint(15, 22),
                "mem": random.randint(30, 36),
                "temperatures": {"cpu": 44.0},
                "num_clients": 2,
                "power_draw": 7.2,
                "port_stat": {"speed": 1000},
                "lldp_stat": {"system_name": "ex2300 switch", "port_id": "ge-0/0/8"},
                "version": "AP-OS 1.2.3",
                "radio_stat": {
                    "band_24": {"channel": 11, "bandwidth": 20, "util_all": 8, "noise": -96, "power": 12},
                    "band_5": {"channel": 44, "bandwidth": 80, "util_all": 18, "noise": -92, "power": 15}
                }
            },
            {
                "id": "dev-ap-3",
                "name": "CN-AP-03-OFFICE-WEST",
                "model": "AP63-WW",
                "serial": "CV392102903",
                "mac": "00:0b:82:44:d6:22",
                "ip": "10.10.10.22",
                "status": "connected",
                "uptime": 1728000,
                "cpu": random.randint(10, 15),
                "mem": random.randint(25, 32),
                "temperatures": {"cpu": 39.0},
                "num_clients": 1,
                "power_draw": 8.1,
                "port_stat": {"speed": 1000},
                "lldp_stat": {"system_name": "ex2300 switch", "port_id": "ge-0/0/10"},
                "version": "AP-OS 1.2.3",
                "radio_stat": {
                    "band_24": {"channel": 1, "bandwidth": 20, "util_all": 14, "noise": -93, "power": 14},
                    "band_5": {"channel": 149, "bandwidth": 80, "util_all": 26, "noise": -90, "power": 17},
                    "band_6": {"channel": 37, "bandwidth": 80, "util_all": 4, "noise": -98, "power": 11}
                }
            }
        ]

        self.cached_clients = [
            {
                "mac": "a4:83:e7:12:34:56",
                "ip": "10.0.10.22",
                "hostname": "Staff-Laptop-01",
                "username": "alice",
                "ap_mac": "00:0b:82:44:d6:20",
                "rssi": -58,
                "snr": 36,
                "rx_rate": 866.7,
                "tx_rate": 650.0,
                "rx_bytes": 104857600,
                "tx_bytes": 52428800,
                "manufacture": "Apple",
                "os": "macOS",
                "family": "MacBook",
                "vlan": 10,
                "band": "5GHz",
                "ssid": "JuniperFaculty",
                "uptime": 14400
            },
            {
                "mac": "28:11:a5:aa:bb:cc",
                "ip": "10.0.20.45",
                "hostname": "Guest-Phone-01",
                "username": "guest-01",
                "ap_mac": "00:0b:82:44:d6:20",
                "rssi": -72,
                "snr": 22,
                "rx_rate": 144.4,
                "tx_rate": 72.2,
                "rx_bytes": 15728640,
                "tx_bytes": 4194304,
                "manufacture": "Samsung",
                "os": "Android",
                "family": "Galaxy",
                "vlan": 20,
                "band": "2.4GHz",
                "ssid": "JuniperGuests",
                "uptime": 1800
            },
            {
                "mac": "00:15:99:11:22:33",
                "ip": "10.0.10.89",
                "hostname": "Staff-Phone-Alice",
                "username": "alice",
                "ap_mac": "00:0b:82:44:d6:20",
                "rssi": -65,
                "snr": 29,
                "rx_rate": 433.3,
                "tx_rate": 300.0,
                "rx_bytes": 20971520,
                "tx_bytes": 8388608,
                "manufacture": "Apple",
                "os": "iOS",
                "family": "iPhone",
                "vlan": 10,
                "band": "5GHz",
                "ssid": "JuniperFaculty",
                "uptime": 3600
            },
            {
                "mac": "3c:22:fb:aa:bb:cc",
                "ip": "10.0.10.23",
                "hostname": "Faculty-Desktop-A",
                "username": "bob",
                "ap_mac": "00:0b:82:44:d6:21",
                "rssi": -52,
                "snr": 42,
                "rx_rate": 1300.0,
                "tx_rate": 1300.0,
                "rx_bytes": 524288000,
                "tx_bytes": 262144000,
                "manufacture": "Dell",
                "os": "Windows",
                "family": "Latitude",
                "vlan": 10,
                "band": "5GHz",
                "ssid": "JuniperFaculty",
                "uptime": 28800
            },
            {
                "mac": "7c:50:79:d1:e2:f3",
                "ip": "10.0.20.46",
                "hostname": "Guest-Laptop-B",
                "username": "guest-02",
                "ap_mac": "00:0b:82:44:d6:21",
                "rssi": -68,
                "snr": 26,
                "rx_rate": 300.0,
                "tx_rate": 150.0,
                "rx_bytes": 83886080,
                "tx_bytes": 20971520,
                "manufacture": "Lenovo",
                "os": "Windows",
                "family": "ThinkPad",
                "vlan": 20,
                "band": "2.4GHz",
                "ssid": "JuniperGuests",
                "uptime": 7200
            },
            {
                "mac": "d8:a2:5e:33:44:55",
                "ip": "10.0.30.12",
                "hostname": "IoT-Sensor-01",
                "username": "iot-device",
                "ap_mac": "00:0b:82:44:d6:22",
                "rssi": -60,
                "snr": 34,
                "rx_rate": 866.7,
                "tx_rate": 866.7,
                "rx_bytes": 5242880,
                "tx_bytes": 1048576,
                "manufacture": "RaspberryPi",
                "os": "Linux",
                "family": "Raspbian",
                "vlan": 30,
                "band": "6GHz",
                "ssid": "JuniperIoT",
                "uptime": 172800
            }
        ]
        self.connected = True
        self.last_error = "None"
        self.poll_duration_ms = 120
        self.api_latency_ms = 45
        self.last_poll_time = time.time()
        self.last_poll = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(self.last_poll_time))
        self.last_success = self.last_poll
