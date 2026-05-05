/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to join {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandRow}>
          <Text style={brand}>VISI OS <span style={slash}>/</span> {siteName}</Text>
        </Section>
        <Heading style={h1}>You're invited</Heading>
        <Text style={text}>
          You've been invited to join <Link href={siteUrl} style={link}><strong>{siteName}</strong></Link> on
          Visi OS — your team's unified workspace for email, tasks, calendar and decisions.
        </Text>
        <Button style={button} href={confirmationUrl}>Accept invite</Button>
        <Text style={footer}>If you weren't expecting this, you can safely ignore this email.</Text>
        <Text style={legal}>YOUR TECH STACK <span style={slash}>/</span> ONE OS.</Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

const main = { backgroundColor: '#ffffff', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', margin: 0, padding: 0 }
const container = { padding: '40px 32px', maxWidth: '560px', margin: '0 auto' }
const brandRow = { borderBottom: '1px solid #ECECEF', paddingBottom: '20px', marginBottom: '32px' }
const brand = { fontSize: '11px', letterSpacing: '0.18em', fontWeight: 700 as const, color: '#02020A', margin: 0, textTransform: 'uppercase' as const }
const slash = { color: '#2563EB' }
const h1 = { fontSize: '26px', fontWeight: 700 as const, color: '#02020A', margin: '0 0 16px', letterSpacing: '-0.01em' }
const text = { fontSize: '15px', color: '#3A3A45', lineHeight: '1.55', margin: '0 0 28px' }
const link = { color: '#2563EB', textDecoration: 'none' }
const button = { backgroundColor: '#2563EB', color: '#ffffff', fontSize: '14px', fontWeight: 600 as const, borderRadius: '10px', padding: '14px 24px', textDecoration: 'none', display: 'inline-block' }
const footer = { fontSize: '13px', color: '#7A7A85', margin: '36px 0 0', lineHeight: '1.5' }
const legal = { fontSize: '10px', letterSpacing: '0.18em', color: '#A0A0A8', margin: '40px 0 0', textTransform: 'uppercase' as const, fontWeight: 600 as const }
