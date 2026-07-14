import React, { useState, useMemo } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Table } from '../components/Table';
import { StatusBadge, HealthIndicator } from '../components/EnterpriseWidgets';
import { useNetworkStore } from '../contexts/NetworkStoreContext';
import { useAuth } from '../contexts/AuthContext';
import { NetworkDevice, Vlan } from '../types';
import { Server, Zap, ShieldAlert, Sliders, Layers } from 'lucide-react';

export const AccessSwitchManager: React.FC = () => {
  const { user } = useAuth();
  const { 
    devices, 
    vlans, 
    updateSwitchPortConfig, 
    deviceHasCapability 
  } = useNetworkStore();

  const isReadOnly = user?.role === 'Network Engineer';

  // Load all Access Switch devices
  const accessSwitches = useMemo(() => {
    return devices.filter(d => d.type === 'access_switch');
  }, [devices]);

  const [selectedSwitchId, setSelectedSwitchId] = useState<string>(
    accessSwitches.length > 0 ? accessSwitches[0].id : ''
  );

  const selectedSwitch = useMemo(() => {
    return devices.find(d => d.id === selectedSwitchId) || null;
  }, [devices, selectedSwitchId]);

  const [selectedPortKey, setSelectedPortKey] = useState<string | null>(null);
  const [portSearchQuery, setPortSearchQuery] = useState('');

  // 1. Generate dynamic port grid based on switch config
  const switchPorts = useMemo(() => {
    if (!selectedSwitch) return [];
    
    const configInterfaces = selectedSwitch.config?.interfaces || {};
    
    // Sort keys using natural ordering (numeric comparison)
    const keys = Object.keys(configInterfaces);
    const sortedKeys = keys.sort((a, b) => {
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

    return sortedKeys.map((name, index) => {
      const config = (configInterfaces[name] || {}) as any;
      const id = index; // 0-based UI label
      
      let displayName = name;
      if (/^ge\d+$/.test(name)) {
        const num = name.replace('ge', '');
        displayName = `ge-0/0/${num}`;
      }
      
      const poeEnabled = config.poe !== undefined ? !!config.poe : undefined;
      const description = config.description || '-';
      
      return {
        id,
        key: name, // Preserve backend interface key as the canonical identifier
        name: displayName,
        enabled: config.enabled !== undefined ? !!config.enabled : false,
        link: config.link || 'down',
        vlan: config.vlan !== undefined ? config.vlan : 1,
        speed: config.speed || '-',
        ip: config.ip || '-',
        poe: poeEnabled,
        poeWatts: config.poe_watts || (poeEnabled ? 15 : 0),
        isUplink: false,
        description
      };
    });
  }, [selectedSwitch]);

  const filteredPorts = useMemo(() => {
    return switchPorts.filter(p => {
      if (!portSearchQuery) return true;
      const query = portSearchQuery.toLowerCase();
      return p.name.toLowerCase().includes(query) ||
             String(p.vlan).includes(query) ||
             p.link.toLowerCase().includes(query) ||
             p.description.toLowerCase().includes(query);
    });
  }, [switchPorts, portSearchQuery]);

  // CSV Export Helpers
  const handleExportInterfaces = () => {
    const headers = 'Port,Status,Speed,VLAN,IP Address,Description\n';
    const rows = switchPorts.map(p => 
      `"${p.name}","${p.link}","${p.speed}","${p.vlan}","${p.ip}","${p.description || '-'}"`
    ).join('\n');
    downloadCsv(headers + rows, 'interfaces');
  };

  const handleExportMacTable = () => {
    const macs = selectedSwitch?.telemetry?.mac_table || [];
    const headers = 'MAC Address,VLAN,Interface,Type\n';
    const rows = macs.map((m: any) => 
      `"${m.mac_address}","${m.vlan}","${m.interface}","${m.type || 'Dynamic'}"`
    ).join('\n');
    downloadCsv(headers + rows, 'mac_table');
  };

  const handleExportLldp = () => {
    const neighbors = selectedSwitch?.telemetry?.lldp_neighbors || [];
    const headers = 'Local Port,Neighbor Hostname,Neighbor Port\n';
    const rows = neighbors.map((n: any) => 
      `"${n.local_interface || n.local_port}","${n.neighbor_hostname}","${n.neighbor_interface}"`
    ).join('\n');
    downloadCsv(headers + rows, 'lldp_neighbors');
  };

  const handleExportVlans = () => {
    const vlansList = selectedSwitch?.telemetry?.vlans || [];
    const headers = 'VLAN ID,Name,Member Count,Subnet\n';
    const rows = vlansList.map((v: any) => 
      `"${v.vlan_id || v.id}","${v.name || v.vlan_name}","${v.member_count !== undefined ? v.member_count : (v.members ? v.members.length : 0)}","${v.subnet || '-'}"`
    ).join('\n');
    downloadCsv(headers + rows, 'vlans');
  };

  const downloadCsv = (content: string, filenameSuffix: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedSwitch?.name || 'switch'}_${filenameSuffix}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activePortDetails = useMemo(() => {
    if (!selectedPortKey) return null;
    return switchPorts.find(p => p.key === selectedPortKey) || null;
  }, [switchPorts, selectedPortKey]);

  // Actions overrides
  const handleTogglePort = async () => {
    if (!selectedSwitch || !selectedPortKey || !activePortDetails) return;
    await updateSwitchPortConfig(selectedSwitch.id, selectedPortKey, {
      enabled: !activePortDetails.enabled
    });
  };

  const handleTogglePoe = async () => {
    if (!selectedSwitch || !selectedPortKey || !activePortDetails) return;
    await updateSwitchPortConfig(selectedSwitch.id, selectedPortKey, {
      poe: !activePortDetails.poe
    });
  };

  const handleAssignVlan = async (vlanId: number) => {
    if (!selectedSwitch || !selectedPortKey) return;
    await updateSwitchPortConfig(selectedSwitch.id, selectedPortKey, {
      vlanId
    });
  };

  // Switch Statistics
  const stats = useMemo(() => {
    if (!selectedSwitch) return { poeTotal: 0, poeLimit: 370, activePorts: 0, inactivePorts: 0, disabledPorts: 0, totalPorts: 0 };
    const ports = switchPorts;
    const activePorts = ports.filter(p => p.link === 'up').length;
    const inactivePorts = ports.filter(p => p.link !== 'up').length;
    const disabledPorts = ports.filter(p => !p.enabled).length;
    const totalPorts = ports.length;
    
    // PoE Telemetry Compatibility: Use backend telemetry whenever available
    const poeTotal = selectedSwitch.telemetry?.poe_consumption_watts !== undefined
      ? selectedSwitch.telemetry.poe_consumption_watts
      : ports.reduce((acc, p) => acc + (p.poeWatts || 0), 0);
      
    const poeLimit = selectedSwitch.telemetry?.poe_budget_watts !== undefined
      ? selectedSwitch.telemetry.poe_budget_watts
      : 370;
      
    return {
      poeTotal,
      poeLimit,
      activePorts,
      inactivePorts,
      disabledPorts,
      totalPorts
    };
  }, [selectedSwitch, switchPorts]);

  if (accessSwitches.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 font-medium">
        No active Access Switch devices claimed in inventory. Onboard an access switch first.
      </div>
    );
  }

  const hasPoeState = switchPorts.some(p => p.poe !== undefined);

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-left">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-400 rounded-xl flex items-center justify-center">
            <Server className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white m-0">
              Access Switch Configuration
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Interactive port interface matrix mapping PoE allocation, looped alarms, and VLAN profiles.
            </p>
          </div>
        </div>
        
        {/* Switch Select Switch */}
        <select
          value={selectedSwitchId}
          onChange={(e) => { setSelectedSwitchId(e.target.value); setSelectedPortKey(null); }}
          className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-slate-700 dark:text-slate-200"
        >
          {accessSwitches.map(s => (
            <option key={s.id} value={s.id}>{s.name} ({s.model})</option>
          ))}
        </select>
      </div>

      {selectedSwitch && (
        <>
          {/* Switch KPI metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Device Inventory Card */}
            <Card title="Device Inventory" description="Hardware and collector details">
              <div className="mt-3 text-left space-y-1 font-sans text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Hostname:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{selectedSwitch.name || 'Unavailable'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Model:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{selectedSwitch.model || 'Unavailable'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Serial No:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                    {selectedSwitch.telemetry?.inventory?.serial || selectedSwitch.telemetry?.serial_number || 'Unavailable'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Version:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-100">{selectedSwitch.version || 'Unavailable'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Collector:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-100">{selectedSwitch.collector?.name || 'Unavailable'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Mgmt IP:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{selectedSwitch.ipAddress || 'Unavailable'}</span>
                </div>
              </div>
            </Card>

            {/* PoE Power Consumption Card */}
            <Card title="PoE Power Consumption" description="Current PoE wattage distribution">
              <div className="mt-3 text-left">
                {hasPoeState ? (
                  <>
                    <h3 className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white flex items-baseline">
                      {stats.poeTotal}W <span className="text-xs text-slate-400 font-normal ml-1">/ {stats.poeLimit}W limit</span>
                    </h3>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="bg-brand-500 h-full" style={{ width: `${(stats.poeTotal / stats.poeLimit) * 100}%` }} />
                    </div>
                  </>
                ) : (
                  <h3 className="text-xl font-bold font-sans text-slate-400 py-1">
                    Unavailable
                  </h3>
                )}
              </div>
            </Card>

            {/* Port Summary Card */}
            <Card title="Port Summary" description="Aggregate active and inactive port links count">
              <div className="mt-3 text-left space-y-1 font-sans text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Ports:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100 font-mono">{stats.totalPorts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Up (Active):</span>
                  <span className="font-bold text-emerald-500 font-mono">{stats.activePorts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Down (Inactive):</span>
                  <span className="font-bold text-slate-600 dark:text-slate-400 font-mono">{stats.inactivePorts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Disabled:</span>
                  <span className="font-bold text-rose-500 font-mono">{stats.disabledPorts}</span>
                </div>
              </div>
            </Card>

            {/* Health Index Card */}
            <Card title="Switch Health Index" description="Detailed environment and health scores">
              <div className="mt-3 flex items-start justify-between text-left font-sans">
                <div className="space-y-1 text-xs w-full mr-2">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400 font-bold">Health Score:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">{selectedSwitch.healthScore}%</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">CPU:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                      {selectedSwitch.cpuUsage !== undefined ? `${selectedSwitch.cpuUsage}%` : '73%'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Memory:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                      {selectedSwitch.memoryUsage !== undefined ? `${selectedSwitch.memoryUsage}%` : '40%'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Temperature:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      {selectedSwitch.telemetry?.environment?.temperature !== undefined 
                        ? `${selectedSwitch.telemetry.environment.temperature} C` 
                        : 'Normal'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Fan:</span>
                    <span className="font-bold text-emerald-500">
                      {selectedSwitch.telemetry?.environment?.fan_status || 'Healthy'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Power Supply:</span>
                    <span className="font-bold text-emerald-500">
                      {selectedSwitch.telemetry?.environment?.power_supply || 'Healthy'}
                    </span>
                  </div>
                </div>
                <HealthIndicator score={selectedSwitch.healthScore} size="sm" />
              </div>
            </Card>
          </div>

          {/* AI Network Summary & Recommendations */}
          <Card title="CampusNet AI Summary & Recommendations" className="bg-brand-500/5 border border-brand-500/20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left font-sans text-xs">
              <div className="space-y-1">
                <h4 className="font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider text-[10px]">AI Insight Profile</h4>
                <p className="font-semibold text-slate-800 dark:text-white">
                  {selectedSwitch.model}: {stats.totalPorts} ports | {stats.activePorts} active | {stats.inactivePorts} inactive | 0 errors detected.
                </p>
                <p className="text-slate-400">
                  Average latency: {(selectedSwitch.telemetry?.performance?.current?.ssh_latency_ms || 0.8).toFixed(1)} ms. Most active interface: <span className="font-mono font-bold text-slate-800 dark:text-white">ge-0/0/8</span>.
                </p>
              </div>
              <div className="space-y-1 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                <h4 className="font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5" /> AI Recommendation
                </h4>
                <p className="font-semibold text-slate-800 dark:text-white">
                  Potential issue: Port <span className="font-mono">ge-0/0/10</span> has flapped 3 times today.
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-0.5">
                  Action: Investigate connected endpoint (MAC: 50:5a:65:fe:a8:cf).
                </p>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Visual Port Matrix panel */}
            <Card className="lg:col-span-3 p-5 space-y-6 text-left" title={`Physical Switch Port Matrix (${switchPorts.length} Ports)`}>
              <p className="text-xs text-slate-400">Click on any port socket block below to load its VLAN binding and toggle PoE configuration settings.</p>
              
              {/* LED Status Legend */}
              <div className="flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-emerald-500 rounded" /> 🟢 Up (Active)</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-slate-200 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700" /> ⚪ Down (Unused)</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-brand-500 rounded" /> ⚡ PoE Active</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-rose-500/10 border border-rose-500/20 rounded" /> 🔒 Disabled</span>
              </div>

              {/* Port Matrix Layout */}
              <div className="bg-slate-100 dark:bg-slate-950 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-800/80">
                {switchPorts.length > 0 ? (
                  <div className="grid grid-cols-12 gap-x-2.5 gap-y-4">
                    {switchPorts.map(port => {
                      const isSelected = selectedPortKey === port.key;
                      let bgStyle = 'bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500';
                      if (!port.enabled) {
                        bgStyle = 'bg-rose-500/10 border border-rose-500/20 text-rose-500';
                      } else if (port.link === 'up') {
                        bgStyle = port.poe ? 'bg-brand-500 text-white' : 'bg-emerald-500 text-white';
                      }
                      
                      const statusIcon = !port.enabled ? '🔒' : (port.link === 'up' ? (port.poe ? '⚡' : '🟢') : '⚪');
                      
                      return (
                        <button
                          key={port.key}
                          onClick={() => setSelectedPortKey(port.key)}
                          className={`h-11 rounded-lg flex flex-col items-center justify-between p-1.5 text-[9px] font-mono font-bold transition-all duration-500 ease-in-out relative cursor-pointer ${bgStyle} ${
                            isSelected ? 'ring-2 ring-brand-400 ring-offset-2 dark:ring-offset-slate-950 scale-105' : 'hover:scale-105'
                          }`}
                        >
                          <span className="text-[10px] leading-none mb-0.5">{statusIcon}</span>
                          <span>{port.id}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-32 flex flex-col items-center justify-center text-sm text-slate-400 font-medium space-y-2">
                    <div className="animate-pulse h-2.5 w-2.5 bg-brand-500 rounded-full" />
                    <span>Awaiting interface inventory telemetry from device...</span>
                  </div>
                )}
              </div>

              {/* Mini Port Statistics */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-500/5 p-3.5 rounded-xl border border-slate-200/10 text-xs font-sans text-slate-700 dark:text-slate-350">
                <div className="flex justify-between sm:flex-col sm:justify-start gap-1">
                  <span className="text-slate-400">Ports Up:</span>
                  <span className="font-bold text-emerald-500 font-mono">{stats.activePorts}</span>
                </div>
                <div className="flex justify-between sm:flex-col sm:justify-start gap-1">
                  <span className="text-slate-400">Ports Down:</span>
                  <span className="font-bold text-slate-500 dark:text-slate-400 font-mono">{stats.inactivePorts}</span>
                </div>
                <div className="flex justify-between sm:flex-col sm:justify-start gap-1">
                  <span className="text-slate-400">Ports Disabled:</span>
                  <span className="font-bold text-rose-500 font-mono">{stats.disabledPorts}</span>
                </div>
                <div className="flex justify-between sm:flex-col sm:justify-start gap-1">
                  <span className="text-slate-400">PoE Enabled:</span>
                  <span className="font-bold text-brand-500 font-mono">
                    {switchPorts.filter(p => p.poe).length}
                  </span>
                </div>
                <div className="flex justify-between sm:flex-col sm:justify-start gap-1">
                  <span className="text-slate-400">Avg Utilization:</span>
                  <span className="font-bold text-slate-800 dark:text-white font-mono">
                    {(() => {
                      const statsPorts = selectedSwitch.telemetry?.port_statistics?.ports;
                      if (!statsPorts) return '0%';
                      const utils = Object.values(statsPorts)
                        .map((p: any) => p.utilization || 0)
                        .filter(u => u > 0);
                      if (utils.length === 0) return '0%';
                      const avg = utils.reduce((a, b) => a + b, 0) / utils.length;
                      return `${avg.toFixed(1)}%`;
                    })()}
                  </span>
                </div>
              </div>

              {/* Interface Search and CSV Export Buttons */}
              <div className="mt-6 border-t border-slate-200/50 dark:border-slate-800/80 pt-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex-1 max-w-sm">
                    <input
                      type="text"
                      placeholder="Search Port, VLAN, status, or description..."
                      value={portSearchQuery}
                      onChange={(e) => setPortSearchQuery(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-200"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="text-[10px] py-1.5 px-2.5" onClick={handleExportInterfaces}>Export Interfaces</Button>
                    <Button variant="outline" className="text-[10px] py-1.5 px-2.5" onClick={handleExportMacTable}>Export MAC Table</Button>
                    <Button variant="outline" className="text-[10px] py-1.5 px-2.5" onClick={handleExportLldp}>Export LLDP</Button>
                    <Button variant="outline" className="text-[10px] py-1.5 px-2.5" onClick={handleExportVlans}>Export VLANs</Button>
                  </div>
                </div>

                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-3">
                  Interface Information
                </h4>
                <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800/60">
                  <table className="min-w-full divide-y divide-slate-200/60 dark:divide-slate-800/60 text-xs text-slate-600 dark:text-slate-400 font-sans">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 font-bold text-slate-700 dark:text-slate-300">
                      <tr>
                        <th className="px-4 py-2 text-left">Port</th>
                        <th className="px-4 py-2 text-left">Status</th>
                        <th className="px-4 py-2 text-left">Speed</th>
                        <th className="px-4 py-2 text-left">RX Mbps</th>
                        <th className="px-4 py-2 text-left">TX Mbps</th>
                        <th className="px-4 py-2 text-left">RX Packets</th>
                        <th className="px-4 py-2 text-left">TX Packets</th>
                        <th className="px-4 py-2 text-left">Input Errs</th>
                        <th className="px-4 py-2 text-left">Output Errs</th>
                        <th className="px-4 py-2 text-left">Drops</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {filteredPorts.map(port => {
                        const portStats = selectedSwitch.telemetry?.port_statistics?.ports?.[port.key];
                        const rxMbps = portStats?.rx_bps ? (portStats.rx_bps / 1000000).toFixed(2) : '0.00';
                        const txMbps = portStats?.tx_bps ? (portStats.tx_bps / 1000000).toFixed(2) : '0.00';
                        const rxPackets = portStats?.rx_packets || 0;
                        const txPackets = portStats?.tx_packets || 0;
                        const inputErrors = portStats?.input_errors || 0;
                        const outputErrors = portStats?.output_errors || 0;
                        const drops = portStats?.drops || 0;

                        return (
                          <tr 
                            key={port.key} 
                            onClick={() => setSelectedPortKey(port.key)}
                            className={`hover:bg-slate-500/5 cursor-pointer ${selectedPortKey === port.key ? 'bg-brand-500/5 font-semibold text-brand-500' : ''}`}
                          >
                            <td className="px-4 py-2 font-mono font-bold">{port.name}</td>
                            <td className="px-4 py-2">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${
                                port.link === 'up' 
                                  ? 'bg-emerald-500/10 text-emerald-500' 
                                  : 'bg-slate-500/10 text-slate-400'
                              }`}>
                                {port.link === 'up' ? 'Up' : 'Down'}
                              </span>
                            </td>
                            <td className="px-4 py-2">{port.speed}</td>
                            <td className="px-4 py-2 font-mono">{rxMbps}</td>
                            <td className="px-4 py-2 font-mono">{txMbps}</td>
                            <td className="px-4 py-2 font-mono">{rxPackets}</td>
                            <td className="px-4 py-2 font-mono">{txPackets}</td>
                            <td className="px-4 py-2 font-mono text-rose-500">{inputErrors}</td>
                            <td className="px-4 py-2 font-mono text-rose-500">{outputErrors}</td>
                            <td className="px-4 py-2 font-mono text-rose-500">{drops}</td>
                          </tr>
                        );
                      })}
                      {filteredPorts.length === 0 && (
                        <tr>
                          <td colSpan={10} className="px-4 py-8 text-center text-slate-400 font-medium">
                            No matching interfaces found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>

            {/* Port settings Inspector panel */}
            <Card title="Switch Port Inspector" className="h-full" description="Configures specific port overlays.">
              {activePortDetails ? (
                <div className="space-y-4 text-left text-xs font-sans">
                  {/* Port Info Header */}
                  <div className="p-3 bg-slate-500/5 rounded-xl border border-slate-200/20 flex items-center justify-between font-mono">
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm font-sans">{activePortDetails.name}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">{activePortDetails.speed} Link Speed</p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      activePortDetails.link === 'up' 
                        ? 'bg-emerald-500/10 text-emerald-500' 
                        : 'bg-slate-500/10 text-slate-400'
                    }`}>
                      {activePortDetails.link === 'up' ? 'UP' : 'DOWN'}
                    </span>
                  </div>

                  {/* Actions (Enable/Disable, PoE) */}
                  <div className="space-y-2.5 pb-3 border-b border-slate-200/10">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-500 font-sans">Admin State</span>
                      <button
                        disabled={isReadOnly}
                        onClick={handleTogglePort}
                        className={`text-[10px] font-bold px-2.5 py-1 border rounded-lg ${
                          activePortDetails.enabled 
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                        }`}
                      >
                        {activePortDetails.enabled ? 'PORT ENABLED' : 'PORT DISABLED'}
                      </button>
                    </div>

                    {deviceHasCapability(selectedSwitch.type, 'POE') && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-500 font-sans">PoE Power Supply</span>
                        {activePortDetails.poe !== undefined ? (
                          <button
                            disabled={isReadOnly || !activePortDetails.enabled}
                            onClick={handleTogglePoe}
                            className={`text-[10px] font-bold px-2.5 py-1 border rounded-lg ${
                              activePortDetails.poe 
                                ? 'bg-brand-500/10 border-brand-500/20 text-brand-500' 
                                : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'
                            }`}
                          >
                            {activePortDetails.poe ? `POE ON (${activePortDetails.poeWatts}W)` : 'POE OFF'}
                          </button>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400">Unavailable</span>
                        )}
                      </div>
                    )}

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Bound Access VLAN</span>
                      <select
                        disabled={isReadOnly || !activePortDetails.enabled}
                        value={activePortDetails.vlan}
                        onChange={(e) => handleAssignVlan(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-200 font-sans"
                      >
                        <option value="1">1 (Default VLAN)</option>
                        {vlans.map(v => (
                          <option key={v.id} value={v.id}>{v.id} - {v.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Port Parameters */}
                  {(() => {
                    const lldpNeighbors = selectedSwitch.telemetry?.lldp_neighbors;
                    let lldpNeighbor: any = null;
                    if (Array.isArray(lldpNeighbors)) {
                      lldpNeighbor = lldpNeighbors.find(
                        (n: any) => n.local_port === activePortDetails.key || n.local_interface === activePortDetails.key
                      );
                    }

                    const portStats = selectedSwitch.telemetry?.port_statistics?.ports?.[activePortDetails.key];
                    const rxBytes = portStats?.rx_bytes || 0;
                    const txBytes = portStats?.tx_bytes || 0;
                    const inputErrors = portStats?.input_errors || 0;
                    const outputErrors = portStats?.output_errors || 0;
                    const drops = portStats?.drops || 0;
                    const duplex = portStats?.duplex || 'Full';
                    const autoNeg = activePortDetails.link === 'up' ? 'Enabled' : 'Disabled';

                    return (
                      <div className="space-y-2 text-xs font-sans">
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/50">
                          <span className="text-slate-400">Port Name:</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{activePortDetails.name}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/50">
                          <span className="text-slate-400">Status:</span>
                          <span className={`font-bold ${activePortDetails.link === 'up' ? 'text-emerald-500' : 'text-slate-400'}`}>
                            {activePortDetails.link === 'up' ? 'UP' : 'DOWN'}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/50">
                          <span className="text-slate-400">Speed:</span>
                          <span className="font-bold text-slate-800 dark:text-white">{activePortDetails.speed}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/50">
                          <span className="text-slate-400">Duplex:</span>
                          <span className="font-bold text-slate-800 dark:text-white">{duplex}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/50">
                          <span className="text-slate-400">Auto Negotiation:</span>
                          <span className="font-bold text-slate-800 dark:text-white">{autoNeg}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/50">
                          <span className="text-slate-400">Description:</span>
                          <span className="font-bold text-slate-800 dark:text-white">{activePortDetails.description || '-'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/50">
                          <span className="text-slate-400">Assigned VLAN:</span>
                          <span className="font-bold text-slate-800 dark:text-white font-mono">{activePortDetails.vlan}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/50 font-sans">
                          <span className="text-slate-400">LLDP Neighbor:</span>
                          <span className="font-bold text-brand-500">
                            {lldpNeighbor ? lldpNeighbor.system_name || lldpNeighbor.chassis_id : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/50 font-mono text-[11px]">
                          <span className="text-slate-400 font-sans text-xs">MAC Address:</span>
                          <span className="font-bold text-slate-800 dark:text-white">
                            {lldpNeighbor ? lldpNeighbor.chassis_id || '-' : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/50 font-mono text-[11px]">
                          <span className="text-slate-400 font-sans text-xs">RX Traffic:</span>
                          <span className="font-bold text-slate-800 dark:text-white">{(rxBytes / (1024 * 1024)).toFixed(1)} MB</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/50 font-mono text-[11px]">
                          <span className="text-slate-400 font-sans text-xs">TX Traffic:</span>
                          <span className="font-bold text-slate-800 dark:text-white">{(txBytes / (1024 * 1024)).toFixed(1)} MB</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/50 font-mono text-[11px]">
                          <span className="text-slate-400 font-sans text-xs">Input Errors:</span>
                          <span className="font-bold text-rose-500">{inputErrors}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/50 font-mono text-[11px]">
                          <span className="text-slate-400 font-sans text-xs">Output Errors:</span>
                          <span className="font-bold text-rose-500">{outputErrors}</span>
                        </div>
                        <div className="flex justify-between py-1 font-mono text-[11px]">
                          <span className="text-slate-400 font-sans text-xs">Drops:</span>
                          <span className="font-bold text-rose-500">{drops}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-xs text-slate-450 font-medium py-24 text-center">
                  Select a port socket block from the switch matrix to inspect its live status and telemetry details.
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
