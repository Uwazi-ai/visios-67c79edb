#!/usr/bin/env node
// Builds the brain.sections seed from the ontology markdown.
//
//   node brain-mcp/scripts/seed.mjs [path-to-ontology.md]
//
// Default input:  brain-mcp/seed/myke-shaw-ontology.md  (or BRAIN_ONTOLOGY_PATH)
// Output:         brain-mcp/seed/sections.sql
//
// Both live in brain-mcp/seed/, which is gitignored. This repo is public, so
// the ontology and the generated SQL must never be committed.
//
// The script scrubs the ontology before it becomes seed data:
//   - the campaign is removed entirely
//   - financial figures are removed or redacted
//   - journal and relationship details are removed
//   - phone numbers are removed
// A final check fails the run if anything forbidden is still present, so a
// changed ontology cannot leak past the scrubber silently.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SEED_DIR = path.join(HERE, '..', 'seed');

// Whole subsections to drop, matched on their heading line.
const DROP_SUBSECTIONS = [
  /^###\s+5\.2\b/, // the campaign
  /^####\s+Funding\b/, // raise terms
  /^####\s+UWAZI\+/, // pricing tiers, held back for now
];

// Pricing is out of the brain for now. Any line that talks about a price goes.
const PRICING = /\bpric(?:e|es|ed|ing)\b|\bpremium membership\b|\$\d[\d,.]*\s*\/\s*(?:month|mo)\b/i;

// Phrases cut out of lines that are otherwise worth keeping.
const INLINE_REMOVALS = [
  /, Ryana for Mayor(?: 2027)?(?=,)/g,
  /; Ryana for Mayor marketing plan deck \(with FUSE Advertising\)/g,
  /campaign deck standard for RPS 2027; /g,
  /; 2027 mayoral candidate/g,
  /Ryana for Mayor campaign through June 22, 2027\. /g,
];

const CAMPAIGN = /Ryana for Mayor|R4M|Campaign OS|Lavern|Campaign Verify|Derek Beriet|mayoral|campaign/i;
// Word-bounded so "journalists" (a Civic Compass archetype) is not caught.
const PRIVATE = /\bjournal(?:s|ed|ing)?\b|Same Sky|long-distance/i;
const PHONE = /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/;
const MONEY = /\$\d[\d,]*(?:\.\d+)?(?:[–-]\d[\d,]*(?:\.\d+)?)?[KMB]?\+?(?:\/(?:month|mo)\b)?/g;
const MONEY_LEFT = /\$\s?\d/;
const REDACTED = '[amount withheld]';

const VENTURES = {
  'core-identity': 'personal',
  'trajectory-and-goals': 'personal',
  'consulting-practice': 'consulting',
};

function dropSubsections(lines, report) {
  const out = [];
  let skipLevel = 0;
  for (const line of lines) {
    const heading = /^(#{1,6})\s/.exec(line);
    if (skipLevel && heading && heading[1].length <= skipLevel) skipLevel = 0;
    if (!skipLevel && DROP_SUBSECTIONS.some((re) => re.test(line))) {
      skipLevel = heading[1].length;
      report.droppedSubsections.push(line.replace(/^#+\s+/, ''));
    }
    if (!skipLevel) out.push(line);
  }
  return out;
}

export function scrub(markdown) {
  const report = { droppedSubsections: [], droppedLines: 0, redactedAmounts: 0 };
  let lines = dropSubsections(markdown.split('\n'), report);

  lines = lines.map((line) => INLINE_REMOVALS.reduce((l, re) => l.replace(re, ''), line));

  lines = lines.filter((line) => {
    const drop = CAMPAIGN.test(line) || PRIVATE.test(line) || PHONE.test(line) || PRICING.test(line);
    if (drop) report.droppedLines += 1;
    return !drop;
  });

  lines = lines.map((line) =>
    line.replace(MONEY, () => {
      report.redactedAmounts += 1;
      return REDACTED;
    }),
  );

  return { text: lines.join('\n'), report };
}

function slugify(heading) {
  return heading
    .replace(/^\d+\.\s*/, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function verify(sections) {
  const checks = [
    ['campaign content', CAMPAIGN],
    ['journal or relationship detail', PRIVATE],
    ['phone number', PHONE],
    ['pricing', PRICING],
    ['financial figure', MONEY_LEFT],
  ];
  for (const s of sections) {
    for (const line of `${s.title}\n${s.body}`.split('\n')) {
      for (const [label, re] of checks) {
        if (re.test(line)) {
          throw new Error(`Seed blocked: ${label} found in section "${s.slug}": ${line.trim()}`);
        }
      }
    }
  }
}

export function buildSections(markdown) {
  const { text, report } = scrub(markdown);
  const sections = [];
  let current = null;
  for (const line of text.split('\n')) {
    const h2 = /^##\s+(.+?)\s*$/.exec(line);
    if (h2) {
      current = { heading: h2[1], lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }

  const built = sections.map(({ heading, lines }) => {
    const slug = slugify(heading);
    const body = lines
      .join('\n')
      .replace(/\n-{3,}\s*$/, '')
      .trim();
    return {
      slug,
      title: heading.replace(/^\d+\.\s*/, ''),
      venture: VENTURES[slug] ?? 'system',
      body,
    };
  });

  const slugs = new Set();
  for (const s of built) {
    if (!s.slug) throw new Error(`Section "${s.title}" produced an empty slug`);
    if (slugs.has(s.slug)) throw new Error(`Duplicate section slug: ${s.slug}`);
    if (!s.body) throw new Error(`Section "${s.slug}" is empty after scrubbing`);
    slugs.add(s.slug);
  }
  verify(built);
  return { sections: built, report };
}

const TAG = '$brain_seed$';
const quote = (value) => {
  if (value.includes(TAG)) throw new Error(`Seed text contains the quote tag ${TAG}`);
  return `${TAG}${value}${TAG}`;
};

// Upsert, so the seed can be re-run. The sections trigger bumps the version
// only when a body actually changes.
export function toSql(sections) {
  const rows = sections
    .map((s, i) => `  (${quote(s.slug)}, ${quote(s.title)}, ${quote(s.venture)}, ${quote(s.body)}, ${i + 1})`)
    .join(',\n');
  return [
    'begin;',
    'insert into brain.sections (slug, title, venture, body, position) values',
    `${rows}`,
    'on conflict (slug) do update',
    '  set title = excluded.title, venture = excluded.venture, body = excluded.body,',
    '      position = excluded.position;',
    'commit;',
    '',
  ].join('\n');
}

function main() {
  const input =
    process.argv[2] ??
    process.env.BRAIN_ONTOLOGY_PATH ??
    path.join(SEED_DIR, 'myke-shaw-ontology.md');
  if (!fs.existsSync(input)) {
    console.error(`Ontology not found at ${input}. Put it in brain-mcp/seed/ or pass a path.`);
    process.exit(1);
  }
  const { sections, report } = buildSections(fs.readFileSync(input, 'utf8'));
  fs.mkdirSync(SEED_DIR, { recursive: true });
  const out = path.join(SEED_DIR, 'sections.sql');
  fs.writeFileSync(out, toSql(sections));

  console.log(`Seeded sections (${sections.length}):`);
  for (const s of sections) {
    console.log(`  ${s.slug.padEnd(34)} ${s.venture.padEnd(11)} ${String(s.body.length).padStart(6)} chars`);
  }
  console.log('\nScrubbed:');
  console.log(`  subsections dropped: ${report.droppedSubsections.join('; ') || 'none'}`);
  console.log(`  lines dropped:       ${report.droppedLines}`);
  console.log(`  amounts redacted:    ${report.redactedAmounts}`);
  console.log(`\nWrote ${path.relative(process.cwd(), out)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
