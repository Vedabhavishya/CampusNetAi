import React, { useState, useMemo, useEffect } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { StatusBadge, HealthIndicator } from '../components/EnterpriseWidgets';
import { useNetworkStore } from '../contexts/NetworkStoreContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Shield, AlertTriangle, ShieldCheck, ArrowUpRight, ArrowDownRight,
  Activity, Network, Key, ListFilter, FileText, History, RefreshCw, Layers, 
  Search, Users, Info, Settings, Clock, Server, Play, Plus
} from 'lucide-react';

export const FirewallManager: React.FC = () => {
  const { user } = useAuth();
  const { devices, runProvisioningTask } = useNetworkStore();
  const [activeTab, setActiveTab] = useState<string>('overview');

  // Search & Filter state for Live Sessions
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionProtoFilter, setSessionProtoFilter] = useState('all');

  // Search state for Connected Clients
  const [clientSearch, setClientSearch] = useState('');

  // 1. Fetch Firewall device
  const device = useMemo(() => {
    return devices.find(d => d.type === 'firewall') || null;
  }, [devices]);

  // 2. Poll read-only cache-backed analytics endpoint (never triggers direct SSH)
  const [analytics, setAnalytics] = useState<any>({
    top_clients: [],
    top_destinations: [],
    bandwidth: { total_upload_bytes: 0, total_download_bytes: 0, total_throughput_bytes: 0, client_bandwidth_usage: [] },
    dns: [],
    applications: [],
    closed_sessions: [],
    events: []
  });

  useEffect(() => {
    let active = true;
    const fetchAnalytics = async () => {
      try {
        const token = localStorage.getItem('token') || '';
        const res = await fetch('http://localhost:8000/api/v1/firewall/analytics', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok && active) {
          const data = await res.json();
          setAnalytics(data);
        }
      } catch (err) {
        console.error('[FirewallManager] Failed to fetch analytics:', err);
      }
    };
    
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  if (!device) {
    return (
      <div className="p-8 text-center text-slate-400 font-medium">
        No active Firewall device claimed in inventory. Onboard a firewall first.
      </div>
    );
  }

  const telemetry = device.telemetry || {};
  const sessionsList = telemetry.sessions || [];
  const interfacesList = telemetry.interfaces || [];
  const routesList = telemetry.routes || [];
  const policiesList = telemetry.policies || [];
  const correlatedSessions = telemetry.correlated_sessions || [];

  // Filtered Live Sessions
  const filteredSessions = useMemo(() => {
    return sessionsList.filter((s: any) => {
      const matchSearch = 
        s.source_ip?.includes(sessionSearch) || 
        s.destination_ip?.includes(sessionSearch) || 
        s.policy_name?.toLowerCase().includes(sessionSearch.toLowerCase());
      
      const matchProto = 
        sessionProtoFilter === 'all' || 
        s.protocol?.toLowerCase() === sessionProtoFilter.toLowerCase();

      return matchSearch && matchProto;
    });
  }, [sessionsList, sessionSearch, sessionProtoFilter]);

  // Filtered Correlated Clients
  const filteredClients = useMemo(() => {
    const grouped: { [ip: string]: any } = {};
    correlatedSessions.forEach((s: any) => {
      const ip = s.client_ip;
      if (!grouped[ip]) {
        grouped[ip] = {
          client_ip: ip,
          client_name: s.client_name,
          ap_name: s.ap_name,
          switch_name: s.switch_name,
          switch_port: s.switch_port,
          sessions_count: 0,
          upload: 0,
          download: 0,
          policy: s.policy || 'Allow-Web'
        };
      }
      grouped[ip].sessions_count += 1;
      grouped[ip].upload += (s.bytes || 0) * 0.45; // split upload approximation
      grouped[ip].download += (s.bytes || 0) * 0.55; // split download approximation
    });

    return Object.values(grouped).filter((c: any) => 
      c.client_ip.includes(clientSearch) || 
      c.client_name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.ap_name.toLowerCase().includes(clientSearch.toLowerCase())
    );
  }, [correlatedSessions, clientSearch]);

  // Format Helper for traffic sizes
  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-left">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-400 rounded-xl flex items-center justify-center">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white m-0">
              Firewall Session Console
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Stateless CLI-polling session logs, client path correlation, and anomaly detectors on {device.name}.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs navigation panel */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 pb-px overflow-x-auto text-xs shrink-0 select-none">
        {[
          { id: 'overview', label: 'Overview', icon: <Activity className="h-4 w-4" /> },
          { id: 'interfaces', label: 'Interfaces', icon: <Network className="h-4 w-4" /> },
          { id: 'live-sessions', label: 'Live Sessions', icon: <Clock className="h-4 w-4" /> },
          { id: 'connected-clients', label: 'Connected Clients', icon: <Users className="h-4 w-4" /> },
          { id: 'top-destinations', label: 'Top Destinations', icon: <Layers className="h-4 w-4" /> },
          { id: 'top-applications', label: 'Top Applications', icon: <ListFilter className="h-4 w-4" /> },
          { id: 'bandwidth', label: 'Bandwidth Usage', icon: <ArrowUpRight className="h-4 w-4" /> },
          { id: 'dns-activity', label: 'DNS Activity', icon: <FileText className="h-4 w-4" /> },
          { id: 'routes', label: 'Static Routes', icon: <Settings className="h-4 w-4" /> },
          { id: 'policies', label: 'Security Policies', icon: <Shield className="h-4 w-4" /> },
          { id: 'events', label: 'Events Log', icon: <History className="h-4 w-4" /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2.5 border-b-2 font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              activeTab === tab.id 
                ? 'border-brand-500 text-brand-500 font-bold' 
                : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Screen Content */}
      <div className="space-y-6">
        
        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-left">
              <Card title="Threat Protection status" description="Unified Intrusion Engine stats">
                <div className="flex items-center space-x-3.5 mt-3">
                  <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">IPS Shield Active</p>
                    <p className="text-xs text-slate-400 mt-0.5">Signature DB: v2026.07.12</p>
                  </div>
                </div>
              </Card>

              <Card title="Active Flow Sessions" description="Total tracked connection flows">
                <div className="mt-3">
                  <h3 className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white">
                    {sessionsList.length}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 flex items-center">
                    <ArrowUpRight className="h-4 w-4 text-emerald-500 mr-1" />
                    Last Poll: {telemetry.last_poll ? new Date(telemetry.last_poll).toLocaleTimeString() : 'N/A'}
                  </p>
                </div>
              </Card>

              <Card title="Hardware Health Status" description="Collector health telemetry">
                <div className="mt-3 flex items-center justify-between text-xs font-semibold">
                  <div>
                    <p className="text-slate-400">Node CPU</p>
                    <p className="text-slate-700 dark:text-slate-300 mt-0.5">{device.cpuUsage}%</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Memory</p>
                    <p className="text-slate-700 dark:text-slate-300 mt-0.5">{device.memoryUsage}%</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Uptime</p>
                    <p className="text-slate-700 dark:text-slate-300 mt-0.5">{device.uptime}</p>
                  </div>
                </div>
              </Card>

              <Card title="Metadata Schema" description="Telemetry descriptors version">
                <div className="mt-3 text-xs font-semibold space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-450">Schema Type</span>
                    <span className="text-slate-800 dark:text-slate-200">{telemetry.schema || 'firewall-session-v1'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-450">Version</span>
                    <span className="text-slate-800 dark:text-slate-200">v{telemetry.version || '1'}</span>
                  </div>
                </div>
              </Card>
            </div>

            <Card title="Collector Info & Diagnostics" description="Read-only background task state:">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-xs text-left font-semibold">
                <div>
                  <span className="text-slate-400">Collector Engine</span>
                  <p className="text-slate-850 dark:text-slate-200 mt-1">{device.collector?.name || 'SRXCollector'}</p>
                </div>
                <div>
                  <span className="text-slate-400">Device Family</span>
                  <p className="text-slate-850 dark:text-slate-200 mt-1">{device.collector?.device_family || 'SRX'}</p>
                </div>
                <div>
                  <span className="text-slate-400">Commands Executed</span>
                  <p className="text-slate-850 dark:text-slate-200 mt-1">{device.collector?.commands_executed || 0}</p>
                </div>
                <div>
                  <span className="text-slate-400">SSH Latency</span>
                  <p className="text-slate-850 dark:text-slate-200 mt-1">{device.performance?.current?.ssh_latency_ms || 12} ms</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Tab 2: Interfaces */}
        {activeTab === 'interfaces' && (
          <Card title="Firewall Interface Status Roster" description="terse/extensive interfaces parsed from JunOS:">
            <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800/60">
              <table className="min-w-full divide-y divide-slate-200/60 dark:divide-slate-800/60 text-xs text-slate-700 dark:text-slate-350">
                <thead className="bg-slate-50 dark:bg-slate-900/60 font-bold text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Interface Name</th>
                    <th className="px-4 py-2.5 text-left">Admin State</th>
                    <th className="px-4 py-2.5 text-left">Link State</th>
                    <th className="px-4 py-2.5 text-left">IP Address</th>
                    <th className="px-4 py-2.5 text-right">Errors</th>
                    <th className="px-4 py-2.5 text-right">Drops</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {interfacesList.map((i: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-500/5">
                      <td className="px-4 py-2.5 font-bold">{i.interface}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={i.admin === 'up' ? 'online' : 'offline'} label={i.admin} /></td>
                      <td className="px-4 py-2.5"><StatusBadge status={i.link === 'up' ? 'online' : 'offline'} label={i.link} /></td>
                      <td className="px-4 py-2.5 font-mono">{i.ip || 'N/A'}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{i.errors || 0}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{i.drops || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Tab 3: Live Sessions */}
        {activeTab === 'live-sessions' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search live sessions by IP address or policy name..."
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
                />
              </div>
              <select
                value={sessionProtoFilter}
                onChange={(e) => setSessionProtoFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full sm:w-40"
              >
                <option value="all">All Protocols</option>
                <option value="tcp">TCP</option>
                <option value="udp">UDP</option>
                <option value="icmp">ICMP</option>
              </select>
            </div>

            <Card title="Active Firewall Session Table" description="Parsed security flow session output:">
              <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800/60 max-h-[500px]">
                <table className="min-w-full divide-y divide-slate-200/60 dark:divide-slate-800/60 text-xs text-slate-700 dark:text-slate-350">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 font-bold text-slate-700 dark:text-slate-300 sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Session ID</th>
                      <th className="px-4 py-2.5 text-left">Source Endpoint</th>
                      <th className="px-4 py-2.5 text-left">Destination</th>
                      <th className="px-4 py-2.5 text-left">Protocol</th>
                      <th className="px-4 py-2.5 text-left">Policy</th>
                      <th className="px-4 py-2.5 text-left">State</th>
                      <th className="px-4 py-2.5 text-right">Packets (In/Out)</th>
                      <th className="px-4 py-2.5 text-right">Bytes (In/Out)</th>
                      <th className="px-4 py-2.5 text-right">Timeout</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredSessions.map((s: any) => (
                      <tr key={s.session_id} className="hover:bg-slate-500/5">
                        <td className="px-4 py-2.5 font-bold font-mono">{s.session_id}</td>
                        <td className="px-4 py-2.5 font-mono">{s.source_ip}:{s.source_port}</td>
                        <td className="px-4 py-2.5 font-mono">{s.destination_ip}:{s.destination_port}</td>
                        <td className="px-4 py-2.5"><span className="uppercase px-1.5 py-0.5 rounded bg-slate-500/10 text-[10px] font-bold">{s.protocol}</span></td>
                        <td className="px-4 py-2.5 font-semibold text-slate-800 dark:text-slate-250">{s.policy_name}</td>
                        <td className="px-4 py-2.5 font-bold text-emerald-500">{s.state}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{s.packets_in} / {s.packets_out}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{formatBytes(s.bytes_in)} / {formatBytes(s.bytes_out)}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{s.timeout}s</td>
                      </tr>
                    ))}
                    {filteredSessions.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-slate-400">No matching active sessions.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* Tab 4: Connected Clients */}
        {activeTab === 'connected-clients' && (
          <div className="space-y-4">
            <div className="relative w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search connected correlated clients by hostname or IP..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
              />
            </div>

            <Card title="Correlated Clients Network Map" description="Topology path correlation: Client -> AP -> Switch Port -> Switch -> Firewall">
              <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800/60">
                <table className="min-w-full divide-y divide-slate-200/60 dark:divide-slate-800/60 text-xs text-slate-700 dark:text-slate-350">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 font-bold text-slate-700 dark:text-slate-300">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Client IP / Name</th>
                      <th className="px-4 py-2.5 text-left">Access Point</th>
                      <th className="px-4 py-2.5 text-left">Switch Uplink</th>
                      <th className="px-4 py-2.5 text-left">Switch Port</th>
                      <th className="px-4 py-2.5 text-center">Active Sessions</th>
                      <th className="px-4 py-2.5 text-right">Upload</th>
                      <th className="px-4 py-2.5 text-right">Download</th>
                      <th className="px-4 py-2.5 text-left">Applied Policy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredClients.map((c: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-500/5">
                        <td className="px-4 py-2.5 font-semibold text-left">
                          <span className="font-mono block">{c.client_ip}</span>
                          <span className="text-[10px] text-slate-450 block">{c.client_name}</span>
                        </td>
                        <td className="px-4 py-2.5 font-bold text-slate-750 dark:text-slate-300">{c.ap_name}</td>
                        <td className="px-4 py-2.5 font-medium text-indigo-500">{c.switch_name}</td>
                        <td className="px-4 py-2.5 font-mono">{c.switch_port}</td>
                        <td className="px-4 py-2.5 text-center font-bold font-mono text-cyan-500">{c.sessions_count}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-emerald-500">{formatBytes(c.upload)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-blue-500">{formatBytes(c.download)}</td>
                        <td className="px-4 py-2.5"><span className="px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-500 font-bold">{c.policy}</span></td>
                      </tr>
                    ))}
                    {filteredClients.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-400">No correlated clients detected.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* Tab 5: Top Destinations */}
        {activeTab === 'top-destinations' && (
          <Card title="Top Destination Targets" description="Aggregated sessions grouped by target destination endpoint:">
            <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800/60">
              <table className="min-w-full divide-y divide-slate-200/60 dark:divide-slate-800/60 text-xs text-slate-700 dark:text-slate-350">
                <thead className="bg-slate-50 dark:bg-slate-900/60 font-bold text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Destination IP</th>
                    <th className="px-4 py-2.5 text-center">Connections Count</th>
                    <th className="px-4 py-2.5 text-right">Aggregate Traffic Volume</th>
                    <th className="px-4 py-2.5 text-left">Protocol Mix</th>
                    <th className="px-4 py-2.5 text-left">Top Active Source Clients</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-left">
                  {analytics.top_destinations.map((d: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-500/5">
                      <td className="px-4 py-2.5 font-bold font-mono">{d.destination_ip}</td>
                      <td className="px-4 py-2.5 text-center font-bold text-cyan-500 font-mono">{d.connection_count}</td>
                      <td className="px-4 py-2.5 text-right font-bold font-mono text-emerald-500">{formatBytes(d.total_bytes)}</td>
                      <td className="px-4 py-2.5 font-mono">
                        {Object.entries(d.protocol_distribution || {}).map(([p, count]: any) => (
                          <span key={p} className="inline-block mr-2 uppercase text-[9px] font-bold bg-slate-500/10 px-1 py-0.5 rounded">
                            {p}: {count}
                          </span>
                        ))}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-450">{d.top_clients?.join(', ') || 'N/A'}</td>
                    </tr>
                  ))}
                  {analytics.top_destinations.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">No destination telemetry cached.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Tab 6: Top Applications */}
        {activeTab === 'top-applications' && (
          <Card title="Traffic Application Distribution" description="Aggregated session totals mapped by Application Port Detector:">
            <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800/60">
              <table className="min-w-full divide-y divide-slate-200/60 dark:divide-slate-800/60 text-xs text-slate-700 dark:text-slate-350">
                <thead className="bg-slate-50 dark:bg-slate-900/60 font-bold text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Application Name</th>
                    <th className="px-4 py-2.5 text-center">Session Count</th>
                    <th className="px-4 py-2.5 text-right">Data Volume</th>
                    <th className="px-4 py-2.5 text-right">Packet Count</th>
                    <th className="px-4 py-2.5 text-left">Volume Share Indicator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-left">
                  {analytics.applications.map((app: any, idx: number) => {
                    const maxBytes = Math.max(...analytics.applications.map((a: any) => a.bytes)) || 1;
                    const percent = Math.min(100, Math.round((app.bytes / maxBytes) * 100));
                    return (
                      <tr key={idx} className="hover:bg-slate-500/5">
                        <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-slate-250 flex items-center">
                          <div className="h-2 w-2 rounded-full bg-brand-500 mr-2" />
                          {app.application}
                        </td>
                        <td className="px-4 py-2.5 text-center font-bold text-cyan-500 font-mono">{app.session_count}</td>
                        <td className="px-4 py-2.5 text-right font-bold font-mono text-emerald-500">{formatBytes(app.bytes)}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{app.packets}</td>
                        <td className="px-4 py-2.5">
                          <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div className="bg-brand-500 h-full rounded-full" style={{ width: `${percent}%` }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Tab 7: Bandwidth */}
        {activeTab === 'bandwidth' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
            <Card title="Upload / Download Totals" className="lg:col-span-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Aggregate Throughput</span>
                  <h3 className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white mt-1">
                    {formatBytes(analytics.bandwidth.total_throughput_bytes)}
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                    <span className="text-[9px] font-bold text-slate-450 uppercase flex items-center gap-1">
                      <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" /> Upload (In)
                    </span>
                    <span className="text-sm font-bold font-mono text-emerald-500 mt-1 block">
                      {formatBytes(analytics.bandwidth.total_upload_bytes)}
                    </span>
                  </div>
                  <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                    <span className="text-[9px] font-bold text-slate-450 uppercase flex items-center gap-1">
                      <ArrowDownRight className="h-3.5 w-3.5 text-blue-500" /> Download (Out)
                    </span>
                    <span className="text-sm font-bold font-mono text-blue-500 mt-1 block">
                      {formatBytes(analytics.bandwidth.total_download_bytes)}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            <Card title="Top Client Bandwidth Usage" className="lg:col-span-2">
              <div className="space-y-3.5 mt-2">
                {analytics.bandwidth.client_bandwidth_usage.slice(0, 5).map((u: any, idx: number) => {
                  const maxTotal = Math.max(...analytics.bandwidth.client_bandwidth_usage.map((cl: any) => cl.total)) || 1;
                  const percent = Math.round((u.total / maxTotal) * 100);
                  return (
                    <div key={idx} className="space-y-1 text-xs">
                      <div className="flex justify-between font-semibold">
                        <span className="font-mono">{u.client_ip}</span>
                        <span className="font-mono text-slate-450">{formatBytes(u.total)} (↑{formatBytes(u.upload)} / ↓{formatBytes(u.download)})</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-brand-500 h-full rounded-full" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
                {analytics.bandwidth.client_bandwidth_usage.length === 0 && (
                  <div className="text-slate-400 py-8 text-center">No bandwidth metrics tracked yet.</div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Tab 8: DNS Activity */}
        {activeTab === 'dns-activity' && (
          <Card title="DNS Server Query Logger" description="Aggregated UDP/TCP 53 DNS mappings:">
            <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800/60">
              <table className="min-w-full divide-y divide-slate-200/60 dark:divide-slate-800/60 text-xs text-slate-700 dark:text-slate-350">
                <thead className="bg-slate-50 dark:bg-slate-900/60 font-bold text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Client IP</th>
                    <th className="px-4 py-2.5 text-left">Resolved DNS Target Server</th>
                    <th className="px-4 py-2.5 text-center">Query Count</th>
                    <th className="px-4 py-2.5 text-right">Data Exchanged</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-left">
                  {analytics.dns.map((dns: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-500/5">
                      <td className="px-4 py-2.5 font-bold font-mono">{dns.client_ip}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">{dns.dns_server}</td>
                      <td className="px-4 py-2.5 text-center font-bold font-mono text-cyan-500">{dns.query_count}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{formatBytes(dns.bytes)}</td>
                    </tr>
                  ))}
                  {analytics.dns.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-400">No DNS sessions logged.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Tab 9: Routes */}
        {activeTab === 'routes' && (
          <Card title="Active Routing Table" description="show route output parsed dynamically:">
            <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800/60">
              <table className="min-w-full divide-y divide-slate-200/60 dark:divide-slate-800/60 text-xs text-slate-700 dark:text-slate-350">
                <thead className="bg-slate-50 dark:bg-slate-900/60 font-bold text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Destination Subnet</th>
                    <th className="px-4 py-2.5 text-left">Gateway Gateway</th>
                    <th className="px-4 py-2.5 text-left">Egress Interface</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-left">
                  {routesList.map((r: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-500/5">
                      <td className="px-4 py-2.5 font-bold font-mono">{r.destination}</td>
                      <td className="px-4 py-2.5 font-mono">{r.gateway}</td>
                      <td className="px-4 py-2.5 font-bold text-indigo-500 font-mono">{r.interface}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Tab 10: Security Policies */}
        {activeTab === 'policies' && (
          <Card title="Active Security Policies" description="show security policies configurations parsed:">
            <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800/60">
              <table className="min-w-full divide-y divide-slate-200/60 dark:divide-slate-800/60 text-xs text-slate-700 dark:text-slate-350">
                <thead className="bg-slate-50 dark:bg-slate-900/60 font-bold text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Policy Rule Name</th>
                    <th className="px-4 py-2.5 text-left">From Zone</th>
                    <th className="px-4 py-2.5 text-left">To Zone</th>
                    <th className="px-4 py-2.5 text-left">Service</th>
                    <th className="px-4 py-2.5 text-left">Security Action</th>
                    <th className="px-4 py-2.5 text-left">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-left">
                  {policiesList.map((p: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-500/5">
                      <td className="px-4 py-2.5 font-bold">{p.policyName}</td>
                      <td className="px-4 py-2.5 uppercase font-mono text-[10px] font-bold text-slate-450">{p.fromZone}</td>
                      <td className="px-4 py-2.5 uppercase font-mono text-[10px] font-bold text-slate-450">{p.toZone}</td>
                      <td className="px-4 py-2.5 font-mono">Any</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded font-bold uppercase text-[9px] ${
                          p.state === 'enabled' || p.state === 'active'
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-rose-500/10 text-rose-500'
                        }`}>
                          {p.state === 'enabled' || p.state === 'active' ? 'Permit' : 'Deny'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5"><StatusBadge status={p.state === 'enabled' || p.state === 'active' ? 'online' : 'offline'} label={p.state} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Tab 11: Events */}
        {activeTab === 'events' && (
          <Card title="Rolling Security & Firewall Events Log" description="Delta-based security, session state modifications and anomaly alerts:">
            <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800/60 max-h-[400px]">
              <table className="min-w-full divide-y divide-slate-200/60 dark:divide-slate-800/60 text-xs text-slate-700 dark:text-slate-350">
                <thead className="bg-slate-50 dark:bg-slate-900/60 font-bold text-slate-700 dark:text-slate-300 sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Timestamp</th>
                    <th className="px-4 py-2.5 text-left">Event Category</th>
                    <th className="px-4 py-2.5 text-left">Details Message</th>
                    <th className="px-4 py-2.5 text-left">Severity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-left">
                  {analytics.events.slice().reverse().map((e: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-500/5">
                      <td className="px-4 py-2.5 font-mono text-slate-450">{new Date(e.timestamp).toLocaleString()}</td>
                      <td className="px-4 py-2.5 font-bold flex items-center">
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 mr-1.5" />
                        {e.event}
                      </td>
                      <td className="px-4 py-2.5 text-slate-850 dark:text-slate-200">{e.message}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-1.5 py-0.5 rounded font-bold uppercase text-[9px] ${
                          e.severity === 'critical' ? 'bg-red-500/10 text-red-500' :
                          e.severity === 'warning' ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-500/10 text-slate-450'
                        }`}>
                          {e.severity}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {analytics.events.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-400">No events logged yet. Waiting for polling cycles...</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

      </div>
    </div>
  );
};
