import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  code?: string
  username?: string
}

const SignupVerification = ({ code = '000000', username }: Props) => (
  <Html lang="he" dir="rtl">
    <Head />
    <Preview>קוד האימות שלך ל-COLT: {code}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>ברוך/ה הבא/ה ל-COLT-A-CON 🎉</Heading>
        <Text style={text}>
          {username ? `שלום ${username},` : 'שלום,'} תודה על ההרשמה ל-COLT Market World.
        </Text>
        <Text style={text}>
          כדי להשלים את יצירת החשבון, הזן/י את קוד האימות הבא במסך האימות במשחק:
        </Text>
        <Section style={codeBox}>
          <Text style={codeText}>{code}</Text>
        </Section>
        <Text style={smallText}>
          הקוד תקף למשך 15 דקות. אם לא נרשמת ל-COLT, ניתן להתעלם מהמייל הזה.
        </Text>
        <Text style={footer}>— צוות COLT-A-CON</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SignupVerification,
  subject: 'קוד האימות שלך ל-COLT',
  displayName: 'Signup verification code',
  previewData: { code: '482913', username: 'Collector' },
} satisfies TemplateEntry

export default SignupVerification

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '480px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#111', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#333', lineHeight: '1.6', margin: '0 0 14px' }
const smallText = { fontSize: '12px', color: '#666', margin: '18px 0 0' }
const codeBox = {
  background: 'linear-gradient(135deg,#f4c95d,#c98a1a)',
  borderRadius: '14px',
  padding: '18px',
  textAlign: 'center' as const,
  margin: '20px 0',
}
const codeText = {
  fontSize: '34px',
  fontWeight: 'bold' as const,
  letterSpacing: '8px',
  color: '#1a1a1a',
  margin: 0,
}
const footer = { fontSize: '12px', color: '#999', margin: '24px 0 0' }
