import { GoogleGenerativeAI } from '@google/generative-ai'
import { Category, CATEGORIES, CATEGORY_LABELS, Expense } from '@/types'

const MODEL = 'gemini-3.1-flash-lite-preview' // Gemini 3.1 Flash family model ID from current Gemini 3 docs

function getClient(apiKey: string) {
  return new GoogleGenerativeAI(apiKey)
}

// Suggest category based on description
export async function suggestCategory(description: string, apiKey: string): Promise<Category> {
  if (!apiKey) throw new Error('API key required')

  const genAI = getClient(apiKey)
  const model = genAI.getGenerativeModel({ model: MODEL })

  const prompt = `You are a helpful assistant that categorizes expenses.
Given an expense description, return ONLY the most appropriate category from this list:
${CATEGORIES.join(', ')}

Description: "${description}"

Return only the category name, nothing else.`

  try {
    const result = await model.generateContent(prompt)
    const suggestion = result.response.text().trim().toLowerCase() || 'other'

    // Validate the suggestion is a valid category
    if (CATEGORIES.includes(suggestion as Category)) {
      return suggestion as Category
    }

    // Try to find partial match
    for (const cat of CATEGORIES) {
      if (suggestion.includes(cat) || cat.includes(suggestion)) {
        return cat
      }
    }

    return 'other'
  } catch (error) {
    console.error('Error suggesting category:', error)
    return 'other'
  }
}

// Get spending insights
export async function getSpendingInsights(
  expenses: Expense[],
  apiKey: string,
  language: 'en' | 'my' = 'en'
): Promise<string> {
  if (!apiKey) throw new Error('API key required')
  if (expenses.length === 0) return language === 'my' ? 'သုံးစွဲမှု မရှိသေးပါ' : 'No expenses yet'

  const genAI = getClient(apiKey)
  const model = genAI.getGenerativeModel({ model: MODEL })

  // Prepare expense summary
  const totalByCategory: Record<string, number> = {}
  expenses.forEach(e => {
    totalByCategory[e.category] = (totalByCategory[e.category] || 0) + e.amount
  })

  const summary = Object.entries(totalByCategory)
    .map(([cat, total]) => `${CATEGORY_LABELS[cat as Category][language]}: ${total}`)
    .join('\n')

  const prompt = language === 'my'
    ? `သင်သည် ငွေကြေးဆိုင်ရာ အကြံပေးသူတစ်ဦးဖြစ်သည်။
အောက်ပါ သုံးစွဲမှု အကျဉ်းချုပ်ကို ကြည့်ပြီး အသုံးဝင်သော အကြံပြုချက်များ ပေးပါ။
မြန်မာလို ပြန်ဖြေပါ။ ၃-၄ စာကြောင်းသာ ပြန်ဖြေပါ။

သုံးစွဲမှု အကျဉ်းချုပ်:
${summary}

စုစုပေါင်း: ${expenses.reduce((s, e) => s + e.amount, 0)}

အကြံပြုချက်များ ပေးပါ။`
    : `You are a helpful financial advisor.
Analyze the following expense summary and provide helpful insights and advice.
Keep the response concise (3-4 sentences).

Expense Summary:
${summary}

Total: ${expenses.reduce((s, e) => s + e.amount, 0)}

Provide insights and advice:`

  try {
    const result = await model.generateContent(prompt)
    return result.response.text() || (language === 'my' ? 'အကြံပြုချက် မရနိုင်ပါ' : 'Unable to generate insights')
  } catch (error) {
    console.error('Error getting insights:', error)
    throw error
  }
}

// Stream chat response
export async function* streamChatAboutExpenses(
  message: string,
  expenses: Expense[],
  apiKey: string,
  language: 'en' | 'my' = 'en'
): AsyncGenerator<string> {
  if (!apiKey) throw new Error('API key required')

  const genAI = getClient(apiKey)
  const model = genAI.getGenerativeModel({ model: MODEL })

  // Prepare expense context
  const recentExpenses = expenses.slice(0, 20).map(e =>
    `${e.date}: ${CATEGORY_LABELS[e.category][language]} - ${e.amount} (${e.description})`
  ).join('\n')

  const totalByCategory: Record<string, number> = {}
  expenses.forEach(e => {
    totalByCategory[e.category] = (totalByCategory[e.category] || 0) + e.amount
  })

  const categorySummary = Object.entries(totalByCategory)
    .map(([cat, total]) => `${CATEGORY_LABELS[cat as Category][language]}: ${total}`)
    .join(', ')

  const systemContext = language === 'my'
    ? `သင်သည် သုံးစွဲမှု ခြေရာခံမှု အက်ပလီကေးရှင်းအတွက် AI လက်ထောက်ဖြစ်သည်။
မြန်မာလို ပြန်ဖြေပါ။ အတိုချုံ့ပြီး အသုံးဝင်သော အဖြေများ ပေးပါ။

အသုံးပြုသူ၏ သုံးစွဲမှု အကျဉ်းချုပ်:
- စုစုပေါင်း: ${expenses.reduce((s, e) => s + e.amount, 0)}
- အမျိုးအစားအလိုက်: ${categorySummary}

မကြာသေးမီ သုံးစွဲမှုများ:
${recentExpenses || 'မရှိသေးပါ'}`
    : `You are a helpful AI assistant for an expense tracking app.
Answer questions concisely and helpfully in English.

User's Expense Summary:
- Total spent: ${expenses.reduce((s, e) => s + e.amount, 0)}
- By category: ${categorySummary}

Recent expenses:
${recentExpenses || 'No expenses yet'}`

  try {
    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: systemContext }]
        },
        {
          role: 'model',
          parts: [{ text: 'I understand. I will help answer questions about your expenses based on this data.' }]
        }
      ]
    })

    const result = await chat.sendMessageStream(message)

    for await (const chunk of result.stream) {
      const text = chunk.text()
      if (text) {
        yield text
      }
    }
  } catch (error) {
    console.error('Error streaming chat:', error)
    throw error
  }
}

// Parse unstructured text into structured expense data
export async function parseExpenseText(
  text: string,
  apiKey: string
): Promise<{ amount: number; category: Category; date: string; description: string } | null> {
  if (!apiKey) throw new Error('API key required')

  const genAI = getClient(apiKey)
  const model = genAI.getGenerativeModel({ model: MODEL })
  
  const today = new Date().toISOString().split('T')[0]

  const prompt = `You are a financial parsing assistant. 
Extract expense details from the following user text.
If no explicit date is mentioned, assume today's date: ${today}.
If "yesterday" is mentioned, use yesterday's date.
Try to derive the best category from this list: ${CATEGORIES.join(', ')}.
The amount MUST be a number (strip currencies, commas, etc.).

Text: "${text}"

Return EXACTLY a valid JSON object with no markdown formatting, no markdown blocks, just the raw JSON:
{
  "amount": <number>,
  "category": "<one of the valid categories>",
  "date": "<YYYY-MM-DD>",
  "description": "<short description>"
}
`

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
      }
    })
    
    let responseText = result.response.text().trim()
    // Clean up if the model wrapped it in markdown code blocks
    if (responseText.startsWith('\`\`\`json')) {
      responseText = responseText.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '').trim()
    } else if (responseText.startsWith('\`\`\`')) {
      responseText = responseText.replace(/^\`\`\`/, '').replace(/\`\`\`$/, '').trim()
    }
    
    const parsed = JSON.parse(responseText)
    
    if (typeof parsed.amount === 'number' && typeof parsed.date === 'string') {
      // Ensure category is valid
      const category = CATEGORIES.includes(parsed.category) ? parsed.category : 'other'
      return {
        ...parsed,
        category
      }
    }
    return null
  } catch (error) {
    console.error('Error parsing expense text:', error)
    return null
  }
}

