import { useEffect, useRef, useState } from 'react';
import { Currency, accountCurrency, defaultCurrency } from '../services/billing';

/**
 * The currency a billing surface starts in: the account's own (`billing_currency`) when it has one,
 * otherwise the browser's guess (`defaultCurrency`). Anyone can still switch.
 *
 * The profile can arrive after the first render, so the account's currency is adopted once when it
 * shows up — unless the visitor has already picked one by hand, which always wins.
 */
export const useCurrency = (billingCurrency: unknown): [Currency, (c: Currency) => void] => {
  const fromAccount = accountCurrency(billingCurrency);
  const [currency, setCurrencyState] = useState<Currency>(() => fromAccount ?? defaultCurrency());
  const settled = useRef(fromAccount !== null);
  useEffect(() => {
    if (!settled.current && fromAccount) { settled.current = true; setCurrencyState(fromAccount); }
  }, [fromAccount]);
  const setCurrency = (c: Currency) => { settled.current = true; setCurrencyState(c); };
  return [currency, setCurrency];
};
