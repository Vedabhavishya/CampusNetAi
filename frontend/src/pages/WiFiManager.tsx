import React, { useState, useMemo } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Table } from '../components/Table';
import { Wizard } from '../components/Wizard';
import { StatusBadge } from '../components/EnterpriseWidgets';
import { useNetworkStore } from '../contexts/NetworkStoreContext';
import { useAuth } from '../contexts/AuthContext';
import { SsidConfig, NetworkDevice } from '../types';
import { Radio, Plus, Trash2, Edit3, Wifi, WifiOff, ShieldAlert, CheckCircle, Info } from 'lucide-react';

export const WiFiManager: React.FC = () => {
  const { user } = useAuth();
  const { 
    ssids, 
    saveSsid, 
    deleteSsid, 
    vlans, 
    devices 
  } = useNetworkStore();

  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingSsidId, setEditingSsidId] = useState<string | null>(null);

  // --- WIZARD FORM STATES ---
  // Step 1: Basic
  const [ssidName, setSsidName] = useState('');
  const [securityType, setSecurityType] = useState<SsidConfig['securityType']>('WPA3-Personal');
  const [passphrase, setPassphrase] = useState('SecretPassword123');
  const [broadcastEnabled, setBroadcastEnabled] = useState(true);
  
  // Step 2: Radios
  const [band, setBand] = useState<SsidConfig['band']>('Dual');
  const [channelWidth, setChannelWidth] = useState<'20MHz' | '40MHz' | '80MHz'>('80MHz');
  const [bandSteering, setBandSteering] = useState(true);
  
  // Step 3: APs
  const [associatedAps, setAssociatedAps] = useState<string[]>([]);
  
  // Step 4: Network & Limits
  const [vlanId, setVlanId] = useState(20);
  const [portalEnabled, setPortalEnabled] = useState(false);
  const [maxClients, setMaxClients] = useState(250);
  const [rateLimitRx, setRateLimitRx] = useState(100);
  const [rateLimitTx, setRateLimitTx] = useState(50);
  const [clientIsolation, setClientIsolation] = useState(false);

  const isReadOnly = user?.role === 'Network Engineer';

  // Load list of available APs to assign SSID to
  const accessPoints = useMemo(() => {
    return devices.filter(d => d.type === 'access_point' && d.status === 'online');
  }, [devices]);

  const handleToggleSsid = async (row: SsidConfig) => {
    await saveSsid({
      ...row,
      status: row.status === 'active' ? 'inactive' : 'active'
    });
  };

  const handleEditClick = (ssid: SsidConfig) => {
    setEditingSsidId(ssid.id);
    
    // Prefill form
    setSsidName(ssid.ssid);
    setSecurityType(ssid.securityType);
    setBand(ssid.band);
    setVlanId(ssid.vlanId);
    setMaxClients(ssid.maxClients);
    setPortalEnabled(ssid.portalEnabled);
    setRateLimitRx(ssid.rateLimitRx || 100);
    setRateLimitTx(ssid.rateLimitTx || 50);
    
    // Load associated APs (APs broadcasting this SSID)
    const associated = devices
      .filter(d => d.type === 'access_point' && d.config.ssids?.includes(ssid.ssid))
      .map(d => d.id);
    setAssociatedAps(associated);

    setIsWizardOpen(true);
  };

  const handleAddClick = () => {
    setEditingSsidId(null);
    
    // Default form
    setSsidName('');
    setSecurityType('WPA3-Personal');
    setPassphrase('SecretPassword123');
    setBand('Dual');
    setVlanId(20);
    setMaxClients(250);
    setPortalEnabled(false);
    setRateLimitRx(100);
    setRateLimitTx(50);
    setAssociatedAps(accessPoints.map(ap => ap.id)); // Select all active by default

    setIsWizardOpen(true);
  };

  const handleDeleteSsid = async (id: string) => {
    if (confirm('Delete and terminate this WiFi SSID broadcast across all AP cells?')) {
      await deleteSsid(id);
    }
  };

  // Submit Wi-Fi wizard creation
  const handleWizardFinish = async () => {
    const ssidData: SsidConfig = {
      id: editingSsidId || '',
      ssid: ssidName,
      securityType,
      band,
      vlanId: Number(vlanId),
      clientsCount: editingSsidId ? (ssids.find(s => s.id === editingSsidId)?.clientsCount || 0) : 0,
      maxClients: Number(maxClients),
      portalEnabled,
      rateLimitRx: Number(rateLimitRx),
      rateLimitTx: Number(rateLimitTx),
      status: 'active'
    };

    await saveSsid(ssidData);
  };

  // AP selection helper
  const toggleApAssociation = (apId: string) => {
    setAssociatedAps(prev => 
      prev.includes(apId) ? prev.filter(id => id !== apId) : [...prev, apId]
    );
  };

  const columns = [
    {
      header: 'SSID (WiFi Network)',
      accessor: (row: SsidConfig) => (
        <div className="flex items-center space-x-3 text-left">
          <div className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/40 dark:border-slate-800/40 flex items-center justify-center">
            <Radio className="h-4.5 w-4.5 text-cyan-400" />
          </div>
          <div>
            <span className="font-bold text-slate-800 dark:text-slate-200">{row.ssid}</span>
            <p className="text-[10px] text-slate-400 font-semibold">{row.securityType}</p>
          </div>
        </div>
      ),
      sortable: true
    },
    {
      header: 'Band Settings',
      accessor: 'band',
      sortable: true,
      filterKey: 'band' as any
    },
    {
      header: 'Assigned VLAN',
      accessor: (row: SsidConfig) => (
        <span className="font-mono bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded text-xs font-semibold text-slate-600 dark:text-slate-300">
          VLAN {row.vlanId}
        </span>
      ),
      sortable: true
    },
    {
      header: 'Broadcast State',
      accessor: (row: SsidConfig) => <StatusBadge status={row.status} />,
      sortable: true,
      filterKey: 'status' as any
    },
    {
      header: 'Clients count',
      accessor: (row: SsidConfig) => <span className="font-mono font-semibold">{row.clientsCount}</span>,
      sortable: true
    },
    {
      header: 'Rate Limits',
      accessor: (row: SsidConfig) => (
        <span className="text-xs text-slate-500 font-mono">
          {row.rateLimitRx ? `↓${row.rateLimitRx}M / ↑${row.rateLimitTx}M` : 'Unlimited'}
        </span>
      )
    },
    {
      header: 'Actions',
      accessor: (row: SsidConfig) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="outline"
            disabled={isReadOnly}
            onClick={() => handleToggleSsid(row)}
            className="text-[10px] py-1 px-2.5 font-bold"
          >
            {row.status === 'active' ? 'Suspend' : 'Activate'}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleEditClick(row)}
            className="p-1 h-8 w-8 flex items-center justify-center"
            title="Edit Network config"
          >
            <Edit3 className="h-4 w-4" />
          </Button>
          {!isReadOnly && (
            <Button
              variant="ghost"
              onClick={() => handleDeleteSsid(row.id)}
              className="p-1 h-8 w-8 flex items-center justify-center text-rose-500 hover:text-rose-700"
              title="Delete WiFi SSID"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
      className: 'text-right'
    }
  ];

  // Wizard Steps configs
  const wifiSteps = [
    {
      title: 'Basic Settings',
      content: (
        <div className="space-y-4 text-left font-sans">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">SSID Name (Broadcast SSID)</label>
            <input
              type="text"
              placeholder="e.g. CampusNet-Student"
              value={ssidName}
              onChange={(e) => setSsidName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Security profile</label>
              <select
                value={securityType}
                onChange={(e) => setSecurityType(e.target.value as any)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
              >
                <option value="WPA3-Personal">WPA3 Personal (PSK)</option>
                <option value="WPA2-Personal">WPA2 Personal (PSK)</option>
                <option value="WPA3-Enterprise">WPA3 Enterprise (802.1X)</option>
                <option value="Open">Open Network</option>
              </select>
            </div>
            {securityType !== 'Open' && (
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">WPA Pre-Shared Key</label>
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono"
                />
              </div>
            )}
          </div>
          <div className="flex gap-4 pt-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={broadcastEnabled}
                onChange={(e) => setBroadcastEnabled(e.target.checked)}
                className="text-brand-500"
              />
              Broadcast SSID Beacon
            </label>
          </div>
        </div>
      ),
      validate: () => {
        if (!ssidName.trim()) return 'SSID Name is required.';
        if (ssidName.length < 3) return 'SSID must be at least 3 characters.';
        if (securityType !== 'Open' && passphrase.length < 8) return 'Pre-Shared key must be at least 8 characters.';
        return true;
      }
    },
    {
      title: 'Radio Settings',
      content: (
        <div className="space-y-4 text-left font-sans">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Band selection</label>
              <select
                value={band}
                onChange={(e) => setBand(e.target.value as any)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
              >
                <option value="Dual">Dual-Band (2.4GHz + 5GHz)</option>
                <option value="Tri-Band">Tri-Band (2.4GHz + 5GHz + 6GHz)</option>
                <option value="5GHz">5GHz Only</option>
                <option value="2.4GHz">2.4GHz Only</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Channel Width</label>
              <select
                value={channelWidth}
                onChange={(e) => setChannelWidth(e.target.value as any)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
              >
                <option value="20MHz">20 MHz (High Density)</option>
                <option value="40MHz">40 MHz (Standard)</option>
                <option value="80MHz">80 MHz (High Throughput)</option>
              </select>
            </div>
          </div>
          <div className="flex gap-4 pt-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={bandSteering}
                onChange={(e) => setBandSteering(e.target.checked)}
                className="text-brand-500"
              />
              Enable Band Steering (Push clients to 5GHz)
            </label>
          </div>
        </div>
      )
    },
    {
      title: 'Assign APs',
      content: (
        <div className="space-y-3 text-left font-sans">
          <p className="text-xs text-slate-500">Select which active indoor/outdoor Access Points will broadcast this SSID profile:</p>
          {accessPoints.length === 0 ? (
            <p className="text-xs text-amber-500 font-semibold py-4">No online Access Points available in inventory. The SSID will be stored but not broadcasted.</p>
          ) : (
            <div className="space-y-2.5 pt-2">
              {accessPoints.map(ap => (
                <div
                  key={ap.id}
                  onClick={() => toggleApAssociation(ap.id)}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    associatedAps.includes(ap.id)
                      ? 'border-brand-500 bg-brand-500/5'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Wifi className="h-4 w-4 text-slate-400" />
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{ap.name}</span>
                      <p className="text-[10px] text-slate-400">{ap.model} | IP: {ap.ipAddress}</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={associatedAps.includes(ap.id)}
                    onChange={() => {}} // handled by click container
                    className="text-brand-500"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ),
      validate: () => {
        if (accessPoints.length > 0 && associatedAps.length === 0) {
          return 'Please select at least one Access Point node to broadcast this WiFi.';
        }
        return true;
      }
    },
    {
      title: 'Limits & Network',
      content: (
        <div className="space-y-4 text-left font-sans">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Assign VLAN Profile</label>
              <select
                value={vlanId}
                onChange={(e) => setVlanId(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
              >
                {vlans.map(v => (
                  <option key={v.id} value={v.id}>{v.id} - {v.name} ({v.subnet})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Max Clients limit</label>
              <input
                type="number"
                value={maxClients}
                onChange={(e) => setMaxClients(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Download Limit (Rx Mbps)</label>
              <input
                type="number"
                value={rateLimitRx}
                onChange={(e) => setRateLimitRx(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Upload Limit (Tx Mbps)</label>
              <input
                type="number"
                value={rateLimitTx}
                onChange={(e) => setRateLimitTx(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
              />
            </div>
          </div>

          <div className="flex gap-4 pt-1">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={portalEnabled}
                onChange={(e) => setPortalEnabled(e.target.checked)}
                className="text-brand-500"
              />
              Enable Captive Guest Portal
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={clientIsolation}
                onChange={(e) => setClientIsolation(e.target.checked)}
                className="text-brand-500"
              />
              Client Isolation (Drop P2P traffic)
            </label>
          </div>
        </div>
      )
    },
    {
      title: 'Summary',
      content: (
        <div className="space-y-4 text-left">
          <p className="text-xs text-slate-500">Review desired configuration parameters before scheduling the deployment task:</p>
          <div className="p-4 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl bg-slate-500/5 space-y-2.5 font-mono text-xs">
            <div className="grid grid-cols-2">
              <span className="text-slate-500">SSID Name:</span>
              <span className="text-slate-800 dark:text-slate-200 text-right font-bold">{ssidName}</span>
            </div>
            <div className="grid grid-cols-2">
              <span className="text-slate-500">Security Mode:</span>
              <span className="text-slate-800 dark:text-slate-200 text-right font-bold">{securityType}</span>
            </div>
            <div className="grid grid-cols-2">
              <span className="text-slate-500">Bound VLAN:</span>
              <span className="text-slate-800 dark:text-slate-200 text-right font-bold">VLAN {vlanId}</span>
            </div>
            <div className="grid grid-cols-2">
              <span className="text-slate-500">Target Radios:</span>
              <span className="text-slate-800 dark:text-slate-200 text-right font-bold">{band} ({channelWidth})</span>
            </div>
            <div className="grid grid-cols-2">
              <span className="text-slate-500">AP Node Targets:</span>
              <span className="text-brand-500 text-right font-bold">{associatedAps.length} active cells</span>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-left">
        <div>
          <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white m-0">
            Wireless Network (SSID) Profiles
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure enterprise SSID Wi-Fi, radio band priorities, and client rate limiters.
          </p>
        </div>
        {!isReadOnly && (
          <Button
            variant="primary"
            onClick={handleAddClick}
            className="flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Plus className="h-4.5 w-4.5" /> Create Wireless SSID
          </Button>
        )}
      </div>

      {/* SSID List Table */}
      <Card className="p-0 overflow-hidden">
        <Table
          columns={columns}
          data={ssids}
          searchKeys={['ssid', 'securityType', 'band']}
          searchPlaceholder="Search SSID name, security type, or band..."
          defaultSortField="ssid"
        />
      </Card>

      {/* Multi-step SSID configuration Wizard */}
      <Wizard
        isOpen={isWizardOpen}
        onClose={() => { setIsWizardOpen(false); setEditingSsidId(null); }}
        title={editingSsidId ? "Modify WiFi network config" : "Create Enterprise WiFi Network"}
        steps={wifiSteps}
        onFinish={handleWizardFinish}
        finishText={editingSsidId ? "Apply Modifications" : "Deploy WiFi Network"}
      />
    </div>
  );
};
