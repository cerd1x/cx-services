import type { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from "graphql";
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  DateTime: { input: Date; output: Date };
  DateTimeOrTimestamp: { input: Date; output: Date };
  Timestamp: { input: number; output: number };
};

export type Asset = {
  __typename?: "Asset";
  balance: Scalars["String"]["output"];
  id: Scalars["ID"]["output"];
  name: Scalars["String"]["output"];
  type: AssetType;
};

export type AssetInputUpdate = {
  balance?: InputMaybe<Scalars["String"]["input"]>;
  currency?: InputMaybe<Scalars["String"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  type?: InputMaybe<AssetType>;
};

export type AssetMutationType = {
  __typename?: "AssetMutationType";
  amount: Scalars["Float"]["output"];
  balanceAfter: Scalars["String"]["output"];
  balanceBefore: Scalars["String"]["output"];
  createdAt: Scalars["String"]["output"];
  currency: Scalars["String"]["output"];
  description?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["ID"]["output"];
  type: Scalars["String"]["output"];
};

export enum AssetType {
  Bank = "bank",
  Cash = "cash",
  Crypto = "crypto",
  Ewallet = "ewallet",
  Loan = "loan",
}

export type Contact = {
  __typename?: "Contact";
  avatar?: Maybe<Scalars["String"]["output"]>;
  createdAt?: Maybe<Scalars["DateTime"]["output"]>;
  email?: Maybe<Scalars["String"]["output"]>;
  group?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["ID"]["output"];
  name: Scalars["String"]["output"];
  phone?: Maybe<Scalars["String"]["output"]>;
  updatedAt?: Maybe<Scalars["DateTime"]["output"]>;
  userId: Scalars["ID"]["output"];
};

export type CreateAssetInput = {
  balance: Scalars["String"]["input"];
  name: Scalars["String"]["input"];
  type: AssetType;
};

export type CreateContactInput = {
  avatar?: InputMaybe<Scalars["String"]["input"]>;
  email?: InputMaybe<Scalars["String"]["input"]>;
  group?: InputMaybe<Scalars["String"]["input"]>;
  name: Scalars["String"]["input"];
  phone?: InputMaybe<Scalars["String"]["input"]>;
  userId?: InputMaybe<Scalars["ID"]["input"]>;
};

export type CreateProductInput = {
  amount: Scalars["Float"]["input"];
  capital?: InputMaybe<Scalars["Float"]["input"]>;
  currency: Scalars["String"]["input"];
  description?: InputMaybe<Scalars["String"]["input"]>;
  name: Scalars["String"]["input"];
  stock?: InputMaybe<Scalars["Int"]["input"]>;
};

export type CreateTransactionInput = {
  amount: Scalars["String"]["input"];
  capital: Scalars["String"]["input"];
  category?: InputMaybe<Scalars["String"]["input"]>;
  customerId: Scalars["ID"]["input"];
  date: Scalars["DateTimeOrTimestamp"]["input"];
  description?: InputMaybe<Scalars["String"]["input"]>;
  payToAssetId?: InputMaybe<Scalars["ID"]["input"]>;
  payWithAssetId?: InputMaybe<Scalars["ID"]["input"]>;
  paymentMethod?: InputMaybe<PaymentMethod>;
  status?: InputMaybe<TransactionStatus>;
  type: TransactionType;
};

export type CreateUserInput = {
  name: Scalars["String"]["input"];
  password: Scalars["String"]["input"];
  username: Scalars["String"]["input"];
};

export type MeUser = {
  __typename?: "MeUser";
  avatarUrl?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["ID"]["output"];
  name: Scalars["String"]["output"];
  username: Scalars["String"]["output"];
};

export type Mutation = {
  __typename?: "Mutation";
  addBalance: Asset;
  createAsset: Asset;
  createContact: Contact;
  createProduct: Product;
  createTransaction: Transaction;
  createUser: User;
  deleteAsset: Scalars["Boolean"]["output"];
  deleteContact: Scalars["Boolean"]["output"];
  deleteProduct: Scalars["Boolean"]["output"];
  deleteTransaction: Scalars["Boolean"]["output"];
  signIn: SignInPayload;
  signOut: Scalars["Boolean"]["output"];
  signUp: SignUpPayload;
  updateAsset: Asset;
  updateContact: Contact;
  updateProduct: Product;
  updateSetting: Setting;
  updateTransaction: Transaction;
  updateUserAvatar: User;
};

export type MutationAddBalanceArgs = {
  amount: Scalars["String"]["input"];
  assetId: Scalars["ID"]["input"];
};

export type MutationCreateAssetArgs = {
  input: CreateAssetInput;
};

export type MutationCreateContactArgs = {
  input: CreateContactInput;
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
  name: Scalars["String"]["input"];
};

export type MutationDeleteContactArgs = {
  id: Scalars["String"]["input"];
};

export type MutationDeleteProductArgs = {
  id: Scalars["String"]["input"];
};

export type MutationDeleteTransactionArgs = {
  id: Scalars["ID"]["input"];
};

export type MutationSignInArgs = {
  input: SignInInput;
};

export type MutationSignOutArgs = {
  input: SignOutInput;
};

export type MutationSignUpArgs = {
  input: SignUpInput;
};

export type MutationUpdateAssetArgs = {
  id: Scalars["ID"]["input"];
  input: AssetInputUpdate;
};

export type MutationUpdateContactArgs = {
  id: Scalars["String"]["input"];
  input: UpdateContactInput;
};

export type MutationUpdateProductArgs = {
  id: Scalars["String"]["input"];
  input: UpdateProductInput;
};

export type MutationUpdateSettingArgs = {
  input: UpdateSettingInput;
};

export type MutationUpdateTransactionArgs = {
  id: Scalars["ID"]["input"];
  input: UpdateTransactionInput;
};

export type MutationUpdateUserAvatarArgs = {
  input: UpdateUserAvatarInput;
};

export enum PaymentMethod {
  BankTransfer = "bank_transfer",
  Cash = "cash",
  Credit = "credit",
  CreditCard = "credit_card",
  DebitCard = "debit_card",
  Ewallet = "ewallet",
}

export type Product = {
  __typename?: "Product";
  amount: Scalars["Float"]["output"];
  capital?: Maybe<Scalars["Float"]["output"]>;
  createdAt?: Maybe<Scalars["DateTime"]["output"]>;
  currency: Scalars["String"]["output"];
  description?: Maybe<Scalars["String"]["output"]>;
  id?: Maybe<Scalars["ID"]["output"]>;
  margin: Scalars["Float"]["output"];
  name: Scalars["String"]["output"];
  stock: Scalars["Int"]["output"];
  updatedAt?: Maybe<Scalars["DateTime"]["output"]>;
};

export type Query = {
  __typename?: "Query";
  asset?: Maybe<Asset>;
  assetById?: Maybe<Asset>;
  assetMutations: Array<AssetMutationType>;
  assets: Array<Asset>;
  checkAuthorized: Scalars["Boolean"]["output"];
  contact?: Maybe<Contact>;
  contacts: Array<Contact>;
  me: MeUser;
  product?: Maybe<Product>;
  products: Array<Product>;
  setting: Setting;
  transaction?: Maybe<Transaction>;
  transactions: Array<Transaction>;
  transactionsByDateRange: Array<Transaction>;
  transactionsByType: Array<Transaction>;
  user?: Maybe<User>;
  users: Array<User>;
};

export type QueryAssetArgs = {
  name: Scalars["String"]["input"];
};

export type QueryAssetByIdArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryAssetMutationsArgs = {
  assetId: Scalars["ID"]["input"];
};

export type QueryCheckAuthorizedArgs = {
  session: Scalars["String"]["input"];
};

export type QueryContactArgs = {
  id: Scalars["String"]["input"];
};

export type QueryProductArgs = {
  id: Scalars["String"]["input"];
};

export type QueryTransactionArgs = {
  id: Scalars["String"]["input"];
};

export type QueryTransactionsByDateRangeArgs = {
  end: Scalars["DateTime"]["input"];
  start: Scalars["DateTime"]["input"];
};

export type QueryTransactionsByTypeArgs = {
  type: TransactionType;
};

export type QueryUserArgs = {
  username: Scalars["String"]["input"];
};

export type Setting = {
  __typename?: "Setting";
  currency: Scalars["String"]["output"];
  darkMode: Scalars["Boolean"]["output"];
  id: Scalars["ID"]["output"];
  userId: Scalars["ID"]["output"];
};

export type SignInInput = {
  password: Scalars["String"]["input"];
  username: Scalars["String"]["input"];
};

export type SignInPayload = {
  __typename?: "SignInPayload";
  refreshToken: Scalars["String"]["output"];
  session: Scalars["String"]["output"];
  user: User;
};

export type SignOutInput = {
  refreshToken?: InputMaybe<Scalars["String"]["input"]>;
  session: Scalars["String"]["input"];
};

export type SignUpInput = {
  name: Scalars["String"]["input"];
  password: Scalars["String"]["input"];
  username: Scalars["String"]["input"];
};

export type SignUpPayload = {
  __typename?: "SignUpPayload";
  refreshToken: Scalars["String"]["output"];
  session: Scalars["String"]["output"];
  user: User;
};

export type Transaction = {
  __typename?: "Transaction";
  amount: Scalars["String"]["output"];
  capital: Scalars["String"]["output"];
  category?: Maybe<Scalars["String"]["output"]>;
  createdAt: Scalars["DateTime"]["output"];
  customerId?: Maybe<Scalars["ID"]["output"]>;
  description?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["ID"]["output"];
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  type: TransactionType;
  updatedAt?: Maybe<Scalars["DateTime"]["output"]>;
};

export enum TransactionStatus {
  Failed = "failed",
  Pending = "pending",
  Success = "success",
}

export enum TransactionType {
  Cash = "cash",
  Expense = "expense",
  Income = "income",
  Transfer = "transfer",
}

export type UpdateContactInput = {
  email?: InputMaybe<Scalars["String"]["input"]>;
  group?: InputMaybe<Scalars["String"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  phone?: InputMaybe<Scalars["String"]["input"]>;
};

export type UpdateProductInput = {
  amount?: InputMaybe<Scalars["Float"]["input"]>;
  capital?: InputMaybe<Scalars["Float"]["input"]>;
  currency?: InputMaybe<Scalars["String"]["input"]>;
  description?: InputMaybe<Scalars["String"]["input"]>;
  name?: InputMaybe<Scalars["String"]["input"]>;
  stock?: InputMaybe<Scalars["Int"]["input"]>;
};

export type UpdateSettingInput = {
  currency?: InputMaybe<Scalars["String"]["input"]>;
  darkMode?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export type UpdateTransactionInput = {
  amount?: InputMaybe<Scalars["String"]["input"]>;
  capital?: InputMaybe<Scalars["String"]["input"]>;
  category?: InputMaybe<Scalars["String"]["input"]>;
  customerId: Scalars["ID"]["input"];
  date?: InputMaybe<Scalars["DateTimeOrTimestamp"]["input"]>;
  description?: InputMaybe<Scalars["String"]["input"]>;
  paymentMethod?: InputMaybe<PaymentMethod>;
  type?: InputMaybe<TransactionType>;
};

export type UpdateUserAvatarInput = {
  avatarUrl?: InputMaybe<Scalars["String"]["input"]>;
  userId: Scalars["ID"]["input"];
};

export type User = {
  __typename?: "User";
  avatarUrl?: Maybe<Scalars["String"]["output"]>;
  id?: Maybe<Scalars["ID"]["output"]>;
  name: Scalars["String"]["output"];
  username: Scalars["String"]["output"];
};

export type ResolverTypeWrapper<T> = Promise<T> | T;

export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<
  TResult,
  TParent = Record<PropertyKey, never>,
  TContext = Record<PropertyKey, never>,
  TArgs = Record<PropertyKey, never>,
> =
  | ResolverFn<TResult, TParent, TContext, TArgs>
  | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<
  TResult,
  TKey extends string,
  TParent,
  TContext,
  TArgs,
> {
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

export type SubscriptionResolver<
  TResult,
  TKey extends string,
  TParent = Record<PropertyKey, never>,
  TContext = Record<PropertyKey, never>,
  TArgs = Record<PropertyKey, never>,
> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<
  TTypes,
  TParent = Record<PropertyKey, never>,
  TContext = Record<PropertyKey, never>,
> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo,
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<
  T = Record<PropertyKey, never>,
  TContext = Record<PropertyKey, never>,
> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<
  TResult = Record<PropertyKey, never>,
  TParent = Record<PropertyKey, never>,
  TContext = Record<PropertyKey, never>,
  TArgs = Record<PropertyKey, never>,
> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => TResult | Promise<TResult>;

/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  Asset: ResolverTypeWrapper<Asset>;
  AssetInputUpdate: AssetInputUpdate;
  AssetMutationType: ResolverTypeWrapper<AssetMutationType>;
  AssetType: AssetType;
  Boolean: ResolverTypeWrapper<Scalars["Boolean"]["output"]>;
  Contact: ResolverTypeWrapper<Contact>;
  CreateAssetInput: CreateAssetInput;
  CreateContactInput: CreateContactInput;
  CreateProductInput: CreateProductInput;
  CreateTransactionInput: CreateTransactionInput;
  CreateUserInput: CreateUserInput;
  DateTime: ResolverTypeWrapper<Scalars["DateTime"]["output"]>;
  DateTimeOrTimestamp: ResolverTypeWrapper<Scalars["DateTimeOrTimestamp"]["output"]>;
  Float: ResolverTypeWrapper<Scalars["Float"]["output"]>;
  ID: ResolverTypeWrapper<Scalars["ID"]["output"]>;
  Int: ResolverTypeWrapper<Scalars["Int"]["output"]>;
  MeUser: ResolverTypeWrapper<MeUser>;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  PaymentMethod: PaymentMethod;
  Product: ResolverTypeWrapper<Product>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Setting: ResolverTypeWrapper<Setting>;
  SignInInput: SignInInput;
  SignInPayload: ResolverTypeWrapper<SignInPayload>;
  SignOutInput: SignOutInput;
  SignUpInput: SignUpInput;
  SignUpPayload: ResolverTypeWrapper<SignUpPayload>;
  String: ResolverTypeWrapper<Scalars["String"]["output"]>;
  Timestamp: ResolverTypeWrapper<Scalars["Timestamp"]["output"]>;
  Transaction: ResolverTypeWrapper<Transaction>;
  TransactionStatus: TransactionStatus;
  TransactionType: TransactionType;
  UpdateContactInput: UpdateContactInput;
  UpdateProductInput: UpdateProductInput;
  UpdateSettingInput: UpdateSettingInput;
  UpdateTransactionInput: UpdateTransactionInput;
  UpdateUserAvatarInput: UpdateUserAvatarInput;
  User: ResolverTypeWrapper<User>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  Asset: Asset;
  AssetInputUpdate: AssetInputUpdate;
  AssetMutationType: AssetMutationType;
  Boolean: Scalars["Boolean"]["output"];
  Contact: Contact;
  CreateAssetInput: CreateAssetInput;
  CreateContactInput: CreateContactInput;
  CreateProductInput: CreateProductInput;
  CreateTransactionInput: CreateTransactionInput;
  CreateUserInput: CreateUserInput;
  DateTime: Scalars["DateTime"]["output"];
  DateTimeOrTimestamp: Scalars["DateTimeOrTimestamp"]["output"];
  Float: Scalars["Float"]["output"];
  ID: Scalars["ID"]["output"];
  Int: Scalars["Int"]["output"];
  MeUser: MeUser;
  Mutation: Record<PropertyKey, never>;
  Product: Product;
  Query: Record<PropertyKey, never>;
  Setting: Setting;
  SignInInput: SignInInput;
  SignInPayload: SignInPayload;
  SignOutInput: SignOutInput;
  SignUpInput: SignUpInput;
  SignUpPayload: SignUpPayload;
  String: Scalars["String"]["output"];
  Timestamp: Scalars["Timestamp"]["output"];
  Transaction: Transaction;
  UpdateContactInput: UpdateContactInput;
  UpdateProductInput: UpdateProductInput;
  UpdateSettingInput: UpdateSettingInput;
  UpdateTransactionInput: UpdateTransactionInput;
  UpdateUserAvatarInput: UpdateUserAvatarInput;
  User: User;
};

export type AssetResolvers<
  ContextType = any,
  ParentType extends ResolversParentTypes["Asset"] = ResolversParentTypes["Asset"],
> = {
  balance?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  id?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  name?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  type?: Resolver<ResolversTypes["AssetType"], ParentType, ContextType>;
};

export type AssetMutationTypeResolvers<
  ContextType = any,
  ParentType extends ResolversParentTypes["AssetMutationType"] =
    ResolversParentTypes["AssetMutationType"],
> = {
  amount?: Resolver<ResolversTypes["Float"], ParentType, ContextType>;
  balanceAfter?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  balanceBefore?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  currency?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  type?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
};

export type ContactResolvers<
  ContextType = any,
  ParentType extends ResolversParentTypes["Contact"] = ResolversParentTypes["Contact"],
> = {
  avatar?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  createdAt?: Resolver<Maybe<ResolversTypes["DateTime"]>, ParentType, ContextType>;
  email?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  group?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  name?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  phone?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  updatedAt?: Resolver<Maybe<ResolversTypes["DateTime"]>, ParentType, ContextType>;
  userId?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
};

export interface DateTimeScalarConfig extends GraphQLScalarTypeConfig<
  ResolversTypes["DateTime"],
  any
> {
  name: "DateTime";
}

export interface DateTimeOrTimestampScalarConfig extends GraphQLScalarTypeConfig<
  ResolversTypes["DateTimeOrTimestamp"],
  any
> {
  name: "DateTimeOrTimestamp";
}

export type MeUserResolvers<
  ContextType = any,
  ParentType extends ResolversParentTypes["MeUser"] = ResolversParentTypes["MeUser"],
> = {
  avatarUrl?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  name?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  username?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
};

export type MutationResolvers<
  ContextType = any,
  ParentType extends ResolversParentTypes["Mutation"] = ResolversParentTypes["Mutation"],
> = {
  addBalance?: Resolver<
    ResolversTypes["Asset"],
    ParentType,
    ContextType,
    RequireFields<MutationAddBalanceArgs, "amount" | "assetId">
  >;
  createAsset?: Resolver<
    ResolversTypes["Asset"],
    ParentType,
    ContextType,
    RequireFields<MutationCreateAssetArgs, "input">
  >;
  createContact?: Resolver<
    ResolversTypes["Contact"],
    ParentType,
    ContextType,
    RequireFields<MutationCreateContactArgs, "input">
  >;
  createProduct?: Resolver<
    ResolversTypes["Product"],
    ParentType,
    ContextType,
    RequireFields<MutationCreateProductArgs, "input">
  >;
  createTransaction?: Resolver<
    ResolversTypes["Transaction"],
    ParentType,
    ContextType,
    RequireFields<MutationCreateTransactionArgs, "input">
  >;
  createUser?: Resolver<
    ResolversTypes["User"],
    ParentType,
    ContextType,
    RequireFields<MutationCreateUserArgs, "input">
  >;
  deleteAsset?: Resolver<
    ResolversTypes["Boolean"],
    ParentType,
    ContextType,
    RequireFields<MutationDeleteAssetArgs, "name">
  >;
  deleteContact?: Resolver<
    ResolversTypes["Boolean"],
    ParentType,
    ContextType,
    RequireFields<MutationDeleteContactArgs, "id">
  >;
  deleteProduct?: Resolver<
    ResolversTypes["Boolean"],
    ParentType,
    ContextType,
    RequireFields<MutationDeleteProductArgs, "id">
  >;
  deleteTransaction?: Resolver<
    ResolversTypes["Boolean"],
    ParentType,
    ContextType,
    RequireFields<MutationDeleteTransactionArgs, "id">
  >;
  signIn?: Resolver<
    ResolversTypes["SignInPayload"],
    ParentType,
    ContextType,
    RequireFields<MutationSignInArgs, "input">
  >;
  signOut?: Resolver<
    ResolversTypes["Boolean"],
    ParentType,
    ContextType,
    RequireFields<MutationSignOutArgs, "input">
  >;
  signUp?: Resolver<
    ResolversTypes["SignUpPayload"],
    ParentType,
    ContextType,
    RequireFields<MutationSignUpArgs, "input">
  >;
  updateAsset?: Resolver<
    ResolversTypes["Asset"],
    ParentType,
    ContextType,
    RequireFields<MutationUpdateAssetArgs, "id" | "input">
  >;
  updateContact?: Resolver<
    ResolversTypes["Contact"],
    ParentType,
    ContextType,
    RequireFields<MutationUpdateContactArgs, "id" | "input">
  >;
  updateProduct?: Resolver<
    ResolversTypes["Product"],
    ParentType,
    ContextType,
    RequireFields<MutationUpdateProductArgs, "id" | "input">
  >;
  updateSetting?: Resolver<
    ResolversTypes["Setting"],
    ParentType,
    ContextType,
    RequireFields<MutationUpdateSettingArgs, "input">
  >;
  updateTransaction?: Resolver<
    ResolversTypes["Transaction"],
    ParentType,
    ContextType,
    RequireFields<MutationUpdateTransactionArgs, "id" | "input">
  >;
  updateUserAvatar?: Resolver<
    ResolversTypes["User"],
    ParentType,
    ContextType,
    RequireFields<MutationUpdateUserAvatarArgs, "input">
  >;
};

export type ProductResolvers<
  ContextType = any,
  ParentType extends ResolversParentTypes["Product"] = ResolversParentTypes["Product"],
> = {
  amount?: Resolver<ResolversTypes["Float"], ParentType, ContextType>;
  capital?: Resolver<Maybe<ResolversTypes["Float"]>, ParentType, ContextType>;
  createdAt?: Resolver<Maybe<ResolversTypes["DateTime"]>, ParentType, ContextType>;
  currency?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes["ID"]>, ParentType, ContextType>;
  margin?: Resolver<ResolversTypes["Float"], ParentType, ContextType>;
  name?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  stock?: Resolver<ResolversTypes["Int"], ParentType, ContextType>;
  updatedAt?: Resolver<Maybe<ResolversTypes["DateTime"]>, ParentType, ContextType>;
};

export type QueryResolvers<
  ContextType = any,
  ParentType extends ResolversParentTypes["Query"] = ResolversParentTypes["Query"],
> = {
  asset?: Resolver<
    Maybe<ResolversTypes["Asset"]>,
    ParentType,
    ContextType,
    RequireFields<QueryAssetArgs, "name">
  >;
  assetById?: Resolver<
    Maybe<ResolversTypes["Asset"]>,
    ParentType,
    ContextType,
    RequireFields<QueryAssetByIdArgs, "id">
  >;
  assetMutations?: Resolver<
    Array<ResolversTypes["AssetMutationType"]>,
    ParentType,
    ContextType,
    RequireFields<QueryAssetMutationsArgs, "assetId">
  >;
  assets?: Resolver<Array<ResolversTypes["Asset"]>, ParentType, ContextType>;
  checkAuthorized?: Resolver<
    ResolversTypes["Boolean"],
    ParentType,
    ContextType,
    RequireFields<QueryCheckAuthorizedArgs, "session">
  >;
  contact?: Resolver<
    Maybe<ResolversTypes["Contact"]>,
    ParentType,
    ContextType,
    RequireFields<QueryContactArgs, "id">
  >;
  contacts?: Resolver<Array<ResolversTypes["Contact"]>, ParentType, ContextType>;
  me?: Resolver<ResolversTypes["MeUser"], ParentType, ContextType>;
  product?: Resolver<
    Maybe<ResolversTypes["Product"]>,
    ParentType,
    ContextType,
    RequireFields<QueryProductArgs, "id">
  >;
  products?: Resolver<Array<ResolversTypes["Product"]>, ParentType, ContextType>;
  setting?: Resolver<ResolversTypes["Setting"], ParentType, ContextType>;
  transaction?: Resolver<
    Maybe<ResolversTypes["Transaction"]>,
    ParentType,
    ContextType,
    RequireFields<QueryTransactionArgs, "id">
  >;
  transactions?: Resolver<Array<ResolversTypes["Transaction"]>, ParentType, ContextType>;
  transactionsByDateRange?: Resolver<
    Array<ResolversTypes["Transaction"]>,
    ParentType,
    ContextType,
    RequireFields<QueryTransactionsByDateRangeArgs, "end" | "start">
  >;
  transactionsByType?: Resolver<
    Array<ResolversTypes["Transaction"]>,
    ParentType,
    ContextType,
    RequireFields<QueryTransactionsByTypeArgs, "type">
  >;
  user?: Resolver<
    Maybe<ResolversTypes["User"]>,
    ParentType,
    ContextType,
    RequireFields<QueryUserArgs, "username">
  >;
  users?: Resolver<Array<ResolversTypes["User"]>, ParentType, ContextType>;
};

export type SettingResolvers<
  ContextType = any,
  ParentType extends ResolversParentTypes["Setting"] = ResolversParentTypes["Setting"],
> = {
  currency?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  darkMode?: Resolver<ResolversTypes["Boolean"], ParentType, ContextType>;
  id?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  userId?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
};

export type SignInPayloadResolvers<
  ContextType = any,
  ParentType extends ResolversParentTypes["SignInPayload"] = ResolversParentTypes["SignInPayload"],
> = {
  refreshToken?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  session?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  user?: Resolver<ResolversTypes["User"], ParentType, ContextType>;
};

export type SignUpPayloadResolvers<
  ContextType = any,
  ParentType extends ResolversParentTypes["SignUpPayload"] = ResolversParentTypes["SignUpPayload"],
> = {
  refreshToken?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  session?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  user?: Resolver<ResolversTypes["User"], ParentType, ContextType>;
};

export interface TimestampScalarConfig extends GraphQLScalarTypeConfig<
  ResolversTypes["Timestamp"],
  any
> {
  name: "Timestamp";
}

export type TransactionResolvers<
  ContextType = any,
  ParentType extends ResolversParentTypes["Transaction"] = ResolversParentTypes["Transaction"],
> = {
  amount?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  capital?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  category?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes["DateTime"], ParentType, ContextType>;
  customerId?: Resolver<Maybe<ResolversTypes["ID"]>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes["ID"], ParentType, ContextType>;
  paymentMethod?: Resolver<ResolversTypes["PaymentMethod"], ParentType, ContextType>;
  status?: Resolver<ResolversTypes["TransactionStatus"], ParentType, ContextType>;
  type?: Resolver<ResolversTypes["TransactionType"], ParentType, ContextType>;
  updatedAt?: Resolver<Maybe<ResolversTypes["DateTime"]>, ParentType, ContextType>;
};

export type UserResolvers<
  ContextType = any,
  ParentType extends ResolversParentTypes["User"] = ResolversParentTypes["User"],
> = {
  avatarUrl?: Resolver<Maybe<ResolversTypes["String"]>, ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes["ID"]>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
  username?: Resolver<ResolversTypes["String"], ParentType, ContextType>;
};

export type Resolvers<ContextType = any> = {
  Asset?: AssetResolvers<ContextType>;
  AssetMutationType?: AssetMutationTypeResolvers<ContextType>;
  Contact?: ContactResolvers<ContextType>;
  DateTime?: GraphQLScalarType;
  DateTimeOrTimestamp?: GraphQLScalarType;
  MeUser?: MeUserResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Product?: ProductResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Setting?: SettingResolvers<ContextType>;
  SignInPayload?: SignInPayloadResolvers<ContextType>;
  SignUpPayload?: SignUpPayloadResolvers<ContextType>;
  Timestamp?: GraphQLScalarType;
  Transaction?: TransactionResolvers<ContextType>;
  User?: UserResolvers<ContextType>;
};
