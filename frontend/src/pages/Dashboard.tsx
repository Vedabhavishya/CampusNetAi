import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { HealthIndicator, StatusBadge } from '../components/EnterpriseWidgets';
import { useNetworkStore } from '../contexts/NetworkStoreContext';
import { useAuth } from '../contexts/AuthContext';
import { NetworkDevice, NetworkClient, NetworkAlert, AiInsight, ProvisioningTask } from '../types';
import { 
  Activity, Users, ShieldAlert, Server, ArrowUpRight, ArrowDownRight, 
  Sparkles, Wifi, Terminal, Clock, CheckCircle2, XCircle, RefreshCcw, Info, Cpu 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const { 
    devices, 
    clients, 
    alerts, 
    insights, 
    healthScores, 
    tasks, 
    applyInsight,
    rollbackConfiguration 
  } = useNetworkStore();

  const [isApplyingInsightId, setIsApplyingInsightId] = useState<string | null>(null);
  const [selectedTaskIdForLogs, setSelectedTaskIdForLogs] = useState<string | null>(null);

  const isReadOnly = user?.role === 'Network Engineer';

  const handleApplyInsight = async (id: string) => {
    setIsApplyingInsightId(id);
    try {
      await applyInsight(id);
    } finally {
      setIsApplyingInsightId(null);
    }
  };

  const handleRollback = async (backupId: string) => {
    if (confirm('Revert and rollback this provisioning task modification?')) {
      await rollbackConfiguration(backupId);
    }
  };

  // Calculations
  const onlineDevicesCount = devices.filter(d => d.status === 'online').length;
  const warningDevicesCount = devices.filter(d => d.status === 'warning').length;
  const offlineDevicesCount = devices.filter(d => d.status === 'offline').length;

  const activeClientsCount = clients.length;
  const wirelessClientsCount = clients.filter(c => c.connectionType === 'wireless').length;
  const wiredClientsCount = clients.filter(c => c.connectionType === 'wired').length;

  // OS client distribution pie chart data
  const clientOsCounts = useMemo(() => {
    return clients.reduce((acc: Record<string, number>, c) => {
      const group = c.os.includes('macOS') || c.os.includes('iOS') ? 'Apple' :
                    c.os.includes('Windows') ? 'Windows' :
                    c.os.includes('Linux') || c.os.includes('FreeRTOS') ? 'Linux/IoT' : 'Others';
      acc[group] = (acc[group] || 0) + 1;
      return acc;
    }, {});
  }, [clients]);

  const clientPieData = useMemo(() => {
    return Object.entries(clientOsCounts).map(([name, value]) => ({ name, value }));
  }, [clientOsCounts]);

  const PIE_COLORS = ['#0ea5e9', '#06b6d4', '#6366f1', '#a855f7'];

  // Mock Bandwidth traffic history
  const bandwidthData = [
    { time: '09:00', rx: 450, tx: 120 },
    { time: '10:00', rx: 620, tx: 180 },
    { time: '11:00', rx: 890, tx: 250 },
    { time: '12:00', rx: 940, tx: 310 },
    { time: '13:00', rx: 780, tx: 210 },
    { time: '14:00', rx: 820, tx: 240 }
  ];

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-left">
        <div>
          <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white m-0">
            Enterprise Network Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Centralized telemetry, automated optimizations, and live provisioning queue.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button variant="outline" onClick={() => navigate('/topology')}>
            View Live Topology
          </Button>
          <Button variant="primary" onClick={() => navigate('/ai-center')} className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4" /> AI Query Center
          </Button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Network Health Card */}
        <Card noPadding className="relative overflow-hidden group">
          <div className="p-5 flex justify-between items-center text-left">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Campus Health Index</p>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1 font-display">
                {healthScores.campus}%
              </h3>
              <p className="text-[10px] text-slate-500 mt-3 font-semibold">Campus overall health score status</p>
            </div>
            <HealthIndicator score={healthScores.campus} size="md" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
        </Card>

        {/* Connected Clients Card */}
        <Card noPadding className="relative overflow-hidden group">
          <div className="p-5 flex justify-between items-center text-left">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Connected Clients</p>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1 font-display">
                {activeClientsCount}
              </h3>
              <p className="text-[10px] text-slate-500 mt-3 font-semibold">
                {wirelessClientsCount} Wi-Fi | {wiredClientsCount} Wired links
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
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Managed Devices</p>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1 font-display">
                {devices.length}
              </h3>
              <p className="text-[10px] text-slate-500 mt-3 font-semibold">
                {onlineDevicesCount} online | {warningDevicesCount} warnings
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
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Alarms</p>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1 font-display">
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

      {/* Dial Metrics Center */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Campus overall', score: healthScores.campus },
          { label: 'Core network', score: healthScores.network },
          { label: 'Managed devices', score: healthScores.device },
          { label: 'WiFi Service level', score: healthScores.wifi }
        ].map((dial, idx) => (
          <Card key={idx} className="p-4 flex flex-col items-center justify-center space-y-2">
            <HealthIndicator score={dial.score} size="lg" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{dial.label}</span>
          </Card>
        ))}
      </div>

      {/* Middle Grid: Bandwidth + Client Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bandwidth Area Chart */}
        <Card title="Real-time Network Throughput" className="lg:col-span-2 text-left" description="Aggregate WAN download/upload rates.">
          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={bandwidthData}>
                <defs>
                  <linearGradient id="rxGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 12, fontSize: 11, color: '#fff' }} />
                <Area type="monotone" dataKey="rx" stroke="#0ea5e9" fillOpacity={1} fill="url(#rxGrad)" strokeWidth={2.5} name="Download (Mbps)" />
                <Area type="monotone" dataKey="tx" stroke="#6366f1" fill="transparent" strokeWidth={1.5} name="Upload (Mbps)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Client OS Pie */}
        <Card title="Client OS Distribution" description="Active user operating system breakdown.">
          <div className="h-64 w-full flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height="70%">
              <PieChart>
                <Pie
                  data={clientPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {clientPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[10px] font-bold text-slate-500 uppercase mt-2">
              {clientPieData.map((entry, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                  {entry.name} ({entry.value})
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Provisioning Task Center Layer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Task list card */}
        <Card title="Provisioning Task Center" className="lg:col-span-2 text-left" description="Step-by-step transaction logs for network configuration rollouts.">
          {tasks.length === 0 ? (
            <p className="text-xs text-slate-400 py-12 text-center font-medium">No provisioning tasks committed in this session.</p>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto border border-slate-200/50 dark:border-slate-800/80 rounded-2xl">
                <table className="min-w-full divide-y divide-slate-200/50 dark:divide-slate-800/50 text-xs">
                  <thead className="bg-slate-50/50 dark:bg-slate-900/50">
                    <tr>
                      <th className="px-4 py-3 text-slate-400 text-left font-semibold">Task Name</th>
                      <th className="px-4 py-3 text-slate-400 text-left font-semibold">Targets</th>
                      <th className="px-4 py-3 text-slate-400 text-left font-semibold">Status</th>
                      <th className="px-4 py-3 text-slate-400 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/40 dark:divide-slate-800/40 bg-transparent text-slate-700 dark:text-slate-300">
                    {tasks.map(task => (
                      <tr 
                        key={task.id} 
                        onClick={() => setSelectedTaskIdForLogs(task.id)}
                        className="hover:bg-slate-500/5 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-semibold">{task.name}</td>
                        <td className="px-4 py-3 font-mono text-[10px]">{task.targetDevices.join(', ')}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            task.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                            task.status === 'failed' ? 'bg-rose-500/10 text-rose-500' :
                            'bg-amber-500/10 text-amber-500 animate-pulse'
                          }`}>
                            {task.status === 'running' && <RefreshCcw className="h-3 w-3 animate-spin" />}
                            {task.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {task.status === 'completed' && task.rollbackInfo && !isReadOnly && (
                            <Button
                              variant="outline"
                              onClick={(e) => { e.stopPropagation(); handleRollback(task.rollbackInfo); }}
                              className="text-[10px] px-2 py-1 flex items-center gap-1 ml-auto"
                            >
                              <RefreshCcw className="h-3 w-3" /> Rollback
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Show logs of selected task */}
              {selectedTaskIdForLogs && (
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-[10px] font-mono text-slate-300 space-y-1">
                  <div className="flex justify-between items-center text-slate-500 font-bold uppercase tracking-wider mb-2">
                    <span>Task Execution Logs: {tasks.find(t => t.id === selectedTaskIdForLogs)?.name}</span>
                    <button onClick={() => setSelectedTaskIdForLogs(null)} className="hover:text-white">Close</button>
                  </div>
                  {tasks.find(t => t.id === selectedTaskIdForLogs)?.logs.map((log, idx) => (
                    <div key={idx}>{`> ${log}`}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* AI Recommendations */}
        <Card title="AI Recommendations Engine" className="h-full text-left" description="Automated system tuning insights:">
          {insights.filter(i => i.status === 'pending').length === 0 ? (
            <p className="text-xs text-slate-400 py-16 text-center font-medium">All optimized states. Campus running optimally.</p>
          ) : (
            <div className="space-y-4">
              {insights.filter(i => i.status === 'pending').map(ins => (
                <div key={ins.id} className="p-3.5 bg-slate-500/5 border border-slate-200/10 rounded-2xl space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{ins.category}</span>
                    <span className="text-[10px] font-mono font-bold text-brand-500">Impact: {ins.impact.split(' ')[0]}</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
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
                      Apply Optimization Target
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
export default Dashboard;
