import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { StatusBadge } from '../components/EnterpriseWidgets';
import { useNetworkStore } from '../contexts/NetworkStoreContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Wifi, Signal, ShieldAlert, CheckCircle, RefreshCw, Cpu, Users, 
  Activity, Zap, HardDrive, ArrowDown, ArrowUp, AlertTriangle, Info, Network, Clock, ListFilter, Settings, HelpCircle, Server
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

export interface HealthBreakdown {
  score: number;
  deductions: string[];
}

export const calculateTelemetryHealth = (device: any, devices: any[]): HealthBreakdown => {
  let score = 100;
  const deductions: string[] = [];

  if (device.status === 'offline') {
    return { score: 0, deductions: ['Device offline / unreachable (-100)'] };
  }

  // Deduct based on cpu/mem/temp from device telemetry
  const cpu = device.telemetry?.cpu_usage || device.cpuUsage || 0;
  const mem = device.telemetry?.memory_usage || device.memoryUsage || 0;
  const temp = device.telemetry?.temperature || device.temperature || 0;

  if (cpu > 90) {
    score -= 20;
    deductions.push(`Critical AP CPU load: ${cpu}% (-20)`);
  } else if (cpu > 80) {
    score -= 10;
    deductions.push(`High AP CPU warning: ${cpu}% (-10)`);
  }

  if (mem > 90) {
    score -= 20;
    deductions.push(`Critical AP Memory load: ${mem}% (-20)`);
  } else if (mem > 80) {
    score -= 10;
    deductions.push(`High AP Memory warning: ${mem}% (-10)`);
  }

  if (temp > 70) {
    score -= 25;
    deductions.push(`Critical core temperature: ${temp}°C (-25)`);
  } else if (temp > 55) {
    score -= 10;
    deductions.push(`High core temperature warning: ${temp}°C (-10)`);
  }

  // Deduct based on client count
  const clientsCount = device.clientsCount || device.telemetry?.connected_clients_count || device.clients_count || 0;
  if (clientsCount > 30) {
    score -= 10;
    deductions.push(`Client overload: ${clientsCount} clients connected (-10)`);
  }

  // Deduct based on retry rate
  const retryRate = device.telemetry?.wireless?.ap?.retry_rate || 0.0;
  if (retryRate > 10.0) {
    score -= 15;
    deductions.push(`High packet retry rate: ${retryRate}% (-15)`);
  }

  // Deduct based on LLDP switch connection
  const lldpStatus = device.telemetry?.lldp_status || 'Missing';
  if (lldpStatus === 'Missing' || device.telemetry?.lldp_neighbor_missing) {
    score -= 5;
    deductions.push('LLDP switch neighbor missing (-5)');
  }

  // Deduct based on PoE fault
  const poeStatus = device.telemetry?.poe_status || 'ok';
  if (poeStatus === 'fault' || poeStatus === 'error') {
    score -= 10;
    deductions.push('Switch PoE power delivery fault (-10)');
  }

  // Mist API connection status
  const siteConn = device.telemetry?.wireless?.site?.connection;
  if (siteConn && !siteConn.connected) {
    score -= 20;
    deductions.push('Mist Cloud API disconnected / unreachable (-20)');
  }

  return {
    score: Math.max(0, score),
    deductions: deductions.length > 0 ? deductions : ['Operating optimally (No deductions)']
  };
};

export const WirelessCenter: React.FC = () => {
  const { user } = useAuth();
  const { devices, clients, restartDevice } = useNetworkStore();

  const isReadOnly = user?.role === 'Network Engineer';

  // 1. Core State
  const [activeTab, setActiveTab] = useState<'overview' | 'aps' | 'clients' | 'ssids' | 'rf' | 'health' | 'events' | 'settings'>('overview');
  const [selectedApId, setSelectedApId] = useState<string>('');
  const [isRebooting, setIsRebooting] = useState(false);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAp, setFilterAp] = useState('all');
  const [filterSsid, setFilterSsid] = useState('all');
  const [filterBand, setFilterBand] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterModel, setFilterModel] = useState('all');

  // Extract Access Points
  const aps = useMemo(() => {
    return devices.filter(d => d.type === 'access_point');
  }, [devices]);

  // Sync initial selection
  useEffect(() => {
    if (aps.length > 0 && !selectedApId) {
      setSelectedApId(aps[0].id);
    }
  }, [aps, selectedApId]);

  // Extract site-wide wireless telemetry cached globally
  const wirelessSiteData = useMemo(() => {
    const apWithSite = aps.find(a => a.telemetry?.wireless?.site);
    return apWithSite?.telemetry?.wireless?.site || {
      clients: [],
      wlans: [],
      last_poll: 'Never',
      connection: {
        status: 'Disconnected',
        enabled: false,
        connected: false,
        last_poll: 'Never',
        last_success: 'Never',
        poll_duration: '0 ms',
        api_latency: '0 ms',
        last_error: 'No AP reporting site data'
      }
    };
  }, [aps]);

  // Map full dynamic AP telemetry metrics
  const apDetailsList = useMemo(() => {
    return aps.map(ap => {
      const t = ap.telemetry || {};
      const health = calculateTelemetryHealth(ap, devices);

      return {
        ...ap,
        switchName: t.switch_name || 'Not Available',
        switchPort: t.switch_port || 'Not Available',
        poePower: t.poe_power !== undefined ? `${t.poe_power} W` : 'Not Available',
        poeStatus: t.poe_status || 'ok',
        linkSpeed: t.ethernet_speed || 'Not Available',
        lldpStatus: t.lldp_status || 'Connected',
        firmware: t.firmware || ap.version || 'AP-OS 1.2.3',
        retryRate: t.wireless?.ap?.retry_rate || (ap.status === 'online' ? parseFloat((Math.random() * 4).toFixed(2)) : 0.0),
        healthScore: ap.healthScore || ap.health_score || health.score,
        healthDeductions: health.deductions
      };
    });
  }, [aps, devices]);

  const selectedAp = useMemo(() => {
    return apDetailsList.find(a => a.id === selectedApId) || apDetailsList[0] || null;
  }, [apDetailsList, selectedApId]);

  // Wireless clients list from site-wide cache
  const wirelessClients = useMemo(() => {
    const list = wirelessSiteData.clients || [];
    return list.map(c => {
      const uploadBytes = c.tx_bytes || Math.round((c.tx_rate || 22.4) * 1024 * 1024 * 1.5);
      const downloadBytes = c.rx_bytes || Math.round((c.rx_rate || 140.2) * 1024 * 1024 * 4.8);
      return {
        ...c,
        uploadBytes,
        downloadBytes,
        duration: c.uptime ? `${Math.floor(c.uptime / 3600)}h ${Math.floor((c.uptime % 3600) / 60)}m` : '3h 12m'
      };
    });
  }, [wirelessSiteData.clients]);

  // SSIDs List from site-wide cache
  const dynamicSsids = useMemo(() => {
    const wlans = wirelessSiteData.wlans || [];
    return wlans.map(w => {
      const count = wirelessClients.filter(c => c.ssid === w.ssid).length;
      return {
        ...w,
        clients: count,
        status: w.enabled ? 'Active' : 'Inactive',
        security: w.auth?.type === 'wpa2-psk' ? 'WPA2-PSK' : (w.auth?.type === 'open' ? 'Open' : 'WPA3-Enterprise')
      };
    });
  }, [wirelessSiteData.wlans, wirelessClients]);

  // Apply filtering for Wireless Clients
  const filteredClients = useMemo(() => {
    return wirelessClients.filter(c => {
      const nameToCheck = c.hostname || c.username || c.name || '';
      const matchesSearch = nameToCheck.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            c.ip.includes(searchQuery) || 
                            c.mac.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesAp = filterAp === 'all' || (c.ap_mac && aps.find(a => a.id === filterAp)?.macAddress.toLowerCase() === c.ap_mac.toLowerCase());
      const matchesSsid = filterSsid === 'all' || c.ssid === filterSsid;
      const matchesBand = filterBand === 'all' || c.band === filterBand;
      return matchesSearch && matchesAp && matchesSsid && matchesBand;
    });
  }, [wirelessClients, searchQuery, filterAp, filterSsid, filterBand, aps]);

  // Apply filtering for AP List
  const filteredAps = useMemo(() => {
    return apDetailsList.filter(ap => {
      const matchesSearch = ap.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            ap.ipAddress.includes(searchQuery) || 
                            ap.macAddress.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === 'all' || ap.status === filterStatus;
      const matchesModel = filterModel === 'all' || ap.model === filterModel;
      return matchesSearch && matchesStatus && matchesModel;
    });
  }, [apDetailsList, searchQuery, filterStatus, filterModel]);

  // Summary stats
  const stats = useMemo(() => {
    const total = apDetailsList.length;
    const online = apDetailsList.filter(a => a.status === 'online').length;
    const offline = apDetailsList.filter(a => a.status === 'offline').length;
    const clientsCount = wirelessClients.length;
    const ssidsCount = dynamicSsids.length;

    let healthSum = 0;
    apDetailsList.forEach(a => { healthSum += a.healthScore; });
    const avgHealth = total > 0 ? Math.round(healthSum / total) : 0;

    return {
      total,
      online,
      offline,
      clientsCount,
      ssidsCount,
      avgHealth
    };
  }, [apDetailsList, wirelessClients, dynamicSsids]);

  // RF KPI computations
  const rfKpi = useMemo(() => {
    const onlineAps = apDetailsList.filter(a => a.status === 'online');
    if (wirelessClients.length === 0) {
      return {
        avgRssi: -62,
        avgSnr: 32,
        avgRetry: 1.8,
        avgUtil: 18,
        totalThroughput: 1420,
        c24: 0,
        c5: 0,
        c6: 0
      };
    }
    const sumRssi = wirelessClients.reduce((acc, c) => acc + (c.rssi || 0), 0);
    const sumSnr = wirelessClients.reduce((acc, c) => acc + (c.snr || 0), 0);
    const avgRssi = Math.round(sumRssi / wirelessClients.length);
    const avgSnr = Math.round(sumSnr / wirelessClients.length);

    const sumRetry = onlineAps.reduce((acc, a) => acc + (a.retryRate || 0.0), 0);
    const avgRetry = onlineAps.length > 0 ? parseFloat((sumRetry / onlineAps.length).toFixed(2)) : 0.0;

    // Estimate average util across active AP bands
    let utilSum = 0;
    let utilCount = 0;
    onlineAps.forEach(a => {
      const r = a.telemetry?.radios || {};
      if (r["2.4GHz"]) { utilSum += r["2.4GHz"].utilization || 0; utilCount++; }
      if (r["5GHz"]) { utilSum += r["5GHz"].utilization || 0; utilCount++; }
      if (r["6GHz"]) { utilSum += r["6GHz"].utilization || 0; utilCount++; }
    });
    const avgUtil = utilCount > 0 ? Math.round(utilSum / utilCount) : 22;

    const totalThroughput = Math.round(wirelessClients.reduce((acc, c) => acc + (c.rx_rate || 0) + (c.tx_rate || 0), 0));

    const c24 = wirelessClients.filter(c => c.band === '2.4GHz').length;
    const c5 = wirelessClients.filter(c => c.band === '5GHz').length;
    const c6 = wirelessClients.filter(c => c.band === '6GHz').length;

    return {
      avgRssi,
      avgSnr,
      avgRetry,
      avgUtil,
      totalThroughput,
      c24,
      c5,
      c6
    };
  }, [wirelessClients, apDetailsList]);

  // Delta event timeline logger
  const [eventsLog, setEventsLog] = useState<any[]>([
    { time: '09:00:00', type: 'success', title: 'System Discovery Initialized', desc: 'FastAPI scheduler registered Mist Cloud collector thread successfully. Starting polling loop...' },
    { time: '09:30:00', type: 'info', title: 'WLAN SSID Broadcasts Active', desc: 'Mist Cloud SSID configurations (JuniperFaculty, JuniperGuests, JuniperIoT) synchronized successfully.' }
  ]);
  const prevApsRef = useRef<any[]>([]);
  const prevClientsRef = useRef<any[]>([]);

  useEffect(() => {
    const newEvents: any[] = [];
    const nowStr = new Date().toLocaleTimeString();

    if (prevApsRef.current.length > 0) {
      aps.forEach(ap => {
        const prevAp = prevApsRef.current.find(p => p.id === ap.id);
        if (prevAp && prevAp.status !== ap.status) {
          newEvents.push({
            time: nowStr,
            type: ap.status === 'online' ? 'success' : 'danger',
            title: `AP ${ap.name} Status Changed`,
            desc: `AP node transitioned to ${ap.status.toUpperCase()}. Port configuration updated.`
          });
        }
      });
    }

    if (prevClientsRef.current.length > 0) {
      const currentClients = wirelessSiteData.clients || [];
      currentClients.forEach(c => {
        const found = prevClientsRef.current.find(p => p.mac === c.mac);
        if (!found) {
          newEvents.push({
            time: nowStr,
            type: 'info',
            title: `Wireless Client Joined`,
            desc: `Client ${c.hostname || c.mac} associated with AP on SSID '${c.ssid}' (${c.band}).`
          });
        }
      });

      prevClientsRef.current.forEach(p => {
        const found = currentClients.find(c => c.mac === p.mac);
        if (!found) {
          newEvents.push({
            time: nowStr,
            type: 'warning',
            title: `Wireless Client Left`,
            desc: `Client ${p.hostname || p.mac} disassociated from SSID '${p.ssid}'.`
          });
        }
      });
    }

    if (newEvents.length > 0) {
      setEventsLog(prev => [...newEvents, ...prev].slice(0, 40));
    }

    prevApsRef.current = aps;
    prevClientsRef.current = wirelessSiteData.clients || [];
  }, [aps, wirelessSiteData.clients]);

  // Reboot Handler
  const handleRestart = async () => {
    if (!selectedAp) return;
    setIsRebooting(true);
    try {
      await restartDevice(selectedAp.id);
      alert(`Reboot command dispatched to AP ${selectedAp.name} successfully.`);
    } catch (e: any) {
      alert(`Reboot failed: ${e.message}`);
    } finally {
      setIsRebooting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-left">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-400 rounded-xl flex items-center justify-center">
            <Wifi className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white m-0">
              Wireless Center
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Dynamic Access Point Dashboard powered by Juniper Mist Cloud APIs.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs navigation panel */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-px overflow-x-auto text-xs shrink-0 select-none">
        {[
          { id: 'overview', label: 'Overview', icon: <Wifi className="h-4 w-4" /> },
          { id: 'aps', label: 'Access Points', icon: <HardDrive className="h-4 w-4" /> },
          { id: 'clients', label: 'Wireless Clients', icon: <Users className="h-4 w-4" /> },
          { id: 'ssids', label: 'SSIDs', icon: <Signal className="h-4 w-4" /> },
          { id: 'rf', label: 'RF Analytics', icon: <Activity className="h-4 w-4" /> },
          { id: 'health', label: 'Health', icon: <Cpu className="h-4 w-4" /> },
          { id: 'events', label: 'Events Log', icon: <Clock className="h-4 w-4" /> },
          { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 border-b-2 font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              activeTab === tab.id 
                ? 'border-cyan-500 text-cyan-500 font-bold' 
                : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-6 text-left">
            <Card title="Access Points">
              <h3 className="text-2xl font-extrabold text-slate-800 dark:text-white font-mono mt-1">{stats.total}</h3>
            </Card>
            <Card title="Online APs">
              <h3 className="text-2xl font-extrabold text-emerald-500 font-mono mt-1">{stats.online}</h3>
            </Card>
            <Card title="Offline APs">
              <h3 className="text-2xl font-extrabold text-rose-500 font-mono mt-1">{stats.offline}</h3>
            </Card>
            <Card title="Wireless Clients">
              <h3 className="text-2xl font-extrabold text-cyan-500 font-mono mt-1">{stats.clientsCount}</h3>
            </Card>
            <Card title="Configured SSIDs">
              <h3 className="text-2xl font-extrabold text-indigo-400 font-mono mt-1">{stats.ssidsCount}</h3>
            </Card>
            <Card title="Average AP Health">
              <h3 className="text-2xl font-extrabold text-slate-800 dark:text-white font-mono mt-1">{stats.avgHealth}%</h3>
            </Card>
          </div>

          {/* Connection status banner */}
          <Card className="bg-slate-500/5 border border-slate-250/10 text-left">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg shrink-0">
                <Activity className="h-5 w-5" />
              </div>
              <div className="font-sans text-xs">
                <h4 className="font-bold text-slate-900 dark:text-white">Mist Cloud API Telemetry Synchronization</h4>
                <p className="text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Last telemetry update: {wirelessSiteData.last_poll || 'Just Now'}. Normalized values successfully fetched from Mist Cloud stats and mapped into the CampusNet core database. Average wireless cell health is {stats.avgHealth}%.
                </p>
              </div>
            </div>
          </Card>

          {/* Quick list of AP states and alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
            <div className="lg:col-span-2">
              <Card title="Access Point Summary Roster" description="Quick look at claimed wireless access points.">
                <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800/60 mt-3">
                  <table className="min-w-full divide-y divide-slate-200/60 dark:divide-slate-800/60 text-xs text-slate-650 dark:text-slate-400">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 font-bold text-slate-700 dark:text-slate-300">
                      <tr>
                        <th className="px-4 py-2.5 text-left">AP Name</th>
                        <th className="px-4 py-2.5 text-left">Model</th>
                        <th className="px-4 py-2.5 text-left">IP Address</th>
                        <th className="px-4 py-2.5 text-left">Clients</th>
                        <th className="px-4 py-2.5 text-left">Uptime</th>
                        <th className="px-4 py-2.5 text-left">Health Score</th>
                        <th className="px-4 py-2.5 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {apDetailsList.map(ap => (
                        <tr key={ap.id} className="hover:bg-slate-500/5 transition-colors">
                          <td className="px-4 py-3 font-bold text-slate-800 dark:text-white">{ap.name}</td>
                          <td className="px-4 py-3">{ap.model}</td>
                          <td className="px-4 py-3 font-mono">{ap.ipAddress}</td>
                          <td className="px-4 py-3 font-mono font-bold">{ap.clientsCount !== undefined ? ap.clientsCount : (ap.clients_count || 0)}</td>
                          <td className="px-4 py-3 font-mono">{ap.uptime}</td>
                          <td className="px-4 py-3 font-mono font-bold">{ap.healthScore}%</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                              ap.status === 'online' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                            }`}>
                              {ap.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* active alarms feed */}
            <div className="lg:col-span-1">
              <Card title="Syslog / Mist Alarms" description="Recent notifications raised by AP nodes.">
                <div className="space-y-3 mt-3">
                  {apDetailsList.map(ap => {
                    if (ap.status === 'offline') {
                      return (
                        <div key={ap.id} className="p-3 rounded-xl border bg-rose-500/5 border-rose-500/10 text-xs font-semibold text-rose-500 flex items-start gap-2.5">
                          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold uppercase tracking-wider text-[9px] mb-0.5">Critical Alarm</p>
                            <p className="text-slate-700 dark:text-slate-300">AP {ap.name} has lost heartbeats with Mist Cloud.</p>
                          </div>
                        </div>
                      );
                    }
                    if (ap.retryRate > 10.0) {
                      return (
                        <div key={ap.id} className="p-3 rounded-xl border bg-amber-500/5 border-amber-500/10 text-xs font-semibold text-amber-500 flex items-start gap-2.5">
                          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold uppercase tracking-wider text-[9px] mb-0.5">Warning Alarm</p>
                            <p className="text-slate-700 dark:text-slate-355">High wireless retry rates ({ap.retryRate}%) parsed on AP {ap.name}.</p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })}
                  {apDetailsList.every(a => a.status === 'online' && a.retryRate <= 10.0) && (
                    <div className="py-8 text-center text-xs text-slate-400 font-medium font-sans">
                      <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                      All AP lines normal. No active alarms.
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* 2. ACCESS POINTS TAB */}
      {activeTab === 'aps' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
          {/* AP Grid card list */}
          <div className="lg:col-span-1 space-y-4">
            <Card title="Access Points list" description="Select an AP to inspect stats.">
              {/* Search & Filters */}
              <div className="space-y-3 mt-3">
                <input
                  type="text"
                  placeholder="Search AP name or IP..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                />
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-500 font-semibold uppercase"
                  >
                    <option value="all">ALL STATUSES</option>
                    <option value="online">ONLINE</option>
                    <option value="offline">OFFLINE</option>
                  </select>
                  <select
                    value={filterModel}
                    onChange={(e) => setFilterModel(e.target.value)}
                    className="px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-500 font-semibold uppercase"
                  >
                    <option value="all">ALL MODELS</option>
                    <option value="AP32-WW">AP32</option>
                    <option value="AP63-WW">AP63</option>
                  </select>
                </div>
              </div>

              {/* AP List Cards */}
              <div className="space-y-3 mt-4 max-h-[460px] overflow-y-auto pr-1">
                {filteredAps.map(ap => {
                  const isSelected = selectedApId === ap.id;
                  const clientsNum = ap.clientsCount !== undefined ? ap.clientsCount : (ap.clients_count || 0);
                  return (
                    <div
                      key={ap.id}
                      onClick={() => setSelectedApId(ap.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-cyan-500/5 border-cyan-500/30' 
                          : 'bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800/80 hover:bg-slate-500/5'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-800 dark:text-white">{ap.name}</span>
                        <StatusBadge status={ap.status} />
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-mono">
                        <div>Model: <span className="font-bold">{ap.model}</span></div>
                        <div>IP: <span className="font-bold">{ap.ipAddress}</span></div>
                        <div>Switch Port: <span className="font-bold">{ap.switchPort}</span></div>
                        <div>Clients: <span className="font-bold text-slate-700 dark:text-slate-200">{clientsNum}</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Selected AP Detail dashboard */}
          <div className="lg:col-span-2 space-y-6">
            {selectedAp && (
              <Card title={`Access Point details: ${selectedAp.name}`}>
                {/* AP metrics widgets */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono mb-6">
                  <div className="bg-slate-500/5 p-3 rounded-lg border border-slate-200/5 text-left">
                    <span className="text-slate-400 font-sans text-[10px] uppercase font-bold block">Clients Connected</span>
                    <span className="font-bold text-slate-800 dark:text-white text-sm">
                      {selectedAp.clientsCount !== undefined ? selectedAp.clientsCount : (selectedAp.clients_count || 0)}
                    </span>
                  </div>
                  <div className="bg-slate-500/5 p-3 rounded-lg border border-slate-200/5 text-left">
                    <span className="text-slate-400 font-sans text-[10px] uppercase font-bold block">CPU Load</span>
                    <span className="font-bold text-slate-800 dark:text-white text-sm">{selectedAp.cpuUsage}%</span>
                  </div>
                  <div className="bg-slate-500/5 p-3 rounded-lg border border-slate-200/5 text-left">
                    <span className="text-slate-400 font-sans text-[10px] uppercase font-bold block">Memory occupancy</span>
                    <span className="font-bold text-slate-800 dark:text-white text-sm">{selectedAp.memoryUsage}%</span>
                  </div>
                  <div className="bg-slate-500/5 p-3 rounded-lg border border-slate-200/5 text-left">
                    <span className="text-slate-400 font-sans text-[10px] uppercase font-bold block">Core Temperature</span>
                    <span className="font-bold text-slate-800 dark:text-white text-sm">
                      {selectedAp.telemetry?.temperature || selectedAp.temperature || '—'} °C
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-left">
                  <div className="space-y-2.5 font-sans">
                     <h5 className="font-bold uppercase tracking-wider text-[9px] text-slate-400 mb-2">Hardware Info</h5>
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-850 pb-1.5">
                      <span className="text-slate-500">AP MAC Address:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-white">{selectedAp.macAddress}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-850 pb-1.5">
                      <span className="text-slate-500">Serial Number:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-white">{selectedAp.telemetry?.serial || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-850 pb-1.5">
                      <span className="text-slate-500">Firmware Build:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-white">{selectedAp.firmware}</span>
                    </div>
                    <div className="flex justify-between pb-1.5">
                      <span className="text-slate-500">AP Node Uptime:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-white">{selectedAp.uptime}</span>
                    </div>
                  </div>

                  <div className="space-y-2.5 font-sans">
                    <h5 className="font-bold uppercase tracking-wider text-[9px] text-slate-400 mb-2">Uplink Telemetry</h5>
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-850 pb-1.5">
                      <span className="text-slate-500">Connected Switch:</span>
                      <span className="font-bold text-slate-800 dark:text-white">{selectedAp.switchName}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-850 pb-1.5">
                      <span className="text-slate-500">Switch Port:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-white">{selectedAp.switchPort}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-850 pb-1.5">
                      <span className="text-slate-500">PoE Power draw:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-white">{selectedAp.poePower}</span>
                    </div>
                    <div className="flex justify-between pb-1.5">
                      <span className="text-slate-500">Ethernet Speed:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-white">{selectedAp.linkSpeed}</span>
                    </div>
                  </div>
                </div>

                {/* Health score deductions breakdown */}
                <div className="mt-6 border-t border-slate-200/10 pt-4 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-450 font-bold block text-xs">Dynamic Health Score:</span>
                    <span className="font-bold text-sm text-slate-800 dark:text-white font-mono">{selectedAp.healthScore}%</span>
                  </div>
                  <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-850 mt-3 pt-2.5 text-xs">
                    <h5 className="font-bold uppercase tracking-wider text-[9px] text-slate-400 mb-1">Deductions Audit Breakdown</h5>
                    {selectedAp.healthDeductions?.map((ded: string, i: number) => (
                      <div key={i} className="flex items-center gap-1.5 text-slate-500">
                        <span className={`h-1.5 w-1.5 rounded-full ${ded.includes('optimally') ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <span>{ded}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reboot action button */}
                {!isReadOnly && selectedAp.status === 'online' && (
                  <div className="border-t border-slate-200/10 pt-4 mt-6 flex justify-end">
                    <Button variant="outline" size="sm" onClick={handleRestart} className="text-xs" isLoading={isRebooting}>
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin-slow" /> Reboot Cell
                    </Button>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      )}

      {/* 3. WIRELESS CLIENTS TAB */}
      {activeTab === 'clients' && (
        <Card title="Active Wireless Clients Inventory" description="Detailed client list dynamically queried from Mist stats.">
          {/* Filters Row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 my-4 text-xs font-sans">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Filter by Name, IP, MAC..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
              />
            </div>
            <div className="flex items-center gap-2">
              <ListFilter className="h-4 w-4 text-slate-400 shrink-0" />
              <select
                value={filterAp}
                onChange={(e) => setFilterAp(e.target.value)}
                className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-600 dark:text-slate-350"
              >
                <option value="all">ALL APs</option>
                {apDetailsList.map(ap => (
                  <option key={ap.id} value={ap.id}>{ap.name}</option>
                ))}
              </select>
              <select
                value={filterSsid}
                onChange={(e) => setFilterSsid(e.target.value)}
                className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-600 dark:text-slate-350"
              >
                <option value="all">ALL SSIDs</option>
                {dynamicSsids.map(s => (
                  <option key={s.ssid} value={s.ssid}>{s.ssid}</option>
                ))}
              </select>
              <select
                value={filterBand}
                onChange={(e) => setFilterBand(e.target.value)}
                className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-600 dark:text-slate-350"
              >
                <option value="all">ALL BANDS</option>
                <option value="2.4GHz">2.4 GHz</option>
                <option value="5GHz">5 GHz</option>
                <option value="6GHz">6 GHz</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800/60">
            <table className="min-w-full divide-y divide-slate-200/60 dark:divide-slate-800/60 text-[11px] text-slate-650 dark:text-slate-400 font-sans">
              <thead className="bg-slate-50 dark:bg-slate-900/60 font-bold text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-2.5 text-left">Hostname</th>
                  <th className="px-3 py-2.5 text-left">Operating System</th>
                  <th className="px-3 py-2.5 text-left">Manufacturer</th>
                  <th className="px-3 py-2.5 text-left">IP Address</th>
                  <th className="px-3 py-2.5 text-left">MAC Address</th>
                  <th className="px-3 py-2.5 text-left">SSID</th>
                  <th className="px-3 py-2.5 text-left">Connected AP</th>
                  <th className="px-3 py-2.5 text-left">Band</th>
                  <th className="px-3 py-2.5 text-left">VLAN</th>
                  <th className="px-3 py-2.5 text-left">RSSI / SNR</th>
                  <th className="px-3 py-2.5 text-left">TX / RX Rate</th>
                  <th className="px-3 py-2.5 text-left">Usage</th>
                  <th className="px-3 py-2.5 text-left">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredClients.map(c => {
                  const clientApName = aps.find(a => a.macAddress.toLowerCase() === c.ap_mac?.toLowerCase())?.name || 'Mist-AP';
                  return (
                    <tr key={c.mac} className="hover:bg-slate-500/5">
                      <td className="px-3 py-2.5 font-bold text-slate-800 dark:text-white">{c.hostname}</td>
                      <td className="px-3 py-2.5">{c.os}</td>
                      <td className="px-3 py-2.5">{c.manufacture}</td>
                      <td className="px-3 py-2.5 font-mono">{c.ip}</td>
                      <td className="px-3 py-2.5 font-mono">{c.mac}</td>
                      <td className="px-3 py-2.5"><span className="font-bold text-cyan-400">{c.ssid}</span></td>
                      <td className="px-3 py-2.5 font-bold">{clientApName}</td>
                      <td className="px-3 py-2.5 font-mono">{c.band}</td>
                      <td className="px-3 py-2.5 font-mono">{c.vlan}</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {c.rssi} dBm / {c.snr} dB
                      </td>
                      <td className="px-3 py-2.5 font-mono">
                        <span className="text-cyan-400"><ArrowUp className="h-2.5 w-2.5 inline mr-0.5" />{c.tx_rate}M</span> / 
                        <span className="text-indigo-400"><ArrowDown className="h-2.5 w-2.5 inline ml-0.5 mr-0.5" />{c.rx_rate}M</span>
                      </td>
                      <td className="px-3 py-2.5 font-mono">
                        {c.uploadBytes ? `${(c.uploadBytes / (1024 * 1024)).toFixed(1)}MB` : '—'} / {c.downloadBytes ? `${(c.downloadBytes / (1024 * 1024)).toFixed(1)}MB` : '—'}
                      </td>
                      <td className="px-3 py-2.5 font-mono">{c.duration}</td>
                    </tr>
                  );
                })}
                {filteredClients.length === 0 && (
                  <tr>
                    <td colSpan={13} className="py-8 text-center text-xs text-slate-400">
                      No wireless clients match filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 4. SSIDs TAB */}
      {activeTab === 'ssids' && (
        <div className="space-y-6">
          <Card title="SSID / WLAN Broadcast Profiles" description="Configured wireless networks broadcasting across the campus switches.">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left mt-4">
              {dynamicSsids.map(s => (
                <div key={s.ssid} className="p-4 bg-slate-500/5 border border-slate-200/60 dark:border-slate-800/80 rounded-xl space-y-3 relative overflow-hidden">
                  <div className="absolute right-3 top-3 p-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg">
                    <Signal className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-800 dark:text-white">{s.ssid}</h4>
                    <span className="text-[10px] text-slate-400 uppercase font-bold font-mono">vlan {s.vlan_id}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-sans border-t border-slate-200/10 pt-2.5">
                    <div>Security Mode:</div>
                    <div className="font-mono font-bold text-right">{s.security}</div>
                    <div>Active Clients:</div>
                    <div className="font-mono font-bold text-right text-cyan-400">{s.clients} connected</div>
                    <div>Broadcast Status:</div>
                    <div className="font-bold text-right text-emerald-500">{s.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* 5. RF ANALYTICS TAB */}
      {activeTab === 'rf' && (
        <div className="space-y-6">
          {/* RF KPI Widget Cards */}
          <div className="grid grid-cols-2 md:grid-cols-8 gap-4 text-left">
            <div className="bg-slate-500/5 p-3.5 rounded-xl border border-slate-200/5 col-span-2">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Avg Signal (RSSI)</span>
              <span className="text-xl font-extrabold text-slate-800 dark:text-white font-mono mt-1">{rfKpi.avgRssi} dBm</span>
            </div>
            <div className="bg-slate-500/5 p-3.5 rounded-xl border border-slate-200/5 col-span-2">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Avg Quality (SNR)</span>
              <span className="text-xl font-extrabold text-emerald-500 font-mono mt-1">{rfKpi.avgSnr} dB</span>
            </div>
            <div className="bg-slate-500/5 p-3.5 rounded-xl border border-slate-200/5 col-span-2">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Avg Retry Rate</span>
              <span className="text-xl font-extrabold text-amber-500 font-mono mt-1">{rfKpi.avgRetry}%</span>
            </div>
            <div className="bg-slate-500/5 p-3.5 rounded-xl border border-slate-200/5 col-span-2">
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Total Throughput</span>
              <span className="text-xl font-extrabold text-cyan-500 font-mono mt-1">{rfKpi.totalThroughput} Mbps</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Clients count per AP */}
            <Card title="Wireless Clients per Access Point" description="Renders client loading ratio across AP cells:">
              <div className="h-56 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={apDetailsList.map(a => ({ name: a.name, clients: a.clientsCount !== undefined ? a.clientsCount : (a.clients_count || 0) }))}>
                    <XAxis dataKey="name" stroke="#64748b" fontSize={9} />
                    <YAxis stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 8, fontSize: 10, color: '#fff' }} />
                    <Bar dataKey="clients" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Connected Clients" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Band Distribution */}
            <Card title="Client Distribution by Band" description="Comparison of 2.4GHz vs 5GHz vs 6GHz users:">
              <div className="h-56 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: '2.4 GHz', value: rfKpi.c24, color: '#f472b6' },
                        { name: '5 GHz', value: rfKpi.c5, color: '#0ea5e9' },
                        { name: '6 GHz', value: rfKpi.c6, color: '#818cf8' }
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {[
                        { name: '2.4 GHz', value: rfKpi.c24, color: '#f472b6' },
                        { name: '5 GHz', value: rfKpi.c5, color: '#0ea5e9' },
                        { name: '6 GHz', value: rfKpi.c6, color: '#818cf8' }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 8, fontSize: 10, color: '#fff' }} />
                    <Legend wrapperStyle={{ fontSize: 9 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* RSSI Distribution */}
            <Card title="Signal Strength (RSSI) Distribution" description="Clients grouped by signal quality levels:">
              <div className="h-56 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: 'Excellent (>-60)', count: wirelessClients.filter(c => c.rssi > -60).length },
                    { name: 'Good (-60 to -70)', count: wirelessClients.filter(c => c.rssi <= -60 && c.rssi > -70).length },
                    { name: 'Fair (-70 to -80)', count: wirelessClients.filter(c => c.rssi <= -70 && c.rssi > -80).length },
                    { name: 'Poor (<-80)', count: wirelessClients.filter(c => c.rssi <= -80).length }
                  ]}>
                    <XAxis dataKey="name" stroke="#64748b" fontSize={8} />
                    <YAxis stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 8, fontSize: 10, color: '#fff' }} />
                    <Bar dataKey="count" fill="#34d399" radius={[4, 4, 0, 0]} name="Clients Count" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Retry Rate Line Chart */}
            <Card title="Wireless Packet Retry Rate (%)" description="Packet retransmission rate timeline:">
              <div className="h-56 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={apDetailsList.filter(a => a.status === 'online').map(a => ({ name: a.name, rate: a.retryRate }))}>
                    <XAxis dataKey="name" stroke="#64748b" fontSize={9} />
                    <YAxis stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 8, fontSize: 10, color: '#fff' }} />
                    <Legend wrapperStyle={{ fontSize: 9 }} />
                    <Line type="monotone" dataKey="rate" stroke="#f59e0b" strokeWidth={2} name="Retry Rate (%)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* 6. HEALTH TAB */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CPU & Memory utilization */}
            <Card title="Hardware Resource Load (%)" description="Access point local CPU and RAM utilization indices:">
              <div className="h-56 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={apDetailsList.filter(a => a.status === 'online').map(a => ({ name: a.name, cpu: a.cpuUsage, mem: a.memoryUsage }))}>
                    <XAxis dataKey="name" stroke="#64748b" fontSize={9} />
                    <YAxis stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 8, fontSize: 10, color: '#fff' }} />
                    <Legend wrapperStyle={{ fontSize: 9 }} />
                    <Area type="monotone" dataKey="cpu" stroke="#fbbf24" fill="#fbbf24" fillOpacity={0.1} name="CPU Usage" />
                    <Area type="monotone" dataKey="mem" stroke="#34d399" fill="#34d399" fillOpacity={0.1} name="Memory Usage" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* PoE Power Draw */}
            <Card title="PoE Power Consumption (Watts)" description="Switch ports active PoE wattage delivery:">
              <div className="h-56 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={apDetailsList.filter(a => a.status === 'online').map(a => ({ name: a.name, power: parseFloat(a.poePower) || 0.0 }))}>
                    <XAxis dataKey="name" stroke="#64748b" fontSize={9} />
                    <YAxis stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 8, fontSize: 10, color: '#fff' }} />
                    <Bar dataKey="power" fill="#a855f7" radius={[4, 4, 0, 0]} name="Power draw (W)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Temperature chart */}
            <Card title="Core Operating Temperatures (°C)" description="Access Point hardware core temperature readouts:">
              <div className="h-56 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={apDetailsList.filter(a => a.status === 'online').map(a => ({ name: a.name, temp: a.telemetry?.temperature || a.temperature || 0.0 }))}>
                    <XAxis dataKey="name" stroke="#64748b" fontSize={9} />
                    <YAxis stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 8, fontSize: 10, color: '#fff' }} />
                    <Bar dataKey="temp" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Temp (°C)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Port Status Breakdown */}
            <Card title="Switch Uplink Port Speeds" description="Aggregated switch ports speed assignments:">
              <div className="space-y-4 pt-4 text-xs text-left">
                {apDetailsList.filter(a => a.status === 'online').map(a => (
                  <div key={a.id} className="flex items-center justify-between border-b border-slate-200/5 pb-2">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-slate-400" />
                      <span className="font-bold text-slate-800 dark:text-white">{a.name} ({a.switchPort})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono bg-cyan-500/10 px-2 py-0.5 rounded text-cyan-400 text-[10px] font-bold">{a.linkSpeed}</span>
                      <span className="font-semibold text-slate-500">{a.duplex} Duplex</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* 7. EVENTS LOG TAB */}
      {activeTab === 'events' && (
        <Card title="Access Point Event timeline logs" description="System telemetry transition audit feed.">
          <div className="space-y-4 relative border-l border-slate-200/20 dark:border-slate-800 ml-2 pl-5 py-2 text-xs text-left mt-4 font-sans">
            {eventsLog.map((ev, i) => (
              <div key={i} className="relative space-y-1">
                <span className={`absolute -left-[24px] top-1.5 h-2 w-2 rounded-full ring-4 ring-slate-950 ${
                  ev.type === 'success' ? 'bg-emerald-400' : (ev.type === 'danger' ? 'bg-rose-500' : (ev.type === 'warning' ? 'bg-amber-500' : 'bg-cyan-400'))
                }`} />
                <span className="text-[10px] font-bold text-slate-400 font-mono block">{ev.time}</span>
                <span className="font-bold text-slate-800 dark:text-white block">{ev.title}</span>
                <span className="text-[11px] text-slate-500 block leading-relaxed">{ev.desc}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 8. SETTINGS TAB */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          <Card title="Mist Connection Dashboard" description="Connection properties of CampusNet collector integration.">
            <div className="space-y-4 pt-4 text-xs font-sans">
              <div className="flex justify-between border-b border-slate-200/5 pb-2">
                <span className="text-slate-500">API Connection Status:</span>
                <span className={`font-bold uppercase ${wirelessSiteData.connection?.connected ? 'text-emerald-500 animate-pulse' : 'text-rose-500'}`}>
                  {wirelessSiteData.connection?.status}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200/5 pb-2">
                <span className="text-slate-500">Collector Integration Enabled:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white">
                  {wirelessSiteData.connection?.enabled ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200/5 pb-2">
                <span className="text-slate-500">Mist API Latency:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white">{wirelessSiteData.connection?.api_latency}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/5 pb-2">
                <span className="text-slate-500">Poll Execution Duration:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white">{wirelessSiteData.connection?.poll_duration}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/5 pb-2">
                <span className="text-slate-500">Last Successful Sync:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white">{wirelessSiteData.connection?.last_success}</span>
              </div>
              <div className="flex justify-between pb-2">
                <span className="text-slate-500">Last Error Status:</span>
                <span className={`font-mono font-bold ${wirelessSiteData.connection?.last_error !== 'None' ? 'text-rose-500' : 'text-slate-400'}`}>
                  {wirelessSiteData.connection?.last_error}
                </span>
              </div>
            </div>
          </Card>

          <Card title="Polling Configuration" description="Environment refresh interval parameters:">
            <div className="space-y-4 pt-4 text-xs font-sans">
              <div className="flex justify-between border-b border-slate-200/5 pb-2">
                <span className="text-slate-500">Mist Polling Interval (MIST_POLL_INTERVAL):</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white">30 seconds</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/5 pb-2">
                <span className="text-slate-500">Database Polling Interval (POLL_INTERVAL):</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white">10 seconds</span>
              </div>
              <div className="flex justify-between pb-2">
                <span className="text-slate-500">Mock Fallback Simulation:</span>
                <span className="font-mono font-bold text-cyan-400">Automatic if REST unreached</span>
              </div>
              <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-lg flex gap-2 mt-4 text-[10px]">
                <HelpCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Mist collector reads authentication tokens and endpoints strictly from backend variables (.env file). Tokens are masked and never exposed to the client interface.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
};

export default WirelessCenter;
