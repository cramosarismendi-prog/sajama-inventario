import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Menu } from 'lucide-react'
import { BannerTipoCambio } from '../ui/BannerTipoCambio'
import logoSajama from '../../assets/logo-sajama.jpg'

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
    <div className="flex h-screen overflow-hidden bg-[#F4F6F5]">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(p => !p)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="bg-white border-b border-[#E2E7E4] px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleToggleMenu}
              className="p-2 rounded-lg hover:bg-[#EEF2F0] transition-colors text-[#233830] focus:outline-none"
              aria-label="Abrir menú"
            >
              <Menu size={22} />
            </button>
            <div className="flex items-center gap-2 md:hidden">
              <div className="w-8 h-8 rounded-lg overflow-hidden border border-[#16241F]/15 shadow-xs bg-[#FDE200] shrink-0">
                <img src={logoSajama} alt="Sajama 4x4" className="w-full h-full object-cover" />
              </div>
              <span className="font-bold text-[#16241F] text-sm">Sajama.SRL</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <BannerTipoCambio />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}