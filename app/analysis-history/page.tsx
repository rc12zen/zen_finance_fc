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
	Search,
	ShieldCheck,
	Sparkles,
	User,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import {
	getRunHistory,
	getMatched,
	getNotFound,
	getMetrics,
	approveEntry,
	rejectEntry,
	getFilterOptions,
} from "@/lib/api";

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
	total_credit_amount: number;
	matched_amount: number;
	match_rate_pct: number;
	triggered_by: string;
}

interface StatementLineItem {
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
	oracle_transaction_ref: string;
	validation_status: string;
	hitl_status: string;
	_source: "matched" | "not_found";
}

interface RunMetrics {
	total_rows_ingested: number;
	found: number;
	not_found: number;
	passed_validation: number;
	failed_validation: number;
	pending_hitl: number;
	approved: number;
	rejected: number;
}

function lineStatus(item: StatementLineItem): string {
	if (item._source === "not_found")        return "Not Found";
	if (item.hitl_status === "approved")     return "Matched";
	if (item.hitl_status === "rejected")     return "Not Found";
	if (item.validation_status === "passed") return "Review and Approve";
	return "Review and Approve";
}

// Pure helper — no hooks
function buildHistoryDateRange(
	period: string,
	cStart: string,
	cEnd: string,
): { date_from?: string; date_to?: string } {
	const pad = (n: number) => String(n).padStart(2, "0");
	const fmt = (d: Date) =>
		`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	const now   = new Date();
	const today = fmt(now);
	if (period === "Today")     return { date_from: today, date_to: today };
	if (period === "Yesterday") {
		const y = new Date(now); y.setDate(y.getDate() - 1); const ys = fmt(y);
		return { date_from: ys, date_to: ys };
	}
	if (period === "WTD") {
		const mon = new Date(now);
		mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
		return { date_from: fmt(mon), date_to: today };
	}
	if (period === "MTD") {
		return { date_from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), date_to: today };
	}
	if (period === "Custom Range") {
		return { date_from: cStart || undefined, date_to: cEnd || undefined };
	}
	return {}; // "Latest" — no date filter, page_size=5 controls count
}

export default function AnalysisHistoryPage() {
	const [viewingRun, setViewingRun] = useState<AnalysisRun | null>(null);
	const [userDisplayName, setUserDisplayName] = useState("Admin User");

	const [timePeriod, setTimePeriod]                   = useState("Latest");
	const [isCustomRangeActive, setIsCustomRangeActive] = useState(false);
	const [customStart, setCustomStart]                 = useState("");
	const [customEnd, setCustomEnd]                     = useState("");
	const [selectedBank, setSelectedBank]               = useState("All Banks");
	const [selectedBU, setSelectedBU]                   = useState("All BUs");
	const [searchUser, setSearchUser]                   = useState("");

	const [bankOptions, setBankOptions] = useState<string[]>([]);
	const [buOptions, setBuOptions]     = useState<string[]>([]);

	const [statusFilter, setStatusFilter]         = useState("All statuses");
	const [searchNarrative, setSearchNarrative]   = useState("");
	const [pillStatusFilter, setPillStatusFilter] = useState("All");
	const [selectedLines, setSelectedLines]       = useState<Record<string, boolean>>({});

	const [runs, setRuns]               = useState<AnalysisRun[]>([]);
	const [lineItems, setLineItems]     = useState<StatementLineItem[]>([]);
	const [runMetrics, setRunMetrics]   = useState<RunMetrics | null>(null);
	const [loading, setLoading]         = useState(false);
	const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});

	useEffect(() => {
		const match = document.cookie.match(/(?:^|; )login_user_email_stub=([^;]*)/);
		if (match?.[1]) setUserDisplayName(decodeURIComponent(match[1]).split("@")[0]);
	}, []);

	// Stable fetcher — all values passed as args, never stale
	const doLoadRuns = useCallback(async (
		period: string,
		cStart: string,
		cEnd:   string,
	) => {
		if (period === "Custom Range" && (!cStart || !cEnd)) return;
		setLoading(true);
		try {
			const pageSize = period === "Latest" ? 5 : 50;
			const dr       = buildHistoryDateRange(period, cStart, cEnd);
			const [runsRes, filtersRes] = await Promise.all([
				getRunHistory(1, pageSize, dr.date_from, dr.date_to),
				getFilterOptions(),
			]);
			setRuns(runsRes.data.data || []);
			setBankOptions(filtersRes.data.banks || []);
			setBuOptions(filtersRes.data.business_units || []);
		} catch {}
		setLoading(false);
	}, []);

	// Re-fetch when pill changes
	useEffect(() => {
		if (timePeriod === "Custom Range") return;
		doLoadRuns(timePeriod, customStart, customEnd);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [timePeriod]);

	// Initial mount
	useEffect(() => {
		doLoadRuns("Latest", "", "");
	}, [doLoadRuns]);

	const loadRunDetail = useCallback(async (run: AnalysisRun) => {
		setLoading(true);
		setLineItems([]);
		setRunMetrics(null);
		try {
			const [matchedRes, notFoundRes, metricsRes] = await Promise.all([
				getMatched({ run_id: run.run_id, page_size: 200 }),
				getNotFound({ run_id: run.run_id, page_size: 200 }),
				getMetrics(run.run_id),
			]);
			const matched: StatementLineItem[] = (matchedRes.data.data || []).map(
				(r: any) => ({ ...r, _source: "matched" as const }),
			);
			const notFound: StatementLineItem[] = (notFoundRes.data.data || []).map(
				(r: any) => ({
					id: r.id, run_id: r.run_id, bank_name: r.bank_name,
					business_unit: "", statement_date: r.statement_date,
					narrative: r.narrative, credit_amount: r.credit_amount,
					statement_currency: r.currency, extracted_customer_name: "",
					extracted_invoice_number: "", extraction_method: "",
					confidence_score: 0, matched_customer_name: "—",
					matched_invoice_number: "—", outstanding_amount: r.credit_amount,
					invoice_currency: r.currency, oracle_transaction_ref: "—",
					validation_status: "failed", hitl_status: "n/a",
					_source: "not_found" as const,
				}),
			);
			setLineItems([...matched, ...notFound]);
			setRunMetrics(metricsRes.data);
		} catch {}
		setLoading(false);
	}, []);

	const handleApprove = async (item: StatementLineItem) => {
		if (item._source !== "matched") return;
		setActionLoading((prev) => ({ ...prev, [item.id]: true }));
		try { await approveEntry(item.id); if (viewingRun) await loadRunDetail(viewingRun); } catch {}
		setActionLoading((prev) => ({ ...prev, [item.id]: false }));
	};

	const handleReject = async (item: StatementLineItem) => {
		if (item._source !== "matched") return;
		setActionLoading((prev) => ({ ...prev, [item.id]: true }));
		try { await rejectEntry(item.id); if (viewingRun) await loadRunDetail(viewingRun); } catch {}
		setActionLoading((prev) => ({ ...prev, [item.id]: false }));
	};

	const handleTimePeriodSelect = (period: string) => {
		setTimePeriod(period);  // triggers useEffect → doLoadRuns
		setIsCustomRangeActive(period === "Custom Range");
	};

	const handleViewRun = (run: AnalysisRun) => {
		setViewingRun(run);
		setSelectedLines({});
		loadRunDetail(run);
	};

	const exportHistoryMasterCSV = () => {
		if (!runs.length) return;
		const headers = Object.keys(runs[0]).join(",");
		const rows    = runs.map((r) => Object.values(r).map((v) => `"${v ?? ""}"`).join(",")).join("\n");
		const blob    = new Blob([headers + "\n" + rows], { type: "text/csv" });
		const url     = URL.createObjectURL(blob);
		const link    = document.createElement("a");
		link.href = url; link.download = "analysis_history_master.csv"; link.click();
	};

	const exportSubrouteLineCSV = () => {
		if (!lineItems.length) return;
		const headers = Object.keys(lineItems[0]).join(",");
		const rows    = lineItems.map((l) => Object.values(l).map((v) => `"${v ?? ""}"`).join(",")).join("\n");
		const blob    = new Blob([headers + "\n" + rows], { type: "text/csv" });
		const url     = URL.createObjectURL(blob);
		const link    = document.createElement("a");
		link.href = url; link.download = `run_line_details_${viewingRun?.run_id}.csv`; link.click();
	};

	const toggleSelectAllLines = () => {
		if (Object.keys(selectedLines).length === lineItems.length) { setSelectedLines({}); return; }
		const all: Record<string, boolean> = {};
		lineItems.forEach((l) => (all[l.id] = true));
		setSelectedLines(all);
	};

	const toggleSingleLine = (id: number) =>
		setSelectedLines((prev) => ({ ...prev, [id]: !prev[id] }));

	const filteredRuns = useMemo(() => runs.filter((r) => {
		const matchBank = selectedBank === "All Banks" || (r.bank_names || []).includes(selectedBank);
		const matchBU   = selectedBU   === "All BUs"   || (r.business_units || []).includes(selectedBU);
		const matchUser = !searchUser  || (r.triggered_by || "").toLowerCase().includes(searchUser.toLowerCase());
		return matchBank && matchBU && matchUser;
	}), [runs, selectedBank, selectedBU, searchUser]);

	const filteredLineItems = useMemo(() => lineItems.filter((l) => {
		const status        = lineStatus(l);
		const matchDropdown = statusFilter === "All statuses" || status === statusFilter;
		const matchText     = l.narrative?.toLowerCase().includes(searchNarrative.toLowerCase()) || String(l.id).includes(searchNarrative);
		const matchPill     = pillStatusFilter === "All" || status === pillStatusFilter;
		return matchDropdown && matchText && matchPill;
	}), [lineItems, statusFilter, searchNarrative, pillStatusFilter]);

	const activeMetricsSummary = runMetrics
		? {
				total_rows: (runMetrics.found ?? 0) + (runMetrics.not_found ?? 0),
				matched:    runMetrics.found             ?? 0,
				not_found:  runMetrics.not_found         ?? 0,
				passed:     runMetrics.passed_validation ?? 0,
				failed:     runMetrics.failed_validation ?? 0,
				pending:    runMetrics.pending_hitl      ?? 0,
				approved:   runMetrics.approved          ?? 0,
				rejected:   runMetrics.rejected          ?? 0,
			}
		: { total_rows: 0, matched: 0, not_found: 0, passed: 0, failed: 0, pending: 0, approved: 0, rejected: 0 };

	const formatDate = (iso: string) => {
		if (!iso) return "—";
		try { return new Date(iso).toLocaleString(); } catch { return iso; }
	};

	// ── ROUTE 1: History list ──────────────────────────────────────────────────
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
						{["Latest", "Today", "Yesterday", "WTD", "MTD", "Custom Range"].map((period) => (
							<button key={period} onClick={() => handleTimePeriodSelect(period)}
								className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-xs transition-all cursor-pointer ${
									timePeriod === period ? "bg-[#1E3A5F] text-white shadow-xs" : "text-gray-500 hover:text-primary"
								}`}>
								{period}
							</button>
						))}
					</div>
					{isCustomRangeActive && (
						<div className="flex items-center gap-1.5 border-l border-gray-200 pl-3">
							<input type="date" value={customStart}
								onChange={(e) => { const v = e.target.value; setCustomStart(v); if (customEnd) doLoadRuns("Custom Range", v, customEnd); }}
								className="bg-gray-50 border border-gray-300 rounded-sm text-[10px] font-bold uppercase text-gray-600 px-2 py-1 outline-none focus:border-[#4A90E2]" />
							<span className="text-[10px] font-bold text-gray-400">TO</span>
							<input type="date" value={customEnd}
								onChange={(e) => { const v = e.target.value; setCustomEnd(v); if (customStart) doLoadRuns("Custom Range", customStart, v); }}
								className="bg-gray-50 border border-gray-300 rounded-sm text-[10px] font-bold uppercase text-gray-600 px-2 py-1 outline-none focus:border-[#4A90E2]" />
						</div>
					)}
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
					<div className="relative">
						<Landmark size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
						<select value={selectedBank} onChange={(e) => setSelectedBank(e.target.value)}
							className="w-full bg-white border border-gray-300 text-xs font-bold text-primary pl-9 pr-8 py-2.5 rounded-sm appearance-none focus:outline-none focus:border-[#4A90E2] cursor-pointer">
							<option>All Banks</option>
							{bankOptions.map((b) => <option key={b}>{b}</option>)}
						</select>
						<ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
					</div>
					<div className="relative">
						<Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
						<select value={selectedBU} onChange={(e) => setSelectedBU(e.target.value)}
							className="w-full bg-white border border-gray-300 text-xs font-bold text-primary pl-9 pr-8 py-2.5 rounded-sm appearance-none focus:outline-none focus:border-[#4A90E2] cursor-pointer">
							<option>All BUs</option>
							{buOptions.map((bu) => <option key={bu}>{bu}</option>)}
						</select>
						<ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
					</div>
					<div className="relative">
						<User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
						<input type="text" placeholder="Search by user..." value={searchUser}
							onChange={(e) => setSearchUser(e.target.value)}
							className="w-full bg-white border border-gray-300 text-xs font-semibold text-primary pl-9 pr-4 py-2.5 rounded-sm focus:outline-none focus:border-[#4A90E2]" />
					</div>
				</div>

				<div className="bg-white border border-gray-200 rounded-sm shadow-xs flex flex-col h-[520px]">
					<div className="flex-1 overflow-auto relative">
						<table className="w-full text-left border-collapse min-w-[1100px]">
							<thead className="sticky top-0 z-20 shadow-[0_1px_0_0_rgba(23,46,76,1)]">
								<tr className="bg-[#1E3A5F] text-white">
									{["Time","Account Statement(s)","Bank(s)","BU(s)","Run By","Total Rows","Matched","Not Found","Pending","Status"].map((h) => (
										<th key={h} className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider bg-[#1E3A5F]">{h}</th>
									))}
									<th className="sticky right-0 top-0 z-30 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider bg-[#1E3A5F] border-l border-[#172e4c] text-center w-24 shadow-[-2px_0_4px_rgba(0,0,0,0.1)]">View</th>
								</tr>
							</thead>
							<tbody className="text-[11px] divide-y divide-gray-200 font-medium text-gray-700 bg-white">
								{loading && <tr><td colSpan={11} className="text-center py-12 text-xs text-gray-400">Loading runs…</td></tr>}
								{!loading && filteredRuns.length === 0 && <tr><td colSpan={11} className="text-center py-12 text-xs text-gray-400">No runs found for this period.</td></tr>}
								{filteredRuns.map((r) => (
									<tr key={r.run_id} className="hover:bg-gray-50/80 transition-colors group">
										<td className="px-3 py-3 whitespace-nowrap font-mono text-gray-500">{formatDate(r.started_at)}</td>
										<td className="px-3 py-3 font-bold text-primary">
											{(r.selected_files || []).map((f) => (
												<span key={f} className="flex items-center gap-1"><FileText size={12} className="text-gray-400 shrink-0" />{f}</span>
											))}
										</td>
										<td className="px-3 py-3 whitespace-nowrap font-bold text-primary">{(r.bank_names || []).join(", ") || "—"}</td>
										<td className="px-3 py-3 whitespace-nowrap">{(r.business_units || []).join(", ") || "—"}</td>
										<td className="px-3 py-3 whitespace-nowrap font-semibold text-gray-600">{r.triggered_by || "—"}</td>
										<td className="px-3 py-3 text-right font-bold font-mono">{(r.total_credit_rows || 0).toLocaleString()}</td>
										<td className="px-3 py-3 text-right font-bold font-mono text-emerald-600">{(r.total_matched || 0).toLocaleString()}</td>
										<td className="px-3 py-3 text-right font-bold font-mono text-red-500">{(r.total_not_found || 0).toLocaleString()}</td>
										<td className="px-3 py-3 text-right font-bold font-mono text-amber-600">{(r.pending_hitl || 0).toLocaleString()}</td>
										<td className="px-3 py-3 whitespace-nowrap">
											<span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider rounded-xs px-2 py-0.5 border ${
												r.status === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
												: r.status === "running"  ? "bg-blue-50 text-blue-700 border-blue-200"
												:                           "bg-red-50 text-red-700 border-red-200"}`}>
												{r.status}
											</span>
										</td>
										<td className="sticky right-0 bg-white group-hover:bg-gray-50 transition-colors px-4 py-2 border-l border-gray-100 text-center shadow-[-2px_0_4px_rgba(0,0,0,0.04)] z-10">
											<button onClick={() => handleViewRun(r)}
												className="inline-flex items-center gap-1 bg-[#1E3A5F] hover:bg-[#2E6DA4] text-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-xs shadow-xs transition-colors cursor-pointer">
												<Eye size={11} /><span>View</span>
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

	// ── ROUTE 2: Run detail ────────────────────────────────────────────────────
	const primaryFile = (viewingRun.selected_files || [])[0] || "—";

	return (
		<div className="flex flex-col h-full overflow-hidden space-y-4">
			<div className="pb-2 border-b border-gray-200 flex-shrink-0">
				<button onClick={() => { setViewingRun(null); setSelectedLines({}); }}
					className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#1E3A5F] hover:text-[#2E6DA4] transition-colors cursor-pointer">
					<ArrowLeft size={14} className="stroke-[3]" /><span>Back to Analysis History</span>
				</button>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch flex-1 min-h-0 overflow-hidden">
				<div className="lg:col-span-4 flex flex-col h-full overflow-hidden">
					<div className="border border-gray-200 bg-gray-100 flex-1 flex flex-col items-center justify-center rounded-sm text-center border-dashed relative p-6 h-full">
						<div className="absolute top-2 left-2 bg-[#1E3A5F] text-white text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-xs shadow-xs">Statement Preview Window</div>
						<div className="flex flex-col items-center justify-center">
							<FileText size={48} className="text-gray-400 mb-3 stroke-[1.25]" />
							<span className="text-xs font-black text-primary uppercase tracking-wider block">{primaryFile}</span>
							<span className="text-[10px] font-mono text-gray-400 mt-1 uppercase tracking-wider max-w-xs">Preview Sandbox Content Restricted Over Pipeline APIs</span>
						</div>
					</div>
				</div>

				<div className="lg:col-span-8 flex flex-col h-full overflow-y-auto space-y-4 pr-2">
					<div className="flex flex-col sm:flex-row items-start justify-between gap-4 bg-white border border-gray-200 p-4 rounded-sm shadow-2xs flex-shrink-0">
						<div>
							<h2 className="text-sm font-black text-primary uppercase tracking-wider font-mono">{primaryFile}</h2>
							<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500 font-bold mt-1.5">
								<span>{(viewingRun.bank_names || []).join(", ") || "—"}</span>
								<span className="text-gray-300">•</span>
								<span>{(viewingRun.business_units || []).join(", ") || "—"}</span>
								<span className="text-gray-300">•</span>
								<span>Run by {viewingRun.triggered_by || userDisplayName}</span>
							</div>
						</div>
						<button onClick={exportSubrouteLineCSV}
							className="flex items-center gap-2 text-xs font-black uppercase tracking-wider bg-[#1E3A5F] hover:bg-[#2E6DA4] text-white px-4 py-2 rounded-sm transition-colors shadow-2xs cursor-pointer whitespace-nowrap">
							<Download size={13} /> Download CSV
						</button>
					</div>

					<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-shrink-0">
						{[
							{ label:"Total rows",        value:activeMetricsSummary.total_rows, sub:"Statement Ledger Rows",      icon:<Layers size={12} className="text-[#1E3A5F]" />, color:"text-gray-400"    },
							{ label:"Matched",           value:activeMetricsSummary.matched,    sub:"ERP Invoices Identified",    icon:<Sparkles size={12} />,                          color:"text-emerald-600" },
							{ label:"Not Found",         value:activeMetricsSummary.not_found,  sub:"Requires Manual Exception",  icon:<AlertTriangle size={12} />,                     color:"text-red-500"     },
							{ label:"Passed Validation", value:activeMetricsSummary.passed,     sub:"Clears Variance Tolerances", icon:<ShieldCheck size={12} />,                       color:"text-[#4A90E2]"   },
							{ label:"Failed Validation", value:activeMetricsSummary.failed,     sub:"Amount Mismatch Flags",      icon:<AlertTriangle size={12} />,                     color:"text-red-600"     },
							{ label:"Pending Approval",  value:activeMetricsSummary.pending,    sub:"Awaiting Clear Queue",       icon:<Calendar size={12} />,                          color:"text-amber-500"   },
							{ label:"Approved & Posted", value:activeMetricsSummary.approved,   sub:"Committed to Oracle",        icon:<CheckSquare size={12} />,                       color:"text-emerald-600" },
							{ label:"Rejected",          value:activeMetricsSummary.rejected,   sub:"Returned to Pipeline Queue", icon:<X size={12} className="stroke-[2.5]" />,        color:"text-red-500"     },
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

					<div className="bg-white border border-gray-200 p-4 shadow-xs space-y-3 flex-shrink-0">
						<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
							<h3 className="text-xs font-black text-primary uppercase tracking-wider">Line Items Ledger</h3>
							<div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
								<div className="relative w-full sm:w-44">
									<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
										className="w-full bg-white border border-gray-300 text-[11px] font-bold text-primary px-2.5 py-2 rounded-sm appearance-none focus:outline-none focus:border-[#4A90E2] cursor-pointer">
										<option>All statuses</option><option>Matched</option><option>Not Found</option><option>Review and Approve</option><option>Processed</option>
									</select>
									<ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
								</div>
								<div className="relative w-full sm:w-56">
									<Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
									<input type="text" placeholder="Search narrative..." value={searchNarrative}
										onChange={(e) => setSearchNarrative(e.target.value)}
										className="w-full bg-white border border-gray-300 text-[11px] font-medium text-primary pl-8 pr-3 py-2 rounded-sm focus:outline-none focus:border-[#4A90E2]" />
								</div>
							</div>
						</div>
						<div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xs w-max max-w-full overflow-x-auto">
							{["All","Matched","Not Found","Review and Approve","Processed"].map((pill) => (
								<button key={pill} onClick={() => setPillStatusFilter(pill)}
									className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-xs transition-all whitespace-nowrap cursor-pointer ${
										pillStatusFilter === pill ? "bg-[#1E3A5F] text-white shadow-xs" : "text-gray-500 hover:text-primary"}`}>
									{pill}
								</button>
							))}
						</div>
					</div>

					<div className="bg-white border border-gray-200 rounded-sm shadow-xs flex flex-col min-h-[380px] max-h-[500px] flex-grow">
						<div className="flex-1 overflow-auto relative">
							<table className="w-full text-left border-collapse min-w-[2100px]">
								<thead className="sticky top-0 z-20 shadow-[0_1px_0_0_rgba(23,46,76,1)]">
									<tr className="bg-[#1E3A5F] text-white">
										<th className="px-3 py-2.5 bg-[#1E3A5F] w-10 text-center">
											<input type="checkbox"
												checked={Object.keys(selectedLines).length === lineItems.length && lineItems.length > 0}
												onChange={toggleSelectAllLines}
												className="rounded-xs text-[#4A90E2] focus:ring-0 cursor-pointer" />
										</th>
										{["Bank","BU","Date","Narrative","Credit Amount","Currency","Extracted Customer","Extracted Invoice","Method","Confidence","Matched Customer","Matched Invoice","Outstanding","Inv. ccy","Oracle Ref","Status"].map((h) => (
											<th key={h} className={`px-3 py-2.5 text-[10px] font-black uppercase tracking-wider bg-[#1E3A5F] ${h === "Credit Amount" || h === "Outstanding" ? "text-right" : ""}`}>{h}</th>
										))}
										<th className="sticky right-0 top-0 z-30 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider bg-[#1E3A5F] border-l border-[#172e4c] text-center w-24 shadow-[-2px_0_4px_rgba(0,0,0,0.1)]">Actions</th>
									</tr>
								</thead>
								<tbody className="text-[11px] divide-y divide-gray-200 font-medium text-gray-700 bg-white">
									{loading && <tr><td colSpan={18} className="text-center py-24 text-xs font-bold text-gray-400">Loading line items…</td></tr>}
									{!loading && filteredLineItems.length === 0 && <tr><td colSpan={18} className="text-center py-24 text-xs font-bold text-gray-400 bg-gray-50/20">No entries found matching the filter criteria.</td></tr>}
									{filteredLineItems.map((line) => {
										const status  = lineStatus(line);
										const busy    = !!actionLoading[line.id];
										const isMatch = line._source === "matched";
										return (
											<tr key={line.id} className={`hover:bg-gray-50/80 transition-colors group ${selectedLines[line.id] ? "bg-blue-50/20" : ""}`}>
												<td className="px-3 py-3 text-center"><input type="checkbox" checked={!!selectedLines[line.id]} onChange={() => toggleSingleLine(line.id)} className="rounded-xs text-[#4A90E2] focus:ring-0 cursor-pointer" /></td>
												<td className="px-3 py-3 whitespace-nowrap font-bold text-primary">{line.bank_name}</td>
												<td className="px-3 py-3 whitespace-nowrap text-xs font-semibold">{line.business_unit || "—"}</td>
												<td className="px-3 py-3 whitespace-nowrap font-mono">{line.statement_date}</td>
												<td className="px-3 py-3 font-mono text-gray-600 max-w-xs truncate" title={line.narrative}>{line.narrative}</td>
												<td className="px-3 py-3 text-right font-black font-mono text-primary">{(line.credit_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
												<td className="px-3 py-3 font-bold text-gray-400">{line.statement_currency}</td>
												<td className="px-3 py-3 whitespace-nowrap font-bold text-gray-600">{line.extracted_customer_name || "—"}</td>
												<td className="px-3 py-3 font-mono text-gray-500">{line.extracted_invoice_number || "—"}</td>
												<td className="px-3 py-3 whitespace-nowrap text-gray-500 font-semibold">{line.extraction_method || "—"}</td>
												<td className="px-3 py-3 font-mono">
													{line.confidence_score > 0
														? <span className={`text-[10px] px-1.5 py-0.5 rounded-xs font-bold text-white ${line.confidence_score >= 0.8 ? "bg-emerald-600" : "bg-amber-600"}`}>{(line.confidence_score * 100).toFixed(0)}%</span>
														: <span className="text-gray-300">—</span>}
												</td>
												<td className="px-3 py-3 whitespace-nowrap font-bold text-primary">{line.matched_customer_name || "—"}</td>
												<td className="px-3 py-3 font-mono font-bold text-primary">{line.matched_invoice_number || "—"}</td>
												<td className="px-3 py-3 text-right font-mono text-gray-500">{(line.outstanding_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
												<td className="px-3 py-3 font-bold text-gray-400">{line.invoice_currency || "—"}</td>
												<td className="px-3 py-3 font-mono text-gray-600">{line.oracle_transaction_ref || "—"}</td>
												<td className="px-3 py-3 whitespace-nowrap"><StatusBadge value={status} /></td>
												<td className="sticky right-0 bg-white group-hover:bg-gray-50 transition-colors px-4 py-2 border-l border-gray-100 shadow-[-2px_0_4px_rgba(0,0,0,0.04)] z-10 text-center">
													<div className="inline-flex items-center justify-center gap-1">
														<button title="Approve and Post to Oracle"
															disabled={busy || !isMatch || line.hitl_status === "approved"}
															onClick={() => handleApprove(line)}
															className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-xs border border-transparent hover:border-emerald-200 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
															<Check size={14} className="stroke-[3]" />
														</button>
														<button title="Reject Match Context"
															disabled={busy || !isMatch || line.hitl_status === "rejected"}
															onClick={() => handleReject(line)}
															className="p-1 text-red-500 hover:bg-red-50 rounded-xs border border-transparent hover:border-red-200 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
															<X size={14} className="stroke-[3]" />
														</button>
													</div>
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}