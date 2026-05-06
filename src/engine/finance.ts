import type { Airline } from '@/types';

export interface LoanOffer {
  amountUSD: number;
  annualInterestRate: number;
  termYears: number;
}

export const LOAN_OFFERS: LoanOffer[] = [
  { amountUSD: 5_000_000, annualInterestRate: 0.095, termYears: 5 },
  { amountUSD: 10_000_000, annualInterestRate: 0.085, termYears: 5 },
  { amountUSD: 25_000_000, annualInterestRate: 0.074, termYears: 7 },
  { amountUSD: 50_000_000, annualInterestRate: 0.064, termYears: 7 },
  { amountUSD: 100_000_000, annualInterestRate: 0.055, termYears: 10 },
  { amountUSD: 250_000_000, annualInterestRate: 0.049, termYears: 10 },
  { amountUSD: 500_000_000, annualInterestRate: 0.045, termYears: 12 },
];

export function getLoanOffer(amountUSD: number): LoanOffer | undefined {
  return LOAN_OFFERS.find(offer => offer.amountUSD === amountUSD);
}

export function getActiveLoans(airline: Airline | undefined) {
  return airline?.loans ?? [];
}

export function calculateDailyDebtInterest(airline: Airline | undefined): number {
  return getActiveLoans(airline).reduce(
    (sum, loan) => sum + (loan.principalUSD * loan.annualInterestRate) / 365,
    0,
  );
}

export function calculateDailyLoanPayment(principalUSD: number, annualInterestRate: number, termYears: number): number {
  const dailyRate = annualInterestRate / 365;
  const paymentCount = termYears * 365;
  if (dailyRate <= 0) return principalUSD / paymentCount;
  return principalUSD * (dailyRate / (1 - (1 + dailyRate) ** -paymentCount));
}

export function calculateDailyDebtService(airline: Airline | undefined): number {
  return getActiveLoans(airline).reduce(
    (sum, loan) => {
      const scheduledPayment = loan.dailyPaymentUSD || calculateDailyLoanPayment(loan.principalUSD, loan.annualInterestRate, loan.termYears);
      const interest = (loan.principalUSD * loan.annualInterestRate) / 365;
      return sum + Math.min(loan.principalUSD + interest, scheduledPayment);
    },
    0,
  );
}

export function formatInterestRate(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}
