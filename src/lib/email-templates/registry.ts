import type { ComponentType } from 'react'
import { template as signupVerification } from './signup-verification'
import { template as ownerAlert } from './owner-alert'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'signup-verification': signupVerification,
  'owner-alert': ownerAlert,
}
