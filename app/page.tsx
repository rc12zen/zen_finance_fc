"use client"
import { useEffect, useState, useCallback } from "react"
import { getFiles, startRun, getStatus, resetRun, getMetrics, refreshAging, getAgingStatus } from "@/lib/api"
import MetricCard from "@/components/MetricCard"
import StatusBadge from "@/components/StatusBadge"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { RefreshCw, Play, FileText, AlertTriangle, CheckCircle, XCircle, Clock } from "lucide-react"

interface FileInfo { filename: string; bank_name: string; size_mb: number }
interface Metrics {
  total_rows_ingested: number; found: number; not_found: number
  passed_validation: number; failed_validation: number; pending_hitl: number
  approved: number; rejected: number; posted_to_oracle: number
  extraction_method_breakdown: Record<string, number>
  aging_report_loaded: boolean; aging_report_row_count: number
}

const METHOD_COLORS: Record<string, string> = { cache: "#8b5cf6", regex: "#3b82f6", fuzzy: "#6366f1" }

export default function Dashboard() {
  const [files, setFiles] = useState<FileInfo[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [runStatus, setRunStatus] = useState<{ status: string; message: string; progress_current: number }>({
    status: "idle", message: "", progress_current: 0
  })
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [agingStatus, setAgingStatus] = useState<{ loaded: boolean; row_count: number; filename: string | null }>({
    loaded: false, row_count: 0, filename: null
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const fetchFiles = useCallback(async () => {
    try {
      const res = await getFiles()
      setFiles(res.data.files)
    } catch { setError("Could not connect to backend. Is it running on port 8000?") }
  }, [])

  const fetchMetrics = useCallback(async () => {
    try {
      const [m, a] = await Promise.all([getMetrics(), getAgingStatus()])
      setMetrics(m.data)
      setAgingStatus(a.data)
    } catch {}
  }, [])

  const fetchStatus = useCallback(async () => {
    try {
      const res = await getStatus()
      setRunStatus(res.data)
      if (res.data.status === "completed" || res.data.status === "error") {
        fetchMetrics()
      }
    } catch {}
  }, [fetchMetrics])

  useEffect(() => {
    fetchFiles()
    fetchMetrics()
  }, [fetchFiles, fetchMetrics])

  // Poll status while running
  useEffect(() => {
    if (runStatus.status !== "running") return
    const interval = setInterval(fetchStatus, 2000)
    return () => clearInterval(interval)
  }, [runStatus.status, fetchStatus])

  const toggleFile = (fname: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(fname) ? next.delete(fname) : next.add(fname)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === files.length) setSelected(new Set())
    else setSelected(new Set(files.map(f => f.filename)))
  }

  const handleStart = async () => {
    if (!agingStatus.loaded) { setError("Aging report not loaded. Refresh it first."); return }
    if (selected.size === 0) { setError("Select at least one bank statement file."); return }
    setError("")
    setLoading(true)
    try {
      await startRun(Array.from(selected))
      fetchStatus()
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to start run")
    }
    setLoading(false)
  }

  const handleRefreshAging = async () => {
    try {
      await refreshAging()
      fetchMetrics()
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to refresh aging report")
    }
  }

  const handleReset = async () => {
    await resetRun()
    fetchStatus()
  }

  const methodChartData = metrics
    ? Object.entries(metrics.extraction_method_breakdown).map(([method, count]) => ({ method, count }))
    : []

  const isRunning = runStatus.status === "running"

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Bank Statement Receipt Processing</h1>
        <p className="text-sm text-gray-500 mt-1">POC — Automated reconciliation dashboard</p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
          <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Aging Report Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Aging Report</span>
            <button onClick={handleRefreshAging}
              className="flex items-center gap-1 text-xs text-[#2E6DA4] hover:text-[#1E3A5F] font-medium">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
          {agingStatus.loaded ? (
            <>
              <div className="flex items-center gap-2 text-green-700 font-semibold text-sm mb-1">
                <CheckCircle size={16} /> Loaded
              </div>
              <div className="text-xs text-gray-500">{agingStatus.row_count} invoice records</div>
              {agingStatus.filename && <div className="text-xs text-gray-400 mt-1 truncate">{agingStatus.filename}</div>}
            </>
          ) : (
            <div className="flex items-center gap-2 text-red-600 text-sm font-medium">
              <XCircle size={16} /> Not loaded — add file to data/aging_report/
            </div>
          )}
        </div>

        {/* Run Status */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Pipeline Status</span>
            {runStatus.status === "error" && (
              <button onClick={handleReset} className="text-xs text-gray-400 hover:text-gray-600">Reset</button>
            )}
          </div>
          <div className={`font-semibold text-sm capitalize mb-1 ${
            runStatus.status === "completed" ? "text-green-700" :
            runStatus.status === "running" ? "text-blue-600" :
            runStatus.status === "error" ? "text-red-600" : "text-gray-500"
          }`}>
            {isRunning && <span className="inline-block mr-2 animate-spin">⟳</span>}
            {runStatus.status}
          </div>
          {runStatus.message && <div className="text-xs text-gray-500 mb-2">{runStatus.message}</div>}
          {isRunning && (
            <div className="text-xs text-gray-400">{runStatus.progress_current} rows processed</div>
          )}
        </div>

        {/* Start Button */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Start Analysis</div>
          <button
            onClick={handleStart}
            disabled={isRunning || loading || selected.size === 0 || !agingStatus.loaded}
            className="flex items-center justify-center gap-2 bg-[#1E3A5F] text-white px-4 py-3 rounded-lg font-semibold text-sm hover:bg-[#2E6DA4] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <Play size={16} />
            {isRunning ? "Running..." : `Start Analyzing (${selected.size} file${selected.size !== 1 ? "s" : ""})`}
          </button>
          <div className="text-xs text-gray-400 mt-2">Select files below then click start</div>
        </div>
      </div>

      {/* File Selection */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-[#2E6DA4]" />
            <span className="font-semibold text-sm text-[#1E3A5F]">Bank Statement Files</span>
            <span className="text-xs text-gray-400">({files.length} available)</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchFiles} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <RefreshCw size={11} /> Refresh list
            </button>
            <button onClick={toggleAll} className="text-xs text-[#2E6DA4] font-medium">
              {selected.size === files.length ? "Deselect All" : "Select All"}
            </button>
          </div>
        </div>
        {files.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-6">
            No files found in backend/data/bank_statements/. Add Excel files there.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {files.map(f => (
              <label key={f.filename}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selected.has(f.filename) ? "border-[#2E6DA4] bg-blue-50" : "border-gray-200 hover:border-gray-300"
                }`}>
                <input type="checkbox" checked={selected.has(f.filename)}
                  onChange={() => toggleFile(f.filename)} className="mt-0.5 accent-[#1E3A5F]" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{f.filename}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <StatusBadge value={f.bank_name} />
                    <span className="text-xs text-gray-400">{f.size_mb} MB</span>
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Metrics */}
      {metrics && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard label="Total Rows Ingested" value={metrics.total_rows_ingested} color="#1E3A5F" />
            <MetricCard label="Found" value={metrics.found} color="#2E6DA4" sub="Customer + invoice identified" />
            <MetricCard label="Not Found" value={metrics.not_found} color="#ef4444" sub="Manual review required" />
            <MetricCard label="Passed Validation" value={metrics.passed_validation} color="#16a34a" />
            <MetricCard label="Failed Validation" value={metrics.failed_validation} color="#dc2626" />
            <MetricCard label="Pending SPOC Approval" value={metrics.pending_hitl} color="#f59e0b" />
            <MetricCard label="Approved & Posted" value={metrics.approved} color="#059669" />
            <MetricCard label="Rejected by SPOC" value={metrics.rejected} color="#7c3aed" />
          </div>

          {methodChartData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="text-sm font-semibold text-[#1E3A5F] mb-4">Extraction Method Breakdown</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={methodChartData}>
                  <XAxis dataKey="method" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {methodChartData.map((entry, i) => (
                      <Cell key={i} fill={METHOD_COLORS[entry.method] || "#94a3b8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}
