import fs from 'node:fs';
import { buildSections, toSql } from '../scripts/seed.mjs';
import { freshDb, reporter } from './helpers.mjs';

const { ok, check, expectThrow } = reporter();

// A made-up ontology that exercises every scrub rule. No real data here.
const FIXTURE = `# TITLE
intro text that is not a section

## 1. CORE IDENTITY
| Role | Org |
|---|---|
| Founder | Acme |
| Technical Architect | Ryana for Mayor 2027 |
Ventures: (Acme, Ryana for Mayor, Labs)
Call me at 816-555-0100.

---

## 2. VENTURES (top level)
The building runs $1.5–3M, with $200K+ in revenue.
- **Pricing designed:** Solo $29 / Team $79.
- Membership idea at $25/month.

#### Funding
- SAFE: $500K at a $6M cap.

#### Team
- Pat: builder.

### 5.2 Ryana for Mayor 2027 (campaign)
- vote model here

### 5.3 Club
- Board member.

## 3. GOALS
- Ship the app.
- Watchdog archetype: investigative journalists and auditors.
- Personal goal: journaling.
`;

const { sections, report } = buildSections(FIXTURE);
const all = sections.map((s) => s.body).join('\n');

check(sections.map((s) => s.slug).join(',') === 'core-identity,ventures,goals', 'splits on ## headings with clean slugs');
check(sections[0].venture === 'personal' && sections[1].venture === 'system', 'ventures assigned');
check(sections[1].title === 'VENTURES (top level)', 'title keeps its text without the number');
check(!/Ryana for Mayor|campaign|vote model/i.test(all), 'campaign removed');
check(all.includes('(Acme, Labs)'), 'inline campaign mention cut, rest of line kept');
check(!/\$\d/.test(all) && !/SAFE/.test(all), 'financial figures removed');
check(all.includes('[amount withheld] in revenue'), 'amounts redacted in place');
check(!/Solo|Membership idea/.test(all), 'pricing lines removed');
check(!/555/.test(all), 'phone number removed');
check(!/journaling/i.test(all), 'journal line removed');
check(all.includes('investigative journalists'), 'the word journalists is not treated as journal content');
check(all.includes('Pat: builder') && all.includes('Board member'), 'content after dropped subsections kept');
check(!sections[0].body.endsWith('---'), 'trailing rule trimmed');
check(report.droppedSubsections.length === 2 && report.redactedAmounts === 2, 'scrub report counts');

expectThrow(() => buildSections('## A\nbody\n## A\nbody'), 'duplicate slugs rejected');
expectThrow(() => buildSections('## A\nmy journal entry'), 'section emptied by scrubbing rejected');

// The generated SQL loads, and re-running it does not bump versions.
const db = await freshDb();
await db.exec(toSql(sections));
await db.exec(toSql(sections));
const rows = (await db.query(`select slug, version from brain.sections order by slug`)).rows;
check(rows.length === 3 && rows.every((r) => r.version === 1), 'seed is idempotent');
const edited = sections.map((s) => (s.slug === 'goals' ? { ...s, body: `${s.body}\n- More.` } : s));
await db.exec(toSql(edited));
const v = (await db.query(`select version from brain.sections where slug='goals'`)).rows[0].version;
check(v === 2, 'changed body bumps the version');

// The real ontology is gitignored, so this part only runs where it exists.
const real = new URL('../seed/myke-shaw-ontology.md', import.meta.url);
if (fs.existsSync(real)) {
  const built = buildSections(fs.readFileSync(real, 'utf8'));
  const realDb = await freshDb();
  await realDb.exec(toSql(built.sections));
  const n = (await realDb.query(`select count(*)::int c from brain.sections`)).rows[0].c;
  check(n === built.sections.length && n === 18, `real ontology seeds ${n} sections`);
  const hit = (await realDb.query(`select count(*)::int c from brain.sections where search @@ plainto_tsquery('english','civic compass')`)).rows[0].c;
  check(hit > 0, 'real ontology is searchable');
} else {
  ok('real ontology not present, skipped');
}
