// Synthetic venture capital engagement — Lumen Ventures Fund II, L.P.
// All entities, people, and figures are fictional.
//
// Seeded discrepancy: the LPA and Note 4 disclose that 100% of portfolio
// monitoring and director fees offset management fees, and Note 4 states
// $1,800,000 of such fees were received — yet the Statement of Operations
// reports gross management fees of $6,250,000 with no offset applied. Net
// management fees should be $4,450,000.

import { PdfDoc } from '../lib/pdf.mjs'
import { usd } from '../lib/format.mjs'

const FUND = 'Lumen Ventures Fund II, L.P.'
const GP = 'Lumen Ventures GP II, LLC'
const AUDITOR = 'Pinnacle Audit Group LLP'
const ADMIN = 'Northgate Fund Administration, LLC'
const FYE = 'December 31, 2024'

const COMMITMENTS = 250_000_000
const PAID_IN = 160_000_000
const UNCALLED = COMMITMENTS - PAID_IN
const CASH = 88_000_000
const OTHER_ASSETS = 1_200_000
const ACCRUED_LIABS = 2_300_000

const MGMT_FEE_GROSS = 6_250_000        // 2.5% of committed capital
const MONITORING_OFFSET = 1_800_000     // disclosed but NOT applied (seeded)

const PORTFOLIO = [
  ['Heliograph AI', 'AI Infrastructure', 12_000_000, 38_000_000, 'Series A — marked to recent financing'],
  ['Tidepool Robotics', 'Robotics', 10_000_000, 16_000_000, 'Series B — marked to recent financing'],
  ['Quanta Bio', 'Biotechnology', 9_000_000, 9_000_000, 'Seed — held at cost'],
  ['Northstar Fintech', 'Financial Technology', 8_000_000, 14_000_000, 'Series A — marked to recent financing'],
  ['Verdant Climate', 'Climate Tech', 7_000_000, 7_000_000, 'Seed — held at cost'],
  ['Looplng Commerce', 'E-Commerce', 6_000_000, 2_400_000, 'Series A — written down'],
  ['Cobalt Security', 'Cybersecurity', 6_000_000, 11_000_000, 'Series B — marked to recent financing'],
  ['Mosaic Health', 'Digital Health', 5_000_000, 6_500_000, 'Seed — marked to recent financing'],
]
const SOI_COST = PORTFOLIO.reduce((s, p) => s + p[2], 0)   // 63,000,000
const SOI_FV = PORTFOLIO.reduce((s, p) => s + p[3], 0)     // 103,900,000
const INVESTMENTS_FV = SOI_FV                              // ties to balance sheet
const NAV = INVESTMENTS_FV + CASH + OTHER_ASSETS - ACCRUED_LIABS  // 190,800,000

const INV_INCOME = 1_100_000
const PROF_FEES = 1_400_000
const TOTAL_EXPENSES = MGMT_FEE_GROSS + PROF_FEES         // 7,650,000 (no offset applied)
const NET_INV_LOSS = INV_INCOME - TOTAL_EXPENSES          // (6,550,000)
const UNREALIZED = 19_350_000
const OPS = NET_INV_LOSS + UNREALIZED                     // 12,800,000
const BEGIN_CAP = 133_000_000
const CONTRIBUTIONS = 45_000_000

function auditedFinancials() {
  const d = new PdfDoc()
  d.spacer(110)
  d.heading(FUND, { size: 22, gapAfter: 14 })
  d.paragraph('Financial Statements', { size: 14, font: 'bold', gapAfter: 2, leading: 18 })
  d.paragraph(`For the Year Ended ${FYE}`, { size: 12, gapAfter: 30, leading: 16 })
  d.paragraph(`Auditor: ${AUDITOR}   ·   Administrator: ${ADMIN}`, { size: 10, leading: 14, gapAfter: 2 })
  d.paragraph('Functional Currency: U.S. Dollars (USD)', { size: 10, leading: 14 })

  d._newPage()
  d.heading('Report of Independent Auditors', { size: 15 })
  d.paragraph(`To the Partners of ${FUND}:`, { gapAfter: 8 })
  d.paragraph(
    `We have audited the accompanying financial statements of ${FUND} (the "Fund"), which comprise the ` +
    `statement of assets and liabilities, including the schedule of investments, as of ${FYE}, and the ` +
    `related statements of operations and changes in partners' capital for the year then ended. In our ` +
    'opinion, the financial statements present fairly, in all material respects, the financial position of ' +
    `the Fund as of ${FYE} in accordance with U.S. GAAP, including ASC 946, Financial Services — ` +
    'Investment Companies.'
  )
  d.spacer(8)
  d.paragraph(`${AUDITOR}`, { font: 'bold', gapAfter: 2, leading: 13 })
  d.paragraph('San Francisco, California — March 21, 2025', { size: 9, leading: 12 })

  d._newPage()
  d.heading('Statement of Assets and Liabilities', { size: 15 })
  d.paragraph(`As of ${FYE}`, { size: 9, gapAfter: 8, leading: 12 })
  d.subheading('Assets')
  d.amountRow(`Investments, at fair value (cost ${usd(SOI_COST)})`, usd(INVESTMENTS_FV), { indent: 12 })
  d.amountRow('Cash and cash equivalents', usd(CASH), { indent: 12 })
  d.amountRow('Other assets', usd(OTHER_ASSETS), { indent: 12 })
  d.rule()
  d.amountRow('Total assets', usd(INVESTMENTS_FV + CASH + OTHER_ASSETS), { bold: true })
  d.spacer(8)
  d.subheading('Liabilities')
  d.amountRow('Accrued expenses and other liabilities', usd(ACCRUED_LIABS), { indent: 12 })
  d.rule()
  d.amountRow("Total partners' capital (net assets)", usd(NAV), { bold: true })

  d._newPage()
  d.heading('Statement of Operations', { size: 15 })
  d.paragraph(`For the Year Ended ${FYE}`, { size: 9, gapAfter: 8, leading: 12 })
  d.subheading('Investment income')
  d.amountRow('Interest and dividend income', usd(INV_INCOME), { indent: 12 })
  d.subheading('Expenses')
  d.amountRow('Management fees', usd(MGMT_FEE_GROSS), { indent: 12 })
  d.amountRow('Professional fees and other', usd(PROF_FEES), { indent: 12 })
  d.rule()
  d.amountRow('Total expenses', usd(TOTAL_EXPENSES), { bold: true })
  d.amountRow('Net investment loss', usd(NET_INV_LOSS), { bold: true })
  d.spacer(8)
  d.subheading('Realized and unrealized gains')
  d.amountRow('Net realized gain on investments', usd(0), { indent: 12 })
  d.amountRow('Net change in unrealized appreciation', usd(UNREALIZED), { indent: 12 })
  d.rule()
  d.amountRow('Net increase in net assets from operations', usd(OPS), { bold: true })

  d._newPage()
  d.heading("Statement of Changes in Partners' Capital", { size: 15 })
  d.paragraph(`For the Year Ended ${FYE}`, { size: 9, gapAfter: 8, leading: 12 })
  d.amountRow("Partners' capital, beginning of year", usd(BEGIN_CAP))
  d.amountRow('Capital contributions', usd(CONTRIBUTIONS), { indent: 12 })
  d.amountRow('Distributions', usd(0), { indent: 12 })
  d.amountRow('Net increase from operations', usd(OPS), { indent: 12 })
  d.rule()
  d.amountRow("Partners' capital, end of year", usd(NAV), { bold: true })

  d._newPage()
  d.heading('Schedule of Investments', { size: 15 })
  d.paragraph(`As of ${FYE} — all investments are Level 3 in the fair value hierarchy`, { size: 9, gapAfter: 8, leading: 12 })
  d.amountRow('Portfolio Company / Sector', 'Fair Value', { bold: true })
  d.rule()
  for (const [name, sector, cost, fv, basis] of PORTFOLIO) {
    d.amountRow(name, usd(fv))
    d.paragraph(`${sector} — cost ${usd(cost)} · ${basis}`, { size: 8, indent: 12, leading: 11, gapAfter: 3 })
  }
  d.rule()
  d.amountRow('Total investments, at fair value', usd(SOI_FV), { bold: true })
  d.amountRow('Total cost', usd(SOI_COST), { size: 9 })

  d._newPage()
  d.heading('Notes to the Financial Statements', { size: 15 })
  d.subheading('Note 1 — Organization')
  d.paragraph(
    `${FUND} is a Delaware limited partnership formed in 2022 to make early-stage venture capital ` +
    `investments. The general partner is ${GP}. Total commitments are ${usd(COMMITMENTS)}, of which ` +
    `${usd(PAID_IN)} had been called as of ${FYE}, leaving ${usd(UNCALLED)} of uncalled commitments.`
  )
  d.subheading('Note 2 — Significant Accounting Policies')
  d.paragraph(
    'The Fund follows ASC 946 and carries investments at fair value. Early-stage investments are generally ' +
    'held at cost as the best estimate of fair value until a subsequent priced financing round or other ' +
    'observable event indicates a change in value.'
  )
  d.subheading('Note 3 — Fair Value Measurements (ASC 820)')
  d.paragraph(
    'All investments are Level 3. Marked positions are valued by reference to the price of the most recent ' +
    'priced financing round, adjusted for liquidation preferences. The written-down position (Looplng ' +
    'Commerce) reflects a down round and reduced revenue trajectory.'
  )
  d.subheading('Note 4 — Related Party Transactions and Management Fee Offset')
  d.paragraph(
    'The general partner earns a management fee of 2.5% per annum of aggregate commitments during the ' +
    'investment period. Under the limited partnership agreement, 100% of any portfolio monitoring, director, ' +
    'and transaction fees received by the general partner or its affiliates are credited against (offset) the ' +
    'management fee. During the year, the general partner received ' + usd(MONITORING_OFFSET) + ' of such ' +
    'monitoring and director fees. The general partner is also entitled to 20% carried interest, subject to ' +
    'an 8% preferred return and a full catch-up, on a whole-fund basis.'
  )
  d.subheading('Note 5 — Financial Highlights')
  d.keyValue('Total Value to Paid-In (TVPI)', '1.19x')
  d.keyValue('Distributed to Paid-In (DPI)', '0.00x')
  d.keyValue('Residual Value to Paid-In (RVPI)', '1.19x')
  d.keyValue('Net IRR since inception', '11.4%')
  d.subheading('Note 6 — Subsequent Events')
  d.paragraph(
    'The Fund has evaluated subsequent events through March 21, 2025. In January 2025, Heliograph AI ' +
    'completed a Series B financing that the general partner expects to result in a further markup in 2025. ' +
    'No other material subsequent events were identified.'
  )
  return d.toBuffer()
}

function capitalAccountStatement() {
  const d = new PdfDoc()
  const LP = 'University of Calder Endowment'
  const PCT = 0.04
  d.heading(FUND, { size: 16, gapAfter: 6 })
  d.paragraph('Limited Partner Capital Account Statement', { font: 'bold', size: 12, gapAfter: 2, leading: 16 })
  d.paragraph(`As of ${FYE}`, { size: 10, gapAfter: 10, leading: 13 })
  d.keyValue('Limited Partner', LP)
  d.keyValue('Capital Commitment', usd(COMMITMENTS * PCT))
  d.keyValue('Ownership Percentage', '4.00%')
  d.spacer(8)
  d.subheading('Capital Account Activity — Year Ended ' + FYE)
  d.amountRow('Beginning capital account balance', usd(BEGIN_CAP * PCT))
  d.amountRow('Capital contributions', usd(CONTRIBUTIONS * PCT), { indent: 12 })
  d.amountRow('Distributions', usd(0), { indent: 12 })
  d.amountRow('Allocated net income', usd(OPS * PCT), { indent: 12 })
  d.rule()
  d.amountRow('Ending capital account balance', usd(NAV * PCT), { bold: true })
  d.spacer(10)
  d.subheading('Commitment Summary')
  d.amountRow('Total commitment', usd(COMMITMENTS * PCT))
  d.amountRow('Cumulative contributions (paid-in)', usd(PAID_IN * PCT))
  d.amountRow('Remaining unfunded commitment', usd(UNCALLED * PCT), { bold: true })
  d.spacer(10)
  d.paragraph('Prepared by ' + ADMIN + ' on a U.S. GAAP basis consistent with the audited financial statements.', { size: 8, leading: 11 })
  return d.toBuffer()
}

function lpaKeyTerms() {
  const d = new PdfDoc()
  d.heading(FUND, { size: 16, gapAfter: 6 })
  d.paragraph('Limited Partnership Agreement — Summary of Key Terms', { font: 'bold', size: 12, gapAfter: 2, leading: 16 })
  d.paragraph('Confidential — For Limited Partner Use Only', { size: 9, gapAfter: 12, leading: 12 })
  const term = (k, v) => d.keyValue(k, v, { size: 10, leading: 16 })
  d.subheading('Fund Structure')
  term('Legal form', 'Delaware limited partnership')
  term('Vintage year', '2022')
  term('Total commitments', usd(COMMITMENTS))
  term('General partner commitment', '1.0% of commitments')
  d.subheading('Term and Investment Period')
  term('Fund term', '10 years + two 1-year extensions')
  term('Investment period', '5 years from final closing')
  term('Recycling', 'Permitted within 24 months of distribution')
  d.subheading('Economics')
  term('Management fee (investment period)', '2.5% of committed capital')
  term('Management fee offset', '100% of monitoring & director fees')
  term('Carried interest', '20%')
  term('Preferred return (hurdle)', '8%')
  term('Distribution waterfall', 'Whole-fund (European)')
  d.subheading('Governance')
  term('Key person provision', 'Present — 2 named principals')
  term('No-fault divorce', 'Suspends investment period')
  term('Pro-rata / information rights', 'Present')
  d.spacer(10)
  d.paragraph(
    'Key persons: Priya N. Raman and Daniel Okafor. A key person event suspends the investment period until ' +
    'a replacement is approved by the LP advisory committee.',
    { size: 9, leading: 12 }
  )
  return d.toBuffer()
}

export default {
  slug: 'lumen-ventures-ii',
  name: 'Lumen Ventures Fund II — Annual Review 2024',
  fundType: 'VC',
  seeded:
    'LPA and Note 4 disclose a 100% management-fee offset for $1,800,000 of monitoring/director fees ' +
    'received, but the Statement of Operations reports gross management fees of $6,250,000 with no offset ' +
    'applied. Net management fees should be $4,450,000.',
  build() {
    return [
      ['01-audited-financial-statements.pdf', auditedFinancials()],
      ['02-capital-account-statement.pdf', capitalAccountStatement()],
      ['03-lpa-key-terms.pdf', lpaKeyTerms()],
    ]
  },
}
