import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { sendTemplateEmail } from './email-templates/send-email'

export const sendVerificationCode = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context as {
      supabase: any
      userId: string
      claims: { email?: string } & Record<string, any>
    }

    const email = claims.email
    if (!email) throw new Error('Missing email on session')

    const { data: profile } = await supabase
      .from('profiles')
      .select('username, email_verified')
      .eq('id', userId)
      .maybeSingle()

    if (profile?.email_verified) return { sent: true, alreadyVerified: true }

    const { data: code, error } = await supabase.rpc('issue_email_verification_code')
    if (error || !code) throw new Error(error?.message ?? 'Could not issue code')

    const result = await sendTemplateEmail('signup-verification', email, {
      templateData: { code, username: profile?.username ?? '' },
      idempotencyKey: `signup-verify-${userId}-${code}`,
    })

    return { sent: result.sent, alreadyVerified: false }
  })

export const submitVerificationCode = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => {
    const code = String(input?.code ?? '').trim()
    if (!/^\d{6}$/.test(code)) throw new Error('Invalid code format')
    return { code }
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any }
    const { data: result, error } = await supabase.rpc('verify_email_code', { _code: data.code })
    if (error) throw new Error(error.message)
    return result as { ok: boolean; reason?: string }
  })
