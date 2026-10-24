# Cara Kerja `createOrderProductSale`

Singkatnya: **uang di-charge dari aset sumber pembayaran (`payWithAssetId`) lewat gateway aset, lalu hasil penjualan di-settle ke _default cash asset_ user (`setting.defaultAssetCashId`) oleh `ProcessPaymentUseCase`.**

Pencatatan di sisi Order hanya membuat order + transaksi income. Perpindahan saldo aset yang sebenarnya ditangani oleh modul Payment/Asset.

## Alur Lengkap

### 1) Validasi & Buat Order Pending

File: [`domain/order/core/usecase/create_order_product_sale.usecase.ts:37-97`](../domain/order/core/usecase/create_order_product_sale.usecase.ts#L37-L97)

- Validasi: `itemCount` (via `assertItemCount`), `customerId` dan `payWithAssetId` (jika ada, harus positif), `price > 0`.
- Ambil data produk via `ProductService.getInstance().product(productId, userId)`.
- Pastikan produk milik user yang sama.
- Jika produk `trackStock` dan stok tidak cukup -> error.
- Hitung:
  - `saleAmount = price * itemCount`
  - `currency` dari `price.currency`
  - `capitalPerItem = product.capital ?? 0` (wajib >= 0 dan finite)
  - `capital = Money.fromNumber(capitalPerItem, currency) * itemCount`
- Buat `Order` dengan status `pending`, simpan ke `OrderRepository`.

### 2) Buat Invoice & Proses Pembayaran

File: [`domain/order/core/usecase/create_order_product_sale.usecase.ts:100-135`](../domain/order/core/usecase/create_order_product_sale.usecase.ts#L100-L135)

1. Ambil `PaymentService` dari container (`PaymentServiceCtx`).
2. Buat invoice: `paymentService.createInvoice({ userId, customerId, items: [{ description: product.name, quantity: itemCount, unitPrice: appliedPrice }], currency, description })`.
3. Proses pembayaran: `paymentService.processPayment({...})` dengan payload:
   ```ts
   {
     userId: data.userId,
     amount: saleAmount.toNumber(),
     currency,
     method: paymentMethod,        // default "cash"
     assetId: data.payWithAssetId, // aset sumber pembayaran
     invoiceId: invoice.id,
     description,
     type: data.payWithAssetId
       ? ProcessPaymentType.orderProductSale
       : ProcessPaymentType.general, // tanpa asset, bukan tipe OrderProductSale
   }
   ```

Catatan: settlement ke default cash **tidak** dilakukan di usecase Order, melainkan di `ProcessPaymentUseCase` ([baris 144-146](../domain/order/core/usecase/create_order_product_sale.usecase.ts#L144-L146)).

### 3) Charge dari Aset Sumber + Settlement ke Default Cash

File: [`domain/payment/core/usecase/process_payment.usecase.ts`](../domain/payment/core/usecase/process_payment.usecase.ts)

- **Validasi tipe**: Jika `type === orderProductSale` dan `assetId` tidak ada -> `ValidationError("assetId is required for OrderProductSale payment")` ([38-40](../domain/payment/core/usecase/process_payment.usecase.ts#L38-L40)). Jadi untuk jual produk dengan sumber dana dari aset, `payWithAssetId` **wajib**.
- **Pilih gateway**: Jika ada `assetId` dan `AssetChargeGatewayToken` terdaftar di container -> pakai `AssetChargeGateway`, jika tidak -> pakai `defaultGateway` ([44-48](../domain/payment/core/usecase/process_payment.usecase.ts#L44-L48)).
- **Buat payment**: Buat entitas `Payment` status `processing`, simpan ke `PaymentRepository` ([49-92](../domain/payment/core/usecase/process_payment.usecase.ts#L49-L92)).
- **Charge**: Panggil `gateway.charge({ userId, assetId: input.assetId, amount, currency, method, description, metadata })` ([94-103](../domain/payment/core/usecase/process_payment.usecase.ts#L94-L103)).
- **Jika charge sukses**:
  1. Simpan `gatewayRef` dan update metadata `assetId` ([104-110](../domain/payment/core/usecase/process_payment.usecase.ts#L104-L110)).
  2. Jika `type === orderProductSale`, panggil `settleOrderProductSale(deps, entity)` ([111-116](../domain/payment/core/usecase/process_payment.usecase.ts#L111-L116)).
     - Helper: [`domain/payment/core/usecase/payment_settlement.helper.ts:10-32`](../domain/payment/core/usecase/payment_settlement.helper.ts#L10-L32)
       - Ambil `PaymentSettlementPort` dari container. Jika tidak terpasang -> error.
       - Ambil `defaultCashAssetId = await settlement.defaultCashAssetId(userId)`. Jika tidak ada (belum dikonfigurasi di setting) -> error.
       - Panggil `settlement.settle({ userId, assetId: defaultCashAssetId, amount, currency })`.
     - Adapter: [`domain/payment/adapters/driven/settlement/asset-settlement.adapter.ts:15-31`](../domain/payment/adapters/driven/settlement/asset-settlement.adapter.ts#L15-L31)
       - `defaultCashAssetId` diambil dari `SettingService.settingByUserId(userId)` (`setting.defaultAssetCashId`).
       - `settle` memanggil `AssetService.mutateAddAsset(userId, defaultCashAssetId, Money(amount, currency))` untuk **menambah saldo** ke aset kas default.
  3. Jika settlement berhasil -> `entity.transitionTo("completed")`.
  4. Jika settlement **gagal** setelah charge sukses -> `refundCharge(gateway, gatewayRef)` (best-effort refund), lalu lempar error sehingga payment ditandai `failed` ([116-121](../domain/payment/core/usecase/process_payment.usecase.ts#L116-L121), [`payment_settlement.helper.ts:35-41`](../domain/payment/core/usecase/payment_settlement.helper.ts#L35-L41)).
- **Update payment**: Simpan hasil akhir (`status`, `gatewayRef`, `metadata`, `retryCount`) ke repo ([138-148](../domain/payment/core/usecase/process_payment.usecase.ts#L138-L148)).

**Inti perpindahan uang:** _debit_ dari `payWithAssetId` (via gateway aset) → _kredit_ ke `setting.defaultAssetCashId` (via `AssetService.mutateAddAsset`).

### 4) Finalisasi Order, Kurangi Stok, Catat Transaksi

File: [`domain/order/core/usecase/create_order_product_sale.usecase.ts:136-166`](../domain/order/core/usecase/create_order_product_sale.usecase.ts#L136-L166)

- Jika payment `completed` -> panggil `ProductService.buy(productId, itemCount, userId, appliedPrice)` untuk mengurangi stok, set `stockDeducted = true`.
- Catat transaksi income via `TransactionService.createTransaction`:
  ```ts
  {
    userId: data.userId,
    type: "income",
    amount: saleAmount,
    capital,
    createdAt: new Date(),
    description,
    category: "Product Sale",
    paymentMethod: { type: paymentMethod },
    customerId: data.customerId,
    status: "success",
    paymentStatus: data.paymentStatus,
    payToAssetId: data.payWithAssetId, // untuk pencatatan
  }
  ```
  Ini **pencatatan akuntansi/transaksi**, bukan pemindahan saldo aset (perpindahan aset sudah terjadi di step 3).
- Update order jadi `status: "success"`, kembalikan order.

### Rollback Jika Gagal

File: [`domain/order/core/usecase/create_order_product_sale.usecase.ts:166-189`](../domain/order/core/usecase/create_order_product_sale.usecase.ts#L166-L189)

- Jika stok sudah dikurangi (`stockDeducted`) tapi gagal setelahnya, coba kembalikan stok dengan `ProductService.updateProduct` menambah `stock + itemCount` (best-effort).
- Update order jadi `status: "cancelled"` (best-effort).
- Error asli dilempar kembali.

## Catatan Penting

- **Sumber bayar wajib untuk tipe ini**: `payWithAssetId` dikirim sebagai `assetId` ke `processPayment`. Untuk `OrderProductSale`, `ProcessPaymentUseCase` mewajibkannya.
- **Tujuan selalu ke default cash**: Dana selalu di-settle ke _default cash asset_ user, diambil dari `Setting.defaultAssetCashId` via `SettingService`. Tidak kembali ke aset sumber.
- **Tanpa `payWithAssetId`**: `type` jadi `general`, `ProcessPaymentUseCase` tidak mewajibkan `assetId` dan **tidak menjalankan `settleOrderProductSale`**. Alurnya berbeda (tidak ada settlement otomatis ke default cash).
- **Atomisitas**: Jika charge sukses tapi settlement gagal -> payment di-refund dan ditandai gagal. Jika stok sudah dikurangi tapi proses gagal -> stok di-rollback, order dicancel. Rollback bersifat _best-effort_ (ada `try/catch` yang mengabaikan error rollback).
- **Pencatatan transaksi**: `TransactionService.createTransaction` dipanggil dengan `payToAssetId` berisi nilai `payWithAssetId` untuk tujuan pencatatan.
