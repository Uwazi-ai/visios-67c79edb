/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Kova'

interface Props {
  inviterName?: string
  recipientName?: string
  signInUrl?: string
}

const CalendarConnectInvite = ({ inviterName, recipientName, signInUrl }: Props) => {
  const url = signInUrl || 'https://visios.uwazi.ai/login'
  const who = inviterName || 'A teammate'
  const hi = recipientName ? `Hi ${recipientName.split(' ')[0]},` : 'Hi,'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Connect your Google Calendar so your team can coordinate schedules</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={brandRow}>
            <Text style={brand}>KOVA</Text>
          </Section>
          <Heading style={h1}>Connect your Google Calendar</Heading>
          <Text style={text}>{hi}</Text>
          <Text style={text}>
            {who} would like to see your calendar in the team view on Visi so your group can
            coordinate meetings, find open slots, and plan together.
          </Text>
          <Text style={text}>
            One click and you're done — sign in with Google and grant Calendar access. Only
            free/busy and event titles are shared with your org; private events stay private.
          </Text>
          <Button style={button} href={url}>Sign in & connect Google Calendar</Button>
          <Text style={footer}>If you didn't expect this, you can safely ignore this email.</Text>
          <Text style={legal}>YOUR TECH STACK <span style={slash}>/</span> ONE OS.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: CalendarConnectInvite,
  subject: (data: Record<string, any>) =>
    data?.inviterName ? `${data.inviterName} wants to see your calendar on Visi` : 'Connect your Google Calendar on Visi',
  displayName: 'Calendar connect invite',
  previewData: { inviterName: 'Mychal', recipientName: 'Anna', signInUrl: 'https://visios.uwazi.ai/login' },
} satisfies TemplateEntry

export default CalendarConnectInvite

const main = { backgroundColor: '#ffffff', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', margin: 0, padding: 0 }
const container = { padding: '40px 32px', maxWidth: '560px', margin: '0 auto' }
const brandRow = { borderBottom: '1px solid #ECECEF', paddingBottom: '20px', marginBottom: '32px' }
const brand = { fontSize: '11px', letterSpacing: '0.18em', fontWeight: 700 as const, color: '#02020A', margin: 0, textTransform: 'uppercase' as const }
const slash = { color: '#2563EB' }
const h1 = { fontSize: '26px', fontWeight: 700 as const, color: '#02020A', margin: '0 0 16px', letterSpacing: '-0.01em' }
const text = { fontSize: '15px', color: '#3A3A45', lineHeight: '1.55', margin: '0 0 20px' }
const button = { backgroundColor: '#2563EB', color: '#ffffff', fontSize: '14px', fontWeight: 600 as const, borderRadius: '10px', padding: '14px 24px', textDecoration: 'none', display: 'inline-block', marginTop: '8px' }
const footer = { fontSize: '13px', color: '#7A7A85', margin: '36px 0 0', lineHeight: '1.5' }
const legal = { fontSize: '10px', letterSpacing: '0.18em', color: '#A0A0A8', margin: '40px 0 0', textTransform: 'uppercase' as const, fontWeight: 600 as const }
