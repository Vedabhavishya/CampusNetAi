import React, { useState, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Card } from '../components/Card';
import { DeviceDetailDrawer } from '../components/DeviceDetailDrawer';
import { useNetworkStore } from '../contexts/NetworkStoreContext';
import { NetworkDevice, DeviceStatus, DeviceType } from '../types';
import { Shield, Layers, Server, Wifi, Globe, CheckCircle2, AlertTriangle, XCircle, Activity } from 'lucide-react';

// --- CUSTOM NETWORK NODE COMPONENT ---
const NetworkNodeComponent = ({ data }: { data: any }) => {
  const getStatusColor = (status: DeviceStatus) => {
    switch (status) {
      case 'online': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'warning': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'offline': return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
    }
  };

  const getDeviceIcon = (type: DeviceType) => {
    switch (type) {
      case 'firewall': return <Shield className="h-5 w-5 text-cyan-400" />;
      case 'core_switch': return <Layers className="h-5 w-5 text-indigo-400" />;
      case 'access_switch': return <Server className="h-5 w-5 text-blue-400" />;
      case 'access_point': return <Wifi className="h-5 w-5 text-emerald-400" />;
    }
  };

  return (
    <div className={`px-4 py-3 rounded-xl border bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-md text-left w-52 relative group hover:border-cyan-500/50 transition-all duration-200`}>
      {data.type !== 'wan' && (
        <Handle type="target" position={Position.Top} className="!bg-slate-400 dark:!bg-slate-600 !w-2.5 !h-2.5" />
      )}

      <div className="flex items-center space-x-3">
        <div className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-slate-950 flex items-center justify-center border border-slate-200/40 dark:border-slate-800/40">
          {data.type === 'wan' ? <Globe className="h-5 w-5 text-cyan-400" /> : getDeviceIcon(data.type)}
        </div>
        <div className="flex-1 min-w-0 font-sans">
          <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{data.name}</p>
          <p className="text-[9px] text-slate-400 font-mono truncate">{data.ipAddress || 'External Network'}</p>
        </div>
      </div>

      {data.type !== 'wan' && (
        <div className="mt-2.5 flex items-center justify-between font-sans">
          <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border ${getStatusColor(data.status)}`}>
            {data.status}
          </span>
          <span className="text-[9px] font-mono text-slate-400">
            Health: <span className="font-bold text-cyan-400">{data.healthScore}%</span>
          </span>
        </div>
      )}

      {data.type !== 'access_point' && (
        <Handle type="source" position={Position.Bottom} className="!bg-slate-400 dark:!bg-slate-600 !w-2.5 !h-2.5" />
      )}
    </div>
  );
};

const nodeTypes = {
  networkNode: NetworkNodeComponent,
};

export const NetworkTopology: React.FC = () => {
  const { devices } = useNetworkStore();
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  const [selectedDevice, setSelectedDevice] = useState<NetworkDevice | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Re-build topology when devices list or state changes (e.g. telemetries, cpu loads)
  useEffect(() => {
    const savedPositions = JSON.parse(localStorage.getItem('cn-topology-positions') || '{}');

    // Level 1: WAN Node
    const initialNodes = [
      {
        id: 'wan',
        type: 'networkNode',
        position: savedPositions['wan'] || { x: 300, y: 0 },
        data: { name: 'WAN / Internet Link', ipAddress: '203.0.113.1', type: 'wan', status: 'online' },
      },
    ];

    const initialEdges: any[] = [];

    devices.forEach((dev, index) => {
      let defaultX = 300;
      let defaultY = 100;

      if (dev.type === 'firewall') {
        defaultX = 300; defaultY = 110;
        initialEdges.push({
          id: 'edge-wan-fw',
          source: 'wan',
          target: dev.id,
          animated: true,
          label: '1 Gbps Fiber',
          style: { stroke: '#06b6d4', strokeWidth: 2 },
          labelStyle: { fill: '#64748b', fontSize: 9, fontWeight: 600 }
        });
      } else if (dev.type === 'core_switch') {
        defaultX = 300; defaultY = 240;
        const fw = devices.find(d => d.type === 'firewall');
        if (fw) {
          initialEdges.push({
            id: 'edge-fw-core',
            source: fw.id,
            target: dev.id,
            animated: fw.status === 'online',
            label: 'ae0 (20G LAG)',
            style: { 
              stroke: dev.cpuUsage > 50 ? '#f59e0b' : '#0ea5e9', 
              strokeWidth: dev.cpuUsage > 50 ? 3.5 : 2.5 
            },
            labelStyle: { fill: '#64748b', fontSize: 9, fontWeight: 600 }
          });
        }
      } else if (dev.type === 'access_switch') {
        defaultX = dev.id.includes('as-1') ? 100 : 500;
        defaultY = 380;
        const cs = devices.find(d => d.type === 'core_switch');
        if (cs) {
          initialEdges.push({
            id: `edge-core-${dev.id}`,
            source: cs.id,
            target: dev.id,
            animated: dev.status === 'online',
            label: dev.id.includes('as-1') ? 'ae1 (20G LACP)' : 'ae2 (20G LACP)',
            style: {
              stroke: dev.status === 'warning' ? '#f59e0b' : '#38bdf8',
              strokeWidth: dev.cpuUsage > 60 ? 3 : 2,
              strokeDasharray: dev.status === 'warning' ? '5,5' : '0'
            },
            labelStyle: { fill: '#64748b', fontSize: 8 }
          });
        }
      } else if (dev.type === 'access_point') {
        if (dev.id === 'dev-ap-1') {
          defaultX = 0; defaultY = 520;
        } else if (dev.id === 'dev-ap-2') {
          defaultX = 200; defaultY = 520;
        } else {
          defaultX = 500; defaultY = 520;
        }

        const parentSwitchId = dev.id === 'dev-ap-3' ? 'dev-as-2' : 'dev-as-1';
        initialEdges.push({
          id: `edge-sw-${dev.id}`,
          source: parentSwitchId,
          target: dev.id,
          animated: dev.status === 'online' && dev.clientsCount > 0,
          label: dev.status === 'offline' ? 'Link Down' : `PoE+ (Clients: ${dev.clientsCount})`,
          style: {
            stroke: dev.status === 'offline' ? '#64748b' : dev.status === 'warning' ? '#f59e0b' : '#10b981',
            strokeWidth: 1.5,
            strokeDasharray: dev.status === 'offline' ? '5,5' : '0'
          },
          labelStyle: { fill: dev.status === 'offline' ? '#ef4444' : '#64748b', fontSize: 8 }
        });
      }

      initialNodes.push({
        id: dev.id,
        type: 'networkNode',
        position: savedPositions[dev.id] || { x: defaultX, y: defaultY },
        data: dev,
      });
    });

    setNodes(initialNodes as any);
    setEdges(initialEdges);
  }, [devices]);

  const onNodeClick = (event: any, node: any) => {
    if (node.id === 'wan') {
      setSelectedDevice(null);
      setIsDrawerOpen(false);
    } else {
      setSelectedDevice(node.data as unknown as NetworkDevice);
      setIsDrawerOpen(true);
    }
  };

  const onNodeDragStop = (event: any, node: any) => {
    const savedPositions = JSON.parse(localStorage.getItem('cn-topology-positions') || '{}');
    savedPositions[node.id] = node.position;
    localStorage.setItem('cn-topology-positions', JSON.stringify(savedPositions));
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="text-left">
        <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white m-0">
          Logical Network Topology Map
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Interactive visualization of physical link states, LACP trunks, and PoE delivery loads. Drag nodes to customize positions.
        </p>
      </div>

      {/* React Flow workspace canvas */}
      <div className="border border-slate-200/50 dark:border-slate-800/80 bg-white dark:bg-slate-950 rounded-3xl overflow-hidden shadow-md h-[72vh] relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onNodeDragStop={onNodeDragStop}
          fitView
          minZoom={0.5}
          maxZoom={1.5}
        >
          <Background color="#64748b" gap={16} size={1} style={{ opacity: 0.15 }} />
          <Controls className="dark:!bg-slate-900 border border-slate-200/20" />
          <MiniMap
            className="!border border-slate-200/20 !rounded-2xl !overflow-hidden dark:!bg-slate-900"
            nodeColor={(node) => {
              if (node.id === 'wan') return '#06b6d4';
              const d = node.data as unknown as NetworkDevice;
              if (d.status === 'online') return '#10b981';
              if (d.status === 'warning') return '#f59e0b';
              return '#ef4444';
            }}
          />
        </ReactFlow>
      </div>

      {/* Slide-out device details drawer */}
      <DeviceDetailDrawer
        device={selectedDevice}
        isOpen={isDrawerOpen}
        onClose={() => { setIsDrawerOpen(false); setSelectedDevice(null); }}
      />
    </div>
  );
};
export default NetworkTopology;
