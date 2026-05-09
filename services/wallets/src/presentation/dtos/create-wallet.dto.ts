import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWalletDto {
  @ApiPropertyOptional({ description: 'Initial balance in cents (integer as string)', example: '10000' })
  initialBalanceCents?: string;

  @ApiPropertyOptional({ description: 'Currency code', example: 'BRL' })
  currency?: string;
}
