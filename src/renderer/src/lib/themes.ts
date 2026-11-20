/*
 * TEMAS EMBUTIDOS NO PROGRAMA
 * Todo arquivo .css colocado na pasta  src/renderer/src/themes/  entra automaticamente no programa
 * (instalador e portátil) e aparece em Configurações → Aparência → Tema. Nada é criado no PC do usuário.
 */
const files = import.meta.glob('../themes/*.css', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

export interface ThemeDef {
  id: string
  name: string
  css: string
}

export const BUILTIN_THEMES: { id: string; name: string }[] = [
  { id: 'iasd-escuro', name: 'IASD Escuro' },
  { id: 'iasd-claro', name: 'IASD Claro' }
]

const pretty = (base: string): string => base.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export const EMBEDDED_THEMES: ThemeDef[] = Object.entries(files)
  .map(([path, css]) => {
    const id = (path.split('/').pop() ?? path).replace(/\.css$/i, '')
    const named = /\/\*\s*nome:\s*(.+?)\s*\*\//i.exec(css)?.[1] // opcional: /* nome: Meu Tema */
    return { id, name: named ?? pretty(id), css }
  })
  .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

export const isKnownTheme = (id: string): boolean => BUILTIN_THEMES.some((t) => t.id === id) || EMBEDDED_THEMES.some((t) => t.id === id)
