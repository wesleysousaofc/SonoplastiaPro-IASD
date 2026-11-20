import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs))

/** URL segura para arquivo local (miniaturas e vídeos), servida pelo processo principal. */
export const mediaUrl = (path: string): string => `spa://local/?p=${encodeURIComponent(path)}`
