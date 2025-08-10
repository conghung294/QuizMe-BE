import { IsString, IsNumber, IsEnum, IsOptional, Min, Max } from 'class-validator';
import { QuestionType } from '@prisma/client';
import { Transform } from 'class-transformer';

export class GenerateQuestionsDto {
  @IsString()
  subject: string;

  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  @Max(50)
  questionCount: number;

  @IsEnum(QuestionType)
  questionType: QuestionType;

  @IsOptional()
  @IsString()
  tone?: string;

  @IsOptional()
  @IsString()
  difficulty?: string;

  @IsOptional()
  @IsString()
  title?: string;
}
