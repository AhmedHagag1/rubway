"use client";

import Image from "next/image";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ApiError,
  addRecipientDetails,
  createCustomerTransfer,
  createTransferQuote,
  getTransferTracking,
  uploadTransferReceipt,
} from "@/lib/api";

import type {
  CustomerTransfer,
  CustomerTransferStatus,
  PaymentMethod,
  TransferQuote,
  TransferTracking,
} from "@/types/customer-transfer";


type AmountDirection = "rub" | "egp";

type PageStep =
  | "calculator"
  | "customer"
  | "receipt"
  | "tracking";


const QUOTE_DURATION_SECONDS = 15 * 60;
const TRACKING_INTERVAL_MS = 7000;



function formatMoney(
  value: string | number,
  currency: "RUB" | "EGP",
): string {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return `0.00 ${currency}`;
  }

  return `${new Intl.NumberFormat(
    currency === "RUB" ? "ru-RU" : "en-EG",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  ).format(numericValue)} ${currency}`;
}


function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds,
  ).padStart(2, "0")}`;
}


function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "حدث خطأ غير متوقع. حاول مرة أخرى.";
}


function statusLabel(status: CustomerTransferStatus): string {
  const labels: Record<CustomerTransferStatus, string> = {
    pending_payment: "بانتظار رفع الإيصال",
    payment_proof_uploaded: "الإيصال قيد المراجعة",
    payment_confirmed: "تم تأكيد الدفع",
    waiting_recipient: "مطلوب بيانات المستلم",
    ready_to_send: "جاهز لإرسال الروبل",
    rub_sent: "تم إرسال الروبل",
    completed: "اكتملت العملية",
    rejected: "تم رفض الطلب",
  };

  return labels[status];
}


function statusDescription(status: CustomerTransferStatus): string {
  const descriptions: Record<CustomerTransferStatus, string> = {
    pending_payment: "ارفع إيصال الدفع حتى يبدأ فريق RUBWAY المراجعة.",
    payment_proof_uploaded:
      "استلمنا الإيصال ويقوم فريقنا الآن بمراجعة بيانات الدفع.",
    payment_confirmed: "تم تأكيد دفعتك وجارٍ تجهيز الخطوة التالية.",
    waiting_recipient:
      "أدخل بيانات الشخص الذي سيستلم الروبل في روسيا.",
    ready_to_send:
      "وصلتنا بيانات المستلم، والتحويل جاهز للتنفيذ.",
    rub_sent: "تم إرسال الروبل إلى بيانات المستلم المسجلة.",
    completed: "تمت العملية بنجاح. شكرًا لاستخدام RUBWAY.",
    rejected: "تعذر إكمال الطلب. راجع سبب الرفض بالأسفل.",
  };

  return descriptions[status];
}


export default function HomePage() {
  const [step, setStep] = useState<PageStep>("calculator");
  const [amountDirection, setAmountDirection] =
    useState<AmountDirection>("egp");
  const [amount, setAmount] = useState("10000");
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("instapay");
  const [quote, setQuote] = useState<TransferQuote | null>(null);
  const [transfer, setTransfer] =
    useState<CustomerTransfer | null>(null);
  const [tracking, setTracking] =
    useState<TransferTracking | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");

  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [bankName, setBankName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [sbpPhone, setSbpPhone] = useState("");

  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] =
    useState<string | null>(null);
  const receiptPreviewRef = useRef<string | null>(null);

  const [remainingSeconds, setRemainingSeconds] = useState(
    QUOTE_DURATION_SECONDS,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [chatAnswer, setChatAnswer] = useState("مرحبًا بك في RUBWAY 👋 اختر سؤالك وسأساعدك فورًا.");

  const quoteExpired = remainingSeconds <= 0;
  const canCreateQuote = Number(amount) > 0 && !isLoading;

  const currentStatus =
    tracking?.status ?? transfer?.status ?? "pending_payment";

  const selectedMethodLabel =
    paymentMethod === "instapay" ? "InstaPay" : "Vodafone Cash";

  const progressWidth = useMemo(() => {
    const stepIndex: Record<PageStep, number> = {
      calculator: 1,
      customer: 2,
      receipt: 3,
      tracking: 4,
    };

    return `${stepIndex[step] * 25}%`;
  }, [step]);


  useEffect(() => {
    if (!quote || step === "tracking") {
      return;
    }

    const expiresAt = new Date(quote.expires_at).getTime();

    const updateTimer = () => {
      setRemainingSeconds(
        Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)),
      );
    };

    updateTimer();
    const interval = window.setInterval(updateTimer, 1000);

    return () => window.clearInterval(interval);
  }, [quote, step]);


  useEffect(() => {
    return () => {
      if (receiptPreviewRef.current) {
        URL.revokeObjectURL(receiptPreviewRef.current);
      }
    };
  }, []);


  useEffect(() => {
    if (step !== "tracking" || !transfer) {
      return;
    }

    let cancelled = false;

    const refresh = async () => {
      try {
        const result = await getTransferTracking(transfer.id);

        if (!cancelled) {
          setTracking(result);
          setErrorMessage("");
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(getErrorMessage(error));
        }
      }
    };

    void refresh();
    const interval = window.setInterval(refresh, TRACKING_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [step, transfer]);


  async function handleCreateQuote(event: FormEvent) {
    event.preventDefault();
    setErrorMessage("");

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setErrorMessage("أدخل مبلغًا صحيحًا أكبر من صفر.");
      return;
    }

    setIsLoading(true);

    try {
      const result = await createTransferQuote({
        payment_method: paymentMethod,
        rub_amount: amountDirection === "rub" ? amount : null,
        egp_amount: amountDirection === "egp" ? amount : null,
      });

      setQuote(result);
      setRemainingSeconds(result.valid_for_seconds);
      setStep("customer");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }


  async function handleCreateTransfer(event: FormEvent) {
    event.preventDefault();
    setErrorMessage("");

    if (!quote) {
      setErrorMessage("السعر غير متوفر. أنشئ عرض سعر جديد.");
      setStep("calculator");
      return;
    }

    if (quoteExpired) {
      setErrorMessage("انتهت صلاحية السعر. أنشئ عرض سعر جديد.");
      setStep("calculator");
      return;
    }

    if (customerName.trim().length < 2) {
      setErrorMessage("أدخل اسم العميل.");
      return;
    }

    if (customerPhone.trim().length < 7) {
      setErrorMessage("أدخل رقم هاتف صحيح.");
      return;
    }

    if (recipientName.trim().length < 2 || recipientPhone.trim().length < 7 || bankName.trim().length < 2) {
      setErrorMessage("أكمل اسم المستلم ورقمه واسم البنك الروسي.");
      return;
    }

    if (!cardNumber.trim() && !accountNumber.trim() && !sbpPhone.trim()) {
      setErrorMessage("أدخل رقم البطاقة أو الحساب أو رقم SBP للمستلم.");
      return;
    }

    setIsLoading(true);

    try {
      const result = await createCustomerTransfer({
        quote_id: quote.quote_id,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        telegram_username: telegramUsername.trim() || null,
        recipient: {
          recipient_name: recipientName.trim(),
          recipient_phone: recipientPhone.trim(),
          bank_name: bankName.trim(),
          card_number: cardNumber.trim() || null,
          account_number: accountNumber.trim() || null,
          sbp_phone: sbpPhone.trim() || null,
        },
      });

      setTransfer(result);
      setStep("receipt");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }


  async function handleReceiptUpload(event: FormEvent) {
    event.preventDefault();
    setErrorMessage("");

    if (!transfer) {
      setErrorMessage("لم يتم العثور على التحويل.");
      return;
    }

    if (!receipt) {
      setErrorMessage("اختر صورة أو ملف الإيصال.");
      return;
    }

    setIsLoading(true);

    try {
      const result = await uploadTransferReceipt(transfer.id, receipt);

      setTransfer({
        ...transfer,
        status: result.status,
        receipt_path: result.receipt_path,
      });

      setTracking({
        transfer_id: transfer.id,
        customer_phone: transfer.customer_phone,
        rub_amount: transfer.rub_amount,
        egp_amount: transfer.egp_amount,
        payment_method: transfer.payment_method,
        status: result.status,
        has_receipt: true,
        has_recipient_details: true,
        rejection_reason: null,
        created_at: transfer.created_at,
        updated_at: transfer.updated_at,
      });

      setStep("tracking");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }


  async function handleRecipientSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage("");

    if (!transfer) {
      setErrorMessage("لم يتم العثور على التحويل.");
      return;
    }

    if (recipientName.trim().length < 2) {
      setErrorMessage("أدخل اسم المستلم كما هو مسجل لدى البنك.");
      return;
    }

    if (
      !cardNumber.trim() &&
      !accountNumber.trim() &&
      !sbpPhone.trim()
    ) {
      setErrorMessage(
        "أدخل رقم البطاقة أو رقم الحساب أو رقم الهاتف المرتبط بـ SBP.",
      );
      return;
    }

    setIsLoading(true);

    try {
      await addRecipientDetails(transfer.id, {
        recipient_name: recipientName.trim(),
        recipient_phone: recipientPhone.trim() || null,
        bank_name: bankName.trim() || null,
        card_number: cardNumber.trim() || null,
        account_number: accountNumber.trim() || null,
        sbp_phone: sbpPhone.trim() || null,
      });

      const updated = await getTransferTracking(transfer.id);
      setTracking(updated);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }


  async function refreshTracking() {
    if (!transfer) {
      return;
    }

    setIsRefreshingStatus(true);
    setErrorMessage("");

    try {
      const result = await getTransferTracking(transfer.id);
      setTracking(result);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsRefreshingStatus(false);
    }
  }


  function clearReceiptPreview() {
    if (receiptPreviewRef.current) {
      URL.revokeObjectURL(receiptPreviewRef.current);
      receiptPreviewRef.current = null;
    }

    setReceiptPreview(null);
  }


  function removeReceipt() {
    clearReceiptPreview();
    setReceipt(null);
  }


  function handleReceiptChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      removeReceipt();
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("حجم الملف يجب ألا يتجاوز 10 ميجابايت.");
      event.target.value = "";
      removeReceipt();
      return;
    }

    clearReceiptPreview();

    if (file.type.startsWith("image/")) {
      const previewUrl = URL.createObjectURL(file);
      receiptPreviewRef.current = previewUrl;
      setReceiptPreview(previewUrl);
    }

    setErrorMessage("");
    setReceipt(file);
  }


  function resetFlow() {
    setStep("calculator");
    setQuote(null);
    setTransfer(null);
    setTracking(null);
    setCustomerName("");
    setCustomerPhone("");
    setTelegramUsername("");
    setRecipientName("");
    setRecipientPhone("");
    setBankName("");
    setCardNumber("");
    setAccountNumber("");
    setSbpPhone("");
    removeReceipt();
    setErrorMessage("");
    setRemainingSeconds(QUOTE_DURATION_SECONDS);
  }


  return (
    <main id="top" className="min-h-screen overflow-x-hidden bg-[#F1F5F9] text-[#0D1B2A]">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#071426]/90 text-white shadow-2xl backdrop-blur-2xl">
        <div className="mx-auto flex min-h-20 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a href="#top" className="flex min-w-0 items-center gap-3" aria-label="RUBWAY home">
            <Image
              src="/rubway-logo-dark.jpg"
              alt="RUBWAY"
              width={490}
              height={140}
              priority
              sizes="(max-width: 640px) 205px, 245px"
              className="h-12 w-auto max-w-[205px] rounded-xl object-cover object-left shadow-lg sm:h-14 sm:max-w-[245px]"
            />
          </a>
          <nav className="hidden items-center gap-7 text-sm font-bold lg:flex" aria-label="التنقل الرئيسي">
            <a href="#transfer" className="nav-link">ابدأ التحويل</a>
            <a href="#why" className="nav-link">لماذا RUBWAY</a>
            <a href="#how" className="nav-link">كيفية التحويل</a>
            <a href="#support" className="nav-link">الدعم</a>
            <a href="#faq" className="nav-link">الأسئلة الشائعة</a>
          </nav>
          <div className="flex items-center gap-2">
            <a href="#transfer" className="hidden rounded-xl bg-[#F2B705] px-5 py-3 text-sm font-black text-[#0D1B2A] shadow-lg shadow-amber-500/25 transition hover:-translate-y-0.5 hover:brightness-105 sm:inline-flex">ابدأ الآن</a>
            <a href="/login" className="hidden rounded-xl border border-[#F2B705]/70 px-4 py-2.5 text-sm font-bold text-[#F2B705] transition hover:bg-[#F2B705] hover:text-[#0D1B2A] md:inline-flex">دخول الإدارة</a>
            <button type="button" aria-label="فتح القائمة" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen((value) => !value)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-xl lg:hidden">
              {mobileMenuOpen ? "×" : "☰"}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <nav className="border-t border-white/10 bg-[#071426]/98 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 lg:hidden" aria-label="قائمة الهاتف">
            <div className="mx-auto grid max-w-7xl gap-2">
              {[['#transfer','ابدأ التحويل'],['#why','لماذا RUBWAY'],['#how','كيفية التحويل'],['#support','الدعم'],['#faq','الأسئلة الشائعة']].map(([href,label]) => (
                <a key={href} href={href} onClick={() => setMobileMenuOpen(false)} className="rounded-xl px-4 py-3 font-bold transition hover:bg-white/10 hover:text-[#F2B705]">{label}</a>
              ))}
              <a href="/login" className="mt-1 rounded-xl border border-[#F2B705]/50 px-4 py-3 text-center font-black text-[#F2B705]">دخول الإدارة</a>
            </div>
          </nav>
        )}
      </header>

      <section className="hero-grid relative overflow-hidden bg-gradient-to-b from-[#071426] via-[#0D1B2A] to-[#102844]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 top-12 h-80 w-80 rounded-full bg-[#1E3A8A]/40 blur-3xl" />
          <div className="absolute -right-24 top-40 h-96 w-96 rounded-full bg-[#3B82F6]/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-[#F2B705]/10 blur-3xl" />
        </div>

        <div className="relative mx-auto grid w-full max-w-7xl gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:py-20">
          <div className="pt-4 text-white">
            <span className="inline-flex rounded-full border border-[#F2B705]/40 bg-[#F2B705]/10 px-4 py-2 text-sm font-bold text-[#F2B705]">
              تحويلات EGP وRUB بسهولة
            </span>

            <h1 className="mt-6 max-w-xl text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              حوّل أموالك بين مصر وروسيا
              <span className="block text-[#F2B705]">بسرعة وأمان</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
              احصل على السعر، ارفع إثبات الدفع، وأدخل بيانات المستلم في روسيا. تابع حالة تحويلك لحظة بلحظة من نفس الصفحة.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#transfer" className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-[#F2B705] px-7 font-black text-[#0D1B2A] shadow-xl shadow-amber-500/20 transition hover:-translate-y-1">ابدأ التحويل الآن 🚀</a>
              <button type="button" onClick={() => setChatOpen(true)} className="inline-flex min-h-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-7 font-black text-white transition hover:bg-white/15">اسأل مساعد RUBWAY 🤖</button>
            </div>

            <div className="mt-9 grid max-w-xl grid-cols-3 gap-3">
              <TrustStat value="24/7" label="دعم متواصل" />
              <TrustStat value="15 د" label="صلاحية السعر" />
              <TrustStat value="مباشر" label="تتبع الطلب" />
            </div>

            <div className="mt-9 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
              <p className="text-sm font-bold text-white">حدود التحويل</p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-300">
                <span className="rounded-lg bg-white/10 px-3 py-2">
                  الحد الأدنى: 5,000 RUB
                </span>
                <span className="rounded-lg bg-white/10 px-3 py-2">
                  الحد الأقصى: 50,000 RUB
                </span>
                <span className="rounded-lg bg-white/10 px-3 py-2">
                  صلاحية السعر: 15 دقيقة
                </span>
              </div>
            </div>
          </div>

          <div id="transfer" className="scroll-mt-28 overflow-hidden rounded-[30px] border border-white/60 bg-white shadow-2xl shadow-black/25">
            <div className="border-b border-slate-100 px-6 py-6 sm:px-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-[#1E3A8A]">
                    RUBWAY Transfer
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-[#0D1B2A]">
                    {step === "calculator" && "احسب التحويل"}
                    {step === "customer" && "بيانات العميل"}
                    {step === "receipt" && "رفع الإيصال"}
                    {step === "tracking" && "متابعة التحويل"}
                  </h2>
                </div>

                {quote && step !== "tracking" && (
                  <div
                    className={`rounded-xl px-3 py-2 text-center ${
                      quoteExpired
                        ? "bg-red-50 text-red-700"
                        : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    <p className="text-xs font-bold">صلاحية السعر</p>
                    <p className="mt-0.5 font-mono text-sm font-black">
                      {formatCountdown(remainingSeconds)}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-[#F2B705] via-[#3B82F6] to-[#1E3A8A] transition-all duration-500"
                  style={{ width: progressWidth }}
                />
              </div>

              <div className="mt-3 flex justify-between text-[11px] font-bold text-slate-400">
                <span>السعر</span>
                <span>البيانات</span>
                <span>الإيصال</span>
                <span>المتابعة</span>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              {errorMessage && (
                <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                  {errorMessage}
                </div>
              )}

              {step === "calculator" && (
                <form onSubmit={handleCreateQuote} className="space-y-6">
                  <div>
                    <label className="mb-3 block text-sm font-bold text-slate-800">
                      طريقة الدفع في مصر
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <PaymentMethodButton
                        active={paymentMethod === "instapay"}
                        title="InstaPay"
                        subtitle="تحويل بنكي سريع"
                        icon="🏦"
                        onClick={() => setPaymentMethod("instapay")}
                      />
                      <PaymentMethodButton
                        active={
                          paymentMethod === "vodafone"
                        }
                        title="Vodafone Cash"
                        subtitle="محفظة إلكترونية"
                        icon="📱"
                        onClick={() => setPaymentMethod("vodafone")}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-3 block text-sm font-bold text-slate-800">
                      العملة التي ستدخل مبلغها
                    </label>
                    <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
                      <button
                        type="button"
                        onClick={() => setAmountDirection("egp")}
                        className={`h-12 rounded-xl font-black transition ${
                          amountDirection === "egp"
                            ? "bg-white text-[#0D1B2A] shadow-sm"
                            : "text-slate-400"
                        }`}
                      >
                        أدفع EGP
                      </button>
                      <button
                        type="button"
                        onClick={() => setAmountDirection("rub")}
                        className={`h-12 rounded-xl font-black transition ${
                          amountDirection === "rub"
                            ? "bg-white text-[#0D1B2A] shadow-sm"
                            : "text-slate-400"
                        }`}
                      >
                        أستلم RUB
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="amount" className="mb-3 block text-sm font-bold text-slate-800">
                      المبلغ
                    </label>
                    <div className="relative">
                      <input
                        id="amount"
                        type="number"
                        min="1"
                        step="0.01"
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        className="h-16 w-full rounded-2xl border border-slate-200 bg-white px-5 pl-20 text-xl font-black text-[#0D1B2A] outline-none transition focus:border-[#3B82F6] focus:ring-4 focus:ring-blue-100"
                      />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-black text-slate-600">
                        {amountDirection === "egp" ? "EGP" : "RUB"}
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!canCreateQuote}
                    className="h-14 w-full rounded-2xl bg-gradient-to-l from-[#F2B705] to-[#f59e0b] px-5 font-black text-[#0D1B2A] shadow-lg shadow-amber-500/20 transition hover:brightness-105 disabled:bg-slate-300 disabled:shadow-none"
                  >
                    {isLoading ? "جاري حساب السعر..." : "احصل على السعر"}
                  </button>
                </form>
              )}

              {step === "customer" && quote && (
                <form onSubmit={handleCreateTransfer} className="space-y-6">
                  <QuoteSummary quote={quote} />

                  <InputField
                    id="customerName"
                    label="اسمك الكامل"
                    value={customerName}
                    onChange={setCustomerName}
                    placeholder="الاسم كما يظهر في إثبات الدفع"
                    autoComplete="name"
                  />
                  <InputField
                    id="customerPhone"
                    label="رقم الهاتف"
                    value={customerPhone}
                    onChange={setCustomerPhone}
                    placeholder="مثال: +20 10 1234 5678"
                    autoComplete="tel"
                  />
                  <InputField
                    id="telegramUsername"
                    label="Telegram — اختياري"
                    value={telegramUsername}
                    onChange={setTelegramUsername}
                    placeholder="@username"
                    autoComplete="off"
                  />

                  <div className="rounded-3xl border border-blue-200 bg-blue-50/60 p-5 sm:p-6">
                    <h3 className="text-xl font-black text-[#0D1B2A]">بيانات المستلم في روسيا</h3>
                    <p className="mt-2 text-sm font-bold leading-6 text-slate-600">اكتب البيانات بدقة قبل إنشاء الطلب، وستصل مباشرة إلى إدارة RUBWAY على تيليجرام.</p>
                    <div className="mt-5 space-y-4">
                      <InputField id="recipientName" label="اسم المستلم *" value={recipientName} onChange={setRecipientName} placeholder="الاسم الكامل بالروسية أو الإنجليزية" autoComplete="name" />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <InputField id="bankName" label="اسم البنك الروسي *" value={bankName} onChange={setBankName} placeholder="مثال: Sberbank" autoComplete="off" />
                        <InputField id="recipientPhone" label="هاتف المستلم *" value={recipientPhone} onChange={setRecipientPhone} placeholder="+7 ..." autoComplete="tel" />
                      </div>
                      <InputField id="sbpPhone" label="رقم الهاتف المرتبط بـ SBP" value={sbpPhone} onChange={setSbpPhone} placeholder="+7 ..." autoComplete="tel" />
                      <InputField id="cardNumber" label="رقم البطاقة — اختياري" value={cardNumber} onChange={setCardNumber} placeholder="رقم البطاقة الروسية" autoComplete="cc-number" />
                      <InputField id="accountNumber" label="رقم الحساب — اختياري" value={accountNumber} onChange={setAccountNumber} placeholder="رقم الحساب البنكي" autoComplete="off" />
                      <p className="rounded-xl bg-white px-4 py-3 text-xs font-bold leading-6 text-blue-900">يجب إدخال واحد على الأقل من: رقم SBP أو رقم البطاقة أو رقم الحساب.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setStep("calculator")}
                      className="h-14 rounded-2xl border border-slate-200 font-black text-slate-700 transition hover:bg-slate-50"
                    >
                      رجوع
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="h-14 rounded-2xl bg-[#1E3A8A] font-black text-white transition hover:bg-[#173173] disabled:bg-slate-300"
                    >
                      {isLoading ? "جاري إنشاء الطلب..." : "متابعة للدفع"}
                    </button>
                  </div>
                </form>
              )}

              {step === "receipt" && transfer && quote && (
                <form onSubmit={handleReceiptUpload} className="space-y-6">
                  <QuoteSummary quote={quote} />

                  <div className="rounded-3xl border-2 border-[#F2B705]/60 bg-gradient-to-b from-amber-50 to-white p-5 shadow-sm sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="inline-flex rounded-full bg-[#F2B705]/20 px-3 py-1 text-xs font-black text-amber-900">
                          بيانات الدفع في مصر
                        </span>
                        <h3 className="mt-3 text-xl font-black text-[#0D1B2A]">
                          حوّل المبلغ إلى حساب RUBWAY
                        </h3>
                      </div>
                      <span className="text-3xl">{transfer.payment_method === "vodafone" ? "📱" : "🏦"}</span>
                    </div>

                    {transfer.payment_account ? (
                      <div className="mt-5 space-y-3">
                        <PaymentDetailRow label="طريقة الدفع" value={selectedMethodLabel} />
                        <PaymentDetailRow label="اسم الحساب" value={transfer.payment_account.name} />
                        <PaymentDetailRow label="اسم صاحب الحساب" value={transfer.payment_account.account_holder_name} />
                        <PaymentDetailRow
                          label={transfer.payment_method === "vodafone" ? "رقم المحفظة" : "رقم الحساب / InstaPay"}
                          value={transfer.payment_account.account_number}
                          copyValue={transfer.payment_account.account_number}
                        />
                        <PaymentDetailRow
                          label="المبلغ المطلوب بالضبط"
                          value={formatMoney(transfer.egp_amount, "EGP")}
                          copyValue={String(transfer.egp_amount)}
                          emphasized
                        />
                      </div>
                    ) : (
                      <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-700">
                        لم يتم العثور على حساب دفع متاح لهذه الطريقة. ارجع واختر طريقة أخرى أو تواصل مع الدعم.
                      </div>
                    )}

                    <p className="mt-5 rounded-xl bg-blue-50 px-4 py-3 text-sm font-bold leading-7 text-blue-900">
                      مهم: حوّل المبلغ كاملًا من حساب باسمك، ثم ارفع إيصالًا واضحًا يظهر الرقم والمبلغ ووقت العملية.
                    </p>
                  </div>

                  <div>
                    <label className="mb-3 block text-sm font-bold text-slate-800">
                      صورة أو ملف الإيصال
                    </label>
                    <label
                      htmlFor="receipt"
                      className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-7 text-center transition hover:border-[#3B82F6] hover:bg-blue-50"
                    >
                      {receiptPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={receiptPreview}
                          alt="Receipt preview"
                          className="max-h-56 rounded-xl object-contain"
                        />
                      ) : (
                        <>
                          <span className="text-4xl">📄</span>
                          <p className="mt-3 font-black text-slate-800">
                            اضغط لاختيار الإيصال
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            JPG, PNG أو PDF — حتى 10MB
                          </p>
                        </>
                      )}

                      <input
                        id="receipt"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        className="hidden"
                        onChange={handleReceiptChange}
                      />
                    </label>

                    {receipt && (
                      <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3 text-sm">
                        <span className="truncate font-bold text-slate-700">
                          {receipt.name}
                        </span>
                        <button
                          type="button"
                          onClick={removeReceipt}
                          className="mr-3 font-black text-red-600"
                        >
                          حذف
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !receipt || !transfer.payment_account}
                    className="h-14 w-full rounded-2xl bg-[#1E3A8A] px-5 font-black text-white transition hover:bg-[#173173] disabled:bg-slate-300"
                  >
                    {isLoading
                      ? "جاري رفع الإيصال..."
                      : "رفع الإيصال وإرسال الطلب"}
                  </button>
                </form>
              )}

              {step === "tracking" && transfer && (
                <div className="space-y-6">
                  <StatusHero
                    status={currentStatus}
                    transferId={transfer.id}
                  />

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <SuccessRow
                      label="رقم التحويل"
                      value={`#${transfer.id}`}
                    />
                    <SuccessRow
                      label="المبلغ"
                      value={formatMoney(transfer.rub_amount, "RUB")}
                    />
                    <SuccessRow
                      label="طريقة الدفع"
                      value={selectedMethodLabel}
                    />
                    <SuccessRow
                      label="الحالة"
                      value={statusLabel(currentStatus)}
                      last
                    />
                  </div>

                  {currentStatus === "waiting_recipient" &&
                    !tracking?.has_recipient_details && (
                      <form
                        onSubmit={handleRecipientSubmit}
                        className="space-y-5 rounded-3xl border border-[#F2B705]/40 bg-gradient-to-b from-amber-50 to-white p-5 sm:p-6"
                      >
                        <div>
                          <span className="inline-flex rounded-full bg-[#F2B705]/15 px-3 py-1 text-xs font-black text-amber-800">
                            الخطوة المطلوبة الآن
                          </span>
                          <h3 className="mt-3 text-2xl font-black text-[#0D1B2A]">
                            بيانات المستلم في روسيا
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            أدخل البيانات بدقة كما هي مسجلة لدى البنك الروسي.
                          </p>
                        </div>

                        <InputField
                          id="recipientName"
                          label="اسم المستلم *"
                          value={recipientName}
                          onChange={setRecipientName}
                          placeholder="الاسم الكامل بالإنجليزية أو الروسية"
                          autoComplete="name"
                        />

                        <div className="grid gap-4 sm:grid-cols-2">
                          <InputField
                            id="bankName"
                            label="اسم البنك"
                            value={bankName}
                            onChange={setBankName}
                            placeholder="مثال: Sberbank"
                            autoComplete="off"
                          />
                          <InputField
                            id="recipientPhone"
                            label="هاتف المستلم"
                            value={recipientPhone}
                            onChange={setRecipientPhone}
                            placeholder="+7 ..."
                            autoComplete="tel"
                          />
                        </div>

                        <InputField
                          id="cardNumber"
                          label="رقم البطاقة"
                          value={cardNumber}
                          onChange={setCardNumber}
                          placeholder="16–19 رقمًا"
                          autoComplete="cc-number"
                        />

                        <div className="flex items-center gap-3">
                          <span className="h-px flex-1 bg-slate-200" />
                          <span className="text-xs font-bold text-slate-400">
                            أو
                          </span>
                          <span className="h-px flex-1 bg-slate-200" />
                        </div>

                        <InputField
                          id="accountNumber"
                          label="رقم الحساب"
                          value={accountNumber}
                          onChange={setAccountNumber}
                          placeholder="رقم الحساب البنكي الروسي"
                          autoComplete="off"
                        />

                        <div className="flex items-center gap-3">
                          <span className="h-px flex-1 bg-slate-200" />
                          <span className="text-xs font-bold text-slate-400">
                            أو
                          </span>
                          <span className="h-px flex-1 bg-slate-200" />
                        </div>

                        <InputField
                          id="sbpPhone"
                          label="رقم الهاتف المرتبط بـ SBP"
                          value={sbpPhone}
                          onChange={setSbpPhone}
                          placeholder="+7 ..."
                          autoComplete="tel"
                        />

                        <p className="rounded-xl bg-blue-50 px-4 py-3 text-xs font-bold leading-6 text-blue-800">
                          يجب إدخال واحد على الأقل من: رقم البطاقة، رقم الحساب، أو رقم SBP.
                        </p>

                        <button
                          type="submit"
                          disabled={isLoading}
                          className="h-14 w-full rounded-2xl bg-gradient-to-l from-[#F2B705] to-[#f59e0b] font-black text-[#0D1B2A] shadow-lg shadow-amber-500/20 transition hover:brightness-105 disabled:bg-slate-300 disabled:shadow-none"
                        >
                          {isLoading
                            ? "جاري حفظ البيانات..."
                            : "حفظ بيانات المستلم"}
                        </button>
                      </form>
                    )}

                  {currentStatus === "rejected" &&
                    tracking?.rejection_reason && (
                      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                        <p className="text-xs font-black uppercase tracking-wide text-red-500">
                          سبب الرفض
                        </p>
                        <p className="mt-2 font-bold leading-7 text-red-800">
                          {tracking.rejection_reason}
                        </p>
                      </div>
                    )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void refreshTracking()}
                      disabled={isRefreshingStatus}
                      className="h-14 rounded-2xl border border-slate-200 bg-white font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                    >
                      {isRefreshingStatus
                        ? "جاري التحديث..."
                        : "تحديث الحالة الآن"}
                    </button>
                    <button
                      type="button"
                      onClick={resetFlow}
                      className="h-14 rounded-2xl bg-[#0D1B2A] font-black text-white transition hover:bg-[#162a40]"
                    >
                      إنشاء تحويل جديد
                    </button>
                  </div>

                  <p className="text-center text-xs font-bold text-slate-400">
                    يتم تحديث الحالة تلقائيًا كل 7 ثوانٍ.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="why" className="bg-[#F1F5F9] py-16 sm:py-24">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="section-kicker">تجربة تحويل مصممة للثقة</span>
            <h2 className="section-title">لماذا يختار العملاء RUBWAY؟</h2>
            <p className="section-copy">منصة واحدة للسعر والدفع وبيانات المستلم والمتابعة، مع دعم مباشر في كل خطوة.</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <PremiumFeature icon="🛡️" title="أمان ووضوح" description="كل طلب يحمل رقم متابعة وحالة واضحة من البداية حتى الاكتمال." />
            <PremiumFeature icon="⚡" title="تنفيذ سريع" description="انتقال منظم بين المراجعة وإدخال بيانات المستلم وإرسال الروبل." />
            <PremiumFeature icon="💱" title="سعر واضح" description="تعرف المبلغ المطلوب دفعه والمبلغ المستلم قبل إنشاء الطلب." />
            <PremiumFeature icon="📍" title="تتبع مباشر" description="تحديث تلقائي لحالة التحويل دون الحاجة لإعادة التواصل كل مرة." />
            <PremiumFeature icon="🎧" title="دعم متخصص" description="الوصول إلى واتساب أو تيليجرام بضغطة واحدة دون إظهار البيانات." />
            <PremiumFeature icon="📱" title="يعمل على كل جهاز" description="واجهة متجاوبة بالكامل للآيفون وأندرويد والتابلت والويب." />
          </div>
        </div>
      </section>

      <section id="how" className="bg-white py-16 sm:py-24">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="section-kicker">خطوات واضحة وبسيطة</span>
            <h2 className="section-title">من إدخال المبلغ حتى استلام الروبل</h2>
            <p className="section-copy">كل مرحلة تظهر داخل نفس الصفحة، مع تحديث الحالة تلقائيًا.</p>
          </div>
          <div className="relative mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[['01','💱','احصل على السعر','اختر المبلغ وطريقة الدفع في مصر.'],['02','👤','أدخل بياناتك','أضف اسمك ورقم التواصل لإنشاء الطلب.'],['03','🧾','ارفع الإيصال','ارفع إثبات الدفع بصورة واضحة.'],['04','✅','انتظر التأكيد','يقوم فريق RUBWAY بمراجعة الدفع.'],['05','🏦','أضف المستلم','أدخل بيانات المستلم الروسي المطلوبة.'],['06','🎉','استلم وتابع','تابع إرسال الروبل حتى اكتمال العملية.']].map(([n,icon,t,d]) => (
              <div key={n} className="process-card">
                <div className="flex items-center justify-between"><span className="text-3xl">{icon}</span><span className="text-4xl font-black text-slate-100">{n}</span></div>
                <h3 className="mt-6 text-xl font-black">{t}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="support" className="bg-[#071426] py-16 text-white sm:py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-5 lg:grid-cols-3">
            <SupportLink title="تواصل عبر واتساب" text="افتح محادثة مباشرة مع فريق الدعم" icon="☎" href="https://wa.me/79257887131" accent="green" />
            <SupportLink title="تواصل عبر تيليجرام" text="راسل فريق RUBWAY مباشرة" icon="✈" href="https://t.me/haggag_ru" accent="blue" />
            <SupportLink title="انضم إلى جروب واتساب" text="تابع التحديثات والعروض والمساعدة" icon="👥" href="https://chat.whatsapp.com/GgRuVR7LxpcDSjIMlHOlP4?s=cl&p=i&mlu=0&amv=0" accent="gold" />
          </div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="section-kicker">تجربة بسيطة من أول مرة</span>
            <h2 className="section-title">واجهة تُشعرك أنك تعرف الخطوة التالية دائمًا</h2>
          </div>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            <Testimonial text="الحاسبة واضحة، وكل تحديث في الطلب ظهر بدون ما أحتاج أسأل كل مرة." name="عميل RUBWAY" role="تحويل مصر إلى روسيا" />
            <Testimonial text="رفعت الإيصال من الموبايل وأدخلت بيانات المستلم بعد التأكيد بسهولة." name="عميل RUBWAY" role="استخدام عبر Android" />
            <Testimonial text="تصميم مرتب وسريع، والدعم متاح مباشرة من نفس الصفحة." name="عميل RUBWAY" role="دعم ومتابعة" />
          </div>
        </div>
      </section>

      <section id="faq" className="bg-[#F1F5F9] py-16 sm:py-20">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-black sm:text-4xl">الأسئلة الشائعة</h2>
          <div className="mt-8 space-y-3">
            <FaqItem q="متى تظهر بيانات المستلم الروسي؟" a="تظهر تلقائيًا بعد مراجعة إثبات الدفع وتأكيد الإدارة للحالة." />
            <FaqItem q="كيف أتابع التحويل؟" a="تظل صفحة المتابعة مفتوحة وتحدّث الحالة تلقائيًا كل سبع ثوانٍ، ويمكنك التحديث يدويًا أيضًا." />
            <FaqItem q="هل يعمل الموقع على الهاتف؟" a="نعم، التصميم مخصص للهواتف أولًا ويدعم iPhone وAndroid والتابلت والكمبيوتر." />
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#071426] py-8 text-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-5 px-4 text-center sm:px-6 md:flex-row md:text-right lg:px-8">
          <Image
            src="/rubway-logo-dark.jpg"
            alt="RUBWAY"
            width={490}
            height={140}
            sizes="192px"
            className="h-12 w-auto rounded-lg object-cover object-left"
          />
          <p className="text-sm text-slate-400">© {new Date().getFullYear()} RUBWAY. جميع الحقوق محفوظة.</p>
          <div className="flex gap-4 text-sm font-bold"><a href="#support" className="hover:text-[#F2B705]">تواصل معنا</a><a href="#faq" className="hover:text-[#F2B705]">الأسئلة الشائعة</a></div>
        </div>
      </footer>

      <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-[70] sm:left-6">
        {chatOpen && (
          <div className="mb-3 w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-[#0D1B2A] text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><p className="font-black">مساعد RUBWAY</p><p className="text-xs text-emerald-400">● متصل الآن</p></div><button onClick={() => setChatOpen(false)} className="h-10 w-10 rounded-full bg-white/10">×</button></div>
            <div className="max-h-[55vh] overflow-y-auto p-4">
              <div className="rounded-2xl bg-white/10 p-4 text-sm leading-7">{chatAnswer}</div>
              <div className="mt-4 grid gap-2">
                <ChatChoice text="كيف أبدأ التحويل؟" onClick={() => setChatAnswer('اضغط «ابدأ التحويل الآن»، اختر المبلغ وطريقة الدفع، ثم أكمل بياناتك وارفع الإيصال.')} />
                <ChatChoice text="متى أدخل بيانات المستلم؟" onClick={() => setChatAnswer('بعد أن يراجع فريق RUBWAY الإيصال ويؤكد الدفع، ستظهر لك بيانات المستلم تلقائيًا.')} />
                <ChatChoice text="أريد التحدث مع الدعم" onClick={() => window.open('https://wa.me/79257887131', '_blank', 'noopener,noreferrer')} />
              </div>
            </div>
          </div>
        )}
        <button type="button" onClick={() => setChatOpen((v) => !v)} aria-label="فتح مساعد RUBWAY" className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#3B82F6] to-[#1E3A8A] text-3xl shadow-2xl shadow-blue-950/40 ring-4 ring-white/20 transition hover:scale-105">🤖</button>
      </div>

    </main>
  );
}



function PaymentMethodButton({
  active,
  title,
  subtitle,
  icon,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-right transition ${
        active
          ? "border-[#3B82F6] bg-blue-50 ring-4 ring-blue-100"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <span className="text-2xl">{icon}</span>
      <p className="mt-3 font-black text-[#0D1B2A]">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
    </button>
  );
}

function InputField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-3 block text-sm font-bold text-slate-800">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 font-bold text-[#0D1B2A] outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#3B82F6] focus:ring-4 focus:ring-blue-100"
      />
    </div>
  );
}

function PaymentDetailRow({
  label,
  value,
  copyValue,
  emphasized = false,
}: {
  label: string;
  value: string;
  copyValue?: string;
  emphasized?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!copyValue) return;
    await navigator.clipboard.writeText(copyValue);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={`rounded-2xl border p-4 ${emphasized ? "border-[#F2B705] bg-amber-50" : "border-slate-200 bg-white"}`}>
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p dir="ltr" className={`break-all text-left font-black ${emphasized ? "text-2xl text-[#0D1B2A]" : "text-lg text-slate-900"}`}>
          {value}
        </p>
        {copyValue && (
          <button type="button" onClick={copy} className="shrink-0 rounded-xl bg-[#1E3A8A] px-3 py-2 text-xs font-black text-white transition hover:bg-[#173173]">
            {copied ? "تم النسخ ✓" : "نسخ"}
          </button>
        )}
      </div>
    </div>
  );
}

function QuoteSummary({ quote }: { quote: TransferQuote }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">ستدفع</p>
          <p className="mt-1 text-xl font-black text-[#0D1B2A]">
            {formatMoney(quote.egp_amount, "EGP")}
          </p>
        </div>
        <span className="text-xl text-[#F2B705]">←</span>
        <div className="text-left">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">سيستلم</p>
          <p className="mt-1 text-xl font-black text-[#1E3A8A]">
            {formatMoney(quote.rub_amount, "RUB")}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-slate-500">سعر التحويل</span>
        <span className="font-black text-slate-800">
          1 EGP = {Number(quote.exchange_rate).toFixed(4)} RUB
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-slate-500">طريقة الدفع</span>
        <span className="font-black text-slate-800">
          {quote.payment_method === "instapay" ? "InstaPay" : "Vodafone Cash"}
        </span>
      </div>
    </div>
  );
}

function StatusHero({
  status,
  transferId,
}: {
  status: CustomerTransferStatus;
  transferId: number;
}) {
  const completed = status === "completed";
  const rejected = status === "rejected";
  const waitingRecipient = status === "waiting_recipient";

  return (
    <div
      className={`overflow-hidden rounded-3xl border p-6 text-center ${
        rejected
          ? "border-red-200 bg-red-50"
          : completed
            ? "border-emerald-200 bg-emerald-50"
            : waitingRecipient
              ? "border-amber-200 bg-amber-50"
              : "border-blue-200 bg-blue-50"
      }`}
    >
      <div
        className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full text-4xl ${
          rejected
            ? "bg-red-100"
            : completed
              ? "bg-emerald-100"
              : waitingRecipient
                ? "bg-amber-100"
                : "bg-blue-100"
        }`}
      >
        {rejected ? "×" : completed ? "✓" : waitingRecipient ? "👤" : "↻"}
      </div>
      <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
        Transfer #{transferId}
      </p>
      <h3 className="mt-2 text-2xl font-black text-[#0D1B2A]">{statusLabel(status)}</h3>
      <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-600">
        {statusDescription(status)}
      </p>
    </div>
  );
}

function SuccessRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 py-3 ${last ? "" : "border-b border-slate-200"}`}>
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-left text-sm font-black text-[#0D1B2A]">{value}</span>
    </div>
  );
}

function SupportLink({
  title,
  text,
  icon,
  href,
  accent,
}: {
  title: string;
  text: string;
  icon: string;
  href: string;
  accent: "green" | "blue" | "gold";
}) {
  const styles =
    accent === "green"
      ? "from-emerald-500 to-green-600"
      : accent === "blue"
        ? "from-sky-500 to-blue-600"
        : "from-[#F2B705] to-amber-500 text-[#0D1B2A]";

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur transition hover:-translate-y-1 hover:bg-white/10"
    >
      <span className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-2xl shadow-lg ${styles}`}>
        {icon}
      </span>
      <h3 className="mt-5 text-xl font-black">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-300">{text}</p>
      <span className="mt-5 inline-flex font-black text-[#F2B705]">فتح الآن ←</span>
    </a>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-black">
        <span>{q}</span>
        <span className="text-2xl text-[#1E3A8A] transition group-open:rotate-45">+</span>
      </summary>
      <p className="mt-4 border-t border-slate-100 pt-4 text-sm leading-7 text-slate-600">{a}</p>
    </details>
  );
}

function ChatChoice({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-right text-sm font-bold transition hover:bg-white/10"
    >
      {text}
    </button>
  );
}

function TrustStat({ value, label }: { value: string; label: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center backdrop-blur"><p className="text-lg font-black text-[#F2B705] sm:text-xl">{value}</p><p className="mt-1 text-xs font-bold text-slate-300">{label}</p></div>;
}

function PremiumFeature({ icon, title, description }: { icon: string; title: string; description: string }) {
  return <article className="premium-card"><div className="premium-icon">{icon}</div><h3 className="mt-5 text-xl font-black">{title}</h3><p className="mt-2 text-sm leading-7 text-slate-600">{description}</p></article>;
}

function Testimonial({ text, name, role }: { text: string; name: string; role: string }) {
  return <article className="rounded-3xl border border-slate-200 bg-slate-50 p-7 shadow-sm"><div className="text-[#F2B705]">★★★★★</div><p className="mt-5 text-base font-bold leading-8 text-slate-700">“{text}”</p><div className="mt-6 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0D1B2A] font-black text-[#F2B705]">R</div><div><p className="font-black">{name}</p><p className="text-xs text-slate-500">{role}</p></div></div></article>;
}
