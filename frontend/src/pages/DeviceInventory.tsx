import React, { useState, useMemo } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Table } from '../components/Table';
import { Wizard } from '../components/Wizard';
import { DeviceDetailDrawer } from '../components/DeviceDetailDrawer';
import { UniversalConfirmationDialog } from '../components/UniversalConfirmationDialog';
import { StatusBadge, HealthIndicator } from '../components/EnterpriseWidgets';
import { useNetworkStore } from '../contexts/NetworkStoreContext';
import { useAuth } from '../contexts/AuthContext';
import { NetworkDevice, DeviceType, DeviceStatus } from '../types';
import { 
  Plus, Search, Server, Trash2, CheckCircle2, AlertTriangle, 
  XCircle, Settings, Edit3, Shield, Layers, Wifi, Radio, Cpu, RefreshCw, Eye, AlertCircle 
} from 'lucide-react';

export const DeviceInventory: React.FC = () => {
  const { user } = useAuth();
  const { 
    devices, 
    onboardDevice, 
    deleteDevice, 
    restartDevice, 
    backupDeviceConfig 
  } = useNetworkStore();

  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedDevice, setSelectedDevice] = useState<NetworkDevice | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deviceToDelete, setDeviceToDelete] = useState<NetworkDevice | null>(null);
  
  // Onboarding Wizard State
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  
  // Form fields
  const [obType, setObType] = useState<DeviceType>('access_point');
  const [obHostname, setObHostname] = useState('');
  const [obIp, setObIp] = useState('');
  const [obMac, setObMac] = useState('');
  const [obUsername, setObUsername] = useState('admin');
  const [obPassword, setObPassword] = useState('');
  const [obProtocol, setObProtocol] = useState<'SSH' | 'SNMP' | 'NETCONF' | 'REST_API'>('SSH');

  // Connection testing simulations
  const [testProgress, setTestProgress] = useState(0);
  const [testLogs, setTestLogs] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<'pending' | 'testing' | 'success' | 'failed'>('pending');

  const isReadOnly = user?.role === 'Network Engineer';

  // Filter devices list by quick type selectors
  const filteredDevices = useMemo(() => {
    if (selectedType === 'all') return devices;
    return devices.filter(d => d.type === selectedType);
  }, [devices, selectedType]);

  const handleDeviceClick = (device: NetworkDevice) => {
    setSelectedDevice(device);
    setIsDrawerOpen(true);
  };

  const triggerDeleteConfirm = (device: NetworkDevice, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeviceToDelete(device);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (deviceToDelete) {
      await deleteDevice(deviceToDelete.id);
      setIsDeleteOpen(false);
      setDeviceToDelete(null);
      if (selectedDevice && selectedDevice.id === deviceToDelete.id) {
        setIsDrawerOpen(false);
      }
    }
  };

  // --- CONNECTIVITY TEST SIMULATOR ---
  const runConnectivityTest = () => {
    setTestResult('testing');
    setTestProgress(10);
    setTestLogs(['Establishing transport channel...']);

    setTimeout(() => {
      setTestProgress(40);
      setTestLogs(prev => [...prev, `Pinging target IP address ${obIp}... Reachable.`]);
    }, 800);

    setTimeout(() => {
      setTestProgress(75);
      setTestLogs(prev => [...prev, `Connecting via protocol ${obProtocol}... Authentication success.`]);
    }, 1500);

    setTimeout(() => {
      setTestProgress(100);
      setTestLogs(prev => [...prev, 'Device detected: Hardware vendor matching Juniper Networks database.', 'Status OK. Ready to onboard.']);
      setTestResult('success');
    }, 2200);
  };

  // Auto-derived details based on selected type
  const detectedDetails = useMemo(() => {
    const randomSerial = 'JNPR-' + Math.floor(1000 + Math.random() * 9000) + '-' + Math.floor(1000 + Math.random() * 9000);
    switch (obType) {
      case 'firewall':
        return { vendor: 'Juniper Networks', model: 'Juniper SRX340', firmware: 'JunOS 22.4R1', serial: randomSerial, portsCount: 8 };
      case 'core_switch':
        return { vendor: 'Juniper Networks', model: 'Juniper EX4400-24T', firmware: 'JunOS 22.4R1', serial: randomSerial, portsCount: 24 };
      case 'access_switch':
        return { vendor: 'Juniper Networks', model: 'Juniper EX2300-48P', firmware: 'JunOS 21.2R3', serial: randomSerial, portsCount: 48 };
      case 'access_point':
      default:
        return { vendor: 'Juniper Mist', model: 'Juniper Mist AP43', firmware: 'MistOS 0.10.23', serial: randomSerial, portsCount: 2 };
    }
  }, [obType]);

  // Submit onboarding registration
  const handleOnboardFinish = async () => {
    const defaultPorts: Record<string, { enabled: boolean; vlan: number; speed: string; poe?: boolean }> = {};
    for (let i = 0; i < (detectedDetails.portsCount > 8 ? 8 : detectedDetails.portsCount); i++) {
      defaultPorts[`ge${i}`] = { enabled: true, vlan: 10, speed: '1000Mbps', poe: obType !== 'firewall' };
    }

    await onboardDevice({
      name: obHostname || `CN-${obType.toUpperCase().substring(0, 3)}-NEW`,
      type: obType,
      ipAddress: obIp || '10.10.10.99',
      macAddress: obMac || '00:0B:82:FF:EE:DD',
      model: detectedDetails.model,
      version: detectedDetails.firmware,
      status: 'online',
      config: {
        interfaces: defaultPorts,
        ssids: obType === 'access_point' ? ['CampusNet-Corp'] : [],
        firmwareAutoUpdate: true,
        dnsServers: ['1.1.1.1', '8.8.8.8']
      }
    });

    // Reset onboarding form
    setObHostname('');
    setObIp('');
    setObMac('');
    setObPassword('');
    setTestResult('pending');
    setTestProgress(0);
    setTestLogs([]);
  };

  const getDeviceIcon = (type: DeviceType) => {
    switch (type) {
      case 'firewall': return <Shield className="h-5 w-5 text-cyan-400" />;
      case 'core_switch': return <Layers className="h-5 w-5 text-indigo-400" />;
      case 'access_switch': return <Server className="h-5 w-5 text-blue-400" />;
      case 'access_point': return <Wifi className="h-5 w-5 text-emerald-400 animate-pulse" />;
    }
  };

  // Columns configuration for UniversalTable
  const columns = [
    {
      header: 'Device Name',
      accessor: (row: NetworkDevice) => (
        <div className="flex items-center space-x-3 text-left">
          <div className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/40 dark:border-slate-800/40 flex items-center justify-center">
            {getDeviceIcon(row.type)}
          </div>
          <div>
            <span className="font-bold text-slate-800 dark:text-slate-200">{row.name}</span>
            <p className="text-[10px] text-slate-400 font-mono">{row.model}</p>
          </div>
        </div>
      ),
      sortable: true
    },
    {
      header: 'Type',
      accessor: (row: NetworkDevice) => (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 text-slate-500 dark:text-slate-400">
          {row.type.replace('_', ' ')}
        </span>
      ),
      sortable: true,
      filterKey: 'type' as any
    },
    {
      header: 'Status',
      accessor: (row: NetworkDevice) => <StatusBadge status={row.status} />,
      sortable: true,
      filterKey: 'status' as any
    },
    {
      header: 'Management IP',
      accessor: 'ipAddress',
      sortable: true
    },
    {
      header: 'MAC Address',
      accessor: 'macAddress',
      sortable: true
    },
    {
      header: 'Clients',
      accessor: (row: NetworkDevice) => <span className="font-mono font-semibold">{row.clientsCount}</span>,
      sortable: true
    },
    {
      header: 'Actions',
      accessor: (row: NetworkDevice) => (
        <div className="flex items-center gap-1.5 justify-end">
          <Button
            variant="outline"
            onClick={(e) => { e.stopPropagation(); handleDeviceClick(row); }}
            className="p-1 h-8 w-8 flex items-center justify-center"
            title="Inspect Diagnostics"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {!isReadOnly && (
            <Button
              variant="outline"
              onClick={(e) => triggerDeleteConfirm(row, e)}
              className="p-1 h-8 w-8 flex items-center justify-center text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/30"
              title="Decommission Hardware"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
      className: 'text-right'
    }
  ];

  // 5-Step Onboarding steps
  const onboardingSteps = [
    {
      title: 'Select Type',
      content: (
        <div className="space-y-4 text-left">
          <p className="text-xs text-slate-500 font-sans">Choose the hardware node category you wish to claim into your CampusNet AI organization inventory list:</p>
          <div className="grid grid-cols-2 gap-4 pt-2">
            {[
              { type: 'firewall', label: 'Security Firewall', desc: 'Juniper SRX Security gateway', icon: <Shield className="h-6 w-6 text-cyan-400" /> },
              { type: 'core_switch', label: 'Core Switch', desc: 'EX4400 / EX4100 spine switches', icon: <Layers className="h-6 w-6 text-indigo-400" /> },
              { type: 'access_switch', label: 'Access Switch', desc: 'EX2300 Multi-port PoE switches', icon: <Server className="h-6 w-6 text-blue-400" /> },
              { type: 'access_point', label: 'Access Point', desc: 'Juniper Mist Wi-Fi 6 AP43', icon: <Wifi className="h-6 w-6 text-emerald-400" /> }
            ].map(item => (
              <div
                key={item.type}
                onClick={() => setObType(item.type as DeviceType)}
                className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                  obType === item.type 
                    ? 'border-brand-500 bg-brand-500/5 shadow-md' 
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/40 dark:border-slate-800/40 flex items-center justify-center shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">{item.label}</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      title: 'Credentials',
      content: (
        <div className="space-y-4 text-left">
          <p className="text-xs text-slate-500 font-sans">Enter the hostname, management interfaces subnet configuration, and login authentication details:</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hostname</label>
              <input
                type="text"
                placeholder="e.g. CN-AP-04-OFFICE"
                value={obHostname}
                onChange={(e) => setObHostname(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Management IP</label>
              <input
                type="text"
                placeholder="e.g. 10.10.10.25"
                value={obIp}
                onChange={(e) => setObIp(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">MAC Address</label>
              <input
                type="text"
                placeholder="e.g. 00:0B:82:44:D6:25"
                value={obMac}
                onChange={(e) => setObMac(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Protocol</label>
              <select
                value={obProtocol}
                onChange={(e) => setObProtocol(e.target.value as any)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="SSH">SSH Command Line</option>
                <option value="NETCONF">NETCONF XML RPC</option>
                <option value="SNMP">SNMP v3 Telemetry</option>
                <option value="REST_API">REST API HTTPS</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Admin Username</label>
              <input
                type="text"
                value={obUsername}
                onChange={(e) => setObUsername(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Admin Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={obPassword}
                onChange={(e) => setObPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
              />
            </div>
          </div>
        </div>
      ),
      validate: () => {
        if (!obHostname.trim()) return 'Hostname is required.';
        const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
        if (!ipRegex.test(obIp)) return 'Enter a valid management IPv4 Address.';
        const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
        if (!macRegex.test(obMac)) return 'Enter a valid MAC address in format 00:0B:82:XX:XX:XX.';
        if (!obPassword) return 'Password cannot be empty.';
        return true;
      }
    },
    {
      title: 'Connectivity',
      content: (
        <div className="space-y-4 text-left">
          <p className="text-xs text-slate-500 font-sans">Verify the controller can establish communication locks on the device node:</p>
          
          <div className="flex flex-col items-center justify-center p-6 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl bg-slate-500/5 min-h-[160px]">
            {testResult === 'pending' && (
              <Button onClick={runConnectivityTest} className="flex items-center gap-1.5">
                <RefreshCw className="h-4 w-4" /> Start Connectivity Probe
              </Button>
            )}

            {testResult === 'testing' && (
              <div className="w-full space-y-4 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-brand-500 h-full transition-all duration-300" style={{ width: `${testProgress}%` }} />
                </div>
                <p className="text-xs font-semibold text-slate-400 font-mono">Running connection checklist...</p>
              </div>
            )}

            {testResult === 'success' && (
              <div className="w-full space-y-3 text-left">
                <div className="flex items-center gap-2 text-emerald-500 text-xs font-bold font-sans">
                  <CheckCircle2 className="h-5 w-5" /> Connectivity Probe Passed!
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl font-mono text-[10px] text-slate-300 space-y-1">
                  {testLogs.map((log, idx) => (
                    <div key={idx}>{`> ${log}`}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ),
      validate: () => {
        if (testResult !== 'success') return 'You must run and pass the connectivity probe test before proceeding.';
        return true;
      }
    },
    {
      title: 'Auto-Detect',
      content: (
        <div className="space-y-4 text-left">
          <p className="text-xs text-slate-500 font-sans">The probe validated hardware model credentials. Auto-discovered parameters:</p>
          <div className="p-4 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl bg-slate-500/5 space-y-2.5 font-mono text-xs">
            <div className="grid grid-cols-2">
              <span className="text-slate-500">Detected Vendor:</span>
              <span className="text-slate-800 dark:text-slate-200 text-right font-bold">{detectedDetails.vendor}</span>
            </div>
            <div className="grid grid-cols-2">
              <span className="text-slate-500">Node Model:</span>
              <span className="text-slate-800 dark:text-slate-200 text-right font-bold">{detectedDetails.model}</span>
            </div>
            <div className="grid grid-cols-2">
              <span className="text-slate-500">Baseline Firmware:</span>
              <span className="text-slate-800 dark:text-slate-200 text-right font-bold">{detectedDetails.firmware}</span>
            </div>
            <div className="grid grid-cols-2">
              <span className="text-slate-500">Node Serial No:</span>
              <span className="text-slate-800 dark:text-slate-200 text-right font-bold">{detectedDetails.serial}</span>
            </div>
            <div className="grid grid-cols-2">
              <span className="text-slate-500">Interfaces Count:</span>
              <span className="text-slate-800 dark:text-slate-200 text-right font-bold">{detectedDetails.portsCount} GE Ports</span>
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'Provision',
      content: (
        <div className="space-y-4 text-left">
          <p className="text-xs text-slate-500 font-sans">Review claim summary sheet before deploying standard configuration trunks:</p>
          <div className="p-4 border border-rose-500/20 dark:border-rose-500/30 rounded-2xl bg-rose-500/5 flex gap-3 text-xs leading-relaxed text-rose-500 font-sans">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">Provisioning Desired State Notice</p>
              <p className="mt-0.5">Continuing will schedule a background deployment task to bind default management VLAN 10 to ge0 port, assign IP {obIp}, and register this device inside the live topology.</p>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Page Title & Claim Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-left">
          <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white m-0">
            Network Inventory Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Registered hardware and claim portal for Firewalls, Spine Switches, and Wi-Fi Access Points.
          </p>
        </div>
        {!isReadOnly && (
          <Button
            variant="primary"
            onClick={() => setIsOnboardingOpen(true)}
            className="flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Plus className="h-4.5 w-4.5" /> Claim / Onboard Device
          </Button>
        )}
      </div>

      {/* Quick Status Type Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-px overflow-x-auto text-xs shrink-0 select-none">
        {[
          { id: 'all', label: 'All Hardware', count: devices.length },
          { id: 'firewall', label: 'Firewalls', count: devices.filter(d => d.type === 'firewall').length },
          { id: 'core_switch', label: 'Core Switches', count: devices.filter(d => d.type === 'core_switch').length },
          { id: 'access_switch', label: 'Access Switches', count: devices.filter(d => d.type === 'access_switch').length },
          { id: 'access_point', label: 'Access Points', count: devices.filter(d => d.type === 'access_point').length }
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setSelectedType(item.id)}
            className={`px-4 py-2 border-b-2 font-bold transition-all shrink-0 cursor-pointer ${
              selectedType === item.id 
                ? 'border-brand-500 text-brand-500 font-bold' 
                : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium'
            }`}
          >
            {item.label} <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900 text-[9px] text-slate-500">{item.count}</span>
          </button>
        ))}
      </div>

      {/* UniversalTable Rendering */}
      <Card className="p-0 overflow-hidden">
        <Table
          columns={columns}
          data={filteredDevices}
          searchKeys={['name', 'ipAddress', 'macAddress', 'model']}
          searchPlaceholder="Search by name, model, IP or MAC address..."
          defaultSortField="name"
          onRowClick={handleDeviceClick}
        />
      </Card>

      {/* Slide-out Device Details Drawer */}
      <DeviceDetailDrawer
        device={selectedDevice}
        isOpen={isDrawerOpen}
        onClose={() => { setIsDrawerOpen(false); setSelectedDevice(null); }}
      />

      {/* Onboarding Wizard Modal */}
      <Wizard
        isOpen={isOnboardingOpen}
        onClose={() => { setIsOnboardingOpen(false); setTestResult('pending'); }}
        title="Hardware Node Onboarding Portal"
        steps={onboardingSteps}
        onFinish={handleOnboardFinish}
        finishText="Onboard & Claim Device"
      />

      {/* Confirmation Dialog for decommissioning */}
      <UniversalConfirmationDialog
        isOpen={isDeleteOpen}
        onClose={() => { setIsDeleteOpen(false); setDeviceToDelete(null); }}
        title="Confirm Hardware Decommission"
        message={`You are about to decommission the network device node "${deviceToDelete?.name}". This action will drop active client sessions, sever topology links, and format configurations settings!`}
        confirmText={deviceToDelete?.name || ''}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
