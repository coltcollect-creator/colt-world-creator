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
  heading?: string
  lines?: string[]
  footerNote?: string
}

const OwnerAlert = ({ heading = 'עדכון מהמערכת', lines = [], footerNote }: Props) => (
  <Html lang="he" dir="rtl">
    <Head />
    <Preview>{heading}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{heading}</Heading>
        <Section style={box}>
          {lines.map((line, i) => (
            <Text key={i} style={text}>
              {line}
            </Text>
          ))}
        </Section>
        {footerNote && <Text style={smallText}>{footerNote}</Text>}
        <Text style={footer}>— COLT-A-CON · התראות ניהול</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OwnerAlert,
  subject: (data: Record<string, any>) =>
    `[COLT] ${data?.heading ?? 'עדכון מהמערכת'}`,
  displayName: 'Owner alert',
  to: 'coltcollect@gmail.com',
  previewData: {
    heading: 'משתמש חדש נרשם 🎉',
    lines: ['שם משתמש: Collector', 'תאריך: 10/09/2026 09:30'],
    footerNote: 'התראה אוטומטית לכתובת הניהול.',
  },
} satisfies TemplateEntry

export default OwnerAlert

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '520px' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#111', margin: '0 0 16px' }
const box = {
  background: '#faf6ec',
  border: '1px solid #e8d9ad',
  borderRadius: '12px',
  padding: '14px 16px',
  margin: '0 0 16px',
}
const text = { fontSize: '15px', color: '#333', lineHeight: '1.6', margin: '0 0 6px' }
const smallText = { fontSize: '12px', color: '#666', margin: '10px 0 0' }
const footer = { fontSize: '12px', color: '#999', margin: '20px 0 0' }
