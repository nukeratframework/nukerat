import { useEffect } from 'react'
import { toast } from 'sonner'

export function fmtName(value: string) {
  if (!value || /^\d+$/.test(value)) return value
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

export function formatToastMessage(message: string) {
  const i = message.indexOf(':')
  if (i <= 0) return message
  return `${fmtName(message.slice(0, i).trim())}${message.slice(i)}`
}

export type FetchToastResponse = {
  statusCode?: number
  status?: string
  message?: string
  error?: string
  name?: string
}

type FetchToastProps = {
  response?: FetchToastResponse | null
}

export default function FetchToast({ response }: FetchToastProps) {
  useEffect(() => {
    if (!response) return
    if (response.statusCode === 200 || response.status === 'success' || response.status === 'successfull') return
    const msg =
      response.message ??
      (response.status === 'ERR_conn' && response.name
        ? `${response.name}: Unreachable host`
        : null) ??
      response.error ??
      String(response.statusCode ?? response.status ?? '')
    toast.error(formatToastMessage(msg || 'Request failed'))
  }, [response])
  return null
}
