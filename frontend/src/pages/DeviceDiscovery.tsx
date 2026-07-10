import React, { useState, useMemo } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Table } from '../components/Table';
import { StatusBadge } from '../components/EnterpriseWidgets';
import { useNetworkStore } from '../contexts/NetworkStoreContext';
import { useAuth } from '../contexts/AuthContext';
import { Server, Search, CheckCircle, Plus, AlertCircle, RefreshCw, Terminal, CheckCircle2 } from 'lucide-react';

export const DeviceDiscovery: React.FC = () => {
  const { user } = useAuth();
  const { discoveredDevices, onboardDiscoveredDevices, runProvisioningTask } = useNetworkStore();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [hasScanned, setHasScanned] = useState(true); // Default has seeded discovered items
  const [isImporting, setIsImporting] = useState(false);

  const isReadOnly = user?.role === 'Network Engineer';

  // Toggle selection
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === discoveredDevices.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(discoveredDevices.map(d => d.id));
    }
  };

  // Scan network
  const handleScan = async () => {
    setIsScanning(true);
    setScanLogs(['Initializing ARP ping sweeps targeting 10.10.10.0/24...']);
    setSelectedIds([]);
    
    await new Promise(r => setTimeout(r, 800));
    setScanLogs(prev => [...prev, 'ARP broadcast sweeps completed. Discovered 3 active hosts responding on network Layer 2.', 'Opening SNMP queries to fetch device descriptions...']);
    
    await new Promise(r => setTimeout(r, 1000));
    setScanLogs(prev => [...prev, 'SNMP queries succeeded. Retreiving MIB descriptions and host capabilities...', 'Correlating configuration collectors: SSH and NETCONF availability verified.', 'Scan complete. Discovered 3 pending network nodes.']);
    
    setIsScanning(false);
    setHasScanned(true);
  };

  // Import / Claim Onboard selected
  const handleImport = async () => {
    if (selectedIds.length === 0 || isReadOnly) return;
    setIsImporting(true);
    try {
      await onboardDiscoveredDevices(selectedIds);
      setSelectedIds([]);
    } finally {
      setIsImporting(false);
    }
  };

  // Helper mapping of capabilities based on deviceType
  const getDetectedCapabilities = (type: string) => {
    switch (type) {
      case 'firewall':
        return {
          caps: ['NAT', 'VPN', 'DHCP', 'Firewall Policies'],
          collector: 'SSH',
          vendor: 'Juniper Networks',
          model: 'Juniper SRX340'
        };
      case 'core_switch':
      case 'access_switch':
        return {
          caps: ['Routing', 'VLAN', 'QoS', 'PoE'],
          collector: 'NETCONF',
          vendor: 'Juniper Networks',
          model: 'Juniper EX4100-48P'
        };
      case 'access_point':
      default:
        return {
          caps: ['Radio Config', 'SSID Broadcaster', 'Firmware Updates'],
          collector: 'SSH / SNMP',
          vendor: 'Juniper Standalone AP',
          model: 'Enterprise AP'
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-left">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-brand-500/10 dark:bg-brand-500/20 text-brand-500 rounded-xl flex items-center justify-center">
            <Search className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white m-0">
              Zero-Touch Device Discovery
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Scan organization IP subnets to auto-detect hardware nodes, features capability profiles, and onboard them into inventory.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleScan} isLoading={isScanning} className="flex items-center gap-1.5">
            <RefreshCw className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} /> Scan Network
          </Button>
          {!isReadOnly && (
            <Button 
              variant="primary" 
              onClick={handleImport} 
              disabled={selectedIds.length === 0} 
              isLoading={isImporting}
              className="flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Onboard Selected ({selectedIds.length})
            </Button>
          )}
        </div>
      </div>

      {/* Active Scan logs console */}
      {scanLogs.length > 0 && (
        <Card className="text-left p-4 bg-slate-950 border border-slate-800 rounded-2xl">
          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 font-sans">
            <span>Network discovery process trace console</span>
            <button onClick={() => setScanLogs([])} className="hover:text-white">Clear log console</button>
          </div>
          <div className="font-mono text-[10px] text-emerald-400 space-y-1">
            {scanLogs.map((log, idx) => (
              <div key={idx}>{`[${new Date().toLocaleTimeString()}] > ${log}`}</div>
            ))}
          </div>
        </Card>
      )}

      {/* Discovery Results Table */}
      <Card noPadding className="text-left">
        {!hasScanned ? (
          <div className="py-20 text-center space-y-3">
            <Search className="h-10 w-10 text-slate-400 mx-auto opacity-75" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No active scan performed.</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">Click "Scan Network" above to run an SNMP ping sweep mapping the site gateway subnet segment.</p>
          </div>
        ) : discoveredDevices.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto opacity-80" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 font-display">Subnet is fully mapped</p>
            <p className="text-xs text-slate-400">All discovered hardware nodes have already been claimed into active inventory.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200/50 dark:divide-slate-800/50 text-xs">
              <thead className="bg-slate-50/50 dark:bg-slate-900/50">
                <tr>
                  <th className="px-4 py-3 text-left w-10">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.length === discoveredDevices.length} 
                      onChange={handleToggleSelectAll}
                      className="cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 text-slate-400 text-left font-semibold">Hostname</th>
                  <th className="px-4 py-3 text-slate-400 text-left font-semibold">Discovery IP</th>
                  <th className="px-4 py-3 text-slate-400 text-left font-semibold">MAC Address</th>
                  <th className="px-4 py-3 text-slate-400 text-left font-semibold">Device Profile</th>
                  <th className="px-4 py-3 text-slate-400 text-left font-semibold">Detected Capabilities</th>
                  <th className="px-4 py-3 text-slate-400 text-left font-semibold">Recommended Collector</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/40 dark:divide-slate-800/40 bg-transparent text-slate-700 dark:text-slate-300">
                {discoveredDevices.map(d => {
                  const capInfo = getDetectedCapabilities(d.deviceType);
                  const isChecked = selectedIds.includes(d.id);
                  return (
                    <tr key={d.id} className="hover:bg-slate-500/5">
                      <td className="px-4 py-3">
                        <input 
                          type="checkbox" 
                          checked={isChecked} 
                          onChange={() => handleToggleSelect(d.id)}
                          className="cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold">{d.hostname}</td>
                      <td className="px-4 py-3 font-mono font-semibold">{d.ipAddress}</td>
                      <td className="px-4 py-3 font-mono">{d.macAddress}</td>
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{capInfo.vendor}</span>
                          <span className="block text-[10px] text-slate-400">{capInfo.model} | {d.firmware}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {capInfo.caps.map((cap, idx) => (
                            <span key={idx} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider">
                              {cap}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-brand-500">{capInfo.collector}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
export default DeviceDiscovery;
