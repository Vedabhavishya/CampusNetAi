import React, { useState, useMemo, useEffect } from 'react';
import { Drawer } from './Drawer';
import { Button } from './Button';
import { Card } from './Card';
import { DiffViewer } from './DiffViewer';
import { StatusBadge, HealthIndicator } from './EnterpriseWidgets';
import { useNetworkStore } from '../contexts/NetworkStoreContext';
import { useAuth } from '../contexts/AuthContext';
import { NetworkDevice, AuditLog, PortStatus, MaintenanceConfig, ProvisioningTask, BackupVersion } from '../types';
import { 
  Play, RotateCw, ShieldAlert, Cpu, HardDrive, History, FileText, Activity, 
  Terminal, Shield, Wifi, Server, Thermometer, Zap, Layers, Link2, Users, 
  RefreshCw, CheckCircle2, AlertTriangle, Eye, Send, PlayCircle, Clock
} from 'lucide-react';
import { AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Area } from 'recharts';

interface DeviceDetailDrawerProps {
  device: NetworkDevice | null;
  isOpen: boolean;
  onClose: () => void;
}

export const DeviceDetailDrawer: React.FC<DeviceDetailDrawerProps> = ({ device, isOpen, onClose }) => {
  const { user } = useAuth();
  
  const { 
    logs, 
    tasks,
    clients,
    alerts,
    restartDevice, 
    backupDeviceConfig, 
    rollbackConfiguration, 
    restoreDeviceConfig,
    updateFirmware,
    toggleMaintenance,
    runDiagnostics,
    deviceHasCapability 
  } = useNetworkStore();
  
  const [activeTab, setActiveTab] = useState<
    'overview' | 'interfaces' | 'ports' | 'performance' | 'configuration' | 'terminal' |
    'topology' | 'clients' | 'history' | 'firmware' | 'maintenance' | 'audit' | 'tasks' | 'diagnostics'
  >('overview');

  const isReadOnly = user?.role === 'Network Engineer';
  const isNetworkAdmin = user?.role === 'Network Administrator';
  const isSuperAdmin = user?.role === 'Super Admin';

  const [isRebooting, setIsRebooting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupReason, setBackupReason] = useState('');
  
  // CLI Terminal states
  const [cliInput, setCliInput] = useState('');
  const [cliLogs, setCliLogs] = useState<string[]>(['CampusNet ENOS CLI Shell v1.0', 'Type "?" or "help" for a list of supported commands.', '']);
  const [cliHistory, setCliHistory] = useState<string[]>([]);
  const [cliHistoryIndex, setCliHistoryIndex] = useState(-1);
  const [cliAutocompleteSuggestion, setCliAutocompleteSuggestion] = useState('');

  // Troubleshooting diagnostics states
  const [diagType, setDiagType] = useState('ping');
  const [diagTarget, setDiagTarget] = useState('8.8.8.8');
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagLogs, setDiagLogs] = useState<string[]>([]);
  const [diagResult, setDiagResult] = useState<string | null>(null);

  // Maintenance mode scheduling states
  const [maintEnabled, setMaintEnabled] = useState(false);
  const [maintNotes, setMaintNotes] = useState('Routine software optimization.');
  const [maintHours, setMaintHours] = useState('2');

  // Compare config states
  const [compareBackupId, setCompareBackupId] = useState<string | null>(null);

  useEffect(() => {
    if (device) {
      setMaintEnabled(device.maintenanceConfig?.enabled || false);
      setMaintNotes(device.maintenanceConfig?.notes || 'Routine hardware update.');
    }
  }, [device]);

  // Fetch audits relating to this target device name
  const deviceLogs = useMemo(() => {
    if (!device) return [];
    return logs.filter(l => l.target.includes(device.name));
  }, [logs, device]);

  // Fetch backups history
  const backupHistoryList = useMemo(() => {
    if (!device) return [];
    return device.backupHistory || [];
  }, [device]);

  // Fetch tasks targeting this device
  const deviceTasks = useMemo(() => {
    if (!device) return [];
    return tasks.filter(t => t.targetDevices.includes(device.name));
  }, [tasks, device]);

  // Fetch clients connected to this device
  const deviceClients = useMemo(() => {
    if (!device) return [];
    return clients.filter(c => c.connectedToDeviceId === device.id && c.status === 'active');
  }, [clients, device]);

  if (!device) return null;

  // Actions handlers
  const handleRestart = async () => {
    setIsRebooting(true);
    try {
      await restartDevice(device.id);
      alert(`${device.name} restart task dispatched successfully.`);
    } finally {
      setIsRebooting(false);
    }
  };

  const handleBackup = async () => {
    if (!backupReason) {
      alert('Provide a description for the configuration snapshot.');
      return;
    }
    setIsBackingUp(true);
    try {
      await backupDeviceConfig(device.id, backupReason);
      setBackupReason('');
      alert('Config backup snapshot created successfully.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreBackupVersion = async (version: number) => {
    if (isReadOnly) {
      alert('Permission Denied: Network Engineers cannot rollback configurations.');
      return;
    }
    if (confirm(`Revert configuration state to Version ${version}?`)) {
      await restoreDeviceConfig(device.id, version);
      alert('Config version rollback completed successfully.');
    }
  };

  const handleSaveFirmwareUpdate = async () => {
    if (isReadOnly) {
      alert('Permission Denied: Network Engineers cannot install firmware updates.');
      return;
    }
    const target = device.firmwareInfo?.latestVersion || 'JunOS 22.4R2-S1';
    if (confirm(`Install firmware upgrade to version ${target} on ${device.name}?`)) {
      await updateFirmware(device.id, target);
      alert('Firmware install transaction scheduled.');
    }
  };

  const handleSaveMaintenance = async () => {
    const hoursNum = Number(maintHours) || 2;
    const config: MaintenanceConfig = {
      enabled: maintEnabled,
      notes: maintNotes,
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + hoursNum * 3600000).toISOString(),
      suppressAlerts: true,
      pauseMonitoring: false
    };
    await toggleMaintenance(device.id, config);
    alert(`Maintenance Mode settings updated.`);
  };

  // Diagnostics troubleshooting runner
  const handleStartDiagnostics = async () => {
    setDiagRunning(true);
    setDiagLogs([`Initializing simulated troubleshooting trace: ${diagType.toUpperCase()} targeting ${diagTarget}...`]);
    setDiagResult(null);

    await new Promise(r => setTimeout(r, 600));
    setDiagLogs(prev => [...prev, 'Tracing route through spine gateway 10.10.10.1...', 'Asserting link integrity status...']);

    await new Promise(r => setTimeout(r, 800));
    let resultLog = 'Nominal status. Diagnostic test succeeded.';
    if (diagType === 'ping') {
      resultLog = `Ping statistics for ${diagTarget}: 4 packets transmitted, 4 received, 0% packet loss. RTT min/avg/max = 11.2/14.5/19.8 ms.`;
    } else if (diagType === 'traceroute') {
      resultLog = `Traceroute to ${diagTarget}: hop 1 (10.10.10.1) 1.2ms, hop 2 (203.0.113.1) 8.9ms, hop 3 (${diagTarget}) 14.2ms.`;
    } else if (diagType === 'dns') {
      resultLog = `DNS lookup for ${diagTarget}: Resolved to host address 142.250.190.46. Record type: A.`;
    } else if (diagType === 'cable') {
      resultLog = 'Interface ge-0/0/1 loop cable test: Link status operational. Length: 12 meters. Return loss: 24dB (Good).';
    } else if (diagType === 'loss') {
      resultLog = 'Packet loss metrics test: Nominal traffic segment. 100 packets transmitted, 0 packets dropped (0.0% loss).';
    }

    setDiagLogs(prev => [...prev, resultLog, 'Diagnostic workflow completed.']);
    setDiagResult('Success');
    setDiagRunning(false);
    await runDiagnostics(device.id, diagType, diagTarget);
  };

  // CLI Command logic
  const handleCliSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = cliInput.trim().toLowerCase();
    if (!cmd) return;

    const newLogs = [...cliLogs, `admin@${device.name}> ${cliInput}`];
    setCliHistory(prev => [cliInput, ...prev]);
    setCliHistoryIndex(-1);
    setCliInput('');

    // Authenticate command based on role permission boundaries
    const isWriteCommand = cmd.startsWith('clear') || cmd.startsWith('restart') || cmd.startsWith('reload') || cmd.startsWith('backup');
    
    if (isReadOnly && isWriteCommand) {
      setCliLogs([...newLogs, 'Permission Denied: Network Engineers can only execute read-only CLI commands.', '']);
      return;
    }

    let output = '';
    if (cmd === '?' || cmd === 'help') {
      output = `Supported commands:
  show interfaces                 - Display active link mappings
  show vlan                       - Display local switch trunk VLAN profiles
  show route                      - Display static L3 routing table
  show version                    - Display JunOS / hardware version info
  show system                     - Display CPU, memory, and status load telemetries
  show chassis                    - Display chassis temperature and hardware specs
  show ethernet-switching table   - Display active MAC addresses table
  clear interface                 - Reset port interface stats [Admin/SuperAdmin]
  restart interface               - Reset link interface socket [Admin/SuperAdmin]
  reload                          - Reboot the hardware node [Admin/SuperAdmin]
  backup config                   - Backup the active configurations [Admin/SuperAdmin]
  clear                           - Clear the terminal console`;
    } else if (cmd === 'clear') {
      setCliLogs([]);
      return;
    } else if (cmd === 'show interfaces') {
      output = `Interface    Status    Speed      VLAN    PoE
ge-0/0/0     Up        1000Mbps   10      Yes
ge-0/0/1     Up        1000Mbps   20      Yes
ge-0/0/2     Down      1000Mbps   10      No
xe-0/1/0     Up        10Gbps     10      No`;
    } else if (cmd === 'show vlan') {
      output = `VLAN ID    Name             Subnet            DHCP Range
10         Management       10.10.10.0/24     10.10.10.10-10.10.10.100
20         Corporate-WiFi   10.10.20.0/24     10.10.20.10-10.10.20.200
30         Guest-WiFi       10.10.30.0/24     10.10.30.10-10.10.30.200`;
    } else if (cmd === 'show route') {
      output = `Routing table:
Destination        Gateway            Interface
0.0.0.0/0          203.0.113.1        ge0
10.10.0.0/16       10.10.10.2         ge1`;
    } else if (cmd === 'show version') {
      output = `Model: ${device.model}
Software: ${device.version}
Uptime: ${device.uptime}`;
    } else if (cmd === 'show system') {
      output = `System Telemetry Metrics:
  CPU Load           : ${device.cpuUsage}%
  Memory Load        : ${device.memoryUsage}%
  Hardware Status    : ${device.status.toUpperCase()}
  Uptime             : ${device.uptime}`;
    } else if (cmd === 'show chassis') {
      output = `Chassis hardware statistics:
  Internal Temp      : ${device.temperature || 42}°C
  Power Supply       : ${device.powerStatus || 'Healthy'}
  Fans Speed         : 5400 RPM (Nominal)
  Availability SLA   : ${device.availability || 99.9}%`;
    } else if (cmd === 'show ethernet-switching table') {
      output = `MAC Address          VLAN    Interface      Port Status
00:0B:82:11:AA:22    10      ge-0/0/0       Active
00:0B:82:33:BB:44    20      ge-0/0/1       Active`;
    } else if (cmd === 'restart interface' || cmd === 'clear interface') {
      output = `Operation succeeded. Interfaced restarted, config locks synchronized.`;
      restartDevice(device.id);
    } else if (cmd === 'reload') {
      output = `System reboot sequence initiated. Locks scheduled...`;
      restartDevice(device.id);
    } else if (cmd === 'backup config') {
      output = `Backup configuration snap saved. Audit trail updated.`;
      backupDeviceConfig(device.id, 'CLI console backup');
    } else {
      output = `Command not recognized: "${cmd}". Type "?" or "help" for a list of options.`;
    }

    setCliLogs([...newLogs, output, '']);
  };

  // Mock Performance Data
  const performanceData = [
    { time: '10:00', cpu: device.cpuUsage - 4, mem: device.memoryUsage - 1, latency: 12 },
    { time: '10:05', cpu: device.cpuUsage + 3, mem: device.memoryUsage, latency: 14 },
    { time: '10:10', cpu: device.cpuUsage - 7, mem: device.memoryUsage + 1, latency: 11 },
    { time: '10:15', cpu: device.cpuUsage, mem: device.memoryUsage, latency: 13 },
    { time: '10:20', cpu: device.cpuUsage + 8, mem: device.memoryUsage - 2, latency: 16 },
    { time: '10:25', cpu: device.cpuUsage, mem: device.memoryUsage, latency: 12 }
  ];

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={device.name} size="lg">
      <div className="flex flex-col h-full space-y-5">
        
        {/* Row 1: Health Summary Panel Grid */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3.5 border-b border-slate-200/50 dark:border-slate-800/80 pb-4 text-left">
          <div className="p-3 bg-slate-500/5 border border-slate-200/10 rounded-2xl flex items-center gap-3">
            <HealthIndicator score={device.healthScore} size="md" />
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Health</p>
              <h4 className="text-sm font-extrabold text-slate-800 dark:text-white mt-0.5">{device.healthScore}%</h4>
            </div>
          </div>
          
          {[
            { label: 'CPU Usage', val: `${device.cpuUsage}%`, sub: 'Core Load', icon: Cpu, color: 'text-brand-500' },
            { label: 'Memory', val: `${device.memoryUsage}%`, sub: 'RAM Load', icon: HardDrive, color: 'text-blue-500' },
            { label: 'Temperature', val: `${device.temperature || 42}°C`, sub: 'Chassis Temp', icon: Thermometer, color: 'text-amber-500' },
            { label: 'Power Supply', val: device.powerStatus || 'Healthy', sub: 'Dual Feed', icon: Zap, color: 'text-emerald-500' },
            { label: 'SLA Availability', val: `${device.availability || 99.9}%`, sub: 'Target: 99.9%', icon: Activity, color: 'text-teal-500' }
          ].map((stat, idx) => (
            <div key={idx} className="p-3 bg-slate-500/5 border border-slate-200/10 rounded-2xl flex items-center gap-3.5">
              <div className={`h-8 w-8 rounded-xl bg-slate-500/10 flex items-center justify-center shrink-0 ${stat.color}`}>
                <stat.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                <h4 className="text-sm font-extrabold text-slate-800 dark:text-white mt-0.5">{stat.val}</h4>
              </div>
            </div>
          ))}
        </div>

        {/* Row 2: Quick Actions Toolbar */}
        <div className="flex flex-wrap gap-2 py-1.5 border-b border-slate-200/50 dark:border-slate-800/80 justify-start">
          <Button variant="outline" size="sm" onClick={handleRestart} isLoading={isRebooting} className="text-[10px] py-1 px-2.5">
            <RotateCw className="h-3 w-3 mr-1" /> Restart Device
          </Button>
          <Button variant="outline" size="sm" onClick={() => setActiveTab('history')} className="text-[10px] py-1 px-2.5">
            <History className="h-3 w-3 mr-1" /> Backup & Restore
          </Button>
          <Button variant="outline" size="sm" onClick={() => setActiveTab('diagnostics')} className="text-[10px] py-1 px-2.5">
            <ShieldAlert className="h-3 w-3 mr-1" /> Run Diagnostics
          </Button>
          <Button variant="outline" size="sm" onClick={() => setActiveTab('terminal')} className="text-[10px] py-1 px-2.5">
            <Terminal className="h-3 w-3 mr-1" /> CLI Terminal
          </Button>
          <Button variant="outline" size="sm" onClick={() => setActiveTab('firmware')} className="text-[10px] py-1 px-2.5">
            <RefreshCw className="h-3 w-3 mr-1" /> Firmware
          </Button>
          <Button variant="outline" size="sm" onClick={() => setActiveTab('maintenance')} className="text-[10px] py-1 px-2.5">
            <Clock className="h-3 w-3 mr-1" /> Maintenance
          </Button>
        </div>

        {/* Row 3: 13 Tabs navigation list */}
        <div className="overflow-x-auto border-b border-slate-200/50 dark:border-slate-800/80 bg-slate-500/5 rounded-xl p-1 shrink-0 scrollbar-none">
          <div className="flex space-x-1 whitespace-nowrap min-w-max">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'interfaces', label: 'Interfaces' },
              { id: 'ports', label: 'Ports Map' },
              { id: 'performance', label: 'Performance' },
              { id: 'configuration', label: 'Configuration' },
              { id: 'terminal', label: 'CLI Terminal' },
              { id: 'diagnostics', label: 'Diagnostics Center' },
              { id: 'clients', label: 'Connected Clients' },
              { id: 'history', label: 'Config Backups' },
              { id: 'firmware', label: 'Firmware Update' },
              { id: 'maintenance', label: 'Maintenance Window' },
              { id: 'audit', label: 'Audit Trail' },
              { id: 'tasks', label: 'Provisioning Tasks' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-1.5 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === tab.id 
                    ? 'bg-brand-500 text-white font-extrabold shadow-sm' 
                    : 'text-slate-400 hover:text-slate-500 hover:bg-slate-500/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 4: Tab Content Area */}
        <div className="flex-1 overflow-y-auto min-h-[350px] pr-1">
          
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left text-xs font-semibold">
              <Card title="Hardware Telemetry info" className="space-y-3">
                <div className="grid grid-cols-2 py-1 border-b border-slate-200/10">
                  <span className="text-slate-400">Device Model</span>
                  <span className="text-slate-800 dark:text-slate-200 text-right">{device.model}</span>
                </div>
                <div className="grid grid-cols-2 py-1 border-b border-slate-200/10">
                  <span className="text-slate-400">Software Version</span>
                  <span className="text-slate-800 dark:text-slate-200 text-right font-mono">{device.version}</span>
                </div>
                <div className="grid grid-cols-2 py-1 border-b border-slate-200/10">
                  <span className="text-slate-400">Management IP</span>
                  <span className="text-slate-800 dark:text-slate-200 text-right font-mono font-bold">{device.ipAddress}</span>
                </div>
                <div className="grid grid-cols-2 py-1 border-b border-slate-200/10">
                  <span className="text-slate-400">MAC Address</span>
                  <span className="text-slate-800 dark:text-slate-200 text-right font-mono">{device.macAddress}</span>
                </div>
                <div className="grid grid-cols-2 py-1">
                  <span className="text-slate-400">Lifecycle Stage</span>
                  <span className="text-brand-500 text-right font-bold uppercase tracking-wider">{device.lifecycleStage || 'Operational'}</span>
                </div>
              </Card>

              <Card title="Operational SLA Status" className="space-y-3">
                <div className="grid grid-cols-2 py-1 border-b border-slate-200/10">
                  <span className="text-slate-400">System Uptime</span>
                  <span className="text-slate-800 dark:text-slate-200 text-right">{device.uptime}</span>
                </div>
                <div className="grid grid-cols-2 py-1 border-b border-slate-200/10">
                  <span className="text-slate-400">Interfaces Load</span>
                  <span className="text-slate-800 dark:text-slate-200 text-right">{device.interfacesActive || 3} / {device.interfacesCount || 48} Active</span>
                </div>
                <div className="grid grid-cols-2 py-1 border-b border-slate-200/10">
                  <span className="text-slate-400">Clients Associated</span>
                  <span className="text-slate-800 dark:text-slate-200 text-right">{deviceClients.length} clients</span>
                </div>
                <div className="grid grid-cols-2 py-1">
                  <span className="text-slate-400">Current Bandwidth</span>
                  <span className="text-slate-800 dark:text-slate-200 text-right">{device.bandwidth || 180} Mbps</span>
                </div>
              </Card>
            </div>
          )}

          {/* INTERFACES TAB */}
          {activeTab === 'interfaces' && (
            <div className="border border-slate-200/50 dark:border-slate-800/80 rounded-2xl overflow-x-auto text-left text-xs font-semibold">
              <table className="min-w-full divide-y divide-slate-200/50 dark:divide-slate-800/50">
                <thead className="bg-slate-50/50 dark:bg-slate-900/50">
                  <tr>
                    <th className="px-4 py-3 text-slate-400">Interface</th>
                    <th className="px-4 py-3 text-slate-400">Speed</th>
                    <th className="px-4 py-3 text-slate-400">VLAN ID</th>
                    <th className="px-4 py-3 text-slate-400">PoE Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/40 dark:divide-slate-800/40 bg-transparent text-slate-700 dark:text-slate-300 font-mono">
                  {Object.entries(device.config.interfaces || {}).map(([key, port]: any) => (
                    <tr key={key}>
                      <td className="px-4 py-3 font-bold">{key}</td>
                      <td className="px-4 py-3">{port.speed}</td>
                      <td className="px-4 py-3">VLAN {port.vlan}</td>
                      <td className="px-4 py-3">
                        {port.poe !== undefined ? (
                          <span className={port.poe ? 'text-brand-500 font-bold' : 'text-slate-400'}>
                            {port.poe ? 'Active' : 'Disabled'}
                          </span>
                        ) : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* PORTS MAP TAB */}
          {activeTab === 'ports' && (
            <Card title="Graphical Switch interfaces Matrix" className="p-5 text-left" description="Physical 48-port socket visualization:">
              <div className="grid grid-cols-12 gap-1.5 bg-slate-900/50 p-4 border border-slate-200/10 rounded-2xl">
                {Array.from({ length: 48 }).map((_, idx) => {
                  const isActive = idx < (device.interfacesActive || 4);
                  return (
                    <div 
                      key={idx} 
                      className={`h-9 rounded flex flex-col items-center justify-center font-mono text-[8px] font-bold ${
                        isActive ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-850 text-slate-500'
                      }`}
                    >
                      <span>ge{idx}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-4 justify-center">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-emerald-500 rounded" /> Active Link</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-slate-800 rounded border border-slate-700" /> Standby (Idle)</span>
              </div>
            </Card>
          )}

          {/* PERFORMANCE TAB */}
          {activeTab === 'performance' && (
            <Card title="Live Hardware Load Performance" description="CPU utilization and latency history metrics:">
              <div className="h-56 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={performanceData}>
                    <defs>
                      <linearGradient id="cpuPerformanceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="#64748b" fontSize={9} />
                    <YAxis stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 12, fontSize: 10, color: '#fff' }} />
                    <Area type="monotone" dataKey="cpu" stroke="#0ea5e9" fillOpacity={1} fill="url(#cpuPerformanceGrad)" strokeWidth={2} name="CPU Load (%)" />
                    <Area type="monotone" dataKey="latency" stroke="#6366f1" fill="transparent" strokeWidth={1.5} name="Latency (ms)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* CONFIGURATION TAB */}
          {activeTab === 'configuration' && (
            <Card title="System Parameters Config Editor" className="text-left font-sans text-xs">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Primary DNS IP Servers</label>
                  <input
                    type="text"
                    defaultValue={device.config.dnsServers?.join(', ') || '1.1.1.1, 8.8.8.8'}
                    disabled={isReadOnly}
                    className="w-full bg-slate-500/5 border border-slate-200/10 p-2 rounded-lg font-mono"
                  />
                </div>
                <div className="flex items-center justify-between py-2 border-t border-slate-200/10">
                  <div>
                    <h5 className="font-bold text-slate-700 dark:text-slate-200">Automatic Firmware Updates</h5>
                    <p className="text-[10px] text-slate-500 leading-normal">Schedule updates install windows automatically.</p>
                  </div>
                  <input
                    type="checkbox"
                    defaultChecked={device.config.firmwareAutoUpdate}
                    disabled={isReadOnly}
                    className="cursor-pointer"
                  />
                </div>
                <Button variant="primary" disabled={isReadOnly} className="w-full text-[10px] py-2 mt-2">
                  Update Configuration Profile
                </Button>
              </div>
            </Card>
          )}

          {/* CLI TERMINAL TAB */}
          {activeTab === 'terminal' && (
            <Card title="Interactive Device ENOS CLI Console" className="p-0 overflow-hidden text-left h-[420px] flex flex-col">
              {/* Terminal Screen log logs */}
              <div className="flex-1 bg-slate-950 p-4 font-mono text-[10px] text-slate-200 overflow-y-auto space-y-1 select-text scrollbar-thin">
                {cliLogs.map((log, idx) => (
                  <div key={idx} className="whitespace-pre-wrap">{log}</div>
                ))}
              </div>
              {/* Command line form input */}
              <form onSubmit={handleCliSubmit} className="bg-slate-900 border-t border-slate-800 p-2 flex items-center gap-2">
                <span className="font-mono text-[10px] text-brand-500 font-bold px-2">{`admin@${device.name}>`}</span>
                <input
                  type="text"
                  value={cliInput}
                  onChange={e => setCliInput(e.target.value)}
                  placeholder="Type CLI command or '?' for help..."
                  className="flex-1 bg-transparent border-none text-[10px] font-mono text-white focus:outline-none placeholder-slate-600"
                />
                <button type="submit" className="text-slate-400 hover:text-brand-500 cursor-pointer p-1">
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </Card>
          )}

          {/* DIAGNOSTICS TAB */}
          {activeTab === 'diagnostics' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left text-xs font-semibold">
              <Card title="Select Diagnostics Test" className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Test Utility Type</label>
                  <select 
                    value={diagType} 
                    onChange={e => setDiagType(e.target.value)}
                    className="w-full bg-slate-500/5 border border-slate-200/10 rounded-lg p-2 font-sans focus:outline-none"
                  >
                    <option value="ping">Ping Sweep</option>
                    <option value="traceroute">IP Traceroute</option>
                    <option value="dns">DNS Resolution</option>
                    <option value="cable">Cable TDR Test</option>
                    <option value="loss">Packet Loss Ratio</option>
                  </select>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Endpoint Address</label>
                  <input
                    type="text"
                    value={diagTarget}
                    onChange={e => setDiagTarget(e.target.value)}
                    placeholder="e.g. 8.8.8.8"
                    className="w-full bg-slate-500/5 border border-slate-200/10 rounded-lg p-2 font-mono focus:outline-none"
                  />
                </div>

                <Button 
                  variant="primary" 
                  onClick={handleStartDiagnostics} 
                  isLoading={diagRunning}
                  className="w-full text-[10px] py-2"
                >
                  Run Diagnostics Suite
                </Button>
              </Card>

              {/* Troubleshooting console screen output */}
              <Card title="Troubleshooting logs" className="md:col-span-2 p-0 overflow-hidden h-[300px] flex flex-col">
                <div className="flex-1 bg-slate-950 p-4 font-mono text-[10px] text-emerald-400 overflow-y-auto space-y-1">
                  {diagLogs.length === 0 ? (
                    <div className="text-slate-600 text-center py-20">Initialize diagnostic sweep execution...</div>
                  ) : (
                    diagLogs.map((log, idx) => <div key={idx}>{`> ${log}`}</div>)
                  )}
                </div>
                {diagResult && (
                  <div className="bg-emerald-500/10 border-t border-emerald-500/20 p-2.5 text-[10px] font-bold text-emerald-500 text-center uppercase tracking-wider">
                    Diagnostics Result Status: Success
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* CONNECTED CLIENTS TAB */}
          {activeTab === 'clients' && (
            <div className="space-y-3 text-left">
              {deviceClients.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 font-medium">No clients active on this node.</div>
              ) : (
                deviceClients.map(c => (
                  <div key={c.id} className="p-3 bg-slate-500/5 border border-slate-200/10 rounded-2xl flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-100">{c.name}</span>
                      <span className="block text-[10px] text-slate-400 font-mono mt-0.5">IP: {c.ipAddress} | MAC: {c.macAddress} | OS: {c.os}</span>
                    </div>
                    <span className="bg-brand-500/10 text-brand-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                      {c.connectionType}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* CONFIGURATION HISTORY / BACKUPS TAB */}
          {activeTab === 'history' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left text-xs font-semibold">
              <Card title="Commit configuration Snapshot" className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Snapshot Description / Reason</label>
                  <input
                    type="text"
                    value={backupReason}
                    onChange={e => setBackupReason(e.target.value)}
                    placeholder="e.g. Pre-staging trunk edit"
                    className="w-full bg-slate-500/5 border border-slate-200/10 rounded-lg p-2 focus:outline-none"
                  />
                </div>
                <Button 
                  variant="outline" 
                  onClick={handleBackup} 
                  isLoading={isBackingUp}
                  className="w-full text-[10px] py-2"
                >
                  Create Backup Snapshot
                </Button>
              </Card>

              {/* Version backup lists */}
              <Card title="Version Backups History" className="md:col-span-2 space-y-3">
                {backupHistoryList.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">No configuration backups recorded.</div>
                ) : (
                  <div className="space-y-2.5">
                    {backupHistoryList.map(b => (
                      <div key={b.version} className="p-3 bg-slate-500/5 border border-slate-200/10 rounded-2xl space-y-1 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-800 dark:text-slate-100">Version {b.version}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{new Date(b.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-sans">{b.description}</p>
                        <div className="flex gap-2 justify-end pt-2 border-t border-slate-250/10 mt-2">
                          <Button 
                            variant="ghost" 
                            onClick={() => setCompareBackupId(compareBackupId === String(b.version) ? null : String(b.version))}
                            className="text-[9px] py-1 px-2.5"
                          >
                            Compare Diff
                          </Button>
                          <Button 
                            variant="primary" 
                            disabled={isReadOnly}
                            onClick={() => handleRestoreBackupVersion(b.version)}
                            className="text-[9px] py-1 px-2.5"
                          >
                            Restore Version
                          </Button>
                        </div>

                        {/* Side by side compare diff */}
                        {compareBackupId === String(b.version) && (
                          <div className="mt-3 p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                            <div className="text-[10px] font-bold text-slate-400 uppercase pb-1 border-b border-slate-800">
                              Enterprise Side-by-side Configuration Compare
                            </div>
                            <div className="grid grid-cols-3 text-[9px] font-bold text-slate-500 border-b border-slate-800 pb-1 uppercase">
                              <span>Property</span>
                              <span>Target Version Backup</span>
                              <span>Active Running config</span>
                            </div>
                            <div className="grid grid-cols-3 text-[10px] font-mono text-slate-300 py-1">
                              <span>Hostname</span>
                              <span className="text-red-400">{device.name}</span>
                              <span className="text-emerald-400">{device.name}</span>
                            </div>
                            <div className="grid grid-cols-3 text-[10px] font-mono text-slate-300 py-1">
                              <span>DNS Servers</span>
                              <span className="text-red-400">1.1.1.1</span>
                              <span className="text-emerald-400">{device.config.dnsServers?.join(', ') || '1.1.1.1'}</span>
                            </div>
                            <div className="grid grid-cols-3 text-[10px] font-mono text-slate-300 py-1">
                              <span>Interfaces count</span>
                              <span className="text-red-400">{device.interfacesCount} ports</span>
                              <span className="text-emerald-400">{device.interfacesCount} ports</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* FIRMWARE TAB */}
          {activeTab === 'firmware' && (
            <Card title="Firmware Image Management" className="text-left text-xs font-sans space-y-4">
              <div className="grid grid-cols-2 py-2 border-b border-slate-200/10">
                <span className="text-slate-400">Current running version</span>
                <span className="text-slate-800 dark:text-slate-100 font-mono font-bold">{device.version}</span>
              </div>
              <div className="grid grid-cols-2 py-2 border-b border-slate-200/10">
                <span className="text-slate-400">Latest available release</span>
                <span className="text-slate-800 dark:text-slate-100 font-mono font-bold">
                  {device.firmwareInfo?.latestVersion || 'JunOS 22.4R2-S1'}
                </span>
              </div>
              <div className="py-2.5">
                <h5 className="font-bold text-slate-700 dark:text-slate-200">Release Notes Summary:</h5>
                <p className="text-[11px] text-slate-400 leading-relaxed font-sans mt-1">
                  {device.firmwareInfo?.releaseNotes || 'Fixed core security vulnerabilities in SSH daemon and LACP trunk aggregation links.'}
                </p>
              </div>
              {device.firmwareInfo?.status === 'update_available' && !isReadOnly && (
                <div className="flex gap-2.5 justify-end">
                  <Button variant="ghost" className="text-[10px] py-1.5 px-3">Schedule Update</Button>
                  <Button variant="primary" onClick={handleSaveFirmwareUpdate} className="text-[10px] py-1.5 px-3">
                    Install Firmware Update
                  </Button>
                </div>
              )}
            </Card>
          )}

          {/* MAINTENANCE TAB */}
          {activeTab === 'maintenance' && (
            <Card title="Configure Maintenance Mode Window" className="text-left text-xs font-sans space-y-4">
              <div className="flex items-center justify-between py-1 border-b border-slate-200/10">
                <div>
                  <h5 className="font-bold text-slate-700 dark:text-slate-200">Enable Maintenance Mode</h5>
                  <p className="text-[10px] text-slate-500 leading-normal">Toggles monitoring metrics checks and alert alarms notification sweeps.</p>
                </div>
                <input
                  type="checkbox"
                  checked={maintEnabled}
                  onChange={e => setMaintEnabled(e.target.checked)}
                  className="cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Maintenance Notes</label>
                <input
                  type="text"
                  value={maintNotes}
                  onChange={e => setMaintNotes(e.target.value)}
                  className="w-full bg-slate-500/5 border border-slate-200/10 p-2 rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Window Duration (Hours)</label>
                <input
                  type="number"
                  value={maintHours}
                  onChange={e => setMaintHours(e.target.value)}
                  className="w-full bg-slate-500/5 border border-slate-200/10 p-2 rounded-lg"
                />
              </div>

              <Button variant="primary" onClick={handleSaveMaintenance} className="w-full text-[10px] py-2">
                Apply Maintenance mode settings
              </Button>
            </Card>
          )}

          {/* AUDIT LOGS TAB */}
          {activeTab === 'audit' && (
            <div className="space-y-3 text-left text-xs">
              {deviceLogs.length === 0 ? (
                <div className="py-8 text-center text-slate-400">No audit events logged for this device.</div>
              ) : (
                deviceLogs.map(l => (
                  <div key={l.id} className="p-3 bg-slate-500/5 border border-slate-200/10 rounded-2xl space-y-1">
                    <div className="flex justify-between font-bold text-slate-800 dark:text-slate-100">
                      <span>{l.action}</span>
                      <span className="font-mono text-[9px] text-slate-500">{new Date(l.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-[10px] text-slate-400">{l.reason || 'Manual user configuration operation.'}</p>
                    <div className="text-[9px] text-slate-500 pt-0.5">Operator: {l.user}</div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* PROVISIONING TASKS TAB */}
          {activeTab === 'tasks' && (
            <div className="space-y-3 text-left text-xs font-semibold">
              {deviceTasks.length === 0 ? (
                <div className="py-8 text-center text-slate-400">No provisioning tasks logs found.</div>
              ) : (
                deviceTasks.map(t => (
                  <div key={t.id} className="p-3.5 bg-slate-500/5 border border-slate-200/10 rounded-2xl space-y-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">{t.name}</h4>
                        <span className="text-[9px] text-slate-500">Deployer: {t.createdBy}</span>
                      </div>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                        t.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                        t.status === 'failed' ? 'bg-rose-500/10 text-rose-500' :
                        'bg-amber-500/10 text-amber-500 animate-pulse'
                      }`}>
                        {t.status}
                      </span>
                    </div>

                    <div className="w-full bg-slate-200 dark:bg-slate-850 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-brand-500 h-full rounded-full" 
                        style={{ width: `${t.progress}%` }} 
                      />
                    </div>

                    <div className="bg-slate-950 border border-slate-900 p-2 rounded font-mono text-[9px] text-slate-400">
                      {`> ${t.logs[t.logs.length - 1]}`}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* NEIGHBOURHOOD TOPOLOGY TAB */}
          {activeTab === 'topology' && (
            <Card title="Logical Topology Neighborhood Link" className="p-4 text-left">
              <div className="flex flex-col items-center justify-center py-6 space-y-4 bg-slate-900/40 border border-slate-200/10 rounded-2xl">
                <div className="flex items-center space-x-8">
                  <div className="p-3 bg-brand-500 text-white rounded-xl font-bold font-mono text-[10px]">
                    CN-FW-01-BORDER
                  </div>
                  <div className="border-t-2 border-dashed border-slate-400 w-12 flex items-center justify-center font-bold text-[8px] text-slate-400">
                    Trunk
                  </div>
                  <div className="p-3 bg-brand-600 text-white rounded-xl font-bold font-mono text-[10px]">
                    {device.name}
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">Device linked via xe-0/0/0 Interface. Link speed: 10 Gbps LACP Aggregate.</p>
              </div>
            </Card>
          )}

        </div>

      </div>
    </Drawer>
  );
};
export default DeviceDetailDrawer;
