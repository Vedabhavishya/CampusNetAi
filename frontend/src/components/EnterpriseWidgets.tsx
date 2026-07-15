import React from 'react';
import { Shield, Settings, Server, Wifi, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { DeviceStatus, DeviceType } from '../types';

// 1. STATUS BADGE
interface StatusBadgeProps {
  status: DeviceStatus | 'active' | 'inactive';
  label?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  const getColors = () => {
    switch (status) {
      case 'online':
      case 'active':
        return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20 dark:border-emerald-500/30';
      case 'warning':
        return 'text-amber-500 bg-amber-500/10 border-amber-500/20 dark:border-amber-500/30';
      case 'offline':
      case 'inactive':
        return 'text-slate-400 bg-slate-500/10 border-slate-200 dark:border-slate-800/80';
      default:
        return 'text-slate-500 bg-slate-500/10 border-slate-200';
    }
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getColors()}`}>
      <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${
        status === 'online' || status === 'active' ? 'bg-emerald-500' :
        status === 'warning' ? 'bg-amber-500' : 'bg-slate-400'
      }`} />
      {label || status}
    </span>
  );
};

// 2. HEALTH INDICATOR
interface HealthIndicatorProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export const HealthIndicator: React.FC<HealthIndicatorProps> = ({ score, size = 'md' }) => {
  const getColor = (val: number) => {
    if (val >= 90) return 'text-emerald-500 stroke-emerald-500';
    if (val >= 75) return 'text-amber-500 stroke-amber-500';
    return 'text-rose-500 stroke-rose-500';
  };

  const getBgColor = (val: number) => {
    if (val >= 90) return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    if (val >= 75) return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
  };

  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  if (size === 'sm') {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] font-bold font-mono ${getBgColor(score)}`}>
        {score}%
      </span>
    );
  }

  const dimensions = size === 'lg' ? 'h-16 w-16' : 'h-11 w-11';
  const textClass = size === 'lg' ? 'text-lg' : 'text-xs';

  return (
    <div className={`relative flex items-center justify-center ${dimensions}`}>
      <svg className="absolute transform -rotate-90 w-full h-full">
        <circle
          cx="50%"
          cy="50%"
          r={radius}
          className="stroke-slate-200 dark:stroke-slate-800"
          strokeWidth="3"
          fill="transparent"
        />
        <circle
          cx="50%"
          cy="50%"
          r={radius}
          className={`transition-all duration-500 ease-out ${getColor(score)}`}
          strokeWidth="3.5"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <span className={`font-mono font-bold select-none text-slate-800 dark:text-slate-100 ${textClass}`}>
        {score}
      </span>
    </div>
  );
};

// 3. CAPABILITY CHIPS
interface CapabilityChipsProps {
  deviceType: DeviceType;
  capabilities: string[];
}

export const CapabilityChips: React.FC<CapabilityChipsProps> = ({ deviceType, capabilities }) => {
  const getIcon = (type: DeviceType) => {
    switch (type) {
      case 'firewall': return <Shield className="h-3 w-3 mr-1" />;
      case 'core_switch':
      case 'access_switch': return <Server className="h-3 w-3 mr-1" />;
      case 'access_point': return <Wifi className="h-3 w-3 mr-1" />;
      default: return <Settings className="h-3 w-3 mr-1" />;
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {capabilities.map((cap, idx) => (
        <span
          key={idx}
          className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 text-slate-500 dark:text-slate-400"
        >
          {getIcon(deviceType)}
          {cap}
        </span>
      ))}
    </div>
  );
};
