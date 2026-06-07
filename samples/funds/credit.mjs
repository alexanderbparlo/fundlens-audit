// Synthetic private credit engagement — Ironwood Direct Lending Fund III, L.P.
// All entities, people, and figures are fictional.
//
// Seeded discrepancy: Note 5 discloses a $4,200,000 allowance for credit losses
// (CECL, ASC 326), but the Statement of Assets and Liabilities presents loans
// at $238,200,000 labeled "net of allowance" while that figure equals gross
// amortized cost — the allowance is not deducted on the face and no provision
// appears in the Statement of Operations. Loans should be $234,000,000.

import { PdfDoc } from '../lib/pdf.mjs'
import { usd } from '../lib/format.mjs'

const FUND = 'Ironwood Direct Lending Fund III, L.P.'
const GP = 'Ironwood Credit Advisors III, LLC'
const AUDITOR = 'Halstead & Quill LLP'
const ADMIN = 'Beacon Credit Administration, LLC'
const FYE = 'December 31, 2024'

const COMMITMENTS = 400_000_000
const PAID_IN = 300_000_000
const UNCALLED = COMMITMENTS - PAID_IN

// Schedule of loans (borrower, sector, par, amortized cost, spread, status)
const LOANS = [
  ['Brookfield Equipment Rental', 'Industrials', 60_000_000, 59_200_000, 'SOFR + 650', 'Performing'],
  ['Coastal Senior Living', 'Healthcare', 48_000_000, 47_400_000, 'SOFR + 700', 'Performing'],
  ['Apex Packaging', 'Industrials', 42_000_000, 41_500_000, 'SOFR + 625', 'Performing'],
  ['Riverton Software', 'Software', 38_000_000, 37_600_000, 'SOFR + 600 (+2% PIK)', 'Performing'],
  ['Glenmore Foods', 'Consumer', 30_000_000, 29_700_000, 'SOFR + 675', 'Performing'],
  ['Hartwell Auto Parts', 'Industrials', 24_000_000, 22_800_000, 'SOFR + 725', 'Non-accrual'],
]
const TOTAL_PAR = LOANS.reduce((s, l) => s + l[2], 0)       // 242,000,000
const TOTAL_AC = LOANS.reduce((s, l) => s + l[3], 0)        // 238,200,000
const CECL_ALLOWANCE = 4_200_000
const LOANS_NET_CORRECT = TOTAL_AC - CECL_ALLOWANCE         // 234,000,000 (correct)
const LOANS_ON_FACE = TOTAL_AC                              // 238,200,000 (seeded — allowance not deducted)

const CASH = 14_500_000
const INTEREST_RECV = 3_800_000
const TOTAL_ASSETS = LOANS_ON_FACE + CASH + INTEREST_RECV  // 256,500,000
const SUBSCRIPTION_FACILITY = 35_000_000
const ACCRUED_LIABS = 2_500_000
const TOTAL_LIABS = SUBSCRIPTION_FACILITY + ACCRUED_LIABS  // 37,500,000
const NAV = TOTAL_ASSETS - TOTAL_LIABS                     // 219,000,000

const INTEREST_INCOME = 21_400_000
const OTHER_FEE_INCOME = 1_600_000
const TOTAL_INCOME = INTEREST_INCOME + OTHER_FEE_INCOME    // 23,000,000
const MGMT_FEE = 3_600_000
const INTEREST_EXPENSE = 1_900_000
const PROF_FEES = 1_300_000
const TOTAL_EXPENSES = MGMT_FEE + INTEREST_EXPENSE + PROF_FEES   // 6,800,000
const NET_INV_INCOME = TOTAL_INCOME - TOTAL_EXPENSES            // 16,200,000
const REALIZED_LOSS = -600_000
const OPS = NET_INV_INCOME + REALIZED_LOSS                     // 15,600,000

const CONTRIBUTIONS = 50_000_000
const DISTRIBUTIONS = -18_000_000
const BEGIN_CAP = NAV - CONTRIBUTIONS - DISTRIBUTIONS - OPS    // 171,400,000

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
    'financial position of the Fund in accordance with U.S. GAAP, including ASC 946. Loans held for ' +
    'investment are measured at amortized cost net of an allowance for credit losses under ASC 326.'
  )
  d.spacer(8)
  d.paragraph(`${AUDITOR}`, { font: 'bold', gapAfter: 2, leading: 13 })
  d.paragraph('Chicago, Illinois — March 25, 2025', { size: 9, leading: 12 })

  d._newPage()
  d.heading('Statement of Assets and Liabilities', { size: 15 })
  d.paragraph(`As of ${FYE}`, { size: 9, gapAfter: 8, leading: 12 })
  d.subheading('Assets')
  d.amountRow('Loans, at amortized cost, net of allowance for credit losses', usd(LOANS_ON_FACE), { indent: 12 })
  d.amountRow('Cash and cash equivalents', usd(CASH), { indent: 12 })
  d.amountRow('Interest receivable', usd(INTEREST_RECV), { indent: 12 })
  d.rule()
  d.amountRow('Total assets', usd(TOTAL_ASSETS), { bold: true })
  d.spacer(8)
  d.subheading('Liabilities')
  d.amountRow('Subscription credit facility', usd(SUBSCRIPTION_FACILITY), { indent: 12 })
  d.amountRow('Accrued expenses and other liabilities', usd(ACCRUED_LIABS), { indent: 12 })
  d.rule()
  d.amountRow('Total liabilities', usd(TOTAL_LIABS), { bold: true })
  d.spacer(8)
  d.amountRow("Total partners' capital (net assets)", usd(NAV), { bold: true })

  d._newPage()
  d.heading('Statement of Operations', { size: 15 })
  d.paragraph(`For the Year Ended ${FYE}`, { size: 9, gapAfter: 8, leading: 12 })
  d.subheading('Investment income')
  d.amountRow('Interest income (including PIK)', usd(INTEREST_INCOME), { indent: 12 })
  d.amountRow('Other fee income (OID accretion and amendment fees)', usd(OTHER_FEE_INCOME), { indent: 12 })
  d.rule()
  d.amountRow('Total investment income', usd(TOTAL_INCOME), { bold: true })
  d.subheading('Expenses')
  d.amountRow('Management fee', usd(MGMT_FEE), { indent: 12 })
  d.amountRow('Interest expense (subscription facility)', usd(INTEREST_EXPENSE), { indent: 12 })
  d.amountRow('Professional fees and other', usd(PROF_FEES), { indent: 12 })
  d.rule()
  d.amountRow('Total expenses', usd(TOTAL_EXPENSES), { bold: true })
  d.amountRow('Net investment income', usd(NET_INV_INCOME), { bold: true })
  d.spacer(6)
  d.amountRow('Net realized loss on loans', usd(REALIZED_LOSS), { indent: 12 })
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
  d.heading('Schedule of Investments (Loans)', { size: 15 })
  d.paragraph(`As of ${FYE} — senior secured loans, Level 3 in the fair value hierarchy`, { size: 9, gapAfter: 8, leading: 12 })
  d.amountRow('Borrower / Sector', 'Amortized Cost', { bold: true })
  d.rule()
  for (const [name, sector, par, ac, spread, status] of LOANS) {
    d.amountRow(name, usd(ac))
    d.paragraph(`${sector} — par ${usd(par)} · ${spread} · ${status}`, { size: 8, indent: 12, leading: 11, gapAfter: 3 })
  }
  d.rule()
  d.amountRow('Total par value', usd(TOTAL_PAR), { size: 9 })
  d.amountRow('Total amortized cost', usd(TOTAL_AC), { bold: true })

  d._newPage()
  d.heading('Notes to the Financial Statements', { size: 15 })
  d.subheading('Note 1 — Organization')
  d.paragraph(
    `${FUND} is a Delaware limited partnership formed to originate senior secured loans to U.S. middle-market ` +
    `borrowers. The general partner is ${GP}. Total commitments are ${usd(COMMITMENTS)}, of which ` +
    `${usd(PAID_IN)} had been called as of ${FYE}, leaving ${usd(UNCALLED)} uncalled.`
  )
  d.subheading('Note 2 — Significant Accounting Policies')
  d.paragraph(
    'The Fund follows ASC 946. Loans held for investment are carried at amortized cost, net of an allowance ' +
    'for credit losses determined under ASC 326 (CECL). Original issue discount and amendment fees are ' +
    'accreted into income over the life of each loan using the effective interest method.'
  )
  d.subheading('Note 3 — Subscription Credit Facility')
  d.paragraph(
    'The Fund maintains a $75,000,000 subscription credit facility secured by uncalled capital commitments. ' +
    `As of ${FYE}, ${usd(SUBSCRIPTION_FACILITY)} was drawn. The facility bears interest at SOFR plus 2.25%.`
  )
  d.subheading('Note 4 — Non-Accrual Loans')
  d.paragraph(
    'As of ' + FYE + ', the loan to Hartwell Auto Parts (amortized cost ' + usd(22_800_000) + ') was placed ' +
    'on non-accrual status. The Fund does not recognize interest income on non-accrual loans.'
  )
  d.subheading('Note 5 — Allowance for Credit Losses (ASC 326)')
  d.paragraph(
    'The Fund recorded an allowance for credit losses of ' + usd(CECL_ALLOWANCE) + ' as of ' + FYE + ', ' +
    'reflecting lifetime expected losses on the loan portfolio, concentrated in the non-accrual position. ' +
    'The allowance is presented as a reduction of the carrying amount of loans held for investment.'
  )
  d.subheading('Note 6 — Subsequent Events')
  d.paragraph(
    'The Fund has evaluated subsequent events through March 25, 2025. In February 2025, the Fund funded a ' +
    'new $20,000,000 senior secured loan. No other material subsequent events were identified.'
  )
  return d.toBuffer()
}

function capitalAccountStatement() {
  const d = new PdfDoc()
  const LP = 'Cascade Public Employees’ Pension Fund'
  const PCT = 0.06
  d.heading(FUND, { size: 16, gapAfter: 6 })
  d.paragraph('Limited Partner Capital Account Statement', { font: 'bold', size: 12, gapAfter: 2, leading: 16 })
  d.paragraph(`As of ${FYE}`, { size: 10, gapAfter: 10, leading: 13 })
  d.keyValue('Limited Partner', LP)
  d.keyValue('Capital Commitment', usd(COMMITMENTS * PCT))
  d.keyValue('Ownership Percentage', '6.00%')
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
  term('Vintage year', '2022')
  term('Total commitments', usd(COMMITMENTS))
  term('Strategy', 'Senior secured direct lending')
  d.subheading('Term and Investment Period')
  term('Fund term', '7 years + two 1-year extensions')
  term('Investment / reinvestment period', '3 years')
  d.subheading('Economics')
  term('Management fee', '1.5% of invested capital')
  term('Carried interest', '15%')
  term('Preferred return (hurdle)', '7%')
  term('Distribution waterfall', 'Whole-fund (European)')
  term('Leverage limit', '1.0x debt-to-equity')
  d.subheading('Facilities & Reporting')
  term('Subscription facility', 'Up to $75,000,000')
  term('Borrowing base reporting', 'Quarterly certificate')
  d.spacer(10)
  d.paragraph(
    'The general partner may incur fund-level leverage up to a 1.0x debt-to-equity ratio, inclusive of the ' +
    'subscription credit facility, measured at each quarter end.',
    { size: 9, leading: 12 }
  )
  return d.toBuffer()
}

export default {
  slug: 'ironwood-direct-lending-iii',
  name: 'Ironwood Direct Lending Fund III — Annual Review 2024',
  fundType: 'Credit',
  seeded:
    'Note 5 discloses a $4,200,000 ASC 326 allowance for credit losses "presented as a reduction of the ' +
    'carrying amount of loans," but the Statement of Assets and Liabilities reports loans of $238,200,000 ' +
    '(equal to gross amortized cost) with no allowance deducted and no provision in the Statement of ' +
    'Operations. Loans should be $234,000,000.',
  build() {
    return [
      ['01-audited-financial-statements.pdf', auditedFinancials()],
      ['02-capital-account-statement.pdf', capitalAccountStatement()],
      ['03-lpa-key-terms.pdf', lpaKeyTerms()],
    ]
  },
}
