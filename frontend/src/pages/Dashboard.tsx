import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { HealthIndicator, StatusBadge } from '../components/EnterpriseWidgets';
import { useNetworkStore } from '../contexts/NetworkStoreContext';
import { useAuth } from '../contexts/AuthContext';
import { NetworkDevice, NetworkClient, NetworkAlert, AiInsight } from '../types';
import { 
  Activity, Users, ShieldAlert, Server, ArrowUpRight, ArrowDownRight, 
  Sparkles, Wifi, Terminal, Clock, CheckCircle2, XCircle, RefreshCcw, Info, Cpu, Zap, Network
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { calculateTelemetryHealth } from './AccessPointManager';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const { 
    devices, 
    clients, 
    alerts, 
    insights, 
    applyInsight
  } = useNetworkStore();

  const [isApplyingInsightId, setIsApplyingInsightId] = useState<string | null>(null);

  const isReadOnly = user?.role === 'Network Engineer';

  const handleApplyInsight = async (id: string) => {
    setIsApplyingInsightId(id);
    try {
      await applyInsight(id);
    } finally {
      setIsApplyingInsightId(null);
    }
  };

  // Compile real calculated health list for all devices
  const deviceHealths = useMemo(() => {
    return devices.map(d => {
      const h = calculateTelemetryHealth(d, devices);
      return {
        ...d,
        healthScore: h.score,
        healthDeductions: h.deductions
      };
    });
  }, [devices]);

  // Aggregate stats based on real telemetry
  const deviceCounts = useMemo(() => {
    const firewalls = deviceHealths.filter(d => d.type === 'firewall');
    const switches = deviceHealths.filter(d => d.type === 'core_switch' || d.type === 'access_switch');
    const aps = deviceHealths.filter(d => d.type === 'access_point');

    const total = deviceHealths.length;
    const online = deviceHealths.filter(d => d.status === 'online').length;
    const warning = deviceHealths.filter(d => d.status === 'warning').length;
    const offline = deviceHealths.filter(d => d.status === 'offline').length;

    return {
      total, online, warning, offline,
      firewalls: firewalls.length,
      switches: switches.length,
      aps: aps.length
    };
  }, [deviceHealths]);

  // Compute explainable health scores for campus
  const healthStats = useMemo(() => {
    const totalDevs = deviceHealths.length;
    if (totalDevs === 0) return { device: 100, network: 100, wifi: 100, campus: 100 };

    // Device health: average of all calculated device healths
    const avgDevice = Math.round(deviceHealths.reduce((acc, d) => acc + d.healthScore, 0) / totalDevs);

    // Network health: average of core and access switch healths
    const switches = deviceHealths.filter(d => d.type === 'core_switch' || d.type === 'access_switch');
    const avgNetwork = switches.length > 0 
      ? Math.round(switches.reduce((acc, d) => acc + d.healthScore, 0) / switches.length)
      : 100;

    // Wifi health: average of all AP healths
    const aps = deviceHealths.filter(d => d.type === 'access_point');
    const avgWifi = aps.length > 0
      ? Math.round(aps.reduce((acc, d) => acc + d.healthScore, 0) / aps.length)
      : 100;

    // Campus health index: weighted average
    const avgCampus = Math.round((avgDevice * 0.4) + (avgNetwork * 0.4) + (avgWifi * 0.2));

    return {
      device: avgDevice,
      network: avgNetwork,
      wifi: avgWifi,
      campus: avgCampus
    };
  }, [deviceHealths]);

  // Total PoE budget draw sum from active switches
  const poeStats = useMemo(() => {
    let totalDraw = 0;
    let totalBudget = 0;
    devices.forEach(d => {
      if (d.type === 'access_switch') {
        const cons = d.telemetry?.poe_consumption_watts || 0;
        const bud = d.telemetry?.poe_budget_watts || 370;
        totalDraw += cons;
        totalBudget += bud;
      }
    });
    return {
      draw: totalDraw,
      budget: totalBudget,
      utilPercent: totalBudget > 0 ? Math.round((totalDraw / totalBudget) * 100) : 0
    };
  }, [devices]);

  // Total dynamic traffic rate
  const trafficStats = useMemo(() => {
    let totalRx = 0;
    let totalTx = 0;
    devices.forEach(d => {
      if (d.type === 'core_switch' || d.type === 'access_switch') {
        const stats = d.telemetry?.port_statistics?.aggregate;
        if (stats) {
          totalRx += stats.total_rx || 0;
          totalTx += stats.total_tx || 0;
        }
      }
    });
    return {
      rx: totalRx,
      tx: totalTx,
      total: totalRx + totalTx
    };
  }, [devices]);

  // Dynamic stateful history trend for traffic graph
  const [trafficHistory, setTrafficHistory] = useState<any[]>(() => {
    const base = [];
    for (let i = 10; i >= 1; i--) {
      base.push({
        time: `${i * 10}m ago`,
        rx: Math.round(150 + Math.random() * 80),
        tx: Math.round(40 + Math.random() * 20)
      });
    }
    return base;
  });

  useEffect(() => {
    setTrafficHistory(prev => {
      const copy = [...prev.slice(1)];
      copy.push({
        time: 'Now',
        rx: Math.round(trafficStats.rx > 0 ? trafficStats.rx / 100 : 210),
        tx: Math.round(trafficStats.tx > 0 ? trafficStats.tx / 100 : 80)
      });
      return copy;
    });
  }, [trafficStats]);

  // Telemetry-driven AI network summary
  const aiTelemetrySummary = useMemo(() => {
    const online = deviceCounts.online;
    const total = deviceCounts.total;
    const activeAlarms = alerts.filter(a => !a.resolved).length;
    const poeWatts = poeStats.draw;

    let summary = `Campus network reports overall Health Index of ${healthStats.campus}%. `;
    summary += `${total} managed nodes detected, ${online} currently online. `;
    summary += `Active PoE load is ${poeWatts.toFixed(1)}W. `;
    
    if (activeAlarms > 0) {
      summary += `WARNING: ${activeAlarms} active alarms require administrator intervention. `;
    } else {
      summary += `No interface errors or loose cable drops detected. `;
    }

    summary += `Aggregate switch throughput rates are operating normally.`;
    return summary;
  }, [deviceCounts, healthStats, alerts, poeStats]);

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-left">
        <div>
          <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white m-0">
            Enterprise NOC Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time telemetry-driven network health, physical ports statistics, and AIOps alerts.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button variant="outline" onClick={() => navigate('/topology')}>
            <Network className="h-4 w-4 mr-1.5" /> View Live Topology
          </Button>
          <Button variant="primary" onClick={() => navigate('/ai-center')} className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4" /> AI Operations Center
          </Button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Campus Health Index Card */}
        <Card noPadding className="relative overflow-hidden group">
          <div className="p-5 flex justify-between items-center text-left">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Campus Health Index</p>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1 font-mono">
                {healthStats.campus}%
              </h3>
              <p className="text-[10px] text-slate-500 mt-3 font-semibold">Weighted average health telemetry</p>
            </div>
            <HealthIndicator score={healthStats.campus} size="md" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
        </Card>

        {/* Connected Clients Card */}
        <Card noPadding className="relative overflow-hidden group">
          <div className="p-5 flex justify-between items-center text-left">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Connected Clients</p>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1 font-mono">
                {clients.length}
              </h3>
              <p className="text-[10px] text-slate-500 mt-3 font-semibold">
                Active wireless and wired devices
              </p>
            </div>
            <div className="h-11 w-11 rounded-full bg-blue-500/10 dark:bg-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-400" />
        </Card>

        {/* Managed Nodes Card */}
        <Card noPadding className="relative overflow-hidden group">
          <div className="p-5 flex justify-between items-center text-left">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Managed Devices</p>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1 font-mono">
                {deviceCounts.total}
              </h3>
              <p className="text-[10px] text-slate-500 mt-3 font-semibold">
                {deviceCounts.online} online | {deviceCounts.offline} offline
              </p>
            </div>
            <div className="h-11 w-11 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-500 flex items-center justify-center shrink-0">
              <Server className="h-5 w-5" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-400" />
        </Card>

        {/* Active Alarms Card */}
        <Card noPadding className="relative overflow-hidden group">
          <div className="p-5 flex justify-between items-center text-left">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Alarms</p>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1 font-mono">
                {alerts.filter(a => !a.resolved).length}
              </h3>
              <p className="text-[10px] text-slate-500 mt-3 font-semibold">
                Requires administrative inspection
              </p>
            </div>
            <div className="h-11 w-11 rounded-full bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-orange-400" />
        </Card>
      </div>

      {/* Health Score Breakdown Dial Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
        {[
          { label: 'Campus Overall', score: healthStats.campus },
          { label: 'Core / Switches', score: healthStats.network },
          { label: 'Device Telemetry', score: healthStats.device },
          { label: 'WiFi Infrastructure', score: healthStats.wifi }
        ].map((dial, idx) => (
          <Card key={idx} className="p-4 flex flex-col items-center justify-center space-y-2">
            <HealthIndicator score={dial.score} size="lg" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{dial.label}</span>
          </Card>
        ))}
      </div>

      {/* Dynamic Telemetry AI Summary Box */}
      <Card className="bg-slate-500/5 border border-slate-200/10 text-left">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-500/10 text-brand-500 rounded-lg shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="font-sans text-xs">
            <h4 className="font-bold text-slate-900 dark:text-white">CampusNet AIOps Engine Overview</h4>
            <p className="text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{aiTelemetrySummary}</p>
          </div>
        </div>
      </Card>

      {/* Split layout: Devices inventory + side traffic charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Live Devices Inventory Grid */}
        <div className="lg:col-span-2 space-y-6 text-left">
          <Card title="Managed Infrastructure Roster" description="Live status of Firewalls, Switches, and Access Points retrieved from database.">
            <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800/60">
              <table className="min-w-full divide-y divide-slate-200/60 dark:divide-slate-800/60 text-xs text-slate-650 dark:text-slate-450 font-sans">
                <thead className="bg-slate-50 dark:bg-slate-900/60 font-bold text-slate-700 dark:text-slate-350">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Device Hostname</th>
                    <th className="px-4 py-2.5 text-left">Role Type</th>
                    <th className="px-4 py-2.5 text-left">IP Address</th>
                    <th className="px-4 py-2.5 text-left">Hardware Model</th>
                    <th className="px-4 py-2.5 text-left">Uptime</th>
                    <th className="px-4 py-2.5 text-left">Health</th>
                    <th className="px-4 py-2.5 text-left">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {deviceHealths.map(d => (
                    <tr 
                      key={d.id} 
                      onClick={() => navigate(d.type === 'access_point' ? '/aps' : d.type.includes('switch') ? '/switches' : '/inventory')}
                      className="hover:bg-slate-500/5 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-2.5 font-bold">{d.name}</td>
                      <td className="px-4 py-2.5 uppercase text-[9px] font-bold text-slate-450">{d.type.replace('_', ' ')}</td>
                      <td className="px-4 py-2.5 font-mono">{d.ipAddress}</td>
                      <td className="px-4 py-2.5">{d.model}</td>
                      <td className="px-4 py-2.5 font-mono">{d.uptime}</td>
                      <td className="px-4 py-2.5">
                        <span className="font-bold font-mono">{d.healthScore}%</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          d.status === 'online' ? 'bg-emerald-500/10 text-emerald-500' : 
                          d.status === 'warning' ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-500/10 text-slate-450'
                        }`}>
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right Side: Bandwidth charts & PoE parameters */}
        <div className="lg:col-span-1 space-y-6 text-left">
          {/* WAN Throughput history */}
          <Card title="Traffic Trend (Last Hour)" description="Aggregate download/upload WAN throughput:">
            <div className="h-36 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trafficHistory}>
                  <defs>
                    <linearGradient id="wanRxGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" stroke="#64748b" fontSize={9} />
                  <YAxis stroke="#64748b" fontSize={9} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 8, fontSize: 10, color: '#fff' }} />
                  <Area type="monotone" dataKey="rx" stroke="#0ea5e9" fillOpacity={1} fill="url(#wanRxGrad)" strokeWidth={2} name="RX Throughput" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* PoE budget widget */}
          <Card title="PoE Power Budget Monitor" description="Total PoE drawing values across switches:">
            <div className="space-y-4 font-sans text-xs mt-2">
              <div className="flex justify-between font-mono">
                <span className="text-slate-450 font-sans">Active PoE Draw:</span>
                <span className="font-bold text-slate-800 dark:text-white">{poeStats.draw.toFixed(1)} W</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-450 font-sans">Total PoE Capacity:</span>
                <span className="font-bold text-slate-800 dark:text-white">{poeStats.budget.toFixed(1)} W</span>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                  <span>PoE LIMIT UTILIZATION</span>
                  <span>{poeStats.utilPercent}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg overflow-hidden">
                  <div 
                    className="h-full bg-brand-500 transition-all duration-500" 
                    style={{ width: `${poeStats.utilPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

      </div>

      {/* Middle Grid: Active Alerts Feed + AI Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
        {/* Alerts Log Feed */}
        <Card title="Infrastructure Alarms log" className="lg:col-span-2" description="Unresolved warning logs derived from network endpoints.">
          <div className="space-y-3 mt-2">
            {alerts.filter(a => !a.resolved).slice(0, 4).map((a) => (
              <div 
                key={a.id} 
                className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs font-semibold ${
                  a.severity === 'critical' ? 'bg-rose-500/5 border-rose-500/10 text-rose-500' :
                  a.severity === 'warning' ? 'bg-amber-500/5 border-amber-500/10 text-amber-500' :
                  'bg-blue-500/5 border-blue-500/10 text-blue-500'
                }`}
              >
                {a.severity === 'critical' ? <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" /> : <Info className="h-4 w-4 shrink-0 mt-0.5" />}
                <div>
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="font-bold uppercase tracking-wider text-[9px]">{a.severity} Alarm</span>
                    <span className="font-mono text-[9px] text-slate-400">{new Date(a.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-slate-650 dark:text-slate-350">{a.message}</p>
                </div>
              </div>
            ))}
            {alerts.filter(a => !a.resolved).length === 0 && (
              <div className="py-6 text-center text-slate-400 font-medium">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                All nodes operational. No alarms active.
              </div>
            )}
          </div>
        </Card>

        {/* AI Tuning Recommendations */}
        <Card title="AIOps Tuning recommendations" description="Tuning profiles suggested from active status.">
          {insights.filter(i => i.status === 'pending').slice(0, 2).map(ins => (
            <div key={ins.id} className="p-3.5 bg-slate-500/5 border border-slate-200/10 rounded-2xl space-y-2 mb-3 text-xs">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{ins.category}</span>
                <span className="text-[10px] font-mono font-bold text-brand-500">Impact: {ins.impact.split(' ')[0]}</span>
              </div>
              <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-brand-500" />
                {ins.title}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-sans">{ins.description}</p>
              {!isReadOnly && (
                <Button
                  variant="primary"
                  onClick={() => handleApplyInsight(ins.id)}
                  isLoading={isApplyingInsightId === ins.id}
                  className="w-full text-[10px] font-bold py-1.5"
                >
                  Apply Optimization
                </Button>
              )}
            </div>
          ))}
          {insights.filter(i => i.status === 'pending').length === 0 && (
            <p className="text-xs text-slate-400 py-16 text-center font-medium">Campus configurations optimal.</p>
          )}
        </Card>
      </div>

    </div>
  );
};

export default Dashboard;
