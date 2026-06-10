"use client";
import {
	AlertTriangle,
	ArrowRight,
	Ban,
	Briefcase,
	Calendar,
	CheckCircle2,
	ChevronDown,
	ClipboardCheck,
	CloudLightning,
	FileText,
	Landmark,
	Layers,
	PieChart as PieIcon,
	Play,
	RefreshCw,
	ShieldCheck,
	Sparkles,
	UploadCloud,
	User,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	Cell,
	Legend,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
} from "recharts";
import {
	getAgingStatus,
	getFiles,
	getMetrics,
	getRunHistory,
	getStatus,
	refreshAging,
	startRun,
	uploadAgingReport,
	uploadStatement,
	getFilterOptions,
} from "@/lib/api";

interface FileInfo {
	filename: string;
	bank_name: string;
	size_mb: number;
	business_unit: string;
	ou_number: string;
}

interface Metrics {
	total_rows_ingested: number;
	found: number;
	not_found: number;
	passed_validation: number;
	failed_validation: number;
	pending_hitl: number;
	approved: number;
	rejected: number;
	posted_to_oracle: number;
	extraction_method_breakdown: Record<string, number>;
	aging_report_loaded: boolean;
	aging_report_row_count: number;
}

const METRIC_CONFIG = {
	found:    { name: "Found",              color: "#1E3A5F" },
	notFound: { name: "Not Found",          color: "#2E6DA4" },
	passed:   { name: "Passed Validation",  color: "#4A90E2" },
	failed:   { name: "Failed Validation",  color: "#e11d48" },
	pending:  { name: "Pending HITL",       color: "#f59e0b" },
};

export default function Dashboard() {
	const [files, setFiles]           = useState<FileInfo[]>([]);
	const [runStatus, setRunStatus]   = useState({ status: "idle", message: "", progress_current: 0 });
	const [metrics, setMetrics]       = useState<Metrics | null>(null);
	const [agingStatus, setAgingStatus] = useState({ loaded: false, row_count: 0, filename: null });
	const [loading, setLoading]       = useState(false);
	const [error, setError]           = useState("");

	// Upload state
	const [agingUploading, setAgingUploading]     = useState(false);
	const [statementUploading, setStatementUploading] = useState(false);
	const agingInputRef     = useRef<HTMLInputElement>(null);
	const statementInputRef = useRef<HTMLInputElement>(null);

	// Filter state
	const [timePeriod, setTimePeriod]           = useState("Last Analysis");
	const [isCustomDateActive, setIsCustomDateActive] = useState(false);
	const [customStartDate, setCustomStartDate] = useState("");
	const [customEndDate, setCustomEndDate]     = useState("");

	// Dynamic filter options from backend
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

	// ── Data fetchers ──────────────────────────────────────────────────────────

	const fetchFiles = useCallback(async () => {
		try {
			const res = await getFiles();
			setFiles(res.data.files);
		} catch {
			setError("Could not connect to backend system. Verify server configuration.");
		}
	}, []);

	// ── Pure helper — no hooks, no stale closures ────────────────────────────
	const buildDateRange = (
		period: string, cStart: string, cEnd: string,
	): { date_from?: string; date_to?: string } => {
		const pad = (n: number) => String(n).padStart(2, "0");
		const fmt = (d: Date) =>
			`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
		const now = new Date(); const today = fmt(now);
		if (period === "Today")     return { date_from: today, date_to: today };
		if (period === "Yesterday") {
			const y = new Date(now); y.setDate(y.getDate() - 1); const ys = fmt(y);
			return { date_from: ys, date_to: ys };
		}
		if (period === "WTD") {
			const m = new Date(now); m.setDate(now.getDate() - ((now.getDay() + 6) % 7));
			return { date_from: fmt(m), date_to: today };
		}
		if (period === "MTD") {
			return { date_from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), date_to: today };
		}
		if (period === "Custom Date") {
			return { date_from: cStart || undefined, date_to: cEnd || undefined };
		}
		return {}; // "Last Analysis" — handled via run_id, not dates
	};

	// ── Core metrics fetcher — plain async fn, called imperatively ─────────────
	const doFetchMetrics = useCallback(async (
		period: string,
		cStart: string,
		cEnd: string,
	) => {
		try {
			let runId:    number | undefined = undefined;
			let dateFrom: string | undefined = undefined;
			let dateTo:   string | undefined = undefined;

			if (period === "Last Analysis") {
				const histRes = await getRunHistory(1, 1);
				const latest  = (histRes.data.data || []).find(
					(r: any) => r.status === "completed",
				);
				runId = latest?.run_id;
			} else {
				const dr = buildDateRange(period, cStart, cEnd);
				dateFrom = dr.date_from;
				dateTo   = dr.date_to;
			}

			const [m, a] = await Promise.all([
				getMetrics(runId, dateFrom, dateTo),
				getAgingStatus(),
			]);
			setMetrics(m.data);
			setAgingStatus(a.data);
		} catch {}
	}, []); // no deps — receives all values as arguments, never stale

	// ── fetchMetrics shim — convenience wrapper that reads current state ────────
	const fetchMetrics = useCallback(async () => {
		await doFetchMetrics(timePeriod, customStartDate, customEndDate);
	}, [doFetchMetrics, timePeriod, customStartDate, customEndDate]);

	// ── Re-fetch whenever timePeriod changes (pill clicks) ─────────────────────
	useEffect(() => {
		if (timePeriod === "Custom Date") return; // wait for both date inputs
		doFetchMetrics(timePeriod, customStartDate, customEndDate);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [timePeriod]); // intentionally only timePeriod — not cStart/cEnd

	const fetchStatus = useCallback(async () => {
		try {
			const res = await getStatus();
			setRunStatus(res.data);
			if (res.data.status === "completed" || res.data.status === "error")
				await doFetchMetrics(timePeriod, customStartDate, customEndDate);
		} catch {}
	}, [doFetchMetrics, timePeriod, customStartDate, customEndDate]);

	// Fetch dynamic filter options from /api/filters/options
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
		// Initial metrics load for "Last Analysis" — doFetchMetrics called directly
		// so it doesn't depend on the timePeriod useEffect (which fires anyway)
		doFetchMetrics("Last Analysis", "", "");
		fetchFilterOptions();

		const match = document.cookie.match(/(?:^|; )login_user_email_stub=([^;]*)/);
		if (match?.[1]) {
			setUserDisplayName(decodeURIComponent(match[1]).split("@")[0]);
		}
	}, [fetchFiles, doFetchMetrics, fetchFilterOptions]);

	useEffect(() => {
		if (runStatus.status !== "running") return;
		const interval = setInterval(fetchStatus, 2000);
		return () => clearInterval(interval);
	}, [runStatus.status, fetchStatus]);

	// ── Handlers ───────────────────────────────────────────────────────────────

	const handleStart = async () => {
		if (!agingStatus.loaded) {
			setError("Required validation context missing: Please load aging ledger data first.");
			return;
		}
		if (files.length === 0) {
			setError("No statement batches specified: Upload statement targets first.");
			return;
		}
		setError("");
		setLoading(true);
		try {
			await startRun(files.map((f) => f.filename));
			fetchStatus();
		} catch (e: any) {
			setError(e?.response?.data?.detail || "Failed to initiate automated extraction pipeline");
		}
		setLoading(false);
	};

	// Aging report upload — calls POST /api/config/refresh-aging after upload
	const handleAgingUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		setAgingUploading(true);
		setError("");
		try {
			await uploadAgingReport(file);
			await refreshAging();
			await doFetchMetrics(timePeriod, customStartDate, customEndDate); // refresh
			await fetchFilterOptions();  // BU options may change after new aging
		} catch (err: any) {
			setError(err?.response?.data?.detail || "Aging report upload failed.");
		} finally {
			setAgingUploading(false);
			if (agingInputRef.current) agingInputRef.current.value = "";
		}
	};

	// Bank statement upload — calls POST /api/run/upload
	const handleStatementUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		setStatementUploading(true);
		setError("");
		try {
			await uploadStatement(file);
			await fetchFiles();          // refresh file list
			await fetchFilterOptions();  // bank/BU options may update
		} catch (err: any) {
			setError(err?.response?.data?.detail || "Statement upload failed.");
		} finally {
			setStatementUploading(false);
			if (statementInputRef.current) statementInputRef.current.value = "";
		}
	};

	const handleTimePeriodSelect = (period: string) => {
		setTimePeriod(period);          // triggers useEffect → doFetchMetrics
		setIsCustomDateActive(period === "Custom Date");
	};

	const toggleMetricVisibility = (key: keyof typeof activeMetrics) => {
		setActiveMetrics((prev) => ({ ...prev, [key]: !prev[key] }));
	};

	const isRunning = runStatus.status === "running";

	const getPieChartData = () => {
		if (!metrics) return [];
		const rawData = [
			{ id: "found",    name: METRIC_CONFIG.found.name,    value: metrics.found             ?? 0, color: METRIC_CONFIG.found.color    },
			{ id: "notFound", name: METRIC_CONFIG.notFound.name, value: metrics.not_found         ?? 0, color: METRIC_CONFIG.notFound.color  },
			{ id: "passed",   name: METRIC_CONFIG.passed.name,   value: metrics.passed_validation ?? 0, color: METRIC_CONFIG.passed.color    },
			{ id: "failed",   name: METRIC_CONFIG.failed.name,   value: metrics.failed_validation ?? 0, color: METRIC_CONFIG.failed.color    },
			{ id: "pending",  name: METRIC_CONFIG.pending.name,  value: metrics.pending_hitl      ?? 0, color: METRIC_CONFIG.pending.color   },
		];
		return rawData.filter(
			(item) => activeMetrics[item.id as keyof typeof activeMetrics] && item.value > 0,
		);
	};

	const pieChartData    = getPieChartData();
	const displayMetrics  = metrics || {
		total_rows_ingested: 0, found: 0, not_found: 0,
		passed_validation: 0, failed_validation: 0,
		pending_hitl: 0, approved: 0, rejected: 0,
	};

	return (
		<div className="space-y-6">
			{/* HERO BANNER */}
			<div className="bg-white border border-gray-200 p-6 shadow-xs relative overflow-hidden">
				<div className="absolute top-0 right-0 p-4 opacity-5 text-primary pointer-events-none">
					<CloudLightning size={100} />
				</div>
				<div className="max-w-4xl">
					<h2 className="text-sm font-black text-primary uppercase tracking-wider flex items-center gap-2">
						Welcome back, {userDisplayName}.
					</h2>
					<p className="text-xs text-gray-600 mt-2 leading-relaxed">
						Your workspace is ready. Upload your account statements and aging
						report below, then start the matching process. The AI will
						automatically identify customers, match invoices, and flag anything
						that needs your attention - all in seconds!
					</p>
				</div>
			</div>

			{error && (
				<div className="bg-red-50/50 backdrop-blur-sm border-l-4 border-red-600 text-gray-900 px-4 py-3.5 shadow-sm text-sm flex items-center justify-between">
					<div className="flex items-center gap-3">
						<AlertTriangle size={18} className="text-red-600 shrink-0" />
						<span className="font-medium tracking-wide">{error}</span>
					</div>
					<button onClick={() => setError("")} className="text-gray-400 hover:text-gray-600 text-base px-2">×</button>
				</div>
			)}

			{/* UPLOAD SEGMENTS */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Aging Report Upload */}
				<div className="bg-white border border-gray-200 p-5 shadow-xs flex flex-col justify-between min-h-[180px]">
					<div>
						<h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2 mb-3">
							<Layers size={14} className="text-[#2E6DA4]" /> Aging Report
						</h3>
						{/* Hidden file input */}
						<input
							ref={agingInputRef}
							type="file"
							accept=".xlsx,.xls,.csv"
							className="hidden"
							onChange={handleAgingUpload}
						/>
						<button
							onClick={() => agingInputRef.current?.click()}
							disabled={agingUploading}
							className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 hover:border-primary text-primary py-3.5 px-4 text-[11px] font-bold uppercase tracking-wider bg-gray-50/50 hover:bg-gray-50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
						>
							<UploadCloud size={14} className="text-[#4A90E2]" />
							<span>{agingUploading ? "Uploading…" : "Upload From Local"}</span>
						</button>
					</div>
					<div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
						<span>Single XLS, CSV upload supported. Max 10 MB.</span>
						{agingStatus.loaded ? (
							<span className="text-[#4A90E2] font-bold flex items-center gap-1">
								<CheckCircle2 size={12} /> {agingStatus.row_count.toLocaleString()} rows active
							</span>
						) : (
							<span className="text-amber-600 font-medium">No file uploaded</span>
						)}
					</div>
				</div>

				{/* Account Statement Upload */}
				<div className="bg-white border border-gray-200 p-5 shadow-xs flex flex-col justify-between min-h-[180px]">
					<div>
						<h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2 mb-3">
							<FileText size={14} className="text-[#2E6DA4]" /> Account Statements
						</h3>
						{/* Hidden file input */}
						<input
							ref={statementInputRef}
							type="file"
							accept=".xlsx,.xls,.csv"
							className="hidden"
							onChange={handleStatementUpload}
						/>
						<button
							onClick={() => statementInputRef.current?.click()}
							disabled={statementUploading}
							className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 hover:border-primary text-primary py-3.5 px-4 text-[11px] font-bold uppercase tracking-wider bg-gray-50/50 hover:bg-gray-50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
						>
							<UploadCloud size={14} className="text-[#4A90E2]" />
							<span>{statementUploading ? "Uploading…" : "Upload From Local"}</span>
						</button>
					</div>
					<div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
						<span>Multiple XLS, CSV uploads supported. Max 10 MB per file.</span>
						<span className="text-primary font-bold">{files.length} statements loaded</span>
					</div>
				</div>
			</div>

			{/* CONTROL BAR */}
			<div className="bg-[#1E3A5F] text-white px-5 py-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 border border-[#172e4c]">
				<div className="flex items-center gap-3">
					<RefreshCw size={14} className={`text-[#4A90E2] ${isRunning ? "animate-spin" : ""}`} />
					<div className="text-xs font-medium text-gray-200">
						{agingStatus.loaded && files.length > 0 ? (
							<span className="text-white font-bold tracking-wide">Ready.</span>
						) : (
							<span className="text-gray-300">Upload an ageing report and at least one account statement to begin.</span>
						)}
					</div>
				</div>
				<button
					onClick={handleStart}
					disabled={isRunning || loading || files.length === 0 || !agingStatus.loaded}
					className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#4A90E2] hover:bg-[#357ABD] text-white px-6 py-2.5 font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-20 disabled:cursor-not-allowed shadow-xs whitespace-nowrap rounded-sm cursor-pointer"
				>
					<Play size={11} className="fill-current" />
					<span>Start Analysis</span>
					<ArrowRight size={12} className="ml-0.5" />
				</button>
			</div>

			{/* TELEMETRY LAYER */}
			<div className="bg-white border border-gray-200 p-6 shadow-xs space-y-6">
				{/* TIME PERIOD + HEADER */}
				<div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-gray-100">
					<div>
						<h2 className="text-xs font-black text-primary uppercase tracking-wider">Dashboard</h2>
						<p className="text-[11px] text-gray-500 mt-0.5">Overall summary for the selected period and applied filters.</p>
					</div>

					<div className="flex flex-wrap items-center gap-2 self-start xl:self-auto">
						<div className="flex items-center gap-1 bg-gray-100 p-1 rounded-sm">
							{["Last Analysis", "Today", "Yesterday", "WTD", "MTD", "Custom Date"].map((period) => (
								<button
									key={period}
									onClick={() => handleTimePeriodSelect(period)}
									className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-xs transition-all cursor-pointer ${
										timePeriod === period ? "bg-[#1E3A5F] text-white shadow-xs" : "text-gray-500 hover:text-primary"
									}`}
								>
									{period}
								</button>
							))}
						</div>

						{isCustomDateActive && (
							<div className="flex items-center gap-1.5 animate-slide-in border-l border-gray-200 pl-2 mt-2 sm:mt-0">
								<input
									type="date"
									value={customStartDate}
									onChange={(e) => { const v = e.target.value; setCustomStartDate(v); if (customEndDate)   doFetchMetrics("Custom Date", v, customEndDate); }}
									className="bg-gray-50 border border-gray-300 rounded-sm text-[10px] font-bold uppercase text-gray-600 px-2 py-1 outline-none focus:border-accent"
								/>
								<span className="text-[10px] font-bold text-gray-400">TO</span>
								<input
									type="date"
									value={customEndDate}
									onChange={(e) => { const v = e.target.value; setCustomEndDate(v);   if (customStartDate) doFetchMetrics("Custom Date", customStartDate, v); }}
									className="bg-gray-50 border border-gray-300 rounded-sm text-[10px] font-bold uppercase text-gray-600 px-2 py-1 outline-none focus:border-accent"
								/>
							</div>
						)}
					</div>
				</div>

				{/* FILTER DROPDOWNS — populated from /api/filters/options */}
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
					<div className="relative">
						<Landmark size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
						<select
							value={selectedBank}
							onChange={(e) => setSelectedBank(e.target.value)}
							className="w-full bg-white border border-gray-300 text-xs font-bold text-primary pl-9 pr-8 py-2.5 rounded-sm appearance-none focus:outline-none focus:border-accent cursor-pointer"
						>
							<option>All Banks</option>
							{bankOptions.map((b) => <option key={b}>{b}</option>)}
						</select>
						<ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
					</div>

					<div className="relative">
						<Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
						<select
							value={selectedBU}
							onChange={(e) => setSelectedBU(e.target.value)}
							className="w-full bg-white border border-gray-300 text-xs font-bold text-primary pl-9 pr-8 py-2.5 rounded-sm appearance-none focus:outline-none focus:border-accent cursor-pointer"
						>
							<option>All BUs</option>
							{buOptions.map((bu) => <option key={bu}>{bu}</option>)}
						</select>
						<ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
					</div>

					<div className="relative">
						<User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
						<select
							value={selectedUser}
							onChange={(e) => setSelectedUser(e.target.value)}
							className="w-full bg-white border border-gray-300 text-xs font-bold text-primary pl-9 pr-8 py-2.5 rounded-sm appearance-none focus:outline-none focus:border-accent cursor-pointer"
						>
							<option>All Users</option>
							{userOptions.map((u) => <option key={u}>{u}</option>)}
						</select>
						<ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
					</div>
				</div>

				{/* KPI CARDS */}
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
					<div className="border border-gray-200 p-4 rounded-sm bg-gray-50/30">
						<div className="flex items-center gap-1.5 text-gray-400 mb-1">
							<Layers size={13} className="text-[#1E3A5F]" />
							<span className="text-[10px] font-bold uppercase tracking-wider">Total Rows Ingested</span>
						</div>
						<div className="text-xl font-black text-primary">{(displayMetrics.total_rows_ingested ?? 0).toLocaleString()}</div>
						<div className="mt-2 pt-1.5 text-[10px] text-gray-400 font-medium leading-normal">Transaction(s) read</div>
					</div>

					<div className="border border-gray-200 p-4 rounded-sm bg-gray-50/30">
						<div className="flex items-center gap-1.5 text-gray-400 mb-1">
							<Sparkles size={13} className="text-[#1E3A5F]" />
							<span className="text-[10px] font-bold uppercase tracking-wider">{METRIC_CONFIG.found.name}</span>
						</div>
						<div className="text-xl font-black text-primary">{(displayMetrics.found ?? 0).toLocaleString()}</div>
						<div className="mt-2 pt-1.5 text-[10px] text-gray-400 font-medium leading-normal">Customer(s) and invoice(s) identified</div>
					</div>

					<div className="border border-gray-200 p-4 rounded-sm bg-gray-50/30">
						<div className="flex items-center gap-1.5 text-gray-400 mb-1">
							<AlertTriangle size={13} className="text-[#2E6DA4]" />
							<span className="text-[10px] font-bold uppercase tracking-wider">{METRIC_CONFIG.notFound.name}</span>
						</div>
						<div className="text-xl font-black text-primary">{(displayMetrics.not_found ?? 0).toLocaleString()}</div>
						<div className="mt-2 pt-1.5 text-[10px] text-gray-400 font-medium leading-normal">Needs manual review</div>
					</div>

					<div className="border border-gray-200 p-4 rounded-sm bg-gray-50/30">
						<div className="flex items-center gap-1.5 text-gray-400 mb-1">
							<ShieldCheck size={13} className="text-[#4A90E2]" />
							<span className="text-[10px] font-bold uppercase tracking-wider">{METRIC_CONFIG.passed.name}</span>
						</div>
						<div className="text-xl font-black text-primary">{(displayMetrics.passed_validation ?? 0).toLocaleString()}</div>
						<div className="mt-2 pt-1.5 text-[10px] text-gray-400 font-medium leading-normal">Amount and currency match</div>
					</div>

					<div className="border border-gray-200 p-4 rounded-sm bg-gray-50/30">
						<div className="flex items-center gap-1.5 text-gray-400 mb-1">
							<Ban size={13} className="text-[#e11d48]" />
							<span className="text-[10px] font-bold uppercase tracking-wider">{METRIC_CONFIG.failed.name}</span>
						</div>
						<div className="text-xl font-black text-primary">{(displayMetrics.failed_validation ?? 0).toLocaleString()}</div>
						<div className="mt-2 pt-1.5 text-[10px] text-gray-400 font-medium leading-normal">Amount and currency mismatch</div>
					</div>

					<div className="border border-gray-200 p-4 rounded-sm bg-gray-50/30">
						<div className="flex items-center gap-1.5 text-gray-400 mb-1">
							<Calendar size={13} className="text-[#f59e0b]" />
							<span className="text-[10px] font-bold uppercase tracking-wider">{METRIC_CONFIG.pending.name}</span>
						</div>
						<div className="text-xl font-black text-primary">{(displayMetrics.pending_hitl ?? 0).toLocaleString()}</div>
						<div className="mt-2 pt-1.5 text-[10px] text-gray-400 font-medium leading-normal">Awaiting SPOC review</div>
					</div>

					<div className="border border-gray-200 p-4 rounded-sm bg-gray-50/30">
						<div className="flex items-center gap-1.5 text-emerald-600 mb-1">
							<ClipboardCheck size={13} className="text-emerald-600" />
							<span className="text-[10px] font-bold uppercase tracking-wider">Approved</span>
						</div>
						<div className="text-xl font-black text-primary">{(displayMetrics.approved ?? 0).toLocaleString()}</div>
						<div className="mt-2 pt-1.5 text-[10px] text-gray-400 font-medium leading-normal">Posted to Oracle Fusion</div>
					</div>

					<div className="border border-gray-200 p-4 rounded-sm bg-gray-50/30">
						<div className="flex items-center gap-1.5 text-red-400 mb-1">
							<Ban size={13} className="text-red-500" />
							<span className="text-[10px] font-bold uppercase tracking-wider">Rejected</span>
						</div>
						<div className="text-xl font-black text-primary">{(displayMetrics.rejected ?? 0).toLocaleString()}</div>
						<div className="mt-2 pt-1.5 text-[10px] text-gray-400 font-medium leading-normal">Rejected by SPOC</div>
					</div>
				</div>

				<hr className="border-gray-200" />

				{/* PIE CHART */}
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-2">
					<div className="lg:col-span-5 space-y-4">
						<div>
							<h4 className="text-xs font-black text-primary uppercase tracking-wider">Select Metrics to Display</h4>
							<p className="text-[11px] text-gray-500 mt-0.5">Toggle variables below to dynamically alter chart distribution views.</p>
						</div>

						<div className="flex flex-wrap gap-2 pt-1">
							{(Object.keys(METRIC_CONFIG) as Array<keyof typeof METRIC_CONFIG>).map((key) => {
								const cfg    = METRIC_CONFIG[key];
								const active = activeMetrics[key];
								const val    = key === "found"    ? (displayMetrics.found             ?? 0)
								             : key === "notFound" ? (displayMetrics.not_found         ?? 0)
								             : key === "passed"   ? (displayMetrics.passed_validation ?? 0)
								             : key === "failed"   ? (displayMetrics.failed_validation ?? 0)
								             :                      (displayMetrics.pending_hitl      ?? 0);
								return (
									<button
										key={key}
										type="button"
										onClick={() => toggleMetricVisibility(key)}
										className={`flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-bold transition-all shadow-xs cursor-pointer ${
											active ? "text-primary" : "border-gray-200 bg-white text-gray-400 hover:border-gray-300"
										}`}
										style={{ borderColor: active ? cfg.color : "" }}
									>
										<span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: active ? cfg.color : "#d1d5db" }} />
										<span>{cfg.name}</span>
										<span
											className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold ${active ? "text-white" : "bg-gray-100 text-gray-400"}`}
											style={{ backgroundColor: active ? cfg.color : "" }}
										>
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

						{pieChartData.length > 0 ? (
							<div className="w-full h-[240px]">
								<ResponsiveContainer width="100%" height="100%">
									<PieChart>
										<Pie data={pieChartData} cx="50%" cy="48%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
											{pieChartData.map((entry, index) => (
												<Cell key={`cell-${index}`} fill={entry.color} />
											))}
										</Pie>
										<Tooltip
											contentStyle={{ backgroundColor: "#1E3A5F", borderColor: "#172e4c", borderRadius: "2px" }}
											itemStyle={{ color: "#ffffff", fontSize: "12px" }}
										/>
										<Legend verticalAlign="bottom" align="center" iconType="rect" iconSize={10}
											wrapperStyle={{ fontSize: "11px", fontWeight: 600, paddingTop: "10px" }} />
									</PieChart>
								</ResponsiveContainer>
							</div>
						) : (
							<div className="text-xs text-gray-400 font-medium text-center py-12">
								No active metrics selected to populate distribution share.
							</div>
						)}
					</div>
				</div>

				<hr className="border-gray-200" />

				{/* AI RUN DETAILS — static, no backend endpoint */}
				<div className="space-y-4 pt-1">
					<div>
						<h4 className="text-xs font-black text-primary uppercase tracking-wider">AI Run Details</h4>
						<p className="text-[11px] text-gray-500 mt-0.5">AI run details framework data specifications.</p>
					</div>
					<div className="grid grid-cols-2 sm:grid-cols-3 gap-y-5 gap-x-6">
						<div className="space-y-0.5">
							<span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Model</span>
							<span className="text-xs font-bold text-primary">Claude Sonnet 4</span>
						</div>
						<div className="space-y-0.5">
							<span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Prompt Version</span>
							<span className="text-xs font-bold text-primary">v2.1</span>
						</div>
						<div className="space-y-0.5">
							<span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Tokens In</span>
							<span className="text-xs font-bold text-primary">42,800</span>
						</div>
						<div className="space-y-0.5">
							<span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Tokens Out</span>
							<span className="text-xs font-bold text-primary">8,140</span>
						</div>
						<div className="space-y-0.5">
							<span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Estimated Cost</span>
							<span className="text-xs font-bold text-emerald-600">$0.18</span>
						</div>
						<div className="space-y-0.5">
							<span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Latency</span>
							<span className="text-xs font-bold text-primary">34.2 sec</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}