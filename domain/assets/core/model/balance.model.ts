import { Balance } from "../value-objects/balance.vo";
import { RequiredErr } from "$services/shared/kernel/errors/service-error";

export class BalanceModel {
  static canSubtract(balance: Balance, amount: Balance): void {
    const result = balance.value - amount.value;
    if (result < 0) {
      throw new RequiredErr("balance", { class: BalanceModel });
    }
  }

  static canSwap(fromBalance: Balance, amount: Balance): void {
    this.canSubtract(fromBalance, amount);
  }

  static validateNonNegative(balance: Balance): void {
    if (balance.value < 0) {
      throw new RequiredErr("balance", { class: BalanceModel });
    }
  }

  static add(balance: Balance, amount: Balance): Balance {
    balance.add(amount);
    this.validateNonNegative(balance);
    return balance;
  }

  static subtract(balance: Balance, amount: Balance): Balance {
    this.canSubtract(balance, amount);
    balance.subtract(amount);
    return balance;
  }

  static swap(from: Balance, to: Balance, amount: Balance): { from: Balance; to: Balance } {
    this.canSwap(from, amount);
    from.subtract(amount);
    to.add(amount);
    return { from, to };
  }
}
