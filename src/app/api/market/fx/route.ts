import { NextRequest, NextResponse } from 'next/server'

type CoinbaseExchangeRatesResponse = {
  data?: {
    currency?: string
    rates?: Record<string, string>
  }
}

export const dynamic = 'force-dynamic'

function normalizeCurrencyCode(raw: string | null | undefined, fallback: string): string {
  const normalized = (raw ?? '').trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(normalized)) {
    return fallback
  }
  return normalized
}

export async function GET(request: NextRequest) {
  try {
    const base = normalizeCurrencyCode(request.nextUrl.searchParams.get('base'), 'USD')
    const quote = normalizeCurrencyCode(request.nextUrl.searchParams.get('quote'), 'SGD')

    if (base === quote) {
      return NextResponse.json({
        base,
        quote,
        rate: 1,
        source: 'identity',
        fetchedAt: new Date().toISOString(),
      })
    }

    const response = await fetch(
      `https://api.coinbase.com/v2/exchange-rates?currency=${encodeURIComponent(base)}`,
      { cache: 'no-store' }
    )

    const payload = (await response.json()) as CoinbaseExchangeRatesResponse
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch FX rates from Coinbase (HTTP ${response.status})` },
        { status: 502 }
      )
    }

    const rawRate = payload.data?.rates?.[quote]
    const rate = typeof rawRate === 'string' ? Number(rawRate) : Number.NaN
    if (!Number.isFinite(rate) || rate <= 0) {
      return NextResponse.json(
        { error: `Invalid FX rate for ${base}/${quote}` },
        { status: 502 }
      )
    }

    return NextResponse.json({
      base,
      quote,
      rate,
      source: 'coinbase-exchange-rates',
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('FX route error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch FX rate' },
      { status: 500 }
    )
  }
}
