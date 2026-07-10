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

  const [activeTab, setActiveTab] = useState<'overview' | 'vlans' | 'interfaces' | 'routing' | 'lags' | 'stp'>('overview');
  
  // Load Core Switch device
  const device = useMemo(() => {
    return devices.find(d => d.type === 'core_switch') || null;
  }, [devices]);

  const isReadOnly = user?.role === 'Network Engineer';

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

  // Derived core switch routes
  const routesList = useMemo(() => {
    if (!device) return [];
    const list = (device.config as any).routingTable || [
      { destination: '0.0.0.0/0', gateway: '10.10.10.1', interface: 'xe0' },
      { destination: '10.10.20.0/24', gateway: 'Directly Connected', interface: 'vlan-20' },
      { destination: '10.10.30.0/24', gateway: 'Directly Connected', interface: 'vlan-30' },
      { destination: '10.10.40.0/24', gateway: 'Directly Connected', interface: 'vlan-40' }
    ];
    return list.map((r: any, idx: number) => ({
      id: `rt-${idx}`,
      ...r
    }));
  }, [device]);

  // Derived Link Aggregations
  const lags = useMemo(() => {
    return [
      { id: 'lag-1', name: 'ae0 (Uplink to FW)', ports: ['xe-0/0/0', 'xe-0/0/1'], status: 'up', speed: '20 Gbps', mode: 'LACP', vlan: 10 },
      { id: 'lag-2', name: 'ae1 (Downlink Floor 1)', ports: ['xe-0/1/0', 'xe-1/1/0'], status: 'up', speed: '20 Gbps', mode: 'LACP', vlan: 20 },
      { id: 'lag-3', name: 'ae2 (Downlink Floor 2)', ports: ['xe-0/1/1', 'xe-1/1/1'], status: 'up', speed: '20 Gbps', mode: 'LACP', vlan: 20 }
    ];
  }, []);

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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card title="Virtual Chassis Configuration" description="Multi-member active switch stack">
                <div className="flex items-center space-x-3 mt-3 text-left">
                  <div className="h-10 w-10 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center text-sm font-bold font-mono shrink-0">
                    2x
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Stack Status: ACTIVE</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Master: Member 0 | Backup: Member 1</p>
                  </div>
                </div>
              </Card>

              <Card title="Aggregate Link Traffic" description="Throughput distribution across LAGs">
                <div className="mt-3 text-left">
                  <p className="text-xs text-slate-400">ae0 throughput load</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200">12.4 Gbps / 20 Gbps</span>
                    <span className="text-[10px] text-emerald-500 font-semibold">(Healthy load)</span>
                  </div>
                </div>
              </Card>

              <Card title="STP Root Bridge status" description="RSTP topology diagnostics">
                <div className="mt-3 text-xs text-slate-700 dark:text-slate-300 flex flex-col space-y-1 text-left">
                  <p className="flex justify-between">
                    <span className="text-slate-400">Root Bridge ID:</span>
                    <span className="font-mono font-semibold">32768.00:0B:82:22:B4:02</span>
                  </p>
                  <p className="flex justify-between mt-1">
                    <span className="text-slate-400">Role:</span>
                    <span className="text-emerald-500 font-semibold">This switch is the ROOT</span>
                  </p>
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
                <Button variant="primary" onClick={() => setIsAddVlanOpen(true)}>
                  <Plus className="h-4 w-4 mr-1.5" /> Create VLAN
                </Button>
              )}
            </div>

            <Card className="p-0 overflow-hidden">
              <Table
                columns={[
                  { header: 'VLAN ID', accessor: 'id', sortable: true },
                  { header: 'Profile Name', accessor: 'name', sortable: true },
                  { header: 'IP Subnet Address', accessor: 'subnet', className: 'font-mono' },
                  { header: 'DHCP Pool Range', accessor: 'dhcpRange', className: 'font-mono' },
                  {
                    header: 'Actions',
                    accessor: (row: Vlan) => (
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          onClick={() => triggerRenameVlan(row)}
                          className="p-1 h-8 w-8 flex items-center justify-center"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => handleDeleteVlan(row.id)}
                          className="p-1 h-8 w-8 flex items-center justify-center text-rose-500 hover:text-rose-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ),
                    className: 'text-right'
                  }
                ]}
                data={vlans}
              />
            </Card>
          </div>
        )}

        {activeTab === 'interfaces' && (
          <Card title="Interface Port Configurations" description="Assign desired VLAN profiles and enable/disable interfaces.">
            <div className="overflow-x-auto text-left">
              <table className="min-w-full divide-y divide-slate-200/50 dark:divide-slate-800/50 text-xs font-mono">
                <thead className="bg-slate-50/50 dark:bg-slate-900/50">
                  <tr>
                    <th className="px-6 py-3 text-slate-400 uppercase tracking-wider">Port Name</th>
                    <th className="px-6 py-3 text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-slate-400 uppercase tracking-wider">Speed</th>
                    <th className="px-6 py-3 text-slate-400 uppercase tracking-wider">Assigned VLAN</th>
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
                      <td className="px-6 py-3 font-sans">
                        <select
                          value={port.vlan}
                          onChange={(e) => handlePortVlanChange(key, Number(e.target.value))}
                          className="px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"
                        >
                          <option value="1">1 (Default Trunk)</option>
                          {vlans.map(v => (
                            <option key={v.id} value={v.id}>{v.id} ({v.name})</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <Button
                          variant="outline"
                          onClick={() => handleToggleInterface(key)}
                          className="text-[10px] py-1 px-2.5"
                        >
                          {port.enabled ? 'Disable' : 'Enable'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
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
          </div>
        )}

        {activeTab === 'lags' && (
          <Card title="Link Aggregation Groups (LAG / LACP)" description="Trunk aggregations to spine switches:">
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
          </Card>
        )}

        {activeTab === 'stp' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            <Card title="Spanning Tree Protocol (STP) Configuration" description="Configure loop prevention parameters.">
              <form onSubmit={handleSaveStp} className="space-y-4 font-sans">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">STP Mode</label>
                  <select
                    value={stpMode}
                    onChange={(e) => setStpMode(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
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
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                  >
                    <option value="0">0 (Root-preferential)</option>
                    <option value="4096">4096</option>
                    <option value="8192">8192</option>
                    <option value="32768">32768 (Default)</option>
                  </select>
                </div>
                <div className="pt-2 flex items-center gap-2">
                  <Button type="submit" variant="primary">Update STP Parameters</Button>
                  {isStpSaved && <span className="text-emerald-500 font-semibold text-xs">STP Config Pushed!</span>}
                </div>
              </form>
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
