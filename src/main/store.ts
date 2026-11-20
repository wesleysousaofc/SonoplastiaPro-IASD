import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs'

/** Armazena um objeto JSON em disco (gravação atômica e com atraso para não castigar o HD). */
export class JsonStore<T extends object> {
  data: T
  private timer: NodeJS.Timeout | null = null
  constructor(private file: string, defaults: T) {
    let loaded: Partial<T> = {}
    try {
      if (existsSync(file)) loaded = JSON.parse(readFileSync(file, 'utf-8'))
    } catch {
      /* arquivo corrompido: volta ao padrão */
    }
    this.data = { ...defaults, ...loaded }
  }
  save(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.flush(), 300)
  }
  flush(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    try {
      const tmp = this.file + '.tmp'
      writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf-8')
      renameSync(tmp, this.file)
    } catch {
      /* sem permissão / disco cheio: ignora */
    }
  }
}
