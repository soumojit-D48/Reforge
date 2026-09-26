import { IsIn, IsOptional } from 'class-validator';

export class ListReviewQueueDto {
  @IsOptional()
  @IsIn(['needs_review'])
  status?: 'needs_review';
}
