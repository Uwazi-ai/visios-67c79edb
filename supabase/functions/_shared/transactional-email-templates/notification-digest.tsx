/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Group { orgName?: string; items?: { title?: string; body?: string }[] }
interface Props { name?: string; groups?: Group[]; overflow?: boolean }

const DigestEmail = ({ groups, overflow }: Props) => {
  const list = groups ?? []
  const total = list.reduce((n, g) => n + (g.items?.length ?? 0), 0)
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{total} update{total === 1 ? '' : 's'} across your organizations</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section><Text style={brand}>KOVA</Text></Section>
          <Heading style={h1}>{total} update{total === 1 ? '' : 's'} waiting</Heading>
          {overflow ? (
            <Text style={note}>Some alerts were grouped here because you hit today's email limit.</Text>
          ) : null}
          {list.map((g, i) => (
            <Section key={i}>
              <Text style={eyebrow}>{g.orgName || 'Personal'}</Text>
              {(g.items ?? []).map((it, j) => (
                <Text key={j} style={text}>
                  <strong>{it.title}</strong>
                  {it.body ? <><br />{it.body}</> : null}
                </Text>
              ))}
              <Hr style={rule} />
            </Section>
          ))}
          <Button style={button} href="https://visios.uwazi.ai/os">Open Kova</Button>
          <Text style={footer}>Change your digest cadence in Settings → Notifications.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: DigestEmail,
  subject: (d: Record<string, any>) => {
    const total = (d?.groups ?? []).reduce((n: number, g: any) => n + (g.items?.length ?? 0), 0)
    return `Your Kova digest — ${total} update${total === 1 ? '' : 's'}`
  },
  displayName: 'Notification digest',
  previewData: {
    groups: [{ orgName: 'Northstar Group', items: [{ title: '3 proposals need your commit', body: '' }] }],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const brand = { fontSize: '13px', letterSpacing: '0.18em', fontWeight: 700, color: '#0F172A', margin: '0 0 24px' }
const eyebrow = { fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#64748B', margin: '0 0 8px' }
const h1 = { fontSize: '22px', lineHeight: '30px', color: '#0F172A', margin: '0 0 16px' }
const text = { fontSize: '15px', lineHeight: '23px', color: '#334155', margin: '0 0 12px' }
const note = { fontSize: '13px', color: '#64748B', margin: '0 0 16px' }
const rule = { borderColor: '#E2E8F0', margin: '12px 0 20px' }
const button = { backgroundColor: '#0052CC', color: '#ffffff', borderRadius: '8px', padding: '12px 20px', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }
const footer = { fontSize: '12px', lineHeight: '18px', color: '#94A3B8', margin: '28px 0 0' }
