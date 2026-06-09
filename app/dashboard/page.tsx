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
import { useCallback, useEffect, useState } from "react";
import {
	Cell,
	Legend,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
} from "recharts";
import StatusBadge from "@/components/StatusBadge";
import {
	getAgingStatus,
	getFiles,
	getMetrics,
	getStatus,
	refreshAging,
	resetRun,
	startRun,
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

// Global Core Color Matrix - Perfectly synchronized across labels, pills, and chart paths
const METRIC_CONFIG = {
	found: { name: "Automated Matches", color: "#1E3A5F" },
	notFound: { name: "Unresolved Exceptions", color: "#2E6DA4" },
	passed: { name: "Compliant Clearances", color: "#4A90E2" },
	failed: { name: "Validation Failures", color: "#e11d48" },
	pending: { name: "Awaiting Authorization", color: "#f59e0b" },
};

export default function Dashboard() {
	const [files, setFiles] = useState<FileInfo[]>([]);
	const [runStatus, setRunStatus] = useState<{
		status: string;
		message: string;
		progress_current: number;
	}>({
		status: "idle",
		message: "",
		progress_current: 0,
	});
	const [metrics, setMetrics] = useState<Metrics | null>(null);
	const [agingStatus, setAgingStatus] = useState<{
		loaded: boolean;
		row_count: number;
		filename: string | null;
	}>({
		loaded: false,
		row_count: 0,
		filename: null,
	});
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	// Dashboard Telemetry Filters State
	const [timePeriod, setTimePeriod] = useState("Last Analysis");
	const [selectedBank, setSelectedBank] = useState("All Banks");
	const [selectedBU, setSelectedBU] = useState("All BUs");
	const [selectedUser, setSelectedUser] = useState("All Users");

	// Interactive Checklist Tracking Matrix
	const [activeMetrics, setActiveMetrics] = useState({
		found: true,
		notFound: true,
		passed: true,
		failed: true,
		pending: true,
	});

	const [userDisplayName, setUserDisplayName] = useState("Admin User");

	const fetchFiles = useCallback(async () => {
		try {
			const res = await getFiles();
			setFiles(res.data.files);
		} catch {
			setError(
				"Could not connect to backend system. Verify server configuration.",
			);
		}
	}, []);

	const fetchMetrics = useCallback(async () => {
		try {
			const [m, a] = await Promise.all([getMetrics(), getAgingStatus()]);
			setMetrics(m.data);
			setAgingStatus(a.data);
		} catch {}
	}, []);

	const fetchStatus = useCallback(async () => {
		try {
			const res = await getStatus();
			setRunStatus(res.data);
			if (res.data.status === "completed" || res.data.status === "error")
				fetchMetrics();
		} catch {}
	}, [fetchMetrics]);

	useEffect(() => {
		fetchFiles();
		fetchMetrics();

		const match = document.cookie.match(
			/(?:^|; )login_user_email_stub=([^;]*)/,
		);
		if (match && match[1]) {
			const email = decodeURIComponent(match[1]);
			setUserDisplayName(email.split("@")[0]);
		}
	}, [fetchFiles, fetchMetrics]);

	useEffect(() => {
		if (runStatus.status !== "running") return;
		const interval = setInterval(fetchStatus, 2000);
		return () => clearInterval(interval);
	}, [runStatus.status, fetchStatus]);

	const handleStart = async () => {
		if (!agingStatus.loaded) {
			setError(
				"Required validation context missing: Please load aging ledger data first.",
			);
			return;
		}
		if (files.length === 0) {
			setError(
				"No statement batches specified: Upload statement targets first.",
			);
			return;
		}
		setError("");
		setLoading(true);
		try {
			await startRun(files.map((f) => f.filename));
			fetchStatus();
		} catch (e: any) {
			setError(
				e?.response?.data?.detail ||
					"Failed to initiate automated extraction pipeline",
			);
		}
		setLoading(false);
	};

	const isRunning = runStatus.status === "running";

	const getSystemStatusLabel = () => {
		if (isRunning) return "Pipeline Executing";
		if (!agingStatus.loaded && files.length === 0)
			return "Awaiting Structural Artifacts";
		if (!agingStatus.loaded) return "Awaiting Active Ledger";
		if (files.length === 0) return "Awaiting Target Statements";
		return "Workspace Configured & Verified";
	};

	const toggleMetricVisibility = (key: keyof typeof activeMetrics) => {
		setActiveMetrics((prev) => ({ ...prev, [key]: !prev[key] }));
	};

	// Generates complete configuration-mapped runtime structural chart array data
	const getPieChartData = () => {
		if (!metrics) return [];
		const rawData = [
			{
				id: "found",
				name: METRIC_CONFIG.found.name,
				value: metrics.found ?? 0,
				color: METRIC_CONFIG.found.color,
			},
			{
				id: "notFound",
				name: METRIC_CONFIG.notFound.name,
				value: metrics.not_found ?? 0,
				color: METRIC_CONFIG.notFound.color,
			},
			{
				id: "passed",
				name: METRIC_CONFIG.passed.name,
				value: metrics.passed_validation ?? 0,
				color: METRIC_CONFIG.passed.color,
			},
			{
				id: "failed",
				name: METRIC_CONFIG.failed.name,
				value: metrics.failed_validation ?? 0,
				color: METRIC_CONFIG.failed.color,
			},
			{
				id: "pending",
				name: METRIC_CONFIG.pending.name,
				value: metrics.pending_hitl ?? 0,
				color: METRIC_CONFIG.pending.color,
			},
		];
		return rawData.filter(
			(item) =>
				activeMetrics[item.id as keyof typeof activeMetrics] && item.value > 0,
		);
	};

	const pieChartData = getPieChartData();

	// Unified fallback baseline protection logic
	const displayMetrics = metrics || {
		total_rows_ingested: 0,
		found: 0,
		not_found: 0,
		passed_validation: 0,
		failed_validation: 0,
		pending_hitl: 0,
		approved: 0,
		rejected: 0,
	};

	return (
		<div className="space-y-6">
			{/* ONBOARDING HERO BANNER */}
			<div className="bg-white border border-gray-200 p-6 shadow-sm relative overflow-hidden">
				<div className="absolute top-0 right-0 p-4 opacity-5 text-primary pointer-events-none">
					<CloudLightning size={120} />
				</div>
				<div className="max-w-3xl">
					<h2 className="text-xl font-bold text-primary capitalize flex items-center gap-2">
						Welcome back, {userDisplayName}
					</h2>
					<p className="text-sm text-gray-600 mt-1.5 leading-relaxed">
						Your workspace is ready. Upload your account statements and aging
						report below, then start the matching process. The AI will
						automatically identify customers, match invoices, and flag anything
						that needs your attention - all in seconds!
					</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
					<div className="flex gap-3">
						<div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-accent">
							1
						</div>
						<div>
							<h4 className="text-xs font-bold text-primary uppercase tracking-wide">
								Review or add files
							</h4>
							<p className="text-[11px] text-gray-500 mt-0.5">
								Check the files loaded below. Upload a new bank statement or
								aging report if needed.
							</p>
						</div>
					</div>
					<div className="flex gap-3">
						<div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-accent">
							2
						</div>
						<div>
							<h4 className="text-xs font-bold text-primary uppercase tracking-wide">
								Start matching
							</h4>
							<p className="text-[11px] text-gray-500 mt-0.5">
								Select the bank statement files you want to run and click Run
								matching.
							</p>
						</div>
					</div>
					<div className="flex gap-3">
						<div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-accent">
							3
						</div>
						<div>
							<h4 className="text-xs font-bold text-primary uppercase tracking-wide">
								Review results
							</h4>
							<p className="text-[11px] text-gray-500 mt-0.5">
								Go to Review and approve to validate AI-matched transactions, or
								check Dashboard for analysis summary.
							</p>
						</div>
					</div>
				</div>
			</div>

			{error && (
				<div className="bg-red-50/50 backdrop-blur-sm border-l-4 border-red-600 text-gray-900 px-4 py-3.5 shadow-sm text-sm flex items-center justify-between transition-all">
					<div className="flex items-center gap-3">
						<AlertTriangle size={18} className="text-red-600 shrink-0" />
						<span className="font-medium tracking-wide">{error}</span>
					</div>
					<button
						onClick={() => setError("")}
						className="text-gray-400 hover:text-gray-600 px-2 text-base"
					>
						×
					</button>
				</div>
			)}

			{/* UPLOAD AREA ROW */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<div className="bg-white border border-gray-200 p-6 shadow-sm flex flex-col justify-between min-h-[220px]">
					<div>
						<h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2 mb-4">
							<Layers size={14} className="text-accent" /> Aging Report
						</h3>
						<button className="w-full flex items-center justify-center gap-2.5 border border-dashed border-gray-300 hover:border-primary text-primary py-4 px-4 text-xs font-bold uppercase tracking-wider bg-gray-50/50 hover:bg-gray-50 transition-all group">
							<UploadCloud size={16} className="text-accent shrink-0" />
							<span>Upload from local</span>
						</button>
					</div>
					<div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
						<span>Supported: Excel, CSV (Max 10MB)</span>
						{agingStatus.loaded ? (
							<span className="text-emerald-600 font-bold flex items-center gap-1">
								<CheckCircle2 size={12} />{" "}
								{agingStatus.row_count.toLocaleString()} rows active
							</span>
						) : (
							<span className="text-amber-600 font-medium">
								No report loaded
							</span>
						)}
					</div>
				</div>

				<div className="bg-white border border-gray-200 p-6 shadow-sm flex flex-col justify-between min-h-[220px]">
					<div>
						<h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2 mb-4">
							<FileText size={14} className="text-accent" /> Account Statements
						</h3>
						<button className="w-full flex items-center justify-center gap-2.5 border border-dashed border-gray-300 hover:border-primary text-primary py-4 px-4 text-xs font-bold uppercase tracking-wider bg-gray-50/50 hover:bg-gray-50 transition-all group">
							<UploadCloud size={16} className="text-accent shrink-0" />
							<span>Upload from local</span>
						</button>
					</div>
					<div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
						<span>Supported: MT940, BAI2, CSV, PDF</span>
						<span className="text-primary font-bold">
							{files.length} statements ready
						</span>
					</div>
				</div>
			</div>

			{/* REFRAMED SYSTEM STATUS ENGINE ROW */}
			<div className="bg-[#1E3A5F] text-white px-5 py-4 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 border border-[#172e4c]">
				<div className="flex items-center gap-3">
					<RefreshCw
						size={14}
						className={`text-[#4A90E2] ${isRunning ? "animate-spin" : ""}`}
					/>
					<div className="text-xs font-medium text-gray-200">
						<span>System Status</span>
						<span className="text-gray-400 px-1.5">|</span>
						<span className="text-white font-bold tracking-wide">
							{getSystemStatusLabel()}
						</span>
					</div>
				</div>
				<button
					onClick={handleStart}
					disabled={
						isRunning || loading || files.length === 0 || !agingStatus.loaded
					}
					className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#4A90E2] hover:bg-[#357ABD] text-white px-6 py-2.5 font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-20 disabled:cursor-not-allowed shadow-md group whitespace-nowrap rounded-sm"
				>
					<Play size={11} className="fill-current" />
					<span>start analysis</span>
					<ArrowRight
						size={12}
						className="ml-0.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
					/>
				</button>
			</div>

			{/* DASHBOARD CONTROL PANEL & TELEMETRY HUB */}
			<div className="bg-white border border-gray-200 p-6 shadow-sm space-y-6">
				{/* HEADER BLOCK */}
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100">
					<div>
						<h2 className="text-base font-black text-primary uppercase tracking-tight">
							Dashboard
						</h2>
						<p className="text-xs text-gray-500 mt-0.5">
							Overall summary for the selected period and applied filters
						</p>
					</div>

					{/* TIME PERIOD PILLS */}
					<div className="flex flex-wrap items-center gap-1.5 bg-gray-100 p-1 rounded-sm self-start md:self-auto">
						{["Last Analysis", "Today", "Yesterday", "WTD", "MTD"].map(
							(period) => (
								<button
									key={period}
									onClick={() => setTimePeriod(period)}
									className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-xs transition-all ${
										timePeriod === period
											? "bg-[#1E3A5F] text-white shadow-sm"
											: "text-gray-500 hover:text-primary"
									}`}
								>
									{period}
								</button>
							),
						)}
					</div>
				</div>

				{/* DROPDOWNS CONTROL ROW */}
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
					<div className="relative">
						<Landmark
							size={14}
							className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
						/>
						<select
							value={selectedBank}
							onChange={(e) => setSelectedBank(e.target.value)}
							className="w-full bg-white border border-gray-300 text-xs font-semibold text-primary pl-9 pr-8 py-2.5 rounded-sm appearance-none focus:outline-none focus:border-accent cursor-pointer transition-colors"
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
							className="w-full bg-white border border-gray-300 text-xs font-semibold text-primary pl-9 pr-8 py-2.5 rounded-sm appearance-none focus:outline-none focus:border-accent cursor-pointer transition-colors"
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
						<select
							value={selectedUser}
							onChange={(e) => setSelectedUser(e.target.value)}
							className="w-full bg-white border border-gray-300 text-xs font-semibold text-primary pl-9 pr-8 py-2.5 rounded-sm appearance-none focus:outline-none focus:border-accent cursor-pointer transition-colors"
						>
							<option>All Users</option>
							<option>Admin Controller</option>
							<option>Operations Specialist</option>
							<option>System Automation Pipeline</option>
						</select>
						<ChevronDown
							size={14}
							className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
						/>
					</div>
				</div>

				{/* 8 MINI CARDS GRID */}
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
					<div className="border border-gray-200 p-4 rounded-sm bg-gray-50/30">
						<div className="flex items-center gap-1.5 text-gray-400 mb-1">
							<Layers size={13} className="text-[#1E3A5F]" />
							<span className="text-[10px] font-bold uppercase tracking-wider">
								Gross Capital Scanned
							</span>
						</div>
						<div className="text-xl font-black text-primary">
							{(displayMetrics.total_rows_ingested ?? 0).toLocaleString()}
						</div>
					</div>

					<div className="border border-gray-200 p-4 rounded-sm bg-gray-50/30">
						<div className="flex items-center gap-1.5 text-gray-400 mb-1">
							<Sparkles size={13} className="text-[#1E3A5F]" />
							<span className="text-[10px] font-bold uppercase tracking-wider">
								{METRIC_CONFIG.found.name}
							</span>
						</div>
						<div className="text-xl font-black text-primary">
							{(displayMetrics.found ?? 0).toLocaleString()}
						</div>
					</div>

					<div className="border border-gray-200 p-4 rounded-sm bg-gray-50/30">
						<div className="flex items-center gap-1.5 text-gray-400 mb-1">
							<AlertTriangle size={13} className="text-[#2E6DA4]" />
							<span className="text-[10px] font-bold uppercase tracking-wider">
								{METRIC_CONFIG.notFound.name}
							</span>
						</div>
						<div className="text-xl font-black text-primary">
							{(displayMetrics.not_found ?? 0).toLocaleString()}
						</div>
					</div>

					<div className="border border-gray-200 p-4 rounded-sm bg-gray-50/30">
						<div className="flex items-center gap-1.5 text-gray-400 mb-1">
							<ShieldCheck size={13} className="text-[#4A90E2]" />
							<span className="text-[10px] font-bold uppercase tracking-wider">
								{METRIC_CONFIG.passed.name}
							</span>
						</div>
						<div className="text-xl font-black text-primary">
							{(displayMetrics.passed_validation ?? 0).toLocaleString()}
						</div>
					</div>

					<div className="border border-gray-200 p-4 rounded-sm bg-gray-50/30">
						<div className="flex items-center gap-1.5 text-gray-400 mb-1">
							<Ban size={13} className="text-[#e11d48]" />
							<span className="text-[10px] font-bold uppercase tracking-wider">
								{METRIC_CONFIG.failed.name}
							</span>
						</div>
						<div className="text-xl font-black text-primary">
							{(displayMetrics.failed_validation ?? 0).toLocaleString()}
						</div>
					</div>

					<div className="border border-gray-200 p-4 rounded-sm bg-gray-50/30">
						<div className="flex items-center gap-1.5 text-gray-400 mb-1">
							<Calendar size={13} className="text-[#f59e0b]" />
							<span className="text-[10px] font-bold uppercase tracking-wider">
								{METRIC_CONFIG.pending.name}
							</span>
						</div>
						<div className="text-xl font-black text-primary">
							{(displayMetrics.pending_hitl ?? 0).toLocaleString()}
						</div>
					</div>

					<div className="border border-gray-200 p-4 rounded-sm bg-gray-50/30">
						<div className="flex items-center gap-1.5 text-gray-400 mb-1">
							<ClipboardCheck size={13} className="text-emerald-600" />
							<span className="text-[10px] font-bold uppercase tracking-wider">
								Oracle Fusion Commits
							</span>
						</div>
						<div className="text-xl font-black text-primary">
							{(displayMetrics.approved ?? 0).toLocaleString()}
						</div>
					</div>

					<div className="border border-gray-200 p-4 rounded-sm bg-gray-50/30">
						<div className="flex items-center gap-1.5 text-gray-400 mb-1">
							<XCircleIcon size={13} className="text-red-500" />
							<span className="text-[10px] font-bold uppercase tracking-wider">
								Declined Settlements
							</span>
						</div>
						<div className="text-xl font-black text-primary">
							{(displayMetrics.rejected ?? 0).toLocaleString()}
						</div>
					</div>
				</div>

				<hr className="border-gray-200" />

				{/* METRICS INTERACTIVE SELECTION PANEL & DISTRIBUTION PIE CHART */}
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-2">
					{/* LEFT SIDE: SELECTION PANEL WITH PILL-SHAPED SELECTORS */}
					<div className="lg:col-span-5 space-y-4">
						<div>
							<h4 className="text-xs font-black text-primary uppercase tracking-wider">
								Select metrics to display
							</h4>
							<p className="text-[11px] text-gray-500 mt-0.5">
								Click parameters below to dynamically recalibrate the corporate
								distribution chart share.
							</p>
						</div>

						<div className="flex flex-wrap gap-2 pt-1">
							{/* Pill 1: Found */}
							<button
								type="button"
								onClick={() => toggleMetricVisibility("found")}
								className={`flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-bold transition-all shadow-xs ${
									activeMetrics.found
										? "bg-[#1E3A5F]/5 text-[#1E3A5F]"
										: "border-gray-200 bg-white text-gray-400 hover:border-gray-300"
								}`}
								style={{
									borderColor: activeMetrics.found
										? METRIC_CONFIG.found.color
										: "",
								}}
							>
								<span
									className="w-2 h-2 rounded-full shrink-0"
									style={{
										backgroundColor: activeMetrics.found
											? METRIC_CONFIG.found.color
											: "#d1d5db",
									}}
								/>
								<span>{METRIC_CONFIG.found.name}</span>
								<span
									className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold ${activeMetrics.found ? "text-white" : "bg-gray-100 text-gray-400"}`}
									style={{
										backgroundColor: activeMetrics.found
											? METRIC_CONFIG.found.color
											: "",
									}}
								>
									{(displayMetrics.found ?? 0).toLocaleString()}
								</span>
							</button>

							{/* Pill 2: Not Found */}
							<button
								type="button"
								onClick={() => toggleMetricVisibility("notFound")}
								className={`flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-bold transition-all shadow-xs ${
									activeMetrics.notFound
										? "bg-[#2E6DA4]/5 text-[#2E6DA4]"
										: "border-gray-200 bg-white text-gray-400 hover:border-gray-300"
								}`}
								style={{
									borderColor: activeMetrics.notFound
										? METRIC_CONFIG.notFound.color
										: "",
								}}
							>
								<span
									className="w-2 h-2 rounded-full shrink-0"
									style={{
										backgroundColor: activeMetrics.notFound
											? METRIC_CONFIG.notFound.color
											: "#d1d5db",
									}}
								/>
								<span>{METRIC_CONFIG.notFound.name}</span>
								<span
									className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold ${activeMetrics.notFound ? "text-white" : "bg-gray-100 text-gray-400"}`}
									style={{
										backgroundColor: activeMetrics.notFound
											? METRIC_CONFIG.notFound.color
											: "",
									}}
								>
									{(displayMetrics.not_found ?? 0).toLocaleString()}
								</span>
							</button>

							{/* Pill 3: Passed Validation */}
							<button
								type="button"
								onClick={() => toggleMetricVisibility("passed")}
								className={`flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-bold transition-all shadow-xs ${
									activeMetrics.passed
										? "bg-[#4A90E2]/5 text-[#4A90E2]"
										: "border-gray-200 bg-white text-gray-400 hover:border-gray-300"
								}`}
								style={{
									borderColor: activeMetrics.passed
										? METRIC_CONFIG.passed.color
										: "",
								}}
							>
								<span
									className="w-2 h-2 rounded-full shrink-0"
									style={{
										backgroundColor: activeMetrics.passed
											? METRIC_CONFIG.passed.color
											: "#d1d5db",
									}}
								/>
								<span>{METRIC_CONFIG.passed.name}</span>
								<span
									className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold ${activeMetrics.passed ? "text-white" : "bg-gray-100 text-gray-400"}`}
									style={{
										backgroundColor: activeMetrics.passed
											? METRIC_CONFIG.passed.color
											: "",
									}}
								>
									{(displayMetrics.passed_validation ?? 0).toLocaleString()}
								</span>
							</button>

							{/* Pill 4: Failed Validation */}
							<button
								type="button"
								onClick={() => toggleMetricVisibility("failed")}
								className={`flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-bold transition-all shadow-xs ${
									activeMetrics.failed
										? "bg-[#e11d48]/5 text-[#e11d48]"
										: "border-gray-200 bg-white text-gray-400 hover:border-gray-300"
								}`}
								style={{
									borderColor: activeMetrics.failed
										? METRIC_CONFIG.failed.color
										: "",
								}}
							>
								<span
									className="w-2 h-2 rounded-full shrink-0"
									style={{
										backgroundColor: activeMetrics.failed
											? METRIC_CONFIG.failed.color
											: "#d1d5db",
									}}
								/>
								<span>{METRIC_CONFIG.failed.name}</span>
								<span
									className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold ${activeMetrics.failed ? "text-white" : "bg-gray-100 text-gray-400"}`}
									style={{
										backgroundColor: activeMetrics.failed
											? METRIC_CONFIG.failed.color
											: "",
									}}
								>
									{(displayMetrics.failed_validation ?? 0).toLocaleString()}
								</span>
							</button>

							{/* Pill 5: Pending Approval */}
							<button
								type="button"
								onClick={() => toggleMetricVisibility("pending")}
								className={`flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-bold transition-all shadow-xs ${
									activeMetrics.pending
										? "bg-[#f59e0b]/5 text-[#f59e0b]"
										: "border-gray-200 bg-white text-gray-400 hover:border-gray-300"
								}`}
								style={{
									borderColor: activeMetrics.pending
										? METRIC_CONFIG.pending.color
										: "",
								}}
							>
								<span
									className="w-2 h-2 rounded-full shrink-0"
									style={{
										backgroundColor: activeMetrics.pending
											? METRIC_CONFIG.pending.color
											: "#d1d5db",
									}}
								/>
								<span>{METRIC_CONFIG.pending.name}</span>
								<span
									className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold ${activeMetrics.pending ? "text-white" : "bg-gray-100 text-gray-400"}`}
									style={{
										backgroundColor: activeMetrics.pending
											? METRIC_CONFIG.pending.color
											: "",
									}}
								>
									{(displayMetrics.pending_hitl ?? 0).toLocaleString()}
								</span>
							</button>
						</div>
					</div>

					{/* RIGHT SIDE: DYNAMIC COMPOSITE PIE CHART */}
					<div className="lg:col-span-7 border border-gray-200 p-5 rounded-sm bg-gray-50/10 flex flex-col items-center justify-center min-h-[340px]">
						<div className="w-full text-left mb-4 flex items-center gap-2">
							<PieIcon size={14} className="text-accent" />
							<span className="text-xs font-bold text-primary uppercase tracking-wider">
								Proportional Distribution Share
							</span>
						</div>

						{pieChartData.length > 0 ? (
							<div className="w-full h-[240px]">
								<ResponsiveContainer width="100%" height="100%">
									<PieChart>
										<Pie
											data={pieChartData}
											cx="50%"
											cy="48%"
											innerRadius={60}
											outerRadius={90}
											paddingAngle={3}
											dataKey="value"
										>
											{pieChartData.map((entry, index) => (
												<Cell key={`cell-${index}`} fill={entry.color} />
											))}
										</Pie>
										<Tooltip
											contentStyle={{
												backgroundColor: "#1E3A5F",
												borderColor: "#172e4c",
												borderRadius: "2px",
											}}
											itemStyle={{ color: "#ffffff", fontSize: "12px" }}
										/>
										<Legend
											verticalAlign="bottom"
											align="center"
											iconType="rect"
											iconSize={10}
											wrapperStyle={{
												fontSize: "11px",
												fontWeight: 600,
												paddingTop: "10px",
											}}
										/>
									</PieChart>
								</ResponsiveContainer>
							</div>
						) : (
							<div className="text-xs text-gray-400 font-medium text-center py-12">
								No active metrics or non-zero variables are currently selected
								to construct the layout composition.
							</div>
						)}
					</div>
				</div>

				{/* HORIZONTAL RULE SEPARATION */}
				<hr className="border-gray-200" />

				{/* AI EXECUTION DEEP-DIVE TELEMETRY */}
				<div className="space-y-4 pt-2">
					<div>
						<h4 className="text-xs font-black text-primary uppercase tracking-wider">
							AI Run Details
						</h4>
						<p className="text-[11px] text-gray-500 mt-0.5">
							Infrastructure and resource telemetry logged during the latest
							pipeline evaluation runtime.
						</p>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-3 gap-y-5 gap-x-6">
						{/* ROW 1 */}
						<div className="space-y-0.5">
							<span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
								Model
							</span>
							<span className="text-xs font-bold text-primary">
								Claude Sonnet 4
							</span>
						</div>

						<div className="space-y-0.5">
							<span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
								Prompt Version
							</span>
							<span className="text-xs font-bold text-primary">v2.1</span>
						</div>

						<div className="space-y-0.5">
							<span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
								Tokens In
							</span>
							<span className="text-xs font-bold text-primary">42,800</span>
						</div>

						{/* ROW 2 */}
						<div className="space-y-0.5">
							<span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
								Tokens Out
							</span>
							<span className="text-xs font-bold text-primary">8,140</span>
						</div>

						<div className="space-y-0.5">
							<span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
								Estimated Cost
							</span>
							<span className="text-xs font-bold text-emerald-600">$0.18</span>
						</div>

						<div className="space-y-0.5">
							<span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
								Latency
							</span>
							<span className="text-xs font-bold text-primary">34.2 sec</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

function XCircleIcon({
	size,
	className,
}: {
	size: number;
	className?: string;
}) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
		>
			<circle cx="12" cy="12" r="10" />
			<path d="m15 9-6 6" />
			<path d="m9 9 6 6" />
		</svg>
	);
}