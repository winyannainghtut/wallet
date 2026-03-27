'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { SavingsAsset } from '@/types'
import {
  calculateInsuranceAssetValue,
  getNextRecurringContributionDate,
  getRecurringContributionCount,
  getRecurringContributionTotal,
} from '@/lib/savings-assets'

type SavingsAssetApiRecord = {
  id?: string
  type?: string
  name?: string
  amount?: number
  symbol?: string
  recurringMonthlyAmount?: number | null
  recurringStartDate?: string | null
  note?: string
  created?: string
  updated?: string
  createdAt?: string
  updatedAt?: string
}

type SavingsAssetsApiResponse = {
  items?: SavingsAssetApiRecord[]
  error?: string
}

type FxApiResponse = {
  rate?: number
  error?: string
}

type CryptoQuote = {
  productId: string
  priceUsd: number
  updatedAt: string
}

type StockQuote = {
  symbol: string
  priceUsd: number
  updatedAt: string
}

export type CryptoSocketState = 'idle' | 'connecting' | 'connected' | 'error'

export type PortfolioAsset = {
  asset: SavingsAsset
  symbol?: string
  productId?: string
  quantity?: number
  unitPriceUsd?: number
  currentValue: number
  quoteUpdatedAt?: string
  recurringMonthlyAmount?: number
  recurringStartDate?: string
  recurringContributionCount?: number
  recurringContributionValue?: number
  nextRecurringContributionDate?: string
  valueSource: 'manual' | 'live' | 'pending'
}

type UseSavingsAssetsPortfolioResult = {
  assets: SavingsAsset[]
  isAssetsLoading: boolean
  assetsError: string | null
  refreshAssets: () => Promise<void>
  portfolioAssets: PortfolioAsset[]
  sortedPortfolioAssets: PortfolioAsset[]
  totalAssetValue: number
  insuranceValue: number
  cryptoValue: number
  stocksValue: number
  personalFundsValue: number
  trackedCryptoProducts: Array<{ symbol: string; productId: string }>
  trackedStockSymbols: string[]
  cryptoSocketState: CryptoSocketState
  cryptoSocketError: string | null
  stockSocketState: CryptoSocketState
  stockSocketError: string | null
  usdToCurrencyRate: number
  fxError: string | null
}

const COINBASE_MARKET_WS_URL = 'wss://advanced-trade-ws.coinbase.com'
const STOCK_MARKET_WS_BASE_URL = 'wss://ws.realtime-finance.ws/stocks'

export function normalizeAssetSymbol(raw: string): string | undefined {
  const normalized = raw.trim().toUpperCase()
  if (!normalized) return undefined
  if (!/^[A-Z0-9-]{2,20}$/.test(normalized)) return undefined
  return normalized
}

export function deriveSymbolFromAssetName(rawName: string): string | undefined {
  const upper = rawName.trim().toUpperCase()
  if (!upper) return undefined

  if (upper.includes('-')) {
    const [firstToken] = upper.split('-')
    return normalizeAssetSymbol(firstToken ?? '')
  }

  const token = upper.split(/\s+/)[0] ?? ''
  return normalizeAssetSymbol(token)
}

export function getCryptoAssetSymbol(asset: SavingsAsset): string | undefined {
  if (asset.type !== 'crypto') return undefined
  return asset.symbol ?? deriveSymbolFromAssetName(asset.name)
}

export function getStockAssetSymbol(asset: SavingsAsset): string | undefined {
  if (asset.type !== 'stocks') return undefined
  return asset.symbol
}

function toCoinbaseProductId(symbol: string): string {
  return symbol.includes('-') ? symbol : `${symbol}-USD`
}

function parseCoinbaseTickerMessage(payload: unknown): Array<{ productId: string; priceUsd: number }> {
  if (typeof payload !== 'object' || payload === null) {
    return []
  }

  const message = payload as { channel?: unknown; events?: unknown }
  if (message.channel !== 'ticker' && message.channel !== 'ticker_batch') {
    return []
  }

  const events = Array.isArray(message.events) ? message.events : []
  const updates: Array<{ productId: string; priceUsd: number }> = []

  for (const eventItem of events) {
    if (typeof eventItem !== 'object' || eventItem === null) continue
    const event = eventItem as { tickers?: unknown; updates?: unknown }
    const tickers = Array.isArray(event.tickers)
      ? event.tickers
      : Array.isArray(event.updates)
        ? event.updates
        : []

    for (const tickerItem of tickers) {
      if (typeof tickerItem !== 'object' || tickerItem === null) continue
      const ticker = tickerItem as { product_id?: unknown; productId?: unknown; price?: unknown }
      const productId =
        typeof ticker.product_id === 'string'
          ? ticker.product_id
          : typeof ticker.productId === 'string'
            ? ticker.productId
            : null

      const rawPrice = ticker.price
      const price =
        typeof rawPrice === 'number'
          ? rawPrice
          : typeof rawPrice === 'string'
            ? Number(rawPrice)
            : Number.NaN

      if (typeof productId === 'string' && Number.isFinite(price)) {
        updates.push({
          productId: productId.toUpperCase(),
          priceUsd: price,
        })
      }
    }
  }

  return updates
}

function parseNumericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null

    const parsed = Number(trimmed.replace(/[$,]/g, ''))
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

function parseStockTickerMessage(symbol: string, payload: unknown): { symbol: string; priceUsd: number } | null {
  const normalizedSymbol = normalizeAssetSymbol(symbol)
  if (!normalizedSymbol) return null

  if (typeof payload === 'string') {
    const directNumber = parseNumericValue(payload)
    if (directNumber !== null) {
      return { symbol: normalizedSymbol, priceUsd: directNumber }
    }

    try {
      return parseStockTickerMessage(normalizedSymbol, JSON.parse(payload) as unknown)
    } catch {
      return null
    }
  }

  const directNumber = parseNumericValue(payload)
  if (directNumber !== null) {
    return { symbol: normalizedSymbol, priceUsd: directNumber }
  }

  if (typeof payload !== 'object' || payload === null) {
    return null
  }

  const record = payload as Record<string, unknown>
  const candidateContainers: Array<Record<string, unknown>> = [record]

  for (const key of ['data', 'quote', 'ticker', 'payload', 'result']) {
    const value = record[key]
    if (typeof value === 'object' && value !== null) {
      candidateContainers.push(value as Record<string, unknown>)
    }
  }

  for (const container of candidateContainers) {
    const candidateSymbol = normalizeAssetSymbol(
      typeof container.symbol === 'string'
        ? container.symbol
        : typeof container.ticker === 'string'
          ? container.ticker
          : typeof container.code === 'string'
            ? container.code
            : typeof container.s === 'string'
              ? container.s
              : normalizedSymbol
    )

    if (candidateSymbol && candidateSymbol !== normalizedSymbol) {
      continue
    }

    for (const key of ['price', 'last', 'lastPrice', 'close', 'currentPrice', 'marketPrice', 'regularMarketPrice', 'c', 'p']) {
      const price = parseNumericValue(container[key])
      if (price !== null) {
        return {
          symbol: normalizedSymbol,
          priceUsd: price,
        }
      }
    }
  }

  return null
}

function normalizeAssetRecord(raw: SavingsAssetApiRecord): SavingsAsset | null {
  if (
    !raw.id ||
    !raw.type ||
    !['insurance', 'crypto', 'stocks', 'personal_funds'].includes(raw.type) ||
    !raw.name ||
    typeof raw.amount !== 'number'
  ) {
    return null
  }

  return {
    id: raw.id,
    type: raw.type as SavingsAsset['type'],
    name: raw.name,
    amount: raw.amount,
    symbol: typeof raw.symbol === 'string' ? normalizeAssetSymbol(raw.symbol) : undefined,
    recurringMonthlyAmount:
      typeof raw.recurringMonthlyAmount === 'number' && raw.recurringMonthlyAmount > 0
        ? raw.recurringMonthlyAmount
        : undefined,
    recurringStartDate:
      typeof raw.recurringStartDate === 'string' && raw.recurringStartDate.trim().length > 0
        ? raw.recurringStartDate.trim()
        : undefined,
    note: raw.note,
    createdAt: raw.createdAt ?? raw.created ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? raw.updated,
  }
}

export function useSavingsAssetsPortfolio(currency: string): UseSavingsAssetsPortfolioResult {
  const [assets, setAssets] = useState<SavingsAsset[]>([])
  const [isAssetsLoading, setIsAssetsLoading] = useState(true)
  const [assetsError, setAssetsError] = useState<string | null>(null)
  const [cryptoQuotes, setCryptoQuotes] = useState<Record<string, CryptoQuote>>({})
  const [stockQuotes, setStockQuotes] = useState<Record<string, StockQuote>>({})
  const [cryptoSocketState, setCryptoSocketState] = useState<CryptoSocketState>('idle')
  const [cryptoSocketError, setCryptoSocketError] = useState<string | null>(null)
  const [socketRetryToken, setSocketRetryToken] = useState(0)
  const [stockSocketState, setStockSocketState] = useState<CryptoSocketState>('idle')
  const [stockSocketError, setStockSocketError] = useState<string | null>(null)
  const [stockSocketRetryToken, setStockSocketRetryToken] = useState(0)
  const [usdToCurrencyRate, setUsdToCurrencyRate] = useState(1)
  const [fxError, setFxError] = useState<string | null>(null)

  const refreshAssets = useCallback(async () => {
    try {
      setIsAssetsLoading(true)
      setAssetsError(null)
      const response = await fetch('/api/savings-assets?perPage=200')
      const data = (await response.json()) as SavingsAssetsApiResponse
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load savings assets')
      }

      const normalized = (data.items ?? [])
        .map(normalizeAssetRecord)
        .filter((item): item is SavingsAsset => item !== null)
      setAssets(normalized)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load savings assets'
      setAssetsError(message)
      setAssets([])
    } finally {
      setIsAssetsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshAssets()
  }, [refreshAssets])

  const trackedCryptoProducts = useMemo(() => {
    const pairs = new Map<string, string>()

    for (const asset of assets) {
      const symbol = getCryptoAssetSymbol(asset)
      if (!symbol) continue
      const productId = toCoinbaseProductId(symbol)

      if (!pairs.has(productId)) {
        pairs.set(productId, symbol)
      }
    }

    return Array.from(pairs.entries()).map(([productId, symbol]) => ({
      symbol,
      productId,
    }))
  }, [assets])

  const trackedStockSymbols = useMemo(() => {
    const symbols = new Set<string>()

    for (const asset of assets) {
      const symbol = getStockAssetSymbol(asset)
      if (!symbol) continue
      symbols.add(symbol)
    }

    return Array.from(symbols.values()).sort((a, b) => a.localeCompare(b))
  }, [assets])

  useEffect(() => {
    const quoteCurrency = currency.trim().toUpperCase() || 'USD'
    if (quoteCurrency === 'USD') {
      setUsdToCurrencyRate(1)
      setFxError(null)
      return
    }

    setUsdToCurrencyRate(Number.NaN)
    setFxError(null)

    let cancelled = false

    const loadFx = async () => {
      try {
        const response = await fetch(`/api/market/fx?base=USD&quote=${encodeURIComponent(quoteCurrency)}`)
        const data = (await response.json()) as FxApiResponse
        if (!response.ok || typeof data.rate !== 'number' || !Number.isFinite(data.rate) || data.rate <= 0) {
          throw new Error(data.error || `Failed to fetch USD to ${quoteCurrency} rate`)
        }

        if (cancelled) return
        setUsdToCurrencyRate(data.rate)
        setFxError(null)
      } catch (error) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : `Failed to fetch USD to ${quoteCurrency} rate`
        setUsdToCurrencyRate(Number.NaN)
        setFxError(message)
      }
    }

    void loadFx()
    const timer = setInterval(() => {
      void loadFx()
    }, 60_000)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [currency])

  useEffect(() => {
    const productIds = trackedCryptoProducts.map((item) => item.productId)
    const trackedByProductId = new Map(
      trackedCryptoProducts.map((item) => [item.productId, item.symbol])
    )

    if (productIds.length === 0) {
      setCryptoQuotes({})
      setCryptoSocketState('idle')
      setCryptoSocketError(null)
      return
    }

    const productIdSet = new Set(productIds)
    setCryptoQuotes((prev) => {
      const pruned: Record<string, CryptoQuote> = {}
      for (const [productId, quote] of Object.entries(prev)) {
        if (productIdSet.has(productId)) {
          pruned[productId] = quote
        }
      }
      return pruned
    })

    setCryptoSocketState('connecting')
    setCryptoSocketError(null)

    let isCleanedUp = false
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    const ws = new WebSocket(COINBASE_MARKET_WS_URL)

    ws.onopen = () => {
      if (isCleanedUp) return

      ws.send(JSON.stringify({
        type: 'subscribe',
        channel: 'ticker',
        product_ids: productIds,
      }))
      ws.send(JSON.stringify({
        type: 'subscribe',
        channel: 'heartbeats',
        product_ids: productIds,
      }))

      setCryptoSocketState('connected')
      setCryptoSocketError(null)
    }

    ws.onmessage = (event) => {
      if (isCleanedUp) return
      if (typeof event.data !== 'string') return

      try {
        const parsed = JSON.parse(event.data) as unknown
        const updates = parseCoinbaseTickerMessage(parsed)
        if (updates.length === 0) return

        setCryptoQuotes((prev) => {
          const next = { ...prev }
          const now = new Date().toISOString()

          for (const update of updates) {
            if (!trackedByProductId.has(update.productId)) continue
            next[update.productId] = {
              productId: update.productId,
              priceUsd: update.priceUsd,
              updatedAt: now,
            }
          }

          return next
        })
      } catch {
        // ignore non-JSON messages
      }
    }

    ws.onerror = () => {
      if (isCleanedUp) return
      setCryptoSocketState('error')
      setCryptoSocketError('Coinbase live stream error')
    }

    ws.onclose = () => {
      if (isCleanedUp) return
      setCryptoSocketState('error')
      setCryptoSocketError('Coinbase live stream disconnected')
      reconnectTimer = setTimeout(() => {
        setSocketRetryToken((prev) => prev + 1)
      }, 3_000)
    }

    return () => {
      isCleanedUp = true
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
      }

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'unsubscribe',
          channel: 'ticker',
          product_ids: productIds,
        }))
        ws.send(JSON.stringify({
          type: 'unsubscribe',
          channel: 'heartbeats',
          product_ids: productIds,
        }))
      }

      ws.close()
    }
  }, [trackedCryptoProducts, socketRetryToken])

  useEffect(() => {
    if (trackedStockSymbols.length === 0) {
      setStockQuotes({})
      setStockSocketState('idle')
      setStockSocketError(null)
      return
    }

    const symbolSet = new Set(trackedStockSymbols)
    setStockQuotes((prev) => {
      const pruned: Record<string, StockQuote> = {}
      for (const [symbol, quote] of Object.entries(prev)) {
        if (symbolSet.has(symbol)) {
          pruned[symbol] = quote
        }
      }
      return pruned
    })

    setStockSocketState('connecting')
    setStockSocketError(null)

    let isCleanedUp = false
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    const openSymbols = new Set<string>()
    const sockets = trackedStockSymbols.map((symbol) => {
      const ws = new WebSocket(`${STOCK_MARKET_WS_BASE_URL}/${encodeURIComponent(symbol)}`)

      ws.onopen = () => {
        if (isCleanedUp) return
        openSymbols.add(symbol)
        setStockSocketState('connected')
        setStockSocketError(null)
      }

      ws.onmessage = (event) => {
        if (isCleanedUp) return
        const parsed = parseStockTickerMessage(symbol, event.data)
        if (!parsed) return

        setStockQuotes((prev) => ({
          ...prev,
          [parsed.symbol]: {
            symbol: parsed.symbol,
            priceUsd: parsed.priceUsd,
            updatedAt: new Date().toISOString(),
          },
        }))
      }

      ws.onerror = () => {
        if (isCleanedUp) return
        if (openSymbols.size === 0) {
          setStockSocketState('error')
        }
        setStockSocketError(`Stock live stream error (${symbol})`)
      }

      ws.onclose = () => {
        if (isCleanedUp) return

        openSymbols.delete(symbol)
        if (openSymbols.size === 0) {
          setStockSocketState('error')
          setStockSocketError(`Stock live stream disconnected (${symbol})`)
          if (!reconnectTimer) {
            reconnectTimer = setTimeout(() => {
              setStockSocketRetryToken((prev) => prev + 1)
            }, 3_000)
          }
        }
      }

      return ws
    })

    return () => {
      isCleanedUp = true
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
      }
      for (const ws of sockets) {
        ws.close()
      }
    }
  }, [trackedStockSymbols, stockSocketRetryToken])

  const portfolioAssets = useMemo(() => {
    const quoteCurrency = currency.trim().toUpperCase() || 'USD'
    const requiresFxRate = quoteCurrency !== 'USD'
    const hasFxRate = Number.isFinite(usdToCurrencyRate) && usdToCurrencyRate > 0

    return assets.map((asset): PortfolioAsset => {
      if (asset.type === 'stocks') {
        const symbol = getStockAssetSymbol(asset)
        const quote = symbol ? stockQuotes[symbol] : undefined

        if (!symbol) {
          return {
            asset,
            currentValue: asset.amount,
            valueSource: 'manual',
          }
        }

        if (!quote || (requiresFxRate && !hasFxRate)) {
          return {
            asset,
            symbol,
            productId: symbol,
            quantity: asset.amount,
            currentValue: 0,
            valueSource: 'pending',
          }
        }

        return {
          asset,
          symbol,
          productId: symbol,
          quantity: asset.amount,
          unitPriceUsd: quote.priceUsd,
          currentValue: asset.amount * quote.priceUsd * usdToCurrencyRate,
          quoteUpdatedAt: quote.updatedAt,
          valueSource: 'live',
        }
      }

      if (asset.type !== 'crypto') {
        const recurringContributionCount = asset.type === 'insurance'
          ? getRecurringContributionCount(asset.recurringStartDate)
          : undefined
        const recurringContributionValue = asset.type === 'insurance'
          ? getRecurringContributionTotal(asset.recurringMonthlyAmount, asset.recurringStartDate)
          : undefined

        return {
          asset,
          currentValue: asset.type === 'insurance'
            ? calculateInsuranceAssetValue(asset)
            : asset.amount,
          recurringMonthlyAmount: asset.recurringMonthlyAmount,
          recurringStartDate: asset.recurringStartDate,
          recurringContributionCount,
          recurringContributionValue,
          nextRecurringContributionDate: asset.type === 'insurance'
            ? getNextRecurringContributionDate(asset.recurringStartDate)
            : undefined,
          valueSource: 'manual',
        }
      }

      const symbol = getCryptoAssetSymbol(asset)
      const productId = symbol ? toCoinbaseProductId(symbol) : undefined
      const quote = productId ? cryptoQuotes[productId] : undefined

      if (!quote || (requiresFxRate && !hasFxRate)) {
        return {
          asset,
          symbol,
          productId,
          quantity: asset.amount,
          currentValue: 0,
          valueSource: 'pending',
        }
      }

      return {
        asset,
        symbol,
        productId,
        quantity: asset.amount,
        unitPriceUsd: quote.priceUsd,
        currentValue: asset.amount * quote.priceUsd * usdToCurrencyRate,
        quoteUpdatedAt: quote.updatedAt,
        valueSource: 'live',
      }
    })
  }, [assets, cryptoQuotes, stockQuotes, currency, usdToCurrencyRate])

  const sortedPortfolioAssets = useMemo(
    () => [...portfolioAssets].sort((a, b) => b.currentValue - a.currentValue),
    [portfolioAssets]
  )

  const totalAssetValue = useMemo(
    () => portfolioAssets.reduce((sum, item) => sum + item.currentValue, 0),
    [portfolioAssets]
  )

  const insuranceValue = useMemo(
    () => portfolioAssets.filter((item) => item.asset.type === 'insurance').reduce((sum, item) => sum + item.currentValue, 0),
    [portfolioAssets]
  )

  const cryptoValue = useMemo(
    () => portfolioAssets.filter((item) => item.asset.type === 'crypto').reduce((sum, item) => sum + item.currentValue, 0),
    [portfolioAssets]
  )

  const stocksValue = useMemo(
    () => portfolioAssets.filter((item) => item.asset.type === 'stocks').reduce((sum, item) => sum + item.currentValue, 0),
    [portfolioAssets]
  )

  const personalFundsValue = useMemo(
    () => portfolioAssets.filter((item) => item.asset.type === 'personal_funds').reduce((sum, item) => sum + item.currentValue, 0),
    [portfolioAssets]
  )

  return {
    assets,
    isAssetsLoading,
    assetsError,
    refreshAssets,
    portfolioAssets,
    sortedPortfolioAssets,
    totalAssetValue,
    insuranceValue,
    cryptoValue,
    stocksValue,
    personalFundsValue,
    trackedCryptoProducts,
    trackedStockSymbols,
    cryptoSocketState,
    cryptoSocketError,
    stockSocketState,
    stockSocketError,
    usdToCurrencyRate,
    fxError,
  }
}
