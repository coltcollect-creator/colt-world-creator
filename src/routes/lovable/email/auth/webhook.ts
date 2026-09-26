import * as React from 'react'
import { createAuthEmailHandler, type AuthEmailHookData } from '@lovable.dev/email-js'
import { createFileRoute } from '@tanstack/react-router'
import { SignupEmail } from '@/lib/email-templates/signup'
import { InviteEmail } from '@/lib/email-templates/invite'
import { MagicLinkEmail } from '@/lib/email-templates/magic-link'
import { RecoveryEmail } from '@/lib/email-templates/recovery'
import { EmailChangeEmail } from '@/lib/email-templates/email-change'
import { ReauthenticationEmail } from '@/lib/email-templates/reauthentication'

// Configuration
const SITE_NAME = "colt-world-creator"
const SENDER_DOMAIN = "notify.live.colt-collectibles.com"
const ROOT_DOMAIN = "live.colt-collectibles.com"
const FROM_DOMAIN = "live.colt-collectibles.com"
const SITE_URL = `https://${ROOT_DOMAIN}`

function getHandler() {
  const apiKey = process.env.LOVABLE_API_KEY || 'preview-key-placeholder';
  return createAuthEmailHandler({
    apiKey,
    from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
    senderDomain: SENDER_DOMAIN,
    sendUrl: process.env.LOVABLE_SEND_URL,
    emails: {
      signup: {
        subject: 'Confirm your email',
        render: (data: AuthEmailHookData) =>
          React.createElement(SignupEmail, {
            siteName: SITE_NAME,
            siteUrl: SITE_URL,
            recipient: data.email,
            confirmationUrl: data.url,
          }),
      },
      invite: {
        subject: "You've been invited",
        render: (data: AuthEmailHookData) =>
          React.createElement(InviteEmail, {
            siteName: SITE_NAME,
            siteUrl: SITE_URL,
            confirmationUrl: data.url,
          }),
      },
      magiclink: {
        subject: 'Your login link',
        render: (data: AuthEmailHookData) =>
          React.createElement(MagicLinkEmail, {
            siteName: SITE_NAME,
            confirmationUrl: data.url,
          }),
      },
      recovery: {
        subject: 'Reset your password',
        render: (data: AuthEmailHookData) =>
          React.createElement(RecoveryEmail, {
            siteName: SITE_NAME,
            confirmationUrl: data.url,
          }),
      },
      email_change: {
        subject: 'Confirm your new email',
        render: (data: AuthEmailHookData) =>
          React.createElement(EmailChangeEmail, {
            siteName: SITE_NAME,
            oldEmail: data.old_email ?? '',
            email: data.email,
            newEmail: data.new_email ?? '',
            confirmationUrl: data.url,
          }),
      },
      reauthentication: {
        subject: 'Your verification code',
        render: (data: AuthEmailHookData) =>
          React.createElement(ReauthenticationEmail, { token: data.token ?? '' }),
      },
    },
  });
}

export const Route = createFileRoute("/lovable/email/auth/webhook")({
  server: {
    handlers: {
      POST: ({ request }) => {
        if (!process.env.LOVABLE_API_KEY) {
          return new Response(JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return getHandler()(request);
      },
    },
  },
})
