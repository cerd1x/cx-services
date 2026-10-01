export type PasskeyRecord = {
  id: number;
  userId: number;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string | null;
  deviceName: string | null;
  createdAt: string;
};

export abstract class PasskeyRepository {
  abstract save(data: {
    userId: number;
    credentialId: string;
    publicKey: string;
    counter: number;
    transports: string | null;
    deviceName: string | null;
  }): Promise<PasskeyRecord>;
  abstract findById(credentialId: string): Promise<PasskeyRecord | null>;
  abstract findByUserId(userId: number): Promise<PasskeyRecord[]>;
  abstract updateCounter(credentialId: string, counter: number): Promise<void>;
  abstract deleteByCredentialId(userId: number, credentialId: string): Promise<boolean>;
}
