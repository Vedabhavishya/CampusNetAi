import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon, Bell, Search, LogOut, ChevronDown, Check, ShieldAlert, Sliders, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useNetworkStore } from '../contexts/NetworkStoreContext';
import { NetworkAlert, UserRole } from '../types';

interface HeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({ sidebarOpen, setSidebarOpen }) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user, logout, login } = useAuth();
  
  const { 
    devices, 
    clients, 
    ssids, 
    vlans, 
    alerts, 
    tasks, 
    logs, 
    securityEvents 
  } = useNetworkStore();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  const activeAlerts = useMemo(() => alerts.filter(a => !a.resolved), [alerts]);

  const handleRoleSwitch = async (role: UserRole) => {
    // Secure role switcher: require password verification for privilege elevation transitions
    const currentRole = user?.role;
    let needsVerification = false;
    
    if (currentRole === 'Network Engineer' && (role === 'Network Administrator' || role === 'Super Admin')) {
      needsVerification = true;
    } else if (currentRole === 'Network Administrator' && role === 'Super Admin') {
      needsVerification = true;
    }
    
    if (needsVerification) {
      const pwd = prompt(`Security Verification: Enter password to authorize role upgrade to ${role}:`);
      if (pwd !== 'admin123') {
        alert('Authentication failed: Incorrect password.');
        return;
      }
    }

    await login(user?.username || 'Admin', role);
    setShowProfile(false);
    window.location.reload();
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowSearchResults(false);
      navigate(`/ai-center?q=${encodeURIComponent(searchQuery)}`);
      setSearchQuery('');
    }
  };

  const handleResultClick = (path: string) => {
    navigate(path);
    setSearchQuery('');
    setShowSearchResults(false);
  };

  // Perform categorized global search matching
  const searchResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return null;

    const matchedDevices = devices.filter(d => 
      d.name.toLowerCase().includes(q) || 
      d.ipAddress.includes(q) || 
      d.macAddress.toLowerCase().includes(q) ||
      d.model.toLowerCase().includes(q)
    ).slice(0, 3);

    const matchedClients = clients.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.ipAddress.includes(q) || 
      c.macAddress.toLowerCase().includes(q)
    ).slice(0, 3);

    const matchedSids = ssids.filter(s => 
      s.ssid.toLowerCase().includes(q)
    ).slice(0, 3);

    const matchedVlans = vlans.filter(v => 
      v.name.toLowerCase().includes(q) || 
      v.id.toString() === q
    ).slice(0, 3);

    const matchedTasks = tasks.filter(t => 
      t.name.toLowerCase().includes(q) || 
      t.id.includes(q)
    ).slice(0, 3);

    const matchedLogs = logs.filter(l => 
      l.action.toLowerCase().includes(q) || 
      l.target.toLowerCase().includes(q)
    ).slice(0, 3);

    const totalMatches = 
      matchedDevices.length + matchedClients.length + matchedSids.length + 
      matchedVlans.length + matchedTasks.length + matchedLogs.length;

    return {
      devices: matchedDevices,
      clients: matchedClients,
      ssids: matchedSids,
      vlans: matchedVlans,
      tasks: matchedTasks,
      logs: matchedLogs,
      totalMatches
    };
  }, [searchQuery, devices, clients, ssids, vlans, tasks, logs]);

  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      setShowSearchResults(true);
    } else {
      setShowSearchResults(false);
    }
  }, [searchQuery]);

  return (
    <header className="h-16 border-b border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-950/70 backdrop-blur-md fixed top-0 right-0 z-30 left-0 transition-all duration-300 md:pl-0 flex items-center justify-between px-6">
      
      {/* Search Input with overlay Dropdown */}
      <div className="flex items-center space-x-4 flex-1 relative">
        <form onSubmit={handleSearchSubmit} className="hidden md:flex items-center relative w-96">
          <Search className="h-4 w-4 absolute left-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search devices, VLANs, clients, provisioning tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => { if (searchQuery) setShowSearchResults(true); }}
            className="w-full bg-slate-100 hover:bg-slate-200/60 dark:bg-slate-900 dark:hover:bg-slate-800/80 pl-10 pr-8 py-2 rounded-lg text-xs text-slate-800 dark:text-slate-200 border border-transparent focus:border-brand-500 focus:outline-none transition-all duration-200"
          />
          {searchQuery && (
            <button 
              type="button" 
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </form>

        {/* Global Search Categorized Overlay Dropdown */}
        {showSearchResults && searchResults && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowSearchResults(false)} />
            <div className="absolute top-12 left-0 w-[420px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden text-left p-3 max-h-[450px] overflow-y-auto scrollbar-thin">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2.5 pb-2 border-b border-slate-250/10">
                <span>Categorized Matches ({searchResults.totalMatches})</span>
                <button onClick={() => setShowSearchResults(false)} className="hover:text-white">Close</button>
              </div>

              {searchResults.totalMatches === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 font-medium">No system elements match your search.</div>
              ) : (
                <div className="space-y-4 pt-2 text-xs">
                  {/* Matched Devices */}
                  {searchResults.devices.length > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-2">Inventory Devices</h4>
                      {searchResults.devices.map(d => (
                        <div 
                          key={d.id} 
                          onClick={() => handleResultClick('/devices')}
                          className="p-2 hover:bg-slate-500/5 rounded-xl cursor-pointer flex justify-between items-center"
                        >
                          <span className="font-semibold">{d.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{d.ipAddress}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Matched Clients */}
                  {searchResults.clients.length > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-2">Connected Clients</h4>
                      {searchResults.clients.map(c => (
                        <div 
                          key={c.id} 
                          onClick={() => handleResultClick('/clients')}
                          className="p-2 hover:bg-slate-500/5 rounded-xl cursor-pointer flex justify-between items-center"
                        >
                          <span className="font-semibold">{c.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{c.ipAddress}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Matched SSIDs */}
                  {searchResults.ssids.length > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-2">Wireless SSIDs</h4>
                      {searchResults.ssids.map(s => (
                        <div 
                          key={s.id} 
                          onClick={() => handleResultClick('/wifi')}
                          className="p-2 hover:bg-slate-500/5 rounded-xl cursor-pointer flex justify-between items-center"
                        >
                          <span className="font-semibold">{s.ssid}</span>
                          <span className="text-[10px] text-slate-400 capitalize">{s.securityType}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Matched VLANs */}
                  {searchResults.vlans.length > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-2">Trunk VLANs</h4>
                      {searchResults.vlans.map(v => (
                        <div 
                          key={v.id} 
                          onClick={() => handleResultClick('/vlans')}
                          className="p-2 hover:bg-slate-500/5 rounded-xl cursor-pointer flex justify-between items-center"
                        >
                          <span className="font-semibold">{v.name}</span>
                          <span className="text-[10px] text-brand-500 font-bold">VLAN {v.id}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Matched Tasks */}
                  {searchResults.tasks.length > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-2">Provisioning Tasks</h4>
                      {searchResults.tasks.map(t => (
                        <div 
                          key={t.id} 
                          onClick={() => handleResultClick('/operations')}
                          className="p-2 hover:bg-slate-500/5 rounded-xl cursor-pointer flex justify-between items-center"
                        >
                          <span className="font-semibold truncate max-w-[200px]">{t.name}</span>
                          <span className="text-[9px] uppercase tracking-wider font-bold font-mono text-slate-400">{t.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex items-center space-x-4">
        {/* Quick Role Switcher Info Tag */}
        <span className="hidden lg:inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200/20 uppercase tracking-wider">
          Role: {user?.role}
        </span>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
          title="Toggle Light/Dark Theme"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-slate-600" />}
        </button>

        {/* Alerts Notification dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfile(false);
            }}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors relative cursor-pointer"
          >
            <Bell className="h-5 w-5" />
            {activeAlerts.length > 0 && (
              <span className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-rose-500 text-white font-bold text-[9px] flex items-center justify-center animate-pulse">
                {activeAlerts.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200/50 dark:border-slate-800/50 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                  <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Active Alerts</h4>
                  <span className="text-xs text-rose-500 font-medium">{activeAlerts.length} critical</span>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {activeAlerts.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">All services reporting normal health. No current active alerts.</div>
                  ) : (
                    activeAlerts.map((alert) => (
                      <div key={alert.id} className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex items-start space-x-3 text-left">
                        <ShieldAlert className={`h-5 w-5 mt-0.5 flex-shrink-0 ${alert.severity === 'critical' ? 'text-rose-500' : 'text-amber-500'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 break-words">{alert.message}</p>
                          <p className="text-[10px] text-slate-400 mt-1">{new Date(alert.timestamp).toLocaleTimeString()}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-2 border-t border-slate-200/50 dark:border-slate-800/50 text-center bg-slate-50/50 dark:bg-slate-900/50">
                  <button onClick={() => { setShowNotifications(false); navigate('/operations'); }} className="text-xs font-medium text-brand-500 hover:underline cursor-pointer">
                    View Operations Center
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Profile menu */}
        <div className="relative">
          <button
            onClick={() => {
              setShowProfile(!showProfile);
              setShowNotifications(false);
            }}
            className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-500 flex items-center justify-center text-slate-950 font-bold text-xs">
              {user?.username.substring(0, 2).toUpperCase() || 'AD'}
            </div>
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </button>

          {showProfile && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowProfile(false)} />
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-xl shadow-xl z-50 overflow-hidden text-left">
                <div className="p-4 border-b border-slate-200/50 dark:border-slate-800/50">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{user?.username}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
                </div>

                <div className="p-1">
                  <button
                    onClick={logout}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
export default Header;
