/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  title?: string
  body?: string
  orgName?: string
  deepLink?: string
  name?: string
}

const NotificationEmail = ({ title, body, orgName, deepLink }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{title || 'A new notification from Kova'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section><Text style={brand}>KOVA</Text></Section>
        {orgName ? <Text style={eyebrow}>{orgName}</Text> : null}
        <Heading style={h1}>{title || 'New notification'}</Heading>
        {body ? <Text style={text}>{body}</Text> : null}
        <Button style={button} href={deepLink ? `https://visios.uwazi.ai${deepLink}` : 'https://visios.uwazi.ai/os'}>
          Open in Kova
        </Button>
        <Text style={footer}>
          You can change which events email you in Kova under Settings → Notifications.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: NotificationEmail,
  subject: (d: Record<string, any>) => d?.title || 'New notification',
  displayName: 'Notification',
  previewData: { title: 'Marcus sent you a message', body: 'Can you look at the Q3 deck?', orgName: 'Northstar Group', deepLink: '/os' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const brand = { fontSize: '13px', letterSpacing: '0.18em', fontWeight: 700, color: '#0F172A', margin: '0 0 24px' }
const eyebrow = { fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#64748B', margin: '0 0 6px' }
const h1 = { fontSize: '22px', lineHeight: '30px', color: '#0F172A', margin: '0 0 12px' }
const text = { fontSize: '15px', lineHeight: '24px', color: '#334155', margin: '0 0 20px' }
const button = { backgroundColor: '#0052CC', color: '#ffffff', borderRadius: '8px', padding: '12px 20px', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }
const footer = { fontSize: '12px', lineHeight: '18px', color: '#94A3B8', margin: '28px 0 0' }
