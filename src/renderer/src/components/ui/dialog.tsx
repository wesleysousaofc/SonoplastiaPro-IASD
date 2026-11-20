import * as React from 'react'
import * as D from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'

export const Dialog = D.Root
export const DialogTitle = D.Title
export const DialogDescription = D.Description

/** Janela modal em vidro, cantos bem arredondados (estilo "New Download Task"). */
export const DialogContent = React.forwardRef<React.ElementRef<typeof D.Content>, React.ComponentPropsWithoutRef<typeof D.Content> & { hideOverlayClose?: boolean }>(
  ({ className, children, ...props }, ref) => (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[3px] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <D.Content
        ref={ref}
        aria-describedby={undefined}
        className={cn(
          'spa-dialog glass fixed left-1/2 top-1/2 z-50 w-[min(92vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-[1.6rem] p-6 shadow-2xl outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className
        )}
        {...props}
      >
        {children}
      </D.Content>
    </D.Portal>
  )
)
DialogContent.displayName = 'DialogContent'
