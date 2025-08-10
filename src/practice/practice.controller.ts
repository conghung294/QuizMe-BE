import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PracticeService } from './practice.service';
import { StartPracticeDto } from './dto/start-practice.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { CompletePracticeDto } from './dto/complete-practice.dto';

@Controller('practice')
export class PracticeController {
  constructor(private readonly practiceService: PracticeService) {}

  @Post('start')
  async startPractice(@Body() startPracticeDto: StartPracticeDto) {
    try {
      const session = await this.practiceService.startPractice(startPracticeDto);
      return {
        success: true,
        data: session,
        message: 'Practice session started successfully',
      };
    } catch (error) {
      console.error('Error starting practice:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to start practice session',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('answer')
  async submitAnswer(@Body() submitAnswerDto: SubmitAnswerDto) {
    try {
      const result = await this.practiceService.submitAnswer(submitAnswerDto);
      return {
        success: true,
        data: result,
        message: result.isCorrect ? 'Correct answer!' : 'Incorrect answer',
      };
    } catch (error) {
      console.error('Error submitting answer:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to submit answer',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('complete')
  async completePractice(@Body() completePracticeDto: CompletePracticeDto) {
    try {
      const session = await this.practiceService.completePractice(completePracticeDto);
      return {
        success: true,
        data: session,
        message: 'Practice session completed successfully',
      };
    } catch (error) {
      console.error('Error completing practice:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to complete practice session',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('sessions/:id')
  async getPracticeSession(@Param('id') id: string) {
    try {
      const session = await this.practiceService.getPracticeSession(id);
      
      if (!session) {
        throw new HttpException('Practice session not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: session,
      };
    } catch (error) {
      console.error('Error fetching practice session:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to fetch practice session',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('sessions')
  async getPracticeSessions(@Query('userId') userId?: string) {
    try {
      const sessions = await this.practiceService.getPracticeSessions(userId);
      return {
        success: true,
        data: sessions,
      };
    } catch (error) {
      console.error('Error fetching practice sessions:', error);
      throw new HttpException(
        'Failed to fetch practice sessions',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
