import React, { useState, useMemo } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { useNetworkStore } from '../contexts/NetworkStoreContext';
import { Bell, ShieldAlert, CheckCircle, Trash2, Check, AlertCircle, Search, Archive } from 'lucide-react';

export const NotificationCenter: React.FC = () => {
  const { user } = useAuth();
  const { alerts, resolveAlert } = useNetworkStore();

  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'devices' | 'security' | 'wifi' | 'automation' | 'system'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const isReadOnly = user?.role === 'Network Engineer';

  // Perform resolving and archiving action callbacks
  const handleResolve = async (id: string) => {
    if (isReadOnly) return;
    await resolveAlert(id);
  };

  const handleResolveAll = async () => {
    if (isReadOnly) return;
    for (const a of alerts) {
      if (!a.resolved) {
        await resolveAlert(a.id);
      }
    }
    alert('All active alert notifications resolved.');
  };

  // Filter alerts based on active states, tabs and search match
  const filteredAlertsList = useMemo(() => {
    return alerts.filter(a => {
      // 1. Severity check
      if (severityFilter !== 'all' && a.severity !== severityFilter) return false;

      // 2. Category check
      if (categoryFilter !== 'all') {
        const cat = a.category?.toLowerCase() || '';
        if (categoryFilter === 'devices' && !cat.includes('device') && !cat.includes('hardware') && !cat.includes('switch') && !cat.includes('port')) return false;
        if (categoryFilter === 'security' && !cat.includes('security') && !cat.includes('threat') && !cat.includes('fw') && !cat.includes('firewall')) return false;
        if (categoryFilter === 'wifi' && !cat.includes('wifi') && !cat.includes('ssid') && !cat.includes('ap')) return false;
        if (categoryFilter === 'automation' && !cat.includes('rule') && !cat.includes('automation') && !cat.includes('script')) return false;
        if (categoryFilter === 'system' && cat !== 'system' && cat !== 'chassis' && cat !== 'cpu') return false;
      }

      // 3. Search query match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const msg = a.message?.toLowerCase() || '';
        const dev = a.deviceName?.toLowerCase() || '';
        if (!msg.includes(q) && !dev.includes(q)) return false;
      }

      return true;
    });
  }, [alerts, severityFilter, categoryFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-left">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 rounded-xl flex items-center justify-center">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white m-0">
              Notification & Alarms Center
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Acknowledge warnings, clear critical alarms, and sort events logs by service categories.
            </p>
          </div>
        </div>
        {!isReadOnly && alerts.some(a => !a.resolved) && (
          <Button variant="outline" onClick={handleResolveAll} className="text-xs">
            Acknowledge All Alerts
          </Button>
        )}
      </div>

      {/* Search & Filter Controls Panel */}
      <Card className="p-4 text-left space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Search */}
          <div className="relative w-full md:w-80">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search notifications message..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-10 pr-4 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
            />
          </div>

          {/* Severity Filters */}
          <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
            {[
              { id: 'all', label: 'All Severities' },
              { id: 'critical', label: 'Critical' },
              { id: 'warning', label: 'Warning' },
              { id: 'info', label: 'Info' }
            ].map(sev => (
              <button
                key={sev.id}
                onClick={() => setSeverityFilter(sev.id as any)}
                className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                  severityFilter === sev.id
                    ? 'bg-brand-500 text-white border-brand-500 font-bold'
                    : 'bg-slate-500/5 text-slate-400 border-slate-200/10 hover:text-slate-500'
                }`}
              >
                {sev.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category Filters Row */}
        <div className="border-t border-slate-200/10 pt-3 flex flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-wider">
          {[
            { id: 'all', label: 'All Categories Mappings' },
            { id: 'devices', label: 'Devices / Ports' },
            { id: 'security', label: 'Security Threats' },
            { id: 'wifi', label: 'WiFi Cells' },
            { id: 'automation', label: 'Automation Rules' },
            { id: 'system', label: 'System Core' }
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id as any)}
              className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                categoryFilter === cat.id
                  ? 'bg-slate-200 dark:bg-slate-850 text-slate-800 dark:text-white font-extrabold'
                  : 'text-slate-400 hover:text-slate-500'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Notifications Table List */}
      <Card noPadding className="text-left">
        {filteredAlertsList.length === 0 ? (
          <div className="py-20 text-center text-xs text-slate-400 font-medium">
            <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto mb-2 opacity-80" />
            No alarms match selection criteria. Nominals parameters active.
          </div>
        ) : (
          <div className="overflow-x-auto text-xs">
            <table className="min-w-full divide-y divide-slate-200/50 dark:divide-slate-800/50">
              <thead className="bg-slate-50/50 dark:bg-slate-900/50">
                <tr>
                  <th className="px-4 py-3 text-slate-400 text-left font-semibold">Severity</th>
                  <th className="px-4 py-3 text-slate-400 text-left font-semibold">Message</th>
                  <th className="px-4 py-3 text-slate-400 text-left font-semibold">Category</th>
                  <th className="px-4 py-3 text-slate-400 text-left font-semibold">Device</th>
                  <th className="px-4 py-3 text-slate-400 text-left font-semibold">Timestamp</th>
                  <th className="px-4 py-3 text-slate-400 text-left font-semibold">State</th>
                  <th className="px-4 py-3 text-slate-400 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/40 dark:divide-slate-800/40 bg-transparent text-slate-700 dark:text-slate-300">
                {filteredAlertsList.map(alert => (
                  <tr key={alert.id} className="hover:bg-slate-500/5">
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        alert.severity === 'critical' ? 'bg-rose-500/10 text-rose-500' :
                        alert.severity === 'warning' ? 'bg-amber-500/10 text-amber-500' :
                        'bg-blue-500/10 text-blue-500'
                      }`}>
                        {alert.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold break-words max-w-xs">{alert.message}</td>
                    <td className="px-4 py-3 capitalize font-semibold">{alert.category}</td>
                    <td className="px-4 py-3 font-mono font-semibold">{alert.deviceName || 'System Core'}</td>
                    <td className="px-4 py-3 font-mono">{new Date(alert.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${
                        alert.resolved ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500 animate-pulse'
                      }`}>
                        {alert.resolved ? 'Resolved' : 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!alert.resolved && !isReadOnly && (
                        <Button
                          variant="outline"
                          onClick={() => handleResolve(alert.id)}
                          className="text-[10px] py-1 px-2.5 flex items-center gap-1 ml-auto"
                        >
                          <Check className="h-3 w-3" /> Resolve
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
export default NotificationCenter;
