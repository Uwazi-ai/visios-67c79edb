/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandRow}>
          <Text style={brand}>VISI OS <span style={slash}>/</span> VERIFY</Text>
        </Section>
        <Heading style={h1}>Confirm it's you</Heading>
        <Text style={text}>Use the code below to confirm your identity:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>This code expires shortly. If you didn't request it, you can safely ignore this email.</Text>
        <Text style={legal}>YOUR TECH STACK <span style={slash}>/</span> ONE OS.</Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', margin: 0, padding: 0 }
const container = { padding: '40px 32px', maxWidth: '560px', margin: '0 auto' }
const brandRow = { borderBottom: '1px solid #ECECEF', paddingBottom: '20px', marginBottom: '32px' }
const brand = { fontSize: '11px', letterSpacing: '0.18em', fontWeight: 700 as const, color: '#02020A', margin: 0, textTransform: 'uppercase' as const }
const slash = { color: '#2563EB' }
const h1 = { fontSize: '26px', fontWeight: 700 as const, color: '#02020A', margin: '0 0 16px', letterSpacing: '-0.01em' }
const text = { fontSize: '15px', color: '#3A3A45', lineHeight: '1.55', margin: '0 0 20px' }
const codeStyle = { fontFamily: '"JetBrains Mono", "SF Mono", Consolas, monospace', fontSize: '32px', fontWeight: 700 as const, color: '#2563EB', letterSpacing: '0.2em', margin: '0 0 32px', padding: '16px 20px', background: '#F4F6FB', borderRadius: '10px', display: 'inline-block' }
const footer = { fontSize: '13px', color: '#7A7A85', margin: '36px 0 0', lineHeight: '1.5' }
const legal = { fontSize: '10px', letterSpacing: '0.18em', color: '#A0A0A8', margin: '40px 0 0', textTransform: 'uppercase' as const, fontWeight: 600 as const }
