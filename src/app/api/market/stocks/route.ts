import { NextRequest, NextResponse } from 'next/server'

type StockStreamerQuote = {
  symbol?: string
  priceUsd?: number
  updatedAt?: string
}

type StockStreamerResponse = {
  quotes?: StockStreamerQuote[]
  state?: 'idle' | 'connecting' | 'connected' | 'error'
  error?: string
  missingSymbols?: string[]
  source?: string
}

const DEFAULT_STOCK_STREAMER_URL = 'http://127.0.0.1:8001'

export const dynamic = 'force-dynamic'

function normalizeAssetSymbol(raw: string | null | undefined): string | undefined {
  const normalized = (raw ?? '').trim().toUpperCase()
  if (!normalized) return undefined
  if (!/^[A-Z0-9.-]{1,20}$/.test(normalized)) return undefined
  return normalized
}

function getStockStreamerUrl(): string {
  return (process.env.STOCK_STREAMER_URL ?? DEFAULT_STOCK_STREAMER_URL).trim().replace(/\/+$/, '')
}

function parseRequestedSymbols(request: NextRequest): string[] {
  const values = [
    ...request.nextUrl.searchParams.getAll('symbol'),
    request.nextUrl.searchParams.get('symbols') ?? '',
  ]

  const unique = new Set<string>()
  for (const rawValue of values) {
    for (const candidate of rawValue.split(',')) {
      const symbol = normalizeAssetSymbol(candidate)
      if (symbol) {
        unique.add(symbol)
      }
    }
  }

  return Array.from(unique.values()).sort((a, b) => a.localeCompare(b))
}

export async function GET(request: NextRequest) {
  try {
    const symbols = parseRequestedSymbols(request)
    if (symbols.length === 0) {
      return NextResponse.json({
        quotes: [],
        missingSymbols: [],
        state: 'idle',
        source: 'yahoo-finance-websocket',
        fetchedAt: new Date().toISOString(),
      })
    }

    const stockStreamerUrl = getStockStreamerUrl()
    if (!stockStreamerUrl) {
      return NextResponse.json(
        { error: 'Stock streamer service URL is not configured' },
        { status: 503 }
      )
    }

    const upstreamResponse = await fetch(
      `${stockStreamerUrl}/quotes?symbols=${encodeURIComponent(symbols.join(','))}`,
      { cache: 'no-store' }
    )

    const rawPayload = (await upstreamResponse.json().catch(() => null)) as StockStreamerResponse | null
    if (!upstreamResponse.ok) {
      return NextResponse.json(
        { error: rawPayload?.error || `Stock streamer returned HTTP ${upstreamResponse.status}` },
        { status: 502 }
      )
    }

    const quotes = (rawPayload?.quotes ?? [])
      .map((quote) => {
        const symbol = normalizeAssetSymbol(quote.symbol)
        const priceUsd = quote.priceUsd
        if (!symbol || typeof priceUsd !== 'number' || !Number.isFinite(priceUsd) || priceUsd <= 0) {
          return null
        }

        return {
          symbol,
          priceUsd,
          updatedAt:
            typeof quote.updatedAt === 'string' && quote.updatedAt.length > 0
              ? quote.updatedAt
              : new Date().toISOString(),
        }
      })
      .filter((quote): quote is NonNullable<typeof quote> => quote !== null)

    const quotedSymbols = new Set(quotes.map((quote) => quote.symbol))
    const missingSymbols = symbols.filter((symbol) => !quotedSymbols.has(symbol))

    return NextResponse.json({
      quotes,
      missingSymbols,
      state: rawPayload?.state ?? (missingSymbols.length === 0 ? 'connected' : 'connecting'),
      error: rawPayload?.error,
      source: rawPayload?.source ?? 'yahoo-finance-websocket',
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Stocks route error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Yahoo stock quotes' },
      { status: 500 }
    )
  }
}
