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
	PieChart,
	Pie,
	Cell,
	Tooltip,
	ResponsiveContainer,
	Legend,
} from "recharts";
import {
	getAgingStatus,
	getFiles,
	getMetrics,
	getStatus,
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

const METRIC_CONFIG = {
	found: { name: "Automated Matches", color: "#1E3A5F" },
	notFound: { name: "Unresolved Exceptions", color: "#2E6DA4" },
	passed: { name: "Compliant Clearances", color: "#4A90E2" },
	failed: { name: "Validation Failures", color: "#e11d48" },
	pending: { name: "Awaiting Authorization", color: "#f59e0b" },
};

export default function Dashboard() {
	const [files, setFiles] = useState<FileInfo[]>([]);
	const [runStatus, setRunStatus] = useState({
		status: "idle",
		message: "",
		progress_current: 0,
	});
	const [metrics, setMetrics] = useState<Metrics | null>(null);
	const [agingStatus, setAgingStatus] = useState({
		loaded: false,
		row_count: 0,
		filename: null,
	});
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	// Dashboard Telemetry Filters State (Includes Custom Date toggle flag)
	const [timePeriod, setTimePeriod] = useState("Last Analysis");
	const [isCustomDateActive, setIsCustomDateActive] = useState(false);
	const [customStartDate, setCustomStartDate] = useState("");
	const [customEndDate, setCustomEndDate] = useState("");

	const [selectedBank, setSelectedBank] = useState("All Banks");
	const [selectedBU, setSelectedBU] = useState("All BUs");
	const [selectedUser, setSelectedUser] = useState("All Users");

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
			setUserDisplayName(decodeURIComponent(match[1]).split("@")[0]);
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

	const handleTimePeriodSelect = (period: string) => {
		setTimePeriod(period);
		if (period === "Custom Date") {
			setIsCustomDateActive(true);
		} else {
			setIsCustomDateActive(false);
		}
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
			{/* UPDATED PROCEDURAL HERO BANNER */}
			<div className="bg-white border border-gray-200 p-6 shadow-xs relative overflow-hidden">
				<div className="absolute top-0 right-0 p-4 opacity-5 text-primary pointer-events-none">
					<CloudLightning size={100} />
				</div>
				<div className="max-w-4xl">
					<h2 className="text-sm font-black text-primary uppercase tracking-wider flex items-center gap-2">
						Financial Reconciliation Workspace · {userDisplayName}
					</h2>
					<p className="text-xs text-gray-600 mt-2 leading-relaxed">
						Initialize the daily matching cycle by uploading your banking
						statements and aging ledger files below. Once started, the ingestion
						engine systematically maps customer profiles, links open invoice
						entries, and isolates exceptions for review—compressing a multi-step
						verification process into a streamlined, seconds-long automated
						clearance.
					</p>
				</div>
			</div>

			{error && (
				<div className="bg-red-50/50 backdrop-blur-sm border-l-4 border-red-600 text-gray-900 px-4 py-3.5 shadow-sm text-sm flex items-center justify-between">
					<div className="flex items-center gap-3">
						<AlertTriangle size={18} className="text-red-600 shrink-0" />
						<span className="font-medium tracking-wide">{error}</span>
					</div>
					<button
						onClick={() => setError("")}
						className="text-gray-400 hover:text-gray-600 text-base px-2"
					>
						×
					</button>
				</div>
			)}

			{/* UPLOAD SEGMENTS */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<div className="bg-white border border-gray-200 p-5 shadow-xs flex flex-col justify-between min-h-[180px]">
					<div>
						<h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2 mb-3">
							<Layers size={14} className="text-[#2E6DA4]" /> Aging Ledger
							Master
						</h3>
						<button className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 hover:border-primary text-primary py-3.5 px-4 text-[11px] font-bold uppercase tracking-wider bg-gray-50/50 hover:bg-gray-50 transition-all cursor-pointer">
							<UploadCloud size={14} className="text-[#4A90E2]" />
							<span>Ingest Subsidiary Ledger</span>
						</button>
					</div>
					<div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
						<span>Supported formats: XLS, CSV</span>
						{agingStatus.loaded ? (
							<span className="text-[#4A90E2] font-bold flex items-center gap-1">
								<CheckCircle2 size={12} />{" "}
								{agingStatus.row_count.toLocaleString()} rows active
							</span>
						) : (
							<span className="text-amber-600 font-medium">
								No target file detected
							</span>
						)}
					</div>
				</div>

				<div className="bg-white border border-gray-200 p-5 shadow-xs flex flex-col justify-between min-h-[180px]">
					<div>
						<h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2 mb-3">
							<FileText size={14} className="text-[#2E6DA4]" /> Bank Account
							Statements
						</h3>
						<button className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 hover:border-primary text-primary py-3.5 px-4 text-[11px] font-bold uppercase tracking-wider bg-gray-50/50 hover:bg-gray-50 transition-all cursor-pointer">
							<UploadCloud size={14} className="text-[#4A90E2]" />
							<span>Ingest Bank Statement Blocks</span>
						</button>
					</div>
					<div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
						<span>Supported formats: MT940, BAI2, CSV, PDF</span>
						<span className="text-primary font-bold">
							{files.length} statements verified
						</span>
					</div>
				</div>
			</div>

			{/* RECONCILIATION ENGINE CONTROL BAR */}
			<div className="bg-[#1E3A5F] text-white px-5 py-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 border border-[#172e4c]">
				<div className="flex items-center gap-3">
					<RefreshCw
						size={14}
						className={`text-[#4A90E2] ${isRunning ? "animate-spin" : ""}`}
					/>
					<div className="text-xs font-medium text-gray-200">
						<span>Pipeline Engine Framework</span>
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
					className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#4A90E2] hover:bg-[#357ABD] text-white px-6 py-2.5 font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-20 disabled:cursor-not-allowed shadow-xs whitespace-nowrap rounded-sm"
				>
					<Play size={11} className="fill-current" />
					<span>Execute Matching Run</span>
					<ArrowRight size={12} className="ml-0.5" />
				</button>
			</div>

			{/* TELEMETRY ENGINE LAYER */}
			<div className="bg-white border border-gray-200 p-6 shadow-xs space-y-6">
				{/* TIME PERIOD CONTROL BAR */}
				<div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-gray-100">
					<div>
						<h2 className="text-xs font-black text-primary uppercase tracking-wider">
							Analytics Telemetry Dashboard
						</h2>
						<p className="text-[11px] text-gray-500 mt-0.5">
							Overall summary for the selected evaluation period and contextual
							ledger data subsets.
						</p>
					</div>

					<div className="flex flex-wrap items-center gap-2 self-start xl:self-auto">
						{/* TIME CONFIGURATION PILLS CONTROLS */}
						<div className="flex items-center gap-1 bg-gray-100 p-1 rounded-sm">
							{[
								"Last Analysis",
								"Today",
								"Yesterday",
								"WTD",
								"MTD",
								"Custom Date",
							].map((period) => (
								<button
									key={period}
									onClick={() => handleTimePeriodSelect(period)}
									className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-xs transition-all cursor-pointer ${
										timePeriod === period
											? "bg-[#1E3A5F] text-white shadow-xs"
											: "text-gray-500 hover:text-primary"
									}`}
								>
									{period}
								</button>
							))}
						</div>

						{/* DYNAMIC INLINE CUSTOM DATE WINDOW EXTENSION */}
						{isCustomDateActive && (
							<div className="flex items-center gap-1.5 animate-slide-in border-l border-gray-200 pl-2 mt-2 sm:mt-0">
								<input
									type="date"
									value={customStartDate}
									onChange={(e) => setCustomStartDate(e.target.value)}
									className="bg-gray-50 border border-gray-300 rounded-sm text-[10px] font-bold uppercase text-gray-600 px-2 py-1 outline-none focus:border-accent"
								/>
								<span className="text-[10px] font-bold text-gray-400">TO</span>
								<input
									type="date"
									value={customEndDate}
									onChange={(e) => setCustomEndDate(e.target.value)}
									className="bg-gray-50 border border-gray-300 rounded-sm text-[10px] font-bold uppercase text-gray-600 px-2 py-1 outline-none focus:border-accent"
								/>
							</div>
						)}
					</div>
				</div>

				{/* CONTROLS SELECTION ROW */}
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
					<div className="relative">
						<Landmark
							size={14}
							className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
						/>
						<select
							value={selectedBank}
							onChange={(e) => setSelectedBank(e.target.value)}
							className="w-full bg-white border border-gray-300 text-xs font-bold text-primary pl-9 pr-8 py-2.5 rounded-sm appearance-none focus:outline-none focus:border-accent cursor-pointer"
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
							className="w-full bg-white border border-gray-300 text-xs font-bold text-primary pl-9 pr-8 py-2.5 rounded-sm appearance-none focus:outline-none focus:border-accent cursor-pointer"
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
							className="w-full bg-white border border-gray-300 text-xs font-bold text-primary pl-9 pr-8 py-2.5 rounded-sm appearance-none focus:outline-none focus:border-accent cursor-pointer"
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

				{/* KPI CORE METRIC CARDS GRID */}
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
					<div className="border border-gray-200 p-4 rounded-sm bg-gray-50/30">
						<div className="flex items-center gap-1.5 text-gray-400 mb-1">
							<Layers size={13} className="text-[#1E3A5F]" />
							<span className="text-[10px] font-bold uppercase tracking-wider">
								Gross Items Scanned
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
						<div className="flex items-center gap-1.5 text-red-400 mb-1">
							<Ban size={13} className="text-red-500" />
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

				{/* PIE CHART INTERACTIVE SECTION */}
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-2">
					{/* INTERACTIVE PILL CONFIGURATOR */}
					<div className="lg:col-span-5 space-y-4">
						<div>
							<h4 className="text-xs font-black text-primary uppercase tracking-wider">
								Select Metrics to Display
							</h4>
							<p className="text-[11px] text-gray-500 mt-0.5">
								Toggle tracking variables below to dynamically alter chart
								distribution views.
							</p>
						</div>

						<div className="flex flex-wrap gap-2 pt-1">
							{/* Pill 1: Found */}
							<button
								type="button"
								onClick={() => toggleMetricVisibility("found")}
								className={`flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-bold transition-all shadow-xs cursor-pointer ${
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
								className={`flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-bold transition-all shadow-xs cursor-pointer ${
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
								className={`flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-bold transition-all shadow-xs cursor-pointer ${
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
								className={`flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-bold transition-all shadow-xs cursor-pointer ${
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
								className={`flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-bold transition-all shadow-xs cursor-pointer ${
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

					{/* CHARTS GRAPH WORKSPACE */}
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
								No active metrics selected to populate distribution share.
							</div>
						)}
					</div>
				</div>

				<hr className="border-gray-200" />

				{/* METADATA TELEMETRY CORE GRID */}
				<div className="space-y-4 pt-1">
					<div>
						<h4 className="text-xs font-black text-primary uppercase tracking-wider">
							AI Run Details
						</h4>
						<p className="text-[11px] text-gray-500 mt-0.5">
							Infrastructure resources logged during the latest evaluation
							runtime.
						</p>
					</div>

					<div className="grid grid-cols-2 sm:grid-cols-3 gap-y-5 gap-x-6">
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