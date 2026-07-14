import { NetworkDevice, NetworkClient, Vlan, DhcpLease, SsidConfig, NetworkAlert, AiInsight, UserRole, DeviceConfig } from '../types';

// Helper to load/save state from localStorage for persistence during frontend-only demo
const getStorageItem = <T>(key: string, defaultValue: T): T => {
  const item = localStorage.getItem(key);
  if (!item) return defaultValue;
  try {
    return JSON.parse(item) as T;
  } catch (e) {
    return defaultValue;
  }
};

const setStorageItem = <T>(key: string, value: T): void => {
  localStorage.setItem(key, JSON.stringify(value));
};

const API_BASE_URL = 'http://localhost:8000/api/v1';

// --- INITIAL STATE SEEDING ---
const initialDevices: NetworkDevice[] = [
  {
    id: 'dev-fw-1',
    name: 'srx300 firewall',
    type: 'firewall',
    ipAddress: '192.168.1.1',
    macAddress: '00:0B:82:11:A3:F1',
    status: 'online',
    model: 'Juniper SRX300',
    version: 'JunOS 21.4R3-S3.4',
    uptime: '6 hours',
    healthScore: 98,
    cpuUsage: 14,
    memoryUsage: 35,
    clientsCount: 42,
    config: {
      interfaces: {
        ge0: { enabled: true, vlan: 0, speed: '1000Mbps' },
        ge1: { enabled: true, vlan: 10, speed: '1000Mbps' },
        ge2: { enabled: true, vlan: 20, speed: '1000Mbps' },
      },
      firmwareAutoUpdate: false,
      dnsServers: ['1.1.1.1', '8.8.8.8'],
      routingTable: [
        { destination: '0.0.0.0/0', gateway: '203.0.113.1', interface: 'ge0' },
        { destination: '10.10.0.0/16', gateway: '10.10.10.2', interface: 'ge1' }
      ]
    }
  },
  {
    id: 'dev-cs-1',
    name: 'ex4100 router',
    type: 'core_switch',
    ipAddress: '10.10.10.2',
    macAddress: '00:0B:82:22:B4:02',
    status: 'online',
    model: 'Juniper EX4400-24T',
    version: 'JunOS 22.4R1.10',
    uptime: '142 days, 2 hours',
    healthScore: 99,
    cpuUsage: 8,
    memoryUsage: 42,
    clientsCount: 42,
    config: {
      interfaces: {
        xe0: { enabled: true, vlan: 10, speed: '10Gbps' },
        xe1: { enabled: true, vlan: 20, speed: '10Gbps' },
        et0: { enabled: true, vlan: 1, speed: '40Gbps' },
      },
      firmwareAutoUpdate: true
    }
  },
  {
    id: 'dev-as-1',
    name: 'ex2300 switch',
    type: 'access_switch',
    ipAddress: '10.10.10.10',
    macAddress: '00:0B:82:33:C5:10',
    status: 'online',
    model: 'Juniper EX2300-48P',
    version: 'JunOS 21.2R3.5',
    uptime: '30 days, 12 hours',
    healthScore: 95,
    cpuUsage: 22,
    memoryUsage: 51,
    clientsCount: 28,
    config: {
      interfaces: {
        ge0: { enabled: true, vlan: 10, speed: '1000Mbps', poe: true },
        ge1: { enabled: true, vlan: 20, speed: '1000Mbps', poe: true },
        ge2: { enabled: false, vlan: 10, speed: '1000Mbps', poe: false },
        ge3: { enabled: true, vlan: 30, speed: '1000Mbps', poe: true },
        ge4: { enabled: true, vlan: 20, speed: '1000Mbps', poe: false },
      },
      firmwareAutoUpdate: true
    }
  },
  {
    id: 'dev-as-2',
    name: 'CN-AS-02-FLOOR2',
    type: 'access_switch',
    ipAddress: '10.10.10.11',
    macAddress: '00:0B:82:33:C5:11',
    status: 'warning',
    model: 'Juniper EX2300-48P',
    version: 'JunOS 21.2R3.5',
    uptime: '15 days, 4 hours',
    healthScore: 82,
    cpuUsage: 78,
    memoryUsage: 62,
    clientsCount: 14,
    config: {
      interfaces: {
        ge0: { enabled: true, vlan: 10, speed: '1000Mbps', poe: true },
        ge1: { enabled: true, vlan: 20, speed: '1000Mbps', poe: true },
        ge2: { enabled: true, vlan: 10, speed: '1000Mbps', poe: true },
      },
      firmwareAutoUpdate: true
    }
  },
  {
    id: 'dev-ap-1',
    name: 'CN-AP-01-LOBBY',
    type: 'access_point',
    ipAddress: '10.10.10.20',
    macAddress: '00:0B:82:44:D6:20',
    status: 'online',
    model: 'Juniper Mist AP43',
    version: 'MistOS 0.10.2311',
    uptime: '30 days, 11 hours',
    healthScore: 97,
    cpuUsage: 12,
    memoryUsage: 28,
    clientsCount: 18,
    config: {
      ssids: ['CampusNet-Corp', 'CampusNet-Guest'],
      firmwareAutoUpdate: true
    }
  },
  {
    id: 'dev-ap-2',
    name: 'CN-AP-02-CONF-A',
    type: 'access_point',
    ipAddress: '10.10.10.21',
    macAddress: '00:0B:82:44:D6:21',
    status: 'online',
    model: 'Juniper Mist AP43',
    version: 'MistOS 0.10.2311',
    uptime: '30 days, 10 hours',
    healthScore: 92,
    cpuUsage: 35,
    memoryUsage: 32,
    clientsCount: 24,
    config: {
      ssids: ['CampusNet-Corp', 'CampusNet-Guest', 'CampusNet-IoT'],
      firmwareAutoUpdate: true
    }
  },
  {
    id: 'dev-ap-3',
    name: 'CN-AP-03-OFFICE-WEST',
    type: 'access_point',
    ipAddress: '10.10.10.22',
    macAddress: '00:0B:82:44:D6:22',
    status: 'offline',
    model: 'Juniper Mist AP43',
    version: 'MistOS 0.9.1982',
    uptime: '0 days, 0 hours',
    healthScore: 0,
    cpuUsage: 0,
    memoryUsage: 0,
    clientsCount: 0,
    config: {
      ssids: ['CampusNet-Corp'],
      firmwareAutoUpdate: true
    }
  }
];

const initialClients: NetworkClient[] = [
  {
    id: 'cli-1',
    name: 'Johns-MacBook-Pro',
    macAddress: 'F4:0F:24:D1:88:C2',
    ipAddress: '10.10.20.101',
    connectionType: 'wireless',
    status: 'active',
    rxRate: 425.4,
    txRate: 180.2,
    signalStrength: -58,
    connectedToDeviceId: 'dev-ap-2',
    connectedToDeviceName: 'CN-AP-02-CONF-A',
    vlanId: 20,
    os: 'macOS Sonoma',
    band: '5GHz'
  },
  {
    id: 'cli-2',
    name: 'Sara-iPhone-15',
    macAddress: 'A2:18:C4:6E:9B:40',
    ipAddress: '10.10.30.55',
    connectionType: 'wireless',
    status: 'active',
    rxRate: 58.1,
    txRate: 12.4,
    signalStrength: -67,
    connectedToDeviceId: 'dev-ap-1',
    connectedToDeviceName: 'CN-AP-01-LOBBY',
    vlanId: 30,
    os: 'iOS 17',
    band: '5GHz'
  },
  {
    id: 'cli-3',
    name: 'Finance-Desktop-01',
    macAddress: '00:15:5D:83:B2:1A',
    ipAddress: '10.10.10.122',
    connectionType: 'wired',
    status: 'active',
    rxRate: 980.0,
    txRate: 750.0,
    connectedToDeviceId: 'dev-as-1',
    connectedToDeviceName: 'ex2300 switch',
    vlanId: 10,
    os: 'Windows 11 Enterprise'
  },
  {
    id: 'cli-4',
    name: 'Zebra-LabelPrinter-04',
    macAddress: '00:07:4D:44:A2:8E',
    ipAddress: '10.10.40.10',
    connectionType: 'wired',
    status: 'active',
    rxRate: 0.2,
    txRate: 0.1,
    connectedToDeviceId: 'dev-as-1',
    connectedToDeviceName: 'ex2300 switch',
    vlanId: 40,
    os: 'Embedded Linux'
  },
  {
    id: 'cli-5',
    name: 'Hvac-Controller-West',
    macAddress: 'E0:F2:C4:88:51:B2',
    ipAddress: '10.10.40.22',
    connectionType: 'wireless',
    status: 'active',
    rxRate: 1.5,
    txRate: 0.8,
    signalStrength: -72,
    connectedToDeviceId: 'dev-ap-2',
    connectedToDeviceName: 'CN-AP-02-CONF-A',
    vlanId: 40,
    os: 'FreeRTOS',
    band: '2.4GHz'
  },
  {
    id: 'cli-6',
    name: 'David-Dell-XPS',
    macAddress: 'D4:81:D7:BC:4A:2D',
    ipAddress: '10.10.20.102',
    connectionType: 'wireless',
    status: 'active',
    rxRate: 310.5,
    txRate: 95.8,
    signalStrength: -62,
    connectedToDeviceId: 'dev-ap-2',
    connectedToDeviceName: 'CN-AP-02-CONF-A',
    vlanId: 20,
    os: 'Ubuntu 22.04 LTS',
    band: '5GHz'
  },
  {
    id: 'cli-7',
    name: 'Executive-IP-Phone',
    macAddress: '00:08:5D:F3:11:AB',
    ipAddress: '10.10.10.201',
    connectionType: 'wired',
    status: 'active',
    rxRate: 5.2,
    txRate: 5.1,
    connectedToDeviceId: 'dev-as-2',
    connectedToDeviceName: 'CN-AS-02-FLOOR2',
    vlanId: 10,
    os: 'Cisco SIP OS'
  }
];

const initialVlans: Vlan[] = [];


const initialDhcpLeases: DhcpLease[] = [
  { id: 'lease-1', ipAddress: '10.10.10.122', macAddress: '00:15:5D:83:B2:1A', clientName: 'Finance-Desktop-01', leaseTime: '12 hours remaining', vlanId: 10 },
  { id: 'lease-2', ipAddress: '10.10.20.101', macAddress: 'F4:0F:24:D1:88:C2', clientName: 'Johns-MacBook-Pro', leaseTime: '23 hours remaining', vlanId: 20 },
  { id: 'lease-3', ipAddress: '10.10.20.102', macAddress: 'D4:81:D7:BC:4A:2D', clientName: 'David-Dell-XPS', leaseTime: '14 hours remaining', vlanId: 20 },
  { id: 'lease-4', ipAddress: '10.10.30.55', macAddress: 'A2:18:C4:6E:9B:40', clientName: 'Sara-iPhone-15', leaseTime: '1 hour remaining', vlanId: 30 },
  { id: 'lease-5', ipAddress: '10.10.40.10', macAddress: '00:07:4D:44:A2:8E', clientName: 'Zebra-LabelPrinter-04', leaseTime: '8 days remaining', vlanId: 40 },
  { id: 'lease-6', ipAddress: '10.10.40.22', macAddress: 'E0:F2:C4:88:51:B2', clientName: 'Hvac-Controller-West', leaseTime: '5 days remaining', vlanId: 40 }
];


const initialSsids: SsidConfig[] = [
  {
    id: 'ssid-1',
    ssid: 'CampusNet-Corp',
    securityType: 'WPA3-Enterprise',
    status: 'active',
    band: 'Dual',
    vlanId: 20,
    clientsCount: 26,
    maxClients: 250,
    rateLimitRx: 100,
    rateLimitTx: 50,
    portalEnabled: false
  },
  {
    id: 'ssid-2',
    ssid: 'CampusNet-Guest',
    securityType: 'Open',
    status: 'active',
    band: 'Dual',
    vlanId: 30,
    clientsCount: 15,
    maxClients: 500,
    rateLimitRx: 15,
    rateLimitTx: 5,
    portalEnabled: true
  },
  {
    id: 'ssid-3',
    ssid: 'CampusNet-IoT',
    securityType: 'WPA2-Personal',
    status: 'active',
    band: '2.4GHz',
    vlanId: 40,
    clientsCount: 8,
    maxClients: 100,
    rateLimitRx: 5,
    rateLimitTx: 2,
    portalEnabled: false
  }
];

const initialAlerts: NetworkAlert[] = [
  {
    id: 'alert-1',
    severity: 'critical',
    message: 'Access Point "CN-AP-03-OFFICE-WEST" is offline. Connection terminated abruptly.',
    timestamp: '2026-07-07T10:10:00Z',
    deviceId: 'dev-ap-3',
    deviceName: 'CN-AP-03-OFFICE-WEST',
    resolved: false,
    category: 'device'
  },
  {
    id: 'alert-2',
    severity: 'warning',
    message: 'High CPU load (78%) detected on switch "CN-AS-02-FLOOR2". Rogue traffic suspected.',
    timestamp: '2026-07-07T10:20:00Z',
    deviceId: 'dev-as-2',
    deviceName: 'CN-AS-02-FLOOR2',
    resolved: false,
    category: 'device'
  },
  {
    id: 'alert-3',
    severity: 'info',
    message: 'Configuration backup saved automatically to local repository.',
    timestamp: '2026-07-07T08:00:00Z',
    resolved: true,
    category: 'system'
  },
  {
    id: 'alert-4',
    severity: 'warning',
    message: 'Intrusion Detection: Firewall blocked port scan originating from external IP 198.51.100.42.',
    timestamp: '2026-07-07T09:45:00Z',
    deviceId: 'dev-fw-1',
    deviceName: 'srx300 firewall',
    resolved: false,
    category: 'security'
  }
];

const initialInsights: AiInsight[] = [
  {
    id: 'insight-1',
    category: 'optimization',
    title: 'Wi-Fi Channel Optimization',
    description: 'Co-channel interference detected on 5GHz band between CN-AP-01-LOBBY and CN-AP-02-CONF-A. Mist RF analytics recommends switching CN-AP-02 to Channel 44 (5.22 GHz) to improve throughput by ~25%.',
    impact: 'Medium (Enhances wireless throughput for 24 clients)',
    status: 'pending',
    timestamp: '2026-07-07T10:00:00Z',
    suggestedAction: 'Re-assign RF channels automatically'
  },
  {
    id: 'insight-2',
    category: 'anomaly',
    title: 'Abnormal Traffic Spike',
    description: 'Switch CN-AS-02-FLOOR2 is experiencing a 300% packet rate increase on Port ge2 (Client David-Dell-XPS). Possibility of network loop or malware beaconing.',
    impact: 'High (Causes high switch CPU utilization and potential loop)',
    status: 'pending',
    timestamp: '2026-07-07T10:15:00Z',
    suggestedAction: 'Rate-limit port ge2 to 10Mbps or quarantine client'
  },
  {
    id: 'insight-3',
    category: 'security',
    title: 'Outdated Device Firmware',
    description: 'Firewall and AP-03 are running firmware versions older than the approved enterprise baseline. Vulnerability CVE-2024-3382 resides in AP-03 firmware version.',
    impact: 'High (Security compliance exposure)',
    status: 'pending',
    timestamp: '2026-07-07T06:30:00Z',
    suggestedAction: 'Schedule automatic baseline firmware update'
  }
];

// --- TELEMETRY HISTORY FOR CHARTS ---
export const getBandwidthHistory = () => {
  const data = [];
  const now = new Date();
  for (let i = 24; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    data.push({
      time: timeStr,
      rx: Math.round(150 + Math.random() * 250 + (i % 6 === 0 ? 300 : 0)), // Mbps
      tx: Math.round(50 + Math.random() * 100 + (i % 6 === 0 ? 120 : 0)),
      clients: Math.round(30 + Math.random() * 15 + (i > 8 && i < 18 ? 20 : 0))
    });
  }
  return data;
};

// --- DATA ACCESS LAYER ---
class CampusNetApi {
  private getDevices() {
    return getStorageItem<NetworkDevice[]>('cn-devices', initialDevices);
  }

  private setDevices(devices: NetworkDevice[]) {
    setStorageItem('cn-devices', devices);
  }

  private getClients() {
    return getStorageItem<NetworkClient[]>('cn-clients', initialClients);
  }

  private setClients(clients: NetworkClient[]) {
    setStorageItem('cn-clients', clients);
  }

  private getVlans() {
    return getStorageItem<Vlan[]>('cn-vlans', initialVlans);
  }

  private setVlans(vlans: Vlan[]) {
    setStorageItem('cn-vlans', vlans);
  }

  private getSsids() {
    return getStorageItem<SsidConfig[]>('cn-ssids', initialSsids);
  }

  private setSsids(ssids: SsidConfig[]) {
    setStorageItem('cn-ssids', ssids);
  }

  private getDhcpLeases() {
    return getStorageItem<DhcpLease[]>('cn-dhcp-leases', initialDhcpLeases);
  }

  private setDhcpLeases(leases: DhcpLease[]) {
    setStorageItem('cn-dhcp-leases', leases);
  }

  private getAlerts() {
    return getStorageItem<NetworkAlert[]>('cn-alerts', initialAlerts);
  }

  private setAlerts(alerts: NetworkAlert[]) {
    setStorageItem('cn-alerts', alerts);
  }

  private getInsights() {
    return getStorageItem<AiInsight[]>('cn-insights', initialInsights);
  }

  private setInsights(insights: AiInsight[]) {
    setStorageItem('cn-insights', insights);
  }

  // --- API INTERFACES ---

  // Devices
  async fetchDevices(): Promise<NetworkDevice[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/devices`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          this.setDevices(data);
          return data;
        }
      }
    } catch (e) {
      console.warn("Backend offline, falling back to local devices database:", e);
    }
    return this.getDevices();
  }

  async updateDeviceConfig(deviceId: string, config: Partial<DeviceConfig>): Promise<NetworkDevice> {
    try {
      const res = await fetch(`${API_BASE_URL}/devices/${deviceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e) {
      console.warn("Backend update failed, falling back to local update:", e);
    }
    const devices = this.getDevices();
    const index = devices.findIndex((d) => d.id === deviceId);
    if (index === -1) throw new Error('Device not found');
    
    devices[index].config = { ...devices[index].config, ...config };
    this.setDevices(devices);
    return devices[index];
  }

  async onboardDevice(device: Omit<NetworkDevice, 'id' | 'healthScore' | 'cpuUsage' | 'memoryUsage' | 'clientsCount' | 'uptime'>): Promise<NetworkDevice> {
    try {
      const res = await fetch(`${API_BASE_URL}/devices/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(device)
      });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e) {
      console.warn("Backend onboarding failed, falling back to local onboarding:", e);
    }
    const devices = this.getDevices();
    const newDevice: NetworkDevice = {
      ...device,
      id: 'dev-' + Math.random().toString(36).substring(7),
      healthScore: 100,
      cpuUsage: 5,
      memoryUsage: 12,
      clientsCount: 0,
      uptime: '0 mins',
    };
    devices.push(newDevice);
    this.setDevices(devices);

    const alerts = this.getAlerts();
    alerts.unshift({
      id: 'alert-' + Math.random().toString(36).substring(7),
      severity: 'info',
      message: `New Device ${device.name} (${device.model}) registered successfully via onboarding portal.`,
      timestamp: new Date().toISOString(),
      deviceId: newDevice.id,
      deviceName: newDevice.name,
      resolved: false,
      category: 'system'
    });
    this.setAlerts(alerts);

    return newDevice;
  }

  async deleteDevice(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/devices/${id}`, { method: 'DELETE' });
      if (res.ok) return true;
    } catch (e) {
      console.warn("Backend deletion failed, falling back to local deletion:", e);
    }
    const devices = this.getDevices();
    const filtered = devices.filter((d) => d.id !== id);
    this.setDevices(filtered);
    return true;
  }

  // Clients
  async fetchClients(): Promise<NetworkClient[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/clients`);
      if (res.ok) {
        const data = await res.json();
        this.setClients(data);
        return data;
      }
    } catch (e) {
      console.warn("Backend offline, falling back to local clients database:", e);
    }
    return this.getClients();
  }

  async quarantineClient(clientId: string): Promise<NetworkClient> {
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${clientId}/quarantine`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e) {
      console.warn("Backend quarantine failed, falling back to local quarantine:", e);
    }
    const clients = this.getClients();
    const index = clients.findIndex((c) => c.id === clientId);
    if (index === -1) throw new Error('Client not found');

    clients[index].status = 'inactive';
    this.setClients(clients);

    const alerts = this.getAlerts();
    alerts.unshift({
      id: 'alert-' + Math.random().toString(36).substring(7),
      severity: 'warning',
      message: `Client "${clients[index].name}" has been quarantined and isolated from VLAN ${clients[index].vlanId}.`,
      timestamp: new Date().toISOString(),
      resolved: false,
      category: 'security'
    });
    this.setAlerts(alerts);

    return clients[index];
  }

  // VLANs
  async fetchVlans(): Promise<Vlan[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/vlans`);
      if (res.ok) {
        const data = await res.json();
        this.setVlans(data);
        return data;
      }
    } catch (e) {
      console.warn("Backend offline, falling back to local VLANs database:", e);
    }
    return this.getVlans();
  }

  async addVlan(vlan: Omit<Vlan, 'activeLeasesCount'>): Promise<Vlan> {
    try {
      const res = await fetch(`${API_BASE_URL}/vlans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vlan)
      });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e) {
      console.warn("Backend VLAN add failed, falling back to local:", e);
    }
    const vlans = this.getVlans();
    const newVlan: Vlan = { ...vlan, activeLeasesCount: 0 };
    vlans.push(newVlan);
    this.setVlans(vlans);
    return newVlan;
  }

  async deleteVlan(vlanId: number): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/vlans/${vlanId}`, { method: 'DELETE' });
      if (res.ok) return true;
    } catch (e) {
      console.warn("Backend VLAN delete failed, falling back to local:", e);
    }
    const vlans = this.getVlans();
    const filtered = vlans.filter((v) => v.id !== vlanId);
    this.setVlans(filtered);
    return true;
  }

  // DHCP Leases
  async fetchDhcpLeases(): Promise<DhcpLease[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/dhcp/leases`);
      if (res.ok) {
        const data = await res.json();
        this.setDhcpLeases(data);
        return data;
      }
    } catch (e) {
      console.warn("Backend offline, falling back to local leases database:", e);
    }
    return this.getDhcpLeases();
  }

  async addStaticReservation(reservation: Omit<DhcpLease, 'leaseTime'>): Promise<DhcpLease> {
    try {
      const res = await fetch(`${API_BASE_URL}/dhcp/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reservation)
      });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e) {
      console.warn("Backend lease reservation failed, falling back to local:", e);
    }
    const leases = this.getDhcpLeases();
    const newLease: DhcpLease = { ...reservation, leaseTime: 'Infinite (Static reservation)' };
    leases.push(newLease);
    this.setDhcpLeases(leases);
    return newLease;
  }

  // SSIDs
  async fetchSsids(): Promise<SsidConfig[]> {
    return this.getSsids();
  }

  async saveSsid(ssid: SsidConfig): Promise<SsidConfig> {
    const ssids = this.getSsids();
    const index = ssids.findIndex((s) => s.id === ssid.id);
    if (index === -1) {
      const newSsid = { ...ssid, id: 'ssid-' + Math.random().toString(36).substring(7), clientsCount: 0 };
      ssids.push(newSsid);
      this.setSsids(ssids);
      return newSsid;
    } else {
      ssids[index] = ssid;
      this.setSsids(ssids);
      return ssid;
    }
  }

  async toggleSsidStatus(id: string): Promise<SsidConfig> {
    const ssids = this.getSsids();
    const index = ssids.findIndex((s) => s.id === id);
    if (index === -1) throw new Error('SSID not found');
    
    ssids[index].status = ssids[index].status === 'active' ? 'inactive' : 'active';
    this.setSsids(ssids);
    return ssids[index];
  }

  // Alerts
  async fetchAlerts(): Promise<NetworkAlert[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/alerts`);
      if (res.ok) {
        const data = await res.json();
        this.setAlerts(data);
        return data;
      }
    } catch (e) {
      console.warn("Backend offline, falling back to local alerts database:", e);
    }
    return this.getAlerts();
  }

  async resolveAlert(alertId: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/alerts/${alertId}/resolve`, { method: 'POST' });
      if (res.ok) return true;
    } catch (e) {
      console.warn("Backend alert resolution failed, falling back to local:", e);
    }
    const alerts = this.getAlerts();
    const index = alerts.findIndex((a) => a.id === alertId);
    if (index !== -1) {
      alerts[index].resolved = true;
      this.setAlerts(alerts);
    }
    return true;
  }

  // AI Center Insights
  async fetchInsights(): Promise<AiInsight[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/ai/insights`);
      if (res.ok) {
        const data = await res.json();
        this.setInsights(data);
        return data;
      }
    } catch (e) {
      console.warn("Backend offline, falling back to local insights database:", e);
    }
    return this.getInsights();
  }

  async applyInsightAction(insightId: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/ai/insights/${insightId}/apply`, { method: 'POST' });
      if (res.ok) return true;
    } catch (e) {
      console.warn("Backend apply insight failed, falling back to local:", e);
    }
    const insights = this.getInsights();
    const index = insights.findIndex((i) => i.id === insightId);
    if (index === -1) throw new Error('Insight not found');
    
    insights[index].status = 'applied';
    this.setInsights(insights);
    return true;
  }

  // Local rule-based AI NLP Parser
  async queryAiChat(prompt: string): Promise<{ text: string; data?: any }> {
    try {
      const res = await fetch(`${API_BASE_URL}/ai/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e) {
      console.warn("Backend AI query failed, falling back to local query parsing:", e);
    }
    return new Promise((resolve) => {
      setTimeout(() => {
        const query = prompt.toLowerCase();
        const devices = this.getDevices();
        const clients = this.getClients();
        const alerts = this.getAlerts();

        // Helper: Find switch connection for APs
        const getApUplink = (apName: string, apMac: string) => {
          for (const d of devices) {
            if (d.type === 'access_switch' || d.type === 'core_switch') {
              const neighbors = d.telemetry?.lldp_neighbors || [];
              const match = neighbors.find((n: any) => 
                (n.neighbor_hostname && n.neighbor_hostname.toLowerCase().includes(apName.toLowerCase())) ||
                (n.neighbor_chassis_id && n.neighbor_chassis_id.toLowerCase().replace(/[:.-]/g, '') === apMac.toLowerCase().replace(/[:.-]/g, ''))
              );
              if (match) {
                return { switchName: d.name, switchPort: match.local_interface, switchDevice: d };
              }
            }
          }
          return null;
        };

        if (query.includes('highest cpu') || query.includes('switch has the highest cpu')) {
          const switches = devices.filter((d) => d.type.includes('switch'));
          if (switches.length === 0) {
            resolve({ text: "No switches discovered in the network database." });
          } else {
            const sorted = [...switches].sort((a, b) => (b.cpuUsage || 0) - (a.cpuUsage || 0));
            resolve({
              text: `Switch **${sorted[0].name}** (${sorted[0].model}) has the highest CPU utilization at **${sorted[0].cpuUsage}%**.`,
              data: sorted.map(s => ({ name: s.name, model: s.model, cpuUsage: s.cpuUsage }))
            });
          }
        } else if (query.includes('most bandwidth') || query.includes('ap is using the most bandwidth')) {
          const aps = devices.filter((d) => d.type === 'access_point');
          const apBandwidths = aps.map(ap => {
            const conn = getApUplink(ap.name, ap.macAddress);
            let bw = 0.01;
            let port = 'N/A';
            let sw = 'N/A';
            if (conn) {
              sw = conn.switchName;
              port = conn.switchPort;
              const stats = conn.switchDevice.telemetry?.port_statistics?.ports?.[conn.switchPort];
              if (stats) {
                const rx = stats.rx_bps ? stats.rx_bps / 1000000 : 0;
                const tx = stats.tx_bps ? stats.tx_bps / 1000000 : 0;
                bw = rx + tx;
              }
            }
            return { ap, bandwidth: bw, port, switch: sw };
          });
          apBandwidths.sort((a, b) => b.bandwidth - a.bandwidth);
          const top = apBandwidths[0];
          resolve({
            text: `Access Point **${top.ap.name}** is utilizing the most bandwidth at **${top.bandwidth.toFixed(2)} Mbps** aggregate rate, connected on switch **${top.switch}** port **${top.port}**.`,
            data: apBandwidths.map(item => ({ name: item.ap.name, bandwidthMbps: parseFloat(item.bandwidth.toFixed(2)), port: item.port, switch: item.switch }))
          });
        } else if (query.includes('why is') && (query.includes('offline') || query.includes('down'))) {
          let targetAp = devices.find(d => d.type === 'access_point' && (query.includes(d.name.toLowerCase()) || query.includes(d.name.toLowerCase().replace('cn-ap-', '').replace('-', ' '))));
          if (!targetAp) {
            targetAp = devices.find(d => d.type === 'access_point' && d.status === 'offline');
          }
          if (!targetAp) {
            resolve({ text: "All Access Points are online and reporting normal heartbeats." });
          } else {
            const conn = getApUplink(targetAp.name, targetAp.macAddress);
            if (conn) {
              const portConfig = conn.switchDevice.config?.interfaces?.[conn.switchPort];
              if (portConfig && portConfig.link === 'down') {
                resolve({
                  text: `**${targetAp.name}** is unreachable because switch port **${conn.switchPort}** on **${conn.switchName}** is **DOWN**. This prevents heartbeats from completing.`,
                  data: { device: targetAp.name, switch: conn.switchName, port: conn.switchPort, link: 'down' }
                });
                return;
              }
            }
            resolve({
              text: `**${targetAp.name}** is offline. The connected switch interface status is healthy, suggesting a potential local hardware power cycle failure or loose cable.`,
              data: { device: targetAp.name }
            });
          }
        } else if (query.includes('crc errors') || query.includes('ports with crc')) {
          const switches = devices.filter((d) => d.type.includes('switch'));
          const crcPorts: any[] = [];
          switches.forEach(sw => {
            const portStats = sw.telemetry?.port_statistics?.ports || {};
            Object.entries(portStats).forEach(([port, stats]: [string, any]) => {
              if (stats.crc_errors > 0) {
                crcPorts.push({ switch: sw.name, port, crc_errors: stats.crc_errors });
              }
            });
          });
          if (crcPorts.length === 0) {
            resolve({ text: "Campus switches backplane audit: **Zero CRC errors** detected across all interfaces. Cabling is stable." });
          } else {
            resolve({
              text: `Audit found ${crcPorts.length} switch port(s) exhibiting physical layer CRC alignment errors. Detail listing:`,
              data: crcPorts
            });
          }
        } else if (query.includes('most poe') || query.includes('consumes the most poe')) {
          const aps = devices.filter((d) => d.type === 'access_point');
          const apPoe = aps.map(ap => {
            const conn = getApUplink(ap.name, ap.macAddress);
            let watts = 0.0;
            let port = 'N/A';
            let sw = 'N/A';
            if (conn) {
              sw = conn.switchName;
              port = conn.switchPort;
              const portConfig = conn.switchDevice.config?.interfaces?.[conn.switchPort];
              if (portConfig && portConfig.poeWatts) {
                watts = parseFloat(portConfig.poeWatts);
              } else if (portConfig && portConfig.poe) {
                watts = 15.4;
              }
            }
            return { ap, watts, port, switch: sw };
          });
          apPoe.sort((a, b) => b.watts - a.watts);
          const top = apPoe[0];
          resolve({
            text: `Access Point **${top.ap.name}** consumes the most PoE power at **${top.watts.toFixed(1)} W**, supplied by switch **${top.switch}** port **${top.port}**.`,
            data: apPoe.map(item => ({ name: item.ap.name, poeWatts: item.watts, port: item.port, switch: item.switch }))
          });
        } else if (query.includes('flapped') || query.includes('flap')) {
          const switches = devices.filter((d) => d.type.includes('switch'));
          const flappedPorts: any[] = [];
          switches.forEach(sw => {
            const portStats = sw.telemetry?.port_statistics?.ports || {};
            Object.entries(portStats).forEach(([port, stats]: [string, any]) => {
              if (stats.last_flap && stats.last_flap !== 'Never' && !stats.last_flap.includes('days')) {
                flapped_ports.push({ switch: sw.name, port, last_flap: stats.last_flap });
              }
            });
          });
          if (flappedPorts.length === 0) {
            resolve({ text: "Switch carrier backplanes are stable. **Zero interface flapping events** logged in the last 24 hours." });
          } else {
            resolve({
              text: `Discovered ${flappedPorts.length} interface flapping event(s) logged today:`,
              data: flappedPorts
            });
          }
        } else if (query.includes('connected to') || query.includes('devices on')) {
          const match = query.match(/([a-z]+-\d+\/\d+\/\d+)/);
          const portName = match ? match[1] : "ge-0/0/7";
          const connected: any[] = [];
          devices.forEach(sw => {
            if (sw.type === 'access_switch' || sw.type === 'core_switch') {
              const neighbors = sw.telemetry?.lldp_neighbors || [];
              neighbors.forEach((n: any) => {
                if (n.local_interface === portName) {
                  connected.push({ type: "switch_neighbor", name: n.neighbor_hostname, chassis_id: n.neighbor_chassis_id, switch: sw.name });
                }
              });
            }
          });
          if (connected.length === 0) {
            resolve({ text: `Interface **{portName}** reports no active LLDP neighbors connected.` });
          } else {
            resolve({
              text: `Found the following neighbor device connected to interface **${portName}**:`,
              data: connected
            });
          }
        } else if (query.includes('offline') || query.includes('disconnected') || query.includes('down')) {
          const offlineDevices = devices.filter((d) => d.status === 'offline');
          if (offlineDevices.length === 0) {
            resolve({ text: "Currently, all network devices are online and reporting normal heartbeats." });
          } else {
            resolve({
              text: `I detected ${offlineDevices.length} offline device(s). Detail listing below. The offline state is causing partial coverage gaps.`,
              data: offlineDevices
            });
          }
        } else if (query.includes('client') || query.includes('user')) {
          if (query.includes('macbook') || query.includes('john')) {
            const client = clients.find((c) => c.name.toLowerCase().includes('john'));
            resolve({
              text: `Here is the profile for client John's MacBook. Connected to AP **${client?.connectedToDeviceName || 'CN-AP-02-CONF-A'}** on the ${client?.band || '5GHz'} band. Signal strength is strong (${client?.signalStrength || -58} dBm).`,
              data: client
            });
          } else {
            resolve({
              text: `There are currently ${clients.length} active clients connected to the campus network. ${clients.filter((c) => c.connectionType === 'wireless').length} wireless clients and ${clients.filter((c) => c.connectionType === 'wired').length} wired clients.`,
              data: clients
            });
          }
        } else if (query.includes('alert') || query.includes('issue') || query.includes('error')) {
          const activeAlerts = alerts.filter(a => !a.resolved);
          resolve({
            text: `There are ${activeAlerts.length} unresolved network alerts active. Primary concern: "CN-AP-03-OFFICE-WEST" is offline.`,
            data: activeAlerts
          });
        } else if (query.includes('optimize') || query.includes('fix') || query.includes('radio')) {
          resolve({
            text: `I recommend applying the wireless RF optimization policy. AP-02 is experiencing co-channel interference on 5GHz. Changing to Channel 44 will resolve this collision. Would you like me to push this command?`
          });
        } else {
          resolve({
            text: `I am the CampusNet AI assistant. I query live CPU, memory, switch PoE draw, flapped interfaces, CRC errors, and connection details. 

Try asking:
- "Which AP is using the most bandwidth?"
- "Why is Indoor-2 offline?"
- "Show ports with CRC errors."
- "Which switch has the highest CPU?"
- "Which AP consumes the most PoE?"
- "Show interfaces that flapped today."
- "List devices connected to ge-0/0/7."`
          });
        }
      }, 800);
    });
  }
}

export const api = new CampusNetApi();
