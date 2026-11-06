import * as React from "react"
import { CheckIcon } from "lucide-react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"
import { cn } from '@/components/ui/lib/utils'

function Checkbox({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "!peer !relative !flex !size-4 !shrink-0 !items-center !justify-center !rounded-[4px] !border-2 !border-input !outline-none !transition-[border-color,box-shadow,opacity] !duration-150 !group-has-disabled/field:opacity-50 !after:absolute !after:-inset-x-3 !after:-inset-y-2 !focus-visible:border-ring !focus-visible:ring-3 !focus-visible:ring-ring/50 !disabled:cursor-not-allowed !disabled:opacity-50 !aria-invalid:border-destructive !aria-invalid:ring-3 !aria-invalid:ring-destructive/20 !aria-invalid:aria-checked:border-primary !dark:bg-input/30 !dark:aria-invalid:border-destructive/50 !dark:aria-invalid:ring-destructive/40 !data-[state=checked]:border-primary !data-[state=checked]:bg-primary !data-[state=checked]:text-primary-foreground !dark:data-[state=checked]:bg-primary",
        className
      )}
      {...props}
    >
      {children ?? (
        <CheckboxPrimitive.Indicator
          data-slot="checkbox-indicator"
          className="grid place-content-center text-current transition-none [&>svg]:size-2.5"
        >
          <CheckIcon strokeWidth={4} />
        </CheckboxPrimitive.Indicator>
      )}
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
