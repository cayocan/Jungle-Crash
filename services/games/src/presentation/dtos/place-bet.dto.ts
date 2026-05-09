import { ApiProperty } from '@nestjs/swagger';

export class PlaceBetDto {
  @ApiProperty({ description: 'Bet amount in cents (integer as string)', example: '1000' })
  amountCents!: string;
}
