import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  Min,
  Max,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { QuestionType } from '@prisma/client';
import { Transform } from 'class-transformer';

export class GenerateMultipleQuestionsDto {
  @IsString()
  subject: string;

  @Transform(({ value }) => parseInt(value as string))
  @IsNumber()
  @Min(1)
  @Max(50)
  questionCount: number;

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as QuestionType[];
      } catch {
        return [value as QuestionType];
      }
    }
    return value as QuestionType[];
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(QuestionType, { each: true })
  questionTypes: QuestionType[];

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
