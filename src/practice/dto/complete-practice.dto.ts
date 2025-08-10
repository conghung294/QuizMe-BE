import { IsUUID } from 'class-validator';

export class CompletePracticeDto {
  @IsUUID()
  sessionId: string;
}
