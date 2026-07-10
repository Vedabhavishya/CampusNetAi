import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { api } from '../services/api';
import { AiInsight } from '../types';
import { Sparkles, Terminal, Send, Play, ShieldAlert, Cpu, Check, Activity } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
  data?: any;
  timestamp: Date;
}

export const AiCenter: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const terminalEndRef = useRef<HTMLDivElement>(null);
  
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
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isTyping]);

  const handleSendQuery = async (queryText: string) => {
    if (!queryText.trim()) return;

    // Add user message
    const userMsg: ChatMessage = {
      sender: 'user',
      text: queryText,
      timestamp: new Date()
    };
    
    setChatHistory((prev) => [...prev, userMsg]);
    setInputVal('');
    setIsTyping(true);

    // Call API
    const response = await api.queryAiChat(queryText);
    
    setIsTyping(false);
    
    // Add AI message
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

  const renderDataResult = (data: any) => {
    if (!data) return null;
    
    if (Array.isArray(data)) {
      if (data.length === 0) return null;
      // Is list of devices/clients/alerts
      const isDevice = 'model' in data[0];
      const isClient = 'ipAddress' in data[0] && 'os' in data[0];

      if (isDevice) {
        return (
          <div className="mt-3 bg-slate-950 p-3 rounded-lg border border-slate-800 text-[10px] overflow-x-auto max-w-full font-mono text-cyan-400">
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
          <div className="mt-3 bg-slate-950 p-3 rounded-lg border border-slate-800 text-[10px] overflow-x-auto max-w-full font-mono text-cyan-400">
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
      // Single object
      return (
        <pre className="mt-3 bg-slate-950 p-3 rounded-lg border border-slate-800 text-[10px] overflow-x-auto font-mono text-cyan-400">
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-400 rounded-xl flex items-center justify-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white m-0">
              CampusNet AI Center
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Natural Language Search Engine (NLP) and AI-driven automated RF optimizations and threat analysis.
            </p>
          </div>
        </div>
      </div>

      {/* Grid: AI Chat Console + Anomalies List */}
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
              <span className="flex items-center"><Terminal className="h-3.5 w-3.5 mr-1 text-cyan-400" /> campusnet_ai_console v1.1.2</span>
              <span>ESTABLISHED</span>
            </div>

            {/* Chat Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
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
                className="flex-1 bg-slate-950 border border-slate-800 pl-3 pr-4 py-2.5 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
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
    </div>
  );
};
export default AiCenter;
