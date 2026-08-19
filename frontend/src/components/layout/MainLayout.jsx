import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Menu, Package } from 'lucide-react'

export function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleToggleMenu = () => {
    if (window.innerWidth < 768) {
      setMobileOpen(prev => !prev)
    } else {
      setCollapsed(prev => !prev)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(p => !p)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="bg-white border-b border-gray-100 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleToggleMenu}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 focus:outline-none"
              aria-label="Abrir menú"
            >
              <Menu size={22} />
            </button>
            <div className="flex items-center gap-2 md:hidden">
              <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center text-white">
                <Package size={15} />
              </div>
              <span className="font-bold text-gray-900 text-sm">Sajama.SRL</span>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}