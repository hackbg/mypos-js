// Types for @hackbg/mypos-js. The checkout API is typed in full; the REST APIs
// (transactions, devices, accounts, webhooks) are callback-based and return
// myPOS's JSON as-is, typed loosely.

declare namespace MyPos {
  type LogLevel = 'debug' | 'info' | 'error' | 'none'

  interface CheckoutConfig {
    /** Store ID. */
    sid: string
    /** Language of the hosted checkout page: EN, BG, DE, FR, ... */
    lang?: string
    currency: string
    /** The myPOS client (wallet) number. */
    clientNumber: string
    okUrl?: string
    cancelUrl?: string
    /** Must be HTTPS, with no port. */
    notifyUrl?: string
    cardTokenRequest?: 0 | 1 | 2
    /** 1 card, 2 iDEAL, 3 all available, or a comma-separated list. */
    paymentMethod?: number | string
    paymentParametersRequired?: 1 | 2 | 3
    /** Index of the key pair in the myPOS account. */
    keyIndex: number
    /** The merchant private key, PEM (PKCS#1 or PKCS#8). */
    privateKey: string
    /** The myPOS public certificate, PEM. Used by verifySignature. */
    publicCertificate?: string
    version?: string
    outputFormat?: 'JSON' | 'XML'
  }

  interface Config {
    isSandbox?: boolean
    logLevel?: LogLevel
    checkout?: CheckoutConfig
    apiKey?: string
    apiSecret?: string
  }

  interface CartItem {
    name: string
    quantity: number
    /** Unit price. Negative for a discount row. */
    price: number
  }

  interface Customer {
    email?: string
    firstNames?: string
    familyName?: string
    phone?: string
    /** ISO 3166-1 alpha-3, e.g. BGR. */
    country?: string
    city?: string
    zipCode?: string
    address?: string
  }

  interface PurchaseParams {
    /** Up to 80 characters. Generated when omitted. */
    orderId?: string
    amount: number
    cartItems: CartItem[]
    customer?: Customer
    note?: string
    okUrl?: string
    cancelUrl?: string
    notifyUrl?: string
    currency?: string
    lang?: string
    sid?: string
    walletNumber?: string
    paymentMethod?: number | string
    paymentParametersRequired?: 1 | 2 | 3
    cardTokenRequest?: 0 | 1 | 2
  }

  interface RefundParams {
    /** IPC_Trnref of the payment being refunded. */
    trnRef: string
    amount: number
    currency?: string
    /** The refund's own reference. Generated when omitted. */
    orderId?: string
  }

  interface ReversalParams {
    trnRef: string
    orderId?: string
  }

  type Field = [name: string, value: string]

  interface SignedForm {
    /** The myPOS checkout URL to POST to. */
    action: string
    method: 'POST'
    /** In signing order, Signature last. Post them in this order. */
    fields: Field[]
  }

  interface RequestOptions {
    /** Default 15000. */
    timeoutMs?: number
    /**
     * Reject a reply whose signature does not verify against
     * checkout.publicCertificate. Default false. A valid signature proves the
     * reply came from myPOS, not that an order was paid.
     */
    verifySignature?: boolean
  }

  /** The common envelope of a Checkout API reply. Status 0 means success. */
  interface CheckoutReply {
    /** Replies spell it IPCMethod; requests send IPCmethod. */
    IPCMethod?: string
    Status: number | string
    StatusMsg?: string
    Signature?: string
    [field: string]: unknown
  }

  interface PaymentStatusReply extends CheckoutReply {
    OrderID?: string
    /** 1 successful, 2 pending, 3 unsuccessful, 4 reversed. */
    PaymentStatus?: number | string
    PaymentReference?: string
    Amount?: number | string
    Currency?: string
    IPC_Trnref?: string | number
    DateTime?: string
  }

  interface RefundReply extends CheckoutReply {
    IPC_Trnref?: string | number
    Amount?: number | string
    Currency?: string
  }

  /** A Node response, or a function that is handed the HTML instead. */
  type FormHandler = ((html: string) => void) | { write(chunk: string): unknown; end(): unknown }
  type Callback = (result: any) => void

  interface Instance {
    config: Config
    checkout: {
      /** @deprecated in favour of purchaseForm: the page submits via an inline onload handler, which a strict CSP blocks. */
      purchase(params: PurchaseParams, handler: FormHandler): void
      /** @deprecated returns an HTML form; use refundPayment. */
      refund(params: RefundParams, handler: FormHandler): void
      /** @deprecated returns an HTML form; use reversePayment. */
      reversal(params: ReversalParams, handler: FormHandler): void
      /** @deprecated returns an HTML form; use paymentStatus. */
      getPaymentStatus(params: { orderId: string }, handler: FormHandler): void

      purchaseForm(params: PurchaseParams): SignedForm
      paymentStatus(params: { orderId: string }, options?: RequestOptions): Promise<PaymentStatusReply>
      refundPayment(params: RefundParams, options?: RequestOptions): Promise<RefundReply>
      reversePayment(params: ReversalParams, options?: RequestOptions): Promise<CheckoutReply>
      /** Verify a signature from myPOS against checkout.publicCertificate, or the one given. */
      verifySignature(
        data: Record<string, unknown> | ReadonlyArray<readonly [string, unknown]>,
        publicCertificate?: string
      ): boolean
    }
    transactions: {
      list(params: Record<string, unknown>, callback: Callback): void
      get(trnRef: string, callback: Callback): void
    }
    devices: {
      list(params: Record<string, unknown>, callback: Callback): void
      get(terminalId: string, callback: Callback): void
      transactions: {
        get(terminalId: string, params: Record<string, unknown>, callback: Callback): void
        list(params: Record<string, unknown>, callback: Callback): void
      }
    }
    accounts: {
      list(params: Record<string, unknown>, callback: Callback): void
    }
    webhooks: {
      list(params: Record<string, unknown>, callback: Callback): void
      details(webHookId: string, callback: Callback): void
      create(payloadUrl: string, secret: string, callback: Callback): void
      update(webHookId: string, payloadUrl: string, secret: string, isActive: boolean, callback: Callback): void
      delete(webHookId: string, callback: Callback): void
      events: { list(params: Record<string, unknown>, callback: Callback): void }
      subscriptions: {
        list(params: Record<string, unknown>, callback: Callback): void
        details(webHookSubscriptionId: string, callback: Callback): void
        create(webHookId: string, webHookEventId: string, callback: Callback, filter?: unknown): void
        delete(webHookSubscriptionId: string, callback: Callback): void
      }
    }
  }
}

declare function MyPos(config: MyPos.Config): MyPos.Instance

export = MyPos
