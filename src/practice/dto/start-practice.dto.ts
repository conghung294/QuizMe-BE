import { IsString, IsOptional } from 'class-validator';

export class StartPracticeDto {
  @IsString()
  questionSetId: string;

  @IsOptional()
  @IsString()
  userId?: string;
}
