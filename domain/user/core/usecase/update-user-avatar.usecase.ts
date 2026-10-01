import { UserRepository } from "../ports/out/user-repository.port";
import type { User as UserType } from "../../adapters/driven/drizzle/user.entity";
import { ID } from "$services/shared/kernel/id";
import { UserByIdUseCase } from "./user-by-id.usecase";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type UpdateUserAvatarInput = {
  id: ID;
  avatarUrl?: string | null;
};

export class UpdateUserAvatarUseCase extends CoreUsecase<UserType, UpdateUserAvatarInput> {
  @logMethod(logger)
  async execute(input: UpdateUserAvatarInput): Promise<UserType> {
    const userRepo = this.deps.get(UserRepository);
    const { id, avatarUrl } = input;

    const user = await this.deps.get(UserByIdUseCase).execute(id);

    if (!avatarUrl) {
      user.avatarUrl = null;
    } else {
      user.avatarUrl = avatarUrl;
    }

    return userRepo.update(user);
  }
}