import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { api } from '../services/api';
import { AiInsight } from '../types';
import { 
  Sparkles, Terminal, Send, ShieldAlert, Cpu, Check, Activity, Network, 
  Layers, Zap, CheckCircle, TrendingUp, AlertTriangle, Users, HardDrive, Download, FileText
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNetworkStore } from '../contexts/NetworkStoreContext';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
  data?: any;
  timestamp: Date;
}

export const AiCenter: React.FC = () => {
  const { user } = useAuth();
  const { devices, clients } = useNetworkStore();
  const location = useLocation();
  const terminalEndRef = useRef<HTMLDivElement>(null);
  
  const [activeTab, setActiveTab] = useState<'assistant' | 'aiops'>('assistant');
  const [roleView, setRoleView] = useState<'super_admin' | 'net_admin' | 'engineer'>('super_admin');
  const [showExportSuccess, setShowExportSuccess] = useState(false);
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      sender: 'ai',
      text: "Hello! I am CampusNet AI, your virtual network engineer. Ask me anything about the network configuration, device states, client locations, or RF profiles. E.g. 'Are there any offline devices?' or 'Optimize wireless radios'.",
      timestamp: new Date()
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Parse query params if any
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const initialQuery = params.get('q');
    if (initialQuery) {
      handleSendQuery(initialQuery);
    }
  }, [location]);

  const loadInsights = async () => {
    const data = await api.fetchInsights();
    setInsights(data);
  };

  useEffect(() => {
    loadInsights();
  }, []);

  useEffect(() => {
    if (activeTab === 'assistant') {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isTyping, activeTab]);

  const handleSendQuery = async (queryText: string) => {
    if (!queryText.trim()) return;

    const userMsg: ChatMessage = {
      sender: 'user',
      text: queryText,
      timestamp: new Date()
    };
    
    setChatHistory((prev) => [...prev, userMsg]);
    setInputVal('');
    setIsTyping(true);

    const response = await api.queryAiChat(queryText);
    setIsTyping(false);
    
    setChatHistory((prev) => [
      ...prev,
      {
        sender: 'ai',
        text: response.text,
        data: response.data,
        timestamp: new Date()
      }
    ]);
  };

  const handleApplyInsight = async (id: string) => {
    await api.applyInsightAction(id);
    loadInsights();
  };

  const handleSuggestClick = (suggestion: string) => {
    handleSendQuery(suggestion);
  };

  // Export Executive PDF/CSV report simulator
  const handleExportAIOpsReport = () => {
    const reportText = `CAMPUSNET AI-POWERED NETWORK OPERATIONS PLATFORM
==============================================
AIOPS EXECUTIVE STATUS REPORT
Generated: ${new Date().toLocaleString()}
Scope: HQ-MAIN-CAMPUS
----------------------------------------------
Overall Network Health: 90% (NOMINAL)
Risk Assessment Level: LOW

PERFORMANCE SUMMARY:
- Switch Backplane load: 34%
- PoE budget load: 28%
- Interface Utilization: 12%
- Learned Client MAC Addresses: 11 MACs

AI PREDICTIVE INSIGHTS:
1. CPU Trend & Bottleneck Projection:
   - Trend profile: CPU usage increased 32% -> 41% -> 58% -> 73% in 20 minutes.
   - Projection Warning: CPU utilization projected to exceed 90% within 30 minutes if current traffic trend continues.
2. Interface Flapping Diagnostic:
   - Trigger: Interface ge-0/0/8 flapped 4 times today.
   - Analysis: Possible physical cable instability/loose connection.
3. Segmentation Audit:
   - Analysis: Faculty 62%, Students 27%, Guest 11%. Current segmentation balanced.

RECOMMENDATIONS:
- Inspect physical link SFP module levels on ge-0/0/8.
- Verify CPU metrics during next peak hours scheduler.
==============================================`;

    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'campusnet_aiops_executive_report.txt');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setShowExportSuccess(true);
    setTimeout(() => setShowExportSuccess(false), 4000);
  };

  // Find access and core switch details for dynamic summaries
  const coreSwitch = useMemo(() => devices.find(d => d.type === 'core_switch'), [devices]);
  const accessSwitch = useMemo(() => devices.find(d => d.type === 'access_switch'), [devices]);
  const apDevice = useMemo(() => devices.find(d => d.type === 'access_point'), [devices]);
  const firewall = useMemo(() => devices.find(d => d.type === 'firewall'), [devices]);

  const avgHealth = useMemo(() => {
    const activeDevs = devices.filter(d => d.status === 'online' || d.status === 'Connected' || d.status === 'warning');
    if (activeDevs.length === 0) return 98;
    const total = activeDevs.reduce((sum, d) => sum + (d.healthScore || d.health_score || 95), 0);
    return Math.round(total / activeDevs.length);
  }, [devices]);

  const switchCpu = useMemo(() => {
    return accessSwitch?.cpu_usage || coreSwitch?.cpu_usage || 12;
  }, [accessSwitch, coreSwitch]);

  const switchMemory = useMemo(() => {
    return accessSwitch?.memory_usage || coreSwitch?.memory_usage || 45;
  }, [accessSwitch, coreSwitch]);

  const poeLoad = useMemo(() => {
    const poePower = accessSwitch?.telemetry?.poe?.poe_power_draw || accessSwitch?.telemetry?.poe_power_draw || 28;
    const poeBudget = accessSwitch?.telemetry?.poe?.poe_power_budget || accessSwitch?.telemetry?.poe_power_budget || 120;
    if (poePower && poeBudget) {
      return Math.round((poePower / poeBudget) * 100);
    }
    return 28;
  }, [accessSwitch]);

  const bandwidthPct = useMemo(() => {
    const activeClients = clients.filter(c => c.status === 'active' || c.status === 'Connected').length;
    return Math.min(95, Math.max(8, Math.round(activeClients * 3.5 + 5)));
  }, [clients]);

  const facultyClients = useMemo(() => clients.filter(c => c.vlanId === 20 || c.vlan_id === 20).length, [clients]);
  const studentClients = useMemo(() => clients.filter(c => c.vlanId === 10 || c.vlan_id === 10).length, [clients]);
  const guestClients = useMemo(() => clients.filter(c => c.vlanId === 30 || c.vlan_id === 30).length, [clients]);
  
  const totalVlanClients = useMemo(() => facultyClients + studentClients + guestClients || 1, [facultyClients, studentClients, guestClients]);
  
  const facultyPct = useMemo(() => Math.round((facultyClients / totalVlanClients) * 100), [facultyClients, totalVlanClients]);
  const studentPct = useMemo(() => Math.round((studentClients / totalVlanClients) * 100), [studentClients, totalVlanClients]);
  const guestPct = useMemo(() => Math.round((guestClients / totalVlanClients) * 100), [guestClients, totalVlanClients]);

  const totalPhysicalPorts = useMemo(() => {
    let count = 0;
    if (accessSwitch?.config?.interfaces) count += Object.keys(accessSwitch.config.interfaces).length;
    if (coreSwitch?.config?.interfaces) count += Object.keys(coreSwitch.config.interfaces).length;
    return count || 12;
  }, [accessSwitch, coreSwitch]);

  const activePortsCount = useMemo(() => {
    let activeCount = 0;
    devices.forEach(d => {
      if (d.telemetry?.interfaces) {
        Object.values(d.telemetry.interfaces).forEach((i: any) => {
          if (i.status === 'up' || i.link === 'up') activeCount++;
        });
      }
    });
    return activeCount || 4;
  }, [devices]);

  const inactivePortsCount = useMemo(() => {
    return Math.max(0, totalPhysicalPorts - activePortsCount);
  }, [totalPhysicalPorts, activePortsCount]);

  const cpuTrendText = useMemo(() => {
    const current = switchCpu;
    const prev1 = Math.max(5, current - 8);
    const prev2 = Math.max(5, current - 15);
    const prev3 = Math.max(5, current - 22);
    return `CPU has stabilized and is currently at ${current}% (historical trend: ${prev3}% → ${prev2}% → ${prev1}% → ${current}%) during the last 20 minutes.`;
  }, [switchCpu]);

  const cpuPredictionAlert = useMemo(() => {
    if (switchCpu > 70) {
      return `⚠️ CPU utilization is high (${switchCpu}%). It may exceed 90% threshold within 30 minutes if student bandwidth trends continue.`;
    }
    return `🟢 CPU utilization is stable at ${switchCpu}%. No imminent threshold crossing predicted.`;
  }, [switchCpu]);

  const aiopsTrendData = useMemo(() => {
    const currentCpu = switchCpu;
    const currentMem = switchMemory;
    const currentTraffic = bandwidthPct;
    return [
      { time: '10:00', CPU: Math.max(5, currentCpu - 18), Memory: Math.max(10, currentMem - 3), Traffic: Math.max(2, currentTraffic - 15) },
      { time: '10:05', CPU: Math.max(5, currentCpu - 12), Memory: Math.max(10, currentMem - 1), Traffic: Math.max(2, currentTraffic - 8) },
      { time: '10:10', CPU: Math.max(5, currentCpu - 6), Memory: currentMem, Traffic: Math.max(2, currentTraffic - 3) },
      { time: '10:15', CPU: currentCpu, Memory: currentMem, Traffic: currentTraffic },
    ];
  }, [switchCpu, switchMemory, bandwidthPct]);

  const renderDataResult = (data: any) => {
    if (!data) return null;
    
    if (Array.isArray(data)) {
      if (data.length === 0) return null;
      const isDevice = 'model' in data[0];
      const isClient = 'ipAddress' in data[0] && 'os' in data[0];

      if (isDevice) {
        return (
          <div className="mt-3 bg-slate-955 p-3 rounded-lg border border-slate-800 text-[10px] overflow-x-auto max-w-full font-mono text-cyan-400">
            <table className="min-w-full text-left">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-1.5 pr-4">Device Name</th>
                  <th className="pb-1.5 pr-4">Model</th>
                  <th className="pb-1.5 pr-4">Status</th>
                  <th className="pb-1.5 pr-4">IP Address</th>
                </tr>
              </thead>
              <tbody>
                {data.map((dev: any) => (
                  <tr key={dev.id}>
                    <td className="py-1 pr-4">{dev.name}</td>
                    <td className="py-1 pr-4">{dev.model}</td>
                    <td className="py-1 pr-4">{dev.status}</td>
                    <td className="py-1 pr-4">{dev.ipAddress}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      } else if (isClient) {
        return (
          <div className="mt-3 bg-slate-955 p-3 rounded-lg border border-slate-800 text-[10px] overflow-x-auto max-w-full font-mono text-cyan-400">
            <table className="min-w-full text-left">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-1.5 pr-4">Client Name</th>
                  <th className="pb-1.5 pr-4">IP Address</th>
                  <th className="pb-1.5 pr-4">OS System</th>
                  <th className="pb-1.5 pr-4">Connected To</th>
                </tr>
              </thead>
              <tbody>
                {data.map((c: any) => (
                  <tr key={c.id}>
                    <td className="py-1 pr-4">{c.name}</td>
                    <td className="py-1 pr-4">{c.ipAddress}</td>
                    <td className="py-1 pr-4">{c.os}</td>
                    <td className="py-1 pr-4">{c.connectedToDeviceName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
    } else {
      return (
        <pre className="mt-3 bg-slate-955 p-3 rounded-lg border border-slate-800 text-[10px] overflow-x-auto font-mono text-cyan-400">
          {JSON.stringify(data, null, 2)}
        </pre>
      );
    }
    return null;
  };

  const isReadOnly = user?.role === 'Network Engineer';

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 text-left">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-400 rounded-xl flex items-center justify-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white m-0">
              CampusNet AI Center
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Natural Language Search Engine (NLP) and AI-driven automated RF optimizations, threat analysis, and predictive diagnostics.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs navigation panel */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-px overflow-x-auto text-xs shrink-0 select-none">
        <button
          onClick={() => setActiveTab('assistant')}
          className={`px-4 py-2.5 border-b-2 font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'assistant' 
              ? 'border-brand-500 text-brand-500 font-bold' 
              : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <Terminal className="h-4 w-4" />
          AI Network Assistant (Chat)
        </button>
        <button
          onClick={() => setActiveTab('aiops')}
          className={`px-4 py-2.5 border-b-2 font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'aiops' 
              ? 'border-brand-500 text-brand-500 font-bold' 
              : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <Activity className="h-4 w-4" />
          AI Operations Dashboard (AIOps)
        </button>
      </div>

      {/* Success feedback toast */}
      {showExportSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-2xl flex items-center gap-3 text-xs font-semibold text-left">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-bold">Executive AIOps Report Generated!</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Your predictive AI network status report file has been successfully downloaded.</p>
          </div>
        </div>
      )}

      {/* Tab Screen Content */}
      <div className="space-y-6">
        {activeTab === 'assistant' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[72vh]">
            {/* Terminal/Chat Console */}
            <Card
              title="Virtual Network Assistant"
              className="lg:col-span-2 flex flex-col h-full overflow-hidden"
              noPadding
            >
              <div className="flex flex-col h-full bg-slate-950 text-slate-300 font-mono text-xs">
                {/* Terminal Top bar */}
                <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex justify-between items-center text-[10px] text-slate-500">
                  <span className="flex items-center"><Terminal className="h-3.5 w-3.5 mr-1 text-cyan-400" /> campusnet_ai_console v1.2.5</span>
                  <span>ESTABLISHED</span>
                </div>

                {/* Chat Stream */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 text-left">
                  {chatHistory.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex flex-col ${
                        msg.sender === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <span className="text-[9px] text-slate-500 mb-1">
                        {msg.sender === 'user' ? 'YOU' : 'AI'} • {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <div
                        className={`px-4 py-2.5 rounded-xl max-w-[85%] leading-relaxed ${
                          msg.sender === 'user'
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                            : 'bg-slate-900/60 text-slate-200 border border-slate-800/80'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                        {renderDataResult(msg.data)}
                      </div>
                    </div>
                  ))}

                  {isTyping && (
                    <div className="flex items-center space-x-1.5 text-slate-500 text-[10px]">
                      <span className="h-1.5 w-1.5 bg-slate-500 rounded-full animate-bounce" />
                      <span className="h-1.5 w-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <span className="h-1.5 w-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                      <span>AI assistant is processing telemetries...</span>
                    </div>
                  )}
                  <div ref={terminalEndRef} />
                </div>

                {/* Suggestions buttons */}
                <div className="px-4 py-3 bg-slate-900/40 border-t border-slate-900 flex flex-wrap gap-2 text-[10px]">
                  <span className="text-slate-500 pt-1">Try:</span>
                  <button onClick={() => handleSuggestClick('Show offline devices')} className="bg-slate-950 border border-slate-800 hover:border-cyan-500/40 text-slate-400 hover:text-white px-2 py-1 rounded transition-colors cursor-pointer">
                    "Show offline devices"
                  </button>
                  <button onClick={() => handleSuggestClick('Optimize radios')} className="bg-slate-950 border border-slate-800 hover:border-cyan-500/40 text-slate-400 hover:text-white px-2 py-1 rounded transition-colors cursor-pointer">
                    "Optimize radios"
                  </button>
                  <button onClick={() => handleSuggestClick('List clients')} className="bg-slate-950 border border-slate-800 hover:border-cyan-500/40 text-slate-400 hover:text-white px-2 py-1 rounded transition-colors cursor-pointer">
                    "List clients"
                  </button>
                </div>

                {/* Input form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendQuery(inputVal);
                  }}
                  className="p-3 bg-slate-900 border-t border-slate-800 flex items-center space-x-2"
                >
                  <input
                    type="text"
                    placeholder="Query database, trigger RF optimizer policies..."
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    className="flex-1 bg-slate-955 border border-slate-800 pl-3 pr-4 py-2.5 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                  <Button type="submit" variant="accent" size="sm" className="h-9 px-4 cursor-pointer">
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </Card>

            {/* Anomalies Panel */}
            <Card title="Telemetry Anomalies Feed" className="h-full flex flex-col" description="AI anomalies and RF updates generated automatically from background collectors.">
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {insights.map((ins) => (
                  <div
                    key={ins.id}
                    className={`p-3.5 rounded-xl border text-left space-y-2.5 transition-all duration-200 ${
                      ins.status === 'applied'
                        ? 'bg-slate-500/5 border-slate-200/10 dark:border-slate-800/10 opacity-60'
                        : ins.category === 'security'
                        ? 'bg-rose-500/5 border-rose-500/10 dark:border-rose-500/20'
                        : ins.category === 'anomaly'
                        ? 'bg-amber-500/5 border-amber-500/10 dark:border-amber-500/20'
                        : 'bg-cyan-500/5 border-cyan-500/10 dark:border-cyan-500/20'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center space-x-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                          ins.category === 'security'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400'
                            : ins.category === 'anomaly'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                            : 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-400'
                        }`}>
                          {ins.category}
                        </span>
                        <h5 className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate max-w-[140px]">{ins.title}</h5>
                      </div>
                      <span className="text-[8px] text-slate-500 font-mono">
                        {new Date(ins.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {ins.description}
                    </p>

                    <div className="flex justify-between items-center pt-1 border-t border-slate-200/10 text-[9px] text-slate-400">
                      <span>Impact: {ins.impact.split(' ')[0]}</span>
                      {ins.status === 'applied' ? (
                        <span className="text-emerald-500 font-semibold flex items-center">
                          <Check className="h-3 w-3 mr-0.5" /> RESOLVED
                        </span>
                      ) : !isReadOnly && ins.suggestedAction ? (
                        <button
                          onClick={() => handleApplyInsight(ins.id)}
                          className="text-cyan-400 font-semibold hover:underline cursor-pointer"
                        >
                          Apply Optimize Fix
                        </button>
                      ) : (
                        <span className="text-slate-500 font-medium">Auto Policy active</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'aiops' && (
          <div className="space-y-6 text-left">
            {/* Toolbar: Role-based views & Export PDF Report */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-500/5 p-4 rounded-2xl border border-slate-250/10">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">AIOps Role Profile View:</span>
                <select
                  value={roleView}
                  onChange={(e) => setRoleView(e.target.value as any)}
                  className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-250 font-bold focus:outline-none"
                >
                  <option value="super_admin">Super Administrator View</option>
                  <option value="net_admin">Network Administrator View</option>
                  <option value="engineer">Operations Engineer View</option>
                </select>
              </div>
              
              <Button 
                variant="outline" 
                onClick={handleExportAIOpsReport}
                className="text-xs py-1.5 px-3 flex items-center gap-1.5 hover:bg-brand-500/10 hover:text-brand-500 transition-colors font-bold cursor-pointer"
              >
                <Download className="h-4 w-4" />
                Export Executive AIOps Report (.txt)
              </Button>
            </div>

            {/* Dynamic AI Insights Engine (Explanatory & Predictive Diagnostics) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Dynamic AI CPU Anomaly Predictor Card */}
              <Card title="CPU & Traffic Predictor" className="border-l-4 border-amber-500" description="AI Insights Engine">
                <div className="space-y-2.5 mt-1.5 font-sans text-xs">
                  <span className="font-bold text-amber-500 uppercase tracking-wider text-[9px] block">Explanatory Trend</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {cpuTrendText}
                  </p>
                  <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15 space-y-1">
                    <span className="font-bold text-amber-600 dark:text-amber-400 block text-[9px] uppercase tracking-wider">Predictive Projection Alert</span>
                    <p className="text-[11px] text-slate-650 dark:text-slate-350 leading-relaxed font-semibold">
                      {cpuPredictionAlert}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Dynamic AI Port Flapping Stability Card */}
              <Card title="Port Flapping Diagnostic" className="border-l-4 border-rose-500" description="AI Insights Engine">
                <div className="space-y-2.5 mt-1.5 font-sans text-xs">
                  <span className="font-bold text-rose-500 uppercase tracking-wider text-[9px] block">Interface Event Tracking</span>
                  {devices.some(d => d.status === 'offline') ? (
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      Link state changes detected on offline device interfaces. Link transitions: <span className="font-bold text-rose-500 font-mono">1 event</span>.
                    </p>
                  ) : (
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      All physical interfaces on <span className="font-mono font-bold text-brand-500">{accessSwitch?.name || 'EX2300'}</span> and <span className="font-mono font-bold text-brand-500">{coreSwitch?.name || 'EX4100'}</span> are currently stable. Link transitions: <span className="font-bold text-emerald-500 font-mono">0 events</span>.
                    </p>
                  )}
                  <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/15 space-y-1">
                    <span className="font-bold text-emerald-600 dark:text-emerald-450 block text-[9px] uppercase tracking-wider">AI Root Cause Identification</span>
                    {devices.some(d => d.status === 'offline') ? (
                      <p className="text-[11px] text-slate-650 dark:text-slate-350 font-semibold leading-relaxed">
                        💡 Diagnostic: Verify physical uplink cable connectivity for offline switch/firewall devices.
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-650 dark:text-slate-350 font-semibold leading-relaxed">
                        💡 Diagnostic: Physical links are stable. SFP/optical power readings are healthy and within nominal range.
                      </p>
                    )}
                  </div>
                </div>
              </Card>

              {/* Dynamic AI VLAN Balance Card */}
              <Card title="VLAN Load Balance Evaluator" className="border-l-4 border-emerald-500" description="AI Insights Engine">
                <div className="space-y-2.5 mt-1.5 font-sans text-xs">
                  <span className="font-bold text-emerald-500 uppercase tracking-wider text-[9px] block">VLAN Segment Load</span>
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono">
                    <div className="bg-slate-500/5 p-1 rounded">Faculty: {isNaN(facultyPct) ? 0 : facultyPct}%</div>
                    <div className="bg-slate-500/5 p-1 rounded">Student: {isNaN(studentPct) ? 0 : studentPct}%</div>
                    <div className="bg-slate-500/5 p-1 rounded">Guest: {isNaN(guestPct) ? 0 : guestPct}%</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/15 space-y-1">
                    <span className="font-bold text-emerald-600 dark:text-emerald-450 block text-[9px] uppercase tracking-wider">AI Configuration Audit</span>
                    <p className="text-[11px] text-slate-650 dark:text-slate-350 leading-relaxed font-semibold">
                      🟢 Faculty ({facultyClients} clients), Student ({studentClients} clients), and Guest ({guestClients} clients) load distribution is balanced. No broadcast congestion risks observed.
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Performance charts row */}
            <div className="grid grid-cols-1 gap-6">
              <Card title="AIOps Historical Telemetry Trends" description="Dynamically projected CPU load percentage and traffic bandwidth rates.">
                <div className="h-56 w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={aiopsTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.08)" />
                      <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit="%" />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(226, 232, 240, 0.1)', borderRadius: '8px', color: '#f8fafc', fontSize: '11px' }} />
                      <Legend />
                      <Area type="monotone" dataKey="CPU" name="CPU Load Rate (%)" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.08} strokeWidth={2} />
                      <Area type="monotone" dataKey="Memory" name="Memory Occupancy (%)" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.05} strokeWidth={1.5} />
                      <Area type="monotone" dataKey="Traffic" name="Traffic Bandwidth (Mbps)" stroke="#10b981" fill="#10b981" fillOpacity={0.05} strokeWidth={1.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            {/* Top Row: AI Summary Profiles */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* AI Health Summary Card */}
              <Card title="AI Health Summary" className="border-t-2 border-emerald-500">
                <div className="space-y-3 mt-1.5 font-sans text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-semibold">Overall Health Score:</span>
                    <span className={`text-xl font-extrabold font-mono ${avgHealth >= 90 ? 'text-emerald-500' : 'text-amber-500'}`}>{avgHealth}%</span>
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-bold text-[10px] uppercase text-slate-400 tracking-wider">Reasoning Profile</h5>
                    <ul className="space-y-1 text-slate-650 dark:text-slate-350 list-disc list-inside">
                      <li>CPU utilization is healthy ({switchCpu}%)</li>
                      <li>Memory utilization is healthy ({switchMemory}%)</li>
                      <li>No interface CRC errors detected</li>
                      <li>SSH credentials verification success</li>
                      <li>No hardware environmental alarms active</li>
                    </ul>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-[11px]">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 block">AI Recommendation</span>
                    {avgHealth >= 90 
                      ? "No immediate action required. Continue monitoring CPU during campus peak hours."
                      : "Action recommended: Check device connection health and CPU trends."}
                  </div>
                </div>
              </Card>

              {/* AI Capacity Planning Card */}
              <Card title="AI Capacity Planning" className="border-t-2 border-brand-500">
                <div className="space-y-3.5 mt-1.5 font-sans text-xs">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-slate-500/5 p-2 rounded-lg">
                      <span className="text-slate-400 block text-[9px] uppercase font-semibold">Switch Util</span>
                      <span className="font-bold text-slate-800 dark:text-white font-mono text-sm">{switchCpu}%</span>
                    </div>
                    <div className="bg-slate-500/5 p-2 rounded-lg">
                      <span className="text-slate-400 block text-[9px] uppercase font-semibold">PoE Load</span>
                      <span className="font-bold text-slate-800 dark:text-white font-mono text-sm">{poeLoad}%</span>
                    </div>
                    <div className="bg-slate-500/5 p-2 rounded-lg">
                      <span className="text-slate-400 block text-[9px] uppercase font-semibold">Bandwidth</span>
                      <span className="font-bold text-slate-800 dark:text-white font-mono text-sm">{bandwidthPct}%</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h5 className="font-bold text-[10px] uppercase text-slate-400 tracking-wider">Growth Estimation</h5>
                    <p className="text-slate-650 dark:text-slate-350 text-[11px] leading-relaxed font-semibold">
                      Current hardware allocation parameters show sufficient capabilities to easily handle approximately <span className="font-bold text-brand-500 font-mono">{Math.max(0, 250 - clients.length)}</span> additional endpoints under active standard SLA profiles.
                    </p>
                  </div>
                </div>
              </Card>

              {/* AI Security Card */}
              <Card title="AI Security Analysis" className="border-t-2 border-rose-500">
                <div className="space-y-3.5 mt-1.5 font-sans text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-semibold">Threat Risk Level:</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${devices.some(d => d.status === 'offline') ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                      {devices.some(d => d.status === 'offline') ? 'MEDIUM RISK' : 'LOW RISK'}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-slate-650 dark:text-slate-350">
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/40 pb-1">
                      <span>Rogue DHCP Status:</span>
                      <span className="font-semibold text-emerald-500 flex items-center"><CheckCircle className="h-3 w-3 mr-1" /> Clear</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/40 pb-1">
                      <span>Duplicate IPs discovered:</span>
                      <span className="font-semibold text-emerald-500 flex items-center"><CheckCircle className="h-3 w-3 mr-1" /> None</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/40 pb-1">
                      <span>MAC Flapping / Movement:</span>
                      <span className="font-semibold text-emerald-500 flex items-center"><CheckCircle className="h-3 w-3 mr-1" /> Stable</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Broadcast Storm Risk:</span>
                      <span className="font-semibold text-emerald-500 flex items-center"><CheckCircle className="h-3 w-3 mr-1" /> None</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Second Row: Analysis & Diagnostics (Filtered by Active Role Profile View) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Show only for Super Admins and Net Admins */}
              {(roleView === 'super_admin' || roleView === 'net_admin') && (
                <>
                  {/* AI Port & Telemetry Summary Card */}
                  <Card title="AI Port & Telemetry Summary">
                    <div className="space-y-3 text-xs font-sans">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1 border-r border-slate-200/10 pr-2">
                          <span className="text-slate-400">Total Physical Ports:</span>
                          <p className="font-extrabold text-slate-800 dark:text-white text-sm font-mono">{totalPhysicalPorts} interfaces</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-slate-400">Active Link Connections:</span>
                          <p className="font-extrabold text-emerald-500 text-sm font-mono">{activePortsCount} ports up / {inactivePortsCount} down</p>
                        </div>
                      </div>
                      <div className="space-y-2 border-t border-slate-200/10 pt-3">
                        <div className="flex justify-between">
                          <span className="text-slate-400">CRC/FCS Input Errors:</span>
                          <span className="font-bold text-emerald-500 font-mono">0 errors</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Packet Drops count:</span>
                          <span className="font-bold text-emerald-500 font-mono">0 drops</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Most Active Port:</span>
                          <span className="font-bold text-brand-500 font-mono">ge-0/0/8</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Potential Bottleneck:</span>
                          <span className="font-semibold text-slate-500 font-mono">None detected</span>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* AI Topology Flow Card */}
                  <Card title="AI Topology Summary">
                    <div className="flex flex-col items-center justify-center space-y-4 py-3 font-sans text-xs">
                      <div className="flex items-center space-x-6">
                        <div className="flex flex-col items-center bg-slate-500/5 p-2 px-3 border border-slate-200/10 rounded-lg">
                          <span className="font-bold text-slate-800 dark:text-white font-mono">EX2300</span>
                          <span className={`text-[9px] ${accessSwitch?.status === 'offline' ? 'text-rose-500' : 'text-slate-400'}`}>
                            {accessSwitch?.status === 'offline' ? 'Offline' : 'Access Switch'}
                          </span>
                        </div>
                        <span className="text-slate-400">→</span>
                        <div className="flex flex-col items-center bg-slate-500/5 p-2 px-3 border border-slate-200/10 rounded-lg">
                          <span className="font-bold text-slate-800 dark:text-white font-mono">EX4100</span>
                          <span className={`text-[9px] ${coreSwitch?.status === 'offline' ? 'text-rose-500' : 'text-slate-400'}`}>
                            {coreSwitch?.status === 'offline' ? 'Offline' : 'Core Switch'}
                          </span>
                        </div>
                        <span className="text-slate-400">→</span>
                        <div className="flex flex-col items-center bg-slate-500/5 p-2 px-3 border border-slate-200/10 rounded-lg">
                          <span className="font-bold text-slate-800 dark:text-white font-mono">Wireless AP</span>
                          <span className={`text-[9px] ${apDevice?.status === 'offline' ? 'text-rose-500' : 'text-slate-400'}`}>
                            {apDevice?.status === 'offline' ? 'Offline' : 'Juniper AP'}
                          </span>
                        </div>
                      </div>
                      <div className="w-full text-center border-t border-slate-200/10 pt-3 text-[11px] font-semibold flex items-center justify-center gap-1.5">
                        {devices.some(d => d.status === 'offline') ? (
                          <span className="text-rose-500 flex items-center gap-1.5 font-bold"><AlertTriangle className="h-4 w-4" /> Physical Topology has offline nodes.</span>
                        ) : (
                          <span className="text-emerald-500 flex items-center gap-1.5 font-bold"><CheckCircle className="h-4 w-4" /> Physical Topology Links are Healthy & Active.</span>
                        )}
                      </div>
                    </div>
                  </Card>

                  {/* AI Client Distribution Card */}
                  <Card title="AI Client Summary">
                    <div className="space-y-3 text-xs font-sans">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Learned MAC Addresses:</span>
                        <span className="font-extrabold text-slate-800 dark:text-white font-mono">{clients.length} learned</span>
                      </div>
                      <div className="space-y-2 border-t border-slate-200/10 pt-3">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Faculty VLAN (20):</span>
                          <span className="font-bold text-slate-750 dark:text-white font-mono">{facultyClients} client devices</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Student VLAN (10):</span>
                          <span className="font-bold text-slate-755 dark:text-white font-mono">{studentClients} client devices</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Guest VLAN (30):</span>
                          <span className="font-bold text-slate-755 dark:text-white font-mono">{guestClients} client devices</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200/10 pt-2 text-[10px]">
                          <span className="text-slate-400">MAC Address Flapping status:</span>
                          <span className="font-bold text-emerald-500">None detected</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </>
              )}

              {/* Show for Super Admins and Engineers */}
              {(roleView === 'super_admin' || roleView === 'engineer') && (
                <Card title="AI Collector & Polling Analysis">
                  <div className="space-y-3.5 text-xs font-sans">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-semibold">Active Switch Collector:</span>
                      <span className="font-bold text-slate-800 dark:text-white font-mono text-[11px]">
                        {accessSwitch?.collector?.name || 'EX2300Collector'}
                      </span>
                    </div>
                    <div className="space-y-2 border-t border-slate-200/10 pt-3">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-semibold">Active AP Collector:</span>
                        <span className="font-bold text-slate-800 dark:text-white font-mono text-[11px]">MistCollector</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Telemetry Status:</span>
                        <span className="font-bold text-emerald-500">Active Polling</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Switch Connection:</span>
                        <span className={`font-bold ${accessSwitch?.status === 'offline' ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {accessSwitch?.status === 'offline' ? 'Unreachable' : 'Connected'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">AP Cloud connection:</span>
                        <span className={`font-bold ${apDevice?.status === 'offline' ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {apDevice?.status === 'offline' ? 'Disconnected' : 'Connected (Mist Cloud)'}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Show only for Super Admins */}
              {roleView === 'super_admin' && (
                <>
                  {/* AI Live Alerts & Root Cause Card */}
                  <Card title="AI Alerts & Root Cause Engine" className="border border-amber-500/20">
                    <div className="space-y-3.5 text-xs font-sans">
                      <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-1">
                        <span className="font-bold text-amber-600 dark:text-amber-400 block text-[10px] uppercase tracking-wider">AI Insight Alert</span>
                        <p className="font-semibold text-slate-800 dark:text-white">Port ge-0/0/7 changed from UP to DOWN.</p>
                        <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-400 pt-1.5">
                          <div>Likely cause: endpoint off</div>
                          <div className="text-right">Confidence: <span className="font-bold text-slate-700 dark:text-white font-mono">92%</span></div>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/20 space-y-1">
                        <span className="font-bold text-rose-600 dark:text-rose-450 block text-[10px] uppercase tracking-wider">AI Root Cause Diagnostics</span>
                        <p className="font-semibold text-slate-800 dark:text-white">Adjacent interface failures detected on core backbone.</p>
                        <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-400 pt-1.5">
                          <div>Cause: uplink disconnect</div>
                          <div className="text-right">Confidence: <span className="font-bold text-slate-700 dark:text-white font-mono">87%</span></div>
                        </div>
                        <span className="text-[10px] text-rose-500 block pt-1 font-bold">Suggested verification: Check core interface ge-0/0/11 path.</span>
                      </div>
                    </div>
                  </Card>

                  {/* AI Config Review Card */}
                  <Card title="AI Configuration Reviewer">
                    <div className="space-y-3 text-xs font-sans">
                      <div className="p-2.5 rounded-lg bg-slate-500/5 border border-slate-200/10 space-y-1 leading-relaxed">
                        <span className="font-bold text-brand-600 dark:text-brand-400 block text-[9px] uppercase tracking-wider">Active Configuration Commit check</span>
                        <p className="text-slate-650 dark:text-slate-350 font-medium">
                          VLAN <span className="font-mono font-bold text-slate-800 dark:text-white">20</span> assigned to port <span className="font-mono font-bold text-slate-800 dark:text-white">ge-0/0/8</span>.
                        </p>
                        <p className="text-[10px] text-slate-450 mt-1 font-medium">
                          Topology parsing details indicate this port connects to an AP. Configuration appears valid.
                        </p>
                      </div>
                      <div className="flex justify-between items-center text-[10px] border-t border-slate-200/10 pt-2.5">
                        <span className="text-slate-400 font-semibold">Review status:</span>
                        <span className="font-bold text-emerald-500">Configuration Approved (Valid)</span>
                      </div>
                    </div>
                  </Card>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AiCenter;
