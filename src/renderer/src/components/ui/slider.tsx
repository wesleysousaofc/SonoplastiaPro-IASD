import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@/lib/utils'

/** Slider do shadcn/ui (horizontal ou vertical). */
export const Slider = React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & { noRange?: boolean }>(
  ({ className, noRange, ...props }, ref) => (
    <SliderPrimitive.Root
      ref={ref}
      className={cn('relative flex touch-none select-none items-center data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:flex-col data-[disabled]:opacity-40', className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative grow overflow-hidden rounded-full bg-secondary data-[orientation=horizontal]:h-2 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-2">
        {!noRange && <SliderPrimitive.Range className="absolute bg-brand data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full" />}
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block size-5 cursor-grab rounded-full border-2 border-primary bg-background shadow-md outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing" />
    </SliderPrimitive.Root>
  )
)
Slider.displayName = 'Slider'
