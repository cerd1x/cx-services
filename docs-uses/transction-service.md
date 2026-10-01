# `createTransaction`

**File:** `services/core/transactions/service/transaction_service.ts:44`

Membuat transaksi baru, sekaligus mencatat mutasi aset jika `payWithAssetId`/`payToAssetId` diberikan.

## Flow

```text
TransactionInput → Transaction.new(input).validateAll()
                           │
         ┌─────────────────┴─────────────────┐
         │                                   │
    type="transfer"                      income/expense
    + payWithAssetId                     + payWithAssetId
    + payToAssetId                       │
         │                               │
   swapBalance()                   mutateAsset()
   (kurangi source,                (add / subtract)
    tambah dest)
         │                               │
         └─────────────┬─────────────────┘
                       │
                  #txRepo.save(tx)
                       │
                  return tx
```

## `TransactionInput`

| Field            | Type                                  | Required                          |
| ---------------- | ------------------------------------- | --------------------------------- |
| `type`           | `"income" \| "expense" \| "transfer"` | ✅                                |
| `amount`         | `Balance`                             | ✅                                |
| `capital`        | `Balance`                             | ✅                                |
| `createdAt`      | `Date`                                | ❌                                |
| `description`    | `string`                              | ❌                                |
| `category`       | `string`                              | ❌                                |
| `paymentMethod`  | `PaymentMethod`                       | ❌                                |
| `customerId`     | `number`                              | ❌                                |
| `status`         | `"pending" \| "success" \| "failed"`  | ❌                                |
| `userId`         | `number`                              | ❌                                |
| `payWithAssetId` | `number`                              | ❌ (wajib jika `type="transfer"`) |
| `payToAssetId`   | `number`                              | ❌ (wajib jika `type="transfer"`) |

## Asset Mutation

### Transfer (`type="transfer"`)

Memanggil `AssetService.swapBalance()` — mengurangi balance dari `payWithAssetId` dan menambah ke `payToAssetId` dalam satu UnitOfWork. Mencatat `AssetMutation` untuk kedua aset.

### Income / Expense (`type="income" | "type="expense"`)

Memanggil `AssetService.mutateAsset()` — `income` → `"add"`, `expense` → `"subtract"`. Mencatat satu `AssetMutation`.

## Catatan

- `userId!` menggunakan non-null assertion — dipastikan terisi oleh resolver.
- Mutasi aset terjadi **sebelum** transaksi disimpan di DB.
