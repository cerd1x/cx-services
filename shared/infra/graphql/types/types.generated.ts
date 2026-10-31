import type { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  DateTime: { input: Date; output: Date; }
  DateTimeOrTimestamp: { input: Date; output: Date; }
  Money: { input: import('@lib/money').Money; output: import('@lib/money').Money; }
  Timestamp: { input: number; output: number; }
};

export type AdminOverview = {
  __typename?: 'AdminOverview';
  totalAdmins: Scalars['Int']['output'];
  totalAssets: Scalars['Int']['output'];
  /** Total `amount` untuk transaksi bertipe expense, dijumlahkan apa adanya. */
  totalExpense: Scalars['Float']['output'];
  /**
   * Total `amount` untuk transaksi bertipe income, dijumlahkan apa adanya.
   * Nilainya belum dinormalisasi ke satu mata uang.
   */
  totalIncome: Scalars['Float']['output'];
  totalTransactions: Scalars['Int']['output'];
  totalUsers: Scalars['Int']['output'];
};

export type AdminSetUserRoleInput = {
  role: UserRole;
  userId: Scalars['ID']['input'];
};

export type AdminTransaction = {
  __typename?: 'AdminTransaction';
  amount: Scalars['Float']['output'];
  capital: Scalars['Float']['output'];
  category?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  date: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  paymentStatus: Scalars['String']['output'];
  status: Scalars['String']['output'];
  type: Scalars['String']['output'];
  userId: Scalars['ID']['output'];
};

/**
 * User yang dilihat admin. Sengaja tidak memuat `password`, dan `email` hanya
 * ada di sini — bukan di type `User` biasa.
 */
export type AdminUser = {
  __typename?: 'AdminUser';
  avatarUrl?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  email: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  role: UserRole;
  username: Scalars['String']['output'];
};

export type Asset = {
  __typename?: 'Asset';
  balance: Scalars['Money']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  type: AssetType;
};

export type AssetInputUpdate = {
  balance?: InputMaybe<Scalars['Money']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  type?: InputMaybe<AssetType>;
};

export type AssetMutationType = {
  __typename?: 'AssetMutationType';
  amount: Scalars['Float']['output'];
  balanceAfter: Scalars['Money']['output'];
  balanceBefore: Scalars['Money']['output'];
  createdAt: Scalars['String']['output'];
  currency: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  type: Scalars['String']['output'];
};

export type AssetSingleMutationResult = {
  __typename?: 'AssetSingleMutationResult';
  asset: Asset;
  code: Scalars['String']['output'];
};

export type AssetTransferResult = {
  __typename?: 'AssetTransferResult';
  code: Scalars['String']['output'];
  from: Asset;
  to: Asset;
};

export enum AssetType {
  Bank = 'bank',
  Cash = 'cash',
  Crypto = 'crypto',
  Ewallet = 'ewallet',
  Loan = 'loan'
}

export type Contact = {
  __typename?: 'Contact';
  avatar?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  email?: Maybe<Scalars['String']['output']>;
  group?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  phone?: Maybe<Scalars['String']['output']>;
  phones?: Maybe<Array<Scalars['String']['output']>>;
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  userId: Scalars['ID']['output'];
};

export type ContactConnection = {
  __typename?: 'ContactConnection';
  edges: Array<ContactEdge>;
  pageInfo: PageInfo;
};

export type ContactEdge = {
  __typename?: 'ContactEdge';
  cursor: Scalars['String']['output'];
  node: Contact;
};

export type CreateAssetInput = {
  balance: Scalars['Money']['input'];
  name: Scalars['String']['input'];
  type: AssetType;
};

export type CreateContactInput = {
  avatar?: InputMaybe<Scalars['String']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  group?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  phone?: InputMaybe<Scalars['String']['input']>;
  phones?: InputMaybe<Array<Scalars['String']['input']>>;
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type CreateInvoiceInput = {
  currency: Scalars['String']['input'];
  customerId?: InputMaybe<Scalars['ID']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  dueAt?: InputMaybe<Scalars['DateTimeOrTimestamp']['input']>;
  items: Array<InvoiceItemInput>;
  tax?: InputMaybe<Scalars['Float']['input']>;
};

export type CreateOrderExpenseInput = {
  customerId?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  itemCount: Scalars['Int']['input'];
  payWithAssetId?: InputMaybe<Scalars['ID']['input']>;
  paymentMethod?: InputMaybe<PaymentMethodType>;
  price: Scalars['Money']['input'];
};

export type CreateOrderInput = {
  customerId?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  itemCount: Scalars['Int']['input'];
  paymentMethod?: InputMaybe<PaymentMethodType>;
  price: Scalars['Money']['input'];
};

export type CreateOrderLoanInput = {
  customerId?: InputMaybe<Scalars['ID']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  itemCount: Scalars['Int']['input'];
  payWithAssetId?: InputMaybe<Scalars['ID']['input']>;
  paymentMethod?: InputMaybe<PaymentMethodType>;
  paymentStatus?: InputMaybe<TransactionPaymentStatus>;
  price: Scalars['Money']['input'];
};

export type CreateOrderProductSaleInput = {
  customerId?: InputMaybe<Scalars['ID']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  itemCount: Scalars['Int']['input'];
  payWithAssetId?: InputMaybe<Scalars['ID']['input']>;
  paymentMethod?: InputMaybe<PaymentMethodType>;
  paymentStatus?: InputMaybe<TransactionPaymentStatus>;
  price: Scalars['Money']['input'];
  productId: Scalars['ID']['input'];
};

export type CreateProductInput = {
  capital?: InputMaybe<Scalars['Float']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  price: Scalars['Float']['input'];
  stock?: InputMaybe<Scalars['Int']['input']>;
  trackStock?: InputMaybe<Scalars['Boolean']['input']>;
};

export type CreateTransactionInput = {
  amount: Scalars['Money']['input'];
  capital: Scalars['Money']['input'];
  category?: InputMaybe<Scalars['String']['input']>;
  customerId: Scalars['ID']['input'];
  date: Scalars['DateTimeOrTimestamp']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  payToAssetId?: InputMaybe<Scalars['ID']['input']>;
  payWithAssetId?: InputMaybe<Scalars['ID']['input']>;
  paymentMethod?: InputMaybe<PaymentMethodInput>;
  paymentStatus?: InputMaybe<TransactionPaymentStatus>;
  status?: InputMaybe<TransactionStatus>;
  type: TransactionType;
};

export type CreateUserInput = {
  name: Scalars['String']['input'];
  password: Scalars['String']['input'];
  username: Scalars['String']['input'];
};

export type ImportProductResult = {
  __typename?: 'ImportProductResult';
  failed: Scalars['Int']['output'];
  imported: Scalars['Int']['output'];
  merged: Scalars['Int']['output'];
};

export type ImportResult = {
  __typename?: 'ImportResult';
  failed: Scalars['Int']['output'];
  imported: Scalars['Int']['output'];
  merged: Scalars['Int']['output'];
};

export type Invoice = {
  __typename?: 'Invoice';
  createdAt: Scalars['DateTime']['output'];
  currency: Scalars['String']['output'];
  customerId?: Maybe<Scalars['ID']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  dueAt?: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  invoiceNumber: Scalars['String']['output'];
  issuedAt?: Maybe<Scalars['DateTime']['output']>;
  items: Array<InvoiceItem>;
  paidAt?: Maybe<Scalars['DateTime']['output']>;
  status: InvoiceStatusEnum;
  subtotal: Scalars['Float']['output'];
  tax: Scalars['Float']['output'];
  totalAmount: Scalars['Float']['output'];
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  userId: Scalars['ID']['output'];
};

export type InvoiceItem = {
  __typename?: 'InvoiceItem';
  description: Scalars['String']['output'];
  quantity: Scalars['Int']['output'];
  unitPrice: Scalars['Float']['output'];
};

export type InvoiceItemInput = {
  description: Scalars['String']['input'];
  quantity: Scalars['Int']['input'];
  unitPrice: Scalars['Float']['input'];
};

export enum InvoiceStatusEnum {
  Cancelled = 'cancelled',
  Draft = 'draft',
  Issued = 'issued',
  Overdue = 'overdue',
  Paid = 'paid',
  PartiallyPaid = 'partially_paid'
}

export enum IsoCurrency {
  Aed = 'AED',
  Afn = 'AFN',
  All = 'ALL',
  Amd = 'AMD',
  Ang = 'ANG',
  Aoa = 'AOA',
  Ars = 'ARS',
  Aud = 'AUD',
  Awg = 'AWG',
  Azn = 'AZN',
  Bam = 'BAM',
  Bbd = 'BBD',
  Bdt = 'BDT',
  Bgn = 'BGN',
  Bhd = 'BHD',
  Bif = 'BIF',
  Bmd = 'BMD',
  Bnd = 'BND',
  Bob = 'BOB',
  Bov = 'BOV',
  Brl = 'BRL',
  Bsd = 'BSD',
  Btn = 'BTN',
  Bwp = 'BWP',
  Byn = 'BYN',
  Byr = 'BYR',
  Bzd = 'BZD',
  Cad = 'CAD',
  Cdf = 'CDF',
  Che = 'CHE',
  Chf = 'CHF',
  Chw = 'CHW',
  Clf = 'CLF',
  Clp = 'CLP',
  Cny = 'CNY',
  Cop = 'COP',
  Cou = 'COU',
  Crc = 'CRC',
  Cuc = 'CUC',
  Cup = 'CUP',
  Cve = 'CVE',
  Czk = 'CZK',
  Djf = 'DJF',
  Dkk = 'DKK',
  Dop = 'DOP',
  Dzd = 'DZD',
  Egp = 'EGP',
  Ern = 'ERN',
  Etb = 'ETB',
  Eur = 'EUR',
  Fjd = 'FJD',
  Fkp = 'FKP',
  Gbp = 'GBP',
  Gel = 'GEL',
  Ghs = 'GHS',
  Gip = 'GIP',
  Gmd = 'GMD',
  Gnf = 'GNF',
  Gtq = 'GTQ',
  Gyd = 'GYD',
  Hkd = 'HKD',
  Hnl = 'HNL',
  Hrk = 'HRK',
  Htg = 'HTG',
  Huf = 'HUF',
  Idr = 'IDR',
  Ils = 'ILS',
  Inr = 'INR',
  Iqd = 'IQD',
  Irr = 'IRR',
  Isk = 'ISK',
  Jmd = 'JMD',
  Jod = 'JOD',
  Jpy = 'JPY',
  Kes = 'KES',
  Kgs = 'KGS',
  Khr = 'KHR',
  Kmf = 'KMF',
  Kpw = 'KPW',
  Krw = 'KRW',
  Kwd = 'KWD',
  Kyd = 'KYD',
  Kzt = 'KZT',
  Lak = 'LAK',
  Lbp = 'LBP',
  Lkr = 'LKR',
  Lrd = 'LRD',
  Lsl = 'LSL',
  Lyd = 'LYD',
  Mad = 'MAD',
  Mdl = 'MDL',
  Mga = 'MGA',
  Mkd = 'MKD',
  Mmk = 'MMK',
  Mnt = 'MNT',
  Mop = 'MOP',
  Mru = 'MRU',
  Mur = 'MUR',
  Mvr = 'MVR',
  Mwk = 'MWK',
  Mxn = 'MXN',
  Mxv = 'MXV',
  Myr = 'MYR',
  Mzn = 'MZN',
  Nad = 'NAD',
  Ngn = 'NGN',
  Nio = 'NIO',
  Nok = 'NOK',
  Npr = 'NPR',
  Nzd = 'NZD',
  Omr = 'OMR',
  Pab = 'PAB',
  Pen = 'PEN',
  Pgk = 'PGK',
  Php = 'PHP',
  Pkr = 'PKR',
  Pln = 'PLN',
  Pyg = 'PYG',
  Qar = 'QAR',
  Rol = 'ROL',
  Ron = 'RON',
  Rsd = 'RSD',
  Rub = 'RUB',
  Rwf = 'RWF',
  Sar = 'SAR',
  Sbd = 'SBD',
  Scr = 'SCR',
  Sdg = 'SDG',
  Sek = 'SEK',
  Sgd = 'SGD',
  Shp = 'SHP',
  Skk = 'SKK',
  Sle = 'SLE',
  Sll = 'SLL',
  Sos = 'SOS',
  Srd = 'SRD',
  Ssp = 'SSP',
  Std = 'STD',
  Stn = 'STN',
  Svc = 'SVC',
  Syp = 'SYP',
  Szl = 'SZL',
  Thb = 'THB',
  Tjs = 'TJS',
  Tmt = 'TMT',
  Tnd = 'TND',
  Top = 'TOP',
  Try = 'TRY',
  Ttd = 'TTD',
  Twd = 'TWD',
  Tzs = 'TZS',
  Uah = 'UAH',
  Ugx = 'UGX',
  Usd = 'USD',
  Usn = 'USN',
  Uyi = 'UYI',
  Uyu = 'UYU',
  Uyw = 'UYW',
  Uzs = 'UZS',
  Ved = 'VED',
  Ves = 'VES',
  Vnd = 'VND',
  Vuv = 'VUV',
  Wst = 'WST',
  Xad = 'XAD',
  Xaf = 'XAF',
  Xag = 'XAG',
  Xau = 'XAU',
  Xba = 'XBA',
  Xbb = 'XBB',
  Xbc = 'XBC',
  Xbd = 'XBD',
  Xcd = 'XCD',
  Xcg = 'XCG',
  Xdr = 'XDR',
  Xof = 'XOF',
  Xpd = 'XPD',
  Xpf = 'XPF',
  Xpt = 'XPT',
  Xsu = 'XSU',
  Xts = 'XTS',
  Xua = 'XUA',
  Xxx = 'XXX',
  Yer = 'YER',
  Zar = 'ZAR',
  Zmk = 'ZMK',
  Zmw = 'ZMW',
  Zwg = 'ZWG',
  Zwl = 'ZWL'
}

export type MeUser = {
  __typename?: 'MeUser';
  avatarUrl?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  username: Scalars['String']['output'];
};

export type MergeResult = {
  __typename?: 'MergeResult';
  merged: Scalars['Int']['output'];
  primary: Contact;
};

export type MutateAssetInput = {
  amount: Scalars['Money']['input'];
  assetId?: InputMaybe<Scalars['ID']['input']>;
  code: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  fromAssetId?: InputMaybe<Scalars['ID']['input']>;
  toAssetId?: InputMaybe<Scalars['ID']['input']>;
};

export type MutateAssetResult = AssetSingleMutationResult | AssetTransferResult;

export type Mutation = {
  __typename?: 'Mutation';
  adminDeleteUser: Scalars['Boolean']['output'];
  adminSetUserRole: User;
  cancelInvoice: Invoice;
  createAsset: Asset;
  createContact: Contact;
  createInvoice: Invoice;
  createOrder: Order;
  createOrderExpense: Order;
  createOrderLoan: Order;
  createOrderProductSale: Order;
  createProduct: Product;
  createTransaction: Transaction;
  createUser: User;
  deleteAsset: Scalars['Boolean']['output'];
  deleteContact: Scalars['Boolean']['output'];
  deleteOrder: Scalars['Boolean']['output'];
  deletePasskey: Scalars['Boolean']['output'];
  deleteProduct: Scalars['Boolean']['output'];
  deleteTransaction: Scalars['Boolean']['output'];
  importContacts: ImportResult;
  importProductFromCSV: ImportProductResult;
  issueInvoice: Invoice;
  mergeContacts: MergeResult;
  mutateAsset: MutateAssetResult;
  processPayment: Payment;
  registerPasskey: Scalars['Boolean']['output'];
  retryPayment: Payment;
  signIn: SignInPayload;
  signInWithPassKey: SignInPayload;
  signOut: Scalars['Boolean']['output'];
  signUp: SignUpPayload;
  swapBalance: SwapBalanceResult;
  updateAsset: Asset;
  updateContact: Contact;
  updateOrder: Order;
  updateProduct: Product;
  updateSetting: Setting;
  updateTransaction: Transaction;
  updateUserAvatar: User;
};


export type MutationAdminDeleteUserArgs = {
  userId: Scalars['ID']['input'];
};


export type MutationAdminSetUserRoleArgs = {
  input: AdminSetUserRoleInput;
};


export type MutationCancelInvoiceArgs = {
  id: Scalars['ID']['input'];
};


export type MutationCreateAssetArgs = {
  input: CreateAssetInput;
};


export type MutationCreateContactArgs = {
  input: CreateContactInput;
};


export type MutationCreateInvoiceArgs = {
  input: CreateInvoiceInput;
};


export type MutationCreateOrderArgs = {
  input: CreateOrderInput;
};


export type MutationCreateOrderExpenseArgs = {
  input: CreateOrderExpenseInput;
};


export type MutationCreateOrderLoanArgs = {
  input: CreateOrderLoanInput;
};


export type MutationCreateOrderProductSaleArgs = {
  input: CreateOrderProductSaleInput;
};


export type MutationCreateProductArgs = {
  input: CreateProductInput;
};


export type MutationCreateTransactionArgs = {
  input: CreateTransactionInput;
};


export type MutationCreateUserArgs = {
  input: CreateUserInput;
};


export type MutationDeleteAssetArgs = {
  name: Scalars['String']['input'];
};


export type MutationDeleteContactArgs = {
  id: Scalars['String']['input'];
};


export type MutationDeleteOrderArgs = {
  id: Scalars['String']['input'];
};


export type MutationDeletePasskeyArgs = {
  credentialId: Scalars['String']['input'];
};


export type MutationDeleteProductArgs = {
  id: Scalars['String']['input'];
};


export type MutationDeleteTransactionArgs = {
  id: Scalars['ID']['input'];
};


export type MutationImportContactsArgs = {
  content: Scalars['String']['input'];
  filename: Scalars['String']['input'];
};


export type MutationImportProductFromCsvArgs = {
  content: Scalars['String']['input'];
  filename: Scalars['String']['input'];
};


export type MutationIssueInvoiceArgs = {
  id: Scalars['ID']['input'];
};


export type MutationMergeContactsArgs = {
  phone: Scalars['String']['input'];
};


export type MutationMutateAssetArgs = {
  input: MutateAssetInput;
};


export type MutationProcessPaymentArgs = {
  input: ProcessPaymentInput;
};


export type MutationRegisterPasskeyArgs = {
  input: RegisterPasskeyInput;
};


export type MutationRetryPaymentArgs = {
  paymentId: Scalars['ID']['input'];
};


export type MutationSignInArgs = {
  input: SignInInput;
};


export type MutationSignInWithPassKeyArgs = {
  input: SignInWithPassKeyInput;
};


export type MutationSignUpArgs = {
  input: SignUpInput;
};


export type MutationSwapBalanceArgs = {
  amount: Scalars['Money']['input'];
  fromAssetId: Scalars['ID']['input'];
  toAssetId: Scalars['ID']['input'];
};


export type MutationUpdateAssetArgs = {
  id: Scalars['ID']['input'];
  input: AssetInputUpdate;
};


export type MutationUpdateContactArgs = {
  id: Scalars['String']['input'];
  input: UpdateContactInput;
};


export type MutationUpdateOrderArgs = {
  id: Scalars['String']['input'];
  input: UpdateOrderInput;
};


export type MutationUpdateProductArgs = {
  id: Scalars['String']['input'];
  input: UpdateProductInput;
};


export type MutationUpdateSettingArgs = {
  input: UpdateSettingInput;
};


export type MutationUpdateTransactionArgs = {
  id: Scalars['ID']['input'];
  input: UpdateTransactionInput;
};


export type MutationUpdateUserAvatarArgs = {
  input: UpdateUserAvatarInput;
};

export type Order = {
  __typename?: 'Order';
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  customerId?: Maybe<Scalars['ID']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['ID']['output']>;
  itemCount: Scalars['Int']['output'];
  paymentMethod: PaymentMethodType;
  price: Scalars['Money']['output'];
  status: Scalars['String']['output'];
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  userId?: Maybe<Scalars['ID']['output']>;
};

export type PageInfo = {
  __typename?: 'PageInfo';
  endCursor?: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  startCursor?: Maybe<Scalars['String']['output']>;
};

export type PasskeyAuthenticationOptionsPayload = {
  __typename?: 'PasskeyAuthenticationOptionsPayload';
  challenge: Scalars['String']['output'];
  options: Scalars['String']['output'];
};

export type PasskeyInfo = {
  __typename?: 'PasskeyInfo';
  createdAt: Scalars['DateTime']['output'];
  deviceName?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
};

export type PasskeyRegistrationOptionsPayload = {
  __typename?: 'PasskeyRegistrationOptionsPayload';
  challenge: Scalars['String']['output'];
  options: Scalars['String']['output'];
};

export type Payment = {
  __typename?: 'Payment';
  amount: Scalars['Float']['output'];
  createdAt: Scalars['DateTime']['output'];
  currency: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  gatewayRef?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  invoiceId?: Maybe<Scalars['ID']['output']>;
  maxRetries: Scalars['Int']['output'];
  method: PaymentMethodEnum;
  retryCount: Scalars['Int']['output'];
  status: PaymentStatusEnum;
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  userId: Scalars['ID']['output'];
};

export type PaymentMethod = {
  __typename?: 'PaymentMethod';
  assetId?: Maybe<Scalars['ID']['output']>;
  type: PaymentMethodType;
};

export enum PaymentMethodEnum {
  BankTransfer = 'bank_transfer',
  Cash = 'cash',
  Credit = 'credit',
  CreditCard = 'credit_card',
  DebitCard = 'debit_card',
  Ewallet = 'ewallet'
}

export type PaymentMethodInput = {
  assetId?: InputMaybe<Scalars['ID']['input']>;
  type: PaymentMethodType;
};

export enum PaymentMethodType {
  BankTransfer = 'bank_transfer',
  Cash = 'cash',
  Credit = 'credit',
  CreditCard = 'credit_card',
  DebitCard = 'debit_card',
  Ewallet = 'ewallet'
}

export enum PaymentStatusEnum {
  Cancelled = 'cancelled',
  Completed = 'completed',
  Failed = 'failed',
  Pending = 'pending',
  Processing = 'processing',
  Refunded = 'refunded'
}

export type ProcessPaymentInput = {
  amount: Scalars['Float']['input'];
  currency: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  invoiceId?: InputMaybe<Scalars['ID']['input']>;
  method: PaymentMethodEnum;
};

export type Product = {
  __typename?: 'Product';
  capital?: Maybe<Scalars['Float']['output']>;
  createdAt?: Maybe<Scalars['DateTime']['output']>;
  currency: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['ID']['output']>;
  margin: Scalars['Float']['output'];
  name: Scalars['String']['output'];
  price: Scalars['Float']['output'];
  stock: Scalars['Int']['output'];
  trackStock: Scalars['Boolean']['output'];
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

/**
 * Operasi lintas-user. Hanya untuk user dengan `role: admin` — field di bawah
 * ditandai `@admin`, bukan `@authorized`, sehingga user biasa mendapat 403 dan
 * tanpa token mendapat 401.
 */
export type Query = {
  __typename?: 'Query';
  adminOverview: AdminOverview;
  adminUserTransactions: Array<AdminTransaction>;
  adminUsers: Array<AdminUser>;
  asset?: Maybe<Asset>;
  assetById?: Maybe<Asset>;
  assetMutations: Array<AssetMutationType>;
  assets: Array<Asset>;
  checkAuthorized: Scalars['Boolean']['output'];
  contact?: Maybe<Contact>;
  contactConnection: ContactConnection;
  contacts: Array<Contact>;
  invoice?: Maybe<Invoice>;
  invoices: Array<Invoice>;
  invoicesByStatus: Array<Invoice>;
  me: MeUser;
  order?: Maybe<Order>;
  orders: Array<Order>;
  passkeyAuthenticationOptions: PasskeyAuthenticationOptionsPayload;
  passkeyRegistrationOptions: PasskeyRegistrationOptionsPayload;
  passkeys: Array<PasskeyInfo>;
  payment?: Maybe<Payment>;
  payments: Array<Payment>;
  paymentsByStatus: Array<Payment>;
  product?: Maybe<Product>;
  products: Array<Product>;
  setting: Setting;
  statistics: Statistic;
  transaction?: Maybe<Transaction>;
  transactionConnection: TransactionConnection;
  transactions: Array<Transaction>;
  transactionsByDateRange: Array<Transaction>;
  transactionsByType: Array<Transaction>;
  user?: Maybe<User>;
  users: Array<User>;
};


/**
 * Operasi lintas-user. Hanya untuk user dengan `role: admin` — field di bawah
 * ditandai `@admin`, bukan `@authorized`, sehingga user biasa mendapat 403 dan
 * tanpa token mendapat 401.
 */
export type QueryAdminUserTransactionsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  userId: Scalars['ID']['input'];
};


/**
 * Operasi lintas-user. Hanya untuk user dengan `role: admin` — field di bawah
 * ditandai `@admin`, bukan `@authorized`, sehingga user biasa mendapat 403 dan
 * tanpa token mendapat 401.
 */
export type QueryAssetArgs = {
  name: Scalars['String']['input'];
};


/**
 * Operasi lintas-user. Hanya untuk user dengan `role: admin` — field di bawah
 * ditandai `@admin`, bukan `@authorized`, sehingga user biasa mendapat 403 dan
 * tanpa token mendapat 401.
 */
export type QueryAssetByIdArgs = {
  id: Scalars['ID']['input'];
};


/**
 * Operasi lintas-user. Hanya untuk user dengan `role: admin` — field di bawah
 * ditandai `@admin`, bukan `@authorized`, sehingga user biasa mendapat 403 dan
 * tanpa token mendapat 401.
 */
export type QueryAssetMutationsArgs = {
  assetId: Scalars['ID']['input'];
};


/**
 * Operasi lintas-user. Hanya untuk user dengan `role: admin` — field di bawah
 * ditandai `@admin`, bukan `@authorized`, sehingga user biasa mendapat 403 dan
 * tanpa token mendapat 401.
 */
export type QueryContactArgs = {
  id: Scalars['String']['input'];
};


/**
 * Operasi lintas-user. Hanya untuk user dengan `role: admin` — field di bawah
 * ditandai `@admin`, bukan `@authorized`, sehingga user biasa mendapat 403 dan
 * tanpa token mendapat 401.
 */
export type QueryContactConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


/**
 * Operasi lintas-user. Hanya untuk user dengan `role: admin` — field di bawah
 * ditandai `@admin`, bukan `@authorized`, sehingga user biasa mendapat 403 dan
 * tanpa token mendapat 401.
 */
export type QueryInvoiceArgs = {
  id: Scalars['ID']['input'];
};


/**
 * Operasi lintas-user. Hanya untuk user dengan `role: admin` — field di bawah
 * ditandai `@admin`, bukan `@authorized`, sehingga user biasa mendapat 403 dan
 * tanpa token mendapat 401.
 */
export type QueryInvoicesByStatusArgs = {
  status: InvoiceStatusEnum;
};


/**
 * Operasi lintas-user. Hanya untuk user dengan `role: admin` — field di bawah
 * ditandai `@admin`, bukan `@authorized`, sehingga user biasa mendapat 403 dan
 * tanpa token mendapat 401.
 */
export type QueryOrderArgs = {
  id: Scalars['String']['input'];
};


/**
 * Operasi lintas-user. Hanya untuk user dengan `role: admin` — field di bawah
 * ditandai `@admin`, bukan `@authorized`, sehingga user biasa mendapat 403 dan
 * tanpa token mendapat 401.
 */
export type QueryPaymentArgs = {
  id: Scalars['ID']['input'];
};


/**
 * Operasi lintas-user. Hanya untuk user dengan `role: admin` — field di bawah
 * ditandai `@admin`, bukan `@authorized`, sehingga user biasa mendapat 403 dan
 * tanpa token mendapat 401.
 */
export type QueryPaymentsByStatusArgs = {
  status: PaymentStatusEnum;
};


/**
 * Operasi lintas-user. Hanya untuk user dengan `role: admin` — field di bawah
 * ditandai `@admin`, bukan `@authorized`, sehingga user biasa mendapat 403 dan
 * tanpa token mendapat 401.
 */
export type QueryProductArgs = {
  id: Scalars['String']['input'];
};


/**
 * Operasi lintas-user. Hanya untuk user dengan `role: admin` — field di bawah
 * ditandai `@admin`, bukan `@authorized`, sehingga user biasa mendapat 403 dan
 * tanpa token mendapat 401.
 */
export type QueryTransactionArgs = {
  id: Scalars['String']['input'];
};


/**
 * Operasi lintas-user. Hanya untuk user dengan `role: admin` — field di bawah
 * ditandai `@admin`, bukan `@authorized`, sehingga user biasa mendapat 403 dan
 * tanpa token mendapat 401.
 */
export type QueryTransactionConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


/**
 * Operasi lintas-user. Hanya untuk user dengan `role: admin` — field di bawah
 * ditandai `@admin`, bukan `@authorized`, sehingga user biasa mendapat 403 dan
 * tanpa token mendapat 401.
 */
export type QueryTransactionsByDateRangeArgs = {
  end: Scalars['DateTime']['input'];
  start: Scalars['DateTime']['input'];
};


/**
 * Operasi lintas-user. Hanya untuk user dengan `role: admin` — field di bawah
 * ditandai `@admin`, bukan `@authorized`, sehingga user biasa mendapat 403 dan
 * tanpa token mendapat 401.
 */
export type QueryTransactionsByTypeArgs = {
  type: TransactionType;
};


/**
 * Operasi lintas-user. Hanya untuk user dengan `role: admin` — field di bawah
 * ditandai `@admin`, bukan `@authorized`, sehingga user biasa mendapat 403 dan
 * tanpa token mendapat 401.
 */
export type QueryUserArgs = {
  username: Scalars['String']['input'];
};

export type RegisterPasskeyInput = {
  attestationResponse: Scalars['String']['input'];
  challenge: Scalars['String']['input'];
  deviceName?: InputMaybe<Scalars['String']['input']>;
};

export type Setting = {
  __typename?: 'Setting';
  currency: Scalars['String']['output'];
  darkMode: Scalars['Boolean']['output'];
  dateFormat: Scalars['String']['output'];
  defaultAssetCashId?: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  userId: Scalars['ID']['output'];
};

export type SignInInput = {
  password: Scalars['String']['input'];
  username: Scalars['String']['input'];
};

export type SignInPayload = {
  __typename?: 'SignInPayload';
  refreshToken: Scalars['String']['output'];
  session: Scalars['String']['output'];
  user: User;
};

export type SignInWithPassKeyInput = {
  assertionResponse: Scalars['String']['input'];
  challenge: Scalars['String']['input'];
  credentialId: Scalars['String']['input'];
};

export type SignUpInput = {
  name: Scalars['String']['input'];
  password: Scalars['String']['input'];
  username: Scalars['String']['input'];
};

export type SignUpPayload = {
  __typename?: 'SignUpPayload';
  refreshToken: Scalars['String']['output'];
  session: Scalars['String']['output'];
  user: User;
};

export type Statistic = {
  __typename?: 'Statistic';
  totalAsset: Scalars['Float']['output'];
  totalCash: Scalars['Float']['output'];
  totalExpense: Scalars['Float']['output'];
  totalIncome: Scalars['Float']['output'];
  totalLoan: Scalars['Float']['output'];
  totalProfit: Scalars['Float']['output'];
};

export type SwapBalanceResult = {
  __typename?: 'SwapBalanceResult';
  from: Asset;
  to: Asset;
};

export type Transaction = {
  __typename?: 'Transaction';
  amount: Scalars['Money']['output'];
  capital: Scalars['Money']['output'];
  category?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  customerId?: Maybe<Scalars['ID']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  paymentMethod: PaymentMethod;
  paymentStatus: TransactionPaymentStatus;
  status: TransactionStatus;
  type: TransactionType;
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type TransactionConnection = {
  __typename?: 'TransactionConnection';
  edges: Array<TransactionEdge>;
  pageInfo: PageInfo;
};

export type TransactionEdge = {
  __typename?: 'TransactionEdge';
  cursor: Scalars['String']['output'];
  node: Transaction;
};

export enum TransactionPaymentStatus {
  Paid = 'paid',
  Unpaid = 'unpaid'
}

export enum TransactionStatus {
  Failed = 'failed',
  Pending = 'pending',
  Success = 'success'
}

export enum TransactionType {
  Cash = 'cash',
  Expense = 'expense',
  Income = 'income',
  Outcome = 'outcome',
  Transfer = 'transfer'
}

export type UpdateContactInput = {
  email?: InputMaybe<Scalars['String']['input']>;
  group?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
  phones?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type UpdateOrderInput = {
  customerId?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  paymentMethod?: InputMaybe<PaymentMethodType>;
  status?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateProductInput = {
  capital?: InputMaybe<Scalars['Float']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  price?: InputMaybe<Scalars['Float']['input']>;
  stock?: InputMaybe<Scalars['Int']['input']>;
  trackStock?: InputMaybe<Scalars['Boolean']['input']>;
};

export type UpdateSettingInput = {
  currency?: InputMaybe<Scalars['String']['input']>;
  darkMode?: InputMaybe<Scalars['Boolean']['input']>;
  dateFormat?: InputMaybe<Scalars['String']['input']>;
  defaultAssetCashId?: InputMaybe<Scalars['ID']['input']>;
};

export type UpdateTransactionInput = {
  amount?: InputMaybe<Scalars['Money']['input']>;
  capital?: InputMaybe<Scalars['Money']['input']>;
  category?: InputMaybe<Scalars['String']['input']>;
  customerId: Scalars['ID']['input'];
  date?: InputMaybe<Scalars['DateTimeOrTimestamp']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  paymentMethod?: InputMaybe<PaymentMethodInput>;
  paymentStatus?: InputMaybe<TransactionPaymentStatus>;
  type?: InputMaybe<TransactionType>;
};

export type UpdateUserAvatarInput = {
  avatarUrl?: InputMaybe<Scalars['String']['input']>;
  userId: Scalars['ID']['input'];
};

export type User = {
  __typename?: 'User';
  avatarUrl?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['ID']['output']>;
  name: Scalars['String']['output'];
  username: Scalars['String']['output'];
};

export enum UserRole {
  Admin = 'admin',
  User = 'user'
}



export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = Record<PropertyKey, never>, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;



/** Mapping of union types */
export type ResolversUnionTypes<_RefType extends Record<string, unknown>> = {
  MutateAssetResult:
    | ( AssetSingleMutationResult )
    | ( AssetTransferResult )
  ;
};


/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  AdminOverview: ResolverTypeWrapper<AdminOverview>;
  AdminSetUserRoleInput: AdminSetUserRoleInput;
  AdminTransaction: ResolverTypeWrapper<AdminTransaction>;
  AdminUser: ResolverTypeWrapper<AdminUser>;
  Asset: ResolverTypeWrapper<Asset>;
  AssetInputUpdate: AssetInputUpdate;
  AssetMutationType: ResolverTypeWrapper<AssetMutationType>;
  AssetSingleMutationResult: ResolverTypeWrapper<AssetSingleMutationResult>;
  AssetTransferResult: ResolverTypeWrapper<AssetTransferResult>;
  AssetType: AssetType;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Contact: ResolverTypeWrapper<Contact>;
  ContactConnection: ResolverTypeWrapper<ContactConnection>;
  ContactEdge: ResolverTypeWrapper<ContactEdge>;
  CreateAssetInput: CreateAssetInput;
  CreateContactInput: CreateContactInput;
  CreateInvoiceInput: CreateInvoiceInput;
  CreateOrderExpenseInput: CreateOrderExpenseInput;
  CreateOrderInput: CreateOrderInput;
  CreateOrderLoanInput: CreateOrderLoanInput;
  CreateOrderProductSaleInput: CreateOrderProductSaleInput;
  CreateProductInput: CreateProductInput;
  CreateTransactionInput: CreateTransactionInput;
  CreateUserInput: CreateUserInput;
  DateTime: ResolverTypeWrapper<Scalars['DateTime']['output']>;
  DateTimeOrTimestamp: ResolverTypeWrapper<Scalars['DateTimeOrTimestamp']['output']>;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  ImportProductResult: ResolverTypeWrapper<ImportProductResult>;
  ImportResult: ResolverTypeWrapper<ImportResult>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  Invoice: ResolverTypeWrapper<Invoice>;
  InvoiceItem: ResolverTypeWrapper<InvoiceItem>;
  InvoiceItemInput: InvoiceItemInput;
  InvoiceStatusEnum: InvoiceStatusEnum;
  IsoCurrency: IsoCurrency;
  MeUser: ResolverTypeWrapper<MeUser>;
  MergeResult: ResolverTypeWrapper<MergeResult>;
  Money: ResolverTypeWrapper<Scalars['Money']['output']>;
  MutateAssetInput: MutateAssetInput;
  MutateAssetResult: ResolverTypeWrapper<ResolversUnionTypes<ResolversTypes>['MutateAssetResult']>;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Order: ResolverTypeWrapper<Order>;
  PageInfo: ResolverTypeWrapper<PageInfo>;
  PasskeyAuthenticationOptionsPayload: ResolverTypeWrapper<PasskeyAuthenticationOptionsPayload>;
  PasskeyInfo: ResolverTypeWrapper<PasskeyInfo>;
  PasskeyRegistrationOptionsPayload: ResolverTypeWrapper<PasskeyRegistrationOptionsPayload>;
  Payment: ResolverTypeWrapper<Payment>;
  PaymentMethod: ResolverTypeWrapper<PaymentMethod>;
  PaymentMethodEnum: PaymentMethodEnum;
  PaymentMethodInput: PaymentMethodInput;
  PaymentMethodType: PaymentMethodType;
  PaymentStatusEnum: PaymentStatusEnum;
  ProcessPaymentInput: ProcessPaymentInput;
  Product: ResolverTypeWrapper<Product>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  RegisterPasskeyInput: RegisterPasskeyInput;
  Setting: ResolverTypeWrapper<Setting>;
  SignInInput: SignInInput;
  SignInPayload: ResolverTypeWrapper<SignInPayload>;
  SignInWithPassKeyInput: SignInWithPassKeyInput;
  SignUpInput: SignUpInput;
  SignUpPayload: ResolverTypeWrapper<SignUpPayload>;
  Statistic: ResolverTypeWrapper<Statistic>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  SwapBalanceResult: ResolverTypeWrapper<SwapBalanceResult>;
  Timestamp: ResolverTypeWrapper<Scalars['Timestamp']['output']>;
  Transaction: ResolverTypeWrapper<Transaction>;
  TransactionConnection: ResolverTypeWrapper<TransactionConnection>;
  TransactionEdge: ResolverTypeWrapper<TransactionEdge>;
  TransactionPaymentStatus: TransactionPaymentStatus;
  TransactionStatus: TransactionStatus;
  TransactionType: TransactionType;
  UpdateContactInput: UpdateContactInput;
  UpdateOrderInput: UpdateOrderInput;
  UpdateProductInput: UpdateProductInput;
  UpdateSettingInput: UpdateSettingInput;
  UpdateTransactionInput: UpdateTransactionInput;
  UpdateUserAvatarInput: UpdateUserAvatarInput;
  User: ResolverTypeWrapper<User>;
  UserRole: UserRole;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  AdminOverview: AdminOverview;
  AdminSetUserRoleInput: AdminSetUserRoleInput;
  AdminTransaction: AdminTransaction;
  AdminUser: AdminUser;
  Asset: Asset;
  AssetInputUpdate: AssetInputUpdate;
  AssetMutationType: AssetMutationType;
  AssetSingleMutationResult: AssetSingleMutationResult;
  AssetTransferResult: AssetTransferResult;
  Boolean: Scalars['Boolean']['output'];
  Contact: Contact;
  ContactConnection: ContactConnection;
  ContactEdge: ContactEdge;
  CreateAssetInput: CreateAssetInput;
  CreateContactInput: CreateContactInput;
  CreateInvoiceInput: CreateInvoiceInput;
  CreateOrderExpenseInput: CreateOrderExpenseInput;
  CreateOrderInput: CreateOrderInput;
  CreateOrderLoanInput: CreateOrderLoanInput;
  CreateOrderProductSaleInput: CreateOrderProductSaleInput;
  CreateProductInput: CreateProductInput;
  CreateTransactionInput: CreateTransactionInput;
  CreateUserInput: CreateUserInput;
  DateTime: Scalars['DateTime']['output'];
  DateTimeOrTimestamp: Scalars['DateTimeOrTimestamp']['output'];
  Float: Scalars['Float']['output'];
  ID: Scalars['ID']['output'];
  ImportProductResult: ImportProductResult;
  ImportResult: ImportResult;
  Int: Scalars['Int']['output'];
  Invoice: Invoice;
  InvoiceItem: InvoiceItem;
  InvoiceItemInput: InvoiceItemInput;
  MeUser: MeUser;
  MergeResult: MergeResult;
  Money: Scalars['Money']['output'];
  MutateAssetInput: MutateAssetInput;
  MutateAssetResult: ResolversUnionTypes<ResolversParentTypes>['MutateAssetResult'];
  Mutation: Record<PropertyKey, never>;
  Order: Order;
  PageInfo: PageInfo;
  PasskeyAuthenticationOptionsPayload: PasskeyAuthenticationOptionsPayload;
  PasskeyInfo: PasskeyInfo;
  PasskeyRegistrationOptionsPayload: PasskeyRegistrationOptionsPayload;
  Payment: Payment;
  PaymentMethod: PaymentMethod;
  PaymentMethodInput: PaymentMethodInput;
  ProcessPaymentInput: ProcessPaymentInput;
  Product: Product;
  Query: Record<PropertyKey, never>;
  RegisterPasskeyInput: RegisterPasskeyInput;
  Setting: Setting;
  SignInInput: SignInInput;
  SignInPayload: SignInPayload;
  SignInWithPassKeyInput: SignInWithPassKeyInput;
  SignUpInput: SignUpInput;
  SignUpPayload: SignUpPayload;
  Statistic: Statistic;
  String: Scalars['String']['output'];
  SwapBalanceResult: SwapBalanceResult;
  Timestamp: Scalars['Timestamp']['output'];
  Transaction: Transaction;
  TransactionConnection: TransactionConnection;
  TransactionEdge: TransactionEdge;
  UpdateContactInput: UpdateContactInput;
  UpdateOrderInput: UpdateOrderInput;
  UpdateProductInput: UpdateProductInput;
  UpdateSettingInput: UpdateSettingInput;
  UpdateTransactionInput: UpdateTransactionInput;
  UpdateUserAvatarInput: UpdateUserAvatarInput;
  User: User;
};

export type AdminOverviewResolvers<ContextType = any, ParentType extends ResolversParentTypes['AdminOverview'] = ResolversParentTypes['AdminOverview']> = {
  totalAdmins?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalAssets?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalExpense?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  totalIncome?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  totalTransactions?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalUsers?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type AdminTransactionResolvers<ContextType = any, ParentType extends ResolversParentTypes['AdminTransaction'] = ResolversParentTypes['AdminTransaction']> = {
  amount?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  capital?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  category?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  date?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  paymentStatus?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  userId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
};

export type AdminUserResolvers<ContextType = any, ParentType extends ResolversParentTypes['AdminUser'] = ResolversParentTypes['AdminUser']> = {
  avatarUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  email?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  role?: Resolver<ResolversTypes['UserRole'], ParentType, ContextType>;
  username?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type AssetResolvers<ContextType = any, ParentType extends ResolversParentTypes['Asset'] = ResolversParentTypes['Asset']> = {
  balance?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['AssetType'], ParentType, ContextType>;
};

export type AssetMutationTypeResolvers<ContextType = any, ParentType extends ResolversParentTypes['AssetMutationType'] = ResolversParentTypes['AssetMutationType']> = {
  amount?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  balanceAfter?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
  balanceBefore?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  currency?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type AssetSingleMutationResultResolvers<ContextType = any, ParentType extends ResolversParentTypes['AssetSingleMutationResult'] = ResolversParentTypes['AssetSingleMutationResult']> = {
  asset?: Resolver<ResolversTypes['Asset'], ParentType, ContextType>;
  code?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type AssetTransferResultResolvers<ContextType = any, ParentType extends ResolversParentTypes['AssetTransferResult'] = ResolversParentTypes['AssetTransferResult']> = {
  code?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  from?: Resolver<ResolversTypes['Asset'], ParentType, ContextType>;
  to?: Resolver<ResolversTypes['Asset'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ContactResolvers<ContextType = any, ParentType extends ResolversParentTypes['Contact'] = ResolversParentTypes['Contact']> = {
  avatar?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  createdAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  email?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  group?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  phone?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  phones?: Resolver<Maybe<Array<ResolversTypes['String']>>, ParentType, ContextType>;
  updatedAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  userId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
};

export type ContactConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['ContactConnection'] = ResolversParentTypes['ContactConnection']> = {
  edges?: Resolver<Array<ResolversTypes['ContactEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
};

export type ContactEdgeResolvers<ContextType = any, ParentType extends ResolversParentTypes['ContactEdge'] = ResolversParentTypes['ContactEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['Contact'], ParentType, ContextType>;
};

export interface DateTimeScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['DateTime'], any> {
  name: 'DateTime';
}

export interface DateTimeOrTimestampScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['DateTimeOrTimestamp'], any> {
  name: 'DateTimeOrTimestamp';
}

export type ImportProductResultResolvers<ContextType = any, ParentType extends ResolversParentTypes['ImportProductResult'] = ResolversParentTypes['ImportProductResult']> = {
  failed?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  imported?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  merged?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type ImportResultResolvers<ContextType = any, ParentType extends ResolversParentTypes['ImportResult'] = ResolversParentTypes['ImportResult']> = {
  failed?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  imported?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  merged?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type InvoiceResolvers<ContextType = any, ParentType extends ResolversParentTypes['Invoice'] = ResolversParentTypes['Invoice']> = {
  createdAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  currency?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  customerId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  dueAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  invoiceNumber?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  issuedAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  items?: Resolver<Array<ResolversTypes['InvoiceItem']>, ParentType, ContextType>;
  paidAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  status?: Resolver<ResolversTypes['InvoiceStatusEnum'], ParentType, ContextType>;
  subtotal?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  tax?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  totalAmount?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  updatedAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  userId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
};

export type InvoiceItemResolvers<ContextType = any, ParentType extends ResolversParentTypes['InvoiceItem'] = ResolversParentTypes['InvoiceItem']> = {
  description?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  quantity?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  unitPrice?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
};

export type MeUserResolvers<ContextType = any, ParentType extends ResolversParentTypes['MeUser'] = ResolversParentTypes['MeUser']> = {
  avatarUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  username?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type MergeResultResolvers<ContextType = any, ParentType extends ResolversParentTypes['MergeResult'] = ResolversParentTypes['MergeResult']> = {
  merged?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  primary?: Resolver<ResolversTypes['Contact'], ParentType, ContextType>;
};

export interface MoneyScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['Money'], any> {
  name: 'Money';
}

export type MutateAssetResultResolvers<ContextType = any, ParentType extends ResolversParentTypes['MutateAssetResult'] = ResolversParentTypes['MutateAssetResult']> = {
  __resolveType: TypeResolveFn<'AssetSingleMutationResult' | 'AssetTransferResult', ParentType, ContextType>;
};

export type MutationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  adminDeleteUser?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationAdminDeleteUserArgs, 'userId'>>;
  adminSetUserRole?: Resolver<ResolversTypes['User'], ParentType, ContextType, RequireFields<MutationAdminSetUserRoleArgs, 'input'>>;
  cancelInvoice?: Resolver<ResolversTypes['Invoice'], ParentType, ContextType, RequireFields<MutationCancelInvoiceArgs, 'id'>>;
  createAsset?: Resolver<ResolversTypes['Asset'], ParentType, ContextType, RequireFields<MutationCreateAssetArgs, 'input'>>;
  createContact?: Resolver<ResolversTypes['Contact'], ParentType, ContextType, RequireFields<MutationCreateContactArgs, 'input'>>;
  createInvoice?: Resolver<ResolversTypes['Invoice'], ParentType, ContextType, RequireFields<MutationCreateInvoiceArgs, 'input'>>;
  createOrder?: Resolver<ResolversTypes['Order'], ParentType, ContextType, RequireFields<MutationCreateOrderArgs, 'input'>>;
  createOrderExpense?: Resolver<ResolversTypes['Order'], ParentType, ContextType, RequireFields<MutationCreateOrderExpenseArgs, 'input'>>;
  createOrderLoan?: Resolver<ResolversTypes['Order'], ParentType, ContextType, RequireFields<MutationCreateOrderLoanArgs, 'input'>>;
  createOrderProductSale?: Resolver<ResolversTypes['Order'], ParentType, ContextType, RequireFields<MutationCreateOrderProductSaleArgs, 'input'>>;
  createProduct?: Resolver<ResolversTypes['Product'], ParentType, ContextType, RequireFields<MutationCreateProductArgs, 'input'>>;
  createTransaction?: Resolver<ResolversTypes['Transaction'], ParentType, ContextType, RequireFields<MutationCreateTransactionArgs, 'input'>>;
  createUser?: Resolver<ResolversTypes['User'], ParentType, ContextType, RequireFields<MutationCreateUserArgs, 'input'>>;
  deleteAsset?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationDeleteAssetArgs, 'name'>>;
  deleteContact?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationDeleteContactArgs, 'id'>>;
  deleteOrder?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationDeleteOrderArgs, 'id'>>;
  deletePasskey?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationDeletePasskeyArgs, 'credentialId'>>;
  deleteProduct?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationDeleteProductArgs, 'id'>>;
  deleteTransaction?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationDeleteTransactionArgs, 'id'>>;
  importContacts?: Resolver<ResolversTypes['ImportResult'], ParentType, ContextType, RequireFields<MutationImportContactsArgs, 'content' | 'filename'>>;
  importProductFromCSV?: Resolver<ResolversTypes['ImportProductResult'], ParentType, ContextType, RequireFields<MutationImportProductFromCsvArgs, 'content' | 'filename'>>;
  issueInvoice?: Resolver<ResolversTypes['Invoice'], ParentType, ContextType, RequireFields<MutationIssueInvoiceArgs, 'id'>>;
  mergeContacts?: Resolver<ResolversTypes['MergeResult'], ParentType, ContextType, RequireFields<MutationMergeContactsArgs, 'phone'>>;
  mutateAsset?: Resolver<ResolversTypes['MutateAssetResult'], ParentType, ContextType, RequireFields<MutationMutateAssetArgs, 'input'>>;
  processPayment?: Resolver<ResolversTypes['Payment'], ParentType, ContextType, RequireFields<MutationProcessPaymentArgs, 'input'>>;
  registerPasskey?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationRegisterPasskeyArgs, 'input'>>;
  retryPayment?: Resolver<ResolversTypes['Payment'], ParentType, ContextType, RequireFields<MutationRetryPaymentArgs, 'paymentId'>>;
  signIn?: Resolver<ResolversTypes['SignInPayload'], ParentType, ContextType, RequireFields<MutationSignInArgs, 'input'>>;
  signInWithPassKey?: Resolver<ResolversTypes['SignInPayload'], ParentType, ContextType, RequireFields<MutationSignInWithPassKeyArgs, 'input'>>;
  signOut?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  signUp?: Resolver<ResolversTypes['SignUpPayload'], ParentType, ContextType, RequireFields<MutationSignUpArgs, 'input'>>;
  swapBalance?: Resolver<ResolversTypes['SwapBalanceResult'], ParentType, ContextType, RequireFields<MutationSwapBalanceArgs, 'amount' | 'fromAssetId' | 'toAssetId'>>;
  updateAsset?: Resolver<ResolversTypes['Asset'], ParentType, ContextType, RequireFields<MutationUpdateAssetArgs, 'id' | 'input'>>;
  updateContact?: Resolver<ResolversTypes['Contact'], ParentType, ContextType, RequireFields<MutationUpdateContactArgs, 'id' | 'input'>>;
  updateOrder?: Resolver<ResolversTypes['Order'], ParentType, ContextType, RequireFields<MutationUpdateOrderArgs, 'id' | 'input'>>;
  updateProduct?: Resolver<ResolversTypes['Product'], ParentType, ContextType, RequireFields<MutationUpdateProductArgs, 'id' | 'input'>>;
  updateSetting?: Resolver<ResolversTypes['Setting'], ParentType, ContextType, RequireFields<MutationUpdateSettingArgs, 'input'>>;
  updateTransaction?: Resolver<ResolversTypes['Transaction'], ParentType, ContextType, RequireFields<MutationUpdateTransactionArgs, 'id' | 'input'>>;
  updateUserAvatar?: Resolver<ResolversTypes['User'], ParentType, ContextType, RequireFields<MutationUpdateUserAvatarArgs, 'input'>>;
};

export type OrderResolvers<ContextType = any, ParentType extends ResolversParentTypes['Order'] = ResolversParentTypes['Order']> = {
  createdAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  customerId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  itemCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  paymentMethod?: Resolver<ResolversTypes['PaymentMethodType'], ParentType, ContextType>;
  price?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  userId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
};

export type PageInfoResolvers<ContextType = any, ParentType extends ResolversParentTypes['PageInfo'] = ResolversParentTypes['PageInfo']> = {
  endCursor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  hasNextPage?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  hasPreviousPage?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  startCursor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type PasskeyAuthenticationOptionsPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['PasskeyAuthenticationOptionsPayload'] = ResolversParentTypes['PasskeyAuthenticationOptionsPayload']> = {
  challenge?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  options?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type PasskeyInfoResolvers<ContextType = any, ParentType extends ResolversParentTypes['PasskeyInfo'] = ResolversParentTypes['PasskeyInfo']> = {
  createdAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  deviceName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type PasskeyRegistrationOptionsPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['PasskeyRegistrationOptionsPayload'] = ResolversParentTypes['PasskeyRegistrationOptionsPayload']> = {
  challenge?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  options?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type PaymentResolvers<ContextType = any, ParentType extends ResolversParentTypes['Payment'] = ResolversParentTypes['Payment']> = {
  amount?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  currency?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  gatewayRef?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  invoiceId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  maxRetries?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  method?: Resolver<ResolversTypes['PaymentMethodEnum'], ParentType, ContextType>;
  retryCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['PaymentStatusEnum'], ParentType, ContextType>;
  updatedAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  userId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
};

export type PaymentMethodResolvers<ContextType = any, ParentType extends ResolversParentTypes['PaymentMethod'] = ResolversParentTypes['PaymentMethod']> = {
  assetId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  type?: Resolver<ResolversTypes['PaymentMethodType'], ParentType, ContextType>;
};

export type ProductResolvers<ContextType = any, ParentType extends ResolversParentTypes['Product'] = ResolversParentTypes['Product']> = {
  capital?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  createdAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  currency?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  margin?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  price?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  stock?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  trackStock?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  updatedAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
};

export type QueryResolvers<ContextType = any, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  adminOverview?: Resolver<ResolversTypes['AdminOverview'], ParentType, ContextType>;
  adminUserTransactions?: Resolver<Array<ResolversTypes['AdminTransaction']>, ParentType, ContextType, RequireFields<QueryAdminUserTransactionsArgs, 'userId'>>;
  adminUsers?: Resolver<Array<ResolversTypes['AdminUser']>, ParentType, ContextType>;
  asset?: Resolver<Maybe<ResolversTypes['Asset']>, ParentType, ContextType, RequireFields<QueryAssetArgs, 'name'>>;
  assetById?: Resolver<Maybe<ResolversTypes['Asset']>, ParentType, ContextType, RequireFields<QueryAssetByIdArgs, 'id'>>;
  assetMutations?: Resolver<Array<ResolversTypes['AssetMutationType']>, ParentType, ContextType, RequireFields<QueryAssetMutationsArgs, 'assetId'>>;
  assets?: Resolver<Array<ResolversTypes['Asset']>, ParentType, ContextType>;
  checkAuthorized?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  contact?: Resolver<Maybe<ResolversTypes['Contact']>, ParentType, ContextType, RequireFields<QueryContactArgs, 'id'>>;
  contactConnection?: Resolver<ResolversTypes['ContactConnection'], ParentType, ContextType, Partial<QueryContactConnectionArgs>>;
  contacts?: Resolver<Array<ResolversTypes['Contact']>, ParentType, ContextType>;
  invoice?: Resolver<Maybe<ResolversTypes['Invoice']>, ParentType, ContextType, RequireFields<QueryInvoiceArgs, 'id'>>;
  invoices?: Resolver<Array<ResolversTypes['Invoice']>, ParentType, ContextType>;
  invoicesByStatus?: Resolver<Array<ResolversTypes['Invoice']>, ParentType, ContextType, RequireFields<QueryInvoicesByStatusArgs, 'status'>>;
  me?: Resolver<ResolversTypes['MeUser'], ParentType, ContextType>;
  order?: Resolver<Maybe<ResolversTypes['Order']>, ParentType, ContextType, RequireFields<QueryOrderArgs, 'id'>>;
  orders?: Resolver<Array<ResolversTypes['Order']>, ParentType, ContextType>;
  passkeyAuthenticationOptions?: Resolver<ResolversTypes['PasskeyAuthenticationOptionsPayload'], ParentType, ContextType>;
  passkeyRegistrationOptions?: Resolver<ResolversTypes['PasskeyRegistrationOptionsPayload'], ParentType, ContextType>;
  passkeys?: Resolver<Array<ResolversTypes['PasskeyInfo']>, ParentType, ContextType>;
  payment?: Resolver<Maybe<ResolversTypes['Payment']>, ParentType, ContextType, RequireFields<QueryPaymentArgs, 'id'>>;
  payments?: Resolver<Array<ResolversTypes['Payment']>, ParentType, ContextType>;
  paymentsByStatus?: Resolver<Array<ResolversTypes['Payment']>, ParentType, ContextType, RequireFields<QueryPaymentsByStatusArgs, 'status'>>;
  product?: Resolver<Maybe<ResolversTypes['Product']>, ParentType, ContextType, RequireFields<QueryProductArgs, 'id'>>;
  products?: Resolver<Array<ResolversTypes['Product']>, ParentType, ContextType>;
  setting?: Resolver<ResolversTypes['Setting'], ParentType, ContextType>;
  statistics?: Resolver<ResolversTypes['Statistic'], ParentType, ContextType>;
  transaction?: Resolver<Maybe<ResolversTypes['Transaction']>, ParentType, ContextType, RequireFields<QueryTransactionArgs, 'id'>>;
  transactionConnection?: Resolver<ResolversTypes['TransactionConnection'], ParentType, ContextType, Partial<QueryTransactionConnectionArgs>>;
  transactions?: Resolver<Array<ResolversTypes['Transaction']>, ParentType, ContextType>;
  transactionsByDateRange?: Resolver<Array<ResolversTypes['Transaction']>, ParentType, ContextType, RequireFields<QueryTransactionsByDateRangeArgs, 'end' | 'start'>>;
  transactionsByType?: Resolver<Array<ResolversTypes['Transaction']>, ParentType, ContextType, RequireFields<QueryTransactionsByTypeArgs, 'type'>>;
  user?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType, RequireFields<QueryUserArgs, 'username'>>;
  users?: Resolver<Array<ResolversTypes['User']>, ParentType, ContextType>;
};

export type SettingResolvers<ContextType = any, ParentType extends ResolversParentTypes['Setting'] = ResolversParentTypes['Setting']> = {
  currency?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  darkMode?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  dateFormat?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  defaultAssetCashId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  userId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
};

export type SignInPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['SignInPayload'] = ResolversParentTypes['SignInPayload']> = {
  refreshToken?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  session?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  user?: Resolver<ResolversTypes['User'], ParentType, ContextType>;
};

export type SignUpPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['SignUpPayload'] = ResolversParentTypes['SignUpPayload']> = {
  refreshToken?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  session?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  user?: Resolver<ResolversTypes['User'], ParentType, ContextType>;
};

export type StatisticResolvers<ContextType = any, ParentType extends ResolversParentTypes['Statistic'] = ResolversParentTypes['Statistic']> = {
  totalAsset?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  totalCash?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  totalExpense?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  totalIncome?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  totalLoan?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  totalProfit?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
};

export type SwapBalanceResultResolvers<ContextType = any, ParentType extends ResolversParentTypes['SwapBalanceResult'] = ResolversParentTypes['SwapBalanceResult']> = {
  from?: Resolver<ResolversTypes['Asset'], ParentType, ContextType>;
  to?: Resolver<ResolversTypes['Asset'], ParentType, ContextType>;
};

export interface TimestampScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['Timestamp'], any> {
  name: 'Timestamp';
}

export type TransactionResolvers<ContextType = any, ParentType extends ResolversParentTypes['Transaction'] = ResolversParentTypes['Transaction']> = {
  amount?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
  capital?: Resolver<ResolversTypes['Money'], ParentType, ContextType>;
  category?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  customerId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  paymentMethod?: Resolver<ResolversTypes['PaymentMethod'], ParentType, ContextType>;
  paymentStatus?: Resolver<ResolversTypes['TransactionPaymentStatus'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['TransactionStatus'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['TransactionType'], ParentType, ContextType>;
  updatedAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
};

export type TransactionConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['TransactionConnection'] = ResolversParentTypes['TransactionConnection']> = {
  edges?: Resolver<Array<ResolversTypes['TransactionEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
};

export type TransactionEdgeResolvers<ContextType = any, ParentType extends ResolversParentTypes['TransactionEdge'] = ResolversParentTypes['TransactionEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['Transaction'], ParentType, ContextType>;
};

export type UserResolvers<ContextType = any, ParentType extends ResolversParentTypes['User'] = ResolversParentTypes['User']> = {
  avatarUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  username?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type Resolvers<ContextType = any> = {
  AdminOverview?: AdminOverviewResolvers<ContextType>;
  AdminTransaction?: AdminTransactionResolvers<ContextType>;
  AdminUser?: AdminUserResolvers<ContextType>;
  Asset?: AssetResolvers<ContextType>;
  AssetMutationType?: AssetMutationTypeResolvers<ContextType>;
  AssetSingleMutationResult?: AssetSingleMutationResultResolvers<ContextType>;
  AssetTransferResult?: AssetTransferResultResolvers<ContextType>;
  Contact?: ContactResolvers<ContextType>;
  ContactConnection?: ContactConnectionResolvers<ContextType>;
  ContactEdge?: ContactEdgeResolvers<ContextType>;
  DateTime?: GraphQLScalarType;
  DateTimeOrTimestamp?: GraphQLScalarType;
  ImportProductResult?: ImportProductResultResolvers<ContextType>;
  ImportResult?: ImportResultResolvers<ContextType>;
  Invoice?: InvoiceResolvers<ContextType>;
  InvoiceItem?: InvoiceItemResolvers<ContextType>;
  MeUser?: MeUserResolvers<ContextType>;
  MergeResult?: MergeResultResolvers<ContextType>;
  Money?: GraphQLScalarType;
  MutateAssetResult?: MutateAssetResultResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Order?: OrderResolvers<ContextType>;
  PageInfo?: PageInfoResolvers<ContextType>;
  PasskeyAuthenticationOptionsPayload?: PasskeyAuthenticationOptionsPayloadResolvers<ContextType>;
  PasskeyInfo?: PasskeyInfoResolvers<ContextType>;
  PasskeyRegistrationOptionsPayload?: PasskeyRegistrationOptionsPayloadResolvers<ContextType>;
  Payment?: PaymentResolvers<ContextType>;
  PaymentMethod?: PaymentMethodResolvers<ContextType>;
  Product?: ProductResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Setting?: SettingResolvers<ContextType>;
  SignInPayload?: SignInPayloadResolvers<ContextType>;
  SignUpPayload?: SignUpPayloadResolvers<ContextType>;
  Statistic?: StatisticResolvers<ContextType>;
  SwapBalanceResult?: SwapBalanceResultResolvers<ContextType>;
  Timestamp?: GraphQLScalarType;
  Transaction?: TransactionResolvers<ContextType>;
  TransactionConnection?: TransactionConnectionResolvers<ContextType>;
  TransactionEdge?: TransactionEdgeResolvers<ContextType>;
  User?: UserResolvers<ContextType>;
};

