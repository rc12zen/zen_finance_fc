"use client";
/**
 * Dashboard — /app/dashboard/page.tsx
 *
 * Metrics served from GET /api/results/metrics
 * KPI mapping (unchanged UI contract):
 *   total_rows_ingested → Total Rows Ingested
 *   found               → Found / Matched
 *   not_found           → Not Matched
 *   passed_validation   → Passed Validation
 *   failed_validation   → Failed Validation
 *   pending_hitl        → Pending Approval
 *   approved            → Approved & Posted (oracle success)
 *   rejected            → Rejected
 */
import {
  AlertTriangle, ArrowRight, Ban, Briefcase, Calendar,
  CheckCircle2, ChevronDown, ClipboardCheck, CloudLightning,
  FileText, Landmark, Layers, PieChart as PieIcon, Play,
  RefreshCw, ShieldCheck, Sparkles, UploadCloud, User, X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  getAgingStatus, getFiles, getMetrics, getRunHistory,
  getStatus, refreshAging, startRun,
  uploadAgingReport, uploadStatement, getFilterOptions, deleteFile,
} from "@/lib/api";

interface FileInfo {
  filename:      string;
  bank_name:     string;
  size_mb:       number;
  business_unit: string;
  ou_number:     string;
}

interface Metrics {
  total_rows_ingested: number;
  found:               number;
  not_found:           number;
  passed_validation:   number;
  failed_validation:   number;
  pending_hitl:        number;
  approved:            number;
  rejected:            number;
  posted_to_oracle:    number;
  extraction_method_breakdown: Record<string, number>;
  aging_report_loaded:    boolean;
  aging_report_row_count: number;
}

const METRIC_CONFIG = {
  found:    { name: "Found",             color: "#1E3A5F" },
  notFound: { name: "Not Found",         color: "#2E6DA4" },
  passed:   { name: "Passed Validation", color: "#4A90E2" },
  failed:   { name: "Failed Validation", color: "#e11d48" },
  pending:  { name: "Pending Approval",  color: "#f59e0b" },
};

export default function Dashboard() {
  const [files, setFiles]             = useState<FileInfo[]>([]);
  const [runStatus, setRunStatus]     = useState({ status: "idle", message: "", progress_current: 0 });
  const [metrics, setMetrics]         = useState<Metrics | null>(null);
  const [agingStatus, setAgingStatus] = useState({ loaded: false, row_count: 0, filename: null });
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");

  const [agingUploading, setAgingUploading]         = useState(false);
  const [statementUploading, setStatementUploading] = useState(false);
  const agingInputRef     = useRef<HTMLInputElement>(null);
  const statementInputRef = useRef<HTMLInputElement>(null);

  const [timePeriod, setTimePeriod]               = useState("Last Analysis");
  const [isCustomDateActive, setIsCustomDateActive] = useState(false);
  const [customStartDate, setCustomStartDate]     = useState("");
  const [customEndDate, setCustomEndDate]         = useState("");

  const [bankOptions, setBankOptions] = useState<string[]>([]);
  const [buOptions, setBuOptions]     = useState<string[]>([]);
  const [userOptions, setUserOptions] = useState<string[]>([]);
  const [selectedBank, setSelectedBank] = useState("All Banks");
  const [selectedBU, setSelectedBU]     = useState("All BUs");
  const [selectedUser, setSelectedUser] = useState("All Users");

  const [activeMetrics, setActiveMetrics] = useState({
    found: true, notFound: true, passed: true, failed: true, pending: true,
  });

  const [userDisplayName, setUserDisplayName] = useState("Admin User");
  const [aiPanelVisible, setAiPanelVisible]   = useState(true);
  const [successMessage, setSuccessMessage]   = useState("");

  const [runCompletionSummary, setRunCompletionSummary] = useState<{
    totalRows: number; matched: number; notMatched: number; pendingReview: number;
  } | null>(null);
  const prevRunStatus = useRef<string>("idle");

  const fetchFiles = useCallback(async () => {
    try {
      const res = await getFiles();
      setFiles(res.data.files);
    } catch {
      setError("Could not connect to backend system.");
    }
  }, []);

  const buildDateRange = (period: string, cStart: string, cEnd: string) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const now = new Date(); const today = fmt(now);
    if (period === "Today")  return { date_from: today, date_to: today };
    if (period === "Yesterday") { const y = new Date(now); y.setDate(y.getDate() - 1); const ys = fmt(y); return { date_from: ys, date_to: ys }; }
    if (period === "WTD") { const m = new Date(now); m.setDate(now.getDate() - ((now.getDay() + 6) % 7)); return { date_from: fmt(m), date_to: today }; }
    if (period === "MTD") { return { date_from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), date_to: today }; }
    if (period === "Custom Date") { return { date_from: cStart || undefined, date_to: cEnd || undefined }; }
    return {};
  };

  const doFetchMetrics = useCallback(async (period: string, cStart: string, cEnd: string) => {
    try {
      let runId: number | undefined;
      let dateFrom: string | undefined;
      let dateTo:   string | undefined;

      if (period === "Last Analysis") {
        const histRes = await getRunHistory(1, 10);
        const latest  = (histRes.data.data || []).find((r: any) => r.status === "completed");
        runId = latest?.run_id;
      } else {
        const dr = buildDateRange(period, cStart, cEnd);
        dateFrom = (dr as any).date_from;
        dateTo   = (dr as any).date_to;
      }

      const [m, a] = await Promise.all([getMetrics(runId, dateFrom, dateTo), getAgingStatus()]);
      setMetrics(m.data);
      setAgingStatus(a.data);
    } catch {}
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res       = await getStatus();
      const newStatus = res.data.status;
      setRunStatus(res.data);

      if (newStatus === "completed" && prevRunStatus.current !== "completed") {
        await doFetchMetrics(timePeriod, customStartDate, customEndDate);
        try {
          const histRes = await getRunHistory(1, 1);
          const latest  = histRes.data.data?.[0];
          if (latest) {
            setRunCompletionSummary({
              totalRows:    latest.total_credit_rows ?? 0,
              matched:      latest.total_matched     ?? 0,
              notMatched:   latest.total_not_found   ?? 0,
              pendingReview: latest.pending_hitl     ?? 0,
            });
          }
        } catch {}
      }
      if (newStatus === "error" && prevRunStatus.current !== "error") {
        setError(res.data.message || "Analysis run failed.");
      }
      prevRunStatus.current = newStatus;
    } catch {}
  }, [doFetchMetrics, timePeriod, customStartDate, customEndDate]);

  const fetchFilterOptions = useCallback(async () => {
    try {
      const res = await getFilterOptions();
      setBankOptions(res.data.banks || []);
      setBuOptions(res.data.business_units || []);
      setUserOptions(res.data.users || []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchFiles();
    doFetchMetrics("Last Analysis", "", "");
    fetchFilterOptions();
    const match = document.cookie.match(/(?:^|; )login_user_email_stub=([^;]*)/);
    if (match?.[1]) setUserDisplayName(decodeURIComponent(match[1]).split("@")[0]);
  }, [fetchFiles, doFetchMetrics, fetchFilterOptions]);

  useEffect(() => {
    if (timePeriod === "Custom Date") return;
    doFetchMetrics(timePeriod, customStartDate, customEndDate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timePeriod]);

  useEffect(() => {
    if (runStatus.status !== "running") return;
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [runStatus.status, fetchStatus]);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(""), 4000);
  };

  const handleStart = async () => {
    if (!agingStatus.loaded) { setError("Please load aging ledger data first."); return; }
    if (files.length === 0)  { setError("Upload at least one statement file first."); return; }
    setError("");
    setRunCompletionSummary(null);
    setLoading(true);
    try {
      await startRun(files.map((f) => f.filename));
      prevRunStatus.current = "running";
      fetchStatus();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to start analysis");
    }
    setLoading(false);
  };

  const handleAgingUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setAgingUploading(true); setError("");
    try {
      await uploadAgingReport(file);
      await refreshAging();
      await doFetchMetrics(timePeriod, customStartDate, customEndDate);
      await fetchFilterOptions();
      showSuccess(`Aging report "${file.name}" uploaded successfully.`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Aging report upload failed.");
    } finally {
      setAgingUploading(false);
      if (agingInputRef.current) agingInputRef.current.value = "";
    }
  };

  const handleStatementUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setStatementUploading(true); setError("");
    try {
      await uploadStatement(file);
      await fetchFiles();
      await fetchFilterOptions();
      showSuccess(`Statement "${file.name}" uploaded successfully.`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Statement upload failed.");
    } finally {
      setStatementUploading(false);
      if (statementInputRef.current) statementInputRef.current.value = "";
    }
  };

  const handleRemoveFile = async (filename: string) => {
    try { await deleteFile(filename); await fetchFiles(); } catch {}
  };

  const isRunning = runStatus.status === "running";

  const getPieChartData = () => {
    if (!metrics) return [];
    const m = metrics;
    const raw = [
      { id: "found",    name: METRIC_CONFIG.found.name,    value: m.found            ?? 0, color: METRIC_CONFIG.found.color    },
      { id: "notFound", name: METRIC_CONFIG.notFound.name, value: m.not_found        ?? 0, color: METRIC_CONFIG.notFound.color  },
      { id: "passed",   name: METRIC_CONFIG.passed.name,   value: m.passed_validation ?? 0, color: METRIC_CONFIG.passed.color   },
      { id: "failed",   name: METRIC_CONFIG.failed.name,   value: m.failed_validation ?? 0, color: METRIC_CONFIG.failed.color   },
      { id: "pending",  name: METRIC_CONFIG.pending.name,  value: m.pending_hitl      ?? 0, color: METRIC_CONFIG.pending.color  },
    ];
    return raw.filter((item) => activeMetrics[item.id as keyof typeof activeMetrics] && item.value > 0);
  };

  const pieData = getPieChartData();
  const dm      = metrics || {
    total_rows_ingested: 0, found: 0, not_found: 0,
    passed_validation: 0, failed_validation: 0,
    pending_hitl: 0, approved: 0, rejected: 0, posted_to_oracle: 0,
  };

  return (
    <div className="space-y-6">
      {/* HERO */}
      <div className="bg-white border border-gray-200 p-6 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 text-primary pointer-events-none">
          <CloudLightning size={100} />
        </div>
        <div className="max-w-4xl">
          <h2 className="text-sm font-black text-primary uppercase tracking-wider">
            Welcome back, {userDisplayName}.
          </h2>
          <p className="text-xs text-gray-600 mt-2 leading-relaxed">
            Upload an Aging report and at least one bank account statement below, then start analysis.
            The AI will automatically identify customers, match invoices and flag anything that needs your attention.
          </p>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="bg-red-50/50 border-l-4 border-red-600 text-gray-900 px-4 py-3.5 shadow-sm text-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="text-red-600 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button onClick={() => setError("")} className="text-gray-400 hover:text-gray-600 px-2">×</button>
        </div>
      )}

      {/* SUCCESS */}
      {successMessage && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 px-4 py-3.5 text-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage("")} className="text-gray-400 hover:text-gray-600 px-2">×</button>
        </div>
      )}

      {/* COMPLETION BANNER */}
      {runCompletionSummary && (
        <div className="bg-[#1E3A5F] text-white px-5 py-4 shadow-sm border border-[#172e4c] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={20} className="text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-black uppercase tracking-wider">Analysis Complete</div>
              <p className="text-[11px] text-gray-300 mt-1">
                Processed <span className="text-white font-bold">{runCompletionSummary.totalRows.toLocaleString()}</span> rows —{" "}
                <span className="text-emerald-400 font-bold">{runCompletionSummary.matched.toLocaleString()} found</span>,{" "}
                <span className="text-red-400 font-bold">{runCompletionSummary.notMatched.toLocaleString()} not found</span>,{" "}
                <span className="text-amber-400 font-bold">{runCompletionSummary.pendingReview.toLocaleString()} pending review</span>.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <a href="/analysis-history"
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-sm transition-colors cursor-pointer whitespace-nowrap">
              View in Analysis History <ArrowRight size={11} />
            </a>
            <button onClick={() => setRunCompletionSummary(null)} className="text-gray-400 hover:text-white cursor-pointer p-1">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* UPLOADS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 p-5 shadow-xs flex flex-col justify-between min-h-[180px]">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2 mb-3">
              <Layers size={14} className="text-[#2E6DA4]" /> Aging Report
            </h3>
            <input ref={agingInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleAgingUpload} />
            <button onClick={() => agingInputRef.current?.click()} disabled={agingUploading}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 hover:border-primary text-primary py-3.5 px-4 text-[11px] font-bold uppercase tracking-wider bg-gray-50/50 hover:bg-gray-50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              <UploadCloud size={14} className="text-[#4A90E2]" />
              <span>{agingUploading ? "Uploading…" : "Upload From Local"}</span>
            </button>
          </div>
          <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
            <span>Single XLS, CSV. Max 10 MB.</span>
            {agingStatus.loaded && agingStatus.filename ? (
              <span className="text-[#4A90E2] font-bold flex items-center gap-1.5 max-w-[180px]">
                <CheckCircle2 size={11} className="shrink-0" />
                <span className="truncate font-mono text-[10px]">{agingStatus.filename}</span>
              </span>
            ) : (
              <span className="text-amber-600 font-medium">No file uploaded</span>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-5 shadow-xs flex flex-col justify-between min-h-[180px]">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2 mb-3">
              <FileText size={14} className="text-[#2E6DA4]" /> Account Statements
            </h3>
            <input ref={statementInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleStatementUpload} />
            <button onClick={() => statementInputRef.current?.click()} disabled={statementUploading}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 hover:border-primary text-primary py-3.5 px-4 text-[11px] font-bold uppercase tracking-wider bg-gray-50/50 hover:bg-gray-50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              <UploadCloud size={14} className="text-[#4A90E2]" />
              <span>{statementUploading ? "Uploading…" : "Upload From Local"}</span>
            </button>
          </div>
          {files.length > 0 ? (
            <div className="mt-3 pt-2 border-t border-gray-100 space-y-1.5 max-h-[120px] overflow-y-auto">
              {files.map((f) => (
                <div key={f.filename} className="flex items-center justify-between text-[11px] bg-gray-50 border border-gray-200 rounded-xs px-2 py-1.5 gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FileText size={11} className="text-gray-400 shrink-0" />
                    <span className="font-mono font-bold text-primary truncate text-[10px]">{f.filename}</span>
                    <span className="text-gray-400 shrink-0 text-[10px]">{f.bank_name} · {f.size_mb}MB</span>
                  </div>
                  <button onClick={() => handleRemoveFile(f.filename)} className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer shrink-0">
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 pt-2 border-t border-gray-100 text-[11px] text-gray-400">
              Upload XLS / CSV files. Max 10 MB each.
            </div>
          )}
        </div>
      </div>

      {/* CONTROL BAR */}
      <div className="bg-[#1E3A5F] text-white px-5 py-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 border border-[#172e4c]">
        <div className="flex items-center gap-3">
          <RefreshCw size={14} className={`text-[#4A90E2] ${isRunning ? "animate-spin" : ""}`} />
          <div className="text-xs font-medium text-gray-200">
            {isRunning ? (
              <span className="text-white font-bold">Running… {runStatus.progress_current > 0 ? `${runStatus.progress_current} rows processed` : ""}</span>
            ) : agingStatus.loaded && files.length > 0 ? (
              <span className="text-white font-bold">Ready.</span>
            ) : (
              <span className="text-gray-300">Upload an ageing report and at least one account statement to begin.</span>
            )}
          </div>
        </div>
        <button onClick={handleStart} disabled={isRunning || loading || files.length === 0 || !agingStatus.loaded}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#4A90E2] hover:bg-[#357ABD] text-white px-6 py-2.5 font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-20 disabled:cursor-not-allowed shadow-xs whitespace-nowrap rounded-sm cursor-pointer">
          <Play size={11} className="fill-current" />
          <span>{isRunning ? "Running…" : "Start Analysis"}</span>
          {!isRunning && <ArrowRight size={12} className="ml-0.5" />}
        </button>
      </div>

      {/* DASHBOARD METRICS */}
      <div className="bg-white border border-gray-200 p-6 shadow-xs space-y-6">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-xs font-black text-primary uppercase tracking-wider">Dashboard</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">Overall summary for the selected period and applied filters.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start xl:self-auto">
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-sm">
              {["Last Analysis","Today","Yesterday","WTD","MTD","Custom Date"].map((p) => (
                <button key={p} onClick={() => { setTimePeriod(p); setIsCustomDateActive(p === "Custom Date"); }}
                  className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-xs transition-all cursor-pointer ${timePeriod === p ? "bg-[#1E3A5F] text-white shadow-xs" : "text-gray-500 hover:text-primary"}`}>
                  {p}
                </button>
              ))}
            </div>
            {isCustomDateActive && (
              <div className="flex items-center gap-1.5 border-l border-gray-200 pl-2">
                <input type="date" value={customStartDate}
                  onChange={(e) => { const v = e.target.value; setCustomStartDate(v); if (customEndDate) doFetchMetrics("Custom Date", v, customEndDate); }}
                  className="bg-gray-50 border border-gray-300 rounded-sm text-[10px] font-bold text-gray-600 px-2 py-1 outline-none focus:border-accent" />
                <span className="text-[10px] font-bold text-gray-400">TO</span>
                <input type="date" value={customEndDate}
                  onChange={(e) => { const v = e.target.value; setCustomEndDate(v); if (customStartDate) doFetchMetrics("Custom Date", customStartDate, v); }}
                  className="bg-gray-50 border border-gray-300 rounded-sm text-[10px] font-bold text-gray-600 px-2 py-1 outline-none focus:border-accent" />
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: <Landmark size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />, value: selectedBank, onChange: setSelectedBank, options: bankOptions, defaultLabel: "All Banks" },
            { icon: <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />, value: selectedBU,   onChange: setSelectedBU,   options: buOptions,   defaultLabel: "All BUs"   },
            { icon: <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />,     value: selectedUser, onChange: setSelectedUser, options: userOptions, defaultLabel: "All Users" },
          ].map(({ icon, value, onChange, options, defaultLabel }) => (
            <div key={defaultLabel} className="relative">
              {icon}
              <select value={value} onChange={(e) => onChange(e.target.value)}
                className="w-full bg-white border border-gray-300 text-xs font-bold text-primary pl-9 pr-8 py-2.5 rounded-sm appearance-none focus:outline-none focus:border-accent cursor-pointer">
                <option>{defaultLabel}</option>
                {options.map((o) => <option key={o}>{o}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          ))}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          {[
            { icon: <Layers size={13} className="text-[#1E3A5F]" />,       label: "Total rows ingested", value: dm.total_rows_ingested ?? 0, sub: "Transactions read"             },
            { icon: <Sparkles size={13} />,                                  label: "Found",               value: dm.found               ?? 0, sub: "Invoice found in aging"         },
            { icon: <AlertTriangle size={13} className="text-[#2E6DA4]" />, label: "Not Found",           value: dm.not_found            ?? 0, sub: "Require manual review"          },
            { icon: <ShieldCheck size={13} className="text-[#4A90E2]" />,   label: "Passed Validation",   value: dm.passed_validation    ?? 0, sub: "All checks passed"              },
            { icon: <Ban size={13} className="text-[#e11d48]" />,           label: "Failed Validation",   value: dm.failed_validation    ?? 0, sub: "At least one check failed"      },
            { icon: <Calendar size={13} className="text-[#f59e0b]" />,      label: "Pending Approval",    value: dm.pending_hitl         ?? 0, sub: "Awaiting SPOC review"           },
            { icon: <ClipboardCheck size={13} className="text-emerald-600" />, label: "Approved & Posted", value: dm.posted_to_oracle    ?? 0, sub: "Posted to Oracle Fusion"       },
            { icon: <Ban size={13} className="text-red-500" />,             label: "Rejected",            value: dm.rejected             ?? 0, sub: "Rejected by SPOC"               },
          ].map(({ icon, label, value, sub }) => (
            <div key={label} className="border border-gray-200 p-4 rounded-sm bg-gray-50/30">
              <div className="flex items-center gap-1.5 text-gray-400 mb-1">{icon}<span className="text-[10px] font-bold uppercase tracking-wider">{label}</span></div>
              <div className="text-xl font-black text-primary">{value.toLocaleString()}</div>
              <div className="mt-2 pt-1.5 text-[10px] text-gray-400 font-medium leading-normal">{sub}</div>
            </div>
          ))}
        </div>

        <hr className="border-gray-200" />

        {/* Pie Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-2">
          <div className="lg:col-span-5 space-y-4">
            <div>
              <h4 className="text-xs font-black text-primary uppercase tracking-wider">Select Metrics to Display</h4>
              <p className="text-[11px] text-gray-500 mt-0.5">Toggle variables to alter chart distribution.</p>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {(Object.keys(METRIC_CONFIG) as Array<keyof typeof METRIC_CONFIG>).map((key) => {
                const cfg    = METRIC_CONFIG[key];
                const active = activeMetrics[key];
                const val    = key === "found" ? (dm.found ?? 0) : key === "notFound" ? (dm.not_found ?? 0) : key === "passed" ? (dm.passed_validation ?? 0) : key === "failed" ? (dm.failed_validation ?? 0) : (dm.pending_hitl ?? 0);
                return (
                  <button key={key} type="button"
                    onClick={() => setActiveMetrics((prev) => ({ ...prev, [key]: !prev[key] }))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-bold transition-all shadow-xs cursor-pointer ${active ? "text-primary" : "border-gray-200 bg-white text-gray-400 hover:border-gray-300"}`}
                    style={{ borderColor: active ? cfg.color : "" }}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: active ? cfg.color : "#d1d5db" }} />
                    <span>{cfg.name}</span>
                    <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold ${active ? "text-white" : "bg-gray-100 text-gray-400"}`}
                      style={{ backgroundColor: active ? cfg.color : "" }}>
                      {val.toLocaleString()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-7 border border-gray-200 p-5 rounded-sm bg-gray-50/10 flex flex-col items-center justify-center min-h-[340px]">
            <div className="w-full text-left mb-4 flex items-center gap-2">
              <PieIcon size={14} className="text-accent" />
              <span className="text-xs font-bold text-primary uppercase tracking-wider">Proportional Distribution Share</span>
            </div>
            {pieData.length > 0 ? (
              <div className="w-full h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="48%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "#1E3A5F", borderColor: "#172e4c", borderRadius: "2px" }} itemStyle={{ color: "#fff", fontSize: "12px" }} />
                    <Legend verticalAlign="bottom" align="center" iconType="rect" iconSize={10} wrapperStyle={{ fontSize: "11px", fontWeight: 600, paddingTop: "10px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-xs text-gray-400 font-medium text-center py-12">No active metrics selected.</div>
            )}
          </div>
        </div>

        <hr className="border-gray-200" />

        {/* AI Run Details */}
        <div className="space-y-4 pt-1">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-xs font-black text-primary uppercase tracking-wider">AI Run Details</h4>
              <p className="text-[11px] text-gray-500 mt-0.5">AI run details framework data specifications.</p>
            </div>
            <button onClick={() => setAiPanelVisible((v) => !v)} className="text-[11px] font-medium text-gray-400 hover:text-primary cursor-pointer">
              {aiPanelVisible ? "Hide" : "Show"}
            </button>
          </div>
          {aiPanelVisible && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-5 gap-x-6">
              {[["Model","Claude Sonnet 4"],["Prompt Version","v3.0"],["Tokens In","42,800"],["Tokens Out","8,140"],["Estimated Cost","$0.18"],["Latency","34.2 sec"]].map(([label, value]) => (
                <div key={label} className="space-y-0.5">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">{label}</span>
                  <span className={`text-xs font-bold ${label === "Estimated Cost" ? "text-emerald-600" : "text-primary"}`}>{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
