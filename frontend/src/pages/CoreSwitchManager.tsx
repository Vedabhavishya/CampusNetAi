import React, { useState, useMemo } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Table } from '../components/Table';
import { Modal } from '../components/Modal';
import { DiffViewer } from '../components/DiffViewer';
import { StatusBadge, HealthIndicator } from '../components/EnterpriseWidgets';
import { useNetworkStore } from '../contexts/NetworkStoreContext';
import { useAuth } from '../contexts/AuthContext';
import { NetworkDevice, Vlan } from '../types';
import { useVlanInventory } from '../utils/vlanUtils';
import { Layers, Activity, GitCommit, Settings, CheckCircle, Plus, Trash2, Edit3, ShieldAlert, Cpu } from 'lucide-react';

interface RouteEntry {
  destination: string;
  gateway: string;
  interface: string;
}

export const CoreSwitchManager: React.FC = () => {
  const { user } = useAuth();
  const { 
    devices, 
    vlans, 
    addVlan, 
    deleteVlan, 
    renameVlan, 
    updateSwitchPortConfig, 
    restartDevice,
    runProvisioningTask 
  } = useNetworkStore();

  const [activeTab, setActiveTab] = useState<'overview' | 'vlans' | 'interfaces' | 'routing' | 'lags' | 'stp' | 'telemetry' | 'mac_lldp'>('overview');
  
  // Load Core Switch device
  const device = useMemo(() => {
    return devices.find(d => d.type === 'core_switch') || null;
  }, [devices]);

  const isReadOnly = user?.role === 'Network Engineer';
  const isLiveDevice = !!device?.telemetry;

  // MAC Table Search & Filters
  const [macSearchQuery, setMacSearchQuery] = useState('');
  const [macVlanFilter, setMacVlanFilter] = useState('');
  const [macInterfaceFilter, setMacInterfaceFilter] = useState('');

  // STP States
  const [stpMode, setStpMode] = useState<'RSTP' | 'MSTP'>('RSTP');
  const [bridgePriority, setBridgePriority] = useState('32768');
  const [isStpSaved, setIsStpSaved] = useState(false);

  // VLAN Action states
  const [isAddVlanOpen, setIsAddVlanOpen] = useState(false);
  const [vlanId, setVlanId] = useState(50);
  const [vlanName, setVlanName] = useState('');
  const [vlanSubnet, setVlanSubnet] = useState('10.10.50.0/24');
  const [vlanRange, setVlanRange] = useState('10.10.50.10 - 10.10.50.250');
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [selectedVlan, setSelectedVlan] = useState<Vlan | null>(null);
  const [vlanRenameText, setVlanRenameText] = useState('');

  // Routing Action states
  const [isAddRouteOpen, setIsAddRouteOpen] = useState(false);
  const [rtDest, setRtDest] = useState('');
  const [rtGw, setRtGw] = useState('');
  const [rtIntf, setRtIntf] = useState('ae0');

  // Reboot state
  const [isRebooting, setIsRebooting] = useState(false);

  // Human-readable format utilities
  const formatThroughput = (bps: number | undefined): string => {
    if (bps === undefined || isNaN(bps)) return '--';
    if (bps >= 1000000000) return (bps / 1000000000).toFixed(2) + ' Gbps';
    if (bps >= 1000000) return (bps / 1000000).toFixed(2) + ' Mbps';
    if (bps >= 1000) return (bps / 1000).toFixed(2) + ' Kbps';
    return bps + ' bps';
  };

  const formatBytes = (bytes: number | undefined): string => {
    if (bytes === undefined || isNaN(bytes)) return '--';
    if (bytes >= 1000000000) return (bytes / 1000000000).toFixed(2) + ' GB';
    if (bytes >= 1000000) return (bytes / 1000000).toFixed(2) + ' MB';
    if (bytes >= 1000) return (bytes / 1000).toFixed(2) + ' KB';
    return bytes + ' B';
  };

  // Authoritative VLAN inventory computed via shared useVlanInventory hook
  const vlanData = useVlanInventory();

  // Dynamically filter vlan columns based on data availability
  const vlanColumns = useMemo(() => {
    const cols: any[] = [
      { header: 'VLAN ID', accessor: 'id', sortable: true },
      { header: 'Profile Name', accessor: 'name', sortable: true },
    ];
    
    const hasMemberCount = vlanData.some(v => v.memberCount !== undefined && v.memberCount !== '--');
    const hasActiveInterfaces = vlanData.some(v => v.activeInterfaces !== undefined && v.activeInterfaces !== 0 && v.activeInterfaces !== '--');
    const hasSubnet = vlanData.some(v => v.subnet && v.subnet !== '--');
    const hasGateway = vlanData.some(v => v.gateway && v.gateway !== '--');
    const hasDhcpRange = vlanData.some(v => v.dhcpRange && v.dhcpRange !== '--');
    const hasDescription = vlanData.some(v => v.description && v.description !== '--');

    if (hasMemberCount) cols.push({ header: 'Members Count', accessor: 'memberCount' });
    if (hasActiveInterfaces) cols.push({ header: 'Active Interfaces', accessor: 'activeInterfaces' });
    if (hasSubnet) cols.push({ header: 'IP Subnet Address', accessor: 'subnet', className: 'font-mono' });
    if (hasGateway) cols.push({ header: 'Gateway', accessor: 'gateway', className: 'font-mono' });
    if (hasDhcpRange) cols.push({ header: 'DHCP Pool Range', accessor: 'dhcpRange', className: 'font-mono' });
    if (hasDescription) cols.push({ header: 'Description', accessor: 'description' });

    cols.push({
      header: 'Actions',
      accessor: (row: any) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="outline"
            onClick={() => triggerRenameVlan(row)}
            className="p-1 h-8 w-8 flex items-center justify-center disabled:opacity-50"
            disabled={isLiveDevice}
            title={isLiveDevice ? "Configuration not supported on live switch" : undefined}
          >
            <Edit3 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => handleDeleteVlan(row.id)}
            className="p-1 h-8 w-8 flex items-center justify-center text-rose-500 hover:text-rose-700 disabled:opacity-50"
            disabled={isLiveDevice}
            title={isLiveDevice ? "Configuration not supported on live switch" : undefined}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
      className: 'text-right'
    } as any);

    return cols;
  }, [vlanData, isLiveDevice]);

  // Dynamic ports configuration computed from config.interfaces to show ONLY configurable physical switch interfaces
  const portsList = useMemo(() => {
    if (!device) return [];
    const configInterfaces = device.config?.interfaces || {};
    
    // Sort keys naturally (e.g. ge-0/0/2 before ge-0/0/10)
    const sortedKeys = Object.keys(configInterfaces).sort((a, b) => {
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

    return sortedKeys.map((name) => {
      const config = (configInterfaces[name] || {}) as any;
      
      const description = config.description || '--';

      // Find status and linkState from telemetry if available
      let linkState = config.link || 'down';
      let adminState = config.enabled ? 'up' : 'down';
      let speed = config.speed || '--';
      let vlan = config.vlan !== undefined ? String(config.vlan) : '--';
      
      if (device.telemetry && Array.isArray(device.telemetry.interfaces)) {
        const telIface = device.telemetry.interfaces.find((i: any) => i.interface === name);
        if (telIface) {
          linkState = telIface.link || linkState;
          adminState = telIface.admin || adminState;
        }
      }

      if (speed && typeof speed === 'string') {
        const cleanSpeed = speed.toLowerCase().trim();
        if (cleanSpeed === '1000mbps' || cleanSpeed === '1gbps') speed = '1 Gbps';
        if (cleanSpeed === '10000mbps' || cleanSpeed === '10gbps') speed = '10 Gbps';
      }

      return {
        name,
        adminState,
        linkState,
        speed,
        vlan,
        description
      };
    });
  }, [device]);

  // Derived core switch routes
  const routesList = useMemo(() => {
    if (!device) return [];
    if (device.telemetry && Array.isArray(device.telemetry.routes)) {
      return device.telemetry.routes.map((r: any, idx: number) => ({
        id: `rt-${idx}`,
        destination: r.destination,
        gateway: r.gateway,
        interface: r.interface
      }));
    }
    // Fallback to config routing table if not live telemetry
    if (device.config && Array.isArray(device.config.routingTable)) {
      return device.config.routingTable.map((r: any, idx: number) => ({
        id: `rt-conf-${idx}`,
        destination: r.destination,
        gateway: r.gateway,
        interface: r.interface
      }));
    }
    return [];
  }, [device]);

  // Filtered MAC Table
  const filteredMacTable = useMemo(() => {
    if (!device?.telemetry?.mac_table || !Array.isArray(device.telemetry.mac_table)) return [];
    
    return device.telemetry.mac_table.filter((m: any) => {
      const matchesSearch = !macSearchQuery || 
        m.mac_address.toLowerCase().includes(macSearchQuery.toLowerCase()) ||
        m.interface.toLowerCase().includes(macSearchQuery.toLowerCase()) ||
        String(m.vlan).toLowerCase().includes(macSearchQuery.toLowerCase());
        
      const matchesVlan = !macVlanFilter || String(m.vlan) === macVlanFilter;
      const matchesInterface = !macInterfaceFilter || m.interface.toLowerCase().includes(macInterfaceFilter.toLowerCase());
      
      return matchesSearch && matchesVlan && matchesInterface;
    });
  }, [device, macSearchQuery, macVlanFilter, macInterfaceFilter]);

  // CSV Exporter
  const handleExportMacCsv = () => {
    if (!filteredMacTable.length) return;
    const headers = 'MAC Address,VLAN,Interface,Type\n';
    const rows = filteredMacTable.map((m: any) => 
      `"${m.mac_address}","${m.vlan}","${m.interface}","${m.type || 'Dynamic'}"`
    ).join('\n');
    
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${device?.name || 'switch'}_mac_table.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Derived Link Aggregations
  const lags = useMemo(() => {
    if (device && device.telemetry && Array.isArray(device.telemetry.lag)) {
      return device.telemetry.lag.map((l: any, idx: number) => ({
        id: l.id || `lag-${idx}`,
        name: l.name,
        ports: l.ports || [],
        status: l.status,
        speed: l.speed,
        mode: l.mode,
        vlan: l.vlan
      }));
    }
    return [];
  }, [device]);

  if (!device) {
    return (
      <div className="p-8 text-center text-slate-400 font-medium">
        No Core Switch node claimed in inventory. Onboard a switch first.
      </div>
    );
  }

  // Desired state commit helper
  const commitCoreSwitchConfig = async (taskName: string, updatedConfigFields: any) => {
    const updatedConfig = { ...device.config, ...updatedConfigFields };
    return runProvisioningTask(
      taskName,
      [device.name],
      async () => {
        const savedDevices = JSON.parse(localStorage.getItem('cn-devices') || '[]');
        const index = savedDevices.findIndex((d: any) => d.id === device.id);
        if (index !== -1) {
          savedDevices[index].config = updatedConfig;
          localStorage.setItem('cn-devices', JSON.stringify(savedDevices));
          window.dispatchEvent(new Event('storage'));
        }
        return true;
      },
      device.config
    );
  };

  // --- ACTIONS HANDLERS ---
  const handleRestart = async () => {
    setIsRebooting(true);
    try {
      await restartDevice(device.id);
    } finally {
      setIsRebooting(false);
    }
  };

  const handleSaveStp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsStpSaved(true);
    await commitCoreSwitchConfig('Update Spanning Tree Protocol (STP)', { stpMode, bridgePriority });
    setTimeout(() => setIsStpSaved(false), 2000);
  };

  // Port Toggle / VLAN Change
  const handleToggleInterface = async (portKey: string) => {
    const interfaces = { ...device.config.interfaces };
    interfaces[portKey].enabled = !interfaces[portKey].enabled;
    await commitCoreSwitchConfig(`Toggle switch port admin status: ${portKey}`, { interfaces });
  };

  const handlePortVlanChange = async (portKey: string, vlanVal: number) => {
    const interfaces = { ...device.config.interfaces };
    interfaces[portKey].vlan = vlanVal;
    await commitCoreSwitchConfig(`Assign VLAN ${vlanVal} to interface ${portKey}`, { interfaces });
  };

  // VLAN CRUD
  const handleAddVlan = async () => {
    try {
      await addVlan({
        id: Number(vlanId),
        name: vlanName,
        subnet: vlanSubnet,
        dhcpRange: vlanRange,
        dnsServers: ['1.1.1.1', '8.8.8.8']
      });
      setIsAddVlanOpen(false);
      setVlanName('');
    } catch (e: any) {
      alert(e.message || 'Failed to create VLAN profile.');
    }
  };

  const handleDeleteVlan = async (id: number) => {
    try {
      await deleteVlan(id);
    } catch (e: any) {
      alert(e.message || 'VLAN deletion rejected.');
    }
  };

  const triggerRenameVlan = (vlan: Vlan) => {
    setSelectedVlan(vlan);
    setVlanRenameText(vlan.name);
    setIsRenameOpen(true);
  };

  const handleRenameVlanSubmit = async () => {
    if (selectedVlan && vlanRenameText.trim()) {
      await renameVlan(selectedVlan.id, vlanRenameText);
      setIsRenameOpen(false);
      setSelectedVlan(null);
    }
  };

  // Routing CRUD
  const handleAddRoute = async () => {
    const newRoute: RouteEntry = {
      destination: rtDest,
      gateway: rtGw,
      interface: rtIntf
    };
    await commitCoreSwitchConfig(`Add Layer 3 Static Route: ${rtDest}`, {
      routingTable: [...routesList, newRoute]
    });
    setRtDest('');
    setRtGw('');
    setIsAddRouteOpen(false);
  };

  const handleDeleteRoute = async (dest: string) => {
    if (confirm(`Remove static routing policy targeting ${dest}?`)) {
      const filtered = routesList.filter((r: any) => r.destination !== dest);
      await commitCoreSwitchConfig('Delete Static Route Entry', { routingTable: filtered });
    }
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-left">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-400 rounded-xl flex items-center justify-center">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white m-0">
              Core Switch Manager (L3)
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Configure virtual stacks chassis, Layer 3 inter-VLAN routing interfaces, static routing tables, and STP bridge priorities.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs navigation panel */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-px overflow-x-auto text-xs shrink-0 select-none">
        {[
          { id: 'overview', label: 'Overview & Diagnostics', icon: <Activity className="h-4 w-4" /> },
          { id: 'vlans', label: 'Trunk VLAN Profiles', icon: <Layers className="h-4 w-4" /> },
          { id: 'interfaces', label: 'Ports Configuration', icon: <Settings className="h-4 w-4" /> },
          { id: 'telemetry', label: 'Collector & Live Telemetry', icon: <Layers className="h-4 w-4" /> },
          { id: 'mac_lldp', label: 'MAC & LLDP Neighbors', icon: <Layers className="h-4 w-4" /> },
          { id: 'routing', label: 'Static Routes (L3)', icon: <GitCommit className="h-4 w-4" /> },
          { id: 'lags', label: 'Port aggregation (LAG)', icon: <Settings className="h-4 w-4" /> },
          { id: 'stp', label: 'Spanning Tree (STP)', icon: <Settings className="h-4 w-4" /> }
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
          <div className="space-y-6">
            {(!device.collector || !device.telemetry) && (
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl p-3.5 text-xs text-left font-medium">
                Live telemetry unavailable. Using cached settings.
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Switch Summary & Diagnostics Card */}
              <Card title="Switch Summary & System Diagnostics" className="md:col-span-2" description="Comprehensive inventory and operational status details">
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-left text-xs font-sans text-slate-750 dark:text-slate-350">
                  <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                    <span className="text-slate-400">Switch Status:</span>
                    <span className={`font-bold ${device.status === 'online' ? 'text-emerald-500' : 'text-slate-400'}`}>
                      {device.status ? device.status.toUpperCase() : 'Unavailable'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                    <span className="text-slate-400">Hostname:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{device.name || 'Unavailable'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                    <span className="text-slate-400">Model:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{device.model || 'Unavailable'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                    <span className="text-slate-400">Management IP:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{device.ipAddress || 'Unavailable'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                    <span className="text-slate-400">Software Version:</span>
                    <span className="font-mono text-slate-900 dark:text-white">{device.version || 'Unavailable'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                    <span className="text-slate-400">Collector Name:</span>
                    <span className="font-mono text-slate-900 dark:text-white">{device.collector?.name || 'Unavailable'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                    <span className="text-slate-400">Collector Status:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{device.collector?.status || (device.status === 'online' ? 'Active' : 'Inactive')}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                    <span className="text-slate-400">Health Score:</span>
                    <span className="font-bold text-emerald-500">{device.healthScore !== undefined ? `${device.healthScore}%` : 'Unavailable'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                    <span className="text-slate-400">CPU Usage:</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">{device.cpuUsage !== undefined ? `${device.cpuUsage}%` : 'Unavailable'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                    <span className="text-slate-400">Memory Usage:</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">{device.memoryUsage !== undefined ? `${device.memoryUsage}%` : 'Unavailable'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                    <span className="text-slate-400">Uptime:</span>
                    <span className="text-slate-900 dark:text-white">{device.uptime || 'Unavailable'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                    <span className="text-slate-400">Last Poll Timestamp:</span>
                    <span className="text-slate-900 dark:text-white">
                      {device.collector?.last_poll ? new Date(device.collector.last_poll).toLocaleTimeString() : 'Unavailable'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                    <span className="text-slate-400">SSH Latency:</span>
                    <span className="font-mono text-slate-900 dark:text-white">
                      {device.telemetry?.performance?.current?.ssh_latency_ms !== undefined
                        ? `${device.telemetry.performance.current.ssh_latency_ms} ms`
                        : 'Unavailable'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                    <span className="text-slate-400">Physical Ports (Total / Active):</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {(() => {
                        const total = device.config?.interfaces ? Object.keys(device.config.interfaces).length : 0;
                        const active = device.config?.interfaces 
                          ? Object.values(device.config.interfaces).filter((i: any) => i.link === 'up').length 
                          : 0;
                        return total > 0 ? `${total} / ${active}` : 'Unavailable';
                      })()}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Virtual Chassis Card */}
              <Card title="Virtual Chassis Configuration" description="Multi-member active switch stack">
                <div className="mt-3 text-left text-xs font-sans text-slate-700 dark:text-slate-300">
                  {device.telemetry?.virtual_chassis ? (
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center text-sm font-bold font-mono shrink-0">
                        {device.telemetry.virtual_chassis.members_count || 1}x
                      </div>
                      <div className="space-y-0.5">
                        <p className="font-semibold">Stack Status: {device.telemetry.virtual_chassis.status || 'ACTIVE'}</p>
                        <p className="text-[10px] text-slate-400">
                          Master: {device.telemetry.virtual_chassis.master || '--'} | Backup: {device.telemetry.virtual_chassis.backup || '--'}
                        </p>
                        <p className="text-[9px] text-slate-500">Mode: {device.telemetry.virtual_chassis.mode || '--'}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-400 font-medium py-3 text-center">
                      No Virtual Chassis information available.
                    </p>
                  )}
                </div>
              </Card>

              {/* Aggregate Link Traffic Card */}
              <Card title="Aggregate Link Traffic" description="Throughput distribution across interfaces">
                <div className="mt-2 text-left text-xs font-sans space-y-1 text-slate-700 dark:text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Current Throughput:</span>
                    <span className="font-mono font-bold">
                      {device.telemetry?.port_statistics?.aggregate?.switch_throughput_bps !== undefined
                        ? formatThroughput(device.telemetry.port_statistics.aggregate.switch_throughput_bps)
                        : '--'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Average Utilization:</span>
                    <span className="font-mono font-semibold">
                      {device.telemetry?.port_statistics?.aggregate?.average_utilization !== undefined
                        ? `${device.telemetry.port_statistics.aggregate.average_utilization.toFixed(2)}%`
                        : '--'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total RX:</span>
                    <span className="font-mono">
                      {device.telemetry?.port_statistics?.aggregate?.total_rx !== undefined
                        ? formatBytes(device.telemetry.port_statistics.aggregate.total_rx)
                        : '--'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total TX:</span>
                    <span className="font-mono">
                      {device.telemetry?.port_statistics?.aggregate?.total_tx !== undefined
                        ? formatBytes(device.telemetry.port_statistics.aggregate.total_tx)
                        : '--'}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Spanning Tree Card */}
              <Card title="STP Root Bridge status" description="Spanning Tree diagnostics">
                <div className="mt-3 text-left text-xs font-sans text-slate-700 dark:text-slate-300">
                  {device.telemetry?.stp ? (
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Protocol:</span>
                        <span className="font-mono font-semibold">{device.telemetry.stp.protocol || 'RSTP'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Bridge ID:</span>
                        <span className="font-mono font-semibold">{device.telemetry.stp.bridge_id || '--'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Priority:</span>
                        <span className="font-mono font-semibold">{device.telemetry.stp.priority || '32768'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Role:</span>
                        <span className="font-semibold text-emerald-500">{device.telemetry.stp.role || 'Designated'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Root Status:</span>
                        <span className={device.telemetry.stp.is_root ? 'text-emerald-500 font-semibold' : 'text-slate-400 font-semibold'}>
                          {device.telemetry.stp.is_root ? 'This switch is the ROOT' : 'Not Root'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-400 font-medium py-3 text-center">
                      No Spanning Tree telemetry available.
                    </p>
                  )}
                </div>
              </Card>
            </div>

            {/* Diagnostics Stats */}
            <Card title="Chassis Diagnostics Panel" description="Management system overrides">
              <div className="flex gap-4 text-left">
                <div className="flex items-center gap-3">
                  <Button variant="outline" onClick={handleRestart} isLoading={isRebooting}>
                    Reboot Switch Stack
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'vlans' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="text-left">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Trunk VLAN Profiles</h4>
                <p className="text-xs text-slate-400">Define global broadcast domains mapped to routing interfaces.</p>
              </div>
              {!isReadOnly && (
                <Button 
                  variant="primary" 
                  onClick={() => setIsAddVlanOpen(true)}
                  disabled={isLiveDevice}
                  title={isLiveDevice ? "Configuration not supported on live switch" : undefined}
                >
                  <Plus className="h-4 w-4 mr-1.5" /> {isLiveDevice ? 'Not Supported' : 'Create VLAN'}
                </Button>
              )}
            </div>

            <Card className="p-0 overflow-hidden">
              <Table
                columns={vlanColumns}
                data={vlanData}
              />
            </Card>
          </div>
        )}

        {activeTab === 'interfaces' && (
          <Card title="Interface Port Configurations" description="Assign desired VLAN profiles and enable/disable physical interfaces.">
            <div className="overflow-x-auto text-left">
              <table className="min-w-full divide-y divide-slate-200/50 dark:divide-slate-800/50 text-xs font-mono">
                <thead className="bg-slate-50/50 dark:bg-slate-900/50">
                  <tr>
                    <th className="px-6 py-3 text-slate-400 uppercase tracking-wider text-left">Interface</th>
                    <th className="px-6 py-3 text-slate-400 uppercase tracking-wider text-left">Status</th>
                    <th className="px-6 py-3 text-slate-400 uppercase tracking-wider text-left">Administrative State</th>
                    <th className="px-6 py-3 text-slate-400 uppercase tracking-wider text-left">Operational State</th>
                    <th className="px-6 py-3 text-slate-400 uppercase tracking-wider text-left">Speed</th>
                    <th className="px-6 py-3 text-slate-400 uppercase tracking-wider text-left">Assigned VLAN</th>
                    <th className="px-6 py-3 text-slate-400 uppercase tracking-wider text-left">Description</th>
                    <th className="px-6 py-3 text-slate-400 uppercase tracking-wider text-left">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/40 dark:divide-slate-800/40 bg-transparent text-slate-700 dark:text-slate-300">
                  {portsList.map((port: any) => (
                    <tr key={port.name}>
                      <td className="px-6 py-4 font-bold text-left">{port.name}</td>
                      <td className="px-6 py-4 text-left">
                        <span className={`inline-flex h-2.5 w-2.5 rounded-full ${port.linkState === 'up' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      </td>
                      <td className="px-6 py-4 capitalize text-left">{port.adminState}</td>
                      <td className="px-6 py-4 capitalize text-left">{port.linkState}</td>
                      <td className="px-6 py-4 text-left">{port.speed}</td>
                      <td className="px-6 py-4 text-left font-sans">
                        {!isReadOnly ? (
                          <select
                            value={port.vlan.includes(' ') ? port.vlan.split(' ')[0] : port.vlan}
                            onChange={(e) => handlePortVlanChange(port.name, Number(e.target.value))}
                            className="px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg disabled:opacity-50"
                            disabled={isLiveDevice}
                            title={isLiveDevice ? "Configuration not supported on live switch" : undefined}
                          >
                            <option value="">--</option>
                            {vlans.map(v => (
                              <option key={v.id} value={v.id}>{v.id} ({v.name})</option>
                            ))}
                          </select>
                        ) : (
                          port.vlan
                        )}
                      </td>
                      <td className="px-6 py-4 text-left font-sans">{port.description}</td>
                      <td className="px-6 py-4 text-left">
                        <Button
                          variant="outline"
                          onClick={() => handleToggleInterface(port.name)}
                          className="text-[10px] py-1 px-2.5 disabled:opacity-50"
                          disabled={isLiveDevice}
                          title={isLiveDevice ? "Configuration not supported on live switch" : undefined}
                        >
                          {isLiveDevice ? 'Read Only' : (port.adminState === 'up' ? 'Disable' : 'Enable')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeTab === 'telemetry' && (
          <div className="space-y-6 text-left text-xs font-semibold">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Health & Collector Metadata */}
              <Card title="Collector stack & Health Metadata" className="space-y-3">
                {device.collector ? (
                  <>
                    <div className="grid grid-cols-2 py-1 border-b border-slate-200/10">
                      <span className="text-slate-400">Collector Name</span>
                      <span className="text-slate-800 dark:text-slate-200 text-right">{device.collector.name || 'Unavailable'}</span>
                    </div>
                    <div className="grid grid-cols-2 py-1 border-b border-slate-200/10">
                      <span className="text-slate-400">Collector Version</span>
                      <span className="text-slate-800 dark:text-slate-200 text-right">{device.collector.version || 'Unavailable'}</span>
                    </div>
                    <div className="grid grid-cols-2 py-1 border-b border-slate-200/10">
                      <span className="text-slate-400">Device Family</span>
                      <span className="text-slate-800 dark:text-slate-200 text-right">{device.collector.device_family || 'Unavailable'}</span>
                    </div>
                    <div className="grid grid-cols-2 py-1 border-b border-slate-200/10">
                      <span className="text-slate-400">Last Successful Poll</span>
                      <span className="text-slate-800 dark:text-slate-200 text-right">
                        {device.collector.last_poll ? new Date(device.collector.last_poll).toLocaleString() : 'Unavailable'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 py-1 border-b border-slate-200/10">
                      <span className="text-slate-400">Poll Duration</span>
                      <span className="text-slate-800 dark:text-slate-200 text-right">
                        {device.collector.poll_duration_ms !== undefined ? `${device.collector.poll_duration_ms} ms` : 'Unavailable'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 py-1 border-b border-slate-200/10">
                      <span className="text-slate-400">SSH Latency</span>
                      <span className="text-slate-800 dark:text-slate-200 text-right">
                        {device.telemetry?.performance?.current?.ssh_latency_ms !== undefined 
                          ? `${device.telemetry.performance.current.ssh_latency_ms} ms` 
                          : (device.health?.ssh_latency_ms !== undefined ? `${device.health.ssh_latency_ms} ms` : 'Unavailable')}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 py-1 border-b border-slate-200/10">
                      <span className="text-slate-400">Commands Executed</span>
                      <span className="text-slate-800 dark:text-slate-200 text-right">
                        {device.collector.commands_executed !== undefined ? device.collector.commands_executed : 'Unavailable'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 py-1 border-b border-slate-200/10">
                      <span className="text-slate-400">Commands Failed</span>
                      <span className="text-slate-800 dark:text-slate-200 text-right text-rose-500">
                        {device.collector.commands_failed !== undefined ? device.collector.commands_failed : 'Unavailable'}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-slate-400">No collector metadata available.</div>
                )}
                {device.health && (
                  <>
                    <div className="grid grid-cols-2 py-1 border-b border-slate-200/10 pt-2 font-bold text-slate-700 dark:text-slate-300">
                      <span>Connection Status</span>
                      <span className={device.health.connected ? 'text-emerald-500 text-right' : 'text-rose-500 text-right'}>
                        {device.health.status.toUpperCase()}
                      </span>
                    </div>
                  </>
                )}
              </Card>

              {/* Inventory Metadata */}
              <Card title="Live stack Inventory details" className="space-y-3">
                {device.inventory ? (
                  <>
                    <div className="grid grid-cols-2 py-1 border-b border-slate-200/10">
                      <span className="text-slate-400">Hostname</span>
                      <span className="text-slate-800 dark:text-slate-200 text-right">{device.inventory.hostname}</span>
                    </div>
                    <div className="grid grid-cols-2 py-1 border-b border-slate-200/10">
                      <span className="text-slate-400">Vendor / Family</span>
                      <span className="text-slate-800 dark:text-slate-200 text-right">{device.inventory.vendor} {device.inventory.family}</span>
                    </div>
                    <div className="grid grid-cols-2 py-1 border-b border-slate-200/10">
                      <span className="text-slate-400">Model</span>
                      <span className="text-slate-800 dark:text-slate-200 text-right">{device.inventory.model}</span>
                    </div>
                    <div className="grid grid-cols-2 py-1 border-b border-slate-200/10">
                      <span className="text-slate-400">Serial Number</span>
                      <span className="text-slate-800 dark:text-slate-200 text-right font-mono">{device.inventory.serial}</span>
                    </div>
                    <div className="grid grid-cols-2 py-1 border-b border-slate-200/10">
                      <span className="text-slate-400">Software Version</span>
                      <span className="text-slate-800 dark:text-slate-200 text-right font-mono">{device.inventory.software_version}</span>
                    </div>
                    <div className="grid grid-cols-2 py-1 border-b border-slate-200/10">
                      <span className="text-slate-400">Hardware Revision</span>
                      <span className="text-slate-800 dark:text-slate-200 text-right">{device.inventory.hardware_revision}</span>
                    </div>
                    <div className="grid grid-cols-2 py-1">
                      <span className="text-slate-400">System Uptime</span>
                      <span className="text-slate-800 dark:text-slate-200 text-right">{device.inventory.uptime}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-slate-400">No inventory details available.</div>
                )}
              </Card>
            </div>

            {/* Raw Outputs */}
            {device.raw && Object.keys(device.raw).length > 0 && (
              <Card title="Raw CLI commands Outcomes" description="Expand to view exact outputs returned from the live device:">
                <div className="space-y-2 mt-2 font-mono text-[11px]">
                  {Object.entries(device.raw).map(([cmd, res]: [string, any]) => (
                    <details key={cmd} className="bg-slate-500/5 rounded-lg border border-slate-200/10 overflow-hidden font-mono">
                      <summary className="px-4 py-2 font-bold cursor-pointer hover:bg-slate-500/10 flex justify-between select-none">
                        <span>{cmd}</span>
                        <span className={res.success ? 'text-emerald-500' : 'text-rose-500'}>
                          {res.success ? 'SUCCESS' : 'FAILED'}
                        </span>
                      </summary>
                      <div className="p-3 border-t border-slate-200/10 whitespace-pre overflow-x-auto max-h-48 text-[10px] text-slate-650 bg-slate-900/50">
                        {res.output || res.error || 'Empty Output.'}
                      </div>
                    </details>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'mac_lldp' && (
          <div className="space-y-6 text-left text-xs font-semibold">
            {device.telemetry && device.telemetry.mac_table && device.telemetry.mac_table.length > 0 ? (
              <Card title="Live Switch MAC Address Table" className="p-0 overflow-hidden">
                {/* Search & Filter Bar */}
                <div className="p-4 bg-slate-500/5 border-b border-slate-200/10 flex flex-wrap gap-4 items-center">
                  <div className="flex-1 min-w-[200px]">
                    <input
                      type="text"
                      placeholder="Search MAC, VLAN, or Interface..."
                      value={macSearchQuery}
                      onChange={(e) => setMacSearchQuery(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-200"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Filter by VLAN..."
                      value={macVlanFilter}
                      onChange={(e) => setMacVlanFilter(e.target.value)}
                      className="w-32 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-200"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Filter by Interface..."
                      value={macInterfaceFilter}
                      onChange={(e) => setMacInterfaceFilter(e.target.value)}
                      className="w-36 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-200"
                    />
                  </div>
                  <Button variant="outline" className="text-xs py-1.5 px-3" onClick={handleExportMacCsv}>
                    Export CSV
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200/10 text-left font-sans">
                    <thead className="bg-slate-500/5">
                      <tr>
                        <th className="px-4 py-2 text-slate-400">MAC Address</th>
                        <th className="px-4 py-2 text-slate-400">VLAN</th>
                        <th className="px-4 py-2 text-slate-400">Interface</th>
                        <th className="px-4 py-2 text-slate-400">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/10 font-mono text-[11px]">
                      {filteredMacTable.map((m: any, i: number) => (
                        <tr key={i}>
                          <td className="px-4 py-2 font-bold">{m.mac_address}</td>
                          <td className="px-4 py-2">{m.vlan}</td>
                          <td className="px-4 py-2">{m.interface}</td>
                          <td className="px-4 py-2">{m.type || 'Dynamic'}</td>
                        </tr>
                      ))}
                      {filteredMacTable.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-slate-400 font-medium">
                            No matching MAC addresses found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : (
              <Card title="MAC Address Table" description="No MAC addresses parsed from live device." />
            )}

            {device.telemetry && device.telemetry.lldp_neighbors && device.telemetry.lldp_neighbors.length > 0 ? (
              <Card title="Live LLDP Topology Neighbors" className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200/10 text-left">
                    <thead className="bg-slate-500/5">
                      <tr>
                        <th className="px-4 py-2 text-slate-400">Local Port</th>
                        <th className="px-4 py-2 text-slate-400">Neighbor Hostname</th>
                        <th className="px-4 py-2 text-slate-400">Neighbor Port</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/10 font-mono text-[11px]">
                      {device.telemetry.lldp_neighbors.map((n: any, i: number) => (
                        <tr key={i}>
                          <td className="px-4 py-2 font-bold">{n.local_interface}</td>
                          <td className="px-4 py-2">{n.neighbor_hostname}</td>
                          <td className="px-4 py-2">{n.neighbor_interface}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : (
              <Card title="LLDP Topology Neighbors" description="No LLDP topology neighbors discovered." />
            )}
          </div>
        )}

        {activeTab === 'routing' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="text-left">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Layer 3 Static Routing Policy</h4>
                <p className="text-xs text-slate-400">Add or remove routing policies on the Core stack.</p>
              </div>
              {!isReadOnly && (
                <Button variant="primary" onClick={() => setIsAddRouteOpen(true)}>
                  <Plus className="h-4 w-4 mr-1.5" /> Add Static Route
                </Button>
              )}
            </div>

            {routesList.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-medium font-sans text-xs bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/10 space-y-1">
                <p className="font-bold text-slate-550 dark:text-slate-300">No static routes are currently configured.</p>
                <p className="text-[11px] text-slate-400">This switch is operating using directly connected and dynamic routes only.</p>
              </div>
            ) : (
              <Card className="p-0 overflow-hidden">
                <Table
                  columns={[
                    { header: 'Destination IP / Mask', accessor: 'destination', className: 'font-mono' },
                    { header: 'Next-Hop Gateway', accessor: 'gateway', className: 'font-mono' },
                    { header: 'Outbound Interface', accessor: 'interface', className: 'font-mono' },
                    {
                      header: 'Actions',
                      accessor: (row: any) => (
                        <Button
                          variant="ghost"
                          onClick={() => handleDeleteRoute(row.destination)}
                          className="text-rose-500 hover:text-rose-700 p-1 h-8 w-8 flex items-center justify-center"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ),
                      className: 'text-right'
                    }
                  ]}
                  data={routesList}
                />
              </Card>
            )}
          </div>
        )}

        {activeTab === 'lags' && (
          <Card title="Link Aggregation Groups (LAG / LACP)" description="Trunk aggregations to spine switches:">
            {lags.length === 0 ? (
              <div className="space-y-4 text-left">
                <div className="bg-slate-500/5 p-4 rounded-xl border border-slate-200/10 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs font-sans text-slate-705 dark:text-slate-355">
                  <div className="space-y-1">
                    <h5 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">LACP Status</h5>
                    <p className="font-semibold text-slate-900 dark:text-white">Inactive</p>
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Configured Groups</h5>
                    <p className="font-semibold text-slate-900 dark:text-white">0 Groups</p>
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Member Interfaces</h5>
                    <p className="font-semibold text-slate-900 dark:text-white">None</p>
                  </div>
                </div>
                <div className="p-8 text-center text-slate-400 font-medium font-sans text-xs bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/10">
                  No active Link Aggregation configuration detected.
                </div>
              </div>
            ) : (
              <Table
                columns={[
                  { header: 'LAG Interface', accessor: 'name' },
                  {
                    header: 'Member Ports',
                    accessor: (row: any) => <span className="font-mono text-xs">{row.ports.join(', ')}</span>
                  },
                  {
                    header: 'Link State',
                    accessor: (row: any) => <StatusBadge status={row.status === 'up' ? 'online' : 'offline'} />
                  },
                  { header: 'Aggregated Bandwidth', accessor: 'speed' },
                  { header: 'LACP Mode', accessor: 'mode' },
                  { header: 'Trunk native VLAN', accessor: 'vlan' }
                ]}
                data={lags}
              />
            )}
          </Card>
        )}

        {activeTab === 'stp' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            <Card title="Spanning Tree Protocol (STP) Configuration" description="Configure loop prevention parameters.">
              {isLiveDevice && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl p-3.5 text-xs font-semibold mb-4">
                  Configuration not supported by current backend.
                </div>
              )}
              <form onSubmit={handleSaveStp} className="space-y-4 font-sans">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">STP Mode</label>
                  <select
                    value={stpMode}
                    onChange={(e) => setStpMode(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl disabled:opacity-50"
                    disabled={isLiveDevice}
                  >
                    <option value="RSTP">Rapid Spanning Tree Protocol (RSTP)</option>
                    <option value="MSTP">Multiple Spanning Tree Protocol (MSTP)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Bridge Priority</label>
                  <select
                    value={bridgePriority}
                    onChange={(e) => setBridgePriority(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl disabled:opacity-50"
                    disabled={isLiveDevice}
                  >
                    <option value="0">0 (Root-preferential)</option>
                    <option value="4096">4096</option>
                    <option value="8192">8192</option>
                    <option value="32768">32768 (Default)</option>
                  </select>
                </div>
                <div className="pt-2 flex items-center gap-2">
                  <Button type="submit" variant="primary" disabled={isLiveDevice}>
                    {isLiveDevice ? 'Not Supported' : 'Update STP Parameters'}
                  </Button>
                  {isStpSaved && <span className="text-emerald-500 font-semibold text-xs">STP Config Pushed!</span>}
                </div>
              </form>
            </Card>

            <Card title="Spanning Tree Diagnostics" description="Real-time loop prevention diagnostics:">
              {device.telemetry?.stp ? (
                <div className="text-xs text-slate-700 dark:text-slate-300 flex flex-col space-y-2 mt-2 font-sans">
                  <div className="flex justify-between py-1 border-b border-slate-200/10">
                    <span className="text-slate-400">Mode:</span>
                    <span className="font-mono font-bold">{device.telemetry.stp.protocol || 'RSTP'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/10">
                    <span className="text-slate-400">Root Bridge:</span>
                    <span className="font-mono font-bold">
                      {device.telemetry.stp.is_root 
                        ? 'This Switch (Self)' 
                        : (device.telemetry.stp.root_bridge_id || 'Unavailable')}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/10">
                    <span className="text-slate-400">Bridge Priority:</span>
                    <span className="font-mono">{device.telemetry.stp.priority || '32768'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/10">
                    <span className="text-slate-400">Forwarding Ports:</span>
                    <span className="font-mono text-emerald-500">
                      {device.telemetry.stp.forwarding_ports !== undefined 
                        ? (Array.isArray(device.telemetry.stp.forwarding_ports) ? device.telemetry.stp.forwarding_ports.join(', ') : device.telemetry.stp.forwarding_ports) 
                        : 'Unavailable'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Blocked Ports:</span>
                    <span className="font-mono text-rose-500">
                      {device.telemetry.stp.blocked_ports !== undefined 
                        ? (Array.isArray(device.telemetry.stp.blocked_ports) ? device.telemetry.stp.blocked_ports.join(', ') : device.telemetry.stp.blocked_ports) 
                        : 'None'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 font-medium font-sans text-xs bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/10">
                  No Spanning Tree telemetry available.
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* Add VLAN Modal */}
      <Modal
        isOpen={isAddVlanOpen}
        onClose={() => setIsAddVlanOpen(false)}
        title="Create global VLAN Profile"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsAddVlanOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleAddVlan}>Apply Profile</Button>
          </>
        }
      >
        <div className="space-y-4 text-left font-sans">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">VLAN ID</label>
              <input
                type="number"
                value={vlanId}
                onChange={(e) => setVlanId(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">VLAN Profile Name</label>
              <input
                type="text"
                placeholder="e.g. VLAN_STUDENT"
                value={vlanName}
                onChange={(e) => setVlanName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">IP Subnet</label>
              <input
                type="text"
                value={vlanSubnet}
                onChange={(e) => setVlanSubnet(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">DHCP Range</label>
              <input
                type="text"
                value={vlanRange}
                onChange={(e) => setVlanRange(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Rename VLAN Modal */}
      <Modal
        isOpen={isRenameOpen}
        onClose={() => setIsRenameOpen(false)}
        title="Rename VLAN Profile"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsRenameOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleRenameVlanSubmit}>Rename Profile</Button>
          </>
        }
      >
        <div className="space-y-2 text-left font-sans">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">New Name for VLAN {selectedVlan?.id}</label>
          <input
            type="text"
            value={vlanRenameText}
            onChange={(e) => setVlanRenameText(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
          />
        </div>
      </Modal>

      {/* Add Route Modal */}
      <Modal
        isOpen={isAddRouteOpen}
        onClose={() => setIsAddRouteOpen(false)}
        title="Add Layer 3 Static Route"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsAddRouteOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleAddRoute}>Commit Route</Button>
          </>
        }
      >
        <div className="space-y-4 text-left font-sans">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Destination IP/Mask</label>
              <input
                type="text"
                placeholder="e.g. 192.168.10.0/24"
                value={rtDest}
                onChange={(e) => setRtDest(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Gateway IP Next-Hop</label>
              <input
                type="text"
                placeholder="e.g. 10.10.10.5"
                value={rtGw}
                onChange={(e) => setRtGw(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Outbound Interface Link</label>
            <input
              type="text"
              value={rtIntf}
              onChange={(e) => setRtIntf(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
export default CoreSwitchManager;
