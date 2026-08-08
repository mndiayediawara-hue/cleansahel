import { ReactNode, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export function Layout({ children }: { children?: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-screen flex bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-100">
      <div className="hidden lg:block sticky top-0 h-screen">
        <Sidebar />
      </div>
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative z-10 animate-slide-up">
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setOpen(true)} />
        <main className="flex-1 p-4 lg:p-6 animate-fade-in">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  )
}
