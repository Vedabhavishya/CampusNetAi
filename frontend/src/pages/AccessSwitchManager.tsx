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

  // 1. Generate 48-port grid based on switch config
  const switchPorts = useMemo(() => {
    if (!selectedSwitch) return [];
    
    const ports = [];
    const interfaces = selectedSwitch.config.interfaces || {};
    
    for (let i = 1; i <= 48; i++) {
      const isUplink = i === 47 || i === 48;
      const portKey = isUplink ? `xe${i - 47}` : `ge${i - 1}`;
      
      // Load current configuration or fallback to defaults
      const config = interfaces[portKey] || {
        enabled: i <= 24, // default first 24 active
        vlan: isUplink ? 10 : (i <= 8 ? 10 : i <= 16 ? 20 : i <= 24 ? 30 : 40),
        speed: isUplink ? '10Gbps' : '1000Mbps',
        poe: !isUplink && i <= 16 // PoE on first 16
      };
      
      ports.push({
        id: i,
        key: portKey,
        name: isUplink ? `xe-0/0/${i - 47}` : `ge-0/0/${i - 1}`,
        enabled: config.enabled,
        vlan: config.vlan,
        speed: config.speed,
        poe: config.poe || false,
        poeWatts: config.poe && config.enabled ? Math.round(5 + (i % 7) * 2.5) : 0,
        isUplink
      });
    }
    
    return ports;
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
    if (!selectedSwitch) return { poeTotal: 0, poeLimit: 370, activePorts: 0 };
    const ports = switchPorts;
    const activePorts = ports.filter(p => p.enabled).length;
    const poeTotal = ports.reduce((acc, p) => acc + (p.poeWatts || 0), 0);
    return {
      poeTotal,
      poeLimit: 370,
      activePorts
    };
  }, [selectedSwitch, switchPorts]);

  if (accessSwitches.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 font-medium">
        No active Access Switch devices claimed in inventory. Onboard an access switch first.
      </div>
    );
  }

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
                <h3 className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white flex items-baseline">
                  {stats.poeTotal}W <span className="text-xs text-slate-400 font-normal ml-1">/ {stats.poeLimit}W limit</span>
                </h3>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div className="bg-brand-500 h-full" style={{ width: `${(stats.poeTotal / stats.poeLimit) * 100}%` }} />
                </div>
              </div>
            </Card>

            <Card title="Active Interfaces link" description="Aggregate active port links count">
              <div className="mt-3 text-left">
                <h3 className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white">
                  {stats.activePorts} <span className="text-xs text-slate-400 font-normal">/ 48 ports up</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">Downlink aggregate speed: 20 Gbps</p>
              </div>
            </Card>

            <Card title="Switch Health index" description="Central telemetry health value">
              <div className="mt-3 flex items-center justify-between text-left">
                <div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Index Score: {selectedSwitch.healthScore}%</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 capitalize">Status: {selectedSwitch.status}</p>
                </div>
                <HealthIndicator score={selectedSwitch.healthScore} size="sm" />
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Visual 48-port Matrix panel */}
            <Card className="lg:col-span-3 p-5 space-y-6 text-left" title="Physical 48-Port Switch Matrix">
              <p className="text-xs text-slate-400">Click on any port socket block below to load its VLAN binding and toggle PoE configuration settings.</p>
              
              {/* LED Status Legend */}
              <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-emerald-500 rounded" /> Up (Active)</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-slate-200 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-700" /> Down (Unused)</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-brand-500 rounded" /> PoE Active</span>
              </div>

              {/* Port Matrix Layout */}
              <div className="bg-slate-100 dark:bg-slate-950 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-800/80">
                <div className="grid grid-cols-12 gap-x-2.5 gap-y-4">
                  {switchPorts.map(port => {
                    const isSelected = selectedPortKey === port.key;
                    let bgStyle = 'bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700';
                    if (port.enabled) {
                      bgStyle = port.poe ? 'bg-brand-500 text-white' : 'bg-emerald-500 text-white';
                    }
                    
                    return (
                      <button
                        key={port.id}
                        onClick={() => setSelectedPortKey(port.key)}
                        className={`h-11 rounded-lg flex flex-col items-center justify-between p-1.5 text-[8px] font-mono font-bold transition-all relative cursor-pointer ${bgStyle} ${
                          isSelected ? 'ring-2 ring-brand-400 ring-offset-2 dark:ring-offset-slate-950 scale-105' : 'hover:scale-105'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${port.enabled ? 'bg-white' : 'bg-transparent'}`} />
                        <span>{port.id}</span>
                      </button>
                    );
                  })}
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
                    <StatusBadge status={activePortDetails.enabled ? 'online' : 'offline'} />
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
                    {deviceHasCapability(selectedSwitch.type, 'POE') && !activePortDetails.isUplink && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">PoE Power supply</span>
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

                  {/* Operational diagnostics details */}
                  <div className="p-3.5 bg-slate-500/5 border border-slate-200/10 rounded-xl space-y-2 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Duplex:</span>
                      <span className="text-slate-800 dark:text-slate-100 font-bold">Full Duplex</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Packet errors:</span>
                      <span className="text-slate-800 dark:text-slate-100 font-bold">0 packets</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Connected Device Host:</span>
                      <span className="text-brand-500 font-bold">
                        {activePortDetails.key === 'ge0' ? 'Finance-Desktop-01' : 
                         activePortDetails.key === 'ge1' ? 'Zebra-LabelPrinter-04' : 'None'}
                      </span>
                    </div>
                  </div>
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
