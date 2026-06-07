// Synthetic hedge fund engagement — Hadrian Global Macro Fund, L.P.
// All entities, people, and figures are fictional.
//
// Seeded discrepancy: an incentive fee of $5,400,000 (1.1% of average net
// assets) was accrued for the year, but NAV per unit ended at $94.20 — below
// the $100.00 perpetual high water mark. Subject to a high water mark, no
// incentive fee should accrue when NAV per unit is below the prior peak.

import { PdfDoc } from '../lib/pdf.mjs'
import { usd, usd2 } from '../lib/format.mjs'

const FUND = 'Hadrian Global Macro Fund, L.P.'
const IM = 'Hadrian Capital Management, LLC'
const AUDITOR = 'Caldwell & Reyes LLP'
const ADMIN = 'Meridian Prime Administration, Ltd.'
const FYE = 'December 31, 2024'

// Statement of Assets and Liabilities
const INVESTMENTS_LONG = 520_000_000
const CASH_DUE_BROKERS = 60_000_000
const RECV_SECURITIES = 12_000_000
const TOTAL_ASSETS = INVESTMENTS_LONG + CASH_DUE_BROKERS + RECV_SECURITIES   // 592,000,000
const SECURITIES_SHORT = 95_000_000
const PAYABLE_SECURITIES = 18_000_000
const ACCRUED_MGMT_FEE = 800_000
const ACCRUED_INCENTIVE_FEE = 5_400_000     // seeded — accrued below HWM
const OTHER_LIABS = 1_800_000
const TOTAL_LIABS = SECURITIES_SHORT + PAYABLE_SECURITIES + ACCRUED_MGMT_FEE + ACCRUED_INCENTIVE_FEE + OTHER_LIABS
const NET_ASSETS = TOTAL_ASSETS - TOTAL_LIABS               // 471,000,000
const UNITS = 5_000_000
const NAV_PER_UNIT = NET_ASSETS / UNITS                     // 94.20
const HIGH_WATER_MARK = 100.00

// Statement of Operations
const INV_INCOME = 9_200_000
const MGMT_FEE = 9_600_000                  // 2.0% of NAV
const INCENTIVE_FEE = 5_400_000             // seeded — should be 0 below HWM
const OTHER_EXPENSES = 2_100_000
const TOTAL_EXPENSES = MGMT_FEE + INCENTIVE_FEE + OTHER_EXPENSES   // 17,100,000
const NET_INV_LOSS = INV_INCOME - TOTAL_EXPENSES                   // (7,900,000)
const REALIZED_GAIN = 15_300_000
const UNREALIZED_DEP = -43_600_000
const OPS = NET_INV_LOSS + REALIZED_GAIN + UNREALIZED_DEP          // (36,200,000)

// Statement of Changes in Net Assets
const SUBSCRIPTIONS = 40_000_000
const REDEMPTIONS = -60_000_000
const BEGIN_NET_ASSETS = NET_ASSETS - OPS - SUBSCRIPTIONS - REDEMPTIONS   // 527,200,000

const STRATEGY_BOOK = [
  ['Developed market rates (long)', 'Level 1/2', 168_000_000],
  ['Foreign exchange forwards', 'Level 2', 96_000_000],
  ['Equity index futures (long)', 'Level 1', 112_000_000],
  ['Commodity futures', 'Level 1', 74_000_000],
  ['Credit index options', 'Level 2', 70_000_000],
]

function auditedFinancials() {
  const d = new PdfDoc()
  d.spacer(110)
  d.heading(FUND, { size: 22, gapAfter: 14 })
  d.paragraph('Financial Statements', { size: 14, font: 'bold', gapAfter: 2, leading: 18 })
  d.paragraph(`For the Year Ended ${FYE}`, { size: 12, gapAfter: 30, leading: 16 })
  d.paragraph(`Investment Manager: ${IM}`, { size: 10, leading: 14, gapAfter: 2 })
  d.paragraph(`Auditor: ${AUDITOR}   ·   Administrator: ${ADMIN}`, { size: 10, leading: 14, gapAfter: 2 })
  d.paragraph('Functional Currency: U.S. Dollars (USD)', { size: 10, leading: 14 })

  d._newPage()
  d.heading('Report of Independent Auditors', { size: 15 })
  d.paragraph(`To the Partners of ${FUND}:`, { gapAfter: 8 })
  d.paragraph(
    `We have audited the accompanying financial statements of ${FUND} (the "Fund"), which comprise the ` +
    `statement of assets and liabilities as of ${FYE}, and the related statements of operations and changes ` +
    'in net assets for the year then ended. In our opinion, the financial statements present fairly, in all ' +
    `material respects, the financial position of the Fund as of ${FYE} in accordance with U.S. GAAP, ` +
    'including ASC 946.'
  )
  d.spacer(8)
  d.paragraph(`${AUDITOR}`, { font: 'bold', gapAfter: 2, leading: 13 })
  d.paragraph('New York, New York — March 18, 2025', { size: 9, leading: 12 })

  d._newPage()
  d.heading('Statement of Assets and Liabilities', { size: 15 })
  d.paragraph(`As of ${FYE}`, { size: 9, gapAfter: 8, leading: 12 })
  d.subheading('Assets')
  d.amountRow('Investments in securities, at fair value', usd(INVESTMENTS_LONG), { indent: 12 })
  d.amountRow('Cash and due from brokers', usd(CASH_DUE_BROKERS), { indent: 12 })
  d.amountRow('Receivable for securities sold', usd(RECV_SECURITIES), { indent: 12 })
  d.rule()
  d.amountRow('Total assets', usd(TOTAL_ASSETS), { bold: true })
  d.spacer(8)
  d.subheading('Liabilities')
  d.amountRow('Securities sold short, at fair value', usd(SECURITIES_SHORT), { indent: 12 })
  d.amountRow('Payable for securities purchased', usd(PAYABLE_SECURITIES), { indent: 12 })
  d.amountRow('Accrued management fee', usd(ACCRUED_MGMT_FEE), { indent: 12 })
  d.amountRow('Accrued incentive fee', usd(ACCRUED_INCENTIVE_FEE), { indent: 12 })
  d.amountRow('Other liabilities', usd(OTHER_LIABS), { indent: 12 })
  d.rule()
  d.amountRow('Total liabilities', usd(TOTAL_LIABS), { bold: true })
  d.spacer(8)
  d.amountRow('Net assets', usd(NET_ASSETS), { bold: true })
  d.keyValue('Units outstanding', UNITS.toLocaleString('en-US'))
  d.keyValue('Net asset value per unit', usd2(NAV_PER_UNIT))

  d._newPage()
  d.heading('Statement of Operations', { size: 15 })
  d.paragraph(`For the Year Ended ${FYE}`, { size: 9, gapAfter: 8, leading: 12 })
  d.subheading('Investment income')
  d.amountRow('Interest and dividend income', usd(INV_INCOME), { indent: 12 })
  d.subheading('Expenses')
  d.amountRow('Management fee', usd(MGMT_FEE), { indent: 12 })
  d.amountRow('Incentive fee', usd(INCENTIVE_FEE), { indent: 12 })
  d.amountRow('Other operating expenses', usd(OTHER_EXPENSES), { indent: 12 })
  d.rule()
  d.amountRow('Total expenses', usd(TOTAL_EXPENSES), { bold: true })
  d.amountRow('Net investment loss', usd(NET_INV_LOSS), { bold: true })
  d.spacer(8)
  d.subheading('Realized and unrealized results')
  d.amountRow('Net realized gain on investments and derivatives', usd(REALIZED_GAIN), { indent: 12 })
  d.amountRow('Net change in unrealized depreciation', usd(UNREALIZED_DEP), { indent: 12 })
  d.rule()
  d.amountRow('Net decrease in net assets from operations', usd(OPS), { bold: true })

  d._newPage()
  d.heading('Statement of Changes in Net Assets', { size: 15 })
  d.paragraph(`For the Year Ended ${FYE}`, { size: 9, gapAfter: 8, leading: 12 })
  d.amountRow('Net assets, beginning of year', usd(BEGIN_NET_ASSETS))
  d.amountRow('Net decrease from operations', usd(OPS), { indent: 12 })
  d.amountRow('Capital subscriptions', usd(SUBSCRIPTIONS), { indent: 12 })
  d.amountRow('Capital redemptions', usd(REDEMPTIONS), { indent: 12 })
  d.rule()
  d.amountRow('Net assets, end of year', usd(NET_ASSETS), { bold: true })

  d._newPage()
  d.heading('Condensed Schedule of Investments', { size: 15 })
  d.paragraph(`As of ${FYE} — by strategy, net long exposure`, { size: 9, gapAfter: 8, leading: 12 })
  d.amountRow('Strategy / Fair Value Level', 'Fair Value', { bold: true })
  d.rule()
  for (const [name, level, fv] of STRATEGY_BOOK) {
    d.amountRow(name, usd(fv))
    d.paragraph(level, { size: 8, indent: 12, leading: 11, gapAfter: 3 })
  }
  d.rule()
  d.amountRow('Total investments in securities, at fair value', usd(INVESTMENTS_LONG), { bold: true })

  d._newPage()
  d.heading('Notes and Financial Highlights', { size: 15 })
  d.subheading('Note 1 — Organization')
  d.paragraph(
    `${FUND} is a Delaware limited partnership and an open-end investment company trading a discretionary ` +
    `global macro strategy across rates, currencies, equity indices, and commodities. ${IM} serves as ` +
    'investment manager.'
  )
  d.subheading('Note 2 — Management and Incentive Fees')
  d.paragraph(
    'The investment manager receives a management fee of 2.0% per annum of net asset value, accrued monthly. ' +
    'The investment manager is also entitled to an incentive fee of 20% of net new profits, subject to a ' +
    'perpetual high water mark. The high water mark per unit at the start of the year was ' + usd2(HIGH_WATER_MARK) + '.'
  )
  d.subheading('Note 3 — Financial Highlights (per unit)')
  d.keyValue('Net asset value per unit, end of year', usd2(NAV_PER_UNIT))
  d.keyValue('High water mark per unit', usd2(HIGH_WATER_MARK))
  d.keyValue('Total return', '(6.8%)')
  d.keyValue('Ratio of expenses to average net assets (ex-incentive)', '2.4%')
  d.keyValue('Ratio of incentive fee to average net assets', '1.1%')
  d.keyValue('Ratio of net investment loss to average net assets', '(1.6%)')
  d.subheading('Note 4 — Subsequent Events')
  d.paragraph(
    'The Fund has evaluated subsequent events through March 18, 2025. Quarterly redemptions of approximately ' +
    '$22.0 million were processed effective January 1, 2025. No other material subsequent events were identified.'
  )
  return d.toBuffer()
}

function offeringTerms() {
  const d = new PdfDoc()
  d.heading(FUND, { size: 16, gapAfter: 6 })
  d.paragraph('Confidential Offering Memorandum — Summary of Principal Terms', { font: 'bold', size: 12, gapAfter: 2, leading: 16 })
  d.paragraph('Confidential — For Qualified Investors Only', { size: 9, gapAfter: 12, leading: 12 })
  const term = (k, v) => d.keyValue(k, v, { size: 10, leading: 16 })
  d.subheading('Structure')
  term('Legal form', 'Delaware limited partnership (open-end)')
  term('Investment manager', IM)
  term('Strategy', 'Discretionary global macro')
  d.subheading('Fees')
  term('Management fee', '2.0% of NAV per annum, accrued monthly')
  term('Incentive fee', '20% of net new profits')
  term('High water mark', 'Yes — perpetual')
  term('Hurdle rate', 'None')
  d.subheading('Liquidity')
  term('Subscriptions', 'Monthly')
  term('Redemptions', 'Quarterly, 90 days’ written notice')
  term('Lock-up', '12 months (3% early redemption fee thereafter)')
  term('Gate', '25% of NAV per quarter')
  term('Side pockets', 'Permitted up to 15% of NAV')
  d.spacer(10)
  d.paragraph(
    'The incentive fee is calculated and crystallized annually and is subject to a perpetual high water ' +
    'mark; no incentive fee is payable with respect to a unit unless and until its net asset value exceeds ' +
    'the highest net asset value per unit on which an incentive fee was previously paid.',
    { size: 9, leading: 12 }
  )
  return d.toBuffer()
}

export default {
  slug: 'hadrian-global-macro',
  name: 'Hadrian Global Macro Fund — Annual Review 2024',
  fundType: 'HF',
  seeded:
    'An incentive fee of $5,400,000 (1.1% of average net assets) was accrued, but NAV per unit ended at ' +
    '$94.20 — below the $100.00 perpetual high water mark. No incentive fee should accrue below the high ' +
    'water mark.',
  build() {
    return [
      ['01-audited-financial-statements.pdf', auditedFinancials()],
      ['02-offering-memorandum-terms.pdf', offeringTerms()],
    ]
  },
}
