import { IsString, IsArray, IsUUID } from 'class-validator';

export class SubmitAnswerDto {
  @IsUUID()
  sessionId: string;

  @IsUUID()
  questionId: string;

  @IsArray()
  @IsString({ each: true })
  selectedChoices: string[]; // Array of choice labels: ["A", "B"]
}
