import { ReceiptAdapter, ReceiptMatch, SettledTransaction } from '../../types';

export class NullReceiptAdapter implements ReceiptAdapter {
  public readonly id = 'disabled';
  public readonly name = 'Disabled';

  public isConfigured(): boolean {
    return false;
  }

  public async findReceipt(_transaction: SettledTransaction): Promise<ReceiptMatch | null> {
    return null;
  }
}
