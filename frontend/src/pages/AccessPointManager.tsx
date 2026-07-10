import React, { useState, useMemo } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Table } from '../components/Table';
import { StatusBadge, HealthIndicator } from '../components/EnterpriseWidgets';
import { useNetworkStore } from '../contexts/NetworkStoreContext';
import { useAuth } from '../contexts/AuthContext';
import { NetworkDevice } from '../types';
import { Wifi, Signal, Settings, Play, ShieldAlert, CheckCircle, RefreshCw, Cpu, Users } from 'lucide-react';

export const AccessPointManager: React.FC = () => {
  const { user } = useAuth();
  const { 
    devices, 
    clients, 
    restartDevice, 
    runProvisioningTask 
  } = useNetworkStore();

  const isReadOnly = user?.role === 'Network Engineer';

  // Load AP devices
  const aps = useMemo(() => {
    return devices.filter(d => d.type === 'access_point');
  }, [devices]);

  const [selectedApId, setSelectedApId] = useState<string>(
    aps.length > 0 ? aps[0].id : ''
  );

  const selectedAp = useMemo(() => {
    return devices.find(d => d.id === selectedApId) || null;
  }, [devices, selectedApId]);

  // Radio forms
  const [channel5, setChannel5] = useState('Auto (36)');
  const [txPower5, setTxPower5] = useState(15);
  const [width5, setWidth5] = useState('80');
  const [bandSteering, setBandSteering] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Reboot state
  const [isRebooting, setIsRebooting] = useState(false);

  // Sync radio settings when AP changes
  React.useEffect(() => {
    if (selectedAp) {
      const cfg = selectedAp.config as any;
      setChannel5(cfg.channel5 || 'Auto (36)');
      setTxPower5(cfg.txPower5 || 15);
      setWidth5(cfg.width5 || '80');
      setBandSteering(cfg.bandSteering !== false);
    }
  }, [selectedAp]);

  // Commit configuration overrides
  const handleSaveRadioConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAp) return;

    setSaveSuccess(true);
    await runProvisioningTask(
      `Optimize Radio Frequencies: ${selectedAp.name}`,
      [selectedAp.name],
      async () => {
        const savedDevices = JSON.parse(localStorage.getItem('cn-devices') || '[]');
        const index = savedDevices.findIndex((d: any) => d.id === selectedAp.id);
        if (index !== -1) {
          savedDevices[index].config = {
            ...savedDevices[index].config,
            channel5,
            txPower5,
            width5,
            bandSteering
          };
          localStorage.setItem('cn-devices', JSON.stringify(savedDevices));
          window.dispatchEvent(new Event('storage'));
        }
        return true;
      },
      selectedAp.config
    );
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleRestart = async () => {
    if (!selectedAp) return;
    setIsRebooting(true);
    try {
      await restartDevice(selectedAp.id);
    } finally {
      setIsRebooting(false);
    }
  };

  // Connected clients list derived from central store
  const apClients = useMemo(() => {
    if (!selectedAp) return [];
    return clients.filter(c => c.connectedToDeviceName === selectedAp.name);
  }, [clients, selectedAp]);

  if (aps.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 font-medium">
        No Access Point devices claimed in inventory. Onboard an AP first.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-left">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-400 rounded-xl flex items-center justify-center">
            <Wifi className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white m-0">
              Access Point Manager
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Optimize wireless radio parameters (RF), review floor plan blueprints locations, and track clients allocation.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Physical Floor Plan Blueprints map */}
        <Card
          title="Floor Plan Heatmap & Location Map"
          className="lg:col-span-2 text-left"
          description="Simulated physical placement of Managed APs on the Main Headquarters Floor. Click on AP targets to inspect."
        >
          <div className="relative aspect-[16/9] w-full bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-2xl overflow-hidden shadow-inner flex flex-col justify-between p-4">
            {/* Blueprint layout lines */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-4 p-8 opacity-15 pointer-events-none select-none">
              <div className="border border-slate-500 rounded-lg flex items-center justify-center text-[9px] text-slate-500 font-bold uppercase">Executive Suites</div>
              <div className="border border-slate-500 rounded-lg flex items-center justify-center text-[9px] text-slate-500 font-bold uppercase">Conference Hall</div>
              <div className="border border-slate-500 rounded-lg flex items-center justify-center text-[9px] text-slate-500 font-bold uppercase">Lobby & Entrance</div>
              <div className="border border-slate-500 rounded-lg flex items-center justify-center text-[9px] text-slate-500 font-bold uppercase">Engineering Lab</div>
              <div className="border border-slate-500 rounded-lg flex items-center justify-center text-[9px] text-slate-500 font-bold uppercase">Cafeteria / Lounge</div>
              <div className="border border-slate-500 rounded-lg flex items-center justify-center text-[9px] text-slate-500 font-bold uppercase">IT Operations</div>
            </div>

            {/* Clickable AP pins on map */}
            {aps.map((ap, index) => {
              const isSelected = ap.id === selectedApId;
              // Hardcoded blueprint coordinate offsets
              const coordinates = [
                { top: '30%', left: '20%' }, // Executive
                { top: '25%', left: '50%' }, // Lobby
                { top: '70%', left: '20%' }, // Engineering
                { top: '65%', left: '80%' }  // Operations
              ];
              const pos = coordinates[index % coordinates.length];

              return (
                <button
                  key={ap.id}
                  onClick={() => setSelectedApId(ap.id)}
                  style={{ top: pos.top, left: pos.left }}
                  className={`absolute h-10 w-10 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md ${
                    isSelected
                      ? 'bg-brand-500 text-white ring-4 ring-brand-300 scale-110 z-10'
                      : 'bg-white dark:bg-slate-950 text-slate-500 border border-slate-200 hover:scale-105'
                  }`}
                  title={`${ap.name} - ${ap.clientsCount} clients`}
                >
                  <Wifi className="h-5 w-5" />
                  <span className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white text-[8px] font-bold px-1 py-0.5 rounded shadow-sm whitespace-nowrap opacity-75">
                    {ap.name} ({ap.clientsCount})
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Selected AP Settings & telemetry */}
        <Card title="RF & Wireless Settings" description="Tune specific Access Point attributes:">
          {selectedAp ? (
            <form onSubmit={handleSaveRadioConfig} className="space-y-4 text-left font-sans">
              <div className="p-3 bg-slate-500/5 border border-slate-200/20 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm font-sans">{selectedAp.name}</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{selectedAp.model} | {selectedAp.version}</p>
                </div>
                <HealthIndicator score={selectedAp.healthScore} size="sm" />
              </div>

              {/* Radio width */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">5GHz Channel width</label>
                <select
                  disabled={isReadOnly}
                  value={width5}
                  onChange={(e) => setWidth5(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold"
                >
                  <option value="20">20 MHz (Co-channel isolation)</option>
                  <option value="40">40 MHz (Standard office)</option>
                  <option value="80">80 MHz (High bandwidth load)</option>
                </select>
              </div>

              {/* Radio Channel selection */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">5GHz Channel allocation</label>
                <select
                  disabled={isReadOnly}
                  value={channel5}
                  onChange={(e) => setChannel5(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold"
                >
                  <option value="Auto (36)">Auto channel allocation (DFS)</option>
                  <option value="36">Channel 36 (5.180 GHz)</option>
                  <option value="44">Channel 44 (5.220 GHz)</option>
                  <option value="149">Channel 149 (5.745 GHz)</option>
                </select>
              </div>

              {/* TX Power slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>Transmit Power</span>
                  <span className="font-mono text-brand-500 font-bold">{txPower5} dBm</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="23"
                  disabled={isReadOnly}
                  value={txPower5}
                  onChange={(e) => setTxPower5(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
                />
              </div>

              {/* Band steering toggle */}
              <div className="pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bandSteering}
                    onChange={(e) => setBandSteering(e.target.checked)}
                    className="text-brand-500"
                  />
                  Enable 5GHz Band Steering preference
                </label>
              </div>

              {/* Action Buttons */}
              <div className="border-t border-slate-200/50 dark:border-slate-800/80 pt-4 flex gap-2">
                {!isReadOnly && (
                  <>
                    <Button type="submit" variant="primary" className="flex-1 text-xs">
                      Apply RF Profiles
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRestart}
                      isLoading={isRebooting}
                      className="text-xs"
                    >
                      Restart Cell
                    </Button>
                  </>
                )}
              </div>

              {saveSuccess && (
                <p className="text-xs text-emerald-500 font-bold text-center mt-2 flex items-center justify-center gap-1">
                  <CheckCircle className="h-4 w-4" /> RF Optimization saved.
                </p>
              )}
            </form>
          ) : (
            <p className="text-xs text-slate-400 py-16">Select an AP Pin to edit radios config.</p>
          )}
        </Card>
      </div>

      {/* Connected Clients list specifically for this AP */}
      {selectedAp && (
        <Card title={`Active WiFi Sessions: ${selectedAp.name}`} description="Clients currently roaming under this wireless sector antenna cells:">
          <Table
            columns={[
              { header: 'Device Client', accessor: 'name', sortable: true },
              { header: 'MAC Address', accessor: 'macAddress', className: 'font-mono' },
              { header: 'IP Subnet Address', accessor: 'ipAddress', className: 'font-mono font-semibold' },
              {
                header: 'Wireless Signal',
                accessor: (row: any) => {
                  const dbm = row.signal || -65;
                  return (
                    <span className={`font-mono text-xs font-bold ${
                      dbm >= -60 ? 'text-emerald-500' : dbm >= -75 ? 'text-amber-500' : 'text-rose-500'
                    }`}>
                      {dbm} dBm
                    </span>
                  );
                }
              },
              {
                header: 'Active Bandwidth',
                accessor: (row: any) => <span className="font-mono text-xs">{(row.rxRate || 1.5).toFixed(1)} Mbps</span>
              }
            ]}
            data={apClients}
          />
        </Card>
      )}
    </div>
  );
};
export default AccessPointManager;
