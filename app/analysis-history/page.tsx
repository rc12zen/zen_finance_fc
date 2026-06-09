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
import { getFiles, getMetrics } from "@/lib/api";

// --- SCHEMA SPECIFICATIONS ---
interface AnalysisRun {
	id: string;
	time: string;
	account_statement: string;
	bank: string;
	bu: string;
	source: string;
	run_by: string;
	total_rows: number;
	matched: number;
	pending: number;
	status: string;
}

interface StatementLineItem {
	id: string;
	bank: string;
	bu: string;
	date: string;
	narrative: string;
	credit_amount: number;
	currency: string;
	extracted_customer: string;
	extracted_invoice: string;
	method: string;
	confidence: number;
	matched_customer: string;
	matched_invoice: string;
	outstanding: number;
	inv_ccy: string;
	oracle_ref: string;
	status: string;
}

export default function AnalysisHistoryPage() {
	// --- LAYOUT SWITCH NAVIGATION STATE ---
	const [viewingRunId, setViewingRunId] = useState<string | null>(null);

	// --- IDENTITY MATRIX STATE ---
	const [userDisplayName, setUserDisplayName] = useState("Admin User");

	// --- PARENT HISTORY FILTER STATE ---
	const [timePeriod, setTimePeriod] = useState("Latest");
	const [isCustomRangeActive, setIsCustomRangeActive] = useState(false);
	const [customStart, setCustomStart] = useState("");
	const [customEnd, setCustomEnd] = useState("");
	const [selectedBank, setSelectedBank] = useState("All Banks");
	const [selectedBU, setSelectedBU] = useState("All BUs");
	const [searchUser, setSearchUser] = useState("");

	// --- DETAILED SUBROUTE STATE ---
	const [statusFilter, setStatusFilter] = useState("All statuses");
	const [searchNarrative, setSearchNarrative] = useState("");
	const [pillStatusFilter, setPillStatusFilter] = useState("All");
	const [selectedLines, setSelectedLines] = useState<Record<string, boolean>>(
		{},
	);

	// --- SERVER RECORD RETRIEVAL MOCKS ---
	const [runs, setRuns] = useState<AnalysisRun[]>([]);
	const [lineItems, setLineItems] = useState<StatementLineItem[]>([]);
	const [loading, setLoading] = useState(false);

	// --- COOKIE INTERCEPT ENGINE ---
	useEffect(() => {
		const match = document.cookie.match(
			/(?:^|; )login_user_email_stub=([^;]*)/,
		);
		if (match && match[1]) {
			setUserDisplayName(decodeURIComponent(match[1]).split("@")[0]);
		}
	}, []);

	// --- DATA INITIALIZATION PIPELINE ---
	const loadDataFramework = useCallback(async () => {
		setLoading(true);
		try {
			const runCollection: AnalysisRun[] = [
				{
					id: "RUN-2026-001",
					time: "2026-06-09 09:30 AM",
					account_statement: "citi_5019_April-2026.xlsx",
					bank: "Citibank Europe",
					bu: "North America Enterprise",
					source: "S3 Storage Bucket",
					run_by: userDisplayName,
					total_rows: 1250,
					matched: 980,
					pending: 45,
					status: "Completed",
				},
				{
					id: "RUN-2026-002",
					time: "2026-06-08 02:15 PM",
					account_statement: "hsbc_statement_block_q2.csv",
					bank: "HSBC Holdings",
					bu: "UK Logistics Corp",
					source: "Manual Direct Upload",
					run_by: userDisplayName,
					total_rows: 450,
					matched: 310,
					pending: 80,
					status: "Completed",
				},
				{
					id: "RUN-2026-003",
					time: "2026-06-07 11:05 AM",
					account_statement: "jpm_chase_daily_settle.txt",
					bank: "JP Morgan Chase",
					bu: "APAC Operations",
					source: "SFTP Automation Hub",
					run_by: "System Pipeline",
					total_rows: 3120,
					matched: 2890,
					pending: 0,
					status: "Completed",
				},
			];
			setRuns(runCollection);

			const detailedLines: StatementLineItem[] = [
				{
					id: "L-101",
					bank: "Citibank Europe",
					bu: "North America Enterprise",
					date: "2026-06-09",
					narrative: "ACH INBOUND / AMZN_CORP_PAY_99",
					credit_amount: 145000.0,
					currency: "USD",
					extracted_customer: "Amazon Corp",
					extracted_invoice: "INV-2026-8891",
					method: "AI Extraction (v2.1)",
					confidence: 0.94,
					matched_customer: "Amazon Corporate Inc.",
					matched_invoice: "INV-2026-8891",
					outstanding: 0.0,
					inv_ccy: "USD",
					oracle_ref: "ORCL-REC-90112",
					status: "Matched",
				},
				{
					id: "L-102",
					bank: "Citibank Europe",
					bu: "North America Enterprise",
					date: "2026-06-09",
					narrative: "WIRE TRANSFER / FEDEX_SERVICES",
					credit_amount: 24890.0,
					currency: "USD",
					extracted_customer: "FedEx Inc",
					extracted_invoice: "UNSUPPORTED-ID",
					method: "AI Extraction (v2.1)",
					confidence: 0.58,
					matched_customer: "FedEx Services LLC",
					matched_invoice: "INV-2026-0114",
					outstanding: 120.0,
					inv_ccy: "USD",
					oracle_ref: "ORCL-REC-90115",
					status: "Review and Approve",
				},
				{
					id: "L-103",
					bank: "Citibank Europe",
					bu: "North America Enterprise",
					date: "2026-06-08",
					narrative: "DIRECT DEP / MISC_REVENUE_UNKNOWN",
					credit_amount: 8930.0,
					currency: "USD",
					extracted_customer: "Unknown Entity",
					extracted_invoice: "NONE",
					method: "Heuristic Fallback",
					confidence: 0.12,
					matched_customer: "—",
					matched_invoice: "—",
					outstanding: 8930.0,
					inv_ccy: "USD",
					oracle_ref: "—",
					status: "Not Found",
				},
			];
			setLineItems(detailedLines);
		} catch {}
		setLoading(false);
	}, [userDisplayName]);

	useEffect(() => {
		loadDataFramework();
	}, [loadDataFramework]);

	const handleTimePeriodSelect = (period: string) => {
		setTimePeriod(period);
		setIsCustomRangeActive(period === "Custom Range");
	};

	const exportHistoryMasterCSV = () => {
		if (!runs.length) return;
		const headers = Object.keys(runs[0]).join(",");
		const rows = runs
			.map((r) =>
				Object.values(r)
					.map((v) => `"${v ?? ""}"`)
					.join(","),
			)
			.join("\n");
		const blob = new Blob([headers + "\n" + rows], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = "analysis_history_master.csv";
		link.click();
	};

	const exportSubrouteLineCSV = () => {
		if (!lineItems.length) return;
		const headers = Object.keys(lineItems[0]).join(",");
		const rows = lineItems
			.map((l) =>
				Object.values(l)
					.map((v) => `"${v ?? ""}"`)
					.join(","),
			)
			.join("\n");
		const blob = new Blob([headers + "\n" + rows], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = `run_line_details_${viewingRunId}.csv`;
		link.click();
	};

	const toggleSelectAllLines = () => {
		if (Object.keys(selectedLines).length === lineItems.length) {
			setSelectedLines({});
		} else {
			const all: Record<string, boolean> = {};
			lineItems.forEach((l) => (all[l.id] = true));
			setSelectedLines(all);
		}
	};

	const toggleSingleLine = (id: string) => {
		setSelectedLines((prev) => ({ ...prev, [id]: !prev[id] }));
	};

	const filteredLineItems = useMemo(() => {
		return lineItems.filter((l) => {
			const matchDropdown =
				statusFilter === "All statuses" || l.status === statusFilter;
			const matchNarrativeText =
				l.narrative.toLowerCase().includes(searchNarrative.toLowerCase()) ||
				l.id.toLowerCase().includes(searchNarrative.toLowerCase());
			let matchPill = true;
			if (pillStatusFilter !== "All") {
				matchPill = l.status === pillStatusFilter;
			}
			return matchDropdown && matchNarrativeText && matchPill;
		});
	}, [lineItems, statusFilter, searchNarrative, pillStatusFilter]);

	const activeMetricsSummary = {
		total_rows: 1250,
		matched: 980,
		not_found: 145,
		passed: 980,
		failed: 80,
		pending: 45,
		approved: 950,
		rejected: 30,
	};

	// =========================================================================
	// ROUTE RENDERER 1: THE COMBINED 'ANALYSIS HISTORY' PRIMARY DASHBOARD PAGE
	// =========================================================================
	if (!viewingRunId) {
		return (
			<div className="space-y-6">
				<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2">
					<div>
						<h1 className="text-xl font-black text-primary uppercase tracking-wider">
							Analysis History
						</h1>
						<p className="text-xs text-gray-500 mt-0.5">
							All analysis runs across all account statements
						</p>
					</div>
					<button
						onClick={exportHistoryMasterCSV}
						className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider bg-[#1E3A5F] hover:bg-[#2E6DA4] text-white px-4 py-2.5 rounded-sm shadow-xs transition-colors cursor-pointer"
					>
						<Download size={13} /> Export History Master
					</button>
				</div>

				<div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 p-2 rounded-sm shadow-2xs">
					<div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xs">
						{["Latest", "Today", "Yesterday", "WTD", "MTD", "Custom Range"].map(
							(period) => (
								<button
									key={period}
									onClick={() => handleTimePeriodSelect(period)}
									className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-xs transition-all cursor-pointer ${
										timePeriod === period
											? "bg-[#1E3A5F] text-white shadow-xs"
											: "text-gray-500 hover:text-primary"
									}`}
								>
									{period}
								</button>
							),
						)}
					</div>

					{isCustomRangeActive && (
						<div className="flex items-center gap-1.5 border-l border-gray-200 pl-3">
							<input
								type="date"
								value={customStart}
								onChange={(e) => setCustomStart(e.target.value)}
								className="bg-gray-50 border border-gray-300 rounded-sm text-[10px] font-bold uppercase text-gray-600 px-2 py-1 outline-none focus:border-[#4A90E2]"
							/>
							<span className="text-[10px] font-bold text-gray-400">TO</span>
							<input
								type="date"
								value={customEnd}
								onChange={(e) => setCustomEnd(e.target.value)}
								className="bg-gray-50 border border-gray-300 rounded-sm text-[10px] font-bold uppercase text-gray-600 px-2 py-1 outline-none focus:border-[#4A90E2]"
							/>
						</div>
					)}
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
					<div className="relative">
						<Landmark
							size={14}
							className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
						/>
						<select
							value={selectedBank}
							onChange={(e) => setSelectedBank(e.target.value)}
							className="w-full bg-white border border-gray-300 text-xs font-bold text-primary pl-9 pr-8 py-2.5 rounded-sm appearance-none focus:outline-none focus:border-[#4A90E2] cursor-pointer"
						>
							<option>All Banks</option>
							<option>Citibank Europe</option>
							<option>HSBC Holdings</option>
							<option>JP Morgan Chase</option>
						</select>
						<ChevronDown
							size={14}
							className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
						/>
					</div>

					<div className="relative">
						<Briefcase
							size={14}
							className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
						/>
						<select
							value={selectedBU}
							onChange={(e) => setSelectedBU(e.target.value)}
							className="w-full bg-white border border-gray-300 text-xs font-bold text-primary pl-9 pr-8 py-2.5 rounded-sm appearance-none focus:outline-none focus:border-[#4A90E2] cursor-pointer"
						>
							<option>All BUs</option>
							<option>North America Enterprise</option>
							<option>UK Logistics Corp</option>
							<option>APAC Operations</option>
						</select>
						<ChevronDown
							size={14}
							className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
						/>
					</div>

					<div className="relative">
						<User
							size={14}
							className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
						/>
						<input
							type="text"
							placeholder="Search by user..."
							value={searchUser}
							onChange={(e) => setSearchUser(e.target.value)}
							className="w-full bg-white border border-gray-300 text-xs font-semibold text-primary pl-9 pr-4 py-2.5 rounded-sm focus:outline-none focus:border-[#4A90E2]"
						/>
					</div>
				</div>

				<div className="bg-white border border-gray-200 rounded-sm shadow-xs flex flex-col h-[520px]">
					<div className="flex-1 overflow-auto relative">
						<table className="w-full text-left border-collapse min-w-[1100px]">
							<thead className="sticky top-0 z-20 shadow-[0_1px_0_0_rgba(23,46,76,1)]">
								<tr className="bg-[#1E3A5F] text-white">
									{[
										"Time",
										"Account Statement",
										"Bank",
										"BU",
										"Source",
										"Run By",
										"Total Rows",
										"Matched",
										"Pending",
										"Status",
									].map((h) => (
										<th
											key={h}
											className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider bg-[#1E3A5F]"
										>
											{h}
										</th>
									))}
									<th className="sticky right-0 top-0 z-30 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider bg-[#1E3A5F] border-l border-[#172e4c] text-center w-24 shadow-[-2px_0_4px_rgba(0,0,0,0.1)]">
										View
									</th>
								</tr>
							</thead>
							<tbody className="text-[11px] divide-y divide-gray-200 font-medium text-gray-700 bg-white">
								{runs.map((r) => (
									<tr
										key={r.id}
										className="hover:bg-gray-50/80 transition-colors group"
									>
										<td className="px-3 py-3 whitespace-nowrap font-mono text-gray-500">
											{r.time}
										</td>
										<td className="px-3 py-3 font-bold text-primary flex items-center gap-1.5">
											<FileText size={12} className="text-gray-400" />
											<span>{r.account_statement}</span>
										</td>
										<td className="px-3 py-3 whitespace-nowrap font-bold text-primary">
											{r.bank}
										</td>
										<td className="px-3 py-3 whitespace-nowrap">{r.bu}</td>
										<td className="px-3 py-3 whitespace-nowrap text-gray-500 font-mono">
											{r.source}
										</td>
										<td className="px-3 py-3 whitespace-nowrap font-semibold text-gray-600">
											{r.run_by}
										</td>
										<td className="px-3 py-3 text-right font-bold font-mono">
											{r.total_rows.toLocaleString()}
										</td>
										<td className="px-3 py-3 text-right font-bold font-mono text-emerald-600">
											{r.matched.toLocaleString()}
										</td>
										<td className="px-3 py-3 text-right font-bold font-mono text-amber-600">
											{r.pending.toLocaleString()}
										</td>
										<td className="px-3 py-3 whitespace-nowrap">
											<span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xs px-2 py-0.5">
												{r.status}
											</span>
										</td>
										<td className="sticky right-0 bg-white group-hover:bg-gray-50 transition-colors px-4 py-2 border-l border-gray-100 text-center shadow-[-2px_0_4px_rgba(0,0,0,0.04)] z-10">
											<button
												onClick={() => setViewingRunId(r.id)}
												className="inline-flex items-center gap-1 bg-[#1E3A5F] hover:bg-[#2E6DA4] text-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-xs shadow-xs transition-colors cursor-pointer"
											>
												<Eye size={11} />
												<span>Inspect</span>
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

	// =========================================================================
	// ROUTE RENDERER 2: THE INTERACTIVE 'VIEW' SPLIT SUBROUTE LAYER
	// =========================================================================
	return (
		<div className="flex flex-col h-full overflow-hidden space-y-4">
			{/* FIXED TOP ROW: BACK CONTROL ANCHOR */}
			<div className="pb-2 border-b border-gray-200 flex-shrink-0">
				<button
					onClick={() => {
						setViewingRunId(null);
						setSelectedLines({});
					}}
					className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#1E3A5F] hover:text-[#2E6DA4] transition-colors cursor-pointer"
				>
					<ArrowLeft size={14} className="stroke-[3]" />
					<span>Back to Analysis History</span>
				</button>
			</div>

			{/* VIEWPORT BALANCED CONTROLLER CONTAINER */}
			<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch flex-1 min-h-0 overflow-hidden">
				{/* ===================================================================
            LEFT SPLIT INTERFACE PANEL: IMMUTABLE FULL CONTAINER HEIGHT PREVIEW 
           =================================================================== */}
				<div className="lg:col-span-4 flex flex-col h-full overflow-hidden">
					<div className="border border-gray-200 bg-gray-100 flex-1 flex flex-col items-center justify-center rounded-sm text-center border-dashed relative p-6 h-full">
						<div className="absolute top-2 left-2 bg-[#1E3A5F] text-white text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-xs shadow-xs">
							Statement Preview Window
						</div>
						<div className="flex flex-col items-center justify-center">
							<FileText
								size={48}
								className="text-gray-400 mb-3 stroke-[1.25]"
							/>
							<span className="text-xs font-black text-primary uppercase tracking-wider block">
								citi_5019_April-2026.xlsx
							</span>
							<span className="text-[10px] font-mono text-gray-400 mt-1 uppercase tracking-wider max-w-xs">
								Preview Sandbox Content Restricted Over Pipeline APIs
							</span>
						</div>
					</div>
				</div>

				{/* ===================================================================
            RIGHT SPLIT INTERFACE PANEL: SOLE VERTICAL SCROLL LAYERING AREA
           =================================================================== */}
				<div className="lg:col-span-8 flex flex-col h-full overflow-y-auto space-y-4 pr-2">
					{/* HEADER ROW FILE METADATA CONTROL BLOCK */}
					<div className="flex flex-col sm:flex-row items-start justify-between gap-4 bg-white border border-gray-200 p-4 rounded-sm shadow-2xs flex-shrink-0">
						<div>
							<h2 className="text-sm font-black text-primary uppercase tracking-wider font-mono">
								citi_5019_April-2026.xlsx
							</h2>
							<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500 font-bold mt-1.5">
								<span>Citibank Europe</span>
								<span className="text-gray-300">•</span>
								<span>North America Enterprise</span>
								<span className="text-gray-300">•</span>
								<span>Run by {userDisplayName}</span>
							</div>
						</div>

						<button
							onClick={exportSubrouteLineCSV}
							className="flex items-center gap-2 text-xs font-black uppercase tracking-wider bg-[#1E3A5F] hover:bg-[#2E6DA4] text-white px-4 py-2 rounded-sm transition-colors shadow-2xs cursor-pointer whitespace-nowrap"
						>
							<Download size={13} /> Download CSV
						</button>
					</div>

					{/* TELEMETRY RUN METRIC METRICS CARDS GRID */}
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-shrink-0">
						{/* Metric 1: Total rows */}
						<div className="border border-gray-200 p-3 rounded-sm bg-gray-50/30 flex flex-col justify-between">
							<div>
								<div className="flex items-center gap-1.5 text-gray-400 mb-0.5">
									<Layers size={12} className="text-[#1E3A5F]" />
									<span className="text-[9px] font-bold uppercase tracking-wider">
										Total rows
									</span>
								</div>
								<div className="text-lg font-black text-primary">
									{activeMetricsSummary.total_rows.toLocaleString()}
								</div>
							</div>
							<div className="mt-1 text-[9px] text-gray-400 font-medium leading-tight">
								Statement Ledger Rows
							</div>
						</div>

						{/* Metric 2: Matched */}
						<div className="border border-gray-200 p-3 rounded-sm bg-gray-50/30 flex flex-col justify-between">
							<div>
								<div className="flex items-center gap-1.5 text-emerald-600 mb-0.5">
									<Sparkles size={12} />
									<span className="text-[9px] font-bold uppercase tracking-wider">
										Matched
									</span>
								</div>
								<div className="text-lg font-black text-primary">
									{activeMetricsSummary.matched.toLocaleString()}
								</div>
							</div>
							<div className="mt-1 text-[9px] text-gray-400 font-medium leading-tight">
								ERP Invoices Identified
							</div>
						</div>

						{/* Metric 3: Not Found */}
						<div className="border border-gray-200 p-3 rounded-sm bg-gray-50/30 flex flex-col justify-between">
							<div>
								<div className="flex items-center gap-1.5 text-red-500 mb-0.5">
									<AlertTriangle size={12} />
									<span className="text-[9px] font-bold uppercase tracking-wider">
										Not Found
									</span>
								</div>
								<div className="text-lg font-black text-primary">
									{activeMetricsSummary.not_found.toLocaleString()}
								</div>
							</div>
							<div className="mt-1 text-[9px] text-gray-400 font-medium leading-tight">
								Requires Manual Exception
							</div>
						</div>

						{/* Metric 4: Passed Validation */}
						<div className="border border-gray-200 p-3 rounded-sm bg-gray-50/30 flex flex-col justify-between">
							<div>
								<div className="flex items-center gap-1.5 text-[#4A90E2] mb-0.5">
									<ShieldCheck size={12} />
									<span className="text-[9px] font-bold uppercase tracking-wider">
										Passed Validation
									</span>
								</div>
								<div className="text-lg font-black text-primary">
									{activeMetricsSummary.passed.toLocaleString()}
								</div>
							</div>
							<div className="mt-1 text-[9px] text-gray-400 font-medium leading-tight">
								Clears Variance Tolerances
							</div>
						</div>

						{/* Metric 5: Failed Validation */}
						<div className="border border-gray-200 p-3 rounded-sm bg-gray-50/30 flex flex-col justify-between">
							<div>
								<div className="flex items-center gap-1.5 text-red-600 mb-0.5">
									<AlertTriangle size={12} />
									<span className="text-[9px] font-bold uppercase tracking-wider">
										Failed Validation
									</span>
								</div>
								<div className="text-lg font-black text-primary">
									{activeMetricsSummary.failed.toLocaleString()}
								</div>
							</div>
							<div className="mt-1 text-[9px] text-gray-400 font-medium leading-tight">
								Amount Mismatch Flags
							</div>
						</div>

						{/* Metric 6: Pending Approval */}
						<div className="border border-gray-200 p-3 rounded-sm bg-gray-50/30 flex flex-col justify-between">
							<div>
								<div className="flex items-center gap-1.5 text-amber-500 mb-0.5">
									<Calendar size={12} />
									<span className="text-[9px] font-bold uppercase tracking-wider">
										Pending Approval
									</span>
								</div>
								<div className="text-lg font-black text-primary">
									{activeMetricsSummary.pending.toLocaleString()}
								</div>
							</div>
							<div className="mt-1 text-[9px] text-gray-400 font-medium leading-tight">
								Awaiting Clear Queue
							</div>
						</div>

						{/* Metric 7: Approved & Posted */}
						<div className="border border-gray-200 p-3 rounded-sm bg-gray-50/30 flex flex-col justify-between">
							<div>
								<div className="flex items-center gap-1.5 text-emerald-600 mb-0.5">
									<CheckSquare size={12} />
									<span className="text-[9px] font-bold uppercase tracking-wider">
										Approved & Posted
									</span>
								</div>
								<div className="text-lg font-black text-[#1E3A5F]">
									{activeMetricsSummary.approved.toLocaleString()}
								</div>
							</div>
							<div className="mt-1 text-[9px] text-gray-400 font-medium leading-tight">
								Committed to Oracle
							</div>
						</div>

						{/* Metric 8: Rejected */}
						<div className="border border-gray-200 p-3 rounded-sm bg-gray-50/30 flex flex-col justify-between">
							<div>
								<div className="flex items-center gap-1.5 text-red-500 mb-0.5">
									<X size={12} className="stroke-[2.5]" />
									<span className="text-[9px] font-bold uppercase tracking-wider">
										Rejected
									</span>
								</div>
								<div className="text-lg font-black text-primary">
									{activeMetricsSummary.rejected.toLocaleString()}
								</div>
							</div>
							<div className="mt-1 text-[9px] text-gray-400 font-medium leading-tight">
								Returned to Pipeline Queue
							</div>
						</div>
					</div>

					{/* INTERACTIVE DATA CONSOLE FILTER BAR */}
					<div className="bg-white border border-gray-200 p-4 shadow-xs space-y-3 flex-shrink-0">
						<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
							<h3 className="text-xs font-black text-primary uppercase tracking-wider">
								Line Items Ledger
							</h3>

							<div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
								<div className="relative w-full sm:w-44">
									<select
										value={statusFilter}
										onChange={(e) => setStatusFilter(e.target.value)}
										className="w-full bg-white border border-gray-300 text-[11px] font-bold text-primary px-2.5 py-2 rounded-sm appearance-none focus:outline-none focus:border-[#4A90E2] cursor-pointer"
									>
										<option>All statuses</option>
										<option>Matched</option>
										<option>Not Found</option>
										<option>Review and Approve</option>
										<option>Processed</option>
									</select>
									<ChevronDown
										size={13}
										className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
									/>
								</div>

								<div className="relative w-full sm:w-56">
									<Search
										size={13}
										className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
									/>
									<input
										type="text"
										placeholder="Search narrative..."
										value={searchNarrative}
										onChange={(e) => setSearchNarrative(e.target.value)}
										className="w-full bg-white border border-gray-300 text-[11px] font-medium text-primary pl-8 pr-3 py-2 rounded-sm focus:outline-none focus:border-[#4A90E2]"
									/>
								</div>
							</div>
						</div>

						{/* FILTER HORIZONTAL PILLS */}
						<div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xs w-max max-w-full overflow-x-auto">
							{[
								"All",
								"Matched",
								"Not Found",
								"Review and Approve",
								"Processed",
							].map((pill) => (
								<button
									key={pill}
									onClick={() => setPillStatusFilter(pill)}
									className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-xs transition-all whitespace-nowrap cursor-pointer ${
										pillStatusFilter === pill
											? "bg-[#1E3A5F] text-white shadow-xs"
											: "text-gray-500 hover:text-primary"
									}`}
								>
									{pill}
								</button>
							))}
						</div>
					</div>

					{/* MATRIX CONTAINER HOUSING SUB-HORIZONTAL SCROLL ONLY FOR WIDE TABLES */}
					<div className="bg-white border border-gray-200 rounded-sm shadow-xs flex flex-col min-h-[380px] max-h-[500px] flex-grow">
						<div className="flex-1 overflow-auto relative">
							<table className="w-full text-left border-collapse min-w-[2100px]">
								<thead className="sticky top-0 z-20 shadow-[0_1px_0_0_rgba(23,46,76,1)]">
									<tr className="bg-[#1E3A5F] text-white">
										<th className="px-3 py-2.5 bg-[#1E3A5F] w-10 text-center">
											<input
												type="checkbox"
												checked={
													Object.keys(selectedLines).length ===
														lineItems.length && lineItems.length > 0
												}
												onChange={toggleSelectAllLines}
												className="rounded-xs text-[#4A90E2] focus:ring-0 cursor-pointer"
											/>
										</th>
										{[
											"Bank",
											"BU",
											"Date",
											"Narrative",
											"Credit Amount",
											"Currency",
											"Extracted Customer",
											"Extracted Invoice",
											"Method",
											"Confidence",
											"Matched Customer",
											"Matched Invoice",
											"Outstanding",
											"Inv. ccy",
											"Oracle Ref",
											"Status",
										].map((h) => (
											<th
												key={h}
												className={`px-3 py-2.5 text-[10px] font-black uppercase tracking-wider bg-[#1E3A5F] ${h === "Credit Amount" || h === "Outstanding" ? "text-right" : ""}`}
											>
												{h}
											</th>
										))}
										<th className="sticky right-0 top-0 z-30 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider bg-[#1E3A5F] border-l border-[#172e4c] text-center w-24 shadow-[-2px_0_4px_rgba(0,0,0,0.1)]">
											Actions
										</th>
									</tr>
								</thead>

								<tbody className="text-[11px] divide-y divide-gray-200 font-medium text-gray-700 bg-white">
									{filteredLineItems.length === 0 ? (
										<tr>
											<td
												colSpan={18}
												className="text-center py-24 text-xs font-bold text-gray-400 bg-gray-50/20"
											>
												No entries found matching the workspace filter state
												criteria.
											</td>
										</tr>
									) : (
										filteredLineItems.map((line) => (
											<tr
												key={line.id}
												className={`hover:bg-gray-50/80 transition-colors group ${selectedLines[line.id] ? "bg-blue-50/20" : ""}`}
											>
												<td className="px-3 py-3 text-center">
													<input
														type="checkbox"
														checked={!!selectedLines[line.id]}
														onChange={() => toggleSingleLine(line.id)}
														className="rounded-xs text-[#4A90E2] focus:ring-0 cursor-pointer"
													/>
												</td>
												<td className="px-3 py-3 whitespace-nowrap font-bold text-primary">
													{line.bank}
												</td>
												<td className="px-3 py-3 whitespace-nowrap text-xs font-semibold">
													{line.bu}
												</td>
												<td className="px-3 py-3 whitespace-nowrap font-mono">
													{line.date}
												</td>
												<td
													className="px-3 py-3 font-mono text-gray-600 max-w-xs truncate"
													title={line.narrative}
												>
													{line.narrative}
												</td>
												<td className="px-3 py-3 text-right font-black font-mono text-primary">
													{line.credit_amount.toLocaleString(undefined, {
														minimumFractionDigits: 2,
													})}
												</td>
												<td className="px-3 py-3 font-bold text-gray-400">
													{line.currency}
												</td>
												<td className="px-3 py-3 whitespace-nowrap font-bold text-gray-600">
													{line.extracted_customer}
												</td>
												<td className="px-3 py-3 font-mono text-gray-500">
													{line.extracted_invoice}
												</td>
												<td className="px-3 py-3 whitespace-nowrap text-gray-500 font-semibold">
													{line.method}
												</td>
												<td className="px-3 py-3 font-mono">
													<span
														className={`text-[10px] px-1.5 py-0.5 rounded-xs font-bold text-white ${line.confidence >= 0.8 ? "bg-emerald-600" : "bg-amber-600"}`}
													>
														{(line.confidence * 100).toFixed(0)}%
													</span>
												</td>
												<td className="px-3 py-3 whitespace-nowrap font-bold text-primary">
													{line.matched_customer}
												</td>
												<td className="px-3 py-3 font-mono font-bold text-primary">
													{line.matched_invoice}
												</td>
												<td className="px-3 py-3 text-right font-mono text-gray-500">
													{line.outstanding.toLocaleString(undefined, {
														minimumFractionDigits: 2,
													})}
												</td>
												<td className="px-3 py-3 font-bold text-gray-400">
													{line.inv_ccy}
												</td>
												<td className="px-3 py-3 font-mono text-gray-600">
													{line.oracle_ref}
												</td>
												<td className="px-3 py-3 whitespace-nowrap">
													<StatusBadge value={line.status} />
												</td>
												<td className="sticky right-0 bg-white group-hover:bg-gray-50 transition-colors px-4 py-2 border-l border-gray-100 shadow-[-2px_0_4px_rgba(0,0,0,0.04)] z-10 text-center">
													<div className="inline-flex items-center justify-center gap-1">
														<button
															title="Approve and Post to Oracle"
															className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-xs border border-transparent hover:border-emerald-200 transition-all cursor-pointer"
														>
															<Check size={14} className="stroke-[3]" />
														</button>
														<button
															title="Reject Match Context"
															className="p-1 text-red-500 hover:bg-red-50 rounded-xs border border-transparent hover:border-red-200 transition-all cursor-pointer"
														>
															<X size={14} className="stroke-[3]" />
														</button>
													</div>
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}