import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Botões sempre em formato de pílula (arredondados), como na referência.
const buttonVariants = cva(
  'spa-btn inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold outline-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-ring/60 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-brand text-white shadow-[0_8px_22px_-8px_hsl(var(--grad-from)/0.8)] hover:brightness-110',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
        outline: 'border border-border bg-transparent hover:bg-accent',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/85',
        glass: 'glass hover:brightness-125'
      },
      size: {
        default: 'h-11 px-6',
        sm: 'h-9 px-4 text-[13px]',
        lg: 'h-12 px-8 text-[15px]',
        icon: 'size-10',
        'icon-sm': 'size-8 [&_svg]:size-3.5'
      }
    },
    defaultVariants: { variant: 'default', size: 'default' }
  }
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
})
Button.displayName = 'Button'
