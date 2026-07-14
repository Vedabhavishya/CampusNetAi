import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { FirewallManager } from './pages/FirewallManager';
import CoreSwitchManager from './pages/CoreSwitchManager';
import { AccessSwitchManager } from './pages/AccessSwitchManager';
import AccessPointManager from './pages/AccessPointManager';
import { WiFiManager } from './pages/WiFiManager';
import ClientManager from './pages/ClientManager';
import VlanManager from './pages/VlanManager';
import DhcpManager from './pages/DhcpManager';
import NetworkTopology from './pages/NetworkTopology';
import Analytics from './pages/Analytics';
import AiCenter from './pages/AiCenter';
import Reports from './pages/Reports';
import AutomationCenter from './pages/AutomationCenter';
import NotificationCenter from './pages/NotificationCenter';
import Settings from './pages/Settings';
import { DeviceInventory } from './pages/DeviceInventory';
import { NetworkStoreProvider } from './contexts/NetworkStoreContext';
import { OperationsDashboard } from './pages/OperationsDashboard';
import { DeviceDiscovery } from './pages/DeviceDiscovery';
import { SecurityCenter } from './pages/SecurityCenter';
import { SlaDashboard } from './pages/SlaDashboard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <NetworkStoreProvider>
            <BrowserRouter>
              <Routes>
                {/* Public route */}
                <Route path="/login" element={<Login />} />

                {/* Private routes wrapper */}
                <Route path="/" element={<DashboardLayout />}>
                  <Route index element={<Navigate to="/operations" replace />} />
                  <Route path="operations" element={<OperationsDashboard />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="discovery" element={<DeviceDiscovery />} />
                  <Route path="security" element={<SecurityCenter />} />
                  <Route path="sla" element={<SlaDashboard />} />
                  <Route path="devices" element={<DeviceInventory />} />
                  <Route path="devices/firewall" element={<FirewallManager />} />
                  <Route path="devices/core-switch" element={<CoreSwitchManager />} />
                  <Route path="devices/access-switch" element={<AccessSwitchManager />} />
                  <Route path="devices/wireless-center" element={<AccessPointManager />} />
                  <Route path="devices/access-point" element={<Navigate to="/devices/wireless-center" replace />} />
                  <Route path="wifi" element={<WiFiManager />} />
                  <Route path="clients" element={<ClientManager />} />
                  <Route path="vlans" element={<VlanManager />} />
                  <Route path="dhcp" element={<DhcpManager />} />
                  <Route path="topology" element={<NetworkTopology />} />
                  <Route path="analytics" element={<Analytics />} />
                  <Route path="ai-center" element={<AiCenter />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="automation" element={<AutomationCenter />} />
                  <Route path="notifications" element={<NotificationCenter />} />
                  <Route path="settings" element={<Settings />} />
                </Route>

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </BrowserRouter>
          </NetworkStoreProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};
export default App;
