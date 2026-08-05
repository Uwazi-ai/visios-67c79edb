/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandRow}>
          <Text style={brand}>KOVA</Text>
        </Section>
        <Heading style={h1}>Confirm your email</Heading>
        <Text style={text}>
          Welcome to <Link href={siteUrl} style={link}><strong>{siteName}</strong></Link>. One quick step:
          confirm <Link href={`mailto:${recipient}`} style={link}>{recipient}</Link> to activate your workspace.
        </Text>
        <Button style={button} href={confirmationUrl}>Confirm email</Button>
        <Text style={footer}>
          If you didn't create an account, you can safely ignore this email.
        </Text>
        <Text style={legal}>YOUR TECH STACK <span style={slashSm}>/</span> ONE OS.</Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', margin: 0, padding: 0 }
const container = { padding: '40px 32px', maxWidth: '560px', margin: '0 auto' }
const brandRow = { borderBottom: '1px solid #ECECEF', paddingBottom: '20px', marginBottom: '32px' }
const brand = { fontSize: '11px', letterSpacing: '0.18em', fontWeight: 700 as const, color: '#02020A', margin: 0, textTransform: 'uppercase' as const }
const slash = { color: '#2563EB' }
const slashSm = { color: '#2563EB' }
const h1 = { fontSize: '26px', fontWeight: 700 as const, color: '#02020A', margin: '0 0 16px', letterSpacing: '-0.01em' }
const text = { fontSize: '15px', color: '#3A3A45', lineHeight: '1.55', margin: '0 0 28px' }
const link = { color: '#2563EB', textDecoration: 'none' }
const button = { backgroundColor: '#2563EB', color: '#ffffff', fontSize: '14px', fontWeight: 600 as const, borderRadius: '10px', padding: '14px 24px', textDecoration: 'none', display: 'inline-block' }
const footer = { fontSize: '13px', color: '#7A7A85', margin: '36px 0 0', lineHeight: '1.5' }
const legal = { fontSize: '10px', letterSpacing: '0.18em', color: '#A0A0A8', margin: '40px 0 0', textTransform: 'uppercase' as const, fontWeight: 600 as const }
