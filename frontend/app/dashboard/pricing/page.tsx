"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  ApiError,
  getAccessToken,
  getPricingSettings,
  removeAccessToken,
  updatePricingSettings,
} from "@/lib/api";

export default function PricingPage() {
  const router = useRouter();
  const [instapayRate, setInstapayRate] = useState("");
  const [vodafoneRate, setVodafoneRate] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }

    getPricingSettings()
      .then((data) => {
        setInstapayRate(String(data.instapay_rate));
        setVodafoneRate(String(data.vodafone_rate));
        setUpdatedAt(data.updated_at);
      })
      .catch((requestError) => {
        if (requestError instanceof ApiError && requestError.status === 401) {
          removeAccessToken();
          router.replace("/login");
          return;
        }
        setError(requestError instanceof Error ? requestError.message : "Could not load pricing.");
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function save(event: FormEvent) {
    event.preventDefault();
    const insta = Number(instapayRate);
    const voda = Number(vodafoneRate);
    if (!Number.isFinite(insta) || insta <= 0 || !Number.isFinite(voda) || voda <= 0) {
      setError("أدخل سعرًا صحيحًا أكبر من صفر.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const data = await updatePricingSettings({ instapay_rate: insta, vodafone_rate: voda });
      setUpdatedAt(data.updated_at);
      setSuccess("تم حفظ السعر الجديد. كل عروض الأسعار الجديدة ستستخدمه فورًا.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not save pricing.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-100"><div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-blue-700" /></main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-5 py-5 sm:px-8">
          <Link href="/dashboard" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200">←</Link>
          <div><p className="text-xs font-black uppercase tracking-[0.28em] text-blue-700">RUBWAY CONTROL</p><h1 className="mt-1 text-2xl font-black">Manual Pricing</h1></div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-2xl font-black">تحديد السعر يدويًا</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">السعر هنا يعني عدد الروبلات التي يحصل عليها العميل مقابل 1 جنيه مصري. أي طلب سعر جديد سيستخدم القيمة المحفوظة فورًا.</p>

          {error && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">{error}</div>}
          {success && <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">{success}</div>}

          <form onSubmit={save} className="mt-8 grid gap-6 sm:grid-cols-2">
            <label className="text-sm font-bold text-slate-700">سعر InstaPay
              <input type="number" required min="0.0001" step="0.0001" value={instapayRate} onChange={(e) => setInstapayRate(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-lg font-black outline-none focus:border-blue-600" />
              <span className="mt-2 block text-xs font-normal text-slate-500">مثال: 1.6500 RUB لكل 1 EGP</span>
            </label>
            <label className="text-sm font-bold text-slate-700">سعر Vodafone Cash
              <input type="number" required min="0.0001" step="0.0001" value={vodafoneRate} onChange={(e) => setVodafoneRate(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-lg font-black outline-none focus:border-blue-600" />
              <span className="mt-2 block text-xs font-normal text-slate-500">يمكن أن يكون مختلفًا حسب تكاليف طريقة الدفع.</span>
            </label>
            <div className="sm:col-span-2 flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">آخر تحديث: {updatedAt ? new Date(updatedAt).toLocaleString() : "—"}</p>
              <button disabled={saving} className="rounded-xl bg-[#0D1B2A] px-7 py-3 font-black text-white hover:bg-blue-900 disabled:opacity-50">{saving ? "جارٍ الحفظ..." : "حفظ السعر"}</button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
