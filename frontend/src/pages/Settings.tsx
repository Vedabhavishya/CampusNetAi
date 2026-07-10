import React, { useState } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Table } from '../components/Table';
import { Modal } from '../components/Modal';
import { Settings as SettingsIcon, Users, Shield, Plus, Trash2, CheckCircle2, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

interface SystemUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  status: 'active' | 'disabled';
  dateJoined: string;
}

const initialUsers: SystemUser[] = [
  { id: 'usr-1', username: 'admin', email: 'admin@campusnet.ai', role: 'Super Admin', status: 'active', dateJoined: '2026-01-10' },
  { id: 'usr-2', username: 'netadmin', email: 'netadmin@campusnet.ai', role: 'Network Administrator', status: 'active', dateJoined: '2026-03-15' },
  { id: 'usr-3', username: 'engineer', email: 'engineer@campusnet.ai', role: 'Network Engineer', status: 'active', dateJoined: '2026-04-20' },
  { id: 'usr-4', username: 'readonly', email: 'readonly@campusnet.ai', role: 'Network Engineer', status: 'active', dateJoined: '2026-05-01' },
];

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<SystemUser[]>(() => {
    const saved = localStorage.getItem('cn-users-list');
    return saved ? JSON.parse(saved) : initialUsers;
  });
  
  // User creation modal
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('Network Engineer');

  // Timezone state
  const [timezone, setTimezone] = useState('UTC-5 (EST)');
  const [savePrefSuccess, setSavePrefSuccess] = useState(false);

  const saveUsersToStore = (newUsers: SystemUser[]) => {
    setUsers(newUsers);
    localStorage.setItem('cn-users-list', JSON.stringify(newUsers));
  };

  const handleAddUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newUser: SystemUser = {
      id: 'usr-' + Math.random().toString(36).substring(7),
      username: newUsername,
      email: newEmail,
      role: newRole,
      status: 'active',
      dateJoined: new Date().toISOString().split('T')[0]
    };
    const updated = [...users, newUser];
    saveUsersToStore(updated);
    setIsAddUserOpen(false);
    
    // Reset
    setNewUsername('');
    setNewEmail('');
  };

  const handleDeleteUser = (id: string) => {
    if (id === 'usr-1') {
      alert('The core Super Admin bootstrap user account cannot be deleted.');
      return;
    }
    if (confirm('De-authorize this operator user account? Session tokens will expire immediately.')) {
      const filtered = users.filter(u => u.id !== id);
      saveUsersToStore(filtered);
    }
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    setSavePrefSuccess(true);
    setTimeout(() => setSavePrefSuccess(false), 2000);
  };

  const isReadOnly = user?.role === 'Network Engineer';
  const isSuperAdmin = user?.role === 'Super Admin';

  const userColumns = [
    {
      header: 'Username',
      accessor: (row: SystemUser) => (
        <span className="font-semibold text-slate-800 dark:text-slate-200">{row.username}</span>
      ),
    },
    { header: 'Email Address', accessor: 'email' },
    {
      header: 'Assigned RBAC Role',
      accessor: (row: SystemUser) => (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200/20">
          {row.role}
        </span>
      ),
    },
    {
      header: 'Status State',
      accessor: (row: SystemUser) => (
        <span className="inline-flex items-center text-xs text-emerald-500 font-semibold">
          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Active
        </span>
      ),
    },
    { header: 'Date Enrolled', accessor: 'dateJoined' },
    {
      header: 'Action',
      accessor: (row: SystemUser) => (
        isSuperAdmin ? (
          <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(row.id)} className="text-rose-500 hover:text-rose-700 cursor-pointer">
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : '-'
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-400 rounded-xl flex items-center justify-center">
            <SettingsIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white m-0">
              System Settings & RBAC
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Configure global system parameters, manage local controller user rosters, and audit RBAC security profiles.
            </p>
          </div>
        </div>
      </div>

      {/* Grid: Global Preferences + User Management */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Settings form */}
        <Card title="Global System Preferences" description="Configure controller parameters and local NTP timezones.">
          <form onSubmit={handleSavePreferences} className="space-y-4 text-left text-xs">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                NTP Timezone NTP Timezone
              </label>
              <select
                disabled={isReadOnly}
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <option value="UTC-5 (EST)">UTC-5 (Eastern Standard Time)</option>
                <option value="UTC-8 (PST)">UTC-8 (Pacific Standard Time)</option>
                <option value="UTC+0 (GMT)">UTC+0 (Greenwich Mean Time)</option>
                <option value="UTC+5:30 (IST)">UTC+5:30 (Indian Standard Time)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Syslog Logging Level
              </label>
              <select
                disabled={isReadOnly}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <option>Debugging Mode (Info + Trace)</option>
                <option>Standard Mode (Warnings + Critical Errors)</option>
                <option>Security/FIPS Mode (Access Logs only)</option>
              </select>
            </div>

            {!isReadOnly && (
              <div className="pt-2 flex items-center space-x-3">
                <Button type="submit" variant="primary" className="cursor-pointer">
                  Save Preferences
                </Button>
                {savePrefSuccess && (
                  <span className="text-[10px] font-semibold text-emerald-500 animate-pulse">
                    Preferences Synced
                  </span>
                )}
              </div>
            )}
          </form>
        </Card>

        {/* RBAC definitions info */}
        <Card title="RBAC Security Matrix" description="Overview of permissions mapped to JWT claims.">
          <div className="space-y-3.5 text-left text-xs">
            <div className="p-3 bg-slate-500/5 rounded-xl border border-slate-200/20">
              <span className="font-bold text-cyan-400">Super Admin / Network Admin</span>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Full read-write capabilities on Firewalls, Switches, SSIDs, and User Roster management.
              </p>
            </div>
            <div className="p-3 bg-slate-500/5 rounded-xl border border-slate-200/20">
              <span className="font-bold text-blue-400">Network Engineer</span>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Can write device configurations, apply AI insights, but cannot edit system user rosters.
              </p>
            </div>
            <div className="p-3 bg-slate-500/5 rounded-xl border border-slate-200/20">
              <span className="font-bold text-slate-400">Read Only User</span>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Audit/view access only. Save buttons, quarantine triggers, and onboarding modal inputs are disabled.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Roster Table */}
      <Card
        title="Managed Operator Accounts"
        description=" Roster of operators authorized to access the controller dashboard."
        headerActions={
          isSuperAdmin && (
            <Button variant="primary" size="sm" onClick={() => setIsAddUserOpen(true)} className="cursor-pointer">
              <Plus className="h-4 w-4 mr-1.5" /> Enroll User
            </Button>
          )
        }
      >
        {!isSuperAdmin && (
          <p className="text-xs text-slate-500 mb-4 flex items-center bg-slate-500/5 p-2 rounded-lg border border-slate-200/10">
            <Lock className="h-4 w-4 mr-2 text-amber-500" />
            Operator enrollment and account decommissioning requires <strong>Super Admin</strong> authorization claims.
          </p>
        )}
        <Table columns={userColumns} data={users} />
      </Card>

      {/* ENROLL USER MODAL */}
      <Modal
        isOpen={isAddUserOpen}
        onClose={() => setIsAddUserOpen(false)}
        title="Enroll Operator User Account"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsAddUserOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAddUserSubmit} className="cursor-pointer">
              Register Account
            </Button>
          </>
        }
      >
        <form onSubmit={handleAddUserSubmit} className="space-y-4 text-left">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Operator Username
              </label>
              <input
                type="text"
                required
                placeholder="e.g. jdoe"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="e.g. john.doe@campusnet.ai"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Select RBAC Role
            </label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="Super Admin">Super Admin</option>
              <option value="Network Administrator">Network Administrator</option>
              <option value="Network Engineer">Network Engineer</option>
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
};
export default Settings;
