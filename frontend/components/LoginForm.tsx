"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import {
  ApiError,
  getAccessToken,
  getAdminProfile,
  loginAdmin,
  saveAccessToken,
} from "@/lib/api";


export default function LoginForm() {
  const router = useRouter();

  const [username, setUsername] =
    useState("admin");

  const [password, setPassword] =
    useState("");

  const [error, setError] =
    useState("");

  const [isLoading, setIsLoading] =
    useState(false);

  const [isCheckingSession, setIsCheckingSession] =
    useState(true);


  useEffect(() => {
    async function checkExistingSession() {
      const token = getAccessToken();

      if (!token) {
        setIsCheckingSession(false);
        return;
      }

      try {
        await getAdminProfile(token);

        router.replace(
          "/dashboard",
        );
      } catch {
        localStorage.removeItem(
          "rubway_admin_access_token",
        );

        setIsCheckingSession(false);
      }
    }

    void checkExistingSession();
  }, [router]);


  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const normalizedUsername =
      username.trim();

    if (!normalizedUsername) {
      setError(
        "Please enter your username.",
      );

      return;
    }

    if (!password) {
      setError(
        "Please enter your password.",
      );

      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const loginResult =
        await loginAdmin(
          normalizedUsername,
          password,
        );

      saveAccessToken(
        loginResult.access_token,
      );

      await getAdminProfile(
        loginResult.access_token,
      );

      router.replace(
        "/dashboard",
      );
    } catch (requestError) {
      if (
        requestError instanceof ApiError
      ) {
        if (
          requestError.status === 401
        ) {
          setError(
            "Incorrect username or password.",
          );
        } else {
          setError(
            requestError.message,
          );
        }
      } else {
        setError(
          "Could not connect to the server.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  }


  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-400" />

          <p className="mt-4 text-sm text-slate-400">
            Checking session...
          </p>
        </div>
      </div>
    );
  }


  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      <div className="absolute left-[-100px] top-[-100px] h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />

      <div className="absolute bottom-[-120px] right-[-80px] h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl lg:grid-cols-2">
        <section className="hidden bg-slate-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />

              <span className="ml-2 text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
                RUBWAY
              </span>
            </div>

            <h1 className="mt-10 max-w-md text-4xl font-bold leading-tight">
              Manage transfers between Egypt and Russia.
            </h1>

            <p className="mt-5 max-w-md leading-7 text-slate-400">
              Review receipts, approve payments and follow every transfer from creation to completion.
            </p>
          </div>

          <div className="border-t border-white/10 pt-6">
            <p className="text-sm text-slate-500">
              Secure administration dashboard
            </p>
          </div>
        </section>

        <section className="p-7 sm:p-10 lg:p-12">
          <div className="mb-9">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-emerald-600 lg:hidden">
              RUBWAY
            </p>

            <h2 className="mt-3 text-3xl font-bold text-slate-900">
              Welcome back
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Enter your admin credentials to continue.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            noValidate
          >
            <label
              htmlFor="username"
              className="block text-sm font-semibold text-slate-700"
            >
              Username
            </label>

            <input
              id="username"
              name="username"
              type="text"
              value={username}
              onChange={(event) =>
                setUsername(
                  event.target.value,
                )
              }
              autoComplete="username"
              disabled={isLoading}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:bg-slate-100"
              placeholder="admin"
            />

            <label
              htmlFor="password"
              className="mt-5 block text-sm font-semibold text-slate-700"
            >
              Password
            </label>

            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value,
                )
              }
              autoComplete="current-password"
              disabled={isLoading}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:bg-slate-100"
              placeholder="Enter your password"
            />

            {error && (
              <div
                role="alert"
                className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="mt-7 flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3.5 font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-900/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <span className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />

                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400">
            Authorized administrators only
          </p>
        </section>
      </div>
    </main>
  );
}