import React, { useMemo } from 'react';
import { Card } from '../components/Card';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Activity, Clock, ShieldAlert, Cpu, Heart, CheckCircle2 } from 'lucide-react';

export const SlaDashboard: React.FC = () => {
  // Mock historical metrics
  const slaHistoryData = useMemo(() => {
    return [
      { day: 'Mon', campus: 99.98, latency: 12, loss: 0.01, response: 180 },
      { day: 'Tue', campus: 99.99, latency: 14, loss: 0.02, response: 195 },
      { day: 'Wed', campus: 99.95, latency: 22, loss: 0.05, response: 240 },
      { day: 'Thu', campus: 99.99, latency: 11, loss: 0.01, response: 175 },
      { day: 'Fri', campus: 99.97, latency: 13, loss: 0.02, response: 190 },
      { day: 'Sat', campus: 99.99, latency: 8, loss: 0.00, response: 160 },
      { day: 'Sun', campus: 99.98, latency: 9, loss: 0.00, response: 165 }
    ];
  }, []);

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="text-left">
        <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white m-0">
          Service Level Agreement (SLA) Metrics
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Monitor aggregated packet latency, packet loss ratios, and hardware uptime availabilities targets.
        </p>
      </div>

      {/* KPI Cards Row Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Campus WAN availability', score: '99.98%', sub: 'Target threshold: 99.90%', icon: Heart, color: 'text-emerald-500 bg-emerald-500/10' },
          { label: 'Avg Latency ms', score: '12.4 ms', sub: 'Nominal peak: 25.0 ms', icon: Clock, color: 'text-blue-500 bg-blue-500/10' },
          { label: 'Packet Loss Ratio', score: '0.018 %', sub: 'Max threshold: 0.100%', icon: ShieldAlert, color: 'text-rose-500 bg-rose-500/10' },
          { label: 'Telemetry Response', score: '182 ms', sub: 'API round-trip load', icon: Activity, color: 'text-teal-500 bg-teal-500/10' }
        ].map((card, idx) => (
          <Card key={idx} noPadding className="relative overflow-hidden group">
            <div className="p-5 flex justify-between items-center text-left">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{card.label}</p>
                <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1.5 font-display">{card.score}</h3>
                <p className="text-[10px] text-slate-500 mt-2 font-semibold">{card.sub}</p>
              </div>
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${card.color}`}>
                <card.icon className="h-5 w-5" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-200 dark:bg-slate-800" />
          </Card>
        ))}
      </div>

      {/* Device Class Availabilities Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Firewall stack', val: '99.99%', score: 99 },
          { label: 'Core spine switch', val: '99.99%', score: 99 },
          { label: 'Access edge switch', val: '99.96%', score: 96 },
          { label: 'Wireless WiFi cell', val: '99.94%', score: 94 },
          { label: 'Mist Access Points', val: '99.98%', score: 98 }
        ].map((item, idx) => (
          <Card key={idx} className="p-4 flex flex-col items-center justify-center text-center space-y-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{item.label}</span>
            <span className="text-lg font-extrabold text-slate-900 dark:text-white font-display">{item.val}</span>
            {/* Small bar indicator */}
            <div className="w-16 bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-brand-500 h-full rounded-full" style={{ width: `${item.score}%` }} />
            </div>
          </Card>
        ))}
      </div>

      {/* SLA Trend Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Availability Trend */}
        <Card title="Campus Availability SLA Trend" description="Weekly aggregate availability targets percentage:" className="text-left">
          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={slaHistoryData}>
                <defs>
                  <linearGradient id="slaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} domain={[99.9, 100]} />
                <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 12, fontSize: 11, color: '#fff' }} />
                <Area type="monotone" dataKey="campus" stroke="#10b981" fillOpacity={1} fill="url(#slaGrad)" strokeWidth={2.5} name="SLA Availability (%)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Latency & Packet Loss Trend */}
        <Card title="Aggregate Latency & Loss" description="Daily peak round-trip packet transmission metrics:" className="text-left">
          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={slaHistoryData}>
                <defs>
                  <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: 12, fontSize: 11, color: '#fff' }} />
                <Area type="monotone" dataKey="latency" stroke="#0ea5e9" fillOpacity={1} fill="url(#latencyGrad)" strokeWidth={2} name="Latency (ms)" />
                <Area type="monotone" dataKey="loss" stroke="#ef4444" fill="transparent" strokeWidth={1.5} name="Packet Loss (%)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};
export default SlaDashboard;
