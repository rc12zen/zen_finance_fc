"use client"
import { useEffect, useState } from "react"
import { getBankConfig, getAbbreviations, updateAbbreviations } from "@/lib/api"
import { Save, Plus, Trash2 } from "lucide-react"

export default function ConfigPage() {
  const [bankConfig, setBankConfig] = useState<any>({})
  const [abbreviations, setAbbreviations] = useState<Record<string, string>>({})
  const [newKey, setNewKey] = useState("")
  const [newVal, setNewVal] = useState("")
  const [saved, setSaved] = useState(false)
  const [tab, setTab] = useState<"banks" | "abbreviations">("banks")

  useEffect(() => {
    getBankConfig().then(r => setBankConfig(r.data.config)).catch(() => {})
    getAbbreviations().then(r => setAbbreviations(r.data.abbreviations)).catch(() => {})
  }, [])

  const handleSaveAbbreviations = async () => {
    try {
      await updateAbbreviations(abbreviations)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {}
  }

  const handleAdd = () => {
    if (!newKey.trim() || !newVal.trim()) return
    setAbbreviations(prev => ({ ...prev, [newKey.trim().toUpperCase()]: newVal.trim() }))
    setNewKey(""); setNewVal("")
  }

  const handleDelete = (key: string) => {
    setAbbreviations(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Configuration</h1>
        <p className="text-sm text-gray-500 mt-1">Bank column mappings and abbreviation dictionaries</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {(["banks","abbreviations"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t ? "bg-white shadow text-[#1E3A5F]" : "text-gray-500"
            }`}>
            {t === "banks" ? "Bank Column Mappings" : "Abbreviations"}
          </button>
        ))}
      </div>

      {tab === "banks" && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">Read-only for POC. Edit backend/config/bank_columns.json to add new banks.</p>
          {Object.entries(bankConfig).map(([bank, config]: [string, any]) => (
            <div key={bank} className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-bold text-[#1E3A5F] mb-3">{bank}</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(config).map(([k, v]) => (
                  <div key={k} className="flex gap-2 text-xs">
                    <span className="text-gray-400 w-36 shrink-0">{k}:</span>
                    <span className="font-medium text-gray-700">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "abbreviations" && (
        <div>
          {saved && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm">
              ✓ Abbreviations saved successfully
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[#1E3A5F]">Abbreviation Mappings</h3>
              <button onClick={handleSaveAbbreviations}
                className="flex items-center gap-2 bg-[#1E3A5F] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#2E6DA4]">
                <Save size={14} /> Save
              </button>
            </div>

            {/* Add new */}
            <div className="flex gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
              <input placeholder="Short form (e.g. HBC)" value={newKey}
                onChange={e => setNewKey(e.target.value)}
                className="border rounded px-3 py-2 text-sm flex-1 outline-none" />
              <input placeholder="Full name (e.g. Hardwareside)" value={newVal}
                onChange={e => setNewVal(e.target.value)}
                className="border rounded px-3 py-2 text-sm flex-1 outline-none" />
              <button onClick={handleAdd}
                className="flex items-center gap-1 bg-[#2E6DA4] text-white px-3 py-2 rounded-lg text-sm hover:bg-[#1E3A5F]">
                <Plus size={14} /> Add
              </button>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 text-gray-500 font-medium">Abbreviation</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Full Name</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(abbreviations).map(([k, v]) => (
                  <tr key={k} className="border-b last:border-0">
                    <td className="py-2 font-mono font-semibold text-[#1E3A5F]">{k}</td>
                    <td className="py-2">
                      <input value={v}
                        onChange={e => setAbbreviations(prev => ({ ...prev, [k]: e.target.value }))}
                        className="border-0 outline-none w-full bg-transparent" />
                    </td>
                    <td className="py-2">
                      <button onClick={() => handleDelete(k)} className="text-red-400 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
