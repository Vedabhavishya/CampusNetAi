import React, { useState, useMemo } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { StatusBadge } from '../components/EnterpriseWidgets';
import { useNetworkStore } from '../contexts/NetworkStoreContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  ShieldAlert, Shield, Users, Lock, Unlock, Eye, HelpCircle, 
  Terminal, Activity, Skull, AlertCircle, CheckCircle2 
} from 'lucide-react';

export const SecurityCenter: React.FC = () => {
  const { user } = useAuth();
  const { clients, securityEvents, alerts, runProvisioningTask } = useNetworkStore();
  
  const isReadOnly = user?.role === 'Network Engineer';

  // State arrays for quarantined / blocked / unknown MACs
  const [quarantinedMacs, setQuarantinedMacs] = useState<string[]>(['00:0B:82:FF:1A:2B']);
  const [blockedMacs, setBlockedMacs] = useState<string[]>(['00:0B:82:DD:4C:5E']);
  
  const unknownDevices = useMemo(() => {
    return [
      { macAddress: '00:0B:82:AA:77:88', ipAddress: '10.10.10.198', hostname: 'Unknown-IoT-Cam', lastSeen: '2 mins ago' },
      { macAddress: '00:0B:82:BB:88:99', ipAddress: '10.10.10.199', hostname: 'Unknown-Generic-Host', lastSeen: '5 mins ago' }
    ];
  }, []);

  const [macInput, setMacInput] = useState('');
  const [inputReason, setInputReason] = useState('Operator override security policy.');
  const [activeTab, setActiveTab] = useState<'blocked' | 'quarantined' | 'unknown'>('quarantined');

  // Actions
  const handleBlockMac = async (mac: string) => {
    if (isReadOnly || !mac) return;
    return runProvisioningTask(
      `Apply Blackhole MAC Policy: Block ${mac}`,
      ['CN-FW-01-BORDER'],
      async () => {
        setBlockedMacs(prev => [...new Set([...prev, mac.toUpperCase()])]);
        setMacInput('');
        return true;
      }
    );
  };

  const handleUnblockMac = async (mac: string) => {
    if (isReadOnly) return;
    return runProvisioningTask(
      `Lift Blackhole MAC Policy: Allow ${mac}`,
      ['CN-FW-01-BORDER'],
      async () => {
        setBlockedMacs(prev => prev.filter(x => x !== mac));
        return true;
      }
    );
  };

  const handleQuarantineMac = async (mac: string) => {
    if (isReadOnly || !mac) return;
    return runProvisioningTask(
      `Restrict network segment: Quarantine ${mac}`,
      ['CN-FW-01-BORDER', 'CN-CS-01-SPINE'],
      async () => {
        setQuarantinedMacs(prev => [...new Set([...prev, mac.toUpperCase()])]);
        setMacInput('');
        return true;
      }
    );
  };

  const handleReleaseMac = async (mac: string) => {
    if (isReadOnly) return;
    return runProvisioningTask(
      `Lift quarantine restriction on client host: ${mac}`,
      ['CN-FW-01-BORDER', 'CN-CS-01-SPINE'],
      async () => {
        setQuarantinedMacs(prev => prev.filter(x => x !== mac));
        return true;
      }
    );
  };

  // Computations
  const threatLevel = useMemo(() => {
    const criticals = alerts.filter(a => a.severity === 'critical' && !a.resolved).length;
    if (criticals > 0) return { label: 'CRITICAL THREATS ACTIVE', color: 'text-red-500 bg-red-500/10 border-red-500/20', pct: 85 };
    const warnings = alerts.filter(a => a.severity === 'warning' && !a.resolved).length;
    if (warnings > 0) return { label: 'ELEVATED SYSTEM ALERTS', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', pct: 45 };
    return { label: 'NOMINAL BASELINE STATUS', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', pct: 15 };
  }, [alerts]);

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-left">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 rounded-xl flex items-center justify-center">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white m-0">
              Campus Security Center
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Blackhole filtering tables, quarantine network pools, and login authentication events auditing.
            </p>
          </div>
        </div>
      </div>

      {/* Top Threat Indicators & Quick Block Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Threat Level Dial */}
        <Card title="Site Security Health Index" className="text-left flex flex-col justify-between h-full">
          <div className="flex items-center gap-4 py-2">
            {/* Simulated circular gauge */}
            <div className="relative h-20 w-20 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="40" cy="40" r="32" stroke="rgba(100, 116, 139, 0.1)" strokeWidth="6" fill="transparent" />
                <circle cx="40" cy="40" r="32" 
                  stroke={threatLevel.pct > 70 ? '#ef4444' : threatLevel.pct > 30 ? '#f59e0b' : '#10b981'} 
                  strokeWidth="6" 
                  fill="transparent" 
                  strokeDasharray={200}
                  strokeDashoffset={200 - (200 * threatLevel.pct) / 100}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute font-display font-extrabold text-sm text-slate-800 dark:text-slate-200">
                {threatLevel.pct}%
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Threat Index score</p>
              <div className={`mt-1.5 px-3 py-1 rounded-full text-[10px] font-bold border inline-block ${threatLevel.color}`}>
                {threatLevel.label}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 leading-normal mt-4">Calculated from raw firewall event correlations, authentication logs, and rogue AP signals.</p>
        </Card>

        {/* Quick Moderate MAC Panel */}
        <Card title="Quick Policy Enforcement Tool" className="lg:col-span-2 text-left" description="Apply instant quarantine or blocklist policies by MAC address:">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
            <div className="space-y-1">
              <span className="text-slate-500">Target Host MAC Address</span>
              <input
                type="text"
                value={macInput}
                onChange={e => setMacInput(e.target.value)}
                placeholder="e.g. 00:0B:82:FF:11:22"
                disabled={isReadOnly}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 font-mono"
              />
            </div>
            <div className="space-y-1">
              <span className="text-slate-500">Enforcement Reason</span>
              <input
                type="text"
                value={inputReason}
                onChange={e => setInputReason(e.target.value)}
                placeholder="e.g. Host exhibiting high ping loads"
                disabled={isReadOnly}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2"
              />
            </div>
          </div>
          <div className="flex gap-2.5 mt-4 justify-end">
            <Button
              variant="outline"
              onClick={() => handleQuarantineMac(macInput)}
              disabled={isReadOnly || !macInput}
              className="text-[10px] py-1.5"
            >
              Quarantine MAC Host
            </Button>
            <Button
              variant="danger"
              onClick={() => handleBlockMac(macInput)}
              disabled={isReadOnly || !macInput}
              className="text-[10px] py-1.5"
            >
              Blackhole MAC IP
            </Button>
          </div>
        </Card>
      </div>

      {/* Tabs & lists of security parameters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Tab Lists: Blocked, Quarantined, Unknown MACs */}
        <Card className="lg:col-span-2 text-left p-0 overflow-hidden">
          <div className="flex border-b border-slate-200/50 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 px-4">
            {[
              { id: 'quarantined', label: `Quarantined Pools (${quarantinedMacs.length})` },
              { id: 'blocked', label: `Blocked MACs (${blockedMacs.length})` },
              { id: 'unknown', label: `Rogue / Unknown Nodes (${unknownDevices.length})` }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                  activeTab === tab.id 
                    ? 'border-brand-500 text-brand-500 font-extrabold' 
                    : 'border-transparent text-slate-400 hover:text-slate-500'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-4">
            {activeTab === 'quarantined' && (
              <div className="space-y-2">
                {quarantinedMacs.length === 0 ? (
                  <p className="text-xs text-slate-400 py-10 text-center font-medium">No client hosts quarantined.</p>
                ) : (
                  quarantinedMacs.map(mac => (
                    <div key={mac} className="flex justify-between items-center p-3 bg-slate-500/5 border border-slate-200/10 rounded-2xl text-xs font-semibold">
                      <div>
                        <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">{mac}</span>
                        <span className="block text-[10px] text-slate-400 font-medium">Quarantined since: Just now | Reason: Suspicious ARP packet loads</span>
                      </div>
                      {!isReadOnly && (
                        <Button
                          variant="outline"
                          onClick={() => handleReleaseMac(mac)}
                          className="text-[10px] px-2 py-1 flex items-center gap-1.5"
                        >
                          <Unlock className="h-3 w-3" /> Release
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'blocked' && (
              <div className="space-y-2">
                {blockedMacs.length === 0 ? (
                  <p className="text-xs text-slate-400 py-10 text-center font-medium">No MAC addresses blocked.</p>
                ) : (
                  blockedMacs.map(mac => (
                    <div key={mac} className="flex justify-between items-center p-3 bg-slate-500/5 border border-slate-200/10 rounded-2xl text-xs font-semibold">
                      <div>
                        <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">{mac}</span>
                        <span className="block text-[10px] text-slate-400 font-medium">Dropped packets count: 184 | Status: Dropping at Spine L2</span>
                      </div>
                      {!isReadOnly && (
                        <Button
                          variant="outline"
                          onClick={() => handleUnblockMac(mac)}
                          className="text-[10px] px-2 py-1 flex items-center gap-1.5"
                        >
                          <Unlock className="h-3 w-3" /> Lift Block
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'unknown' && (
              <div className="space-y-2">
                {unknownDevices.map(d => (
                  <div key={d.macAddress} className="flex justify-between items-center p-3 bg-slate-500/5 border border-slate-200/10 rounded-2xl text-xs font-semibold">
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{d.hostname}</span>
                      <span className="block text-[10px] text-slate-400 font-mono mt-0.5">IP: {d.ipAddress} | MAC: {d.macAddress} | Seen: {d.lastSeen}</span>
                    </div>
                    {!isReadOnly && (
                      <div className="flex gap-1.5">
                        <Button
                          variant="outline"
                          onClick={() => handleQuarantineMac(d.macAddress)}
                          className="text-[10px] px-2 py-1"
                        >
                          Quarantine
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => handleBlockMac(d.macAddress)}
                          className="text-[10px] px-2 py-1"
                        >
                          Block
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Live Security Log Stream */}
        <Card title="Live Firewall Security Audit" description="Stream logs of firewall dropped actions and logins:" className="text-left flex flex-col h-full">
          <div className="flex-1 space-y-3.5 max-h-[300px] overflow-y-auto scrollbar-thin pr-1">
            {securityEvents.map(e => (
              <div key={e.id} className="p-3 bg-slate-900 border border-slate-800 rounded-2xl space-y-1 text-[11px] font-mono text-slate-300">
                <div className="flex justify-between items-center text-[9px] text-slate-500 font-bold uppercase">
                  <span className={`${e.severity === 'critical' ? 'text-red-500' : 'text-orange-500'}`}>{e.category}</span>
                  <span>{new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </div>
                <p className="leading-relaxed">{e.message}</p>
                <div className="text-[9px] text-slate-500 pt-0.5 font-bold">
                  Node: {e.device} | Role: {e.role}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
export default SecurityCenter;
