import React, { useState } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Table } from '../components/Table';
import { Modal } from '../components/Modal';
import { useNetworkStore } from '../contexts/NetworkStoreContext';
import { useAuth } from '../contexts/AuthContext';
import { DhcpLease } from '../types';
import { Cpu, Plus, CheckCircle, ShieldAlert, Trash2 } from 'lucide-react';

export const DhcpManager: React.FC = () => {
  const { user } = useAuth();
  const { 
    dhcpLeases, 
    vlans, 
    addStaticReservation, 
    deleteStaticReservation 
  } = useNetworkStore();

  const [isModalOpen, setIsModalOpen] = useState(false);

  // Static Reservation form inputs
  const [clientName, setClientName] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [macAddress, setMacAddress] = useState('');
  const [vlanId, setVlanId] = useState(20);

  const isReadOnly = user?.role === 'Network Engineer';

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !ipAddress.trim() || !macAddress.trim()) return;

    try {
      await addStaticReservation({
        clientName,
        ipAddress,
        macAddress: macAddress.toUpperCase(),
        vlanId: Number(vlanId),
      });
      
      setIsModalOpen(false);
      setClientName('');
      setIpAddress('');
      setMacAddress('');
    } catch (err: any) {
      alert(err.message || 'Static reservation rejected.');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this static DHCP lease reservation?')) {
      await deleteStaticReservation(id);
    }
  };

  const columns = [
    {
      header: 'Assigned IP',
      accessor: (row: DhcpLease) => <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{row.ipAddress}</span>,
      sortable: true
    },
    {
      header: 'MAC Address Bind',
      accessor: (row: DhcpLease) => <span className="font-mono text-xs font-semibold text-slate-500">{row.macAddress}</span>,
      sortable: true
    },
    { header: 'Client Hostname', accessor: 'clientName', sortable: true },
    {
      header: 'VLAN Member',
      accessor: (row: DhcpLease) => <span className="font-mono text-xs font-bold text-slate-400">VLAN {row.vlanId}</span>,
      sortable: true,
      filterKey: 'vlanId' as any
    },
    {
      header: 'Lease status',
      accessor: (row: DhcpLease) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
          row.leaseTime.toLowerCase().includes('static')
            ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
            : 'bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400 border border-slate-200/50 dark:border-slate-800'
        }`}>
          {row.leaseTime}
        </span>
      ),
      filterKey: 'leaseTime' as any
    },
    {
      header: 'Actions',
      accessor: (row: DhcpLease) => (
        row.leaseTime.toLowerCase().includes('static') && !isReadOnly ? (
          <Button
            variant="ghost"
            onClick={() => handleDelete(row.id)}
            className="p-1 h-8 w-8 flex items-center justify-center text-rose-500 hover:text-rose-700"
            title="Delete Reservation"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : '-'
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
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white m-0">
              DHCP Server Leases
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Monitor active DHCP address bindings and static lease pool reservations.
            </p>
          </div>
        </div>
        {!isReadOnly && (
          <Button
            variant="primary"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Plus className="h-4.5 w-4.5" /> Reserve Static IP
          </Button>
        )}
      </div>

      {/* DHCP Leases Table */}
      <Card className="p-0 overflow-hidden">
        <Table
          columns={columns}
          data={dhcpLeases}
          searchKeys={['ipAddress', 'macAddress', 'clientName']}
          searchPlaceholder="Search lease by IP, MAC address or client hostname..."
          defaultSortField="ipAddress"
        />
      </Card>

      {/* Add Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Static DHCP Lease Reservation"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleAddSubmit}>Create Reservation</Button>
          </>
        }
      >
        <form onSubmit={handleAddSubmit} className="space-y-4 text-left font-sans">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Client Hostname</label>
            <input
              type="text"
              required
              placeholder="e.g. CEO-iPad-Pro"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Static IPv4 Address</label>
              <input
                type="text"
                required
                placeholder="e.g. 10.10.20.50"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Client MAC Address</label>
              <input
                type="text"
                required
                placeholder="e.g. 00:0B:82:1A:2B:3C"
                value={macAddress}
                onChange={(e) => setMacAddress(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Bound VLAN Profile</label>
            <select
              value={vlanId}
              onChange={(e) => setVlanId(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold"
            >
              {vlans.map(v => (
                <option key={v.id} value={v.id}>{v.id} - {v.name} ({v.subnet})</option>
              ))}
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
};
export default DhcpManager;
