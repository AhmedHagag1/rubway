"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";
import Link from "next/link";

import StatisticsCards from "@/components/StatisticsCards";
import TransferTable from "@/components/TransferTable";

import type {
  AdminProfile,
} from "@/types/auth";

import type {
  Transfer,
  TransferStatistics,
} from "@/types/transfer";

import {
  ApiError,
  getAccessToken,
  getAdminProfile,
  getTransfers,
  removeAccessToken,
} from "@/lib/api";


export default function DashboardPage() {
  const router = useRouter();

  const [
    profile,
    setProfile,
  ] = useState<AdminProfile | null>(
    null,
  );

  const [
    transfers,
    setTransfers,
  ] = useState<Transfer[]>([]);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isRefreshing,
    setIsRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");


  const statistics =
    useMemo<TransferStatistics>(
      () => ({
        total: transfers.length,

        pending: transfers.filter(
          (transfer) =>
            transfer.status ===
            "pending_payment",
        ).length,

        receiptUploaded:
          transfers.filter(
            (transfer) =>
              transfer.status ===
              "payment_proof_uploaded",
          ).length,

        approved: transfers.filter(
          (transfer) =>
            transfer.status ===
              "waiting_recipient" ||
            transfer.status ===
              "ready_to_send" ||
            transfer.status ===
              "rub_sent",
        ).length,

        completed: transfers.filter(
          (transfer) =>
            transfer.status ===
            "completed",
        ).length,

        rejected: transfers.filter(
          (transfer) =>
            transfer.status ===
            "rejected",
        ).length,
      }),
      [transfers],
    );


  const loadDashboard =
    useCallback(
      async (
        showRefreshLoader = false,
      ) => {
        const token =
          getAccessToken();

        if (!token) {
          router.replace("/login");
          return;
        }

        if (showRefreshLoader) {
          setIsRefreshing(true);
        }

        setError("");

        try {
          const [
            adminProfile,
            transferList,
          ] = await Promise.all([
            getAdminProfile(token),
            getTransfers(),
          ]);

          setProfile(adminProfile);
          setTransfers(transferList);
        } catch (requestError) {
          if (
            requestError instanceof
              ApiError &&
            requestError.status === 401
          ) {
            removeAccessToken();
            router.replace("/login");
            return;
          }

          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load dashboard data.",
          );
        } finally {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      },
      [router],
    );


  useEffect(() => {
    const timeoutId =
      window.setTimeout(() => {
        void loadDashboard();
      }, 0);

    return () => {
      window.clearTimeout(
        timeoutId,
      );
    };
  }, [loadDashboard]);


  function handleLogout() {
    removeAccessToken();
    router.replace("/login");
  }


  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />

          <p className="mt-4 text-sm text-slate-500">
            Loading dashboard...
          </p>
        </div>
      </main>
    );
  }


  if (!profile) {
    return null;
  }


  return (
    <main className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-5 py-4 sm:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-emerald-600">
              RUBWAY
            </p>

            <h1 className="mt-1 text-xl font-bold text-slate-950 sm:text-2xl">
              Admin Dashboard
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/accounts"
              className="hidden rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 sm:inline-flex"
            >
              Payment accounts
            </Link>

            <button
              type="button"
              onClick={() =>
                void loadDashboard(true)
              }
              disabled={isRefreshing}
              className="hidden rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 sm:inline-flex"
            >
              {isRefreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>

            <div className="hidden text-right md:block">
              <p className="text-sm font-semibold text-slate-900">
                {profile.username}
              </p>

              <p className="text-xs capitalize text-slate-500">
                {profile.role}
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-5 py-8 sm:px-8">
        <section className="mb-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                Transfer overview
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Monitor customer payments and manage every transfer from one place.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadDashboard(true)
              }
              disabled={isRefreshing}
              className="inline-flex justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:hidden"
            >
              {isRefreshing
                ? "Refreshing..."
                : "Refresh transfers"}
            </button>
          </div>
        </section>

        {error && (
          <div
            role="alert"
            className="mb-6 flex flex-col gap-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between"
          >
            <p>{error}</p>

            <button
              type="button"
              onClick={() =>
                void loadDashboard(true)
              }
              className="font-bold underline underline-offset-4"
            >
              Try again
            </button>
          </div>
        )}

        <StatisticsCards
          statistics={statistics}
        />

        <div className="mt-8">
          <TransferTable
            transfers={transfers}
            onRefresh={async () => {
              await loadDashboard(true);
            }}
          />
        </div>
      </div>
    </main>
  );
}