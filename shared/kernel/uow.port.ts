export abstract class UnitOfWork<Tx = unknown, Tr = unknown> {
  abstract run(fn: (tx: Tx) => Promise<Tr>): Promise<Tr>;
}
