import * as XLSX from 'xlsx'
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CustomCategory,
  Expense,
  Category,
  Income,
  IncomeCategory,
  INCOME_CATEGORIES,
  INCOME_CATEGORY_LABELS,
  Trip,
  TripMutationInput,
  getCategoryLabel,
  getIncomeCategoryLabel,
} from '@/types'
import { format } from 'date-fns'
import { getTripFinancialSummary, parseTripInput } from '@/lib/trips'

export type ExcelImportIssue = {
  level: 'warning' | 'error'
  sheet: string
  row: number
  message: string
}

export type ExcelImportResult = {
  expenses: Expense[]
  incomes: Income[]
  trips: ExcelImportedTrip[]
  issues: ExcelImportIssue[]
  skippedRows: number
  duplicateRows: number
}

type ExcelRow = Record<string, unknown>

export type ExcelImportedTrip = {
  sourceId?: string
  data: TripMutationInput
}

export type ExcelSavingsAssetSnapshot = {
  type: string
  name: string
  symbol?: string
  baseAmount?: number
  quantity?: number
  unitPriceUsd?: number
  currentValue: number
  recurringMonthlyAmount?: number
  recurringStartDate?: string
  recurringContributionCount?: number
  recurringContributionValue?: number
  nextRecurringContributionDate?: string
  valueSource?: string
  quoteUpdatedAt?: string
}

export type ExcelSavingsSummary = {
  currency: string
  monthlySavings?: number
  savingsPlusAssets?: number
  totalAssetValue: number
  insuranceValue?: number
  cryptoValue?: number
  stocksValue?: number
  personalFundsValue?: number
  cryptoSocketState?: string
  assets?: ExcelSavingsAssetSnapshot[]
}

function normalizeHeaderKey(value: string): string {
  return value.trim().toLowerCase()
}

function normalizeTextValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function buildRowLookup(row: ExcelRow): Map<string, unknown> {
  return new Map(
    Object.entries(row).map(([key, value]) => [normalizeHeaderKey(key), value])
  )
}

function getRowValue(row: ExcelRow, aliases: string[]): unknown {
  const lookup = buildRowLookup(row)
  for (const alias of aliases) {
    const found = lookup.get(normalizeHeaderKey(alias))
    if (found !== undefined) {
      return found
    }
  }
  return undefined
}

function parseAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null

  const normalized = value.replace(/[^0-9.-]/g, '')
  if (!normalized) return null

  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseExcelDate(value: unknown): string | null {
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (!parsed || typeof parsed.y !== 'number') return null
    return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return format(value, 'yyyy-MM-dd')
  }

  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  return format(parsed, 'yyyy-MM-dd')
}

function isBlankRow(row: ExcelRow): boolean {
  return Object.values(row).every((value) => {
    if (value === null || value === undefined) return true
    if (typeof value === 'string') return value.trim().length === 0
    return false
  })
}

function normalizeExpenseCategory(raw: unknown): Category {
  const text = String(raw || '').trim()
  if (!text) return 'other'

  const lowered = text.toLowerCase()
  for (const category of CATEGORIES) {
    const english = CATEGORY_LABELS[category]?.en?.toLowerCase() || ''
    const myanmar = CATEGORY_LABELS[category]?.my?.toLowerCase() || ''

    if (lowered === category || lowered === english || lowered === myanmar) {
      return category
    }
  }

  return text
}

function normalizeIncomeCategory(raw: unknown): IncomeCategory {
  const text = String(raw || '').trim()
  if (!text) return 'other'

  const lowered = text.toLowerCase()
  for (const category of INCOME_CATEGORIES) {
    const english = INCOME_CATEGORY_LABELS[category]?.en?.toLowerCase() || ''
    const myanmar = INCOME_CATEGORY_LABELS[category]?.my?.toLowerCase() || ''

    if (lowered === category || lowered === english || lowered === myanmar) {
      return category
    }
  }

  return text
}

function buildFingerprint(
  date: string,
  amount: number,
  category: string,
  description: string,
  tripId?: string,
  sharedGroupExpense?: boolean
): string {
  return [
    date,
    amount.toFixed(4),
    category.trim().toLowerCase(),
    description.trim().toLowerCase(),
    (tripId || '').trim().toLowerCase(),
    sharedGroupExpense ? 'shared-group' : 'personal',
  ].join('|')
}

function parseBooleanFlag(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value !== 'string') return false

  const normalized = value.trim().toLowerCase()
  return ['true', 'yes', 'y', '1', 'shared', 'shared-group', 'group'].includes(normalized)
}

function parseExpenseRows(rows: ExcelRow[], issues: ExcelImportIssue[]): {
  items: Expense[]
  skippedRows: number
  duplicateRows: number
} {
  const items: Expense[] = []
  const seen = new Set<string>()
  let skippedRows = 0
  let duplicateRows = 0

  rows.forEach((row, index) => {
    const rowNumber = index + 2

    if (isBlankRow(row)) {
      skippedRows++
      return
    }

    const rawAmount = getRowValue(row, ['Amount', 'amount'])
    const rawDate = getRowValue(row, ['Date', 'date'])
    const rawCategory = getRowValue(row, ['Category Key', 'Category', 'category'])
    const rawDescription = getRowValue(row, ['Description', 'description'])
    const rawTripId = getRowValue(row, ['Trip ID', 'tripId', 'trip id'])
    const rawSharedGroupExpense = getRowValue(row, [
      'Shared Friend Group',
      'sharedGroupExpense',
      'shared group expense',
      'shared group',
      'trip expense scope',
    ])

    const amount = parseAmount(rawAmount)
    const date = parseExcelDate(rawDate)
    const category = normalizeExpenseCategory(rawCategory)
    const description = String(rawDescription || '').trim()
    const tripId = String(rawTripId || '').trim()
    const sharedGroupExpense = parseBooleanFlag(rawSharedGroupExpense)

    if (amount === null || amount <= 0) {
      skippedRows++
      issues.push({
        level: 'error',
        sheet: 'Expenses',
        row: rowNumber,
        message: 'Amount must be a number greater than 0',
      })
      return
    }

    if (!date) {
      skippedRows++
      issues.push({
        level: 'error',
        sheet: 'Expenses',
        row: rowNumber,
        message: 'Date is invalid or missing',
      })
      return
    }

    const fingerprint = buildFingerprint(date, amount, category, description, tripId, sharedGroupExpense)
    if (seen.has(fingerprint)) {
      duplicateRows++
      skippedRows++
      issues.push({
        level: 'warning',
        sheet: 'Expenses',
        row: rowNumber,
        message: 'Duplicate row in import file',
      })
      return
    }

    seen.add(fingerprint)
    items.push({
      id: crypto.randomUUID(),
      amount,
      category,
      description,
      date,
      tripId: tripId || undefined,
      sharedGroupExpense: tripId ? sharedGroupExpense : undefined,
      createdAt: new Date().toISOString(),
    })
  })

  return { items, skippedRows, duplicateRows }
}

function parseIncomeRows(rows: ExcelRow[], issues: ExcelImportIssue[]): {
  items: Income[]
  skippedRows: number
  duplicateRows: number
} {
  const items: Income[] = []
  const seen = new Set<string>()
  let skippedRows = 0
  let duplicateRows = 0

  rows.forEach((row, index) => {
    const rowNumber = index + 2

    if (isBlankRow(row)) {
      skippedRows++
      return
    }

    const rawAmount = getRowValue(row, ['Amount', 'amount'])
    const rawDate = getRowValue(row, ['Date', 'date'])
    const rawCategory = getRowValue(row, ['Category Key', 'Category', 'category'])
    const rawDescription = getRowValue(row, ['Description', 'description'])

    const amount = parseAmount(rawAmount)
    const date = parseExcelDate(rawDate)
    const category = normalizeIncomeCategory(rawCategory)
    const description = String(rawDescription || '').trim()

    if (amount === null || amount <= 0) {
      skippedRows++
      issues.push({
        level: 'error',
        sheet: 'Incomes',
        row: rowNumber,
        message: 'Amount must be a number greater than 0',
      })
      return
    }

    if (!date) {
      skippedRows++
      issues.push({
        level: 'error',
        sheet: 'Incomes',
        row: rowNumber,
        message: 'Date is invalid or missing',
      })
      return
    }

    const fingerprint = buildFingerprint(date, amount, category, description)
    if (seen.has(fingerprint)) {
      duplicateRows++
      skippedRows++
      issues.push({
        level: 'warning',
        sheet: 'Incomes',
        row: rowNumber,
        message: 'Duplicate row in import file',
      })
      return
    }

    seen.add(fingerprint)
    items.push({
      id: crypto.randomUUID(),
      amount,
      category,
      description,
      date,
      createdAt: new Date().toISOString(),
    })
  })

  return { items, skippedRows, duplicateRows }
}

function buildTripFingerprint(row: TripMutationInput): string {
  return [
    row.name.trim().toLowerCase(),
    row.startDate,
    row.endDate,
    (row.destinations || '').trim().toLowerCase(),
    row.budget ?? '',
    (row.groupName || '').trim().toLowerCase(),
    row.groupSize ?? '',
    row.groupFund ?? '',
  ].join('|')
}

function parseTripRows(rows: ExcelRow[], issues: ExcelImportIssue[]): {
  items: ExcelImportedTrip[]
  skippedRows: number
  duplicateRows: number
} {
  const items: ExcelImportedTrip[] = []
  const seen = new Set<string>()
  let skippedRows = 0
  let duplicateRows = 0

  rows.forEach((row, index) => {
    const rowNumber = index + 2

    if (isBlankRow(row)) {
      skippedRows++
      return
    }

    const sourceId = normalizeTextValue(getRowValue(row, ['Trip ID', 'tripId', 'trip id'])) || undefined
    const parsed = parseTripInput({
      name: getRowValue(row, ['Name', 'Trip Name', 'name']),
      startDate: getRowValue(row, ['Start Date', 'startDate', 'start date']),
      endDate: getRowValue(row, ['End Date', 'endDate', 'end date']),
      budget: getRowValue(row, ['Budget', 'budget']),
      destinations: getRowValue(row, ['Destinations', 'Destination', 'destinations']),
      groupName: getRowValue(row, ['Group Name', 'groupName', 'group name']),
      groupSize: getRowValue(row, ['Total Travelers', 'groupSize', 'group size']),
      groupFund: getRowValue(row, ['Group Fund', 'groupFund', 'group fund']),
    })

    if (!parsed.data) {
      skippedRows++
      issues.push({
        level: 'error',
        sheet: 'Trips',
        row: rowNumber,
        message: parsed.error || 'Invalid trip row',
      })
      return
    }

    const fingerprint = sourceId ? `id:${sourceId.toLowerCase()}` : buildTripFingerprint(parsed.data)
    if (seen.has(fingerprint)) {
      duplicateRows++
      skippedRows++
      issues.push({
        level: 'warning',
        sheet: 'Trips',
        row: rowNumber,
        message: 'Duplicate trip row in import file',
      })
      return
    }

    seen.add(fingerprint)
    items.push({
      sourceId,
      data: parsed.data,
    })
  })

  return { items, skippedRows, duplicateRows }
}

function withStandardSheetFormatting(sheet: XLSX.WorkSheet): void {
  sheet['!autofilter'] = { ref: sheet['!ref'] || 'A1' }
  sheet['!freeze'] = { xSplit: 0, ySplit: 1 }
}

export function exportToExcel(
  expenses: Expense[],
  incomes: Income[] = [],
  filename = 'wallet_data',
  customCategories: CustomCategory[] = [],
  savingsSummary?: ExcelSavingsSummary,
  trips: Trip[] = []
): void {
  const expenseRows = expenses.map((item) => ({
    Date: item.date,
    'Category Key': item.category,
    Category: getCategoryLabel(item.category, 'en'),
    Amount: item.amount,
    Description: item.description,
    'Trip ID': item.tripId || '',
    'Shared Friend Group': item.sharedGroupExpense ? 'Yes' : '',
    'Created At': item.createdAt,
    'Updated At': item.updatedAt || '',
  }))

  const incomeRows = incomes.map((item) => ({
    Date: item.date,
    'Category Key': item.category,
    Category: getIncomeCategoryLabel(item.category, 'en'),
    Amount: item.amount,
    Description: item.description,
    'Created At': item.createdAt,
    'Updated At': item.updatedAt || '',
  }))

  const summaryRows = [
    { Metric: 'Generated At', Value: format(new Date(), 'yyyy-MM-dd HH:mm:ss') },
    { Metric: 'Expense Rows', Value: expenseRows.length },
    { Metric: 'Shared Group Expense Rows', Value: expenses.filter((item) => item.sharedGroupExpense).length },
    { Metric: 'Income Rows', Value: incomeRows.length },
    { Metric: 'Trip Rows', Value: trips.length },
    {
      Metric: 'Trips With Shared Group Setup',
      Value: trips.filter((trip) => trip.groupName || typeof trip.groupSize === 'number' || typeof trip.groupFund === 'number').length,
    },
    {
      Metric: 'Total Shared Group Fund',
      Value: trips.reduce((sum, trip) => sum + (trip.groupFund ?? 0), 0),
    },
  ]
  if (savingsSummary) {
    summaryRows.push(
      { Metric: 'Currency', Value: savingsSummary.currency },
      { Metric: 'Monthly Net Savings', Value: savingsSummary.monthlySavings ?? 0 },
      { Metric: 'Savings + Assets', Value: savingsSummary.savingsPlusAssets ?? 0 },
      { Metric: 'Total Asset Value', Value: savingsSummary.totalAssetValue },
      { Metric: 'Insurance Assets', Value: savingsSummary.insuranceValue ?? 0 },
      { Metric: 'Crypto Assets', Value: savingsSummary.cryptoValue ?? 0 },
      { Metric: 'Stocks Assets', Value: savingsSummary.stocksValue ?? 0 },
      { Metric: 'Personal Saving Funds', Value: savingsSummary.personalFundsValue ?? 0 },
      { Metric: 'Crypto Feed State', Value: savingsSummary.cryptoSocketState || 'n/a' }
    )
  }

  const categoriesSheet: Array<{
    'Category Key': string
    'English Label': string
    'Myanmar Label': string
  }> = CATEGORIES.map((category) => ({
    'Category Key': category,
    'English Label': CATEGORY_LABELS[category].en,
    'Myanmar Label': CATEGORY_LABELS[category].my,
  }))

  const incomeCategoriesSheet: Array<{
    'Category Key': string
    'English Label': string
    'Myanmar Label': string
  }> = INCOME_CATEGORIES.map((category) => ({
    'Category Key': category,
    'English Label': INCOME_CATEGORY_LABELS[category].en,
    'Myanmar Label': INCOME_CATEGORY_LABELS[category].my,
  }))

  const expenseCategorySeen = new Set(
    categoriesSheet.map((item) => item['Category Key'].trim().toLowerCase())
  )
  const incomeCategorySeen = new Set(
    incomeCategoriesSheet.map((item) => item['Category Key'].trim().toLowerCase())
  )

  const appendExpenseCategory = (raw: string) => {
    const key = raw.trim()
    if (!key) return
    const normalized = key.toLowerCase()
    if (expenseCategorySeen.has(normalized)) return
    expenseCategorySeen.add(normalized)
    categoriesSheet.push({
      'Category Key': key,
      'English Label': key,
      'Myanmar Label': key,
    })
  }

  const appendIncomeCategory = (raw: string) => {
    const key = raw.trim()
    if (!key) return
    const normalized = key.toLowerCase()
    if (incomeCategorySeen.has(normalized)) return
    incomeCategorySeen.add(normalized)
    incomeCategoriesSheet.push({
      'Category Key': key,
      'English Label': key,
      'Myanmar Label': key,
    })
  }

  for (const expense of expenses) {
    appendExpenseCategory(expense.category)
  }
  for (const income of incomes) {
    appendIncomeCategory(income.category)
  }
  for (const custom of customCategories) {
    if (custom.type === 'income') appendIncomeCategory(custom.name)
    else appendExpenseCategory(custom.name)
  }

  const tripRows = trips.map((trip) => ({
    'Trip ID': trip.id,
    Name: trip.name,
    'Start Date': trip.startDate,
    'End Date': trip.endDate,
    Budget: trip.budget ?? '',
    Destinations: trip.destinations ?? '',
    'Group Name': trip.groupName ?? '',
    'Total Travelers': trip.groupSize ?? '',
    'Group Fund': trip.groupFund ?? '',
    'Created At': trip.createdAt,
  }))

  const tripSpendMap = expenses.reduce<Record<string, number>>((acc, expense) => {
    if (!expense.tripId) return acc
    acc[expense.tripId] = (acc[expense.tripId] || 0) + expense.amount
    return acc
  }, {})

  const sharedGroupTripSpendMap = expenses.reduce<Record<string, number>>((acc, expense) => {
    if (!expense.tripId || !expense.sharedGroupExpense) return acc
    acc[expense.tripId] = (acc[expense.tripId] || 0) + expense.amount
    return acc
  }, {})

  const sharedGroupTripCountMap = expenses.reduce<Record<string, number>>((acc, expense) => {
    if (!expense.tripId || !expense.sharedGroupExpense) return acc
    acc[expense.tripId] = (acc[expense.tripId] || 0) + 1
    return acc
  }, {})

  const tripSummaryRows = trips
    .map((trip) => {
      const totalExpense = tripSpendMap[trip.id] || 0
      const sharedGroupExpense = sharedGroupTripSpendMap[trip.id] || 0
      const financialSummary = getTripFinancialSummary(trip, totalExpense, sharedGroupExpense)

      return {
        'Trip ID': trip.id,
        Name: trip.name,
        'Total Expense': totalExpense,
        'Shared Group Expense': sharedGroupExpense,
        'Shared Group Transactions': sharedGroupTripCountMap[trip.id] || 0,
        Budget: trip.budget ?? '',
        'Budget Left': financialSummary.remainingBudget ?? '',
        'Group Name': trip.groupName ?? '',
        'Total Travelers': trip.groupSize ?? '',
        'Group Fund': trip.groupFund ?? '',
        'Group Fund Left': financialSummary.remainingGroupFund ?? '',
        'Per Person Shared Spend': financialSummary.perPersonSharedSpend ?? '',
        'Fund Per Person': financialSummary.perPersonFundTarget ?? '',
      }
    })
    .sort((a, b) => Number(b['Total Expense']) - Number(a['Total Expense']))

  const linkedTripIds = new Set(trips.map((trip) => trip.id))
  const orphanTripSummaryRows = Object.entries(tripSpendMap)
    .filter(([tripId]) => !linkedTripIds.has(tripId))
    .sort((a, b) => b[1] - a[1])
    .map(([tripId, total]) => ({
      'Trip ID': tripId,
      Name: '(Unlinked)',
      'Total Expense': total,
      'Shared Group Expense': sharedGroupTripSpendMap[tripId] || '',
      'Shared Group Transactions': sharedGroupTripCountMap[tripId] || '',
      Budget: '',
      'Budget Left': '',
      'Group Name': '',
      'Total Travelers': '',
      'Group Fund': '',
      'Group Fund Left': '',
      'Per Person Shared Spend': '',
      'Fund Per Person': '',
    }))

  const wb = XLSX.utils.book_new()

  const expenseWs = XLSX.utils.json_to_sheet(expenseRows)
  expenseWs['!cols'] = [
    { wch: 12 },
    { wch: 16 },
    { wch: 18 },
    { wch: 14 },
    { wch: 40 },
    { wch: 20 },
    { wch: 18 },
    { wch: 22 },
    { wch: 22 },
  ]
  withStandardSheetFormatting(expenseWs)

  const incomeWs = XLSX.utils.json_to_sheet(incomeRows)
  incomeWs['!cols'] = [
    { wch: 12 },
    { wch: 16 },
    { wch: 18 },
    { wch: 14 },
    { wch: 40 },
    { wch: 22 },
    { wch: 22 },
  ]
  withStandardSheetFormatting(incomeWs)

  const summaryWs = XLSX.utils.json_to_sheet(summaryRows)
  summaryWs['!cols'] = [{ wch: 18 }, { wch: 28 }]

  const categoriesWs = XLSX.utils.json_to_sheet(categoriesSheet)
  categoriesWs['!cols'] = [{ wch: 16 }, { wch: 22 }, { wch: 22 }]

  const incomeCategoriesWs = XLSX.utils.json_to_sheet(incomeCategoriesSheet)
  incomeCategoriesWs['!cols'] = [{ wch: 16 }, { wch: 22 }, { wch: 22 }]

  const tripsWs = XLSX.utils.json_to_sheet(
    tripRows.length > 0
      ? tripRows
      : [{
        'Trip ID': '-',
        Name: 'No trips',
        'Start Date': '',
        'End Date': '',
        Budget: '',
        Destinations: '',
        'Group Name': '',
        'Total Travelers': '',
        'Group Fund': '',
        'Created At': '',
      }]
  )
  tripsWs['!cols'] = [
    { wch: 22 },
    { wch: 24 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 30 },
    { wch: 22 },
    { wch: 16 },
    { wch: 14 },
    { wch: 22 },
  ]

  const tripSummaryWs = XLSX.utils.json_to_sheet(
    tripSummaryRows.length > 0 || orphanTripSummaryRows.length > 0
      ? [...tripSummaryRows, ...orphanTripSummaryRows]
      : [{
        'Trip ID': '-',
        Name: 'No trip expenses',
        'Total Expense': 0,
        'Shared Group Expense': 0,
        'Shared Group Transactions': 0,
        Budget: '',
        'Budget Left': '',
        'Group Name': '',
        'Total Travelers': '',
        'Group Fund': '',
        'Group Fund Left': '',
        'Per Person Shared Spend': '',
        'Fund Per Person': '',
      }]
  )
  tripSummaryWs['!cols'] = [
    { wch: 22 },
    { wch: 24 },
    { wch: 16 },
    { wch: 18 },
    { wch: 22 },
    { wch: 14 },
    { wch: 14 },
    { wch: 22 },
    { wch: 16 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
  ]

  const savingsAssetsRows = (savingsSummary?.assets || []).map((asset) => ({
    Type: asset.type,
    Name: asset.name,
    Symbol: asset.symbol || '',
    'Base Amount': asset.baseAmount ?? '',
    Quantity: asset.quantity ?? '',
    'Unit Price (USD)': asset.unitPriceUsd ?? '',
    'Current Value': asset.currentValue,
    'Recurring Monthly Contribution': asset.recurringMonthlyAmount ?? '',
    'Recurring Start Date': asset.recurringStartDate || '',
    'Recurring Contributions Applied': asset.recurringContributionCount ?? '',
    'Recurring Contribution Total': asset.recurringContributionValue ?? '',
    'Next Recurring Contribution': asset.nextRecurringContributionDate || '',
    'Value Source': asset.valueSource || '',
    'Quote Updated At': asset.quoteUpdatedAt || '',
  }))
  const savingsAssetsWs = XLSX.utils.json_to_sheet(
    savingsAssetsRows.length > 0
      ? savingsAssetsRows
      : [{ Type: '-', Name: 'No savings assets snapshot', Symbol: '', 'Base Amount': '', Quantity: '', 'Unit Price (USD)': '', 'Current Value': 0, 'Recurring Monthly Contribution': '', 'Recurring Start Date': '', 'Recurring Contributions Applied': '', 'Recurring Contribution Total': '', 'Next Recurring Contribution': '', 'Value Source': '', 'Quote Updated At': '' }]
  )
  savingsAssetsWs['!cols'] = [
    { wch: 12 },
    { wch: 24 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
    { wch: 16 },
    { wch: 14 },
    { wch: 22 },
    { wch: 18 },
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
    { wch: 14 },
    { wch: 24 },
  ]

  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')
  XLSX.utils.book_append_sheet(wb, expenseWs, 'Expenses')
  XLSX.utils.book_append_sheet(wb, incomeWs, 'Incomes')
  XLSX.utils.book_append_sheet(wb, savingsAssetsWs, 'Savings Assets')
  XLSX.utils.book_append_sheet(wb, tripsWs, 'Trips')
  XLSX.utils.book_append_sheet(wb, tripSummaryWs, 'Trip Summary')
  XLSX.utils.book_append_sheet(wb, categoriesWs, 'Expense Categories')
  XLSX.utils.book_append_sheet(wb, incomeCategoriesWs, 'Income Categories')

  XLSX.writeFile(wb, `${filename}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
}

export function importFromExcel(file: File): Promise<ExcelImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const data = event.target?.result
        const workbook = XLSX.read(data, { type: 'array' })
        const issues: ExcelImportIssue[] = []

        const expenseSheetName = workbook.SheetNames.find((name) =>
          ['expenses', 'expense', 'template'].includes(name.trim().toLowerCase())
        )

        const incomeSheetName = workbook.SheetNames.find((name) =>
          ['incomes', 'income'].includes(name.trim().toLowerCase())
        )

        const tripSheetName = workbook.SheetNames.find((name) =>
          ['trips', 'trip'].includes(name.trim().toLowerCase())
        )

        if (!expenseSheetName && !incomeSheetName && !tripSheetName) {
          reject(new Error('Could not find an importable sheet in this file'))
          return
        }

        let parsedExpenses = {
          items: [] as Expense[],
          skippedRows: 0,
          duplicateRows: 0,
        }

        if (expenseSheetName) {
          const expenseSheet = workbook.Sheets[expenseSheetName]
          if (expenseSheet) {
            const expenseRows = XLSX.utils.sheet_to_json(expenseSheet, {
              raw: true,
              defval: '',
            }) as ExcelRow[]

            parsedExpenses = parseExpenseRows(expenseRows, issues)
          }
        }

        let parsedIncomes = {
          items: [] as Income[],
          skippedRows: 0,
          duplicateRows: 0,
        }

        if (incomeSheetName) {
          const incomeSheet = workbook.Sheets[incomeSheetName]
          if (incomeSheet) {
            const incomeRows = XLSX.utils.sheet_to_json(incomeSheet, {
              raw: true,
              defval: '',
            }) as ExcelRow[]
            parsedIncomes = parseIncomeRows(incomeRows, issues)
          }
        }

        let parsedTrips = {
          items: [] as ExcelImportedTrip[],
          skippedRows: 0,
          duplicateRows: 0,
        }

        if (tripSheetName) {
          const tripSheet = workbook.Sheets[tripSheetName]
          if (tripSheet) {
            const tripRows = XLSX.utils.sheet_to_json(tripSheet, {
              raw: true,
              defval: '',
            }) as ExcelRow[]
            parsedTrips = parseTripRows(tripRows, issues)
          }
        }

        resolve({
          expenses: parsedExpenses.items,
          incomes: parsedIncomes.items,
          trips: parsedTrips.items,
          issues,
          skippedRows: parsedExpenses.skippedRows + parsedIncomes.skippedRows + parsedTrips.skippedRows,
          duplicateRows: parsedExpenses.duplicateRows + parsedIncomes.duplicateRows + parsedTrips.duplicateRows,
        })
      } catch {
        reject(new Error('Failed to parse Excel file'))
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

export function downloadTemplate(): void {
  const expenseTemplate = [
    {
      Date: format(new Date(), 'yyyy-MM-dd'),
      'Category Key': 'groceries',
      Category: 'Groceries',
      Amount: 1000,
      Description: 'Example expense entry',
      'Trip ID': '',
      'Shared Friend Group': '',
    },
  ]

  const incomeTemplate = [
    {
      Date: format(new Date(), 'yyyy-MM-dd'),
      'Category Key': 'salary',
      Category: 'Salary',
      Amount: 5000,
      Description: 'Example income entry',
    },
  ]

  const tripTemplate = [
    {
      'Trip ID': 'sample-trip-1',
      Name: 'Example Trip',
      'Start Date': format(new Date(), 'yyyy-MM-dd'),
      'End Date': format(new Date(Date.now() + 3 * 86400000), 'yyyy-MM-dd'),
      Budget: 2500,
      Destinations: 'Bangkok',
      'Group Name': 'Friends Trip',
      'Total Travelers': 4,
      'Group Fund': 1200,
    },
  ]

  const expenseCategories = CATEGORIES.map((category) => ({
    'Category Key': category,
    'English Label': CATEGORY_LABELS[category].en,
    'Myanmar Label': CATEGORY_LABELS[category].my,
  }))

  const incomeCategories = INCOME_CATEGORIES.map((category) => ({
    'Category Key': category,
    'English Label': INCOME_CATEGORY_LABELS[category].en,
    'Myanmar Label': INCOME_CATEGORY_LABELS[category].my,
  }))

  const wb = XLSX.utils.book_new()

  const expenseWs = XLSX.utils.json_to_sheet(expenseTemplate)
  expenseWs['!cols'] = [
    { wch: 12 },
    { wch: 16 },
    { wch: 18 },
    { wch: 14 },
    { wch: 40 },
    { wch: 20 },
    { wch: 18 },
  ]
  withStandardSheetFormatting(expenseWs)

  const incomeWs = XLSX.utils.json_to_sheet(incomeTemplate)
  incomeWs['!cols'] = [
    { wch: 12 },
    { wch: 16 },
    { wch: 18 },
    { wch: 14 },
    { wch: 40 },
  ]
  withStandardSheetFormatting(incomeWs)

  const expenseCategoriesWs = XLSX.utils.json_to_sheet(expenseCategories)
  expenseCategoriesWs['!cols'] = [{ wch: 16 }, { wch: 22 }, { wch: 22 }]

  const incomeCategoriesWs = XLSX.utils.json_to_sheet(incomeCategories)
  incomeCategoriesWs['!cols'] = [{ wch: 16 }, { wch: 22 }, { wch: 22 }]

  const tripWs = XLSX.utils.json_to_sheet(tripTemplate)
  tripWs['!cols'] = [
    { wch: 22 },
    { wch: 24 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 30 },
    { wch: 22 },
    { wch: 16 },
    { wch: 14 },
  ]
  withStandardSheetFormatting(tripWs)

  XLSX.utils.book_append_sheet(wb, expenseWs, 'Expenses')
  XLSX.utils.book_append_sheet(wb, incomeWs, 'Incomes')
  XLSX.utils.book_append_sheet(wb, tripWs, 'Trips')
  XLSX.utils.book_append_sheet(wb, expenseCategoriesWs, 'Expense Categories')
  XLSX.utils.book_append_sheet(wb, incomeCategoriesWs, 'Income Categories')

  XLSX.writeFile(wb, 'wallet_import_template.xlsx')
}
