/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Kova'

interface OrgInviteProps {
  orgName?: string
  inviterName?: string
  signupUrl?: string
}

const OrgInviteEmail = ({ orgName, inviterName, signupUrl }: OrgInviteProps) => {
  const url = signupUrl || 'https://visios.uwazi.ai/login'
  const org = orgName || 'a team'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>You've been invited to join {org} on {SITE_NAME}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={brandRow}>
            <Text style={brand}>KOVA <span style={slash}>/</span> {SITE_NAME}</Text>
          </Section>
          <Heading style={h1}>You're invited to {org}</Heading>
          <Text style={text}>
            {inviterName ? `${inviterName} has invited you` : 'You have been invited'} to join{' '}
            <strong>{org}</strong> on Kova — your team's unified workspace for email, tasks,
            calendar, and decisions.
          </Text>
          <Text style={text}>Sign in with the email this invite was sent to and you'll be added automatically.</Text>
          <Button style={button} href={url}>Accept invite & sign in</Button>
          <Text style={footer}>If you weren't expecting this, you can safely ignore this email.</Text>
          <Text style={legal}>YOUR TECH STACK <span style={slash}>/</span> ONE OS.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: OrgInviteEmail,
  subject: (data: Record<string, any>) =>
    data?.orgName ? `You're invited to join ${data.orgName}` : "You're invited",
  displayName: 'Org invite',
  previewData: { orgName: 'Uwazi', inviterName: 'Alex', signupUrl: 'https://visios.uwazi.ai/login' },
} satisfies TemplateEntry

export default OrgInviteEmail

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
