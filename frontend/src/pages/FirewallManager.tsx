import React, { useState, useMemo } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Table } from '../components/Table';
import { Modal } from '../components/Modal';
import { Wizard } from '../components/Wizard';
import { DiffViewer } from '../components/DiffViewer';
import { StatusBadge, HealthIndicator } from '../components/EnterpriseWidgets';
import { useNetworkStore } from '../contexts/NetworkStoreContext';
import { useAuth } from '../contexts/AuthContext';
import { NetworkDevice, AuditLog, NetworkAlert } from '../types';
import { 
  Shield, Plus, AlertTriangle, ShieldCheck, Play, ArrowUpRight, 
  Trash2, Settings, Edit3, Activity, Network, Key, ListFilter, FileText, History, RefreshCw 
} from 'lucide-react';

interface SecurityRule {
  id: string;
  name: string;
  srcZone: string;
  destZone: string;
  service: string;
  action: 'permit' | 'deny';
  enabled: boolean;
}

interface NatRule {
  id: string;
  name: string;
  originalPort: number;
  translatedPort: number;
  translatedAddress: string;
  enabled: boolean;
}

interface VpnTunnel {
  id: string;
  name: string;
  remotePeer: string;
  localAddress: string;
  preSharedKey: string;
  status: 'up' | 'down';
  enabled: boolean;
}

export const FirewallManager: React.FC = () => {
  const { user } = useAuth();
  const { 
    devices, 
    runProvisioningTask, 
    alerts, 
    logs, 
    backupDeviceConfig,
    rollbackConfiguration 
  } = useNetworkStore();

  const [activeTab, setActiveTab] = useState<'overview' | 'interfaces' | 'policies' | 'nat' | 'vpn' | 'dhcp' | 'dns' | 'routing' | 'logs' | 'backup' | 'firmware' | 'system'>('overview');

  // Load Firewall device
  const device = useMemo(() => {
    return devices.find(d => d.type === 'firewall') || null;
  }, [devices]);

  const isReadOnly = user?.role === 'Network Engineer';

  // --- POLICIES CRUD STATE ---
  const [isAddPolicyOpen, setIsAddPolicyOpen] = useState(false);
  const [polName, setPolName] = useState('');
  const [polSrcZone, setPolSrcZone] = useState('Trust');
  const [polDestZone, setPolDestZone] = useState('Untrust');
  const [polService, setPolService] = useState('HTTP/HTTPS');
  const [polAction, setPolAction] = useState<'permit' | 'deny'>('permit');

  // --- NAT CRUD STATE ---
  const [isAddNatOpen, setIsAddNatOpen] = useState(false);
  const [natName, setNatName] = useState('');
  const [natOrigPort, setNatOrigPort] = useState(80);
  const [natTransPort, setNatTransPort] = useState(8080);
  const [natTransAddr, setNatTransAddr] = useState('10.10.20.50');

  // --- VPN CRUD STATE ---
  const [isAddVpnOpen, setIsAddVpnOpen] = useState(false);
  const [vpnName, setVpnName] = useState('');
  const [vpnRemotePeer, setVpnRemotePeer] = useState('198.51.100.10');
  const [vpnLocalAddr, setVpnLocalAddr] = useState('203.0.113.2');
  const [vpnPresharedKey, setVpnPresharedKey] = useState('');

  // --- BACKUP STATE ---
  const [backupReason, setBackupReason] = useState('');
  const [isBackingUp, setIsBackingUp] = useState(false);

  // --- FIRMWARE STATE ---
  const [isUpgrading, setIsUpgrading] = useState(false);

  // 1. Policies derived
  const policies = useMemo(() => {
    if (!device) return [];
    const config = device.config as any;
    return config.firewallPolicies || [
      { id: 'pol-1', name: 'Allow-Internal-DNS', srcZone: 'Trust', destZone: 'Untrust', service: 'UDP 53', action: 'permit', enabled: true },
      { id: 'pol-2', name: 'Block-Malicious-IPs', srcZone: 'Untrust', destZone: 'Trust', service: 'Any', action: 'deny', enabled: true },
      { id: 'pol-3', name: 'Corp-Web-Browsing', srcZone: 'Trust', destZone: 'Untrust', service: 'HTTP/HTTPS', action: 'permit', enabled: true }
    ];
  }, [device]);

  // 2. NAT derived
  const natRules = useMemo(() => {
    if (!device) return [];
    const config = device.config as any;
    return config.natRules || [
      { id: 'nat-1', name: 'Web-Server-Forward', originalPort: 80, translatedPort: 8080, translatedAddress: '10.10.20.50', enabled: true }
    ];
  }, [device]);

  // 3. VPN Tunnels derived
  const vpnTunnels = useMemo(() => {
    if (!device) return [];
    const config = device.config as any;
    return config.vpnTunnels || [
      { id: 'vpn-1', name: 'HQ-to-Branch-IPSec', remotePeer: '198.51.100.10', localAddress: '203.0.113.2', preSharedKey: 'superkey123', status: 'up', enabled: true }
    ];
  }, [device]);

  if (!device) {
    return (
      <div className="p-8 text-center text-slate-400 font-medium">
        No active Firewall device claimed in inventory. Onboard a firewall first.
      </div>
    );
  }

  // Desired state commit helper
  const commitFirewallConfig = async (taskName: string, updatedConfigFields: any) => {
    const updatedConfig = { ...device.config, ...updatedConfigFields };
    return runProvisioningTask(
      taskName,
      [device.name],
      async () => {
        // Save back to local devices state
        const savedDevices = JSON.parse(localStorage.getItem('cn-devices') || '[]');
        const index = savedDevices.findIndex((d: any) => d.id === device.id);
        if (index !== -1) {
          savedDevices[index].config = updatedConfig;
          localStorage.setItem('cn-devices', JSON.stringify(savedDevices));
          // Dispatch custom event to notify store of manual updates
          window.dispatchEvent(new Event('storage'));
        }
        return true;
      },
      device.config
    );
  };

  // Toggles Port state
  const handleToggleInterface = async (portKey: string) => {
    const interfaces = { ...device.config.interfaces };
    interfaces[portKey].enabled = !interfaces[portKey].enabled;
    await commitFirewallConfig(`Toggle Port admin status: ${portKey}`, { interfaces });
  };

  // --- POLICIES CRUD HANDLERS ---
  const handleAddPolicy = async () => {
    const newPol: SecurityRule = {
      id: 'pol-' + Math.random().toString(36).substring(7),
      name: polName,
      srcZone: polSrcZone,
      destZone: polDestZone,
      service: polService,
      action: polAction,
      enabled: true
    };
    await commitFirewallConfig(`Add Firewall Security Policy: ${polName}`, {
      firewallPolicies: [...policies, newPol]
    });
    setPolName('');
    setIsAddPolicyOpen(false);
  };

  const handleDeletePolicy = async (id: string) => {
    if (confirm('De-authorize and remove this firewall security policy?')) {
      const filtered = policies.filter((p: SecurityRule) => p.id !== id);
      await commitFirewallConfig('Delete Firewall Security Policy', { firewallPolicies: filtered });
    }
  };

  const handleTogglePolicy = async (id: string) => {
    const updated = policies.map((p: SecurityRule) => p.id === id ? { ...p, enabled: !p.enabled } : p);
    await commitFirewallConfig('Toggle Firewall Security Policy status', { firewallPolicies: updated });
  };

  // --- NAT CRUD HANDLERS ---
  const handleAddNat = async () => {
    const newNat: NatRule = {
      id: 'nat-' + Math.random().toString(36).substring(7),
      name: natName,
      originalPort: Number(natOrigPort),
      translatedPort: Number(natTransPort),
      translatedAddress: natTransAddr,
      enabled: true
    };
    await commitFirewallConfig(`Create NAT Port Forwarding: ${natName}`, {
      natRules: [...natRules, newNat]
    });
    setNatName('');
    setIsAddNatOpen(false);
  };

  const handleDeleteNat = async (id: string) => {
    if (confirm('Delete this NAT port forwarding binding?')) {
      const filtered = natRules.filter((n: NatRule) => n.id !== id);
      await commitFirewallConfig('Delete NAT Forwarding Rule', { natRules: filtered });
    }
  };

  const handleToggleNat = async (id: string) => {
    const updated = natRules.map((n: NatRule) => n.id === id ? { ...n, enabled: !n.enabled } : n);
    await commitFirewallConfig('Toggle NAT Rule status', { natRules: updated });
  };

  // --- VPN CRUD HANDLERS ---
  const handleAddVpn = async () => {
    const newVpn: VpnTunnel = {
      id: 'vpn-' + Math.random().toString(36).substring(7),
      name: vpnName,
      remotePeer: vpnRemotePeer,
      localAddress: vpnLocalAddr,
      preSharedKey: vpnPresharedKey,
      status: 'up',
      enabled: true
    };
    await commitFirewallConfig(`Establish IPSec VPN Tunnel: ${vpnName}`, {
      vpnTunnels: [...vpnTunnels, newVpn]
    });
    setVpnName('');
    setIsAddVpnOpen(false);
  };

  const handleDeleteVpn = async (id: string) => {
    if (confirm('Teardown and terminate this IPSec VPN tunnel connection?')) {
      const filtered = vpnTunnels.filter((v: VpnTunnel) => v.id !== id);
      await commitFirewallConfig('Teardown IPSec VPN Tunnel', { vpnTunnels: filtered });
    }
  };

  const handleToggleVpn = async (id: string) => {
    const updated = vpnTunnels.map((v: VpnTunnel) => v.id === id ? { ...v, enabled: !v.enabled } : v);
    await commitFirewallConfig('Toggle VPN tunnel status', { vpnTunnels: updated });
  };

  // --- SYSTEM PREVIEW DIFFS WIZARDS ---
  const addPolicySteps = [
    {
      title: 'Define Zones',
      content: (
        <div className="space-y-4 text-left font-sans">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Policy Name</label>
            <input
              type="text"
              placeholder="e.g. Allow-HTTPS-Outbound"
              value={polName}
              onChange={(e) => setPolName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Source Security Zone</label>
              <select
                value={polSrcZone}
                onChange={(e) => setPolSrcZone(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
              >
                <option value="Trust">Trust (Internal LAN)</option>
                <option value="Untrust">Untrust (WAN Internet)</option>
                <option value="IoT-VLAN">IoT-VLAN Isolation</option>
                <option value="Guest-VLAN">Guest-VLAN Isolation</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Destination Security Zone</label>
              <select
                value={polDestZone}
                onChange={(e) => setPolDestZone(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
              >
                <option value="Untrust">Untrust (WAN Internet)</option>
                <option value="Trust">Trust (Internal LAN)</option>
                <option value="DMZ">DMZ Web Server</option>
              </select>
            </div>
          </div>
        </div>
      ),
      validate: () => {
        if (!polName.trim()) return 'Policy name cannot be empty.';
        return true;
      }
    },
    {
      title: 'Action Protocol',
      content: (
        <div className="space-y-4 text-left">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Service Protocol</label>
            <input
              type="text"
              placeholder="e.g. TCP 443 (HTTPS) or Any"
              value={polService}
              onChange={(e) => setPolService(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Action Zone</label>
            <div className="flex gap-4 pt-1">
              {['permit', 'deny'].map(act => (
                <label key={act} className="flex items-center gap-2 cursor-pointer text-sm font-semibold capitalize text-slate-700 dark:text-slate-200">
                  <input
                    type="radio"
                    name="policyAction"
                    value={act}
                    checked={polAction === act}
                    onChange={() => setPolAction(act as any)}
                    className="text-brand-500"
                  />
                  {act}
                </label>
              ))}
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'Preview Diff',
      content: (
        <div className="space-y-4 text-left">
          <p className="text-xs text-slate-500">Preview policy configuration diff before committing to SRX active rules list:</p>
          <DiffViewer
            prev={policies}
            current={[
              ...policies,
              { id: 'temp-pol-id', name: polName, srcZone: polSrcZone, destZone: polDestZone, service: polService, action: polAction, enabled: true }
            ]}
          />
        </div>
      )
    }
  ];

  // DHCP derived leases specifically mapping to firewall IPs
  const firewallDhcpLeases = useMemo(() => {
    const allLeases = JSON.parse(localStorage.getItem('cn-dhcp-leases') || '[]');
    return allLeases;
  }, []);

  // System Logs
  const syslogAlerts = useMemo(() => {
    return alerts.filter(a => a.deviceId === device.id || a.category === 'security');
  }, [alerts, device]);

  // Backups History Snapshot
  const backupsList = useMemo(() => {
    const list = logs.filter(l => l.target.includes(device.name) && l.action.includes('Snapshot'));
    return list;
  }, [logs, device]);

  const handleBackup = async () => {
    if (!backupReason) return;
    setIsBackingUp(true);
    try {
      await backupDeviceConfig(device.id, backupReason);
      setBackupReason('');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRollback = async (backupId: string) => {
    if (confirm('Rollback firewall configuration to this snapshot?')) {
      await rollbackConfiguration(backupId);
    }
  };

  const handleUpgradeFirmware = async () => {
    setIsUpgrading(true);
    await runProvisioningTask(
      `Upgrade baseline firmware: ${device.name}`,
      [device.name],
      async () => {
        // Mock update version
        const savedDevices = JSON.parse(localStorage.getItem('cn-devices') || '[]');
        const index = savedDevices.findIndex((d: any) => d.id === device.id);
        if (index !== -1) {
          savedDevices[index].version = 'JunOS 23.1R2 (Upgraded)';
          localStorage.setItem('cn-devices', JSON.stringify(savedDevices));
          window.dispatchEvent(new Event('storage'));
        }
        return true;
      }
    );
    setIsUpgrading(false);
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center space-x-3 text-left">
          <div className="h-10 w-10 bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-400 rounded-xl flex items-center justify-center">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white m-0">
              Firewall Configuration Console
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Configure unified security zone definitions, NAT bindings, and site-to-site VPN tunnels on {device.name}.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs navigation panel */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-px overflow-x-auto text-xs shrink-0 select-none">
        {[
          { id: 'overview', label: 'Overview', icon: <Activity className="h-4 w-4" /> },
          { id: 'interfaces', label: 'Interfaces', icon: <Network className="h-4 w-4" /> },
          { id: 'policies', label: 'Security Policies', icon: <Shield className="h-4 w-4" /> },
          { id: 'nat', label: 'NAT Forwarding', icon: <Plus className="h-4 w-4" /> },
          { id: 'vpn', label: 'IPSec VPN', icon: <Key className="h-4 w-4" /> },
          { id: 'dhcp', label: 'DHCP Status', icon: <ListFilter className="h-4 w-4" /> },
          { id: 'dns', label: 'DNS Settings', icon: <Settings className="h-4 w-4" /> },
          { id: 'routing', label: 'Static Routes', icon: <Settings className="h-4 w-4" /> },
          { id: 'logs', label: 'Syslog Alarms', icon: <FileText className="h-4 w-4" /> },
          { id: 'backup', label: 'Restore Snapshots', icon: <History className="h-4 w-4" /> },
          { id: 'firmware', label: 'Firmware Upgrades', icon: <RefreshCw className="h-4 w-4" /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 border-b-2 font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              activeTab === tab.id 
                ? 'border-brand-500 text-brand-500 font-bold' 
                : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Screen Content */}
      <div className="space-y-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card title="Threat Protection status" description="Unified Intrusion Engine stats">
              <div className="flex items-center space-x-3.5 mt-3 text-left">
                <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">IPS Shield Enabled</p>
                  <p className="text-xs text-slate-400 mt-0.5">Signature DB version: 2026.07.07 (Latest)</p>
                </div>
              </div>
            </Card>

            <Card title="Active Network Sessions" description="Total tracked connection flows">
              <div className="mt-3 text-left">
                <h3 className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white">1,482</h3>
                <p className="text-xs text-slate-500 mt-1 flex items-center">
                  <ArrowUpRight className="h-4 w-4 text-emerald-500 mr-1" />
                  Peak traffic load today: 2,890 flows
                </p>
              </div>
            </Card>

            <Card title="Hardware Device Status" description="Management node status link">
              <div className="mt-3 flex items-center justify-between text-xs font-medium text-left">
                <div>
                  <p className="text-slate-400">Node model</p>
                  <p className="text-slate-700 dark:text-slate-300 mt-0.5">{device.model}</p>
                </div>
                <div>
                  <p className="text-slate-400">Uptime</p>
                  <p className="text-slate-700 dark:text-slate-300 mt-0.5">{device.uptime}</p>
                </div>
                <div>
                  <p className="text-slate-400">Health Index</p>
                  <p className="text-emerald-500 font-semibold mt-0.5">{device.healthScore}%</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'interfaces' && (
          <Card title="Physical Port Interfaces Configuration" description="Toggle interface links up or down to configure routing paths.">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200/50 dark:divide-slate-800/50 text-left text-xs font-mono">
                <thead className="bg-slate-50/50 dark:bg-slate-900/50">
                  <tr>
                    <th className="px-6 py-3 text-slate-400 uppercase tracking-wider">Port Name</th>
                    <th className="px-6 py-3 text-slate-400 uppercase tracking-wider">Operational Status</th>
                    <th className="px-6 py-3 text-slate-400 uppercase tracking-wider">Speed</th>
                    <th className="px-6 py-3 text-slate-400 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/40 dark:divide-slate-800/40 bg-transparent text-slate-700 dark:text-slate-300">
                  {Object.entries(device.config.interfaces || {}).map(([key, port]) => (
                    <tr key={key}>
                      <td className="px-6 py-4 font-bold">{key}</td>
                      <td className="px-6 py-4">
                        <StatusBadge status={port.enabled ? 'online' : 'offline'} />
                      </td>
                      <td className="px-6 py-4">{port.speed}</td>
                      <td className="px-6 py-4">
                        <Button
                          variant="outline"
                          onClick={() => handleToggleInterface(key)}
                          className="text-[10px] py-1 px-2.5"
                        >
                          {port.enabled ? 'Disable Interface' : 'Enable Interface'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeTab === 'policies' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="text-left">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Global Security Policies</h4>
                <p className="text-xs text-slate-400">Ordered access rules matching zones, services, and permits.</p>
              </div>
              {!isReadOnly && (
                <Button variant="primary" onClick={() => setIsAddPolicyOpen(true)}>
                  <Plus className="h-4 w-4 mr-1.5" /> Add Security Rule
                </Button>
              )}
            </div>

            <Card className="p-0 overflow-hidden">
              <Table
                columns={[
                  { header: 'Policy Name', accessor: 'name', sortable: true },
                  { header: 'Source Zone', accessor: 'srcZone' },
                  { header: 'Dest Zone', accessor: 'destZone' },
                  { header: 'Service', accessor: 'service' },
                  {
                    header: 'Action',
                    accessor: (row: SecurityRule) => (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        row.action === 'permit' 
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' 
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400'
                      }`}>
                        {row.action}
                      </span>
                    )
                  },
                  {
                    header: 'Status',
                    accessor: (row: SecurityRule) => (
                      <button
                        onClick={() => handleTogglePolicy(row.id)}
                        className={`text-[10px] font-bold px-2 py-1 border rounded-lg ${
                          row.enabled 
                            ? 'bg-brand-500/10 border-brand-500/20 text-brand-500' 
                            : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'
                        }`}
                      >
                        {row.enabled ? 'ENABLED' : 'DISABLED'}
                      </button>
                    )
                  },
                  {
                    header: 'Actions',
                    accessor: (row: SecurityRule) => (
                      <Button
                        variant="ghost"
                        onClick={() => handleDeletePolicy(row.id)}
                        className="text-rose-500 hover:text-rose-700 p-1 h-8 w-8 flex items-center justify-center"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ),
                    className: 'text-right'
                  }
                ]}
                data={policies}
              />
            </Card>
          </div>
        )}

        {activeTab === 'nat' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="text-left">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Destination NAT (Port Forwarding)</h4>
                <p className="text-xs text-slate-400">Map inbound WAN traffic rules to internal host services.</p>
              </div>
              {!isReadOnly && (
                <Button variant="primary" onClick={() => setIsAddNatOpen(true)}>
                  <Plus className="h-4 w-4 mr-1.5" /> Add NAT Binding
                </Button>
              )}
            </div>

            <Card className="p-0 overflow-hidden">
              <Table
                columns={[
                  { header: 'Rule Name', accessor: 'name', sortable: true },
                  { header: 'Original Port', accessor: 'originalPort' },
                  { header: 'Translated Port', accessor: 'translatedPort' },
                  { header: 'Internal IP Target', accessor: 'translatedAddress', className: 'font-mono' },
                  {
                    header: 'Status',
                    accessor: (row: NatRule) => (
                      <button
                        onClick={() => handleToggleNat(row.id)}
                        className={`text-[10px] font-bold px-2 py-1 border rounded-lg ${
                          row.enabled 
                            ? 'bg-brand-500/10 border-brand-500/20 text-brand-500' 
                            : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'
                        }`}
                      >
                        {row.enabled ? 'ACTIVE' : 'DISABLED'}
                      </button>
                    )
                  },
                  {
                    header: 'Actions',
                    accessor: (row: NatRule) => (
                      <Button
                        variant="ghost"
                        onClick={() => handleDeleteNat(row.id)}
                        className="text-rose-500 hover:text-rose-700 p-1 h-8 w-8 flex items-center justify-center"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ),
                    className: 'text-right'
                  }
                ]}
                data={natRules}
              />
            </Card>
          </div>
        )}

        {activeTab === 'vpn' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="text-left">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Site-to-Site IPSec VPN Tunnels</h4>
                <p className="text-xs text-slate-400">Establish secure cryptographic links to remote campus branches.</p>
              </div>
              {!isReadOnly && (
                <Button variant="primary" onClick={() => setIsAddVpnOpen(true)}>
                  <Plus className="h-4 w-4 mr-1.5" /> Establish Tunnel
                </Button>
              )}
            </div>

            <Card className="p-0 overflow-hidden">
              <Table
                columns={[
                  { header: 'Tunnel Name', accessor: 'name', sortable: true },
                  { header: 'Remote Gateway', accessor: 'remotePeer', className: 'font-mono' },
                  { header: 'Local Gateway', accessor: 'localAddress', className: 'font-mono' },
                  {
                    header: 'Tunnel Link',
                    accessor: (row: VpnTunnel) => <StatusBadge status={row.status === 'up' && row.enabled ? 'online' : 'offline'} />
                  },
                  {
                    header: 'Actions',
                    accessor: (row: VpnTunnel) => (
                      <Button
                        variant="ghost"
                        onClick={() => handleDeleteVpn(row.id)}
                        className="text-rose-500 hover:text-rose-700 p-1 h-8 w-8 flex items-center justify-center"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ),
                    className: 'text-right'
                  }
                ]}
                data={vpnTunnels}
              />
            </Card>
          </div>
        )}

        {activeTab === 'dhcp' && (
          <Card title="Active DHCP Address Lease Allocations" description="Verify client addresses assigned dynamically on the trunk networks.">
            <Table
              columns={[
                { header: 'Client Hostname', accessor: 'clientName', sortable: true },
                { header: 'Assigned IP', accessor: 'ipAddress', className: 'font-mono' },
                { header: 'MAC Address', accessor: 'macAddress', className: 'font-mono' },
                { header: 'VLAN Index', accessor: 'vlanId' },
                { header: 'Lease Expiry', accessor: 'leaseTime' }
              ]}
              data={firewallDhcpLeases}
            />
          </Card>
        )}

        {activeTab === 'dns' && (
          <Card title="Global Domain Name Service (DNS)" description="Configure active fallback lookup domains for clients:">
            <div className="space-y-4 text-left max-w-sm">
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Primary Server</span>
                <input
                  type="text"
                  value={device.config.dnsServers?.[0] || '1.1.1.1'}
                  onChange={async (e) => {
                    const servers = [...(device.config.dnsServers || ['1.1.1.1', '8.8.8.8'])];
                    servers[0] = e.target.value;
                    await commitFirewallConfig('Update Primary DNS Server', { dnsServers: servers });
                  }}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono"
                />
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Secondary Server</span>
                <input
                  type="text"
                  value={device.config.dnsServers?.[1] || '8.8.8.8'}
                  onChange={async (e) => {
                    const servers = [...(device.config.dnsServers || ['1.1.1.1', '8.8.8.8'])];
                    servers[1] = e.target.value;
                    await commitFirewallConfig('Update Secondary DNS Server', { dnsServers: servers });
                  }}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono"
                />
              </div>
            </div>
          </Card>
        )}

        {activeTab === 'routing' && (
          <Card title="Desired Static Routing Entries" description="Configure routes map targeting subnets and gateways.">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200/50 dark:divide-slate-800/50 text-left text-xs font-mono">
                <thead className="bg-slate-50/50 dark:bg-slate-900/50">
                  <tr>
                    <th className="px-6 py-3 text-slate-400 uppercase tracking-wider">Destination IP / Mask</th>
                    <th className="px-6 py-3 text-slate-400 uppercase tracking-wider">Next-Hop Gateway</th>
                    <th className="px-6 py-3 text-slate-400 uppercase tracking-wider">Interface Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/40 dark:divide-slate-800/40 bg-transparent text-slate-700 dark:text-slate-300">
                  {(device.config as any).routingTable?.map((route: any, idx: number) => (
                    <tr key={idx}>
                      <td className="px-6 py-4 font-bold">{route.destination}</td>
                      <td className="px-6 py-4">{route.gateway}</td>
                      <td className="px-6 py-4">{route.interface}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeTab === 'logs' && (
          <Card title="System Firewall Syslog Logs" description="Threat inspection logs and blocked packets notifications stream:">
            <div className="space-y-3 text-left">
              {syslogAlerts.length === 0 ? (
                <p className="text-xs text-slate-400 font-medium text-center py-6">No threat alerts registered in syslog queue.</p>
              ) : (
                syslogAlerts.map(alert => (
                  <div key={alert.id} className="p-3 bg-slate-500/5 border border-slate-200/10 rounded-xl font-mono text-xs flex gap-2">
                    <span className="text-slate-400 shrink-0 select-none">[{new Date(alert.timestamp).toLocaleTimeString()}]</span>
                    <span className={`font-bold shrink-0 ${alert.severity === 'critical' ? 'text-rose-500' : 'text-amber-500'}`}>
                      {alert.severity.toUpperCase()}:
                    </span>
                    <span className="text-slate-700 dark:text-slate-300">{alert.message}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {activeTab === 'backup' && (
          <Card title="Restore Desired configuration Snapshots" description="Lists backups historical snapshots. Compare and restore previous state configurations:">
            <div className="space-y-5 text-left">
              <div className="flex items-center gap-2 max-w-md">
                <input
                  type="text"
                  placeholder="Backup description reason..."
                  value={backupReason}
                  onChange={(e) => setBackupReason(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                />
                <Button variant="primary" onClick={handleBackup} isLoading={isBackingUp} className="text-xs">
                  Create Snapshot
                </Button>
              </div>

              {backupsList.length === 0 ? (
                <p className="text-xs text-slate-400 font-medium">No configuration snapshots backups available.</p>
              ) : (
                <div className="space-y-3">
                  {backupsList.map(bak => (
                    <div key={bak.id} className="p-3.5 bg-slate-500/5 border border-slate-200/10 rounded-xl flex items-center justify-between gap-3 text-xs font-mono">
                      <div>
                        <p className="text-[10px] text-slate-400">{new Date(bak.timestamp).toLocaleString()}</p>
                        <p className="font-sans font-medium text-slate-700 dark:text-slate-300">{bak.reason}</p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => handleRollback(bak.id)}
                        className="text-[10px] px-2.5 py-1"
                      >
                        Restore State
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )}

        {activeTab === 'firmware' && (
          <Card title="JunOS Active Firmware baseline" description="Verify device firmware update settings:">
            <div className="space-y-4 text-left max-w-sm">
              <div className="grid grid-cols-2 text-xs font-mono">
                <span className="text-slate-500">Current version:</span>
                <span className="text-slate-800 dark:text-slate-200 text-right font-bold">{device.version}</span>
              </div>
              <div className="pt-2">
                <Button variant="outline" onClick={handleUpgradeFirmware} isLoading={isUpgrading} className="flex items-center gap-1.5">
                  <RefreshCw className="h-4 w-4" /> Trigger Firmware Upgrade
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Policies Add wizard */}
      <Wizard
        isOpen={isAddPolicyOpen}
        onClose={() => setIsAddPolicyOpen(false)}
        title="Create Firewall Security Rule"
        steps={addPolicySteps}
        onFinish={handleAddPolicy}
        finishText="Apply Security Rule"
      />

      {/* NAT Add Modal */}
      <Modal
        isOpen={isAddNatOpen}
        onClose={() => setIsAddNatOpen(false)}
        title="Add NAT Port Forwarding"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsAddNatOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleAddNat}>Create NAT Binding</Button>
          </>
        }
      >
        <div className="space-y-4 text-left font-sans">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Rule Name</label>
            <input
              type="text"
              placeholder="e.g. Inbound-Web"
              value={natName}
              onChange={(e) => setNatName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">External Port</label>
              <input
                type="number"
                value={natOrigPort}
                onChange={(e) => setNatOrigPort(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Internal Port</label>
              <input
                type="number"
                value={natTransPort}
                onChange={(e) => setNatTransPort(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Internal Target Address</label>
              <input
                type="text"
                placeholder="10.10.20.10"
                value={natTransAddr}
                onChange={(e) => setNatTransAddr(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* VPN Add Modal */}
      <Modal
        isOpen={isAddVpnOpen}
        onClose={() => setIsAddVpnOpen(false)}
        title="Add IPSec VPN Tunnel"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsAddVpnOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleAddVpn}>Establish Connection</Button>
          </>
        }
      >
        <div className="space-y-4 text-left font-sans">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tunnel Name</label>
            <input
              type="text"
              placeholder="e.g. Branch-B-IPSec"
              value={vpnName}
              onChange={(e) => setVpnName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Remote Peer Gateway</label>
              <input
                type="text"
                value={vpnRemotePeer}
                onChange={(e) => setVpnRemotePeer(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Local Interface Address</label>
              <input
                type="text"
                value={vpnLocalAddr}
                onChange={(e) => setVpnLocalAddr(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">IPSec Pre-Shared Key (PSK)</label>
            <input
              type="password"
              placeholder="••••••••••••••••"
              value={vpnPresharedKey}
              onChange={(e) => setVpnPresharedKey(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
