export class CreateWalletDto {
  userId!: string;
  initialBalanceCents?: string; // stringified integer cents, e.g. "1000"
  currency?: string;
}
