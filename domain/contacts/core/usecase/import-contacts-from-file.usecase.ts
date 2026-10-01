import { ContactRepository } from "../ports/out/contact-repository.port";
import { parseCSV, parseVCF } from "$services/shared/infra/parser";
import { ID } from "$services/shared/kernel";
import { CreateContactUseCase } from "./create-contact.usecase";
import { CoreUsecase } from "$services/shared/base";
import { logMethod } from "$services/shared/infra/decorators/logger-decorator";
import { logger } from "../value-objects/logger";

export type ImportContactsFromFileResult = {
  imported: number;
  failed: number;
  merged: number;
};

export type ImportContactsFromFileInput = {
  userId: ID;
  file: File;
};

export class ImportContactsFromFileUseCase extends CoreUsecase<
  ImportContactsFromFileResult,
  ImportContactsFromFileInput
> {
  @logMethod(logger)
  async execute(input: ImportContactsFromFileInput): Promise<ImportContactsFromFileResult> {
    const contactRepo = this.deps.get(ContactRepository);
    const { userId, file } = input;

    const text = await file.text();
    const ext = file.name.split(".").pop()?.toLowerCase();
    const contacts = ext === "vcf" ? parseVCF(text) : parseCSV(text);

    const existingContacts = await contactRepo.findAll(userId.toNumb);
    const existingMap = new Map(existingContacts.map((c) => [c.name.toLowerCase().trim(), c]));

    let imported = 0;
    let failed = 0;
    let merged = 0;

    const createContact = this.deps.get(CreateContactUseCase);

    for (const item of contacts) {
      try {
        if (!item.name || item.name.trim().length === 0) {
          failed++;
          continue;
        }

        const normalizedName = item.name.trim().toLowerCase();
        const existing = existingMap.get(normalizedName);

        if (existing) {
          let updated = false;
          if (item.phone && !existing.phones?.includes(item.phone)) {
            existing.phones = [...(existing.phones ?? []), item.phone];
            updated = true;
          }
          if (item.email && item.email !== existing.email) {
            existing.email = item.email;
            updated = true;
          }
          if (item.group && item.group !== existing.group) {
            existing.group = item.group;
            updated = true;
          }
          if (updated) {
            existing.validateAll();
            await contactRepo.update(userId.toNumb, existing);
            merged++;
          }
        } else {
          await createContact.execute({
            name: item.name.trim(),
            userId,
            email: item.email,
            phones: item.phone,
            group: item.group,
          });
          imported++;
        }
      } catch {
        failed++;
      }
    }
    return { imported, failed, merged };
  }
}