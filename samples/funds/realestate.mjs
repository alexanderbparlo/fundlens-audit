// Synthetic real estate engagement — Cornerstone Real Assets Fund II, L.P.
// All entities, people, and figures are fictional.
//
// Seeded discrepancy: Harbor Point Logistics Center is carried at $92,000,000
// in the Schedule of Investments, but Note 4 discloses a December 2024
// independent appraisal of $84,000,000. The $8,000,000 difference was not
// reflected in the carrying value (no markdown recognized).

import { PdfDoc } from '../lib/pdf.mjs'
import { usd, pct } from '../lib/format.mjs'

const FUND = 'Cornerstone Real Assets Fund II, L.P.'
const GP = 'Cornerstone Real Assets GP II, LLC'
const AUDITOR = 'Whitmore & Banks LLP'
const ADMIN = 'Summit Real Estate Administration, LLC'
const FYE = 'December 31, 2024'

const COMMITMENTS = 350_000_000
const PAID_IN = 263_000_000
const UNCALLED = COMMITMENTS - PAID_IN

// Schedule of properties (name, type, cost, fair value, cap rate, NOI)
const PROPERTIES = [
  ['Maple Court Apartments', 'Multifamily', 60_000_000, 78_000_000, 0.050, 3_900_000],
  ['Harbor Point Logistics Center', 'Industrial', 55_000_000, 92_000_000, 0.055, 5_060_000],
  ['Riverside Office Plaza', 'Office', 48_000_000, 41_000_000, 0.080, 3_280_000],
  ['Sunbelt Retail Portfolio', 'Retail', 42_000_000, 49_000_000, 0.065, 3_185_000],
  ['Cedar Ridge Self-Storage', 'Self-Storage', 28_000_000, 38_000_000, 0.0575, 2_185_000],
]
const TOTAL_COST = PROPERTIES.reduce((s, p) => s + p[2], 0)   // 233,000,000
const TOTAL_FV = PROPERTIES.reduce((s, p) => s + p[3], 0)     // 298,000,000
const TOTAL_NOI = PROPERTIES.reduce((s, p) => s + p[5], 0)    // 17,610,000
const HARBOR_APPRAISAL = 84_000_000                           // seeded — vs $92,000,000 carried

const CASH = 16_000_000
const OTHER_ASSETS = 5_500_000
const TOTAL_ASSETS = TOTAL_FV + CASH + OTHER_ASSETS           // 319,500,000
const MORTGAGES = 130_000_000
const ACCRUED_LIABS = 4_500_000
const TOTAL_LIABS = MORTGAGES + ACCRUED_LIABS                 // 134,500,000
const NAV = TOTAL_ASSETS - TOTAL_LIABS                        // 185,000,000
const LTV = MORTGAGES / TOTAL_FV                              // 0.436

const RENTAL_INCOME = 27_000_000
const PROPERTY_OPEX = 9_390_000
const INTEREST_EXPENSE = 6_200_000
const MGMT_FEE = 3_200_000
const OTHER_FUND_EXP = 1_400_000
const TOTAL_EXPENSES = PROPERTY_OPEX + INTEREST_EXPENSE + MGMT_FEE + OTHER_FUND_EXP   // 20,190,000
const NET_INV_INCOME = RENTAL_INCOME - TOTAL_EXPENSES         // 6,810,000
const UNREALIZED = 19_000_000
const OPS = NET_INV_INCOME + UNREALIZED                       // 25,810,000

const CONTRIBUTIONS = 30_000_000
const DISTRIBUTIONS = -12_000_000
const BEGIN_CAP = NAV - CONTRIBUTIONS - DISTRIBUTIONS - OPS   // 141,190,000

function auditedFinancials() {
  const d = new PdfDoc()
  d.spacer(110)
  d.heading(FUND, { size: 21, gapAfter: 14 })
  d.paragraph('Financial Statements', { size: 14, font: 'bold', gapAfter: 2, leading: 18 })
  d.paragraph(`For the Year Ended ${FYE}`, { size: 12, gapAfter: 30, leading: 16 })
  d.paragraph(`Auditor: ${AUDITOR}   ·   Administrator: ${ADMIN}`, { size: 10, leading: 14, gapAfter: 2 })
  d.paragraph('Functional Currency: U.S. Dollars (USD)', { size: 10, leading: 14 })

  d._newPage()
  d.heading('Report of Independent Auditors', { size: 15 })
  d.paragraph(`To the Partners of ${FUND}:`, { gapAfter: 8 })
  d.paragraph(
    `We have audited the accompanying financial statements of ${FUND} (the "Fund") as of and for the year ` +
    `ended ${FYE}. In our opinion, the financial statements present fairly, in all material respects, the ` +
    'financial position of the Fund in accordance with U.S. GAAP, including ASC 946. Real estate ' +
    'investments are measured at fair value under ASC 820.'
  )
  d.spacer(8)
  d.paragraph(`${AUDITOR}`, { font: 'bold', gapAfter: 2, leading: 13 })
  d.paragraph('Dallas, Texas — March 27, 2025', { size: 9, leading: 12 })

  d._newPage()
  d.heading('Statement of Assets and Liabilities', { size: 15 })
  d.paragraph(`As of ${FYE}`, { size: 9, gapAfter: 8, leading: 12 })
  d.subheading('Assets')
  d.amountRow(`Real estate investments, at fair value (cost ${usd(TOTAL_COST)})`, usd(TOTAL_FV), { indent: 12 })
  d.amountRow('Cash and cash equivalents', usd(CASH), { indent: 12 })
  d.amountRow('Tenant receivables and other assets', usd(OTHER_ASSETS), { indent: 12 })
  d.rule()
  d.amountRow('Total assets', usd(TOTAL_ASSETS), { bold: true })
  d.spacer(8)
  d.subheading('Liabilities')
  d.amountRow('Mortgage loans payable', usd(MORTGAGES), { indent: 12 })
  d.amountRow('Accrued expenses and other liabilities', usd(ACCRUED_LIABS), { indent: 12 })
  d.rule()
  d.amountRow('Total liabilities', usd(TOTAL_LIABS), { bold: true })
  d.spacer(8)
  d.amountRow("Total partners' capital (net assets)", usd(NAV), { bold: true })

  d._newPage()
  d.heading('Statement of Operations', { size: 15 })
  d.paragraph(`For the Year Ended ${FYE}`, { size: 9, gapAfter: 8, leading: 12 })
  d.subheading('Investment income')
  d.amountRow('Rental income', usd(RENTAL_INCOME), { indent: 12 })
  d.subheading('Expenses')
  d.amountRow('Property operating expenses', usd(PROPERTY_OPEX), { indent: 12 })
  d.amountRow('Interest expense (mortgages)', usd(INTEREST_EXPENSE), { indent: 12 })
  d.amountRow('Management fee', usd(MGMT_FEE), { indent: 12 })
  d.amountRow('Other fund expenses', usd(OTHER_FUND_EXP), { indent: 12 })
  d.rule()
  d.amountRow('Total expenses', usd(TOTAL_EXPENSES), { bold: true })
  d.amountRow('Net investment income', usd(NET_INV_INCOME), { bold: true })
  d.spacer(6)
  d.amountRow('Net change in unrealized appreciation on real estate', usd(UNREALIZED), { indent: 12 })
  d.rule()
  d.amountRow('Net increase in net assets from operations', usd(OPS), { bold: true })

  d._newPage()
  d.heading("Statement of Changes in Partners' Capital", { size: 15 })
  d.paragraph(`For the Year Ended ${FYE}`, { size: 9, gapAfter: 8, leading: 12 })
  d.amountRow("Partners' capital, beginning of year", usd(BEGIN_CAP))
  d.amountRow('Capital contributions', usd(CONTRIBUTIONS), { indent: 12 })
  d.amountRow('Distributions', usd(DISTRIBUTIONS), { indent: 12 })
  d.amountRow('Net increase from operations', usd(OPS), { indent: 12 })
  d.rule()
  d.amountRow("Partners' capital, end of year", usd(NAV), { bold: true })

  d._newPage()
  d.heading('Schedule of Investments (Properties)', { size: 15 })
  d.paragraph(`As of ${FYE} — all properties are Level 3 in the fair value hierarchy`, { size: 9, gapAfter: 8, leading: 12 })
  d.amountRow('Property / Type', 'Fair Value', { bold: true })
  d.rule()
  for (const [name, type, cost, fv, cap, noi] of PROPERTIES) {
    d.amountRow(name, usd(fv))
    d.paragraph(`${type} — cost ${usd(cost)} · cap rate ${pct(cap)} · NOI ${usd(noi)}`, { size: 8, indent: 12, leading: 11, gapAfter: 3 })
  }
  d.rule()
  d.amountRow('Total real estate investments, at fair value', usd(TOTAL_FV), { bold: true })
  d.amountRow('Total cost', usd(TOTAL_COST), { size: 9 })

  d._newPage()
  d.heading('Notes to the Financial Statements', { size: 15 })
  d.subheading('Note 1 — Organization')
  d.paragraph(
    `${FUND} is a Delaware limited partnership formed in 2021 to acquire and operate a diversified portfolio ` +
    `of U.S. commercial real estate. The general partner is ${GP}. Total commitments are ${usd(COMMITMENTS)}, ` +
    `of which ${usd(PAID_IN)} had been called as of ${FYE}, leaving ${usd(UNCALLED)} uncalled.`
  )
  d.subheading('Note 2 — Fair Value Measurements (ASC 820)')
  d.paragraph(
    'Real estate investments are classified as Level 3 and valued using the income capitalization and ' +
    'discounted cash flow approaches. Unobservable inputs include capitalization rates ranging from 5.0% to ' +
    '8.0% and discount rates ranging from 6.5% to 9.0%. Independent third-party appraisals are obtained ' +
    'annually for each property.'
  )
  d.subheading('Note 3 — Mortgage Loans Payable and Leverage')
  d.paragraph(
    'Property-level mortgage loans payable totaled ' + usd(MORTGAGES) + ' as of ' + FYE + ', representing a ' +
    'portfolio loan-to-value ratio of ' + pct(LTV) + ' against aggregate property fair value. The fund-level ' +
    'leverage limit under the partnership agreement is 60% loan-to-value.'
  )
  d.subheading('Note 4 — Recent Appraisals')
  d.paragraph(
    'In December 2024, the Fund obtained an updated independent appraisal of Harbor Point Logistics Center ' +
    'indicating a value of ' + usd(HARBOR_APPRAISAL) + ', reflecting softening industrial rents in the ' +
    'submarket. The remaining properties were appraised consistent with their carrying values.'
  )
  d.subheading('Note 5 — Financial Highlights')
  d.keyValue('Portfolio net operating income (NOI)', usd(TOTAL_NOI))
  d.keyValue('Weighted-average capitalization rate', '5.9%')
  d.keyValue('Portfolio loan-to-value', pct(LTV))
  d.keyValue('Total return, net of fees', '13.1%')
  d.subheading('Note 6 — Subsequent Events')
  d.paragraph(
    'The Fund has evaluated subsequent events through March 27, 2025. In January 2025, the Fund refinanced ' +
    'the mortgage on Sunbelt Retail Portfolio. No other material subsequent events were identified.'
  )
  return d.toBuffer()
}

function capitalAccountStatement() {
  const d = new PdfDoc()
  const LP = 'Birchwood Family Office, LLC'
  const PCT = 0.05
  d.heading(FUND, { size: 16, gapAfter: 6 })
  d.paragraph('Limited Partner Capital Account Statement', { font: 'bold', size: 12, gapAfter: 2, leading: 16 })
  d.paragraph(`As of ${FYE}`, { size: 10, gapAfter: 10, leading: 13 })
  d.keyValue('Limited Partner', LP)
  d.keyValue('Capital Commitment', usd(COMMITMENTS * PCT))
  d.keyValue('Ownership Percentage', '5.00%')
  d.spacer(8)
  d.subheading('Capital Account Activity — Year Ended ' + FYE)
  d.amountRow('Beginning capital account balance', usd(BEGIN_CAP * PCT))
  d.amountRow('Capital contributions', usd(CONTRIBUTIONS * PCT), { indent: 12 })
  d.amountRow('Distributions', usd(DISTRIBUTIONS * PCT), { indent: 12 })
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
  term('Vintage year', '2021')
  term('Total commitments', usd(COMMITMENTS))
  term('Strategy', 'Diversified U.S. commercial real estate')
  d.subheading('Term and Investment Period')
  term('Fund term', '10 years + two 1-year extensions')
  term('Investment period', '4 years from final closing')
  d.subheading('Economics')
  term('Management fee (investment period)', '1.5% of committed capital')
  term('Management fee (post-investment period)', '1.25% of invested capital')
  term('Carried interest', '20%')
  term('Preferred return (hurdle)', '8%')
  term('Distribution waterfall', 'Whole-fund (European)')
  d.subheading('Leverage')
  term('Fund-level leverage limit', '60% loan-to-value')
  term('Property-level debt', 'Permitted')
  d.spacer(10)
  d.paragraph(
    'Aggregate fund-level indebtedness, including property-level mortgages, may not exceed 60% of the ' +
    'aggregate fair value of the Fund’s real estate investments, measured at each quarter end.',
    { size: 9, leading: 12 }
  )
  return d.toBuffer()
}

export default {
  slug: 'cornerstone-real-assets-ii',
  name: 'Cornerstone Real Assets Fund II — Annual Review 2024',
  fundType: 'RealEstate',
  seeded:
    'Harbor Point Logistics Center is carried at $92,000,000 in the Schedule of Investments, but Note 4 ' +
    'discloses a December 2024 independent appraisal of $84,000,000. The $8,000,000 difference was not ' +
    'reflected in the carrying value (no markdown recognized).',
  build() {
    return [
      ['01-audited-financial-statements.pdf', auditedFinancials()],
      ['02-capital-account-statement.pdf', capitalAccountStatement()],
      ['03-lpa-key-terms.pdf', lpaKeyTerms()],
    ]
  },
}
