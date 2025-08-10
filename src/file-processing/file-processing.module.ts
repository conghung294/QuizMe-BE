import { Module } from '@nestjs/common';
import { FileProcessingService } from './file-processing.service';

@Module({
  providers: [FileProcessingService],
  exports: [FileProcessingService],
})
export class FileProcessingModule {}
