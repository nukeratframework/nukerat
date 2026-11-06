"use client"

import { Clock2Icon } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"

type Props = {
  date?: Date
  onDate: (date?: Date) => void
  timeFrom: string
  onTimeFrom: (v: string) => void
  timeTo: string
  onTimeTo: (v: string) => void
}

export function CalendarWithTime({ date, onDate, timeFrom, onTimeFrom, timeTo, onTimeTo }: Props) {
  return (
    <Card size="sm" className="mx-auto w-fit border-[#363636] bg-[#212121]">
      <CardContent>
        <Calendar mode="single" selected={date} onSelect={onDate} className="p-0" />
      </CardContent>
      <CardFooter className="border-t border-[#363636] bg-[#212121]">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="time-from">Start Time</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="time-from"
                type="time"
                step="1"
                value={timeFrom}
                onChange={(e) => onTimeFrom(e.target.value)}
                className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
              />
              <InputGroupAddon>
                <Clock2Icon className="text-muted-foreground" />
              </InputGroupAddon>
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor="time-to">End Time</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="time-to"
                type="time"
                step="1"
                value={timeTo}
                onChange={(e) => onTimeTo(e.target.value)}
                className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
              />
              <InputGroupAddon>
                <Clock2Icon className="text-muted-foreground" />
              </InputGroupAddon>
            </InputGroup>
          </Field>
        </FieldGroup>
      </CardFooter>
    </Card>
  )
}

export default CalendarWithTime
