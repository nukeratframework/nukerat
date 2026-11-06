'use client'

import { useState } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ChevronDownIcon } from 'lucide-react'

type Props = {
  date?: Date
  onDate: (date?: Date) => void
  timeFrom: string
  onTimeFrom: (v: string) => void
  timeTo: string
  onTimeTo: (v: string) => void
}

const field = 'bg-[#212121] border border-[#363636] text-[#cecece] text-[13px] rounded px-2 py-1 outline-none focus:border-[#555] h-[29px]'

export function RangePicker({ date, onDate, timeFrom, onTimeFrom, timeTo, onTimeTo }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex items-center gap-2 shrink-0">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className={`button-default ${field} flex items-center gap-1 cursor-pointer`}>
            {date ? date.toLocaleDateString() : 'Date'}
            <ChevronDownIcon size={12} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => {
              onDate(d)
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
      <Input type="time" step="1" value={timeFrom} onChange={(e) => onTimeFrom(e.target.value)} className={`${field} w-[6.5rem]`} />
      <Input type="time" step="1" value={timeTo} onChange={(e) => onTimeTo(e.target.value)} className={`${field} w-[6.5rem]`} />
    </div>
  )
}

export default RangePicker
