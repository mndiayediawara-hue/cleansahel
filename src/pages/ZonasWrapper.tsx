// ZonasWrapper — injects the vanilla JS Zonas page into the DOM
// This bypasses the Vite build issue by rendering Zonas as vanilla JS
import { useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

export default function ZonasWrapper() {
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  useEffect(() => {
    if (!containerRef.current) return

    // Inject the Zonas page as a DOM component
    if (window.createZonasPage) {
      const el = window.createZonasPage()
      containerRef.current.innerHTML = ''
      containerRef.current.appendChild(el)
    } else {
      // Try loading from the inline module
      loadZonasModule().then(() => {
        if (containerRef.current && window.createZonasPage) {
          containerRef.current.innerHTML = ''
          containerRef.current.appendChild(window.createZonasPage())
        }
      })
    }

    return () => {
      // Cleanup
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
    }
  }, [pathname])

  return <div ref={containerRef} style={{ minHeight: '400px' }} />
}

async function loadZonasModule() {
  // Inject the module if not already loaded
  if (window.createZonasPage) return

  const MODULE_ID = 'zonas-module-v1'

  // Load from the inline script
  const script = document.getElementById(MODULE_ID)
  if (script) return

  // Load from the external asset
  const mod = document.createElement('script')
  mod.id = MODULE_ID
  mod.type = 'module'
  mod.src = './assets/zonas-module.js'
  document.head.appendChild(mod)

  // Wait for it to load (max 5 seconds)
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      // Try loading inline content directly
      loadZonasInline().then(resolve).catch(reject)
    }, 2000)
    mod.addEventListener('load', () => {
      clearTimeout(timeout)
      resolve()
    })
    mod.addEventListener('error', () => {
      clearTimeout(timeout)
      loadZonasInline().then(resolve).catch(reject)
    })
  })
}

async function loadZonasInline() {
  // Load the inline content from the index.html script
  const script = document.getElementById('zonas-inline-module')
  if (script && script.textContent) {
    const blob = new Blob([script.textContent], { type: 'application/javascript' })
    const url = URL.createObjectURL(blob)
    const mod = document.createElement('script')
    mod.type = 'module'
    mod.src = url
    document.head.appendChild(mod)
    return new Promise<void>(resolve => {
      mod.addEventListener('load', resolve)
      setTimeout(resolve, 1000)
    })
  }
}

// Extend Window interface
declare global {
  interface Window {
    createZonasPage?: () => HTMLElement
  }
}
