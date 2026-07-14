import { useNetworkStore } from '../contexts/NetworkStoreContext';

export interface CalculatedVlan {
  id: number;
  name: string;
  memberCount: number | string;
  activeInterfaces: number | string;
  subnet: string;
  gateway: string;
  dhcpRange: string;
  dnsServers: string[];
  description: string;
  activeLeasesCount?: number | string;
}

export const useVlanInventory = (): CalculatedVlan[] => {
  const { vlans } = useNetworkStore();
  // Map standard Vlan format to CalculatedVlan if needed, but they are already compatible.
  return (vlans || []).map((v: any) => ({
    id: v.id,
    name: v.name,
    memberCount: v.activeLeasesCount !== undefined ? v.activeLeasesCount : '--',
    activeInterfaces: v.activeInterfaces !== undefined ? v.activeInterfaces : '--',
    subnet: v.subnet || '—',
    gateway: v.gateway || '—',
    dhcpRange: v.dhcpRange || '—',
    dnsServers: v.dnsServers || [],
    description: v.description || '—',
    activeLeasesCount: v.activeLeasesCount
  }));
};
