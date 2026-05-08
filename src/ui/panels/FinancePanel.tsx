import React, { useState } from 'react';
import { useGameStore } from '@/store';
import { formatCurrency, formatNumber } from '@/utils/format';
import { PnLChart } from '@/ui/components/PnLChart';
import { calculateDailyDebtService, calculateDailyLoanPayment, formatInterestRate, LOAN_OFFERS } from '@/engine/finance';
import { rawCompanyValue } from '@/engine/valuation';

function pct(value: number): string {
  if (!Number.isFinite(value)) return '0.0%';
  return `${value.toFixed(1)}%`;
}

export const FinancePanel: React.FC = () => {
  const airlines   = useGameStore(s => s.airlines);
  const aircraft   = useGameStore(s => s.aircraft);
  const routes     = useGameStore(s => s.routes);
  const airports   = useGameStore(s => s.airports);
  const aiAirlines = useGameStore(s => s.aiAirlines);
  const isDark     = useGameStore(s => s.themeMode) !== 'light';

  const closePanel = useGameStore(s => s.closePanel);
  const applyLoan  = useGameStore(s => s.applyLoan);
  const repayLoan  = useGameStore(s => s.repayLoan);
  const [selectedLoanAmount, setSelectedLoanAmount] = useState(LOAN_OFFERS[0].amountUSD);
  const [loansOpen, setLoansOpen] = useState(false);
  const playerAirline = airlines['player'];
  if (!playerAirline) return null;

  const playerRoutes = Object.values(routes).filter(r => r.airlineId === 'player');
  const totalDailyRevenue = playerRoutes.reduce((s, r) => s + r.dailyRevenue, 0);
  const totalDailyCost = playerRoutes.reduce((s, r) => s + r.dailyCost, 0);
  const dailyDebtService = calculateDailyDebtService(playerAirline);
  const totalDailyProfit = totalDailyRevenue - totalDailyCost - dailyDebtService;
  const latestSnapshot = playerAirline.dailyStats.at(-1);
  const snapshotDailyRevenue = latestSnapshot?.revenue ?? totalDailyRevenue;
  const snapshotDailyProfit = latestSnapshot?.profit ?? totalDailyProfit;
  const activeLoans = playerAirline.loans ?? [];
  const totalDebt = activeLoans.reduce((sum, loan) => sum + loan.principalUSD, 0) || playerAirline.totalDebt;

  const aiHoldings = Object.values(aiAirlines)
    .map(ai => ({ ai, stake: (ai.shareholders ?? {})['player'] ?? 0 }))
    .filter(({ stake }) => stake > 0);

  const dailyDividends = aiHoldings.reduce((sum, { ai, stake }) =>
    sum + (stake / 100) * Math.max(0, ai.lastDailyProfit ?? 0), 0);

  const companyValue = rawCompanyValue(playerAirline, aircraft, routes);
  const recentStats = playerAirline.dailyStats.slice(-14);
  const averageDailyProfit = recentStats.length > 0
    ? recentStats.reduce((sum, snapshot) => sum + snapshot.profit, 0) / recentStats.length
    : 0;
  const annualizedProfit = Math.max(0, averageDailyProfit * 365);
  const cashCollateral = Math.max(0, playerAirline.cashUSD) * 0.25;
  const operatingAssetValue = Math.max(0, companyValue - Math.max(0, playerAirline.cashUSD));
  const creditLimit = Math.max(25_000_000, operatingAssetValue * 1.2 + cashCollateral + annualizedProfit * 2);
  const selectedOffer = LOAN_OFFERS.find(offer => offer.amountUSD === selectedLoanAmount) ?? LOAN_OFFERS[0];
  const projectedDebt = totalDebt + selectedOffer.amountUSD;
  const canApplyForLoan = projectedDebt <= creditLimit;

  const dividendSources = aiHoldings
    .map(({ ai, stake }) => ({
      name: ai.name,
      stake,
      dividend: (stake / 100) * Math.max(0, ai.lastDailyProfit ?? 0),
      profit: ai.lastDailyProfit ?? 0,
    }))
    .sort((a, b) => b.dividend - a.dividend);
  const getDailyPax = (a: { dailyStats: { passengers: number }[] }) => a.dailyStats.at(-1)?.passengers ?? 0;
  const dailyPassengers = getDailyPax(playerAirline);
  const totalMarketDailyPax = dailyPassengers +
    Object.values(aiAirlines).reduce((sum, airline) => sum + getDailyPax(airline), 0);
  const marketShare = totalMarketDailyPax > 0 ? (dailyPassengers / totalMarketDailyPax) * 100 : 0;
  const fleet = playerAirline.fleetIds.map(id => aircraft[id]).filter(Boolean);
  const activeRoutes = playerRoutes.filter(route => route.isActive);
  const profitableRoutes = activeRoutes.filter(route => route.dailyProfit > 0).length;
  const losingRoutes = activeRoutes.filter(route => route.dailyProfit < 0).length;
  const averageLoadFactor = activeRoutes.length > 0
    ? activeRoutes.reduce((sum, route) => sum + route.loadFactorEconomy, 0) / activeRoutes.length
    : 0;
  const averageCondition = fleet.length > 0
    ? fleet.reduce((sum, ac) => sum + ac.condition, 0) / fleet.length
    : 0;
  const groundedAircraft = fleet.filter(ac => ac.isGrounded || ac.status === 'maintenance').length;
  const snapshots30 = playerAirline.dailyStats.slice(-30);
  const thirtyDayProfit = snapshots30.reduce((sum, day) => sum + day.profit, 0);
  const thirtyDayRevenue = snapshots30.reduce((sum, day) => sum + day.revenue, 0);
  const thirtyDayCosts = snapshots30.reduce((sum, day) => sum + day.costs, 0);
  const profitMargin = snapshotDailyRevenue > 0 ? (snapshotDailyProfit / snapshotDailyRevenue) * 100 : 0;
  const pricePerPercent = companyValue / 100;
  const topRoutes = [...playerRoutes]
    .sort((a, b) => b.dailyProfit - a.dailyProfit)
    .slice(0, 4);

  return (
    <div className="panel-scroll flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain">
      <div className="panel-header flex shrink-0 items-center justify-between">
        <h2 className="text-white font-bold">Finance</h2>
        <button onClick={closePanel} aria-label="Close" className="w-10 h-10 sm:w-7 sm:h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors text-lg leading-none">×</button>
      </div>
      <div className="flex flex-none flex-col gap-4 p-3">

      <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-2">
        <div className="glass-card p-2">
          <div className="text-gray-400 text-xs">Cash</div>
          <div className={`text-lg font-bold ${playerAirline.cashUSD >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(playerAirline.cashUSD)}
          </div>
        </div>
        <div className="glass-card p-2">
          <div className="text-gray-400 text-xs">Daily P&L</div>
          <div className={`text-lg font-bold ${(snapshotDailyProfit + dailyDividends) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(snapshotDailyProfit + dailyDividends)}
          </div>
        </div>
        <div className="glass-card p-2">
          <div className="text-gray-400 text-xs">Total Passengers</div>
          <div className="text-white text-lg font-bold">
            {playerAirline.totalPassengersAllTime.toLocaleString()}
          </div>
        </div>
        <div className="glass-card p-2">
          <div className="text-gray-400 text-xs">Debt</div>
          <div className={`text-lg font-bold ${totalDebt > 0 ? 'text-red-400' : 'text-gray-300'}`}>
            {totalDebt > 0 ? formatCurrency(totalDebt) : 'None'}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            {dailyDebtService > 0 ? `${formatCurrency(dailyDebtService)}/day service` : 'No debt service'}
          </div>
        </div>
        <div className="glass-card p-2">
          <div className="text-gray-400 text-xs">Reputation</div>
          <div className={`text-lg font-bold ${playerAirline.reputationScore >= 60 ? 'text-green-400' : playerAirline.reputationScore >= 30 ? 'text-yellow-400' : 'text-red-400'}`}>
            {playerAirline.reputationScore.toFixed(0)}/100
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            {playerAirline.reputationScore >= 50
              ? `+${(((playerAirline.reputationScore - 50) * 0.004) * 100).toFixed(0)}% price premium`
              : `-${(((50 - playerAirline.reputationScore) * 0.004) * 100).toFixed(0)}% price penalty`}
          </div>
        </div>
        <div className="glass-card p-2">
          <div className="text-gray-400 text-xs">Market Share</div>
          <div className="text-white text-lg font-bold">{pct(marketShare)}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            {formatNumber(dailyPassengers)} pax/day
          </div>
        </div>
        <div className="glass-card p-2">
          <div className="text-gray-400 text-xs">Profit Margin</div>
          <div className={`text-lg font-bold ${profitMargin >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {pct(profitMargin)}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            {formatCurrency(snapshotDailyRevenue)} revenue
          </div>
        </div>
        {aiHoldings.length > 0 && (
          <div className="col-span-2 glass-card p-2 border border-teal-500/20">
            <div className="text-teal-400 text-xs">Daily Dividend Income</div>
            <div className={`text-lg font-bold ${dailyDividends > 0 ? 'text-teal-300' : 'text-gray-500'}`}>
              {dailyDividends > 0 ? `+${formatCurrency(dailyDividends)}` : '—'}
            </div>
          </div>
        )}
      </div>

      <div className="glass-card p-3">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Operations</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <div className="text-gray-500 text-xs">Fleet</div>
            <div className="text-white font-semibold">{fleet.length} aircraft</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">Routes</div>
            <div className="text-white font-semibold">{activeRoutes.length} active</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">Average condition</div>
            <div className={averageCondition >= 60 ? 'text-green-400 font-semibold' : 'text-yellow-400 font-semibold'}>{pct(averageCondition)}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">Grounded</div>
            <div className={groundedAircraft > 0 ? 'text-yellow-400 font-semibold' : 'text-gray-300 font-semibold'}>{groundedAircraft}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">Load factor</div>
            <div className="text-white font-semibold">{pct(averageLoadFactor * 100)}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">Daily passengers</div>
            <div className="text-white font-semibold">{formatNumber(dailyPassengers)}</div>
          </div>
        </div>
      </div>

      <div className="glass-card p-3">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Public valuation</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <div className="text-gray-500 text-xs">Company value</div>
            <div className="text-white font-semibold">{formatCurrency(companyValue)}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">Price per 1%</div>
            <div className="text-white font-semibold">{formatCurrency(pricePerPercent)}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">30-day revenue</div>
            <div className="text-green-400 font-semibold">{formatCurrency(thirtyDayRevenue)}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">30-day costs</div>
            <div className="text-gray-300 font-semibold">{formatCurrency(thirtyDayCosts)}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">30-day net</div>
            <div className={thirtyDayProfit >= 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>{formatCurrency(thirtyDayProfit)}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">All-time passengers</div>
            <div className="text-white font-semibold">{formatNumber(playerAirline.totalPassengersAllTime)}</div>
          </div>
        </div>
      </div>

      <div className="glass-card p-3">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Ownership</div>
        <div className="flex h-3 overflow-hidden rounded">
          <div className="bg-teal-500" style={{ width: '100%' }} title="You: 100%" />
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <span className="text-[10px] px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
            You 100%
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-gray-500 border border-white/10">
            Float 0%
          </span>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <button
          type="button"
          onClick={() => setLoansOpen(open => !open)}
          aria-expanded={loansOpen}
          className="flex w-full items-center justify-between gap-3 p-2 text-left hover:bg-white/5"
        >
          <div>
            <div className="text-gray-300 text-xs font-semibold">Loans</div>
            <div className="text-[10px] text-gray-500">
              {totalDebt > 0
                ? `${formatCurrency(totalDebt)} outstanding · ${formatCurrency(dailyDebtService)}/day service`
                : `Credit line ${formatCurrency(creditLimit)}`}
            </div>
          </div>
          <div className="flex items-center gap-2 text-right">
            <div>
              <div className="text-[10px] text-gray-500">Available</div>
              <div className="text-xs font-semibold text-gray-300">{formatCurrency(Math.max(0, creditLimit - totalDebt))}</div>
            </div>
            <span className={`text-gray-400 transition-transform ${loansOpen ? 'rotate-180' : ''}`} aria-hidden="true">⌄</span>
          </div>
        </button>

        {loansOpen && (
          <div className="border-t border-gray-700/70 p-2">
            <div className="mb-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div>
                  <div className="text-gray-300 text-xs font-semibold">Loan Application</div>
                  <div className="text-[10px] text-gray-500">Larger facilities get lower institutional rates.</div>
                </div>
                <div className="text-right text-[10px] text-gray-500">
                  Credit line
                  <div className="text-gray-300 font-semibold">{formatCurrency(creditLimit)}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 min-[420px]:grid-cols-4 gap-1.5 mb-2">
                {LOAN_OFFERS.map(offer => {
                  const selected = offer.amountUSD === selectedLoanAmount;
                  const available = totalDebt + offer.amountUSD <= creditLimit;
                  return (
                    <button
                      key={offer.amountUSD}
                      type="button"
                      onClick={() => setSelectedLoanAmount(offer.amountUSD)}
                      className={`rounded border px-2 py-1.5 text-left transition-colors ${
                        selected
                          ? 'border-blue-400 bg-blue-500/20 text-white'
                          : available
                            ? 'border-gray-700 bg-gray-900/40 text-gray-300 hover:border-gray-500'
                            : 'border-gray-800 bg-gray-950/30 text-gray-600'
                      }`}
                    >
                      <div className="text-xs font-semibold">{formatCurrency(offer.amountUSD)}</div>
                      <div className="text-[10px]">{formatInterestRate(offer.annualInterestRate)}</div>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-col min-[420px]:flex-row min-[420px]:items-center justify-between gap-2 text-xs">
                <div className="space-y-0.5">
                  <div className="text-gray-400">
                    Term: <span className="text-gray-200">{selectedOffer.termYears} years</span>
                  </div>
                  <div className="text-gray-400">
                    Daily service: <span className="text-red-300">{formatCurrency(calculateDailyLoanPayment(selectedOffer.amountUSD, selectedOffer.annualInterestRate, selectedOffer.termYears))}</span>
                  </div>
                  {!canApplyForLoan && (
                    <div className="text-red-400">This would exceed your current credit line.</div>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!canApplyForLoan}
                  onClick={() => applyLoan(selectedOffer.amountUSD)}
                  className="rounded bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
                >
                  Apply
                </button>
              </div>
            </div>

            {activeLoans.length > 0 && (
              <div className="border-t border-gray-700/70 pt-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div>
                    <div className="text-gray-300 text-xs font-semibold">Active Loans</div>
                    <div className="text-[10px] text-gray-500">Early payments reduce principal immediately.</div>
                  </div>
                  <div className="text-right text-[10px] text-gray-500">
                    Outstanding
                    <div className="text-red-300 font-semibold">{formatCurrency(totalDebt)}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {activeLoans.map(loan => {
                    const scheduledPayment = loan.dailyPaymentUSD || calculateDailyLoanPayment(loan.principalUSD, loan.annualInterestRate, loan.termYears);
                    const repayTenth = Math.max(1, Math.round(loan.principalUSD * 0.10));
                    const repayQuarter = Math.max(1, Math.round(loan.principalUSD * 0.25));
                    const repayHalf = Math.max(1, Math.round(loan.principalUSD * 0.50));
                    const repayFull = loan.principalUSD;
                    const maxAffordable = Math.min(loan.principalUSD, Math.max(0, Math.floor(playerAirline.cashUSD)));
                    const canRepay = playerAirline.cashUSD > 0;
                    const canRepayTenth = playerAirline.cashUSD >= repayTenth;
                    const canRepayQuarter = playerAirline.cashUSD >= repayQuarter;
                    const canRepayHalf = playerAirline.cashUSD >= repayHalf;
                    const canRepayFull = playerAirline.cashUSD >= repayFull;

                    return (
                      <div key={loan.id} className="rounded border border-gray-700 bg-gray-900/30 p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold text-white">{formatCurrency(loan.principalUSD)}</div>
                            <div className="text-[10px] text-gray-500">
                              {formatInterestRate(loan.annualInterestRate)} · {loan.termYears}y · {formatCurrency(scheduledPayment)}/day
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-wrap justify-end gap-1">
                            <button
                              type="button"
                              disabled={!canRepayTenth}
                              title={canRepayTenth ? `Repay ${formatCurrency(repayTenth)}` : `Need ${formatCurrency(repayTenth)} cash`}
                              onClick={() => repayLoan(loan.id, repayTenth)}
                              className="rounded border border-gray-600 px-2 py-1 text-[10px] font-semibold text-gray-200 hover:border-green-400 hover:text-green-300 disabled:cursor-not-allowed disabled:border-gray-800 disabled:text-gray-600"
                            >
                              10%
                            </button>
                            <button
                              type="button"
                              disabled={!canRepayQuarter}
                              title={canRepayQuarter ? `Repay ${formatCurrency(repayQuarter)}` : `Need ${formatCurrency(repayQuarter)} cash`}
                              onClick={() => repayLoan(loan.id, repayQuarter)}
                              className="rounded border border-gray-600 px-2 py-1 text-[10px] font-semibold text-gray-200 hover:border-green-400 hover:text-green-300 disabled:cursor-not-allowed disabled:border-gray-800 disabled:text-gray-600"
                            >
                              25%
                            </button>
                            <button
                              type="button"
                              disabled={!canRepayHalf}
                              title={canRepayHalf ? `Repay ${formatCurrency(repayHalf)}` : `Need ${formatCurrency(repayHalf)} cash`}
                              onClick={() => repayLoan(loan.id, repayHalf)}
                              className="rounded border border-gray-600 px-2 py-1 text-[10px] font-semibold text-gray-200 hover:border-green-400 hover:text-green-300 disabled:cursor-not-allowed disabled:border-gray-800 disabled:text-gray-600"
                            >
                              50%
                            </button>
                            <button
                              type="button"
                              disabled={!canRepay}
                              title={canRepay ? `Repay ${formatCurrency(maxAffordable)}` : 'No cash available'}
                              onClick={() => repayLoan(loan.id, maxAffordable)}
                              className="rounded border border-sky-600 px-2 py-1 text-[10px] font-semibold text-sky-200 hover:border-sky-400 hover:text-sky-100 disabled:cursor-not-allowed disabled:border-gray-800 disabled:text-gray-600"
                            >
                              Max cash
                            </button>
                            <button
                              type="button"
                              disabled={!canRepayFull}
                              title={canRepayFull ? `Repay ${formatCurrency(repayFull)}` : `Need ${formatCurrency(repayFull)} cash`}
                              onClick={() => repayLoan(loan.id, repayFull)}
                              className="rounded bg-green-700 px-2 py-1 text-[10px] font-semibold text-white hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
                            >
                              Full
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="glass-card p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Route performance</div>
          <div className="text-xs text-gray-500">
            {profitableRoutes} profitable · {losingRoutes} losing
          </div>
        </div>
        {topRoutes.length === 0 ? (
          <div className="text-gray-500 text-xs italic">No route data available</div>
        ) : (
          <div className="space-y-1.5">
            {topRoutes.map(route => {
              const origin = airports[route.originIata];
              const dest = airports[route.destinationIata];
              const routeLabel = origin && dest
                ? `${origin.city} → ${dest.city}`
                : `${route.originIata} → ${route.destinationIata}`;

              return (
                <div key={route.id} className="flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="truncate text-gray-300">{routeLabel}</div>
                    <div className="text-[10px] text-gray-500">{route.flightsPerWeek} flights/week</div>
                  </div>
                  <div className={route.dailyProfit >= 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                    {formatCurrency(route.dailyProfit)}/d
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="text-gray-400 text-xs mb-1">30-Day Profit Trend</div>
        <div className="overflow-hidden">
          <PnLChart snapshots={playerAirline.dailyStats.slice(-30)} width={300} height={80} isDark={isDark} />
        </div>
      </div>

      <div className="glass-card p-2">
        <div className="text-gray-400 text-xs mb-2">Daily Breakdown</div>
        <div className="space-y-1 text-xs">
          {[
            { label: 'Revenue', value: totalDailyRevenue, color: 'text-green-400' },
            { label: 'Fuel', value: -playerRoutes.reduce((s, r) => s + r.dailyCost * 0.35, 0), color: 'text-red-400' },
            { label: 'Maintenance', value: -playerRoutes.reduce((s, r) => s + r.dailyCost * 0.25, 0), color: 'text-orange-400' },
            { label: 'Crew', value: -playerRoutes.reduce((s, r) => s + r.dailyCost * 0.25, 0), color: 'text-yellow-400' },
            { label: 'Airport Fees', value: -playerRoutes.reduce((s, r) => s + r.dailyCost * 0.15, 0), color: 'text-blue-400' },
            { label: 'Debt Service', value: -dailyDebtService, color: 'text-red-300' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex justify-between">
              <span className="text-gray-400">{label}</span>
              <span className={color}>{formatCurrency(value)}</span>
            </div>
          ))}
          {aiHoldings.length > 0 && (
            <div className="flex justify-between">
              <span className="text-teal-400">Dividends</span>
              <span className={dailyDividends > 0 ? 'text-teal-300' : 'text-gray-500'}>
                {dailyDividends > 0 ? `+${formatCurrency(dailyDividends)}` : '—'}
              </span>
            </div>
          )}
          <div className="border-t border-gray-700 pt-1 flex justify-between font-bold">
            <span className="text-gray-300">Net</span>
            <span className={(snapshotDailyProfit + dailyDividends) >= 0 ? 'text-green-400' : 'text-red-400'}>
              {formatCurrency(snapshotDailyProfit + dailyDividends)}
            </span>
          </div>
        </div>
      </div>

      {dividendSources.length > 0 && (
        <div className="glass-card p-2">
          <div className="text-gray-400 text-xs mb-2">Investment Holdings</div>
          <div className="space-y-1 text-xs">
            {dividendSources.map(s => (
              <div key={s.name} className="flex justify-between items-center">
                <span className="text-gray-300 truncate">
                  {s.name} <span className="text-gray-500">({s.stake.toFixed(0)}%)</span>
                </span>
                <span className={`shrink-0 ml-2 ${s.dividend > 0 ? 'text-teal-300' : s.profit < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                  {s.dividend > 0 ? `+${formatCurrency(s.dividend)}/d` : s.profit < 0 ? 'losing' : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
