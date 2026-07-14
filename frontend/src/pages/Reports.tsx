import React, { useState, useMemo } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { useNetworkStore } from '../contexts/NetworkStoreContext';
import { 
  FileText, Calendar, Download, RefreshCw, CheckCircle, Mail, 
  AlertCircle, Trash2, Eye, FileSpreadsheet, ArrowRight 
} from 'lucide-react';

interface ReportTask {
  id: string;
  name: string;
  frequency: string;
  recipient: string;
  format: 'PDF' | 'CSV' | 'XLSX';
  status: 'active' | 'paused';
}

const initialReports: ReportTask[] = [
  { id: 'rep-1', name: 'Weekly Network Health Summary', frequency: 'Every Monday 08:00', recipient: 'net-ops@campusnet.ai', format: 'PDF', status: 'active' },
  { id: 'rep-2', name: 'Intrusion Protection (IPS) Audit logs', frequency: 'Daily 00:00', recipient: 'security-audit@campusnet.ai', format: 'CSV', status: 'active' },
  { id: 'rep-3', name: 'Wi-Fi RF Performance & Interference Report', frequency: 'Monthly (1st)', recipient: 'rf-planning@campusnet.ai', format: 'PDF', status: 'paused' },
];

export const Reports: React.FC = () => {
  const { user } = useAuth();
  const { devices, clients, ssids, alerts, logs } = useNetworkStore();
  
  const [reportType, setReportType] = useState('executive');
  const [format, setFormat] = useState('PDF');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState(0);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Schedules state
  const [schedules, setSchedules] = useState<ReportTask[]>(initialReports);
  
  // New schedule form
  const [schedName, setSchedName] = useState('');
  const [schedFreq, setSchedFreq] = useState('Weekly');
  const [schedMail, setSchedMail] = useState('');
  const [schedFormat, setSchedFormat] = useState<'PDF' | 'CSV' | 'XLSX'>('PDF');
  const [isSchedulingOpen, setIsSchedulingOpen] = useState(false);

  const isReadOnly = user?.role === 'Network Engineer';

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setGenerateProgress(0);
    setShowSuccessToast(false);

    const interval = setInterval(() => {
      setGenerateProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsGenerating(false);
          setShowSuccessToast(true);
          setTimeout(() => setShowSuccessToast(false), 4000);
          
          // Trigger browser file download
          try {
            let fileContent = '';
            let mimeType = 'text/plain';
            const ext = format.toLowerCase();
            const filename = `${reportPreviewContent.title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;

            if (format === 'CSV') {
              mimeType = 'text/csv';
              fileContent = [
                ["Report Title", reportPreviewContent.title],
                ["Date Generated", reportPreviewContent.date],
                ["Author", reportPreviewContent.author],
                [],
                ["Section", "Content"]
              ].concat(
                reportPreviewContent.sections.map(s => [s.title, s.content])
              ).map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\r\n");
            } else if (format === 'XLSX') {
              mimeType = 'application/vnd.ms-excel';
              fileContent = [
                ["Report Title", reportPreviewContent.title],
                ["Date Generated", reportPreviewContent.date],
                ["Author", reportPreviewContent.author],
                [],
                ["Section", "Content"]
              ].concat(
                reportPreviewContent.sections.map(s => [s.title, s.content])
              ).map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join("\t")).join("\r\n");
            } else {
              // PDF
              mimeType = 'text/plain';
              fileContent = `REPORT: ${reportPreviewContent.title}\n` +
                            `DATE: ${reportPreviewContent.date}\n` +
                            `AUTHOR: ${reportPreviewContent.author.toUpperCase()}\n` +
                            `SCOPE: HQ-MAIN-CAMPUS\n\n` +
                            `========================================================================\n\n` +
                            reportPreviewContent.sections.map(s => `## ${s.title.toUpperCase()}\n${s.content}\n`).join("\n") +
                            `\n========================================================================\n` +
                            `CLASSIFICATION: CONFIDENTIAL / INTERNAL\n`;
            }

            const blob = new Blob([fileContent], { type: `${mimeType};charset=utf-8;` });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.setAttribute("download", `${filename}.${ext}`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          } catch (err) {
            console.error("Failed to generate download file:", err);
          }

          return 100;
        }
        return prev + 20;
      });
    }, 250);
  };

  const handleAddSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    const newTask: ReportTask = {
      id: 'rep-' + Math.random().toString(36).substring(7),
      name: schedName,
      frequency: schedFreq === 'Weekly' ? 'Every Monday 08:00' : schedFreq === 'Daily' ? 'Daily 00:00' : 'Monthly (1st)',
      recipient: schedMail,
      format: schedFormat,
      status: 'active'
    };
    setSchedules([...schedules, newTask]);
    setIsSchedulingOpen(false);
    
    // Reset
    setSchedName('');
    setSchedMail('');
  };

  const toggleScheduleState = (id: string) => {
    setSchedules(schedules.map(s => s.id === id ? { ...s, status: s.status === 'active' ? 'paused' : 'active' } : s));
  };

  const handleDeleteSchedule = (id: string) => {
    if (confirm('De-schedule and remove this automated report?')) {
      setSchedules(schedules.filter(s => s.id !== id));
    }
  };

  // Generate Report Previews contents dynamically based on type
  const reportPreviewContent = useMemo(() => {
    const timeString = new Date().toLocaleString();
    const author = user?.username || 'admin';
    const clientStats = `${clients.length} connected hosts`;
    const deviceStats = `${devices.length} managed nodes`;
    const activeAlerts = alerts.filter(a => !a.resolved).length;

    switch (reportType) {
      case 'security':
        return {
          title: 'Campus Security Center Audit Report',
          date: timeString,
          author,
          format,
          sections: [
            {
              title: 'Executive Summary',
              content: 'This report compiles firewall rule blocks, failed SSH login attempts, and active client quarantine actions. Overall security posture is currently rated as OPTIMAL.'
            },
            {
              title: 'Threat Detection Summary',
              content: `Active critical threats: 0. Outstanding security notifications: ${activeAlerts}. Authentication login events recorded: ${logs.length}.`
            },
            {
              title: 'Isolation Pools',
              content: 'Quarantined client MAC addresses: 1 hosts. Blackhole IP blocks: 1 MAC filters.'
            }
          ]
        };

      case 'wifi':
        return {
          title: 'RF Performance & Wi-Fi Coverage Report',
          date: timeString,
          author,
          format,
          sections: [
            {
              title: 'Executive Summary',
              content: 'Aggregate report of broadcast WLAN coverage, RF channel conflicts, and associated client distribution metrics across APs.'
            },
            {
              title: 'WiFi Analytics Roster',
              content: `Active SSIDs broadcasting: ${ssids.length} networks. Client distribution: ${clients.filter(c => c.connectionType === 'wireless').length} Wi-Fi hosts.`
            },
            {
              title: 'Radio Resource Optimization',
              content: 'Average signal interference ratio: -88 dBm (Nominal). Automated channel tuning applied: AP-01 on Channel 1 (2.4GHz), AP-02 on Channel 36 (5GHz).'
            }
          ]
        };

      case 'device':
      case 'inventory':
        return {
          title: 'Hardware Inventory & Lifecycle Audit',
          date: timeString,
          author,
          format,
          sections: [
            {
              title: 'Executive Summary',
              content: 'Complete breakdown of claimed switches, firewalls, and APs in the organization site including uptime and version history.'
            },
            {
              title: 'Device Roster Breakdown',
              content: `Total claimed nodes: ${deviceStats}. Online state: ${devices.filter(d => d.status === 'online').length} nodes up, ${devices.filter(d => d.status === 'offline').length} offline.`
            },
            {
              title: 'Firmware Upgrades Compliance',
              content: '100% of claimed switches and firewall devices are running approved JunOS LTS software releases. No updates required.'
            }
          ]
        };

      case 'health':
      default:
        return {
          title: 'Executive Network Health Summary',
          date: timeString,
          author,
          format,
          sections: [
            {
              title: 'Executive Summary',
              content: 'A comprehensive high-level review of the campus WAN links, switches backplane throughputs, PoE delivery, and client connectivity. Aggregated network SLA is currently at 99.98%.'
            },
            {
              title: 'Bandwidth & Traffic Utilization',
              content: 'Aggregate download throughput: 450 Mbps. Maximum peak load: 890 Mbps. Top consumer protocol: HTTPS Secure traffic.'
            },
            {
              title: 'Client Statistics Roster',
              content: `Total active endpoints: ${clientStats}. Wired ethernet connections: ${clients.filter(c => c.connectionType === 'wired').length} clients.`
            }
          ]
        };
    }
  }, [reportType, format, clients, devices, alerts, logs, ssids, user]);

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-left">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-brand-500/10 dark:bg-brand-500/20 text-brand-500 rounded-xl flex items-center justify-center">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white m-0">
              Professional Reports Center
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Generate and schedule executive SLA summaries, WiFi RF audits, and security compliance reports.
            </p>
          </div>
        </div>
      </div>

      {/* Success feedback toast */}
      {showSuccessToast && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-2xl flex items-center gap-3 text-xs font-semibold text-left">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <div>
            <p>Report exported successfully!</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Your download in {format} format has been dispatched.</p>
          </div>
        </div>
      )}

      {/* Main Grid: Form selectors + Large Preview pane */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Selection form & schedules list */}
        <div className="lg:col-span-1 space-y-6 text-left">
          <Card title="Configure Report Parameters" description="Define export targets and schemas:">
            <form onSubmit={handleGenerate} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Report Schema Category</label>
                <select 
                  value={reportType} 
                  onChange={e => setReportType(e.target.value)}
                  className="w-full bg-slate-500/5 border border-slate-200/10 rounded-lg p-2 font-sans focus:outline-none"
                >
                  <option value="health">Executive Summary Report</option>
                  <option value="security">Site Security Center Audit</option>
                  <option value="wifi">Wireless RF Analytics Report</option>
                  <option value="device">Hardware Inventory & Lifecycle</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Output File Format</label>
                <select 
                  value={format} 
                  onChange={e => setFormat(e.target.value)}
                  className="w-full bg-slate-500/5 border border-slate-200/10 rounded-lg p-2 font-sans focus:outline-none"
                >
                  <option value="PDF">Adobe PDF (.pdf)</option>
                  <option value="XLSX">Microsoft Excel (.xlsx)</option>
                  <option value="CSV">Comma Separated Values (.csv)</option>
                </select>
              </div>

              <Button 
                type="submit" 
                variant="primary" 
                isLoading={isGenerating}
                className="w-full text-[10px] py-2 flex items-center justify-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" /> Export Report Document
              </Button>
            </form>
            
            {isGenerating && (
              <div className="mt-4 space-y-1 text-xs">
                <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase">
                  <span>Generating report segments...</span>
                  <span>{generateProgress}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-brand-500 h-full rounded-full transition-all duration-300" style={{ width: `${generateProgress}%` }} />
                </div>
              </div>
            )}
          </Card>

          {/* Schedule Automated Reports */}
          <Card title="Automated Scheduling Rules" description="Schedules periodic reports delivery:">
            <div className="space-y-3">
              {schedules.map(s => (
                <div key={s.id} className="p-3 bg-slate-500/5 border border-slate-200/10 rounded-2xl space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-700 dark:text-slate-200">{s.name}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${s.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'}`}>{s.status}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">Frequency: {s.frequency} | Target: {s.recipient}</p>
                  <div className="flex gap-2 justify-end border-t border-slate-250/10 pt-2 mt-2">
                    <Button variant="ghost" size="sm" onClick={() => toggleScheduleState(s.id)} className="text-[8px] py-1 px-2">
                      Toggle State
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteSchedule(s.id)} className="text-[8px] py-1 px-2 text-rose-500 hover:text-rose-700">
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column: Premium Document Preview Pane */}
        <div className="lg:col-span-2 text-left space-y-6">
          <Card title="Professional Report Preview" description="Live preview render of report document layout structure:">
            <div className="p-6 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl shadow-inner font-sans text-slate-700 dark:text-slate-300 space-y-6">
              
              {/* Header metadata strip */}
              <div className="border-b-2 border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800 dark:text-white leading-tight font-display">
                      {reportPreviewContent.title}
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-1 font-bold">CampusNet AI Autonomous Reporting Controller</p>
                  </div>
                  <span className="bg-slate-200 dark:bg-slate-900 px-2 py-0.5 rounded font-mono text-[9px] font-bold uppercase tracking-wider">
                    Format: {reportPreviewContent.format}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4 text-[9px] font-bold text-slate-500 uppercase tracking-wider border-t border-slate-200 dark:border-slate-850 pt-3">
                  <div>Date: <span className="text-slate-400 block font-normal mt-0.5">{reportPreviewContent.date}</span></div>
                  <div>Author: <span className="text-slate-400 block font-normal mt-0.5">{reportPreviewContent.author}</span></div>
                  <div>Scope: <span className="text-slate-400 block font-normal mt-0.5">HQ-MAIN-CAMPUS</span></div>
                </div>
              </div>

              {/* Sections list rendering */}
              <div className="space-y-5">
                {reportPreviewContent.sections.map((sect, idx) => (
                  <div key={idx} className="space-y-1">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{sect.title}</h4>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400 font-medium">
                      {sect.content}
                    </p>
                  </div>
                ))}
              </div>

              {/* Document footer placeholder */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-3 flex justify-between items-center text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Classification: Confidential / Internal</span>
                <span>Page 1 of 1</span>
              </div>

            </div>
          </Card>
        </div>

      </div>
    </div>
  );
};
export default Reports;
