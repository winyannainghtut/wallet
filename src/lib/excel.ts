import * as XLSX from 'xlsx'
import { Expense, Category, CATEGORIES, CATEGORY_LABELS } from '@/types'
import { format } from 'date-fns'

export function exportToExcel(expenses: Expense[], filename: string = 'expenses'): void {
  // Prepare data for export
  const data = expenses.map(e => ({
    Date: e.date,
    Category: CATEGORY_LABELS[e.category].en,
    Amount: e.amount,
    Description: e.description
  }))

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(data)

  // Set column widths
  ws['!cols'] = [
    { wch: 12 }, // Date
    { wch: 15 }, // Category
    { wch: 12 }, // Amount
    { wch: 40 }  // Description
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Expenses')

  // Generate and download file
  XLSX.writeFile(wb, `${filename}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
}

export function importFromExcel(file: File): Promise<Expense[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)

        const expenses: Expense[] = jsonData.map((row: unknown) => {
          const r = row as Record<string, unknown>
          // Find category from English label
          let category: Category = 'other'
          const categoryStr = String(r['Category'] || r['category'] || '').toLowerCase()

          for (const cat of CATEGORIES) {
            if (
              CATEGORY_LABELS[cat].en.toLowerCase() === categoryStr ||
              CATEGORY_LABELS[cat].my === categoryStr ||
              cat.toLowerCase() === categoryStr
            ) {
              category = cat
              break
            }
          }

          // Parse date
          let date = format(new Date(), 'yyyy-MM-dd')
          const dateVal = r['Date'] || r['date']
          if (dateVal) {
            if (typeof dateVal === 'number') {
              // Excel date serial number
              const parsed = XLSX.SSF.parse_date_code(dateVal)
              date = `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
            } else {
              const parsed = new Date(String(dateVal))
              if (!isNaN(parsed.getTime())) {
                date = format(parsed, 'yyyy-MM-dd')
              }
            }
          }

          // Parse amount
          let amount = 0
          const amountVal = r['Amount'] || r['amount']
          if (amountVal) {
            amount = parseFloat(String(amountVal)) || 0
          }

          return {
            id: crypto.randomUUID(),
            amount,
            category,
            description: String(r['Description'] || r['description'] || ''),
            date,
            createdAt: new Date().toISOString()
          }
        })

        resolve(expenses)
      } catch {
        reject(new Error('Failed to parse Excel file'))
      }
    }

    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsBinaryString(file)
  })
}

export function downloadTemplate(): void {
  const template = [
    {
      Date: format(new Date(), 'yyyy-MM-dd'),
      Category: 'groceries',
      Amount: 1000,
      Description: 'Example expense entry'
    }
  ]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(template)

  // Add category reference sheet
  const categoriesSheet = CATEGORIES.map(cat => ({
    Category: cat,
    'English Label': CATEGORY_LABELS[cat].en,
    'Myanmar Label': CATEGORY_LABELS[cat].my
  }))
  const ws2 = XLSX.utils.json_to_sheet(categoriesSheet)

  ws['!cols'] = [
    { wch: 12 }, // Date
    { wch: 15 }, // Category
    { wch: 12 }, // Amount
    { wch: 40 }  // Description
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Template')
  XLSX.utils.book_append_sheet(wb, ws2, 'Categories')

  XLSX.writeFile(wb, 'expense_import_template.xlsx')
}
