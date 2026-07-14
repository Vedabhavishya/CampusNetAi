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
        isUplink: false
      };
    });
  }, [selectedSwitch]);

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

            <Card title="Switch Health Index" description="Central telemetry health details">
              <div className="mt-3 flex items-start justify-between text-left font-sans">
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Index Score:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">{selectedSwitch.healthScore}%</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">SSH Status:</span>
                    <span className={`font-bold ${selectedSwitch.status === 'online' ? 'text-emerald-500' : 'text-slate-400'}`}>
                      {selectedSwitch.status === 'online' ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Last Poll:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      {selectedSwitch.collector?.last_poll 
                        ? new Date(selectedSwitch.collector.last_poll).toLocaleTimeString() 
                        : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Latency:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      {selectedSwitch.telemetry?.performance?.current?.ssh_latency_ms !== undefined 
                        ? `${selectedSwitch.telemetry.performance.current.ssh_latency_ms} ms` 
                        : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Poll Duration:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      {selectedSwitch.telemetry?.performance?.current?.poll_duration_ms !== undefined 
                        ? `${(selectedSwitch.telemetry.performance.current.poll_duration_ms / 1000).toFixed(1)} s` 
                        : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Collector:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100 font-mono text-[10px]">
                      {selectedSwitch.collector?.name || '-'}
                    </span>
                  </div>
                </div>
                <HealthIndicator score={selectedSwitch.healthScore} size="sm" />
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Visual Port Matrix panel */}
            <Card className="lg:col-span-3 p-5 space-y-6 text-left" title={`Physical Switch Port Matrix (${switchPorts.length} Ports)`}>
              <p className="text-xs text-slate-400">Click on any port socket block below to load its VLAN binding and toggle PoE configuration settings.</p>
              
              {/* LED Status Legend */}
              <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-emerald-500 rounded" /> Up (Active)</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-slate-200 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700" /> Down (Unused)</span>
                {hasPoeState && (
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-brand-500 rounded" /> PoE Active</span>
                )}
              </div>

              {/* Port Matrix Layout */}
              <div className="bg-slate-100 dark:bg-slate-950 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-800/80">
                {switchPorts.length > 0 ? (
                  <div className="grid grid-cols-12 gap-x-2.5 gap-y-4">
                    {switchPorts.map(port => {
                      const isSelected = selectedPortKey === port.key;
                      let bgStyle = 'bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500';
                      if (port.link === 'up') {
                        bgStyle = port.poe ? 'bg-brand-500 text-white' : 'bg-emerald-500 text-white';
                      }
                      
                      return (
                        <button
                          key={port.key}
                          onClick={() => setSelectedPortKey(port.key)}
                          className={`h-11 rounded-lg flex flex-col items-center justify-between p-1.5 text-[8px] font-mono font-bold transition-all relative cursor-pointer ${bgStyle} ${
                            isSelected ? 'ring-2 ring-brand-400 ring-offset-2 dark:ring-offset-slate-950 scale-105' : 'hover:scale-105'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${port.link === 'up' ? 'bg-white' : 'bg-transparent'}`} />
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

              {/* Interface Information Table */}
              <div className="mt-6 border-t border-slate-200/50 dark:border-slate-800/80 pt-6">
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
                        <th className="px-4 py-2 text-left">VLAN</th>
                        <th className="px-4 py-2 text-left">IP Address</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {switchPorts.map(port => (
                        <tr 
                          key={port.key} 
                          onClick={() => setSelectedPortKey(port.key)}
                          className={`hover:bg-slate-500/5 cursor-pointer ${selectedPortKey === port.key ? 'bg-brand-500/5 font-semibold text-brand-500' : ''}`}
                        >
                          <td className="px-4 py-2 font-mono">{port.name}</td>
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
                          <td className="px-4 py-2">{port.vlan}</td>
                          <td className="px-4 py-2 font-mono">{port.ip}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>

            {/* Port settings Inspector panel */}
            <Card title="Switch Port Inspector" className="h-full" description="Configures specific port overlays.">
              {activePortDetails ? (
                <div className="space-y-5 text-left text-xs font-mono">
                  {/* Port Info Header */}
                  <div className="p-3 bg-slate-500/5 rounded-xl border border-slate-200/20 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm font-sans">{activePortDetails.name}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">{activePortDetails.speed} Link Speed</p>
                    </div>
                    <StatusBadge status={activePortDetails.link === 'up' ? 'online' : 'offline'} />
                  </div>

                  <div className="space-y-3 font-sans">
                    {/* Enable Port */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Admin Port Status</span>
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

                    {/* Enable PoE (Capability checks) */}
                    {deviceHasCapability(selectedSwitch.type, 'POE') && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">PoE Power supply</span>
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

                    {/* VLAN assignment Dropdown */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Bound Access VLAN</span>
                      <select
                        disabled={isReadOnly || !activePortDetails.enabled}
                        value={activePortDetails.vlan}
                        onChange={(e) => handleAssignVlan(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                      >
                        <option value="1">1 (Default VLAN)</option>
                        {vlans.map(v => (
                          <option key={v.id} value={v.id}>{v.id} - {v.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Status Section */}
                  <div className="space-y-2 border-t border-slate-200/40 dark:border-slate-800/40 pt-4 font-sans text-left">
                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</h5>
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                      <div><span className="text-slate-400">Admin State:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{activePortDetails.enabled ? 'Enabled' : 'Disabled'}</span></div>
                      <div><span className="text-slate-400">Link State:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{activePortDetails.link === 'up' ? 'Up' : 'Down'}</span></div>
                      <div><span className="text-slate-400">Speed:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{activePortDetails.speed}</span></div>
                      <div><span className="text-slate-400">VLAN:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{activePortDetails.vlan}</span></div>
                      <div className="col-span-2"><span className="text-slate-400">IP:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{activePortDetails.ip}</span></div>
                    </div>
                  </div>

                  {/* Connected Device Section */}
                  {(() => {
                    const lldpNeighbors = selectedSwitch.telemetry?.lldp_neighbors;
                    let lldpNeighbor: any = null;
                    if (Array.isArray(lldpNeighbors)) {
                      lldpNeighbor = lldpNeighbors.find(
                        (n: any) => n.local_port === activePortDetails.key || n.local_interface === activePortDetails.key
                      );
                    }
                    return (
                      <>
                        <div className="space-y-2 border-t border-slate-200/40 dark:border-slate-800/40 pt-4 font-sans text-left">
                          <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Device</h5>
                          <div className="text-[10px] font-mono">
                            <span className="text-slate-400">Connected Device:</span>{' '}
                            <span className="font-bold text-brand-500">
                              {lldpNeighbor ? lldpNeighbor.system_name || lldpNeighbor.chassis_id : '-'}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2 border-t border-slate-200/40 dark:border-slate-800/40 pt-4 font-sans text-left">
                          <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Protocol</h5>
                          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                            <div><span className="text-slate-400">LLDP:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{lldpNeighbor ? 'Yes' : 'No'}</span></div>
                            <div className="col-span-2"><span className="text-slate-400">MAC:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{lldpNeighbor ? lldpNeighbor.chassis_id || '-' : '-'}</span></div>
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  {/* Port Statistics and Live Counters */}
                  {(() => {
                    const portStats = selectedSwitch.telemetry?.port_statistics?.ports?.[activePortDetails.key];
                    const rxBytes = portStats?.rx_bytes || 0;
                    const txBytes = portStats?.tx_bytes || 0;
                    const rxPackets = portStats?.rx_packets || 0;
                    const txPackets = portStats?.tx_packets || 0;
                    const inputErrors = portStats?.input_errors || 0;
                    const outputErrors = portStats?.output_errors || 0;
                    const crcErrors = portStats?.crc_errors || 0;
                    const drops = portStats?.drops || 0;
                    const duplex = portStats?.duplex || 'Full-duplex';
                    
                    return (
                      <>
                        <div className="space-y-2 border-t border-slate-200/40 dark:border-slate-800/40 pt-4 font-sans text-left">
                          <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Statistics</h5>
                          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                            <div><span className="text-slate-400">Rx Packets:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{rxPackets}</span></div>
                            <div><span className="text-slate-400">Tx Packets:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{txPackets}</span></div>
                            <div><span className="text-slate-400">Errors:</span> <span className="font-rose-500 font-bold">{inputErrors + outputErrors + crcErrors}</span></div>
                            <div><span className="text-slate-400">Drops:</span> <span className="font-rose-500 font-bold">{drops}</span></div>
                          </div>
                        </div>

                        <div className="space-y-2 border-t border-slate-200/40 dark:border-slate-800/40 pt-4 font-sans text-left">
                          <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Live Counters</h5>
                          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                            <div><span className="text-slate-400">Rx Traffic:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{(rxBytes / (1024 * 1024)).toFixed(1)} MB</span></div>
                            <div><span className="text-slate-400">Tx Traffic:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{(txBytes / (1024 * 1024)).toFixed(1)} MB</span></div>
                            <div><span className="text-slate-400">Input Errs:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{inputErrors}</span></div>
                            <div><span className="text-slate-400">Output Errs:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{outputErrors}</span></div>
                            <div><span className="text-slate-400">Drops:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{drops}</span></div>
                            <div><span className="text-slate-400">Duplex:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{duplex}</span></div>
                            <div className="col-span-2"><span className="text-slate-400">Auto Negot:</span> <span className="font-bold text-slate-800 dark:text-slate-200">{activePortDetails.link === 'up' ? 'Enabled' : '-'}</span></div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium py-16">
                  Select a port socket socket to load config console.
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
