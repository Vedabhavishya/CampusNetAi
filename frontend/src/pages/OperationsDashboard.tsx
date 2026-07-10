import React, { useState, useMemo } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Table } from '../components/Table';
import { StatusBadge, HealthIndicator } from '../components/EnterpriseWidgets';
import { useNetworkStore } from '../contexts/NetworkStoreContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Activity, Shield, Wifi, Server, Users, Layers, AlertCircle, 
  Clock, CheckCircle2, Sparkles, RefreshCcw, Bell, Lock, Calendar, Trash2, ArrowUpRight 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const OperationsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    devices, 
    clients, 
    alerts, 
    tasks, 
    insights, 
    ssids, 
    vlans, 
    maintenanceWindows, 
    logs, 
    securityEvents, 
    healthScores,
    applyInsight,
    rollbackConfiguration 
  } = useNetworkStore();

  const isReadOnly = user?.role === 'Network Engineer';
  const [isApplyingId, setIsApplyingId] = useState<string | null>(null);

  const handleApplyInsight = async (id: string) => {
    setIsApplyingId(id);
    try {
      await applyInsight(id);
    } finally {
      setIsApplyingId(null);
    }
  };

  const handleRollback = async (rollbackPoint: string) => {
    if (isReadOnly) return;
    if (confirm('Initiate system state rollback?')) {
      await rollbackConfiguration(rollbackPoint);
    }
  };

  // Summaries Calculations
  const onlineCount = devices.filter(d => d.status === 'online').length;
  const offlineCount = devices.filter(d => d.status === 'offline').length;
  const activeTasksCount = tasks.filter(t => t.status === 'running' || t.status === 'pending').length;
  const activeMaintCount = maintenanceWindows.filter(w => w.status === 'active').length;
  const criticalAlertsCount = alerts.filter(a => a.severity === 'critical' && !a.resolved).length;

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-left">
        <div>
          <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white m-0">
            Operations Center Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time Operations console and Single Pane of Glass monitoring for system operators.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/devices')}>
            Manage Inventory
          </Button>
          <Button variant="primary" onClick={() => navigate('/discovery')}>
            <Server className="h-4 w-4 mr-1.5" /> Device Discovery
          </Button>
        </div>
      </div>

      {/* Summary Stats Row Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[
          { label: 'Network Health', val: `${healthScores.campus}%`, sub: 'Campus aggregate', icon: Activity, color: 'text-emerald-500 bg-emerald-500/10' },
          { label: 'Security Score', val: '96%', sub: 'No breaches', icon: Shield, color: 'text-blue-500 bg-blue-500/10' },
          { label: 'WiFi Health', val: `${healthScores.wifi}%`, sub: 'Coverage index', icon: Wifi, color: 'text-indigo-500 bg-indigo-500/10' },
          { label: 'Total Devices', val: devices.length, sub: `${onlineCount} Up / ${offlineCount} Down`, icon: Server, color: 'text-cyan-500 bg-cyan-500/10' },
          { label: 'Clients Connected', val: clients.length, sub: 'Active hosts', icon: Users, color: 'text-brand-500 bg-brand-500/10' },
          { label: 'Active SSIDs', val: ssids.length, sub: 'Wireless bands', icon: Wifi, color: 'text-purple-500 bg-purple-500/10' },
          { label: 'Active VLANs', val: vlans.length, sub: 'L2 Subnets', icon: Layers, color: 'text-rose-500 bg-rose-500/10' },
          { label: 'Active Tasks', val: activeTasksCount, sub: 'In execution queue', icon: RefreshCcw, color: 'text-amber-500 bg-amber-500/10 animate-spin-slow' },
          { label: 'Critical Alerts', val: criticalAlertsCount, sub: 'Requires inspection', icon: AlertCircle, color: 'text-red-500 bg-red-500/10' },
          { label: 'Maintenance Mode', val: activeMaintCount, sub: 'Alerts suppressed', icon: Calendar, color: 'text-slate-500 bg-slate-500/10' },
          { label: 'Monthly SLA', val: '99.98%', sub: 'Target: 99.9%', icon: Clock, color: 'text-teal-500 bg-teal-500/10' },
          { label: 'Operator Role', val: user?.role.split(' ')[0] || 'Engineer', sub: 'Permissions bound', icon: Lock, color: 'text-fuchsia-500 bg-fuchsia-500/10' }
        ].map((c, idx) => (
          <Card key={idx} noPadding className="relative overflow-hidden p-4 flex flex-col justify-between text-left h-[100px]">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{c.label}</p>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1 font-display leading-tight">{c.val}</h3>
              </div>
              <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${c.color}`}>
                <c.icon className="h-4 w-4" />
              </div>
            </div>
            <p className="text-[9px] font-medium text-slate-500 truncate mt-auto">{c.sub}</p>
          </Card>
        ))}
      </div>

      {/* Main Panels Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: AI Recommendations & Scheduled Maintenance */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Actionable AI Insights */}
          <Card title="Operational Recommendations" description="Actionable AI optimizations targets:" className="text-left">
            {insights.filter(i => i.status === 'pending').length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 font-medium">All optimized states. No recommendations.</div>
            ) : (
              <div className="space-y-4">
                {insights.filter(i => i.status === 'pending').map(ins => (
                  <div key={ins.id} className="p-3.5 bg-slate-500/5 border border-slate-200/10 rounded-2xl space-y-2">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-bold text-slate-400 uppercase tracking-wider">{ins.category}</span>
                      <span className="font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">Confidence: 94%</span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 mt-1">
                      <Sparkles className="h-3.5 w-3.5 text-brand-500" />
                      {ins.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-sans">{ins.description}</p>
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="primary"
                        onClick={() => handleApplyInsight(ins.id)}
                        isLoading={isApplyingId === ins.id}
                        disabled={isReadOnly}
                        className="text-[10px] py-1.5 px-3 flex-1"
                      >
                        Apply Recommendation
                      </Button>
                      <Button variant="ghost" className="text-[10px] py-1.5 px-3">Ignore</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Scheduled Maintenance Windows */}
          <Card title="Scheduled Maintenance Calendar" description="Upcoming changes and staging periods:" className="text-left">
            {maintenanceWindows.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 font-medium">No scheduled maintenance tasks.</div>
            ) : (
              <div className="space-y-3">
                {maintenanceWindows.map(w => (
                  <div key={w.id} className="p-3 bg-slate-500/5 border border-slate-200/10 rounded-2xl space-y-1 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-700 dark:text-slate-200">{w.deviceName}</span>
                      <StatusBadge status={w.status === 'active' ? 'warning' : 'online'} />
                    </div>
                    <p className="text-[11px] text-slate-400 font-sans">{w.reason}</p>
                    <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium pt-1 border-t border-slate-200/10">
                      <span>Engineer: {w.engineer}</span>
                      <span>Starts: {new Date(w.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Center & Right Column: Task Queue, Alarm feeds, Audit Trail */}
        <div className="lg:col-span-2 space-y-6 text-left">
          
          {/* Active Alarms/Alerts Feed */}
          <Card title="Active Network Alarms" description="Outstanding alerts requiring operator response:">
            {alerts.filter(a => !a.resolved).length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 font-medium">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                No active alarms in system. Uptime is nominal.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200/50 dark:border-slate-800/80 rounded-2xl text-xs">
                <table className="min-w-full divide-y divide-slate-200/50 dark:divide-slate-800/50">
                  <thead className="bg-slate-50/50 dark:bg-slate-900/50">
                    <tr>
                      <th className="px-4 py-3 text-slate-400 text-left font-semibold">Alarm Details</th>
                      <th className="px-4 py-3 text-slate-400 text-left font-semibold">Severity</th>
                      <th className="px-4 py-3 text-slate-400 text-left font-semibold">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/40 dark:divide-slate-800/40 bg-transparent text-slate-700 dark:text-slate-300">
                    {alerts.filter(a => !a.resolved).slice(0, 5).map(a => (
                      <tr key={a.id}>
                        <td className="px-4 py-3 font-medium">{a.message}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            a.severity === 'critical' ? 'bg-red-500/10 text-red-500' :
                            a.severity === 'warning' ? 'bg-amber-500/10 text-amber-500' :
                            'bg-blue-500/10 text-blue-500'
                          }`}>
                            {a.severity}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-medium font-mono text-[10px]">
                          {new Date(a.timestamp).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Provisioning queue */}
          <Card title="Provisioning Workflows Queue" description="Descriptive tracking logs of active configuration deployments:">
            {tasks.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 font-medium">No configuration rollouts recorded.</div>
            ) : (
              <div className="space-y-4">
                {tasks.slice(0, 3).map(task => (
                  <div key={task.id} className="p-4 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl space-y-2.5">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">{task.name}</h4>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">ID: {task.id} | Deployer: {task.createdBy}</p>
                      </div>
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        task.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                        task.status === 'failed' ? 'bg-rose-500/10 text-rose-500' :
                        'bg-amber-500/10 text-amber-500 animate-pulse'
                      }`}>
                        {task.status}
                      </span>
                    </div>

                    {/* Progress Bar with Steps */}
                    <div className="space-y-1">
                      <div className="w-full bg-slate-200 dark:bg-slate-850 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-brand-500 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${task.progress}%` }} 
                        />
                      </div>
                      <div className="flex justify-between text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                        <span>Schema Validation</span>
                        <span>Config Generation</span>
                        <span>Apply & Sync</span>
                        <span>Verification</span>
                      </div>
                    </div>

                    {/* Latest log statement */}
                    <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl font-mono text-[10px] text-slate-300">
                      {`> ${task.logs[task.logs.length - 1]}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Recent Security Logs & Audit Trail */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Audit Trail Logs */}
            <Card title="Recent Configuration Changes" description="Audit log of system manipulations:">
              {logs.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 font-medium">No actions committed yet.</div>
              ) : (
                <div className="space-y-3">
                  {logs.slice(0, 4).map(l => (
                    <div key={l.id} className="p-3 bg-slate-500/5 border border-slate-200/10 rounded-2xl space-y-1 text-[11px]">
                      <div className="flex justify-between font-bold text-slate-700 dark:text-slate-200">
                        <span>{l.action}</span>
                        <span className="font-mono text-[9px] text-slate-500">{new Date(l.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-[10px] text-slate-400">Target: <span className="font-mono font-bold">{l.target}</span> | User: {l.user}</p>
                      {l.rollbackPoint && !isReadOnly && (
                        <button
                          onClick={() => handleRollback(l.rollbackPoint!)}
                          className="text-[9px] font-bold text-brand-500 hover:text-brand-600 flex items-center gap-0.5 mt-1 cursor-pointer"
                        >
                          <RefreshCcw className="h-2.5 w-2.5" /> Revert Configuration
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Security Events */}
            <Card title="Recent Security Violations" description="Failed logins and firewall threat alerts:">
              {securityEvents.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 font-medium">Nominal security baseline. No threats.</div>
              ) : (
                <div className="space-y-3">
                  {securityEvents.slice(0, 4).map(e => (
                    <div key={e.id} className="p-3 bg-slate-500/5 border border-slate-200/10 rounded-2xl space-y-1 text-[11px]">
                      <div className="flex justify-between font-bold text-slate-700 dark:text-slate-200">
                        <span className={`capitalize ${
                          e.severity === 'critical' ? 'text-red-500' :
                          e.severity === 'high' ? 'text-orange-500' : 'text-amber-500'
                        }`}>{e.category.replace('_', ' ')}</span>
                        <span className="font-mono text-[9px] text-slate-500">{new Date(e.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">{e.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
};
export default OperationsDashboard;
