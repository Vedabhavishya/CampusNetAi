import React, { useState } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { BarChart3, Download, Calendar } from 'lucide-react';

const trafficBySsid = [
  { name: '08:00', Corporate: 120, Guest: 30, IoT: 5 },
  { name: '10:00', Corporate: 450, Guest: 180, IoT: 8 },
  { name: '12:00', Corporate: 380, Guest: 220, IoT: 10 },
  { name: '14:00', Corporate: 420, Guest: 150, IoT: 9 },
  { name: '16:00', Corporate: 490, Guest: 110, IoT: 7 },
  { name: '18:00', Corporate: 210, Guest: 85, IoT: 6 },
];

const cpuMemoryHistory = [
  { time: '10:00', Firewall: 12, Switch01: 22, Switch02: 45 },
  { time: '11:00', Firewall: 15, Switch01: 20, Switch02: 78 }, // Sw02 spike
  { time: '12:00', Firewall: 14, Switch01: 24, Switch02: 60 },
  { time: '13:00', Firewall: 18, Switch01: 25, Switch02: 48 },
  { time: '14:00', Firewall: 16, Switch01: 22, Switch02: 30 },
  { time: '15:00', Firewall: 15, Switch01: 21, Switch02: 24 },
];

const channelUsage = [
  { channel: 'Ch 1 (2.4G)', occupancy: 2 },
  { channel: 'Ch 6 (2.4G)', occupancy: 4 },
  { channel: 'Ch 11 (2.4G)', occupancy: 1 },
  { channel: 'Ch 36 (5G)', occupancy: 5 },
  { channel: 'Ch 44 (5G)', occupancy: 3 },
  { channel: 'Ch 149 (5G)', occupancy: 2 },
];

export const Analytics: React.FC = () => {
  const [timeframe, setTimeframe] = useState('24h');

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-400 rounded-xl flex items-center justify-center">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white m-0">
              Network Analytics & Telemetries
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Analyze cumulative bandwidth parameters, device load histograms, and RF channel occupancy spectrums.
            </p>
          </div>
        </div>
        
        {/* Time selector */}
        <div className="flex items-center space-x-2">
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
            {['1h', '24h', '7d', '30d'].map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-3 py-1 rounded text-xs font-semibold uppercase cursor-pointer ${
                  timeframe === t
                    ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-cyan-400 shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <Button variant="secondary" className="cursor-pointer">
            <Calendar className="h-4 w-4 mr-2" />
            Select Range
          </Button>
        </div>
      </div>

      {/* Grid of charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stacked Traffic SSID */}
        <Card title="Traffic Volume by Broadcast SSID" description="Distribution of network throughput in MBs.">
          <div className="h-72 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trafficBySsid} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.08)" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit=" MB" />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(226, 232, 240, 0.1)', borderRadius: '8px', color: '#f8fafc', fontSize: '11px' }} />
                <Legend />
                <Bar dataKey="Corporate" stackId="a" fill="#0ea5e9" />
                <Bar dataKey="Guest" stackId="a" fill="#06b6d4" />
                <Bar dataKey="IoT" stackId="a" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* CPU Memory line chart */}
        <Card title="Hardware CPU Load History" description="Trace historical device utilization percentages. Sw02 spike is highlighted.">
          <div className="h-72 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cpuMemoryHistory} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.08)" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit="%" />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(226, 232, 240, 0.1)', borderRadius: '8px', color: '#f8fafc', fontSize: '11px' }} />
                <Legend />
                <Line type="monotone" dataKey="Firewall" stroke="#10b981" strokeWidth={2} activeDot={{ r: 8 }} />
                <Line type="monotone" dataKey="Switch01" stroke="#0ea5e9" strokeWidth={2} />
                <Line type="monotone" dataKey="Switch02" stroke="#f59e0b" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* RF Channel Occupancy */}
        <Card title="RF Channel Spectrum Distribution" description="AP channel occupancy count to detect Wi-Fi co-channel interference.">
          <div className="h-72 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelUsage} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.08)" />
                <XAxis dataKey="channel" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} label={{ value: 'Access Points Count', angle: -90, position: 'insideLeft', offset: 0, style: { fill: '#64748b', fontSize: 10 } }} />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(226, 232, 240, 0.1)', borderRadius: '8px', color: '#f8fafc', fontSize: '11px' }} />
                <Bar dataKey="occupancy" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Anomaly distribution stats */}
        <Card title="Anomalies and Security incidents Timeline" description="Aggregated log telemetry count for the selected timeframe.">
          <div className="h-72 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={[
                  { name: 'Mon', security: 1, packetDrop: 12, loop: 0 },
                  { name: 'Tue', security: 0, packetDrop: 8, loop: 1 },
                  { name: 'Wed', security: 3, packetDrop: 45, loop: 0 },
                  { name: 'Thu', security: 1, packetDrop: 22, loop: 0 },
                  { name: 'Fri', security: 0, packetDrop: 10, loop: 0 },
                  { name: 'Sat', security: 0, packetDrop: 5, loop: 0 },
                  { name: 'Sun', security: 2, packetDrop: 14, loop: 1 },
                ]}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.08)" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(226, 232, 240, 0.1)', borderRadius: '8px', color: '#f8fafc', fontSize: '11px' }} />
                <Legend />
                <Area type="monotone" dataKey="packetDrop" name="Excessive Packets Drop" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} />
                <Area type="monotone" dataKey="security" name="Blocked Intrusion attempts" stroke="#rose-500" fill="#rose-500" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};
export default Analytics;
