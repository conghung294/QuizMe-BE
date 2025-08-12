import { Module } from '@nestjs/common';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';
import { OpenAIModule } from '../openai/openai.module';
import { FileProcessingModule } from '../file-processing/file-processing.module';

@Module({
  imports: [OpenAIModule, FileProcessingModule],
  controllers: [QuestionsController],
  providers: [QuestionsService],
  exports: [QuestionsService],
})
export class QuestionsModule {}
