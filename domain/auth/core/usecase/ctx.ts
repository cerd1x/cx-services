import type { User } from "../../../user/core/model/user.model";
import { ID } from "$services/shared/kernel";
import type { UserServiceLike } from "../types/user-service-like";
import type { SettingService } from "$services/domain/setting";
import type { PasskeyService } from "$services/domain/auth";

export class UserServiceLikeCtx implements UserServiceLike {
  createUser(_name: string, _username: string, _password: string): Promise<User> {
    throw new Error("Method not implemented.");
  }
  userByUsername(_username: string): Promise<User> {
    throw new Error("Method not implemented.");
  }
  user(_id: ID): Promise<User> {
    throw new Error("Method not implemented.");
  }
  deleteUser(_userId: ID): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
}

export class SettingServiceCtx {
  __cxToken!: SettingService;
}

export class PasskeyServiceCtx {
  __cxToken!: PasskeyService;
}
