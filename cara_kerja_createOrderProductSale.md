Singkatnya: uang di-charge dari aset yang dipakai buat bayar (payToAssetId) lewat gateway aset, lalu hasil penjualannya di-settle ke default cash asset milik user (setting.defaultAssetCashId) oleh ProcessPaymentUseCase.
Pencatatan di sisi order cuma "mencatat order + transaksi income", perpindahan asetnya yang sebenarnya ditangani payment/settlement.
Alur lengkap

1. Validasi & buat order pending
   Di CreateOrderProductSaleUseCase (domain/order/core/usecase/create_order_product_sale.usecase.ts:37-97):

- Validasi itemCount, price > 0, customerId/payToAssetId (jika ada), cek kepemilikan produk, dan cek stok kalau trackStock.
- Hitung saleAmount = price * itemCount, ambil capital = product.capital * itemCount, tentukan paymentMethod (default cash).
- Buat Order status pending, simpan via OrderRepository.

2. Buat invoice & proses pembayaran
   Masih di usecase yang sama (L100-135):

1) Ambil PaymentService dari container.
2) paymentService.createInvoice(...) buat invoice berisi item penjualan produk.
3) paymentService.processPayment({...}) dipanggil dengan:
   {
   userId: data.userId,
   amount: saleAmount.toNumber(),
   currency,
   method: paymentMethod,
   assetId: data.payToAssetId, // aset sumber pembayaran
   invoiceId: invoice.id,
   description,
   type: data.payToAssetId
   ? ProcessPaymentType.orderProductSale
   : ProcessPaymentType.general, // kalau tanpa assetId, bukan tipe OrderProductSale
   }
   Catatan: usecase order menandai komentar bahwa settlement ke default cash justru dilakukan oleh ProcessPaymentUseCase, bukan di sini (L144-146).

3. Charge dari aset sumber + settlement ke default cash (inti perpindahan uang)
   ProcessPaymentUseCase (domain/payment/core/usecase/process_payment.usecase.ts):

- Validasi tipe: kalau type === orderProductSale dan assetId tidak ada -> ValidationError (L38-40). Artinya untuk skenario "jual produk dengan sumber dana dari aset", payToAssetId wajib.
- Pilih gateway: kalau ada assetId dan AssetChargeGatewayToken terdaftar -> pakai AssetChargeGateway, else pakai defaultGateway (L44-48). Ini berarti pembayaran bisa "di-charge" langsung dari aset terkait.
- Buat payment status processing, simpan ke repo (L49-92).
- Charge: gateway.charge({ userId, assetId: input.assetId, amount, currency, method, ... }) (L94-103).
- Jika charge sukses:

1. Simpan gatewayRef dan update metadata assetId (L104-110)
2. Kalau type === orderProductSale -> panggil settleOrderProductSale(deps, entity) (L111-116).

- Helper ini (domain/payment/core/usecase/payment_settlement.helper.ts:10-32): ambil PaymentSettlementPort dari container. Kalau tidak terpasang -> error. Ambil defaultCashAssetId = await settlement.defaultCashAssetId(userId). Kalau kosong -> error. Lalu settlement.settle({ userId, assetId: defaultCashAssetId, amount, currency }).
- AssetSettlementAdapter (domain/payment/adapters/driven/settlement/asset-settlement.adapter.ts:15-31): defaultCashAssetId diambil dari SettingService.settingByUserId(userId) (defaultAssetCashId). settle memanggil AssetService.mutateAddAsset(userId, defaultCashAssetId, Money(amount,currency)) untuk menambahkan saldo ke aset kas default tersebut.

3. Kalau settlement berhasil -> entity.transitionTo("completed").
4. Kalau settlement gagal setelah charge berhasil -> refundCharge(gateway, gatewayRef) (best-effort refund) lalu lempar error sehingga payment akan ditandai failed (L116-121, payment_settlement.helper.ts:35-41).

- Update payment di repo dengan status/metadata/gatewayRef (L138-148).
  Jadi secara konsep: debit dari payToAssetId (via gateway aset) -> kredit ke setting.defaultAssetCashId (via mutateAddAsset). Dua langkah ini yang merepresentasikan "pindahnya" uang untuk penjualan produk.

4. Finalisasi order, kurangi stok, catat transaksi
   Kembali ke CreateOrderProductSaleUseCase (L136-166):

- Kalau payment status completed -> ProductService.buy(productId, itemCount, userId, appliedPrice) untuk mengurangi stok (stockDeducted = true).
- Catat transaksi income via TransactionService.createTransaction (L147-160): type: "income", amount: saleAmount, capital, category: "Product Sale", paymentMethod, paymentStatus, payToAssetId, customerId, status: "success". Ini pencatatan akuntansi/transaksi, bukan pemindahan saldo aset itu sendiri (pemindahan aset udah terjadi di step 3).
- Update order jadi status: "success", kembalikan order.
  Rollback kalau gagal
  Di catch (L166-189):
- Kalau stok udah dikurangi (stockDeducted) tapi gagal setelahnya, dicoba kembalikan stok dengan ProductService.updateProduct menambah stock + itemCount (best-effort).
- Order di-update jadi cancelled (best-effort). Error asli dilempar kembali.
  Hal penting untuk dicatat
- Sumber bayar: payToAssetId dikirim ke processPayment sebagai assetId. Untuk OrderProductSale, ProcessPaymentUseCase mewajibkannya.
- Tujuan settle: selalu ke default cash asset user (bukan balik ke aset sumber). Diambil dari Setting.defaultAssetCashId lewat SettingService.
- Tanpa payToAssetId: type jadi general, ProcessPaymentUseCase tidak mewajibkan assetId dan tidak menjalankan settleOrderProductSale. Artinya alurnya beda (tidak ada settlement otomatis ke default cash seperti kasus order product sale).
- Atomicity: perpindahan aset bisa gagal setelah charge sukses -> payment di-refund dan gagal, stok di-rollback kalau sempat dikurangi, order jadi cancelled. Namun rollback bersifat best-effort (ada try/catch yang mengabaikan error rollback).
