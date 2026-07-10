import React, { useState, useMemo } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Table } from '../components/Table';
import { Drawer } from '../components/Drawer';
import { StatusBadge } from '../components/EnterpriseWidgets';
import { useNetworkStore } from '../contexts/NetworkStoreContext';
import { useAuth } from '../contexts/AuthContext';
import { NetworkClient } from '../types';
import { Users, Search, Wifi, Laptop, ShieldAlert, CheckCircle, ArrowDown, ArrowUp, XCircle, Ban, Sliders } from 'lucide-react';

export const ClientManager: React.FC = () => {
  const { user } = useAuth();
  const { 
    clients, 
    disconnectClient, 
    quarantineClient, 
    limitClientBandwidth
  } = useNetworkStore();

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [connectionFilter, setConnectionFilter] = useState<'all' | 'wired' | 'wireless'>('all');
  const [limitRxInput, setLimitRxInput] = useState(10);
  const [limitTxInput, setLimitTxInput] = useState(5);

  const isReadOnly = user?.role === 'Network Engineer';

  const selectedClient = useMemo(() => {
    if (!selectedClientId) return null;
    return clients.find(c => c.id === selectedClientId) || null;
  }, [clients, selectedClientId]);

  // Filtering
  const filteredClients = useMemo(() => {
    if (connectionFilter === 'all') return clients;
    return clients.filter(c => c.connectionType === connectionFilter);
  }, [clients, connectionFilter]);

  const handleRowClick = (client: NetworkClient) => {
    setSelectedClientId(client.id);
    setLimitRxInput(client.rateLimitRx || 10);
    setLimitTxInput(client.rateLimitTx || 5);
    setIsDrawerOpen(true);
  };

  // --- ACTIONS HANDLERS ---
  const handleDisconnect = async () => {
    if (selectedClient) {
      await disconnectClient(selectedClient.id);
      setIsDrawerOpen(false);
      setSelectedClientId(null);
    }
  };

  const handleQuarantine = async () => {
    if (selectedClient) {
      await quarantineClient(selectedClient.id);
    }
  };

  const handleBlock = async () => {
    if (selectedClient) {
      await disconnectClient(selectedClient.id);
      setIsDrawerOpen(false);
      setSelectedClientId(null);
    }
  };

  const handleWhitelist = async () => {
    if (selectedClient) {
      await disconnectClient(selectedClient.id);
    }
  };

  const handleRateLimit = async () => {
    if (selectedClient) {
      await limitClientBandwidth(selectedClient.id, limitRxInput);
    }
  };

  const getSignalColor = (dbm?: number) => {
    if (dbm === undefined) return 'text-slate-400';
    if (dbm >= -60) return 'text-emerald-500 font-bold';
    if (dbm >= -75) return 'text-amber-500 font-semibold';
    return 'text-rose-500 font-extrabold';
  };

  const columns = [
    {
      header: 'Client Name / OS',
      accessor: (row: NetworkClient) => (
        <div className="flex items-center space-x-3 text-left">
          <div className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/40 dark:border-slate-800/40 flex items-center justify-center">
            {row.connectionType === 'wireless' ? (
              <Wifi className="h-4.5 w-4.5 text-cyan-400" />
            ) : (
              <Laptop className="h-4.5 w-4.5 text-indigo-400" />
            )}
          </div>
          <div>
            <span className="font-bold text-slate-800 dark:text-slate-200">{row.name}</span>
            <p className="text-[10px] text-slate-400 mt-0.5">{row.os}</p>
          </div>
        </div>
      ),
      sortable: true
    },
    {
      header: 'Connection Type',
      accessor: (row: NetworkClient) => (
        <span className="capitalize font-bold text-xs">
          {row.connectionType}
        </span>
      ),
      sortable: true,
      filterKey: 'connectionType' as any
    },
    {
      header: 'IP Address',
      accessor: 'ipAddress',
      sortable: true
    },
    {
      header: 'MAC Address',
      accessor: 'macAddress',
      sortable: true
    },
    {
      header: 'VLAN Index',
      accessor: (row: NetworkClient) => (
        <span className="font-mono font-bold bg-slate-500/5 px-2 py-0.5 rounded text-xs text-slate-500 border border-slate-200/20">
          VLAN {row.vlanId}
        </span>
      ),
      sortable: true
    },
    {
      header: 'Bandwidth rates',
      accessor: (row: NetworkClient) => (
        <div className="flex items-center space-x-2 text-xs font-mono">
          <span className="flex items-center text-emerald-500"><ArrowDown className="h-3 w-3 mr-0.5" />{row.rxRate.toFixed(1)}M</span>
          <span className="flex items-center text-blue-500"><ArrowUp className="h-3 w-3 mr-0.5" />{row.txRate.toFixed(1)}M</span>
        </div>
      ),
      sortable: true
    },
    {
      header: 'Diagnostics Signal',
      accessor: (row: NetworkClient) => (
        <span className={getSignalColor(row.signalStrength)}>
          {row.signalStrength !== undefined ? `${row.signalStrength} dBm` : 'Ethernet'}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-left">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-400 rounded-xl flex items-center justify-center">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white m-0">
              Active Client Management
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Review and moderate subnet allocations, rate limits, and block/quarantine rules on users devices.
            </p>
          </div>
        </div>
      </div>

      {/* Quick filters */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-px overflow-x-auto text-xs shrink-0 select-none">
        {[
          { id: 'all', label: 'All Connected Clients', count: clients.length },
          { id: 'wireless', label: 'WiFi Connections', count: clients.filter(c => c.connectionType === 'wireless').length },
          { id: 'wired', label: 'Wired Ethernet', count: clients.filter(c => c.connectionType === 'wired').length }
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setConnectionFilter(item.id as any)}
            className={`px-4 py-2 border-b-2 font-bold transition-all shrink-0 cursor-pointer ${
              connectionFilter === item.id 
                ? 'border-brand-500 text-brand-500 font-bold' 
                : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium'
            }`}
          >
            {item.label} <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900 text-[9px] text-slate-500">{item.count}</span>
          </button>
        ))}
      </div>

      {/* Clients Table */}
      <Card className="p-0 overflow-hidden">
        <Table
          columns={columns}
          data={filteredClients}
          searchKeys={['name', 'ipAddress', 'macAddress', 'os']}
          searchPlaceholder="Search client by name, IP, MAC address or OS..."
          defaultSortField="name"
          onRowClick={handleRowClick}
        />
      </Card>

      {/* Slide-out Client Inspector Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => { setIsDrawerOpen(false); setSelectedClientId(null); }}
        title={selectedClient?.name || 'Client Details'}
      >
        {selectedClient ? (
          <div className="flex flex-col h-full space-y-6 text-left">
            {/* Header info */}
            <div className="border-b border-slate-200/50 dark:border-slate-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-slate-500/5 border border-slate-200/20 flex items-center justify-center">
                  {selectedClient.connectionType === 'wireless' ? <Wifi className="h-5 w-5 text-cyan-400" /> : <Laptop className="h-5 w-5 text-indigo-400" />}
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm font-sans">{selectedClient.name}</h4>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">{selectedClient.os} | MAC: {selectedClient.macAddress}</p>
                </div>
              </div>
            </div>

            {/* Diagnostic stats */}
            <div className="space-y-4 flex-1 overflow-y-auto">
              <div className="p-4 bg-slate-500/5 border border-slate-200/10 rounded-2xl space-y-2.5 font-mono text-xs">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Session Telemetry</h4>
                <div className="grid grid-cols-2">
                  <span className="text-slate-500">IP Subnet:</span>
                  <span className="text-slate-800 dark:text-slate-200 text-right font-semibold">{selectedClient.ipAddress}</span>
                </div>
                <div className="grid grid-cols-2">
                  <span className="text-slate-500">Bound VLAN:</span>
                  <span className="text-slate-800 dark:text-slate-200 text-right font-semibold">VLAN {selectedClient.vlanId}</span>
                </div>
                <div className="grid grid-cols-2">
                  <span className="text-slate-500">Connection Point:</span>
                  <span className="text-brand-500 text-right font-bold font-mono">
                    {selectedClient.connectedToDeviceName || 'Core Stack'}
                  </span>
                </div>
                <div className="grid grid-cols-2">
                  <span className="text-slate-500">Bandwidth (Down/Up):</span>
                  <span className="text-slate-800 dark:text-slate-200 text-right font-semibold">
                    {selectedClient.rxRate.toFixed(1)} / {selectedClient.txRate.toFixed(1)} Mbps
                  </span>
                </div>
                {selectedClient.signalStrength !== undefined && (
                  <div className="grid grid-cols-2">
                    <span className="text-slate-500">Signal Level:</span>
                    <span className={`text-right ${getSignalColor(selectedClient.signalStrength)}`}>
                      {selectedClient.signalStrength} dBm
                    </span>
                  </div>
                )}
              </div>

              {/* Bandwidth throttle limit sliders */}
              <div className="space-y-3 p-4 border border-slate-200/50 dark:border-slate-800/85 rounded-2xl bg-slate-500/5">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans flex items-center gap-1"><Sliders className="h-4 w-4 text-brand-500" /> Bandwidth Limiters</h4>
                <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                  <div className="space-y-1">
                    <span className="text-slate-500">Download (Rx Mbps)</span>
                    <input
                      type="number"
                      disabled={isReadOnly}
                      value={limitRxInput}
                      onChange={(e) => setLimitRxInput(Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500">Upload (Tx Mbps)</span>
                    <input
                      type="number"
                      disabled={isReadOnly}
                      value={limitTxInput}
                      onChange={(e) => setLimitTxInput(Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                    />
                  </div>
                </div>
                {!isReadOnly && (
                  <Button variant="outline" onClick={handleRateLimit} className="w-full text-xs font-bold py-1.5 mt-2">
                    Apply Limit Profiles
                  </Button>
                )}
              </div>

              {/* Quarantine status indicator warning */}
              {selectedClient.vlanId === 40 && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-xs flex gap-2">
                  <ShieldAlert className="h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-bold">Device Quarantined</p>
                    <p className="mt-0.5">This device is isolated in the VLAN 40 subnet due to threat signature detection loops.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Subnet operator override controls */}
            <div className="border-t border-slate-200/50 dark:border-slate-800/80 pt-4 space-y-2 shrink-0">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Moderator Actions</h4>
              <div className="grid grid-cols-2 gap-2">
                {!isReadOnly && (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleDisconnect}
                      className="flex items-center justify-center gap-1 text-xs"
                    >
                      <XCircle className="h-4 w-4" /> Disconnect Session
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleBlock}
                      className="flex items-center justify-center gap-1 text-xs text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/30"
                    >
                      <Ban className="h-4 w-4" /> Block Device MAC
                    </Button>
                    {selectedClient.vlanId === 40 ? (
                      <Button
                        variant="primary"
                        onClick={handleWhitelist}
                        className="col-span-2 text-xs flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle className="h-4 w-4" /> Release & De-quarantine Client
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={handleQuarantine}
                        className="col-span-2 text-xs flex items-center justify-center gap-1 text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/30"
                      >
                        <ShieldAlert className="h-4 w-4" /> Force Quarantine Isolation
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
};
export default ClientManager;
