// Synthetic PE buyout engagement — Meridian Growth Partners III, L.P.
// All entities, people, and figures are fictional.

import { PdfDoc } from '../lib/pdf.mjs'
import { usd } from '../lib/format.mjs'

const FUND = 'Meridian Growth Partners III, L.P.'
const GP = 'Meridian Growth Advisors III, LLC'
const AUDITOR = 'Sterling & Voss LLP'
const ADMIN = 'Harborline Fund Services, LLC'
const FYE = 'December 31, 2024'

const COMMITMENTS = 500_000_000
const PAID_IN = 375_000_000
const UNCALLED = COMMITMENTS - PAID_IN
const INVESTMENTS_FV_BALANCE = 550_000_000
const CASH = 18_400_000
const OTHER_ASSETS = 4_200_000
const ACCRUED_LIABS = 6_100_000
const NAV = INVESTMENTS_FV_BALANCE + CASH + OTHER_ASSETS - ACCRUED_LIABS  // 566,500,000

// Schedule of Investments total FV is INTENTIONALLY ~$1.6M below the balance
// sheet figure (seeded discrepancy).
const PORTFOLIO = [
  ['Cedarline Logistics Holdings', 'Transportation & Logistics', 72_000_000, 118_400_000],
  ['Northwind Specialty Chemicals', 'Industrials', 65_000_000, 96_500_000],
  ['Brightpath Health Systems', 'Healthcare Services', 58_000_000, 89_200_000],
  ['Atlas Precision Components', 'Manufacturing', 49_000_000, 71_000_000],
  ['Veritas Software Group', 'Enterprise Software', 41_000_000, 78_900_000],
  ['Greenfield AgriProcessing', 'Food & Agriculture', 38_000_000, 44_200_000],
  ['Summit Industrial Services', 'Industrials', 33_000_000, 37_800_000],
  ['Lakeshore Retail Brands', 'Consumer', 30_000_000, 12_400_000],
]
const SOI_COST = PORTFOLIO.reduce((s, p) => s + p[2], 0)   // 386,000,000
const SOI_FV = PORTFOLIO.reduce((s, p) => s + p[3], 0)     // 548,400,000

function auditedFinancials() {
  const d = new PdfDoc()
  d.spacer(120)
  d.heading(FUND, { size: 22, gapAfter: 14 })
  d.paragraph('Financial Statements', { size: 14, font: 'bold', gapAfter: 2, leading: 18 })
  d.paragraph(`For the Year Ended ${FYE}`, { size: 12, gapAfter: 2, leading: 16 })
  d.paragraph('(With Report of Independent Auditors Thereon)', { size: 10, gapAfter: 40, leading: 14 })
  d.paragraph(`Auditor: ${AUDITOR}`, { size: 10, leading: 14, gapAfter: 2 })
  d.paragraph(`Administrator: ${ADMIN}`, { size: 10, leading: 14, gapAfter: 2 })
  d.paragraph('Functional Currency: U.S. Dollars (USD)', { size: 10, leading: 14 })

  d._newPage()
  d.heading('Report of Independent Auditors', { size: 15 })
  d.paragraph(`To the Partners of ${FUND}:`, { gapAfter: 8 })
  d.paragraph(
    `We have audited the accompanying financial statements of ${FUND} (the "Fund"), which comprise the ` +
    `statement of assets and liabilities, including the schedule of investments, as of ${FYE}, and the ` +
    `related statements of operations and changes in partners' capital for the year then ended, and the ` +
    `related notes to the financial statements.`
  )
  d.paragraph(
    'In our opinion, the financial statements present fairly, in all material respects, the financial ' +
    `position of the Fund as of ${FYE}, and the results of its operations and changes in its partners' ` +
    'capital for the year then ended in accordance with accounting principles generally accepted in the ' +
    'United States of America (U.S. GAAP), including ASC 946, Financial Services — Investment Companies.'
  )
  d.spacer(10)
  d.paragraph(`${AUDITOR}`, { font: 'bold', gapAfter: 2, leading: 13 })
  d.paragraph('Boston, Massachusetts — March 28, 2025', { size: 9, leading: 12 })

  d._newPage()
  d.heading('Statement of Assets and Liabilities', { size: 15 })
  d.paragraph(`As of ${FYE}`, { size: 9, gapAfter: 8, leading: 12 })
  d.subheading('Assets')
  d.amountRow(`Investments, at fair value (cost ${usd(SOI_COST)})`, usd(INVESTMENTS_FV_BALANCE), { indent: 12 })
  d.amountRow('Cash and cash equivalents', usd(CASH), { indent: 12 })
  d.amountRow('Other assets', usd(OTHER_ASSETS), { indent: 12 })
  d.rule()
  d.amountRow('Total assets', usd(INVESTMENTS_FV_BALANCE + CASH + OTHER_ASSETS), { bold: true })
  d.spacer(8)
  d.subheading('Liabilities')
  d.amountRow('Accrued expenses and other liabilities', usd(ACCRUED_LIABS), { indent: 12 })
  d.rule()
  d.amountRow('Total liabilities', usd(ACCRUED_LIABS), { bold: true })
  d.spacer(8)
  d.amountRow("Total partners' capital (net assets)", usd(NAV), { bold: true })

  d._newPage()
  d.heading('Statement of Operations', { size: 15 })
  d.paragraph(`For the Year Ended ${FYE}`, { size: 9, gapAfter: 8, leading: 12 })
  d.subheading('Investment income')
  d.amountRow('Interest and dividend income', usd(3_900_000), { indent: 12 })
  d.subheading('Expenses')
  d.amountRow('Management fees', usd(10_000_000), { indent: 12 })
  d.amountRow('Professional fees and other', usd(2_350_000), { indent: 12 })
  d.rule()
  d.amountRow('Total expenses', usd(12_350_000), { bold: true })
  d.amountRow('Net investment loss', usd(-8_450_000), { bold: true })
  d.spacer(8)
  d.subheading('Realized and unrealized gains')
  d.amountRow('Net realized gain on investments', usd(22_600_000), { indent: 12 })
  d.amountRow('Net change in unrealized appreciation', usd(64_900_000), { indent: 12 })
  d.rule()
  d.amountRow('Net increase in net assets from operations', usd(79_050_000), { bold: true })

  d._newPage()
  d.heading("Statement of Changes in Partners' Capital", { size: 15 })
  d.paragraph(`For the Year Ended ${FYE}`, { size: 9, gapAfter: 8, leading: 12 })
  d.amountRow("Partners' capital, beginning of year", usd(502_450_000))
  d.amountRow('Capital contributions', usd(125_000_000), { indent: 12 })
  d.amountRow('Distributions', usd(-140_000_000), { indent: 12 })
  d.amountRow('Net increase from operations', usd(79_050_000), { indent: 12 })
  d.rule()
  d.amountRow("Partners' capital, end of year", usd(NAV), { bold: true })

  d._newPage()
  d.heading('Schedule of Investments', { size: 15 })
  d.paragraph(`As of ${FYE} — all investments are Level 3 in the fair value hierarchy`, { size: 9, gapAfter: 8, leading: 12 })
  d.amountRow('Portfolio Company / Industry', 'Fair Value', { bold: true })
  d.rule()
  for (const [name, industry, cost, fv] of PORTFOLIO) {
    d.amountRow(name, usd(fv))
    d.paragraph(`${industry} — cost ${usd(cost)}`, { size: 8, indent: 12, leading: 11, gapAfter: 3 })
  }
  d.rule()
  d.amountRow('Total investments, at fair value', usd(SOI_FV), { bold: true })
  d.amountRow('Total cost', usd(SOI_COST), { size: 9 })

  d._newPage()
  d.heading('Notes to the Financial Statements', { size: 15 })
  d.subheading('Note 1 — Organization')
  d.paragraph(
    `${FUND} is a Delaware limited partnership formed in 2021 to make control-oriented private equity ` +
    `investments in middle-market companies. The general partner is ${GP}. The Fund has total capital ` +
    `commitments of ${usd(COMMITMENTS)}, of which ${usd(PAID_IN)} had been called as of ${FYE}, leaving ` +
    `${usd(UNCALLED)} of uncalled commitments. The Fund's term is ten years from the final closing, ` +
    'subject to two one-year extensions at the discretion of the general partner.'
  )
  d.subheading('Note 2 — Summary of Significant Accounting Policies')
  d.paragraph(
    'The Fund is an investment company and follows the accounting and reporting guidance in ASC 946. ' +
    'Investments are carried at fair value, with realized and unrealized gains and losses recognized in ' +
    'the statement of operations. The Fund does not consolidate its portfolio company investments.'
  )
  d.subheading('Note 3 — Fair Value Measurements (ASC 820)')
  d.paragraph(
    'Fair value is measured under the three-level hierarchy of ASC 820. As of ' + FYE + ', all portfolio ' +
    'investments are classified as Level 3, valued using a combination of comparable company multiples and ' +
    'discounted cash flow analyses. Unobservable inputs include EBITDA multiples ranging from 7.5x to 12.0x ' +
    'and discount rates ranging from 12% to 16%.'
  )
  d.subheading('Note 4 — Related Party Transactions')
  d.paragraph(
    'The general partner is entitled to a management fee equal to 2.0% per annum of aggregate capital ' +
    'commitments during the investment period. Management fees for the year totaled ' + usd(10_000_000) + '. ' +
    'The general partner is also entitled to carried interest of 20% of profits, subject to an 8% preferred ' +
    'return to the limited partners and a full general partner catch-up, calculated on a whole-fund ' +
    '(European) basis. The general partner has committed 2.0% of total commitments alongside the limited partners.'
  )
  d.subheading('Note 5 — Financial Highlights')
  d.keyValue('Total return, net of fees and carried interest', '14.2%')
  d.keyValue('Ratio of net investment loss to average net assets', '(1.6%)')
  d.keyValue('Ratio of total expenses to average net assets', '2.3%')
  d.subheading('Note 6 — Subsequent Events')
  d.paragraph(
    'The Fund has evaluated subsequent events through March 28, 2025. In February 2025, the Fund completed ' +
    'the sale of its investment in Summit Industrial Services, generating gross proceeds of approximately ' +
    '$41.0 million. No other material subsequent events were identified.'
  )
  return d.toBuffer()
}

function capitalAccountStatement() {
  const d = new PdfDoc()
  const LP = 'Evergreen State Teachers’ Retirement System'
  const PCT = 0.05
  d.heading(FUND, { size: 16, gapAfter: 6 })
  d.paragraph('Limited Partner Capital Account Statement', { font: 'bold', size: 12, gapAfter: 2, leading: 16 })
  d.paragraph(`As of ${FYE}`, { size: 10, gapAfter: 10, leading: 13 })
  d.keyValue('Limited Partner', LP)
  d.keyValue('Capital Commitment', usd(COMMITMENTS * PCT))
  d.keyValue('Ownership Percentage', '5.00%')
  d.spacer(8)
  d.subheading('Capital Account Activity — Year Ended ' + FYE)
  d.amountRow('Beginning capital account balance', usd(502_450_000 * PCT))
  d.amountRow('Capital contributions', usd(125_000_000 * PCT), { indent: 12 })
  d.amountRow('Distributions', usd(-140_000_000 * PCT), { indent: 12 })
  d.amountRow('Allocated net income', usd(79_050_000 * PCT), { indent: 12 })
  d.rule()
  d.amountRow('Ending capital account balance', usd(NAV * PCT), { bold: true })
  d.spacer(10)
  d.subheading('Commitment Summary')
  d.amountRow('Total commitment', usd(COMMITMENTS * PCT))
  d.amountRow('Cumulative contributions (paid-in)', usd(PAID_IN * PCT))
  d.amountRow('Remaining unfunded commitment', usd(UNCALLED * PCT), { bold: true })
  d.spacer(10)
  d.paragraph(
    'This statement is prepared by ' + ADMIN + ' on a U.S. GAAP basis consistent with the audited ' +
    'financial statements of the Fund. Percentages are rounded for presentation.',
    { size: 8, leading: 11 }
  )
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
  term('Vintage year', '2021')
  term('Total commitments', usd(COMMITMENTS))
  term('General partner commitment', '2.0% of commitments')
  d.subheading('Term and Investment Period')
  term('Fund term', '10 years + two 1-year extensions')
  term('Investment period', '5 years from final closing')
  d.subheading('Economics')
  term('Management fee (investment period)', '2.0% of committed capital')
  term('Management fee (post-investment period)', '1.5% of invested capital')
  term('Carried interest', '20%')
  term('Preferred return (hurdle)', '8%')
  term('GP catch-up', '100%')
  term('Distribution waterfall', 'Whole-fund (European)')
  term('Clawback', 'Present — full GP clawback, net of taxes')
  d.subheading('Governance')
  term('Key person provision', 'Present — 2 named principals')
  term('LP advisory committee', 'Present')
  term('No-fault GP removal', 'Two-thirds in interest')
  d.spacer(10)
  d.paragraph(
    'Key persons: Dana R. Whitfield and Marcus Allred. A key person event suspends the investment period ' +
    'until a replacement is approved by the LP advisory committee or two-thirds in interest of the limited partners.',
    { size: 9, leading: 12 }
  )
  return d.toBuffer()
}

export default {
  slug: 'meridian-growth-iii',
  name: 'Meridian Growth Partners III — Annual Review 2024',
  fundType: 'PE',
  seeded:
    'Schedule of Investments total fair value ($548,400,000) does not reconcile to "Investments, at fair ' +
    'value" on the Statement of Assets and Liabilities ($550,000,000) — a $1,600,000 unexplained difference.',
  build() {
    return [
      ['01-audited-financial-statements.pdf', auditedFinancials()],
      ['02-capital-account-statement.pdf', capitalAccountStatement()],
      ['03-lpa-key-terms.pdf', lpaKeyTerms()],
    ]
  },
}
