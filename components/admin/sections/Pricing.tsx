// Admin — Pricing & Plans editor. Super-admin edits the live pricing config (plan prices + monthly
// token allocations + org limits, expansion pricing, token packs, per-tool costs). Saves via the
// updatePricingConfig callable; the server validates + merges over defaults and the change takes
// effect within ~1 minute (config cache TTL).
import React, { useEffect, useState } from 'react';
import { Card } from '../../UI';
import { useAdmin } from '../AdminContext';
import { AdminSectionHeader } from '../primitives';
import { getLivePricingConfig, callUpdatePricingConfig } from '../../../services/persistenceService';
import { PricingConfig, Tier, PLAN_ORDER, PLAN_META, DEFAULT_PRICING_CONFIG } from '../../../config/pricingConfig';
import { formatPrice } from '../../../services/billing';

const num = (v: any) => Math.max(0, Math.round(Number(v) || 0));

/* PRICES ARE NOT EDITABLE HERE. Each Bachs product bills the price it was set up with and the pages
   show the code's config, so the server charges and checks the code's prices whatever this doc says
   (functions withPinnedPrices). The cells show those prices, and a save writes them back unchanged. */
const PRICES_NOTE = 'Prices are fixed in code while Bachs products are pinned.';
const codePrice = (usd: number | undefined, ngn: number | undefined) =>
  [usd ? formatPrice(usd, 'USD') : '$0', ngn ? formatPrice(ngn, 'NGN') : null].filter(Boolean).join(' · ');
const withCodePrices = (c: PricingConfig): PricingConfig => ({
  ...c,
  plans: Object.fromEntries(Object.entries(c.plans).map(([t, p]) => {
    const d = DEFAULT_PRICING_CONFIG.plans[t as Tier];
    return [t, { ...p, price: d?.price ?? p.price, priceNgn: d?.priceNgn }];
  })) as PricingConfig['plans'],
  tokenPacks: c.tokenPacks.map((p) => {
    const d = DEFAULT_PRICING_CONFIG.tokenPacks.find((x) => x.id === p.id);
    return d ? { ...p, price: d.price, priceNgn: d.priceNgn } : p;
  }),
});

const NumInput: React.FC<{ value: number | undefined; onChange: (v: number) => void; disabled?: boolean; w?: string }> =
  ({ value, onChange, disabled, w = 'w-24' }) => (
    <input type="number" min={0} value={value ?? 0} disabled={disabled}
      onChange={(e) => onChange(num(e.target.value))}
      className={`${w} px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 disabled:opacity-50`} />
  );

const limitKeys: { key: keyof PricingConfig['plans']['enterprise']; label: string }[] = [
  { key: 'membersPerWorkspace', label: 'Members / workspace' },
  { key: 'workspaces', label: 'Workspaces' },
  { key: 'agencies', label: 'Agencies' },
  { key: 'maxMembers', label: 'Max members' },
];

const PricingAdmin: React.FC = () => {
  const a = useAdmin();
  const isSuper = a.profile?.role === 'super_admin';
  const [cfg, setCfg] = useState<PricingConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { getLivePricingConfig().then(setCfg); }, []);
  if (!cfg) return <p className="text-sm text-gray-400 py-10 text-center font-medium">Loading pricing…</p>;

  const setPlan = (tier: Tier, key: string, val: number) =>
    setCfg((c) => ({ ...c!, plans: { ...c!.plans, [tier]: { ...c!.plans[tier], [key]: val } } }));
  const setExp = (key: 'member' | 'workspace' | 'agency', val: number) =>
    setCfg((c) => ({ ...c!, expansion: { ...c!.expansion, [key]: val } }));
  const setTool = (mod: string, val: number) =>
    setCfg((c) => ({ ...c!, toolCosts: { ...c!.toolCosts, [mod]: val } }));
  const setPack = (i: number, key: 'tokens', val: number) =>
    setCfg((c) => ({ ...c!, tokenPacks: c!.tokenPacks.map((p, idx) => (idx === i ? { ...p, [key]: val } : p)) }));

  const save = async () => {
    setBusy(true); setMsg('');
    try { await callUpdatePricingConfig(withCodePrices(cfg)); setMsg('Saved. New values take effect within ~1 minute.'); }
    catch (e: any) { setMsg(e.message || 'Save failed.'); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <AdminSectionHeader title="Pricing & Plans" subtitle="Edit token allowances, limits, expansion pricing, pack sizes and tool costs." />
      {!isSuper && <p className="text-xs font-bold text-amber-600 uppercase tracking-widest">Read-only — super-admin required to save.</p>}

      <Card title="Plans">
        <p className="text-xs font-medium text-gray-500 mb-4">{PRICES_NOTE}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400 text-left">
                <th className="py-2 pr-4">Plan</th><th className="py-2 pr-4">Price ($/mo · ₦/30 days)</th><th className="py-2 pr-4">Monthly tokens</th>
                {limitKeys.map((l) => <th key={l.key as string} className="py-2 pr-4">{l.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {PLAN_ORDER.map((tier) => {
                const p = cfg.plans[tier] as any;
                return (
                  <tr key={tier} className="border-t border-gray-100">
                    <td className="py-3 pr-4 font-bold text-[#0B0B0B]">{PLAN_META[tier].name}</td>
                    <td className="py-3 pr-4 font-bold text-gray-700 tabular-nums whitespace-nowrap" title={PRICES_NOTE}>
                      {codePrice(DEFAULT_PRICING_CONFIG.plans[tier]?.price, DEFAULT_PRICING_CONFIG.plans[tier]?.priceNgn)}
                    </td>
                    <td className="py-3 pr-4"><NumInput value={p.monthlyTokens} onChange={(v) => setPlan(tier, 'monthlyTokens', v)} disabled={!isSuper} /></td>
                    {limitKeys.map((l) => (
                      <td key={l.key as string} className="py-3 pr-4">
                        {p[l.key] !== undefined ? <NumInput value={p[l.key]} onChange={(v) => setPlan(tier, l.key as string, v)} disabled={!isSuper} w="w-20" /> : <span className="text-gray-300">—</span>}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Expansion pricing ($/mo each)">
          <div className="space-y-3">
            {([['member', 'Extra member seat'], ['workspace', 'Extra workspace'], ['agency', 'Extra agency']] as const).map(([k, label]) => (
              <div key={k} className="flex items-center justify-between"><span className="text-sm font-medium text-gray-700">{label}</span><NumInput value={(cfg.expansion as any)[k]} onChange={(v) => setExp(k, v)} disabled={!isSuper} w="w-20" /></div>
            ))}
          </div>
        </Card>

        <Card title="Token packs">
          <p className="text-xs font-medium text-gray-500 mb-4">{PRICES_NOTE}</p>
          <div className="space-y-3">
            {cfg.tokenPacks.map((pk, i) => {
              const d = DEFAULT_PRICING_CONFIG.tokenPacks.find((x) => x.id === pk.id);
              return (
                <div key={pk.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-gray-700 flex-1 truncate">{pk.label}</span>
                  <NumInput value={pk.tokens} onChange={(v) => setPack(i, 'tokens', v)} disabled={!isSuper} />
                  <span className="text-[10px] text-gray-400 uppercase">tokens</span>
                  <span className="text-sm font-bold text-gray-700 tabular-nums whitespace-nowrap" title={PRICES_NOTE}>
                    {d ? codePrice(d.price, d.priceNgn) : 'Not for sale'}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card title="Per-tool token costs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.keys(cfg.toolCosts).map((mod) => (
            <div key={mod} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-[11px] font-medium text-gray-600 truncate">{mod}</span>
              <NumInput value={cfg.toolCosts[mod]} onChange={(v) => setTool(mod, v)} disabled={!isSuper} w="w-16" />
            </div>
          ))}
        </div>
      </Card>

      <div className="flex items-center gap-4">
        <button onClick={save} disabled={busy || !isSuper} className="px-8 py-3 rounded-2xl bg-[#E00000] text-white text-[11px] font-bold uppercase tracking-widest disabled:opacity-40">{busy ? 'Saving…' : 'Save pricing'}</button>
        {msg && <span className="text-sm font-semibold text-[#0B0B0B]">{msg}</span>}
      </div>
    </div>
  );
};

export default PricingAdmin;
