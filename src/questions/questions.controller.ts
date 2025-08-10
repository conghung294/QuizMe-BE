import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  HttpException,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { QuestionsService } from './questions.service';
import { GenerateQuestionsDto } from './dto/generate-questions.dto';
import { GenerateMultipleQuestionsDto } from './dto/generate-multiple-questions.dto';

@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) { }

  @Post('generate')
  @UseInterceptors(FileInterceptor('file'))
  async generateQuestions(
    @UploadedFile() file: Express.Multer.File,
    @Body() generateQuestionsDto: GenerateQuestionsDto,
    @Query('userId') userId?: string,
  ) {
    try {
      if (!file) {
        throw new HttpException('File is required', HttpStatus.BAD_REQUEST);
      }

      const questionSet = await this.questionsService.generateQuestions(
        file,
        generateQuestionsDto,
        userId,
      );

      return {
        success: true,
        data: questionSet,
        message: `Successfully generated ${questionSet.questions.length} questions`,
      };
    } catch (error) {
      console.error('Error generating questions:', error);
      throw new HttpException(
        error.message || 'Failed to generate questions',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('generate-multiple')
  @UseInterceptors(FileInterceptor('file'))
  async generateMultipleQuestions(
    @UploadedFile() file: Express.Multer.File,
    @Body() generateMultipleQuestionsDto: GenerateMultipleQuestionsDto,
    @Query('userId') userId?: string,
  ) {
    try {
      if (!file) {
        throw new HttpException('File is required', HttpStatus.BAD_REQUEST);
      }

      const questionSet = await this.questionsService.generateMultipleQuestions(
        file,
        generateMultipleQuestionsDto,
        userId,
      );

      return {
        success: true,
        data: questionSet,
        message: `Successfully generated ${questionSet.questions.length} questions`,
      };
    } catch (error) {
      console.error('Error generating multiple questions:', error);
      throw new HttpException(
        error.message || 'Failed to generate questions',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('sets')
  async getQuestionSets(@Query('userId') userId?: string) {
    try {
      const questionSets = await this.questionsService.getQuestionSets(userId);
      return {
        success: true,
        data: questionSets,
      };
    } catch (error) {
      console.error('Error fetching question sets:', error);
      throw new HttpException(
        'Failed to fetch question sets',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('sets/:id')
  async getQuestionSet(@Param('id') id: string) {
    try {
      const questionSet = await this.questionsService.getQuestionSet(id);

      if (!questionSet) {
        throw new HttpException('Question set not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: questionSet,
      };
    } catch (error) {
      console.error('Error fetching question set:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to fetch question set',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('sets/:id')
  async deleteQuestionSet(
    @Param('id') id: string,
    @Query('userId') userId?: string,
  ) {
    try {
      await this.questionsService.deleteQuestionSet(id, userId);
      return {
        success: true,
        message: 'Question set deleted successfully',
      };
    } catch (error) {
      console.error('Error deleting question set:', error);
      throw new HttpException(
        'Failed to delete question set',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
