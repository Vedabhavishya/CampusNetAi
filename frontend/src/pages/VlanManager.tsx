import React, { useState, useMemo } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Table } from '../components/Table';
import { Modal } from '../components/Modal';
import { useNetworkStore } from '../contexts/NetworkStoreContext';
import { useAuth } from '../contexts/AuthContext';
import { Vlan } from '../types';
import { Split, Plus, Trash2, Edit3, ShieldAlert } from 'lucide-react';

export const VlanManager: React.FC = () => {
  const { user } = useAuth();
  const { 
    vlans, 
    addVlan, 
    deleteVlan, 
    renameVlan 
  } = useNetworkStore();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [selectedVlan, setSelectedVlan] = useState<Vlan | null>(null);

  // Form states
  const [vlanId, setVlanId] = useState('');
  const [vlanName, setVlanName] = useState('');
  const [vlanSubnet, setVlanSubnet] = useState('');
  const [vlanRange, setVlanRange] = useState('');
  const [vlanDns, setVlanDns] = useState('1.1.1.1, 8.8.8.8');
  const [vlanRenameText, setVlanRenameText] = useState('');

  const isReadOnly = user?.role === 'Network Engineer';

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vlanId || isNaN(Number(vlanId))) return;

    try {
      await addVlan({
        id: Number(vlanId),
        name: vlanName,
        subnet: vlanSubnet,
        dhcpRange: vlanRange,
        dnsServers: vlanDns.split(',').map((d) => d.trim()),
      });
      setIsAddOpen(false);
      setVlanId('');
      setVlanName('');
      setVlanSubnet('');
      setVlanRange('');
    } catch (err: any) {
      alert(err.message || 'Failed to create VLAN.');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteVlan(id);
    } catch (err: any) {
      alert(err.message || 'VLAN deletion rejected.');
    }
  };

  const triggerRename = (vlan: Vlan) => {
    setSelectedVlan(vlan);
    setVlanRenameText(vlan.name);
    setIsRenameOpen(true);
  };

  const handleRenameSubmit = async () => {
    if (selectedVlan && vlanRenameText.trim()) {
      await renameVlan(selectedVlan.id, vlanRenameText);
      setIsRenameOpen(false);
      setSelectedVlan(null);
    }
  };

  const columns = [
    {
      header: 'VLAN ID',
      accessor: (row: Vlan) => (
        <span className="font-mono font-bold text-cyan-400">VLAN {row.id}</span>
      ),
      sortable: true
    },
    {
      header: 'Profile Name',
      accessor: (row: Vlan) => (
        <span className="font-bold text-slate-800 dark:text-slate-200">{row.name}</span>
      ),
      sortable: true
    },
    {
      header: 'IPv4 Network Subnet',
      accessor: (row: Vlan) => <span className="font-mono text-xs">{row.subnet}</span>,
      sortable: true
    },
    {
      header: 'DHCP Pool Range',
      accessor: (row: Vlan) => <span className="font-mono text-xs">{row.dhcpRange}</span>
    },
    {
      header: 'DNS Servers',
      accessor: (row: Vlan) => <span className="text-xs font-mono text-slate-500">{row.dnsServers.join(', ')}</span>
    },
    {
      header: 'Active Leases count',
      accessor: (row: Vlan) => (
        <span className="font-mono font-semibold">{row.activeLeasesCount} leases</span>
      ),
      sortable: true
    },
    {
      header: 'Actions',
      accessor: (row: Vlan) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="outline"
            onClick={() => triggerRename(row)}
            className="p-1 h-8 w-8 flex items-center justify-center"
            title="Rename VLAN Profile"
          >
            <Edit3 className="h-4 w-4" />
          </Button>
          {!isReadOnly && (
            <Button
              variant="ghost"
              onClick={() => handleDelete(row.id)}
              className="p-1 h-8 w-8 flex items-center justify-center text-rose-500 hover:text-rose-700"
              title="Delete VLAN"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
      className: 'text-right'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-left">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-400 rounded-xl flex items-center justify-center">
            <Split className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white m-0">
              VLAN Profiles Management
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Configure organizational virtual subnets, 802.1Q tags, and address pool mappings.
            </p>
          </div>
        </div>
        {!isReadOnly && (
          <Button
            variant="primary"
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Plus className="h-4.5 w-4.5" /> Add VLAN Profile
          </Button>
        )}
      </div>

      {/* VLAN profiles table */}
      <Card className="p-0 overflow-hidden">
        <Table
          columns={columns}
          data={vlans}
          searchKeys={['name', 'subnet']}
          searchPlaceholder="Search VLAN name or subnet address..."
          defaultSortField="id"
        />
      </Card>

      {/* Add Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add VLAN Profile"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleAddSubmit}>Create Profile</Button>
          </>
        }
      >
        <form onSubmit={handleAddSubmit} className="space-y-4 text-left font-sans">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">VLAN ID (802.1Q)</label>
              <input
                type="number"
                required
                placeholder="e.g. 50"
                value={vlanId}
                onChange={(e) => setVlanId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Profile Name</label>
              <input
                type="text"
                required
                placeholder="e.g. VLAN_VOICE_NET"
                value={vlanName}
                onChange={(e) => setVlanName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">IPv4 Subnet</label>
              <input
                type="text"
                required
                placeholder="e.g. 10.10.50.0/24"
                value={vlanSubnet}
                onChange={(e) => setVlanSubnet(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">DHCP Lease Pool</label>
              <input
                type="text"
                required
                placeholder="e.g. 10.10.50.10 - 10.10.50.250"
                value={vlanRange}
                onChange={(e) => setVlanRange(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">DNS Servers</label>
            <input
              type="text"
              required
              value={vlanDns}
              onChange={(e) => setVlanDns(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono"
            />
          </div>
        </form>
      </Modal>

      {/* Rename Modal */}
      <Modal
        isOpen={isRenameOpen}
        onClose={() => setIsRenameOpen(false)}
        title="Rename VLAN Profile"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsRenameOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleRenameSubmit}>Rename Profile</Button>
          </>
        }
      >
        <div className="space-y-2 text-left font-sans">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">New Name for VLAN {selectedVlan?.id}</label>
          <input
            type="text"
            value={vlanRenameText}
            onChange={(e) => setVlanRenameText(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
          />
        </div>
      </Modal>
    </div>
  );
};
export default VlanManager;
