import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      icons={{
        success: <CircleCheckIcon className="size-4 text-[#4caf75]" />,
        info: <InfoIcon className="size-4 text-[#6db3f2]" />,
        warning: <TriangleAlertIcon className="size-4 text-[#e0a84b]" />,
        error: <OctagonXIcon className="size-4 text-[#c97070]" />,
        loading: <Loader2Icon className="size-4 animate-spin text-[#9b9b9b]" />,
      }}
      toastOptions={{
        style: {
          background: '#191919',
          border: '1px solid #2f2f2f',
          color: '#d4d4d4',
          fontFamily: 'monospace',
          fontSize: '14px',
          borderRadius: '6px',
          padding: '8px 16px',
          height: '2.5rem',
          width: 'auto',
        },
        classNames: {
          success: '[&]:border-[#2d4a38] [&]:bg-[#161f1a] [&>[data-icon]]:text-[#4caf75] [&>[data-content]>[data-title]]:text-[#7dd4a8]',
          error:   '[&]:border-[#4a2d2d] [&]:bg-[#1f1616] [&>[data-icon]]:text-[#c97070] [&>[data-content]>[data-title]]:text-[#d49a9a]',
          warning: '[&]:border-[#4a3d1e] [&]:bg-[#1e1a10] [&>[data-icon]]:text-[#e0a84b] [&>[data-content]>[data-title]]:text-[#d4b87a]',
          info:    '[&]:border-[#1e3a4a] [&]:bg-[#101820] [&>[data-icon]]:text-[#6db3f2] [&>[data-content]>[data-title]]:text-[#9acaf5]',
        },
      }}
      {...props}
      expand
      // gap={40}
      visibleToasts={4}
    />
  )
}

export { Toaster }
