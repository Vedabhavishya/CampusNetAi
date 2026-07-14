import React, { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Shield,
  Layers,
  Server,
  Wifi,
  Radio,
  Users,
  Split,
  Cpu,
  Waypoints,
  BarChart3,
  Sparkles,
  FileText,
  Zap,
  Settings,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Activity,
  Search
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const location = useLocation();
  const { user } = useAuth();
  
  // Keep dropdown state
  const [networkOpen, setNetworkOpen] = useState(true);

  const isActive = (path: string) => location.pathname === path;
  const isNetworkActive = () => location.pathname.startsWith('/devices');

  const rawMenuItems = [
    { label: 'Operations Center', path: '/operations', icon: LayoutDashboard },
    { label: 'Dashboard', path: '/dashboard', icon: BarChart3 },
    { label: 'SLA Dashboard', path: '/sla', icon: Activity },
    {
      label: 'Network Inventory',
      icon: Layers,
      isDropdown: true,
      isOpen: networkOpen,
      setOpen: setNetworkOpen,
      subItems: [
        { label: 'All Devices', path: '/devices', icon: Server },
        { label: 'Firewalls', path: '/devices/firewall', icon: Shield },
        { label: 'Core Switches', path: '/devices/core-switch', icon: Layers },
        { label: 'Access Switches', path: '/devices/access-switch', icon: Server },
        { label: 'Wireless Center', path: '/devices/wireless-center', icon: Wifi },
      ]
    },
    { label: 'Device Discovery', path: '/discovery', icon: Search },
    { label: 'WiFi Networks', path: '/wifi', icon: Radio },
    { label: 'Clients', path: '/clients', icon: Users },
    { label: 'VLAN Configuration', path: '/vlans', icon: Split },
    { label: 'DHCP Pools', path: '/dhcp', icon: Cpu },
    { label: 'Security Center', path: '/security', icon: Shield },
    { label: 'Live Topology', path: '/topology', icon: Waypoints },
    { label: 'AI Center', path: '/ai-center', icon: Sparkles, badge: 'AI' },
    { label: 'Reports', path: '/reports', icon: FileText },
    { label: 'Automation Center', path: '/automation', icon: Zap },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  // Role visibility filter: Hide Settings for anyone who is NOT a Super Admin
  const menuItems = useMemo(() => {
    const isSuperAdmin = user?.role === 'Super Admin';
    return rawMenuItems.filter(item => {
      if (item.path === '/settings' && !isSuperAdmin) return false;
      return true;
    });
  }, [user]);

  return (
    <aside
      className={`
        fixed top-0 left-0 h-full z-40 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 transition-all duration-300 flex flex-col
        ${isOpen ? 'w-64' : 'w-20'}
      `}
    >
      {/* Brand Logo Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-slate-800/80">
        <Link to="/operations" className="flex items-center space-x-3 overflow-hidden">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-blue-500 to-cyan-400 flex items-center justify-center font-bold text-white shadow-lg text-lg flex-shrink-0">
            CN
          </div>
          {isOpen && (
            <span className="font-display font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-cyan-400 whitespace-nowrap">
              CampusNet AI
            </span>
          )}
        </Link>
      </div>

      {/* Nav List - Scrollbar Hidden */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1.5 scrollbar-none">
        {menuItems.map((item: any, idx: number) => {
          const Icon = item.icon;
          
          if (item.isDropdown) {
            return (
              <div key={idx} className="space-y-1">
                <button
                  onClick={() => item.setOpen?.(!item.isOpen)}
                  className={`
                    w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer
                    ${isNetworkActive() 
                      ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white' 
                      : 'hover:bg-slate-55 dark:hover:bg-slate-800/40 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }
                  `}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`h-5 w-5 ${isNetworkActive() ? 'text-brand-500 dark:text-cyan-400' : 'text-slate-400'}`} />
                    {isOpen && <span>{item.label}</span>}
                  </div>
                  {isOpen && (
                    item.isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                </button>

                <AnimatePresence initial={false}>
                  {item.isOpen && isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden pl-7 space-y-1"
                    >
                      {item.subItems?.map((sub: any, subIdx: number) => {
                        const SubIcon = sub.icon;
                        const subActive = isActive(sub.path);
                        return (
                          <Link
                            key={subIdx}
                            to={sub.path}
                            className={`
                              flex items-center space-x-3 px-3 py-2 rounded-md text-xs font-medium transition-all duration-150
                              ${subActive
                                ? 'bg-brand-500/10 text-brand-600 dark:text-cyan-400 border-l-2 border-brand-500 dark:border-cyan-400'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/30'
                              }
                            `}
                          >
                            <SubIcon className={`h-4 w-4 ${subActive ? 'text-brand-500 dark:text-cyan-400' : 'text-slate-400'}`} />
                            <span>{sub.label}</span>
                          </Link>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          }

          const active = isActive(item.path || '');
          return (
            <Link
              key={idx}
              to={item.path || ''}
              className={`
                flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                ${active
                  ? 'bg-brand-500/10 text-brand-600 dark:text-cyan-400 border-l-4 border-brand-500 dark:border-cyan-400 shadow-sm'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }
              `}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`h-5 w-5 ${active ? 'text-brand-500 dark:text-cyan-400' : 'text-slate-400'}`} />
                {isOpen && <span>{item.label}</span>}
              </div>
              {isOpen && item.badge && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold tracking-wide rounded bg-cyan-500 text-slate-950">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </aside>
  );
};
export default Sidebar;
