"use client"
import "./globals.css"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart2, CheckSquare, AlertCircle, Settings, Home } from "lucide-react"

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/results", label: "Matched Results", icon: BarChart2 },
  { href: "/not-found-bucket", label: "Not Found", icon: AlertCircle },
  { href: "/hitl", label: "HITL Approval", icon: CheckSquare },
  { href: "/config", label: "Config", icon: Settings },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="w-60 bg-[#1E3A5F] text-white flex flex-col fixed h-full z-10">
            <div className="px-6 py-5 border-b border-[#2E6DA4]">
              <div className="text-xs text-blue-300 font-medium uppercase tracking-wider mb-1">Zensar Technologies</div>
              <div className="text-sm font-bold leading-tight">Bank Statement<br />Receipt Processing</div>
              <div className="text-xs text-blue-400 mt-1">POC v1.0</div>
            </div>
            <nav className="flex-1 py-4">
              {navItems.map(({ href, label, icon: Icon }) => {
                const active = pathname === href
                return (
                  <Link key={href} href={href}
                    className={`flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                      active ? "bg-[#2E6DA4] text-white font-semibold" : "text-blue-200 hover:bg-[#2E6DA4]/50"
                    }`}>
                    <Icon size={16} />
                    {label}
                  </Link>
                )
              })}
            </nav>
            <div className="px-6 py-4 text-xs text-blue-400 border-t border-[#2E6DA4]">
              Internal Use Only
            </div>
          </aside>

          {/* Main content */}
          <main className="ml-60 flex-1 p-8 min-h-screen">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
