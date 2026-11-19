import { useEffect } from 'react'
import { toast } from 'sonner'
import i18n, { translate } from '@/i18n'

/**
 * Capitalizes an English word. Only applies when the UI is English: the rule
 * would mangle other scripts, and "server: message" prefixes are usually
 * server-supplied text that must pass through untouched.
 */
export function fmtName(value: string) {
  if (!value || /^\d+$/.test(value)) return value
  if (!String(i18n.language).toLowerCase().startsWith('en')) return value
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
        ? `${response.name}: ${translate('api.unreachableHost')}`
        : null) ??
      response.error ??
      String(response.statusCode ?? response.status ?? '')
    toast.error(formatToastMessage(msg || translate('common.requestFailed')))
  }, [response])
  return null
}
