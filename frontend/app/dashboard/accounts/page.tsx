"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  ApiError,
  createPaymentAccount,
  getAccessToken,
  getPaymentAccounts,
  removeAccessToken,
  updatePaymentAccount,
} from "@/lib/api";
import type {
  PaymentAccount,
  PaymentAccountCreate,
  PaymentAccountType,
} from "@/types/payment-account";

const emptyForm: PaymentAccountCreate = {
  name: "",
  account_type: "vodafone",
  account_number: "",
  account_holder_name: "",
  daily_limit: 50000,
  monthly_limit: 500000,
  warning_threshold: 80,
  critical_threshold: 90,
  is_active: true,
  priority: 1,
};

function numberValue(value: number | string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number | string): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(numberValue(value));
}

function ProgressBar({ value }: { value: number | string }) {
  const percent = Math.min(100, Math.max(0, numberValue(value)));
  const tone = percent >= 90 ? "bg-red-500" : percent >= 80 ? "bg-amber-400" : "bg-blue-600";

  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
      <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${percent}%` }} />
    </div>
  );
}

function AccountIcon({ type }: { type: PaymentAccountType }) {
  return (
    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-black text-white shadow-lg ${type === "vodafone" ? "bg-red-600 shadow-red-200" : "bg-indigo-600 shadow-indigo-200"}`}>
      {type === "vodafone" ? "V" : "I"}
    </div>
  );
}

export default function PaymentAccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PaymentAccountCreate>(emptyForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadAccounts = useCallback(async (refresh = false) => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }

    if (refresh) setIsRefreshing(true);
    setError("");

    try {
      setAccounts(await getPaymentAccounts());
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        removeAccessToken();
        router.replace("/login");
        return;
      }
      setError(requestError instanceof Error ? requestError.message : "Could not load payment accounts.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadAccounts();
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, [loadAccounts]);

  const totals = useMemo(() => ({
    active: accounts.filter((item) => item.is_active).length,
    usedToday: accounts.reduce((sum, item) => sum + numberValue(item.used_today), 0),
    remainingToday: accounts.reduce((sum, item) => sum + numberValue(item.remaining_today), 0),
  }), [accounts]);

  async function submitAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      await createPaymentAccount(form);
      setForm(emptyForm);
      setShowForm(false);
      setSuccess("Payment account added successfully.");
      await loadAccounts(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not add the account.");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleAccount(account: PaymentAccount) {
    setError("");
    setSuccess("");
    try {
      await updatePaymentAccount(account.id, { is_active: !account.is_active });
      setSuccess(`${account.name} ${account.is_active ? "disabled" : "activated"}.`);
      await loadAccounts(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not update the account.");
    }
  }

  if (isLoading) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-100"><div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-blue-700" /></main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-xl text-slate-700 transition hover:bg-slate-50" aria-label="Back to dashboard">←</Link>
            <div><p className="text-xs font-black uppercase tracking-[0.28em] text-blue-700">RUBWAY CONTROL</p><h1 className="mt-1 text-xl font-black sm:text-2xl">Payment Accounts</h1></div>
          </div>
          <button onClick={() => setShowForm(true)} className="rounded-xl bg-[#0D1B2A] px-4 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-[#1E3A8A]">+ Add account</button>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8">
        <section className="mb-7 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Active accounts</p><p className="mt-2 text-3xl font-black">{totals.active}</p></div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Used today</p><p className="mt-2 text-3xl font-black">{money(totals.usedToday)} <span className="text-base text-slate-400">EGP</span></p></div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Available today</p><p className="mt-2 text-3xl font-black text-emerald-600">{money(totals.remainingToday)} <span className="text-base text-slate-400">EGP</span></p></div>
        </section>

        {error && <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">{error}</div>}
        {success && <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">{success}</div>}

        <div className="mb-6 flex items-end justify-between gap-4"><div><h2 className="text-2xl font-black">Receiving accounts</h2><p className="mt-1 text-sm text-slate-500">Daily and monthly capacity is calculated automatically from confirmed transfers.</p></div><button onClick={() => void loadAccounts(true)} disabled={isRefreshing} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{isRefreshing ? "Refreshing..." : "Refresh"}</button></div>

        {accounts.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-3xl">💳</div><h3 className="mt-5 text-xl font-black">No payment accounts yet</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Add your first Vodafone Cash or InstaPay account. RUBWAY will use it automatically for new transfers.</p><button onClick={() => setShowForm(true)} className="mt-6 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800">Add first account</button></section>
        ) : (
          <section className="grid gap-5 lg:grid-cols-2">
            {accounts.map((account) => (
              <article key={account.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-4"><AccountIcon type={account.account_type} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-lg font-black">{account.name}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${account.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{account.is_active ? "Active" : "Paused"}</span></div><p className="mt-1 text-sm font-semibold text-slate-500">{account.masked_account_number} · {account.account_holder_name}</p></div></div>
                  <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">Priority {account.priority}</span>
                </div>

                <div className="mt-6 space-y-6">
                  <div><div className="mb-2 flex items-center justify-between gap-3 text-sm"><span className="font-bold text-slate-700">Today</span><span className="font-black">{money(account.used_today)} / {money(account.daily_limit)} EGP</span></div><ProgressBar value={account.daily_usage_percent} /><div className="mt-2 flex justify-between text-xs text-slate-500"><span>{money(account.daily_usage_percent)}% used</span><span>{money(account.remaining_today)} remaining</span></div></div>
                  <div><div className="mb-2 flex items-center justify-between gap-3 text-sm"><span className="font-bold text-slate-700">This month</span><span className="font-black">{money(account.used_this_month)} / {money(account.monthly_limit)} EGP</span></div><ProgressBar value={account.monthly_usage_percent} /><div className="mt-2 flex justify-between text-xs text-slate-500"><span>{money(account.monthly_usage_percent)}% used</span><span>{money(account.remaining_this_month)} remaining</span></div></div>
                </div>

                <div className="mt-6 flex gap-3 border-t border-slate-100 pt-5"><button onClick={() => void toggleAccount(account)} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition ${account.is_active ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}>{account.is_active ? "Pause account" : "Activate account"}</button></div>
              </article>
            ))}
          </section>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}>
          <form onSubmit={submitAccount} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.25em] text-blue-700">NEW RECEIVING METHOD</p><h2 className="mt-2 text-2xl font-black">Add payment account</h2><p className="mt-2 text-sm text-slate-500">The account will become available for automatic selection immediately.</p></div><button type="button" onClick={() => setShowForm(false)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-xl">×</button></div>

            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <label className="text-sm font-bold text-slate-700">Account type<select value={form.account_type} onChange={(e) => setForm({ ...form, account_type: e.target.value as PaymentAccountType })} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-600"><option value="vodafone">Vodafone Cash</option><option value="instapay">InstaPay</option></select></label>
              <label className="text-sm font-bold text-slate-700">Display name<input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Vodafone Cash 1" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600" /></label>
              <label className="text-sm font-bold text-slate-700">Account number<input required minLength={5} value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} placeholder="01000000000" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600" /></label>
              <label className="text-sm font-bold text-slate-700">Account holder<input required minLength={2} value={form.account_holder_name} onChange={(e) => setForm({ ...form, account_holder_name: e.target.value })} placeholder="Ahmed Haggag" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600" /></label>
              <label className="text-sm font-bold text-slate-700">Daily limit (EGP)<input required min={1} type="number" value={form.daily_limit} onChange={(e) => setForm({ ...form, daily_limit: Number(e.target.value) })} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600" /></label>
              <label className="text-sm font-bold text-slate-700">Monthly limit (EGP)<input required min={1} type="number" value={form.monthly_limit} onChange={(e) => setForm({ ...form, monthly_limit: Number(e.target.value) })} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600" /></label>
              <label className="text-sm font-bold text-slate-700">Warning at %<input required min={1} max={99} type="number" value={form.warning_threshold} onChange={(e) => setForm({ ...form, warning_threshold: Number(e.target.value) })} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600" /></label>
              <label className="text-sm font-bold text-slate-700">Critical at %<input required min={1} max={100} type="number" value={form.critical_threshold} onChange={(e) => setForm({ ...form, critical_threshold: Number(e.target.value) })} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600" /></label>
              <label className="text-sm font-bold text-slate-700 sm:col-span-2">Selection priority<input required min={1} type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600" /><span className="mt-1 block text-xs font-normal text-slate-500">Lower number is selected first.</span></label>
            </div>

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700">Cancel</button><button disabled={isSaving} type="submit" className="rounded-xl bg-blue-700 px-6 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60">{isSaving ? "Saving..." : "Add account"}</button></div>
          </form>
        </div>
      )}
    </main>
  );
}
