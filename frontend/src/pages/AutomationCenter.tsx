import React, { useState } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Table } from '../components/Table';
import { Modal } from '../components/Modal';
import { Zap, Play, Terminal, Database, Activity, RefreshCw, CheckCircle, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ConfigBackup {
  id: string;
  filename: string;
  timestamp: string;
  size: string;
  deviceType: string;
}

interface ZtpTemplate {
  id: string;
  name: string;
  model: string;
  profile: string;
  active: boolean;
}

const initialBackups: ConfigBackup[] = [
  { id: 'cfg-1', filename: 'CN-FW-01-BORDER_backup_2026-07-06.cfg', timestamp: '2026-07-06 22:00:00', size: '145 KB', deviceType: 'Firewall' },
  { id: 'cfg-2', filename: 'CN-CS-01-SPINE_backup_2026-07-06.cfg', timestamp: '2026-07-06 22:05:00', size: '98 KB', deviceType: 'Core Switch' },
  { id: 'cfg-3', filename: 'CN-AS-01-FLOOR1_backup_2026-07-06.cfg', timestamp: '2026-07-06 22:10:00', size: '64 KB', deviceType: 'Access Switch' },
];

const initialZtp: ZtpTemplate[] = [
  { id: 'ztp-1', name: 'AP-Standard-Template', model: 'Juniper Mist AP43', profile: 'SSID:Corp,VLAN:20,Radio:Auto', active: true },
  { id: 'ztp-2', name: 'Access-Switch-Standard-Template', model: 'Juniper EX2300-48P', profile: 'VLAN-Tagging:20,30,40,PoE:Enabled', active: true },
];

export const AutomationCenter: React.FC = () => {
  const { user } = useAuth();
  const [backups, setBackups] = useState<ConfigBackup[]>(initialBackups);
  const [ztpList, setZtpList] = useState<ZtpTemplate[]>(initialZtp);
  
  // Backup state
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState(false);

  // Webhooks state
  const [webhookUrl, setWebhookUrl] = useState('https://example.com/webhooks/slack-incoming-alerts');
  const [webhookTestSuccess, setWebhookTestSuccess] = useState(false);

  // ZTP Modal state
  const [isZtpOpen, setIsZtpOpen] = useState(false);
  const [ztpName, setZtpName] = useState('');
  const [ztpModel, setZtpModel] = useState('Juniper Mist AP43');
  const [ztpProfile, setZtpProfile] = useState('');

  const handleTriggerBackup = () => {
    setIsBackingUp(true);
    setTimeout(() => {
      setIsBackingUp(false);
      const newBackup: ConfigBackup = {
        id: 'cfg-' + Math.random().toString(36).substring(7),
        filename: `CampusNet_CoreStack_backup_${new Date().toISOString().split('T')[0]}.cfg`,
        timestamp: new Date().toLocaleString(),
        size: '112 KB',
        deviceType: 'System'
      };
      setBackups([newBackup, ...backups]);
      setBackupSuccess(true);
      setTimeout(() => setBackupSuccess(false), 2000);
    }, 1500);
  };

  const handleTestWebhook = () => {
    setWebhookTestSuccess(true);
    setTimeout(() => setWebhookTestSuccess(false), 2000);
  };

  const handleAddZtp = (e: React.FormEvent) => {
    e.preventDefault();
    const newZtp: ZtpTemplate = {
      id: 'ztp-' + Math.random().toString(36).substring(7),
      name: ztpName,
      model: ztpModel,
      profile: ztpProfile,
      active: true
    };
    setZtpList([...ztpList, newZtp]);
    setIsZtpOpen(false);
    setZtpName('');
    setZtpProfile('');
  };

  const handleDeleteZtp = (id: string) => {
    if (confirm('Deactivate and delete this ZTP provisioning profile?')) {
      setZtpList(ztpList.filter(z => z.id !== id));
    }
  };

  const isReadOnly = user?.role === 'Network Engineer';

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-400 rounded-xl flex items-center justify-center">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white m-0">
              Automation Center
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Automate network configurations, manage daily baseline backups, define Zero-Touch Provisioning (ZTP) rules, and configure webhooks.
            </p>
          </div>
        </div>
      </div>

      {/* Grid: Backups + ZTP */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Backups card */}
        <Card
          title="Daily Configuration Backups"
          description="Manage automated baseline file backups for routers, switches, and firewalls."
          headerActions={
            !isReadOnly && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleTriggerBackup}
                isLoading={isBackingUp}
                className="cursor-pointer"
              >
                <Database className="h-4 w-4 mr-1.5" />
                Backup Now
              </Button>
            )
          }
        >
          {backupSuccess && (
            <p className="text-xs font-semibold text-emerald-500 mb-3 animate-pulse">
              ✔ Configuration backup successfully compiled and saved to local repository stack.
            </p>
          )}

          <div className="overflow-x-auto text-xs">
            <table className="min-w-full divide-y divide-slate-200/50 dark:divide-slate-800/50">
              <thead className="bg-slate-50/50 dark:bg-slate-900/50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-400 uppercase">Device</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-400 uppercase">Backup Filename</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-400 uppercase">Size</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-400 uppercase">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/30 dark:divide-slate-800/30 text-slate-700 dark:text-slate-300">
                {backups.map((bak) => (
                  <tr key={bak.id}>
                    <td className="px-4 py-3 font-semibold">{bak.deviceType}</td>
                    <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400">{bak.filename}</td>
                    <td className="px-4 py-3 font-mono">{bak.size}</td>
                    <td className="px-4 py-3 font-mono">{bak.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ZTP Profiles card */}
        <Card
          title="Zero-Touch Provisioning (ZTP)"
          description="Map hardware models to configuration templates to provision units automatically on plug-in."
          headerActions={
            !isReadOnly && (
              <button
                onClick={() => setIsZtpOpen(true)}
                className="text-xs font-semibold text-brand-500 hover:underline cursor-pointer"
              >
                Create ZTP rule
              </button>
            )
          }
        >
          <div className="space-y-4">
            {ztpList.map((ztp) => (
              <div
                key={ztp.id}
                className="p-4 rounded-xl bg-slate-500/5 border border-slate-200/40 dark:border-slate-800/40 flex justify-between items-center text-left"
              >
                <div>
                  <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{ztp.name}</h5>
                  <p className="text-[10px] text-slate-400 mt-0.5">Model Model: {ztp.model}</p>
                  <p className="text-[10px] text-cyan-400 font-mono mt-1">Profile Profile: {ztp.profile}</p>
                </div>
                {!isReadOnly && (
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteZtp(ztp.id)} className="text-rose-500 hover:text-rose-700 cursor-pointer">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Webhooks panel */}
      <Card title="System Webhooks integration" description="Broadcast event alerts (e.g. switch offline, rogue IP blocks) to Slack/Discord channels.">
        <div className="flex flex-col md:flex-row items-end gap-4 text-left text-xs">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Webhook URL
            </label>
            <input
              type="text"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none"
            />
          </div>
          <div>
            <Button variant="secondary" onClick={handleTestWebhook} className="w-full md:w-auto h-10 cursor-pointer">
              Test Webhook Trigger
            </Button>
          </div>
        </div>
        {webhookTestSuccess && (
          <p className="text-xs font-semibold text-emerald-500 mt-3 animate-pulse text-left">
            ✔ Test webhook packet emitted: 200 OK. Slack channel integration synced correctly.
          </p>
        )}
      </Card>

      {/* ZTP MODAL */}
      <Modal
        isOpen={isZtpOpen}
        onClose={() => setIsZtpOpen(false)}
        title="Create ZTP provisioning template"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsZtpOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAddZtp} className="cursor-pointer">
              Deploy Profile Template
            </Button>
          </>
        }
      >
        <form onSubmit={handleAddZtp} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              ZTP Template Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. AP-Floor-3-Ztp"
              value={ztpName}
              onChange={(e) => setZtpName(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Hardware Model Map
              </label>
              <select
                value={ztpModel}
                onChange={(e) => setZtpModel(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <option value="Juniper Mist AP43">Juniper Mist AP43</option>
                <option value="Juniper EX2300-48P">Juniper EX2300-48P</option>
                <option value="Juniper EX4400-24T">Juniper EX4400-24T</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Configuration payload parameters
              </label>
              <input
                type="text"
                required
                placeholder="e.g. SSIDs:Guest,VLAN:30"
                value={ztpProfile}
                onChange={(e) => setZtpProfile(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none"
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
export default AutomationCenter;
