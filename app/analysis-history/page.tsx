"use client";
import {
	AlertTriangle,
	ArrowLeft,
	Briefcase,
	Calendar,
	Check,
	CheckSquare,
	ChevronDown,
	Download,
	Eye,
	FileText,
	Landmark,
	Layers,
	Loader2,
	RefreshCw,
	Search,
	ShieldCheck,
	Sparkles,
	User,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import BreakupModal from "@/components/BreakupModal";
import {
	getRunHistory,
	getRunSummary,
	approveEntry,
	rejectEntry,
	getFilterOptions,
	getFilePreview,
	retryOracle,
	getBreakupAnalysis,
} from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnalysisRun {
	run_id: number;
	started_at: string;
	completed_at: string;
	status: string;
	selected_files: string[];
	bank_names: string[];
	business_units: string[];
	total_credit_rows: number;
	total_matched: number;
	total_not_found: number;
	passed_validation: number;
	failed_validation: number;
	pending_hitl: number;
	approved: number;
	rejected: number;
	posted_to_oracle: number;
	total_credit_amount: number;
	match_rate_pct: number;
	triggered_by: string;
}

interface RunMetrics {
	total_rows:   number;
	matched:      number;
	not_found:    number;
	passed_val:   number;
	failed_val:   number;
	pending_hitl: number;
	review:       number;
	approved:     number;
	rejected:     number;
	processed:    number;
}

interface LineItem {
	id: number;
	run_id: number;
	bank_name: string;
	business_unit: string;
	statement_date: string;
	narrative: string;
	credit_amount: number;
	statement_currency: string;
	extracted_customer_name: string;
	extracted_invoice_number: string;
	extraction_method: string;
	confidence_score: number;
	matched_customer_name: string;
	matched_invoice_number: string;
	outstanding_amount: number;
	invoice_currency: string;
	validation_status: string;
	failed_rules: string;
	hitl_status: string;
	oracle_transaction_ref: string | null;
	oracle_post_status: string | null;
	oracle_post_message: string | null;
	remittance_status: string | null;
	tds_pct_computed: number | null;
	_source: "matched" | "not_found";
}

interface FilePreview {
	filename:   string;
	total_rows: number;
	columns:    string[];
	rows:       string[][];
}

type TabKey = "all" | "matched" | "not_found" | "review_approve" | "processed";

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildHistoryDateRange(period: string, cStart: string, cEnd: string) {
	const pad = (n: number) => String(n).padStart(2, "0");
	const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
	const now = new Date(); const today = fmt(now);
	if (period === "Today")     return { date_from: today, date_to: today };
	if (period === "Yesterday") { const y = new Date(now); y.setDate(y.getDate()-1); const ys = fmt(y); return { date_from: ys, date_to: ys }; }
	if (period === "WTD")       { const m = new Date(now); m.setDate(now.getDate()-((now.getDay()+6)%7)); return { date_from: fmt(m), date_to: today }; }
	if (period === "MTD")       { return { date_from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), date_to: today }; }
	if (period === "Custom Range") { return { date_from: cStart || undefined, date_to: cEnd || undefined }; }
	return {};
}

// ── File Preview Panel ────────────────────────────────────────────────────────

function FilePreviewPanel({ filename, bucket = "active" }: { filename: string; bucket?: string }) {
	const [preview, setPreview] = useState<FilePreview | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError]     = useState("");
	const [filter, setFilter]   = useState("");

	useEffect(() => {
		if (!filename) return;
		let cancelled = false;
		setLoading(true); setError(""); setPreview(null);
		getFilePreview(filename, bucket, 200)
			.then((res) => { if (!cancelled) setPreview(res.data); })
			.catch(() => { if (!cancelled) setError("Could not load file preview."); })
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, [filename, bucket]);

	const filteredRows = useMemo(() => {
		if (!preview || !filter) return preview?.rows ?? [];
		const q = filter.toLowerCase();
		return preview.rows.filter((row) => row.some((cell) => cell.toLowerCase().includes(q)));
	}, [preview, filter]);

	if (loading) return (
		<div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400 min-h-[320px]">
			<Loader2 size={28} className="animate-spin" />
			<span className="text-xs font-bold uppercase tracking-wider">Loading preview…</span>
		</div>
	);
	if (error) return (
		<div className="flex-1 flex flex-col items-center justify-center gap-3 text-red-400 min-h-[320px]">
			<AlertTriangle size={28} /><span className="text-xs font-bold">{error}</span>
		</div>
	);
	if (!preview) return (
		<div className="flex-1 flex flex-col items-center justify-center text-gray-300 min-h-[320px]">
			<FileText size={48} className="mb-3 stroke-[1.25]" />
			<span className="text-xs font-black text-gray-400 uppercase tracking-wider">No Preview</span>
		</div>
	);

	return (
		<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
			<div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex-shrink-0">
				<div className="flex items-center gap-2 min-w-0">
					<FileText size={13} className="text-[#2E6DA4] shrink-0" />
					<span className="text-[10px] font-black text-primary uppercase tracking-wider truncate">{filename}</span>
					<span className="text-[10px] text-gray-400 font-mono shrink-0">{preview.total_rows} rows · {preview.columns.length} cols</span>
				</div>
				<div className="relative shrink-0">
					<Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
					<input type="text" placeholder="Filter rows…" value={filter} onChange={(e) => setFilter(e.target.value)}
						className="bg-white border border-gray-300 rounded-xs text-[10px] font-medium pl-6 pr-2.5 py-1 w-44 outline-none focus:border-[#4A90E2]" />
				</div>
			</div>
			<div className="flex-1 overflow-auto">
				<table className="w-full text-left border-collapse text-[10px]" style={{ minWidth: `${preview.columns.length * 110}px` }}>
					<thead className="sticky top-0 z-10">
						<tr className="bg-[#1E3A5F] text-white">
							<th className="px-2 py-2 text-[9px] font-black uppercase tracking-wider text-gray-400 w-10 text-center bg-[#1E3A5F]">#</th>
							{preview.columns.map((col) => (
								<th key={col} className="px-2.5 py-2 text-[9px] font-black uppercase tracking-wider whitespace-nowrap bg-[#1E3A5F]">{col}</th>
							))}
						</tr>
					</thead>
					<tbody className="divide-y divide-gray-100 bg-white">
						{filteredRows.length === 0 && (
							<tr><td colSpan={preview.columns.length + 1} className="text-center py-10 text-[11px] text-gray-400 font-medium">No rows match filter.</td></tr>
						)}
						{filteredRows.map((row, ri) => (
							<tr key={ri} className="hover:bg-blue-50/30 transition-colors">
								<td className="px-2 py-1.5 text-gray-400 font-mono text-center">{ri + 1}</td>
								{row.map((cell, ci) => (
									<td key={ci} className="px-2.5 py-1.5 font-mono text-gray-700 max-w-[200px] truncate" title={cell}>
										{cell || <span className="text-gray-300">—</span>}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			{filter && (
				<div className="px-4 py-1.5 bg-gray-50 border-t border-gray-200 text-[10px] text-gray-400 font-medium flex-shrink-0">
					Showing {filteredRows.length} of {preview.total_rows} rows{preview.total_rows === 200 && " (preview capped at 200 rows)"}
				</div>
			)}
			{!filter && preview.total_rows === 200 && (
				<div className="px-4 py-1.5 bg-amber-50 border-t border-amber-100 text-[10px] text-amber-700 font-bold flex-shrink-0">
					Preview capped at 200 rows. Full file may contain more data.
				</div>
			)}
		</div>
	);
}

// ── Oracle Detail Drawer ──────────────────────────────────────────────────────

function OracleDetailDrawer({
	line,
	onClose,
	onRetrySuccess,
}: {
	line: LineItem;
	onClose: () => void;
	onRetrySuccess: () => void;
}) {
	const [retrying, setRetrying]       = useState(false);
	const [retryResult, setRetryResult] = useState<{ success: boolean; message: string } | null>(null);

	const handleRetry = async () => {
		setRetrying(true);
		setRetryResult(null);
		try {
			const res = await retryOracle(line.id);
			setRetryResult({ success: true, message: res.data.oracle_post_message || "Retry successful" });
			onRetrySuccess();
		} catch (e: any) {
			setRetryResult({ success: false, message: e?.response?.data?.detail || "Retry failed" });
		}
		setRetrying(false);
	};

	const isSuccess = line.oracle_post_status === "success";
	const isFailed  = line.oracle_post_status === "failed";

	return (
		<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
			<div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
			<div className="relative bg-white w-full max-w-2xl max-h-[90vh] rounded-t-lg sm:rounded-lg shadow-2xl flex flex-col overflow-hidden">
				<div className="bg-[#1E3A5F] text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
					<div>
						<h2 className="text-sm font-black uppercase tracking-wider">Oracle Fusion — Post Detail</h2>
						<p className="text-[10px] text-gray-300 font-mono mt-0.5">Row ID {line.id} · {line.matched_invoice_number}</p>
					</div>
					<button onClick={onClose} className="hover:bg-white/10 p-1.5 rounded-sm transition-colors cursor-pointer">
						<X size={16} />
					</button>
				</div>
				<div className="flex-1 overflow-y-auto p-6 space-y-5">
					<div className={`flex items-center gap-3 px-4 py-3 rounded-sm border text-sm font-bold ${
						isSuccess ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
						isFailed  ? "bg-red-50 border-red-200 text-red-700" :
						            "bg-amber-50 border-amber-200 text-amber-700"
					}`}>
						{isSuccess ? <Check size={18} className="stroke-[3] shrink-0" /> :
						 isFailed  ? <AlertTriangle size={18} className="shrink-0" /> :
						             <Loader2 size={18} className="shrink-0" />}
						<div className="min-w-0">
							<div className="uppercase tracking-wider text-[11px]">
								{isSuccess ? "Successfully posted to Oracle Fusion" :
								 isFailed  ? "Oracle post failed" : "Pending"}
							</div>
							{line.oracle_post_message && (
								<div className="text-[10px] font-mono font-normal mt-0.5 break-all">{line.oracle_post_message}</div>
							)}
						</div>
					</div>
					{isSuccess && line.oracle_transaction_ref && (
						<div className="bg-gray-50 border border-gray-200 rounded-sm p-4 space-y-2">
							<div className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-2">Oracle Receipt</div>
							{[
								["Receipt Number", line.oracle_transaction_ref],
								["Invoice",        line.matched_invoice_number],
								["Amount Posted",  `${(line.credit_amount||0).toLocaleString(undefined,{minimumFractionDigits:2})} ${line.statement_currency}`],
								["Customer",       line.matched_customer_name],
								["Business Unit",  line.business_unit],
							].map(([label, value]) => (
								<div key={label} className="flex justify-between text-[11px]">
									<span className="text-gray-400 font-bold">{label}</span>
									<span className="font-mono font-bold text-primary">{value}</span>
								</div>
							))}
						</div>
					)}
					<div className="bg-gray-50 border border-gray-200 rounded-sm p-4 space-y-2">
						<div className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-2">Transaction Data</div>
						{[
							["Bank",        line.bank_name],
							["Date",        line.statement_date],
							["Narrative",   line.narrative],
							["Credit",      `${(line.credit_amount||0).toLocaleString(undefined,{minimumFractionDigits:2})} ${line.statement_currency}`],
							["Customer",    line.matched_customer_name],
							["Invoice",     line.matched_invoice_number],
							["Outstanding", `${(line.outstanding_amount||0).toLocaleString(undefined,{minimumFractionDigits:2})} ${line.invoice_currency}`],
							["BU",          line.business_unit],
							["Extraction",  line.extraction_method],
						].map(([label, value]) => (
							<div key={label} className="flex justify-between gap-4 text-[11px] border-b border-gray-100 pb-1.5 last:border-0 last:pb-0">
								<span className="text-gray-400 font-bold shrink-0">{label}</span>
								<span className="font-mono text-primary text-right break-all">{value || "—"}</span>
							</div>
						))}
					</div>
					{retryResult && (
						<div className={`flex items-start gap-3 px-4 py-3 rounded-sm border text-[11px] font-bold ${
							retryResult.success ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"
						}`}>
							{retryResult.success ? <Check size={14} className="stroke-[3] shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="shrink-0 mt-0.5" />}
							<span className="break-all">{retryResult.message}</span>
						</div>
					)}
				</div>
				<div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
					<button onClick={onClose} className="text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-primary transition-colors cursor-pointer">
						Close
					</button>
					{isFailed && (
						<button onClick={handleRetry} disabled={retrying}
							className="flex items-center gap-2 bg-[#1E3A5F] hover:bg-[#2E6DA4] text-white px-5 py-2 text-[10px] font-black uppercase tracking-wider rounded-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs">
							{retrying ? <><Loader2 size={12} className="animate-spin" /> Retrying…</> : <><RefreshCw size={12} /> Retry Post to Oracle</>}
						</button>
					)}
				</div>
			</div>
		</div>
	);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AnalysisHistoryPage() {
	const router = useRouter();
	const [viewingRun, setViewingRun] = useState<AnalysisRun | null>(null);
	const [userDisplayName, setUserDisplayName] = useState("Admin User");

	// History list state
	const [timePeriod, setTimePeriod]               = useState("Latest");
	const [isCustomRangeActive, setIsCustomRangeActive] = useState(false);
	const [customStart, setCustomStart]             = useState("");
	const [customEnd, setCustomEnd]                 = useState("");
	const [selectedBank, setSelectedBank]           = useState("All Banks");
	const [selectedBU, setSelectedBU]               = useState("All BUs");
	const [searchUser, setSearchUser]               = useState("");
	const [bankOptions, setBankOptions]             = useState<string[]>([]);
	const [buOptions, setBuOptions]                 = useState<string[]>([]);
	const [runs, setRuns]                           = useState<AnalysisRun[]>([]);
	const [loading, setLoading]                     = useState(false);

	// Detail view state
	const [activeTab, setActiveTab]                 = useState<TabKey>("all");
	const [searchNarrative, setSearchNarrative]     = useState("");
	const [runMetrics, setRunMetrics]               = useState<RunMetrics | null>(null);
	const [tabData, setTabData]                     = useState<Record<string, { count: number; rows: LineItem[] }>>({});
	const [allRows, setAllRows]                     = useState<LineItem[]>([]);
	const [selectedLines, setSelectedLines]         = useState<Record<number, boolean>>({});
	const [actionLoading, setActionLoading]         = useState<Record<number, boolean>>({});

	// File preview state
	const [previewFile, setPreviewFile]             = useState<string>("");

	// Oracle detail drawer state
	const [oracleDrawerLine, setOracleDrawerLine]   = useState<LineItem | null>(null);

	// Breakup modal state
	const [breakupLine, setBreakupLine]             = useState<LineItem | null>(null);
	const [breakupAnalysis, setBreakupAnalysis]     = useState<any>(null);
	const [breakupPosting, setBreakupPosting]       = useState(false);

	// Per-row inline error messages (keyed by line.id, auto-clear after 6s)
	const [rowErrors, setRowErrors]                 = useState<Record<number, string>>({});

	const setRowError = (id: number, msg: string) => {
		setRowErrors((p) => ({ ...p, [id]: msg }));
		setTimeout(() => setRowErrors((p) => { const n = { ...p }; delete n[id]; return n; }), 6000);
	};

	useEffect(() => {
		const m = document.cookie.match(/(?:^|; )login_user_email_stub=([^;]*)/);
		if (m?.[1]) setUserDisplayName(decodeURIComponent(m[1]).split("@")[0]);
	}, []);

	// ── Fetch run list ─────────────────────────────────────────────────────────

	const doLoadRuns = useCallback(async (period: string, cStart: string, cEnd: string) => {
		if (period === "Custom Range" && (!cStart || !cEnd)) return;
		setLoading(true);
		try {
			const pageSize = period === "Latest" ? 5 : 50;
			const dr = buildHistoryDateRange(period, cStart, cEnd);
			const [runsRes, filtersRes] = await Promise.all([
				getRunHistory(1, pageSize, (dr as any).date_from, (dr as any).date_to),
				getFilterOptions(),
			]);
			setRuns(runsRes.data.data || []);
			setBankOptions(filtersRes.data.banks || []);
			setBuOptions(filtersRes.data.business_units || []);
		} catch {}
		setLoading(false);
	}, []);

	useEffect(() => {
		if (timePeriod === "Custom Range") return;
		doLoadRuns(timePeriod, customStart, customEnd);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [timePeriod]);

	useEffect(() => { doLoadRuns("Latest", "", ""); }, [doLoadRuns]);

	// ── Fetch run detail ───────────────────────────────────────────────────────

	const loadRunDetail = useCallback(async (run: AnalysisRun) => {
		setLoading(true);
		setRunMetrics(null);
		setTabData({});
		setAllRows([]);
		setActiveTab("all");
		setSearchNarrative("");
		setPreviewFile((run.selected_files || [])[0] || "");
		try {
			const res  = await getRunSummary(run.run_id);
			const data = res.data;
			setRunMetrics(data.metrics);
			setTabData(data.tabs);
			const all = [
				...(data.tabs.matched?.rows || []),
				...(data.tabs.not_found?.rows || []),
			];
			setAllRows(all);
		} catch {}
		setLoading(false);
	}, []);

	// ── HITL actions ───────────────────────────────────────────────────────────

	const handleApprove = async (item: LineItem) => {
		if (item._source !== "matched") return;
		setActionLoading((p) => ({ ...p, [item.id]: true }));
		try {
			// Check if breakup modal is needed for multi-invoice rows
			const baRes = await getBreakupAnalysis(item.id);
			const ba    = baRes.data;
			if (ba.needs_breakup) {
				setBreakupAnalysis(ba);
				setBreakupLine(item);
				setActionLoading((p) => ({ ...p, [item.id]: false }));
				return;
			}
			// No breakup needed — auto invoice_breakup from analysis
			const breakup = ba.invoices?.length > 1
				? ba.invoices.map((inv: any) => ({
						invoice_number:   inv.invoice_number,
						reference_amount: inv.suggested_reference_amount ?? 0,
				  }))
				: undefined;
			await approveEntry(item.id, undefined, breakup);
			if (viewingRun) await loadRunDetail(viewingRun);
		} catch (e: any) {
			setRowError(item.id, e?.response?.data?.detail || "Approve failed. Please try again.");
		}
		setActionLoading((p) => ({ ...p, [item.id]: false }));
	};

	// Called from BreakupModal when SPOC confirms amounts
	const handleBreakupConfirm = async (breakup: { invoice_number: string; reference_amount: number }[]) => {
		if (!breakupLine) return;
		setBreakupPosting(true);
		try {
			await approveEntry(breakupLine.id, undefined, breakup);
			setBreakupLine(null);
			setBreakupAnalysis(null);
			if (viewingRun) await loadRunDetail(viewingRun);
		} catch (e: any) {
			setRowError(breakupLine.id, e?.response?.data?.detail || "Approve failed.");
			setBreakupLine(null);
			setBreakupAnalysis(null);
		}
		setBreakupPosting(false);
	};

	const handleReject = async (item: LineItem) => {
		if (item._source !== "matched") return;
		setActionLoading((p) => ({ ...p, [item.id]: true }));
		try {
			await rejectEntry(item.id);
			if (viewingRun) await loadRunDetail(viewingRun);
		} catch (e: any) {
			setRowError(item.id, e?.response?.data?.detail || "Reject failed. Please try again.");
		}
		setActionLoading((p) => ({ ...p, [item.id]: false }));
	};

	const handleTimePeriodSelect = (period: string) => {
		setTimePeriod(period);
		setIsCustomRangeActive(period === "Custom Range");
	};

	const handleViewRun = (run: AnalysisRun) => {
		setViewingRun(run);
		setSelectedLines({});
		loadRunDetail(run);
	};

	// ── Filtered rows ──────────────────────────────────────────────────────────

	const activeRows: LineItem[] = useMemo(() => {
		let rows: LineItem[] = [];
		if (activeTab === "all")            rows = allRows;
		else if (activeTab === "matched")   rows = tabData.matched?.rows || [];
		else if (activeTab === "not_found") rows = tabData.not_found?.rows || [];
		else if (activeTab === "review_approve") rows = tabData.review_approve?.rows || [];
		else if (activeTab === "processed") rows = tabData.processed?.rows || [];

		if (!searchNarrative) return rows;
		const q = searchNarrative.toLowerCase();
		return rows.filter((l) =>
			l.narrative?.toLowerCase().includes(q) || String(l.id).includes(q)
		);
	}, [activeTab, allRows, tabData, searchNarrative]);

	const filteredRuns = useMemo(() => runs.filter((r) => {
		const matchBank = selectedBank === "All Banks" || (r.bank_names||[]).includes(selectedBank);
		const matchBU   = selectedBU   === "All BUs"   || (r.business_units||[]).includes(selectedBU);
		const matchUser = !searchUser  || (r.triggered_by||"").toLowerCase().includes(searchUser.toLowerCase());
		return matchBank && matchBU && matchUser;
	}), [runs, selectedBank, selectedBU, searchUser]);

	// ── Exports ────────────────────────────────────────────────────────────────

	const exportHistoryMasterCSV = () => {
		if (!runs.length) return;
		const h = Object.keys(runs[0]).join(",");
		const r = runs.map((r) => Object.values(r).map((v) => `"${v??""}`).join(",")).join("\n");
		const blob = new Blob([h+"\n"+r],{type:"text/csv"});
		const a = document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="analysis_history_master.csv"; a.click();
	};

	const exportDetailCSV = () => {
		if (!activeRows.length) return;
		const h = Object.keys(activeRows[0]).join(",");
		const r = activeRows.map((l) => Object.values(l).map((v) => `"${v??""}`).join(",")).join("\n");
		const blob = new Blob([h+"\n"+r],{type:"text/csv"});
		const a = document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`run_${viewingRun?.run_id}_${activeTab}.csv`; a.click();
	};

	const toggleSelectAll = () => {
		if (Object.keys(selectedLines).length === activeRows.length) { setSelectedLines({}); return; }
		const all: Record<number,boolean> = {};
		activeRows.forEach((l) => (all[l.id] = true));
		setSelectedLines(all);
	};

	const formatDate = (iso: string) => { try { return new Date(iso).toLocaleString(); } catch { return iso; } };

	// ── TAB CONFIG ─────────────────────────────────────────────────────────────

	const TABS: { key: TabKey; label: string; count: number; color: string }[] = [
		{ key: "all",            label: "All",               count: (runMetrics?.matched||0)+(runMetrics?.not_found||0), color: "text-primary" },
		{ key: "matched",        label: "Matched",           count: runMetrics?.matched      || 0, color: "text-emerald-600" },
		{ key: "not_found",      label: "Not found",         count: runMetrics?.not_found    || 0, color: "text-red-500"     },
		{ key: "review_approve", label: "Review and approve",count: runMetrics?.review       || 0, color: "text-amber-600"  },
		{ key: "processed",      label: "Processed",         count: runMetrics?.processed    || 0, color: "text-[#4A90E2]"  },
	];

	// ==========================================================================
	// ROUTE 1 — History list
	// ==========================================================================

	if (!viewingRun) {
		return (
			<div className="space-y-6">
				<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2">
					<div>
						<h1 className="text-xl font-black text-primary uppercase tracking-wider">Analysis History</h1>
						<p className="text-xs text-gray-500 mt-0.5">
							{timePeriod === "Latest" ? "Showing last 5 runs" : `Runs for: ${timePeriod}`}
						</p>
					</div>
					<button onClick={exportHistoryMasterCSV}
						className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider bg-[#1E3A5F] hover:bg-[#2E6DA4] text-white px-4 py-2.5 rounded-sm shadow-xs transition-colors cursor-pointer">
						<Download size={13} /> Export History Master
					</button>
				</div>

				<div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 p-2 rounded-sm shadow-2xs">
					<div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xs">
						{["Latest","Today","Yesterday","WTD","MTD","Custom Range"].map((period) => (
							<button key={period} onClick={() => handleTimePeriodSelect(period)}
								className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-xs transition-all cursor-pointer ${timePeriod===period ? "bg-[#1E3A5F] text-white shadow-xs" : "text-gray-500 hover:text-primary"}`}>
								{period}
							</button>
						))}
					</div>
					{isCustomRangeActive && (
						<div className="flex items-center gap-1.5 border-l border-gray-200 pl-3">
							<input type="date" value={customStart}
								onChange={(e) => { const v=e.target.value; setCustomStart(v); if(customEnd) doLoadRuns("Custom Range",v,customEnd); }}
								className="bg-gray-50 border border-gray-300 rounded-sm text-[10px] font-bold text-gray-600 px-2 py-1 outline-none focus:border-[#4A90E2]" />
							<span className="text-[10px] font-bold text-gray-400">TO</span>
							<input type="date" value={customEnd}
								onChange={(e) => { const v=e.target.value; setCustomEnd(v); if(customStart) doLoadRuns("Custom Range",customStart,v); }}
								className="bg-gray-50 border border-gray-300 rounded-sm text-[10px] font-bold text-gray-600 px-2 py-1 outline-none focus:border-[#4A90E2]" />
						</div>
					)}
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
					<div className="relative">
						<Landmark size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
						<select value={selectedBank} onChange={(e) => setSelectedBank(e.target.value)}
							className="w-full bg-white border border-gray-300 text-xs font-bold text-primary pl-9 pr-8 py-2.5 rounded-sm appearance-none focus:outline-none focus:border-[#4A90E2] cursor-pointer">
							<option>All Banks</option>{bankOptions.map((b) => <option key={b}>{b}</option>)}
						</select>
						<ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
					</div>
					<div className="relative">
						<Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
						<select value={selectedBU} onChange={(e) => setSelectedBU(e.target.value)}
							className="w-full bg-white border border-gray-300 text-xs font-bold text-primary pl-9 pr-8 py-2.5 rounded-sm appearance-none focus:outline-none focus:border-[#4A90E2] cursor-pointer">
							<option>All BUs</option>{buOptions.map((b) => <option key={b}>{b}</option>)}
						</select>
						<ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
					</div>
					<div className="relative">
						<User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
						<input type="text" placeholder="Search by user..." value={searchUser} onChange={(e) => setSearchUser(e.target.value)}
							className="w-full bg-white border border-gray-300 text-xs font-semibold text-primary pl-9 pr-4 py-2.5 rounded-sm focus:outline-none focus:border-[#4A90E2]" />
					</div>
				</div>

				<div className="bg-white border border-gray-200 rounded-sm shadow-xs flex flex-col h-[520px]">
					<div className="flex-1 overflow-auto relative">
						<table className="w-full text-left border-collapse min-w-[1100px]">
							<thead className="sticky top-0 z-20 shadow-[0_1px_0_0_rgba(23,46,76,1)]">
								<tr className="bg-[#1E3A5F] text-white">
									{["Time","Account Statement(s)","Bank(s)","BU(s)","Run By","Total Rows","Matched","Not Found","Pending Review","Status"].map((h) => (
										<th key={h} className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider bg-[#1E3A5F]">{h}</th>
									))}
									<th className="sticky right-0 top-0 z-30 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider bg-[#1E3A5F] border-l border-[#172e4c] text-center w-24 shadow-[-2px_0_4px_rgba(0,0,0,0.1)]">View</th>
								</tr>
							</thead>
							<tbody className="text-[11px] divide-y divide-gray-200 font-medium text-gray-700 bg-white">
								{loading && <tr><td colSpan={11} className="text-center py-12 text-xs text-gray-400">Loading runs…</td></tr>}
								{!loading && filteredRuns.length===0 && <tr><td colSpan={11} className="text-center py-12 text-xs text-gray-400">No runs found for this period.</td></tr>}
								{filteredRuns.map((r) => (
									<tr key={r.run_id} className="hover:bg-gray-50/80 transition-colors group">
										<td className="px-3 py-3 whitespace-nowrap font-mono text-gray-500">{formatDate(r.started_at)}</td>
										<td className="px-3 py-3 font-bold text-primary">
											{(r.selected_files||[]).map((f) => (<span key={f} className="flex items-center gap-1"><FileText size={12} className="text-gray-400 shrink-0"/>{f}</span>))}
										</td>
										<td className="px-3 py-3 whitespace-nowrap font-bold text-primary">{(r.bank_names||[]).join(", ")||"—"}</td>
										<td className="px-3 py-3 whitespace-nowrap">{(r.business_units||[]).join(", ")||"—"}</td>
										<td className="px-3 py-3 whitespace-nowrap font-semibold text-gray-600">{r.triggered_by||"—"}</td>
										<td className="px-3 py-3 text-right font-bold font-mono">{(r.total_credit_rows||0).toLocaleString()}</td>
										<td className="px-3 py-3 text-right font-bold font-mono text-emerald-600">{(r.total_matched||0).toLocaleString()}</td>
										<td className="px-3 py-3 text-right font-bold font-mono text-red-500">{(r.total_not_found||0).toLocaleString()}</td>
										<td className="px-3 py-3 text-right font-bold font-mono text-amber-600">
											{Math.max(0, (r.passed_validation||0) - (r.approved||0)).toLocaleString()}
										</td>
										<td className="px-3 py-3 whitespace-nowrap">
											<span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider rounded-xs px-2 py-0.5 border ${r.status==="completed"?"bg-emerald-50 text-emerald-700 border-emerald-200":r.status==="running"?"bg-blue-50 text-blue-700 border-blue-200":"bg-red-50 text-red-700 border-red-200"}`}>
												{r.status}
											</span>
										</td>
										<td className="sticky right-0 bg-white group-hover:bg-gray-50 transition-colors px-4 py-2 border-l border-gray-100 text-center shadow-[-2px_0_4px_rgba(0,0,0,0.04)] z-10">
											<button onClick={() => handleViewRun(r)}
												className="inline-flex items-center gap-1 bg-[#1E3A5F] hover:bg-[#2E6DA4] text-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-xs shadow-xs transition-colors cursor-pointer">
												<Eye size={11}/><span>View</span>
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		);
	}

	// ==========================================================================
	// ROUTE 2 — Run detail view
	// ==========================================================================

	const primaryFile = (viewingRun.selected_files||[])[0]||"—";
	const allFiles    = viewingRun.selected_files || [];
	const m = runMetrics;

	return (
		<>
			{/* Breakup modal */}
			{breakupLine && breakupAnalysis && (
				<BreakupModal
					analysis={breakupAnalysis}
					onConfirm={handleBreakupConfirm}
					onCancel={() => { setBreakupLine(null); setBreakupAnalysis(null); }}
					isPosting={breakupPosting}
				/>
			)}

			{/* Oracle detail drawer */}
			{oracleDrawerLine && (
				<OracleDetailDrawer
					line={oracleDrawerLine}
					onClose={() => setOracleDrawerLine(null)}
					onRetrySuccess={() => {
						setOracleDrawerLine(null);
						if (viewingRun) loadRunDetail(viewingRun);
					}}
				/>
			)}

			<div className="flex flex-col h-full overflow-hidden space-y-4">
				<div className="pb-2 border-b border-gray-200 flex-shrink-0">
					<button onClick={() => { setViewingRun(null); setSelectedLines({}); }}
						className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#1E3A5F] hover:text-[#2E6DA4] transition-colors cursor-pointer">
						<ArrowLeft size={14} className="stroke-[3]"/><span>Back to Analysis History</span>
					</button>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch flex-1 min-h-0 overflow-hidden">
					{/* Left — statement preview */}
					<div className="lg:col-span-4 flex flex-col h-full overflow-hidden border border-gray-200 rounded-sm bg-white shadow-xs">
						{allFiles.length > 1 && (
							<div className="flex-shrink-0 border-b border-gray-200 bg-gray-50 px-3 py-2">
								<div className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Statement Files</div>
								<div className="flex flex-wrap gap-1.5">
									{allFiles.map((f) => (
										<button key={f} onClick={() => setPreviewFile(f)}
											className={`flex items-center gap-1 px-2 py-1 rounded-xs text-[9px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
												previewFile === f ? "bg-[#1E3A5F] text-white border-[#1E3A5F]" : "bg-white text-gray-600 border-gray-300 hover:border-[#2E6DA4]"
											}`}>
											<FileText size={10} />
											<span className="max-w-[120px] truncate">{f}</span>
										</button>
									))}
								</div>
							</div>
						)}
						{allFiles.length === 1 && (
							<div className="flex-shrink-0 border-b border-gray-200 bg-gray-50 px-3 py-2">
								<div className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Statement Preview</div>
							</div>
						)}
						{previewFile ? (
							<FilePreviewPanel filename={previewFile} bucket="active" />
						) : (
							<div className="flex-1 flex flex-col items-center justify-center text-gray-300 border-dashed">
								<FileText size={48} className="mb-3 stroke-[1.25]" />
								<span className="text-xs font-black text-gray-400 uppercase tracking-wider">No file selected</span>
							</div>
						)}
					</div>

					{/* Right — scrollable */}
					<div className="lg:col-span-8 flex flex-col h-full overflow-y-auto space-y-4 pr-2">
						{/* Header */}
						<div className="flex flex-col sm:flex-row items-start justify-between gap-4 bg-white border border-gray-200 p-4 rounded-sm shadow-2xs flex-shrink-0">
							<div>
								<h2 className="text-sm font-black text-primary uppercase tracking-wider font-mono">{primaryFile}</h2>
								<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500 font-bold mt-1.5">
									<span>{(viewingRun.bank_names||[]).join(", ")||"—"}</span>
									<span className="text-gray-300">•</span>
									<span>{(viewingRun.business_units||[]).join(", ")||"—"}</span>
									<span className="text-gray-300">•</span>
									<span>Run by {viewingRun.triggered_by||userDisplayName}</span>
								</div>
							</div>
							<button onClick={exportDetailCSV}
								className="flex items-center gap-2 text-xs font-black uppercase tracking-wider bg-[#1E3A5F] hover:bg-[#2E6DA4] text-white px-4 py-2 rounded-sm transition-colors shadow-2xs cursor-pointer whitespace-nowrap">
								<Download size={13}/> Download CSV
							</button>
						</div>

						{/* Metric cards */}
						<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-shrink-0">
							{[
								{ label:"Total Rows",        value:m?.total_rows   ??0, sub:"All statement rows",          icon:<Layers size={12} className="text-[#1E3A5F]"/>,  color:"text-gray-400"    },
								{ label:"Matched",           value:m?.matched      ??0, sub:"VAL-001 + VAL-002 passed",    icon:<Sparkles size={12}/>,                            color:"text-emerald-600" },
								{ label:"Not Found",         value:m?.not_found    ??0, sub:"No invoice / rejected",       icon:<AlertTriangle size={12}/>,                       color:"text-red-500"     },
								{ label:"Passed Validation", value:m?.passed_val   ??0, sub:"All rules passed",            icon:<ShieldCheck size={12}/>,                         color:"text-[#4A90E2]"   },
								{ label:"Failed Validation", value:m?.failed_val   ??0, sub:"At least one rule failed",    icon:<AlertTriangle size={12}/>,                       color:"text-red-600"     },
								{ label:"Review & Approve",  value:m?.review       ??0, sub:"Passed, awaiting SPOC",       icon:<Calendar size={12}/>,                            color:"text-amber-500"   },
								{ label:"Approved & Posted", value:m?.processed    ??0, sub:"Posted to Oracle Fusion",     icon:<CheckSquare size={12}/>,                         color:"text-emerald-600" },
								{ label:"Rejected",          value:m?.rejected     ??0, sub:"Rejected by SPOC",            icon:<X size={12} className="stroke-[2.5]"/>,           color:"text-red-500"     },
							].map(({ label, value, sub, icon, color }) => (
								<div key={label} className="border border-gray-200 p-3 rounded-sm bg-gray-50/30 flex flex-col justify-between">
									<div>
										<div className={`flex items-center gap-1.5 mb-0.5 ${color}`}>{icon}<span className="text-[9px] font-bold uppercase tracking-wider">{label}</span></div>
										<div className="text-lg font-black text-primary">{value.toLocaleString()}</div>
									</div>
									<div className="mt-1 text-[9px] text-gray-400 font-medium leading-tight">{sub}</div>
								</div>
							))}
						</div>

						{/* Tabs + search */}
						<div className="bg-white border border-gray-200 p-4 shadow-xs space-y-3 flex-shrink-0">
							<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
								<h3 className="text-xs font-black text-primary uppercase tracking-wider">Line Items Ledger</h3>
								<div className="relative w-full sm:w-64">
									<Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"/>
									<input type="text" placeholder="Search narrative or ID…" value={searchNarrative}
										onChange={(e) => setSearchNarrative(e.target.value)}
										className="w-full bg-white border border-gray-300 text-[11px] font-medium text-primary pl-8 pr-3 py-2 rounded-sm focus:outline-none focus:border-[#4A90E2]"/>
								</div>
							</div>
							<div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xs w-max max-w-full overflow-x-auto">
								{TABS.map((tab) => (
									<button key={tab.key} onClick={() => setActiveTab(tab.key)}
										className={`flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xs transition-all whitespace-nowrap cursor-pointer ${activeTab===tab.key ? "bg-[#1E3A5F] text-white shadow-xs" : "text-gray-500 hover:text-primary"}`}>
										{tab.label}
										<span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${activeTab===tab.key ? "bg-white/20 text-white" : "bg-gray-200 text-gray-600"}`}>
											{tab.count}
										</span>
									</button>
								))}
							</div>
						</div>

						{/* Line items table */}
						<div className="bg-white border border-gray-200 rounded-sm shadow-xs flex flex-col min-h-[380px] max-h-[520px] flex-grow">
							<div className="flex-1 overflow-auto relative">
								<table className="w-full text-left border-collapse min-w-[2100px]">
									<thead className="sticky top-0 z-20 shadow-[0_1px_0_0_rgba(23,46,76,1)]">
										<tr className="bg-[#1E3A5F] text-white">
											<th className="px-3 py-2.5 bg-[#1E3A5F] w-10 text-center">
												<input type="checkbox"
													checked={Object.keys(selectedLines).length===activeRows.length && activeRows.length>0}
													onChange={toggleSelectAll}
													className="rounded-xs text-[#4A90E2] focus:ring-0 cursor-pointer"/>
											</th>
											{["Bank","BU","Date","Narrative","Credit Amount","Currency","Extracted Customer","Extracted Invoice","Method","Confidence","Matched Customer","Matched Invoice","Outstanding","Inv. ccy","Oracle Ref","Status"].map((h) => (
												<th key={h} className={`px-3 py-2.5 text-[10px] font-black uppercase tracking-wider bg-[#1E3A5F] ${h==="Credit Amount"||h==="Outstanding"?"text-right":""}`}>{h}</th>
											))}
											<th className="sticky right-0 top-0 z-30 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider bg-[#1E3A5F] border-l border-[#172e4c] text-center w-24 shadow-[-2px_0_4px_rgba(0,0,0,0.1)]">Actions</th>
										</tr>
									</thead>
									<tbody className="text-[11px] divide-y divide-gray-200 font-medium text-gray-700 bg-white">
										{loading && <tr><td colSpan={18} className="text-center py-24 text-xs font-bold text-gray-400">Loading…</td></tr>}
										{!loading && activeRows.length===0 && (
											<tr><td colSpan={18} className="text-center py-24 text-xs font-bold text-gray-400 bg-gray-50/20">No entries in this tab.</td></tr>
										)}
										{activeRows.map((line) => {
											const busy       = !!actionLoading[line.id];
											const isMatch    = line._source === "matched";
											const canApprove = isMatch && line.hitl_status !== "approved" && line.validation_status === "passed";
											const canReject  = isMatch && line.hitl_status !== "rejected";

											let statusVal = "Not Found";
											if (isMatch) {
												if (line.hitl_status === "approved" && line.oracle_transaction_ref) statusVal = "Processed";
												else if (line.hitl_status === "approved") statusVal = "Approved";
												else if (line.hitl_status === "rejected") statusVal = "Not Found";
												else if (line.validation_status === "passed") statusVal = "Review and Approve";
												else statusVal = "Review and Approve";
											}

											const isApproved   = line.hitl_status === "approved";
											const oracleRefCell = isApproved ? (
												<button
													onClick={(e) => { e.stopPropagation(); setOracleDrawerLine(line); }}
													className={`font-mono text-[10px] font-bold underline decoration-dotted cursor-pointer transition-colors ${
														line.oracle_post_status === "success" ? "text-emerald-600 hover:text-emerald-700" :
														line.oracle_post_status === "failed"  ? "text-red-500 hover:text-red-600" :
														                                        "text-gray-500 hover:text-primary"
													}`}
													title="Click to view Oracle detail / retry"
												>
													{line.oracle_transaction_ref || (line.oracle_post_status === "failed" ? "Failed ↗" : "View")}
												</button>
											) : (
												<span className="font-mono text-gray-600">{line.oracle_transaction_ref||"—"}</span>
											);

											return (
												<>
												<tr key={line.id}
													onClick={() => isMatch && router.push(`/analysis-history/row/${line.id}`)}
													className={`transition-colors group ${isMatch ? "cursor-pointer hover:bg-blue-50/40" : "hover:bg-gray-50/80"} ${selectedLines[line.id]?"bg-blue-50/20":""}`}>
													<td className="px-3 py-3 text-center">
														<input type="checkbox" checked={!!selectedLines[line.id]}
															onChange={() => setSelectedLines((p) => ({...p,[line.id]:!p[line.id]}))}
															className="rounded-xs text-[#4A90E2] focus:ring-0 cursor-pointer"/>
													</td>
													<td className="px-3 py-3 whitespace-nowrap font-bold text-primary">{line.bank_name}</td>
													<td className="px-3 py-3 whitespace-nowrap text-xs font-semibold">{line.business_unit||"—"}</td>
													<td className="px-3 py-3 whitespace-nowrap font-mono">{line.statement_date}</td>
													<td className="px-3 py-3 font-mono text-gray-600 max-w-xs truncate" title={line.narrative}>{line.narrative}</td>
													<td className="px-3 py-3 text-right font-black font-mono text-primary">{(line.credit_amount||0).toLocaleString(undefined,{minimumFractionDigits:2})}</td>
													<td className="px-3 py-3 font-bold text-gray-400">{line.statement_currency}</td>
													<td className="px-3 py-3 whitespace-nowrap font-bold text-gray-600">{line.extracted_customer_name||"—"}</td>
													<td className="px-3 py-3 font-mono text-gray-500">{line.extracted_invoice_number||"—"}</td>
													<td className="px-3 py-3 whitespace-nowrap text-gray-500 font-semibold">{line.extraction_method||"—"}</td>
													<td className="px-3 py-3 font-mono">
														{(line.confidence_score||0)>0
															? <span className={`text-[10px] px-1.5 py-0.5 rounded-xs font-bold text-white ${line.confidence_score>=0.8?"bg-emerald-600":"bg-amber-600"}`}>{(line.confidence_score*100).toFixed(0)}%</span>
															: <span className="text-gray-300">—</span>}
													</td>
													<td className="px-3 py-3 whitespace-nowrap font-bold text-primary">{line.matched_customer_name||"—"}</td>
													<td className="px-3 py-3 font-mono font-bold text-primary">{line.matched_invoice_number||"—"}</td>
													<td className="px-3 py-3 text-right font-mono text-gray-500">{(line.outstanding_amount||0).toLocaleString(undefined,{minimumFractionDigits:2})}</td>
													<td className="px-3 py-3 font-bold text-gray-400">{line.invoice_currency||"—"}</td>
													<td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>{oracleRefCell}</td>
													<td className="px-3 py-3 whitespace-nowrap"><StatusBadge value={statusVal}/></td>
													<td className="sticky right-0 bg-white group-hover:bg-gray-50 transition-colors px-4 py-2 border-l border-gray-100 shadow-[-2px_0_4px_rgba(0,0,0,0.04)] z-10 text-center">
														<div className="inline-flex items-center justify-center gap-1">
															<button title="Approve and Post to Oracle"
																disabled={busy||!canApprove}
																onClick={(e) => { e.stopPropagation(); handleApprove(line); }}
																className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-xs border border-transparent hover:border-emerald-200 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
																<Check size={14} className="stroke-[3]"/>
															</button>
															<button title="Reject"
																disabled={busy||!canReject}
																onClick={(e) => { e.stopPropagation(); handleReject(line); }}
																className="p-1 text-red-500 hover:bg-red-50 rounded-xs border border-transparent hover:border-red-200 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
																<X size={14} className="stroke-[3]"/>
															</button>
														</div>
													</td>
												</tr>
												{/* Inline error row */}
												{rowErrors[line.id] && (
													<tr key={`err-${line.id}`} className="bg-red-50 border-b border-red-100">
														<td colSpan={18} className="px-4 py-2">
															<div className="flex items-center gap-2 text-[11px] font-bold text-red-600">
																<AlertTriangle size={13} className="shrink-0" />
																<span>{rowErrors[line.id]}</span>
															</div>
														</td>
													</tr>
												)}
												</>
											);
										})}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}