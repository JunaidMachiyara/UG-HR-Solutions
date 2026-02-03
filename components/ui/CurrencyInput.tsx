import React from 'react';
import { Currency } from '../../types.ts';

interface CurrencyInputProps {
    value: { currency: Currency; conversionRate: number };
    onChange: (newValue: { currency: Currency; conversionRate: number }) => void;
    idPrefix?: string;
    selectTabIndex?: number;
    rateTabIndex?: number;
    disabled?: boolean;
}

const currencies = Object.values(Currency);

const defaultConversionRates: { [key: string]: number } = {
    [Currency.AustralianDollar]: 0.66,
    [Currency.Pound]: 1.34,
    [Currency.AED]: 0.2724795640326975,
    [Currency.SaudiRiyal]: 0.27,
    [Currency.Euro]: 1.17,
    [Currency.Dollar]: 1,
};

const CurrencyInput: React.FC<CurrencyInputProps> = ({ value, onChange, idPrefix = 'currency', disabled = false }) => {
    const handleCurrencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newCurrency = e.target.value as Currency;
        const newRate = defaultConversionRates[newCurrency] || 1;
        onChange({ currency: newCurrency, conversionRate: newRate });
    };

    const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newRate = parseFloat(e.target.value);
        if (!isNaN(newRate)) {
            onChange({ ...value, conversionRate: newRate });
        }
    };

    const isRateDisabled = value.currency === Currency.Dollar;

    return (
        <div className="flex items-center space-x-2">
            <select
                id={`${idPrefix}-select`}
                value={value.currency}
                onChange={handleCurrencyChange}
                disabled={disabled}
                className="w-2/5 p-2 rounded-md"
            >
                {currencies.map(c => (
                    <option key={c} value={c}>{c}</option>
                ))}
            </select>
            <input
                id={`${idPrefix}-rate`}
                type="number"
                step="any"
                value={value.conversionRate}
                onChange={handleRateChange}
                disabled={isRateDisabled || disabled}
                className="w-3/5 p-2 rounded-md"
            />
        </div>
    );
};

export default CurrencyInput;