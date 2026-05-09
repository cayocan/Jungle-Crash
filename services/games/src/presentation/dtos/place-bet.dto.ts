import { ApiProperty } from '@nestjs/swagger';

export class PlaceBetDto {
  @ApiProperty({ description: 'Bet amount in cents (integer as string)', example: '1000' })
  amountCents!: string;

  @ApiProperty({ description: 'Auto cashout multiplier target (e.g. 2.5). Omit to cash out manually.', example: 2.5, required: false })
  autoCashoutAt?: number;
}
