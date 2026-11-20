import { useEffect } from 'react'
import { initApp, patchSettings } from '@/lib/actions'
import { EMBEDDED_THEMES, isKnownTheme } from '@/lib/themes'
import { useApp } from '@/lib/store'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { StatusBar } from '@/components/StatusBar'
import { ToastCenter } from '@/components/ToastCenter'
import { NewDownloadDialog } from '@/components/NewDownloadDialog'
import { UpdateDialog } from '@/components/UpdateDialog'
import { WhatsNewDialog } from '@/components/WhatsNewDialog'
import { ConfirmCloseDialog } from '@/components/ConfirmCloseDialog'
import { PlayDialog } from '@/components/PlayDialog'
import { AudioMixer } from '@/components/AudioMixer'
import { HomePage } from '@/pages/HomePage'
import { DownloadsPage } from '@/pages/DownloadsPage'
import { LibraryPage } from '@/pages/LibraryPage'
import { LocalSendPage } from '@/pages/LocalSendPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { PlayerPage } from '@/pages/PlayerPage'

/** Aplica o tema escolhido. Os temas .css ficam embutidos no programa (pasta src/renderer/src/themes). */
function useTheme(): void {
  const theme = useApp((s) => s.settings.theme)
  const light = useApp((s) => s.settings.lightMode)
  const ready = useApp((s) => s.ready)
  useEffect(() => {
    document.documentElement.classList.toggle('light-mode', light)
  }, [light])
  useEffect(() => {
    if (ready && !isKnownTheme(theme)) {
      void patchSettings({ theme: 'iasd-escuro' }) // tema antigo/removido: volta ao padrão
      return
    }
    let el = document.getElementById('spa-theme-css') as HTMLStyleElement | null
    if (!el) {
      el = document.createElement('style')
      el.id = 'spa-theme-css'
      document.head.appendChild(el)
    }
    const id = isKnownTheme(theme) ? theme : 'iasd-escuro'
    document.documentElement.dataset.theme = id
    el.textContent = EMBEDDED_THEMES.find((t) => t.id === id)?.css ?? ''
  }, [theme, ready])
}

function MainApp(): JSX.Element {
  const ready = useApp((s) => s.ready)
  const page = useApp((s) => s.page)
  useEffect(() => { void initApp() }, [])
  useTheme()
  if (!ready) return <div className="grid h-full place-items-center text-muted-foreground">Carregando…</div>
  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto">
          {page === 'home' && <HomePage />}
          {page === 'downloads' && <DownloadsPage />}
          {page === 'library' && <LibraryPage />}
          {page === 'localsend' && <LocalSendPage />}
          {page === 'settings' && <SettingsPage />}
        </main>
      </div>
      <StatusBar />
      <AudioMixer />
      <ToastCenter />
      <NewDownloadDialog />
      <UpdateDialog />
      <WhatsNewDialog />
      <ConfirmCloseDialog />
      <PlayDialog />
    </div>
  )
}

export default function App(): JSX.Element {
  return location.hash.startsWith('#/player') ? <PlayerPage /> : <MainApp />
}
