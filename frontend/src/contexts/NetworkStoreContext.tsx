import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  NetworkDevice, NetworkClient, Vlan, DhcpLease, SsidConfig, NetworkAlert, 
  AiInsight, User, AuditLog, ProvisioningTask, ConfigTemplate, AutomationRule, HealthScores,
  Organization, Site, Building, DiscoveredDevice, FirmwareStatus, MaintenanceConfig, BackupVersion
} from '../types';
import { useAuth } from './AuthContext';
import { api } from '../services/api';

interface NetworkStoreContextType {
  organizations: Organization[];
  sites: Site[];
  buildings: Building[];
  devices: NetworkDevice[];
  ssids: SsidConfig[];
  vlans: Vlan[];
  dhcpLeases: DhcpLease[];
  clients: NetworkClient[];
  alerts: NetworkAlert[];
  logs: AuditLog[];
  tasks: ProvisioningTask[];
  templates: ConfigTemplate[];
  automationRules: AutomationRule[];
  healthScores: HealthScores;
  insights: AiInsight[];
  discoveredDevices: DiscoveredDevice[];
  maintenanceWindows: any[];
  securityEvents: any[];
  
  // Actions
  onboardDevice: (device: Omit<NetworkDevice, 'id' | 'healthScore' | 'cpuUsage' | 'memoryUsage' | 'clientsCount' | 'uptime'>) => Promise<boolean>;
  deleteDevice: (deviceId: string) => Promise<boolean>;
  restartDevice: (deviceId: string) => Promise<boolean>;
  backupDeviceConfig: (deviceId: string, reason: string) => Promise<boolean>;
  rollbackConfiguration: (backupId: string) => Promise<boolean>;
  saveSsid: (ssid: SsidConfig) => Promise<boolean>;
  deleteSsid: (ssidId: string) => Promise<boolean>;
  addVlan: (vlan: Omit<Vlan, 'activeLeasesCount'>) => Promise<boolean>;
  deleteVlan: (vlanId: number) => Promise<boolean>;
  renameVlan: (vlanId: number, newName: string) => Promise<boolean>;
  updateSwitchPortConfig: (deviceId: string, portKey: string, config: { enabled?: boolean; vlanId?: number; poe?: boolean }) => Promise<boolean>;
  quarantineClient: (clientId: string) => Promise<boolean>;
  disconnectClient: (clientId: string) => Promise<boolean>;
  limitClientBandwidth: (clientId: string, rate: number) => Promise<boolean>;
  applyInsight: (insightId: string) => Promise<boolean>;
  addAutomationRule: (rule: Omit<AutomationRule, 'id'>) => Promise<boolean>;
  deleteAutomationRule: (ruleId: string) => Promise<boolean>;
  addStaticReservation: (reservation: { clientName: string; ipAddress: string; macAddress: string; vlanId: number }) => Promise<boolean>;
  deleteStaticReservation: (leaseId: string) => Promise<boolean>;
  runProvisioningTask: (name: string, targetDevices: string[], payload: () => Promise<any>, rollbackPayload?: any) => Promise<boolean>;
  deviceHasCapability: (deviceType: string, capability: string) => boolean;
  resolveAlert: (alertId: string) => Promise<boolean>;
  
  discoverDevices: () => Promise<DiscoveredDevice[]>;
  onboardDiscoveredDevices: (ids: string[]) => Promise<boolean>;
  runDiagnostics: (deviceId: string, type: string, target: string) => Promise<any>;
  updateFirmware: (deviceId: string, targetVersion: string) => Promise<boolean>;
  toggleMaintenance: (deviceId: string, config: MaintenanceConfig) => Promise<boolean>;
  restoreDeviceConfig: (deviceId: string, versionNumber: number) => Promise<boolean>;
}

const NetworkStoreContext = createContext<NetworkStoreContextType | undefined>(undefined);

function getLocalItem<T>(key: string, defaultValue: T): T {
  const data = localStorage.getItem(key);
  if (!data) return defaultValue;
  try {
    return JSON.parse(data) as T;
  } catch (e) {
    return defaultValue;
  }
}

function setLocalItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// Seed Data
const defaultOrgs: Organization[] = [{ id: 'org-1', name: 'CampusNet AI Corporation' }];
const defaultSites: Site[] = [{ id: 'site-1', name: 'Main Campus HQ', orgId: 'org-1' }];
const defaultBuildings: Building[] = [
  { id: 'bld-1', name: 'Administration Block', siteId: 'site-1' },
  { id: 'bld-2', name: 'Science & Lab Facility', siteId: 'site-1' }
];

const defaultDevices: NetworkDevice[] = [
  {
    id: 'dev-fw-1',
    name: 'CN-FW-01-BORDER',
    type: 'firewall',
    ipAddress: '10.10.10.1',
    macAddress: '00:0B:82:11:A3:F1',
    status: 'online',
    model: 'Juniper SRX340',
    version: 'JunOS 22.4R1.10',
    uptime: '45 days, 8 hours',
    healthScore: 98,
    cpuUsage: 14,
    memoryUsage: 35,
    clientsCount: 5,
    config: {
      interfaces: {
        'ge0': { enabled: true, vlan: 0, speed: '1000Mbps' },
        'ge1': { enabled: true, vlan: 10, speed: '1000Mbps' },
        'ge2': { enabled: true, vlan: 20, speed: '1000Mbps' }
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
    name: 'CN-CS-01-SPINE',
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
    clientsCount: 5,
    config: {
      interfaces: {
        'xe0': { enabled: true, vlan: 10, speed: '10Gbps' },
        'xe1': { enabled: true, vlan: 20, speed: '10Gbps' },
        'et0': { enabled: true, vlan: 1, speed: '40Gbps' }
      },
      firmwareAutoUpdate: true
    }
  },
  {
    id: 'dev-as-1',
    name: 'CN-AS-01-FLOOR1',
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
    clientsCount: 3,
    config: {
      interfaces: {
        'ge0': { enabled: true, vlan: 10, speed: '1000Mbps', poe: true },
        'ge1': { enabled: true, vlan: 20, speed: '1000Mbps', poe: true },
        'ge2': { enabled: false, vlan: 10, speed: '1000Mbps', poe: false },
        'ge3': { enabled: true, vlan: 30, speed: '1000Mbps', poe: true },
        'ge4': { enabled: true, vlan: 20, speed: '1000Mbps', poe: false }
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
    clientsCount: 2,
    config: {
      interfaces: {
        'ge0': { enabled: true, vlan: 20, speed: '1000Mbps', poe: true },
        'ge1': { enabled: true, vlan: 10, speed: '1000Mbps', poe: true },
        'ge2': { enabled: true, vlan: 10, speed: '1000Mbps', poe: false },
        'ge3': { enabled: true, vlan: 30, speed: '1000Mbps', poe: true }
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
    model: 'Juniper Standalone AP',
    version: 'AP-OS 1.2.3',
    uptime: '30 days, 11 hours',
    healthScore: 97,
    cpuUsage: 12,
    memoryUsage: 28,
    clientsCount: 2,
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
    model: 'Juniper Standalone AP',
    version: 'AP-OS 1.2.3',
    uptime: '30 days, 10 hours',
    healthScore: 92,
    cpuUsage: 35,
    memoryUsage: 32,
    clientsCount: 3,
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
    model: 'Juniper Standalone AP',
    version: 'AP-OS 1.1.8',
    uptime: '0 mins',
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

const defaultClients: NetworkClient[] = [
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
    connectedToDeviceName: 'CN-AS-01-FLOOR1',
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
    connectedToDeviceName: 'CN-AS-01-FLOOR1',
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
  }
];

const defaultVlans: Vlan[] = [
  { id: 10, name: 'VLAN_MGMT_NET', subnet: '10.10.10.0/24', dhcpRange: '10.10.10.50 - 10.10.10.250', dnsServers: ['1.1.1.1', '8.8.8.8'], activeLeasesCount: 2 },
  { id: 20, name: 'VLAN_CORP_NET', subnet: '10.10.20.0/24', dhcpRange: '10.10.20.20 - 10.10.20.254', dnsServers: ['10.10.10.2', '1.1.1.1'], activeLeasesCount: 1 },
  { id: 30, name: 'VLAN_GUEST_NET', subnet: '10.10.30.0/24', dhcpRange: '10.10.30.10 - 10.10.30.254', dnsServers: ['8.8.8.8', '8.8.4.4'], activeLeasesCount: 1 },
  { id: 40, name: 'VLAN_IOT_NET', subnet: '10.10.40.0/24', dhcpRange: '10.10.40.100 - 10.10.40.200', dnsServers: ['1.1.1.1'], activeLeasesCount: 2 }
];

const defaultDhcpLeases: DhcpLease[] = [
  { id: 'lease-1', ipAddress: '10.10.10.122', macAddress: '00:15:5D:83:B2:1A', clientName: 'Finance-Desktop-01', leaseTime: '12 hours remaining', vlanId: 10 },
  { id: 'lease-2', ipAddress: '10.10.20.101', macAddress: 'F4:0F:24:D1:88:C2', clientName: 'Johns-MacBook-Pro', leaseTime: '23 hours remaining', vlanId: 20 },
  { id: 'lease-3', ipAddress: '10.10.30.55', macAddress: 'A2:18:C4:6E:9B:40', clientName: 'Sara-iPhone-15', leaseTime: '1 hour remaining', vlanId: 30 },
  { id: 'lease-4', ipAddress: '10.10.40.10', macAddress: '00:07:4D:44:A2:8E', clientName: 'Zebra-LabelPrinter-04', leaseTime: '8 days remaining', vlanId: 40 },
  { id: 'lease-5', ipAddress: '10.10.40.22', macAddress: 'E0:F2:C4:88:51:B2', clientName: 'Hvac-Controller-West', leaseTime: '5 days remaining', vlanId: 40 }
];

const defaultSsids: SsidConfig[] = [
  { id: 'ssid-1', ssid: 'CampusNet-Corp', securityType: 'WPA3-Enterprise', status: 'active', band: 'Dual', vlanId: 20, clientsCount: 1, maxClients: 250, rateLimitRx: 100, rateLimitTx: 50, portalEnabled: false },
  { id: 'ssid-2', ssid: 'CampusNet-Guest', securityType: 'WPA2-Personal', status: 'active', band: 'Dual', vlanId: 30, clientsCount: 1, maxClients: 150, rateLimitRx: 10, rateLimitTx: 5, portalEnabled: true },
  { id: 'ssid-3', ssid: 'CampusNet-IoT', securityType: 'WPA2-Personal', status: 'active', band: '2.4GHz', vlanId: 40, clientsCount: 1, maxClients: 100, portalEnabled: false }
];

const defaultAlerts: NetworkAlert[] = [
  { id: 'alert-1', severity: 'critical', message: 'Access Point "CN-AP-03-OFFICE-WEST" is offline. Heartbeat lost.', timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), deviceId: 'dev-ap-3', deviceName: 'CN-AP-03-OFFICE-WEST', resolved: false, category: 'device' },
  { id: 'alert-2', severity: 'warning', message: 'High CPU utilization (78%) detected on CN-AS-02-FLOOR2.', timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(), deviceId: 'dev-as-2', deviceName: 'CN-AS-02-FLOOR2', resolved: false, category: 'device' }
];

const defaultAutomationRules: AutomationRule[] = [
  { id: 'rule-1', name: 'Device Offline Alerter', trigger: 'device_offline', actionType: 'alert', actionValue: 'critical', enabled: true },
  { id: 'rule-2', name: 'High Utilized AP Load Balancer', trigger: 'ap_client_count', threshold: 5, actionType: 'ai_recommendation', actionValue: 'Balance wireless clients', enabled: true }
];

const defaultTemplates: ConfigTemplate[] = [
  { id: 'tpl-1', name: 'Standard Classroom WiFi', description: 'Dual-band WPA2 with 20Mbps rate limit', type: 'wifi', config: { securityType: 'WPA2-Personal', band: 'Dual', rateLimitRx: 20, rateLimitTx: 10, portalEnabled: false } },
  { id: 'tpl-2', name: 'Secure IoT VLAN', description: 'VLAN 40 configured for IoT devices with strict DNS mapping', type: 'vlan', config: { subnet: '10.10.40.0/24', dnsServers: ['1.1.1.1'] } }
];

// Dynamic calculation of health scores
const calculateHealth = (devices: NetworkDevice[], alerts: NetworkAlert[]): HealthScores => {
  const totalDevs = devices.length;
  if (totalDevs === 0) return { network: 100, device: 100, wifi: 100, campus: 100 };

  const onlineDevs = devices.filter(d => d.status === 'online').length;
  const warningDevs = devices.filter(d => d.status === 'warning').length;
  
  const deviceScore = Math.round(((onlineDevs * 100) + (warningDevs * 80)) / totalDevs);
  
  const activeCriticalAlerts = alerts.filter(a => !a.resolved && a.severity === 'critical').length;
  const activeWarningAlerts = alerts.filter(a => !a.resolved && a.severity === 'warning').length;
  
  const networkScore = Math.max(0, 100 - (activeCriticalAlerts * 15) - (activeWarningAlerts * 5));
  
  const aps = devices.filter(d => d.type === 'access_point');
  const wifiScore = aps.length === 0 ? 100 : Math.round(aps.reduce((acc, ap) => acc + ap.healthScore, 0) / aps.length);
  
  const campusScore = Math.round((deviceScore * 0.4) + (networkScore * 0.4) + (wifiScore * 0.2));

  return {
    device: deviceScore,
    network: networkScore,
    wifi: wifiScore,
    campus: campusScore
  };
};

export const NetworkStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  // Expose collections with localStorage integration
  const [organizations] = useState<Organization[]>(defaultOrgs);
  const [sites] = useState<Site[]>(defaultSites);
  const [buildings] = useState<Building[]>(defaultBuildings);
  
  const [devices, setDevices] = useState<NetworkDevice[]>(() => {
    const raw = getLocalItem<NetworkDevice[]>('cn-devices', defaultDevices);
    return raw.map(d => ({
      ...d,
      temperature: d.temperature ?? Math.round(38 + (d.cpuUsage / 5) + (Math.random() * 3)),
      powerStatus: d.powerStatus ?? 'Healthy',
      interfacesCount: d.interfacesCount ?? (d.type.includes('switch') ? 48 : 8),
      interfacesActive: d.interfacesActive ?? (d.type === 'access_point' ? 2 : (d.type === 'firewall' ? 3 : 18)),
      bandwidth: d.bandwidth ?? Math.round(150 + d.clientsCount * 45 + Math.random() * 50),
      availability: d.availability ?? 99.9,
      lastSeenSecondsAgo: d.lastSeenSecondsAgo ?? 5,
      lifecycleStage: d.lifecycleStage ?? 'operational',
      firmwareInfo: d.firmwareInfo ?? {
        currentVersion: d.version,
        latestVersion: d.version.startsWith('JunOS 22') ? d.version : 'JunOS 22.4R2-S1',
        releaseDate: '2026-03-12',
        releaseNotes: 'Fixed core security vulnerabilities in NETCONF protocol handler.',
        status: d.version.startsWith('JunOS 22') ? 'up_to_date' : 'update_available'
      },
      maintenanceConfig: d.maintenanceConfig ?? {
        enabled: false,
        suppressAlerts: true,
        pauseMonitoring: false
      },
      backupHistory: d.backupHistory ?? [
        {
          version: 1,
          timestamp: new Date(Date.now() - 86400000 * 5).toISOString(),
          createdBy: 'admin',
          description: 'Initial factory configuration rollout.',
          configSnapshot: JSON.stringify(d.config)
        }
      ]
    }));
  });

  const [clients, setClients] = useState<NetworkClient[]>(() => getLocalItem('cn-clients', defaultClients));
  const [vlans, setVlans] = useState<Vlan[]>(() => getLocalItem('cn-vlans', defaultVlans));
  const [dhcpLeases, setDhcpLeases] = useState<DhcpLease[]>(() => getLocalItem('cn-dhcp-leases', defaultDhcpLeases));
  const [ssids, setSsids] = useState<SsidConfig[]>(() => getLocalItem('cn-ssids', defaultSsids));
  const [alerts, setAlerts] = useState<NetworkAlert[]>(() => getLocalItem('cn-alerts', defaultAlerts));
  const [logs, setLogs] = useState<AuditLog[]>(() => getLocalItem('cn-audit-logs', []));
  const [tasks, setTasks] = useState<ProvisioningTask[]>(() => getLocalItem('cn-tasks', []));
  const [templates, setTemplates] = useState<ConfigTemplate[]>(() => getLocalItem('cn-templates', defaultTemplates));
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>(() => getLocalItem('cn-automation-rules', defaultAutomationRules));

  const [healthScores, setHealthScores] = useState<HealthScores>(() => calculateHealth(devices, alerts));
  const [insights, setInsights] = useState<AiInsight[]>(() => getLocalItem('cn-insights', []));

  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>(() => getLocalItem('cn-discovered-devices', [
    {
      id: 'disc-fw-1',
      hostname: 'SRX-FIREWALL-DISC',
      ipAddress: '10.10.10.250',
      macAddress: '00:0B:82:FF:A1:C2',
      vendor: 'Juniper Networks',
      model: 'SRX340',
      firmware: 'JunOS 22.4R1.10',
      status: 'online',
      deviceType: 'firewall'
    },
    {
      id: 'disc-sw-1',
      hostname: 'EX4100-SWITCH-DISC',
      ipAddress: '10.10.10.251',
      macAddress: '00:0B:82:FF:B3:D4',
      vendor: 'Juniper Networks',
      model: 'EX4100-48P',
      firmware: 'JunOS 23.1R1.8',
      status: 'online',
      deviceType: 'access_switch'
    },
    {
      id: 'disc-ap-1',
      hostname: 'AP43-BLUEPRINT-DISC',
      ipAddress: '10.10.10.252',
      macAddress: '00:0B:82:FF:C5:E6',
      vendor: 'Juniper Mist',
      model: 'AP43',
      firmware: 'MistOS 0.10.23',
      status: 'online',
      deviceType: 'access_point'
    }
  ]));

  const [maintenanceWindows, setMaintenanceWindows] = useState<any[]>(() => getLocalItem('cn-maint-windows', [
    {
      id: 'maint-1',
      deviceId: 'dev-as-1',
      deviceName: 'CN-AS-01-FLOOR1',
      reason: 'Routine hardware memory utilization optimization & firmware staging checks.',
      startTime: new Date(Date.now() - 3600000).toISOString(),
      endTime: new Date(Date.now() + 7200000).toISOString(),
      engineer: 'admin',
      status: 'active'
    }
  ]));

  const [securityEvents, setSecurityEvents] = useState<any[]>(() => getLocalItem('cn-sec-events', [
    {
      id: 'sec-1',
      timestamp: new Date(Date.now() - 600000).toISOString(),
      user: 'unknown_operator',
      role: 'Network Engineer',
      device: 'CN-FW-01-BORDER',
      category: 'login_failure',
      message: 'Failed SSH login attempt from external host 203.0.113.88',
      severity: 'critical'
    },
    {
      id: 'sec-2',
      timestamp: new Date(Date.now() - 1200000).toISOString(),
      user: 'system',
      role: 'Kernel',
      device: 'CN-FW-01-BORDER',
      category: 'firewall_drop',
      message: 'Port Scan block: Dropped packet from WAN peer 198.51.100.4 on ge0/0',
      severity: 'high'
    }
  ]));

  // Sync to localStorage on state changes
  useEffect(() => { setLocalItem('cn-devices', devices); setHealthScores(calculateHealth(devices, alerts)); }, [devices]);
  useEffect(() => { setLocalItem('cn-clients', clients); }, [clients]);
  useEffect(() => { setLocalItem('cn-vlans', vlans); }, [vlans]);
  useEffect(() => { setLocalItem('cn-dhcp-leases', dhcpLeases); }, [dhcpLeases]);
  useEffect(() => { setLocalItem('cn-ssids', ssids); }, [ssids]);
  useEffect(() => { setLocalItem('cn-alerts', alerts); setHealthScores(calculateHealth(devices, alerts)); }, [alerts]);
  useEffect(() => { setLocalItem('cn-audit-logs', logs); }, [logs]);
  useEffect(() => { setLocalItem('cn-tasks', tasks); }, [tasks]);
  useEffect(() => { setLocalItem('cn-templates', templates); }, [templates]);
  useEffect(() => { setLocalItem('cn-automation-rules', automationRules); }, [automationRules]);
  useEffect(() => { setLocalItem('cn-insights', insights); }, [insights]);
  useEffect(() => { setLocalItem('cn-discovered-devices', discoveredDevices); }, [discoveredDevices]);
  useEffect(() => { setLocalItem('cn-maint-windows', maintenanceWindows); }, [maintenanceWindows]);
  useEffect(() => { setLocalItem('cn-sec-events', securityEvents); }, [securityEvents]);

  // --- DEVICE CAPABILITY ENGINE ---
  const deviceHasCapability = (deviceType: string, capability: string): boolean => {
    const caps: Record<string, string[]> = {
      'firewall': ['NAT', 'VPN', 'DHCP', 'FIREWALL_POLICIES'],
      'core_switch': ['ROUTING', 'VLAN', 'QOS', 'POE'],
      'access_switch': ['VLAN', 'POE', 'PORT_SECURITY'],
      'access_point': ['SSID', 'RADIO_CONF', 'FIRMWARE', 'CLIENT_MGMT']
    };
    return caps[deviceType]?.includes(capability.toUpperCase()) || false;
  };

  // --- REALISTIC HARDWARE TELEMETRY SIMULATION LOOP ---
  useEffect(() => {
    const interval = setInterval(() => {
      // 1. Fluctuating CPU, Memory, and bandwidth
      setDevices(prev => 
        prev.map(d => {
          if (d.status === 'offline') return d;
          
          const cpuDelta = Math.floor(Math.random() * 5) - 2; // -2% to +2%
          const memDelta = Math.floor(Math.random() * 3) - 1; // -1% to +1%
          
          let newCpu = Math.min(95, Math.max(2, d.cpuUsage + cpuDelta));
          let newMem = Math.min(90, Math.max(5, d.memoryUsage + memDelta));
          
          // Switch-2 high CPU simulation triggers warning if CPU exceeds 75%
          let status = d.status;
          let healthScore = d.healthScore;
          
          if (newCpu > 85) {
            status = 'warning';
            healthScore = Math.max(50, d.healthScore - 2);
          } else if (status === 'warning' && newCpu <= 75) {
            status = 'online';
            healthScore = Math.min(100, d.healthScore + 2);
          }
          
          return {
            ...d,
            cpuUsage: newCpu,
            memoryUsage: newMem,
            status,
            healthScore
          };
        })
      );

      // 2. Client traffic fluctuations
      setClients(prev =>
        prev.map(c => {
          if (c.status === 'inactive') return c;
          const rxDelta = (Math.random() * 10 - 5);
          const txDelta = (Math.random() * 4 - 2);
          return {
            ...c,
            rxRate: Math.max(0.1, Number((c.rxRate + rxDelta).toFixed(1))),
            txRate: Math.max(0.1, Number((c.txRate + txDelta).toFixed(1)))
          };
        })
      );

      // 3. Scan automation rules (e.g. IF CPU > 90% generate warning alert)
      devices.forEach(d => {
        if (d.status !== 'offline' && d.cpuUsage > 90) {
          const rule = automationRules.find(r => r.trigger === 'cpu_high' && r.enabled);
          if (rule) {
            triggerAutomationAction(rule, `High CPU utilization (${d.cpuUsage}%) detected on ${d.name}.`);
          }
        }
      });
      
    }, 6000); // Trigger every 6 seconds

    return () => clearInterval(interval);
  }, [devices, automationRules]);

  // --- LOCAL BACKEND DATA SYNC LOOP ---
  useEffect(() => {
    let active = true;
    
    const syncBackend = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/v1/devices');
        if (res.ok && active) {
          const devData = await res.json();
          if (devData && devData.length > 0) {
            setDevices(devData);
          }
        }
        
        const cliRes = await fetch('http://localhost:8000/api/v1/clients');
        if (cliRes.ok && active) {
          const cliData = await cliRes.json();
          if (cliData) setClients(cliData);
        }
        
        const vlanRes = await fetch('http://localhost:8000/api/v1/vlans');
        if (vlanRes.ok && active) {
          const vlanData = await vlanRes.json();
          if (vlanData) setVlans(vlanData);
        }
        
        const leaseRes = await fetch('http://localhost:8000/api/v1/dhcp/leases');
        if (leaseRes.ok && active) {
          const leaseData = await leaseRes.json();
          if (leaseData) setDhcpLeases(leaseData);
        }

        const alertRes = await fetch('http://localhost:8000/api/v1/alerts');
        if (alertRes.ok && active) {
          const alertData = await alertRes.json();
          if (alertData) setAlerts(alertData);
        }
      } catch (err) {
        // Backend offline fallback - keep using local memory
      }
    };

    syncBackend();
    const syncInterval = setInterval(syncBackend, 5000);
    return () => {
      active = false;
      clearInterval(syncInterval);
    };
  }, []);

  // AI Insights generation loop
  useEffect(() => {
    // Check AP utilization counts
    const runAiScan = () => {
      const activeInsights: AiInsight[] = [];
      
      const ap2 = devices.find(d => d.id === 'dev-ap-2');
      if (ap2 && ap2.clientsCount >= 3) {
        const rule = automationRules.find(r => r.trigger === 'ap_client_count' && r.enabled);
        if (rule) {
          activeInsights.push({
            id: 'insight-load-ap2',
            category: 'optimization',
            title: 'AP Overload Balance',
            description: `Indoor Access Point ${ap2.name} is experiencing high user density (${ap2.clientsCount} clients). Moving Johns-MacBook-Pro to CN-AP-01-LOBBY will reduce packet congestion on the radio cell by 33%.`,
            impact: 'High (Improves Wi-Fi response time for 3 clients)',
            status: 'pending',
            timestamp: new Date().toISOString(),
            suggestedAction: 'Migrate clients to adjacent radio'
          });
        }
      }
      
      const fw = devices.find(d => d.id === 'dev-fw-1');
      if (fw && fw.cpuUsage > 18) {
        activeInsights.push({
          id: 'insight-fw-sec',
          category: 'security',
          title: 'Firewall Policy Optimization',
          description: `Intrusion checks on ${fw.name} are processing high packet inspect frequencies, causing CPU overhead. Grouping redundant source policies will lower lookup cycles by ~12%.`,
          impact: 'Medium (Decreases core firewall heat/CPU load)',
          status: 'pending',
          timestamp: new Date().toISOString(),
          suggestedAction: 'Review Security Policies'
        });
      }

      setInsights(activeInsights);
    };

    const timeout = setTimeout(runAiScan, 2000);
    return () => clearTimeout(timeout);
  }, [devices, automationRules]);

  // Execute Automation rule action side-effect
  const triggerAutomationAction = (rule: AutomationRule, message: string) => {
    if (rule.actionType === 'alert') {
      setAlerts(prev => {
        if (prev.some(a => a.message === message && !a.resolved)) return prev;
        return [{
          id: 'alert-' + Math.random().toString(36).substring(7),
          severity: rule.actionValue as any || 'warning',
          message,
          timestamp: new Date().toISOString(),
          resolved: false,
          category: 'system'
        }, ...prev];
      });
    }
  };

  // --- WORKFLOW TASK RUNNER ---
  const runProvisioningTask = async (
    name: string, 
    targetDevices: string[], 
    payload: () => Promise<any>,
    rollbackPayload?: any
  ): Promise<boolean> => {
    const taskId = 'task-' + Math.random().toString(36).substring(7);
    const newTask: ProvisioningTask = {
      id: taskId,
      name,
      status: 'pending',
      createdBy: user?.username || 'admin',
      createdTime: new Date().toISOString(),
      targetDevices,
      progress: 0,
      logs: ['Provisioning task created. Scheduling lock reservations on target nodes...']
    };
    
    setTasks(prev => [newTask, ...prev]);

    // 1. Task moves to running
    await new Promise(r => setTimeout(r, 800));
    setTasks(prev => prev.map(t => t.id === taskId ? { 
      ...t, 
      status: 'running', 
      progress: 25, 
      logs: [...t.logs, 'Acquired configuration lock on device nodes.', 'Validating configuration schemas...'] 
    } : t));

    // 2. Perform validation checks
    await new Promise(r => setTimeout(r, 600));
    setTasks(prev => prev.map(t => t.id === taskId ? { 
      ...t, 
      progress: 50, 
      logs: [...t.logs, 'Validation validation: Configuration format OK.', 'Pushing desired states to hardware collectors...'] 
    } : t));

    try {
      // Execute the actual state adjustments
      const resultData = await payload();

      // 3. Finalize task as complete
      await new Promise(r => setTimeout(r, 800));
      setTasks(prev => prev.map(t => t.id === taskId ? { 
        ...t, 
        status: 'completed', 
        progress: 100, 
        duration: '2.2s',
        logs: [...t.logs, 'Commit succeeded. Target configurations deployed.', 'Released locks.'],
        result: 'Configuration applied successfully.',
        rollbackInfo: rollbackPayload
      } : t));

      // Append Audit Log
      const auditLog: AuditLog = {
        id: 'aud-' + Math.random().toString(36).substring(7),
        timestamp: new Date().toISOString(),
        user: user?.username || 'admin',
        action: name,
        target: targetDevices.join(', '),
        reason: 'Operator manual provisioning configuration change.',
        rollbackPoint: rollbackPayload ? JSON.stringify(rollbackPayload) : undefined
      };
      setLogs(prev => [auditLog, ...prev]);
      
      return true;
    } catch (err: any) {
      // Set task to failed
      setTasks(prev => prev.map(t => t.id === taskId ? { 
        ...t, 
        status: 'failed', 
        progress: 100, 
        logs: [...t.logs, `Error encountered: ${err.message || 'Operation aborted.'}`, 'Rolling back changes...'],
        result: `Failed: ${err.message || 'Verification failed.'}` 
      } : t));
      return false;
    }
  };

  // --- BUSINESS OPERATION WORKFLOW ACTIONS ---

  // 1. Onboard Device
  const onboardDevice = async (device: Omit<NetworkDevice, 'id' | 'healthScore' | 'cpuUsage' | 'memoryUsage' | 'clientsCount' | 'uptime'>): Promise<boolean> => {
    // Unique Hostname, IP & MAC validation
    if (devices.some(d => d.name.toLowerCase() === device.name.toLowerCase())) {
      throw new Error(`Hostname "${device.name}" is already registered in this site.`);
    }
    if (devices.some(d => d.ipAddress === device.ipAddress)) {
      throw new Error(`Management IP address ${device.ipAddress} is already assigned to an inventory device.`);
    }
    if (devices.some(d => d.macAddress === device.macAddress.toUpperCase())) {
      throw new Error(`MAC Address ${device.macAddress} matches a claimed node in organization.`);
    }

    return runProvisioningTask(
      `Claim and Onboard Hardware Node: ${device.name}`,
      ['CN-BORDER-CONTROLLER'],
      async () => {
        const onboarded = await api.onboardDevice({
          ...device,
          macAddress: device.macAddress.toUpperCase()
        });
        setDevices(prev => [...prev, onboarded]);
        return onboarded;
      }
    );
  };

  // 2. Delete Device
  const deleteDevice = async (deviceId: string): Promise<boolean> => {
    const dev = devices.find(d => d.id === deviceId);
    if (!dev) throw new Error('Device not found');

    // AP connection verification validation
    if (dev.type === 'access_point' && clients.some(c => c.connectedToDeviceId === deviceId && c.status === 'active')) {
      throw new Error('Decommission blocked: This AP currently services active client connections.');
    }

    return runProvisioningTask(
      `Decommission Hardware Device: ${dev.name}`,
      [dev.name],
      async () => {
        await api.deleteDevice(deviceId);
        setDevices(prev => prev.filter(d => d.id !== deviceId));
        return true;
      }
    );
  };

  // 3. Restart Device
  const restartDevice = async (deviceId: string): Promise<boolean> => {
    const dev = devices.find(d => d.id === deviceId);
    if (!dev) throw new Error('Device not found');

    const rollbackState = { id: deviceId, uptime: dev.uptime, status: dev.status, clientsCount: dev.clientsCount };

    return runProvisioningTask(
      `Reboot Network hardware Node: ${dev.name}`,
      [dev.name],
      async () => {
        // Restart side effect: temporary client migration if it is an AP
        if (dev.type === 'access_point') {
          setClients(prev => 
            prev.map(c => {
              if (c.connectedToDeviceId === deviceId) {
                // Migrate to AP-1 or AP-2
                const fallbackAp = devices.find(d => d.type === 'access_point' && d.id !== deviceId && d.status === 'online');
                if (fallbackAp) {
                  return {
                    ...c,
                    connectedToDeviceId: fallbackAp.id,
                    connectedToDeviceName: fallbackAp.name
                  };
                } else {
                  return { ...c, status: 'inactive' };
                }
              }
              return c;
            })
          );
        }

        setDevices(prev => 
          prev.map(d => d.id === deviceId ? { 
            ...d, 
            uptime: '0 mins', 
            status: 'online', 
            healthScore: 100,
            clientsCount: 0 
          } : d)
        );

        setAlerts(prev => [
          {
            id: 'alert-' + Math.random().toString(36).substring(7),
            severity: 'info',
            message: `Operator rebooted device node ${dev.name}. Restarting configuration processes.`,
            timestamp: new Date().toISOString(),
            resolved: true,
            category: 'system'
          },
          ...prev
        ]);
        return true;
      },
      rollbackState
    );
  };

  // 4. Backup config snapshot
  const backupDeviceConfig = async (deviceId: string, reason: string): Promise<boolean> => {
    const dev = devices.find(d => d.id === deviceId);
    if (!dev) throw new Error('Device not found');

    return runProvisioningTask(
      `Backup configuration snap: ${dev.name}`,
      [dev.name],
      async () => {
        const nextVersion = (dev.backupHistory?.length || 0) + 1;
        const newBackup = {
          version: nextVersion,
          timestamp: new Date().toISOString(),
          createdBy: user?.username || 'admin',
          description: reason || 'Manual configuration backup',
          configSnapshot: JSON.stringify(dev.config)
        };
        setDevices(prev => prev.map(d => {
          if (d.id === deviceId) {
            return {
              ...d,
              backupHistory: [...(d.backupHistory || []), newBackup]
            };
          }
          return d;
        }));

        // Appends config state backup details to audit log database
        const backupEntry: AuditLog = {
          id: 'snap-' + Math.random().toString(36).substring(7),
          timestamp: new Date().toISOString(),
          user: user?.username || 'admin',
          action: 'Snapshot configuration backup',
          target: dev.name,
          newValue: JSON.stringify(dev.config),
          reason: reason || 'Manual configuration backup'
        };
        setLogs(prev => [backupEntry, ...prev]);
        return true;
      }
    );
  };

  // 5. Restore snapshot backup
  const rollbackConfiguration = async (backupId: string): Promise<boolean> => {
    const logEntry = logs.find(l => l.id === backupId);
    if (!logEntry || !logEntry.newValue) throw new Error('Backup snapshot not found.');

    const targetName = logEntry.target;
    const dev = devices.find(d => d.name === targetName);
    if (!dev) throw new Error(`Target device node ${targetName} is no longer in inventory.`);

    return runProvisioningTask(
      `Rollback configuration to backup snapshot`,
      [dev.name],
      async () => {
        const configSnapshot = JSON.parse(logEntry.newValue!);
        setDevices(prev => 
          prev.map(d => d.id === dev.id ? { ...d, config: configSnapshot } : d)
        );
        return true;
      }
    );
  };

  // 6. Save SSID configurations
  const saveSsid = async (ssid: SsidConfig): Promise<boolean> => {
    // SSID duplicate name validations
    const isNew = !ssid.id;
    const duplicate = ssids.some(s => s.ssid.toLowerCase() === ssid.ssid.toLowerCase() && s.id !== ssid.id);
    if (duplicate) {
      throw new Error(`SSID WiFi network named "${ssid.ssid}" is already registered.`);
    }

    const previousSsid = ssids.find(s => s.id === ssid.id);

    return runProvisioningTask(
      isNew ? `Broadcast new WiFi SSID: ${ssid.ssid}` : `Modify WiFi SSID Settings: ${ssid.ssid}`,
      ['CN-AP-01-LOBBY', 'CN-AP-02-CONF-A'],
      async () => {
        if (isNew) {
          const newSsid: SsidConfig = {
            ...ssid,
            id: 'ssid-' + Math.random().toString(36).substring(7),
            clientsCount: 0
          };
          setSsids(prev => [...prev, newSsid]);
        } else {
          setSsids(prev => prev.map(s => s.id === ssid.id ? ssid : s));
        }

        // Side effect: update associated Access Points broadcast mappings
        setDevices(prev =>
          prev.map(d => {
            if (d.type === 'access_point') {
              const currentSsids = d.config.ssids || [];
              if (isNew) {
                // Auto-broadcast on active APs
                return {
                  ...d,
                  config: { ...d.config, ssids: [...currentSsids, ssid.ssid] }
                };
              } else if (previousSsid && previousSsid.ssid !== ssid.ssid) {
                // Update SSID name map
                return {
                  ...d,
                  config: { 
                    ...d.config, 
                    ssids: currentSsids.map(name => name === previousSsid.ssid ? ssid.ssid : name) 
                  }
                };
              }
            }
            return d;
          })
        );
        return true;
      },
      previousSsid
    );
  };

  // 7. Delete SSID
  const deleteSsid = async (ssidId: string): Promise<boolean> => {
    const ssid = ssids.find(s => s.id === ssidId);
    if (!ssid) throw new Error('SSID not found');

    return runProvisioningTask(
      `Terminate WiFi SSID Broadcast: ${ssid.ssid}`,
      ['CN-AP-01-LOBBY', 'CN-AP-02-CONF-A'],
      async () => {
        setSsids(prev => prev.filter(s => s.id !== ssidId));

        // Side effect: disconnect wireless clients connected to this SSID
        // In our client map, wireless clients are linked via VLAN ID
        setClients(prev =>
          prev.map(c => {
            if (c.connectionType === 'wireless' && c.vlanId === ssid.vlanId) {
              return { ...c, status: 'inactive' };
            }
            return c;
          })
        );

        // Remove SSID from AP configurations broadcast list
        setDevices(prev =>
          prev.map(d => {
            if (d.type === 'access_point' && d.config.ssids) {
              return {
                ...d,
                config: { 
                  ...d.config, 
                  ssids: d.config.ssids.filter(name => name !== ssid.ssid) 
                }
              };
            }
            return d;
          })
        );
        return true;
      }
    );
  };

  // 8. Add VLAN Profile
  const addVlan = async (vlan: Omit<Vlan, 'activeLeasesCount'>): Promise<boolean> => {
    if (vlans.some(v => v.id === vlan.id)) {
      throw new Error(`VLAN ID ${vlan.id} already exists.`);
    }

    return runProvisioningTask(
      `Create global VLAN Trunk Profile: ${vlan.name} (VLAN ${vlan.id})`,
      ['CN-CS-01-SPINE', 'CN-AS-01-FLOOR1', 'CN-AS-02-FLOOR2'],
      async () => {
        const added = await api.addVlan(vlan);
        setVlans(prev => [...prev, added]);
        return added;
      }
    );
  };

  // 9. Delete VLAN Profile
  const deleteVlan = async (vlanId: number): Promise<boolean> => {
    if (vlanId === 10) {
      throw new Error('Default Management VLAN 10 is protected and cannot be deleted.');
    }

    // Validation engine: block if in use by WiFi SSIDs
    const inUseSsid = ssids.find(s => s.vlanId === vlanId);
    if (inUseSsid) {
      throw new Error(`Delete Blocked: VLAN ${vlanId} is currently assigned to broadcast WiFi SSID "${inUseSsid.ssid}".`);
    }

    // Validation engine: block if in use by active switch port interfaces
    const inUsePort = devices.some(d => 
      d.config.interfaces && 
      Object.values(d.config.interfaces).some(i => i.vlan === vlanId)
    );
    if (inUsePort) {
      throw new Error(`Delete Blocked: VLAN ${vlanId} is currently assigned to switch interfaces.`);
    }

    return runProvisioningTask(
      `Remove global VLAN Trunk Profile: VLAN ${vlanId}`,
      ['CN-CS-01-SPINE', 'CN-AS-01-FLOOR1', 'CN-AS-02-FLOOR2'],
      async () => {
        await api.deleteVlan(vlanId);
        setVlans(prev => prev.filter(v => v.id !== vlanId));
        return true;
      }
    );
  };

  // 10. Rename VLAN Profile
  const renameVlan = async (vlanId: number, newName: string): Promise<boolean> => {
    return runProvisioningTask(
      `Rename VLAN ${vlanId} to ${newName}`,
      ['CN-CS-01-SPINE'],
      async () => {
        const existing = vlans.find(v => v.id === vlanId);
        if (existing) {
          await api.addVlan({ ...existing, name: newName });
        }
        setVlans(prev => prev.map(v => v.id === vlanId ? { ...v, name: newName } : v));
        return true;
      }
    );
  };

  // 11. Configure switch ports
  const updateSwitchPortConfig = async (
    deviceId: string, 
    portKey: string, 
    config: { enabled?: boolean; vlanId?: number; poe?: boolean }
  ): Promise<boolean> => {
    const dev = devices.find(d => d.id === deviceId);
    if (!dev) throw new Error('Device not found');
    
    const portData = dev.config.interfaces?.[portKey];
    if (!portData) throw new Error(`Port interface ${portKey} not found.`);

    const previousState = { ...dev.config };

    return runProvisioningTask(
      `Configure Switch port ${portKey} interface profile on ${dev.name}`,
      [dev.name],
      async () => {
        const updatedPort = {
          ...portData,
          enabled: config.enabled !== undefined ? config.enabled : portData.enabled,
          vlan: config.vlanId !== undefined ? config.vlanId : portData.vlan,
          poe: config.poe !== undefined ? config.poe : portData.poe
        };
        const updatedInterfaces = {
          ...dev.config.interfaces,
          [portKey]: updatedPort
        } as Record<string, { enabled: boolean; vlan: number; speed: string; poe?: boolean }>;

        await api.updateDeviceConfig(deviceId, { interfaces: updatedInterfaces });

        setDevices(prev =>
          prev.map(d => {
            if (d.id === deviceId && d.config.interfaces) {
              return {
                ...d,
                config: {
                  ...d.config,
                  interfaces: updatedInterfaces
                }
              } as NetworkDevice;
            }
            return d;
          })
        );

        if (config.enabled === false) {
          setClients(prev =>
            prev.map(c => {
              if (c.connectionType === 'wired' && c.connectedToDeviceId === deviceId) {
                if (portKey === 'ge0' && c.id === 'cli-3') return { ...c, status: 'inactive' };
                if (portKey === 'ge1' && c.id === 'cli-4') return { ...c, status: 'inactive' };
              }
              return c;
            })
          );
        }
        return true;
      },
      previousState
    );
  };

  // 12. Quarantine client
  const quarantineClient = async (clientId: string): Promise<boolean> => {
    const client = clients.find(c => c.id === clientId);
    if (!client) throw new Error('Client not found');

    return runProvisioningTask(
      `Quarantine client and drop connection: ${client.name}`,
      [client.connectedToDeviceName],
      async () => {
        const quarantined = await api.quarantineClient(clientId);
        setClients(prev => prev.map(c => c.id === clientId ? quarantined : c));
        return true;
      }
    );
  };

  // 13. Disconnect client
  const disconnectClient = async (clientId: string): Promise<boolean> => {
    const client = clients.find(c => c.id === clientId);
    if (!client) throw new Error('Client not found');

    return runProvisioningTask(
      `Kick / Disconnect Client link: ${client.name}`,
      [client.connectedToDeviceName],
      async () => {
        setClients(prev => prev.map(c => c.id === clientId ? { ...c, status: 'inactive' } : c));
        return true;
      }
    );
  };

  // 14. Limit client bandwidth
  const limitClientBandwidth = async (clientId: string, rate: number): Promise<boolean> => {
    const client = clients.find(c => c.id === clientId);
    if (!client) throw new Error('Client not found');

    return runProvisioningTask(
      `Apply dynamic rate-limit policy on client host: ${client.name} (${rate} Mbps)`,
      [client.connectedToDeviceName],
      async () => {
        // Set client traffic limit
        setClients(prev =>
          prev.map(c => c.id === clientId ? { ...c, rxRate: Math.min(c.rxRate, rate), txRate: Math.min(c.txRate, rate / 2) } : c)
        );
        return true;
      }
    );
  };

  // 15. Apply AI insight optimization recommendation
  const applyInsight = async (insightId: string): Promise<boolean> => {
    const insight = insights.find(i => i.id === insightId);
    if (!insight) throw new Error('AI Insight not found');

    return runProvisioningTask(
      `Apply optimization: ${insight.title}`,
      ['CN-AP-02-CONF-A', 'CN-AS-02-FLOOR2'],
      async () => {
        setInsights(prev => prev.map(i => i.id === insightId ? { ...i, status: 'applied' } : i));

        if (insightId === 'insight-load-ap2') {
          // Migration side effect: move Johns MacBook from AP-2 to AP-1 Lobby to load balance!
          setClients(prev =>
            prev.map(c => {
              if (c.id === 'cli-1') {
                return {
                  ...c,
                  connectedToDeviceId: 'dev-ap-1',
                  connectedToDeviceName: 'CN-AP-01-LOBBY',
                  signalStrength: -62
                };
              }
              return c;
            })
          );
          
          setDevices(prev =>
            prev.map(d => {
              if (d.id === 'dev-ap-2') return { ...d, clientsCount: Math.max(0, d.clientsCount - 1), healthScore: 98 };
              if (d.id === 'dev-ap-1') return { ...d, clientsCount: d.clientsCount + 1 };
              return d;
            })
          );
        } else if (insightId === 'insight-fw-sec') {
          // Decreases firewall CPU load
          setDevices(prev =>
            prev.map(d => d.id === 'dev-fw-1' ? { ...d, cpuUsage: 9, healthScore: 99 } : d)
          );
        }

        return true;
      }
    );
  };

  // 16. Manage Automation Rules
  const addAutomationRule = async (rule: Omit<AutomationRule, 'id'>): Promise<boolean> => {
    const newRule: AutomationRule = {
      ...rule,
      id: 'rule-' + Math.random().toString(36).substring(7)
    };
    setAutomationRules(prev => [...prev, newRule]);
    
    // Add audit log
    const auditLog: AuditLog = {
      id: 'aud-' + Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString(),
      user: user?.username || 'admin',
      action: `Create Automation Rule: ${rule.name}`,
      target: 'Automation Engine'
    };
    setLogs(prev => [auditLog, ...prev]);
    return true;
  };

  const deleteAutomationRule = async (ruleId: string): Promise<boolean> => {
    setAutomationRules(prev => prev.filter(r => r.id !== ruleId));
    return true;
  };

  const addStaticReservation = async (reservation: { clientName: string; ipAddress: string; macAddress: string; vlanId: number }): Promise<boolean> => {
    const newLease: DhcpLease = {
      id: 'lease-' + Math.random().toString(36).substring(7),
      ipAddress: reservation.ipAddress,
      macAddress: reservation.macAddress.toUpperCase(),
      clientName: reservation.clientName,
      vlanId: reservation.vlanId,
      leaseTime: 'Static Reservation'
    };

    return runProvisioningTask(
      `Reserve Static DHCP binding: ${reservation.clientName} (${reservation.ipAddress})`,
      ['CN-FW-01-BORDER'],
      async () => {
        setDhcpLeases(prev => [...prev, newLease]);
        return true;
      }
    );
  };

  const deleteStaticReservation = async (leaseId: string): Promise<boolean> => {
    return runProvisioningTask(
      `Delete DHCP binding reservation: ${leaseId}`,
      ['CN-FW-01-BORDER'],
      async () => {
        setDhcpLeases(prev => prev.filter(l => l.id !== leaseId));
        return true;
      }
    );
  };

  // --- NEW SIMULATED ACTIONS IMPLEMENTATIONS ---
  const discoverDevices = async (): Promise<DiscoveredDevice[]> => {
    // Return current discovered list
    return discoveredDevices;
  };

  const onboardDiscoveredDevices = async (ids: string[]): Promise<boolean> => {
    return runProvisioningTask(
      `Onboard Discovered Nodes: ${ids.length} devices`,
      ['CN-BORDER-CONTROLLER'],
      async () => {
        const selected = discoveredDevices.filter(d => ids.includes(d.id));
        if (selected.length === 0) return true;
        
        const newDevs: NetworkDevice[] = selected.map(s => ({
          id: 'dev-' + Math.random().toString(36).substring(7),
          name: s.hostname,
          type: s.deviceType,
          ipAddress: s.ipAddress,
          macAddress: s.macAddress,
          status: 'online',
          model: s.model,
          version: s.firmware,
          uptime: '0 mins',
          healthScore: 100,
          cpuUsage: 12,
          memoryUsage: 28,
          clientsCount: 0,
          config: {
            interfaces: {
              'ge0': { enabled: true, vlan: 10, speed: '1000Mbps', poe: s.deviceType !== 'firewall' }
            },
            firmwareAutoUpdate: true
          },
          temperature: 39,
          powerStatus: 'Healthy',
          interfacesCount: s.deviceType.includes('switch') ? 48 : 8,
          interfacesActive: 1,
          bandwidth: 0,
          availability: 99.9,
          lastSeenSecondsAgo: 5,
          lifecycleStage: 'onboarded',
          firmwareInfo: {
            currentVersion: s.firmware,
            latestVersion: s.firmware,
            releaseDate: '2026-04-10',
            releaseNotes: 'Stability release.',
            status: 'up_to_date'
          },
          maintenanceConfig: {
            enabled: false,
            suppressAlerts: true,
            pauseMonitoring: false
          },
          backupHistory: []
        }));

        setDevices(prev => [...prev, ...newDevs]);
        setDiscoveredDevices(prev => prev.filter(d => !ids.includes(d.id)));
        return true;
      }
    );
  };

  const runDiagnostics = async (deviceId: string, type: string, target: string): Promise<any> => {
    const dev = devices.find(d => d.id === deviceId);
    const targetName = dev ? dev.name : 'Device';
    
    return runProvisioningTask(
      `Diagnostics Suite: Run ${type} troubleshooting from ${targetName}`,
      [targetName],
      async () => {
        return true;
      }
    );
  };

  const updateFirmware = async (deviceId: string, targetVersion: string): Promise<boolean> => {
    const dev = devices.find(d => d.id === deviceId);
    if (!dev) throw new Error('Device not found');
    
    return runProvisioningTask(
      `Upgrade System Firmware on ${dev.name} to version ${targetVersion}`,
      [dev.name],
      async () => {
        setDevices(prev => prev.map(d => {
          if (d.id === deviceId) {
            return {
              ...d,
              version: targetVersion,
              firmwareInfo: d.firmwareInfo ? {
                ...d.firmwareInfo,
                currentVersion: targetVersion,
                status: 'up_to_date'
              } : undefined
            };
          }
          return d;
        }));
        return true;
      }
    );
  };

  const toggleMaintenance = async (deviceId: string, config: MaintenanceConfig): Promise<boolean> => {
    const dev = devices.find(d => d.id === deviceId);
    if (!dev) throw new Error('Device not found');

    return runProvisioningTask(
      config.enabled ? `Place ${dev.name} in Maintenance Mode` : `Remove ${dev.name} from Maintenance Mode`,
      [dev.name],
      async () => {
        setDevices(prev => prev.map(d => {
          if (d.id === deviceId) {
            return {
              ...d,
              status: config.enabled ? 'warning' : 'online',
              lifecycleStage: config.enabled ? 'maintenance' : 'operational',
              maintenanceConfig: config
            };
          }
          return d;
        }));

        if (config.enabled) {
          setMaintenanceWindows(prev => [
            {
              id: 'maint-' + Math.random().toString(36).substring(7),
              deviceId,
              deviceName: dev.name,
              reason: config.notes || 'Routine hardware optimization.',
              startTime: config.startTime || new Date().toISOString(),
              endTime: config.endTime || new Date(Date.now() + 7200000).toISOString(),
              engineer: user?.username || 'admin',
              status: 'active'
            },
            ...prev
          ]);
        } else {
          setMaintenanceWindows(prev => prev.map(w => w.deviceId === deviceId && w.status === 'active' ? { ...w, status: 'completed' } : w));
        }
        return true;
      }
    );
  };

  const restoreDeviceConfig = async (deviceId: string, versionNumber: number): Promise<boolean> => {
    const dev = devices.find(d => d.id === deviceId);
    if (!dev) throw new Error('Device not found');
    const versionItem = dev.backupHistory?.find(v => v.version === versionNumber);
    if (!versionItem) throw new Error('Config backup version not found');

    return runProvisioningTask(
      `Restore Configuration Rollback: Version ${versionNumber} on ${dev.name}`,
      [dev.name],
      async () => {
        const parsedConfig = JSON.parse(versionItem.configSnapshot);
        setDevices(prev => prev.map(d => {
          if (d.id === deviceId) {
            return { ...d, config: parsedConfig };
          }
          return d;
        }));
        return true;
      }
    );
  };

  const resolveAlert = async (alertId: string): Promise<boolean> => {
    await api.resolveAlert(alertId);
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, resolved: true } : a));
    return true;
  };

  return (
    <NetworkStoreContext.Provider value={{
      organizations,
      sites,
      buildings,
      devices,
      ssids,
      vlans,
      dhcpLeases,
      clients,
      alerts,
      logs,
      tasks,
      templates,
      automationRules,
      healthScores,
      insights,
      discoveredDevices,
      maintenanceWindows,
      securityEvents,
      onboardDevice,
      deleteDevice,
      restartDevice,
      backupDeviceConfig,
      rollbackConfiguration,
      saveSsid,
      deleteSsid,
      addVlan,
      deleteVlan,
      renameVlan,
      updateSwitchPortConfig,
      quarantineClient,
      disconnectClient,
      limitClientBandwidth,
      applyInsight,
      addAutomationRule,
      deleteAutomationRule,
      addStaticReservation,
      deleteStaticReservation,
      runProvisioningTask,
      deviceHasCapability,
      discoverDevices,
      onboardDiscoveredDevices,
      runDiagnostics,
      updateFirmware,
      toggleMaintenance,
      restoreDeviceConfig,
      resolveAlert
    }}>
      {children}
    </NetworkStoreContext.Provider>
  );
};

export const useNetworkStore = () => {
  const context = useContext(NetworkStoreContext);
  if (context === undefined) {
    throw new Error('useNetworkStore must be used within a NetworkStoreProvider');
  }
  return context;
};
