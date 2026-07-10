export type UserRole = 'Super Admin' | 'Network Administrator' | 'Network Engineer';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  token?: string;
}

export type DeviceType = 'firewall' | 'core_switch' | 'access_switch' | 'access_point';
export type DeviceStatus = 'online' | 'offline' | 'warning';

export interface DeviceConfig {
  interfaces?: Record<string, { enabled: boolean; vlan: number; speed: string; poe?: boolean }>;
  ssids?: string[];
  firmwareAutoUpdate?: boolean;
  dnsServers?: string[];
  routingTable?: { destination: string; gateway: string; interface: string }[];
}

export interface NetworkDevice {
  id: string;
  name: string;
  type: DeviceType;
  ipAddress: string;
  macAddress: string;
  status: DeviceStatus;
  model: string;
  version: string;
  uptime: string; // e.g. "12 days, 4 hours"
  healthScore: number;
  cpuUsage: number;
  memoryUsage: number;
  clientsCount: number;
  config: DeviceConfig;
  temperature?: number;
  powerStatus?: 'Healthy' | 'Warning' | 'Critical';
  interfacesCount?: number;
  interfacesActive?: number;
  bandwidth?: number;
  availability?: number;
  lastSeenSecondsAgo?: number;
  lifecycleStage?: 'discovered' | 'onboarded' | 'configured' | 'operational' | 'maintenance' | 'retired';
  firmwareInfo?: FirmwareStatus;
  maintenanceConfig?: MaintenanceConfig;
  backupHistory?: BackupVersion[];
}

export interface NetworkClient {
  id: string;
  name: string;
  macAddress: string;
  ipAddress: string;
  connectionType: 'wired' | 'wireless';
  status: 'active' | 'inactive';
  rxRate: number; // Mbps
  txRate: number; // Mbps
  signalStrength?: number; // dBm (wireless only)
  connectedToDeviceId: string; // Device ID it is connected to
  connectedToDeviceName: string;
  vlanId: number;
  os: string;
  band?: '2.4GHz' | '5GHz' | '6GHz';
  rateLimitRx?: number;
  rateLimitTx?: number;
}

export interface Vlan {
  id: number;
  name: string;
  subnet: string;
  dhcpRange: string;
  dnsServers: string[];
  activeLeasesCount: number;
}

export interface DhcpLease {
  id: string;
  ipAddress: string;
  macAddress: string;
  clientName: string;
  leaseTime: string;
  vlanId: number;
}


export interface SsidConfig {
  id: string;
  ssid: string;
  securityType: 'WPA2-Personal' | 'WPA3-Personal' | 'WPA3-Enterprise' | 'Open';
  status: 'active' | 'inactive';
  band: '2.4GHz' | '5GHz' | '6GHz' | 'Dual' | 'Tri-Band';
  vlanId: number;
  clientsCount: number;
  maxClients: number;
  rateLimitRx?: number; // Mbps
  rateLimitTx?: number; // Mbps
  portalEnabled: boolean;
}

export interface NetworkAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
  deviceId?: string;
  deviceName?: string;
  resolved: boolean;
  category: 'system' | 'device' | 'security' | 'client';
}

export interface AiInsight {
  id: string;
  category: 'security' | 'performance' | 'optimization' | 'anomaly';
  title: string;
  description: string;
  impact: string;
  status: 'pending' | 'applied' | 'ignored';
  timestamp: string;
  suggestedAction?: string;
}

export interface PortStatus {
  port: string;
  status: 'up' | 'down';
  speed: string;
  vlan: number;
  poeStatus?: {
    enabled: boolean;
    powerWatts: number;
  };
}

export interface Organization {
  id: string;
  name: string;
}

export interface Site {
  id: string;
  name: string;
  orgId: string;
}

export interface Building {
  id: string;
  name: string;
  siteId: string;
}

export interface ProvisioningTask {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdBy: string;
  createdTime: string;
  targetDevices: string[];
  progress: number;
  logs: string[];
  duration?: string;
  result?: string;
  rollbackInfo?: any;
}

export interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  type: 'wifi' | 'vlan' | 'dhcp';
  config: any;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  target: string;
  prevValue?: string;
  newValue?: string;
  reason?: string;
  rollbackPoint?: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: 'device_offline' | 'ap_client_count' | 'cpu_high' | 'memory_high';
  threshold?: number;
  actionType: 'alert' | 'notification' | 'ai_recommendation';
  actionValue: string;
  enabled: boolean;
}

export interface HealthScores {
  network: number;
  device: number;
  wifi: number;
  campus: number;
}

export interface DiscoveredDevice {
  id: string;
  hostname: string;
  ipAddress: string;
  macAddress: string;
  vendor: string;
  model: string;
  firmware: string;
  status: 'online' | 'offline';
  deviceType: DeviceType;
}

export interface FirmwareStatus {
  currentVersion: string;
  latestVersion: string;
  releaseDate: string;
  releaseNotes: string;
  status: 'up_to_date' | 'update_available' | 'installing' | 'pending_schedule';
  scheduledTime?: string;
}

export interface MaintenanceConfig {
  enabled: boolean;
  notes?: string;
  startTime?: string;
  endTime?: string;
  suppressAlerts: boolean;
  pauseMonitoring: boolean;
}

export interface BackupVersion {
  version: number;
  timestamp: string;
  createdBy: string;
  description: string;
  configSnapshot: string; // stringified config JSON
}

