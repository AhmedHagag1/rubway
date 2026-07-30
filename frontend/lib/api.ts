import type { PricingSettings, PricingUpdate } from "@/types/pricing";

import type {
  AdminProfile,
  LoginResponse,
} from "@/types/auth";

import type {
  Transfer,
} from "@/types/transfer";

import type {
  CreateCustomerTransferRequest,
  CustomerTransfer,
  ReceiptUploadResponse,
  RussianRecipient,
  RussianRecipientCreate,
  TransferQuote,
  TransferQuoteRequest,
  TransferTracking,
} from "@/types/customer-transfer";


const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000/api/v1";


export const ACCESS_TOKEN_KEY =
  "rubway_admin_access_token";


export class ApiError extends Error {
  status: number;

  constructor(
    message: string,
    status: number,
  ) {
    super(message);

    this.name = "ApiError";
    this.status = status;
  }
}


async function extractErrorMessage(
  response: Response,
): Promise<string> {
  try {
    const data: unknown =
      await response.json();

    if (
      typeof data === "object" &&
      data !== null &&
      "detail" in data
    ) {
      const detail = (
        data as {
          detail?: unknown;
        }
      ).detail;

      if (
        typeof detail === "string"
      ) {
        return detail;
      }

      if (
        Array.isArray(detail)
      ) {
        return detail
          .map((item) => {
            if (
              typeof item === "object" &&
              item !== null &&
              "msg" in item
            ) {
              return String(
                (
                  item as {
                    msg: unknown;
                  }
                ).msg,
              );
            }

            return "Validation error";
          })
          .join(", ");
      }
    }

    return (
      `Request failed with status ` +
      response.status
    );
  } catch {
    return (
      `Request failed with status ` +
      response.status
    );
  }
}


async function publicRequest(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const response = await fetch(
    `${API_URL}${path}`,
    {
      ...options,
      headers: {
        Accept: "application/json",
        ...options.headers,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new ApiError(
      await extractErrorMessage(response),
      response.status,
    );
  }

  return response;
}


async function authenticatedRequest(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = getAccessToken();

  if (!token) {
    throw new ApiError(
      "Authentication token is missing.",
      401,
    );
  }

  const response = await fetch(
    `${API_URL}${path}`,
    {
      ...options,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new ApiError(
      await extractErrorMessage(response),
      response.status,
    );
  }

  return response;
}


/* =========================
   Public transfer endpoints
========================= */


export async function createTransferQuote(
  data: TransferQuoteRequest,
): Promise<TransferQuote> {
  const response = await publicRequest(
    "/transfers/quote",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    },
  );

  return response.json() as
    Promise<TransferQuote>;
}


export async function createCustomerTransfer(
  data: CreateCustomerTransferRequest,
): Promise<CustomerTransfer> {
  const response = await publicRequest(
    "/transfers",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    },
  );

  return response.json() as
    Promise<CustomerTransfer>;
}


export async function uploadTransferReceipt(
  transferId: number,
  receipt: File,
): Promise<ReceiptUploadResponse> {
  const formData = new FormData();

  formData.append(
    "receipt",
    receipt,
  );

  const response = await publicRequest(
    `/transfers/${transferId}/receipt`,
    {
      method: "POST",
      body: formData,
    },
  );

  return response.json() as
    Promise<ReceiptUploadResponse>;
}


export async function getCustomerTransfer(
  transferId: number,
): Promise<CustomerTransfer> {
  const response = await publicRequest(
    `/transfers/${transferId}`,
    {
      method: "GET",
    },
  );

  return response.json() as
    Promise<CustomerTransfer>;
}


export async function getTransferTracking(
  transferId: number,
): Promise<TransferTracking> {
  const response = await publicRequest(
    `/transfers/track/${transferId}`,
    {
      method: "GET",
    },
  );

  return response.json() as
    Promise<TransferTracking>;
}


export async function addRecipientDetails(
  transferId: number,
  data: RussianRecipientCreate,
): Promise<RussianRecipient> {
  const response = await publicRequest(
    `/transfers/${transferId}/recipient-details`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    },
  );

  return response.json() as
    Promise<RussianRecipient>;
}


/* =========================
   Authentication endpoints
========================= */


export async function loginAdmin(
  username: string,
  password: string,
): Promise<LoginResponse> {
  const requestBody =
    new URLSearchParams();

  requestBody.set(
    "username",
    username,
  );

  requestBody.set(
    "password",
    password,
  );

  requestBody.set(
    "grant_type",
    "password",
  );

  const response = await fetch(
    `${API_URL}/auth/login`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: requestBody.toString(),
    },
  );

  if (!response.ok) {
    throw new ApiError(
      await extractErrorMessage(response),
      response.status,
    );
  }

  return response.json() as
    Promise<LoginResponse>;
}


export async function getAdminProfile(
  token: string,
): Promise<AdminProfile> {
  const response = await fetch(
    `${API_URL}/auth/me`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new ApiError(
      await extractErrorMessage(response),
      response.status,
    );
  }

  return response.json() as
    Promise<AdminProfile>;
}


/* =========================
   Admin transfer endpoints
========================= */


export async function getTransfers():
Promise<Transfer[]> {
  const response =
    await authenticatedRequest(
      "/admin/transfers",
      {
        method: "GET",
      },
    );

  const data: unknown =
    await response.json();

  if (Array.isArray(data)) {
    return data as Transfer[];
  }

  if (
    typeof data === "object" &&
    data !== null &&
    "items" in data
  ) {
    const items = (
      data as {
        items?: unknown;
      }
    ).items;

    if (Array.isArray(items)) {
      return items as Transfer[];
    }
  }

  throw new ApiError(
    "Unexpected transfers response.",
    500,
  );
}


export async function getAdminTransfer(
  transferId: number,
): Promise<Transfer> {
  const response =
    await authenticatedRequest(
      `/admin/transfers/${transferId}`,
      {
        method: "GET",
      },
    );

  return response.json() as
    Promise<Transfer>;
}


export async function confirmPayment(
  transferId: number,
): Promise<Transfer> {
  const response =
    await authenticatedRequest(
      `/admin/transfers/${transferId}/confirm-payment`,
      {
        method: "PATCH",
      },
    );

  return response.json() as
    Promise<Transfer>;
}


export async function markRubSent(
  transferId: number,
): Promise<Transfer> {
  const response =
    await authenticatedRequest(
      `/admin/transfers/${transferId}/mark-rub-sent`,
      {
        method: "PATCH",
      },
    );

  return response.json() as
    Promise<Transfer>;
}


export async function completeTransfer(
  transferId: number,
): Promise<Transfer> {
  const response =
    await authenticatedRequest(
      `/admin/transfers/${transferId}/complete`,
      {
        method: "PATCH",
      },
    );

  return response.json() as
    Promise<Transfer>;
}


export async function rejectTransfer(
  transferId: number,
  rejectionReason?: string,
): Promise<Transfer> {
  const searchParams =
    new URLSearchParams();

  if (rejectionReason?.trim()) {
    searchParams.set(
      "rejection_reason",
      rejectionReason.trim(),
    );
  }

  const queryString =
    searchParams.toString();

  const path =
    `/admin/transfers/${transferId}/reject` +
    (queryString ? `?${queryString}` : "");

  const response =
    await authenticatedRequest(
      path,
      {
        method: "PATCH",
      },
    );

  return response.json() as
    Promise<Transfer>;
}


/* =========================
   Access token helpers
========================= */


export function saveAccessToken(
  token: string,
): void {
  localStorage.setItem(
    ACCESS_TOKEN_KEY,
    token,
  );
}


export function getAccessToken():
  | string
  | null {
  if (
    typeof window === "undefined"
  ) {
    return null;
  }

  return localStorage.getItem(
    ACCESS_TOKEN_KEY,
  );
}


export function removeAccessToken():
void {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  localStorage.removeItem(
    ACCESS_TOKEN_KEY,
  );
}
/* =========================
   Payment account endpoints
========================= */

import type {
  PaymentAccount,
  PaymentAccountCreate,
  PaymentAccountUpdate,
} from "@/types/payment-account";

export async function getPaymentAccounts(): Promise<PaymentAccount[]> {
  const response = await authenticatedRequest(
    "/admin/payment-accounts",
    { method: "GET" },
  );

  return response.json() as Promise<PaymentAccount[]>;
}

export async function createPaymentAccount(
  data: PaymentAccountCreate,
): Promise<PaymentAccount> {
  const response = await authenticatedRequest(
    "/admin/payment-accounts",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );

  return response.json() as Promise<PaymentAccount>;
}

export async function updatePaymentAccount(
  accountId: number,
  data: PaymentAccountUpdate,
): Promise<PaymentAccount> {
  const response = await authenticatedRequest(
    `/admin/payment-accounts/${accountId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );

  return response.json() as Promise<PaymentAccount>;
}

/* =========================
   Admin pricing endpoints
========================= */


export async function getPricingSettings(): Promise<PricingSettings> {
  const response = await authenticatedRequest("/admin/pricing", { method: "GET" });
  return response.json() as Promise<PricingSettings>;
}

export async function updatePricingSettings(data: PricingUpdate): Promise<PricingSettings> {
  const response = await authenticatedRequest("/admin/pricing", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return response.json() as Promise<PricingSettings>;
}
