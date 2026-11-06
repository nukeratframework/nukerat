import CanvaPage from '@/pages/canva'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'

export default function App() {
  return (
    <TooltipProvider>
      <Toaster />
      <CanvaPage />
    </TooltipProvider>
  )
}
