import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StartPracticeDto } from './dto/start-practice.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { CompletePracticeDto } from './dto/complete-practice.dto';
import { PracticeSession, PracticeAnswer, Question, Choice, CorrectAnswer } from '@prisma/client';

export interface PracticeSessionWithDetails extends PracticeSession {
  questionSet: {
    id: string;
    title: string;
    subject: string;
    questions: (Question & {
      choices: Choice[];
      correctAnswers: CorrectAnswer[];
    })[];
  };
  answers: PracticeAnswer[];
}

export interface AnswerResult {
  isCorrect: boolean;
  correctAnswers: string[];
  explanation?: string;
  score: number;
  totalQuestions: number;
}

@Injectable()
export class PracticeService {
  constructor(private prisma: PrismaService) {}

  async startPractice(startPracticeDto: StartPracticeDto): Promise<PracticeSessionWithDetails> {
    // Verify question set exists
    const questionSet = await this.prisma.questionSet.findUnique({
      where: { id: startPracticeDto.questionSetId },
      include: {
        questions: {
          include: {
            choices: { orderBy: { order: 'asc' } },
            correctAnswers: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!questionSet) {
      throw new NotFoundException('Question set not found');
    }

    if (questionSet.questions.length === 0) {
      throw new BadRequestException('Question set has no questions');
    }

    // Create practice session
    const session = await this.prisma.practiceSession.create({
      data: {
        questionSetId: startPracticeDto.questionSetId,
        userId: startPracticeDto.userId,
        totalQuestions: questionSet.questions.length,
      },
      include: {
        questionSet: {
          include: {
            questions: {
              include: {
                choices: { orderBy: { order: 'asc' } },
                correctAnswers: true,
              },
              orderBy: { order: 'asc' },
            },
          },
        },
        answers: true,
      },
    });

    return session;
  }

  async submitAnswer(submitAnswerDto: SubmitAnswerDto): Promise<AnswerResult> {
    // Verify session exists and is not completed
    const session = await this.prisma.practiceSession.findUnique({
      where: { id: submitAnswerDto.sessionId },
      include: { answers: true },
    });

    if (!session) {
      throw new NotFoundException('Practice session not found');
    }

    if (session.isCompleted) {
      throw new BadRequestException('Practice session is already completed');
    }

    // Get question with correct answers
    const question = await this.prisma.question.findUnique({
      where: { id: submitAnswerDto.questionId },
      include: { correctAnswers: true },
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    // Check if answer already exists for this question
    const existingAnswer = await this.prisma.practiceAnswer.findFirst({
      where: {
        sessionId: submitAnswerDto.sessionId,
        questionId: submitAnswerDto.questionId,
      },
    });

    if (existingAnswer) {
      throw new BadRequestException('Answer already submitted for this question');
    }

    // Check if answer is correct
    const correctAnswerLabels = question.correctAnswers.map(ca => ca.choiceLabel).sort();
    const selectedLabels = submitAnswerDto.selectedChoices.sort();
    const isCorrect = JSON.stringify(correctAnswerLabels) === JSON.stringify(selectedLabels);

    // Save answer
    await this.prisma.practiceAnswer.create({
      data: {
        sessionId: submitAnswerDto.sessionId,
        questionId: submitAnswerDto.questionId,
        selectedChoices: submitAnswerDto.selectedChoices,
        isCorrect,
      },
    });

    // Update session score
    const currentScore = session.score + (isCorrect ? 1 : 0);
    await this.prisma.practiceSession.update({
      where: { id: submitAnswerDto.sessionId },
      data: { score: currentScore },
    });

    return {
      isCorrect,
      correctAnswers: correctAnswerLabels,
      explanation: question.explanation,
      score: currentScore,
      totalQuestions: session.totalQuestions,
    };
  }

  async completePractice(completePracticeDto: CompletePracticeDto): Promise<PracticeSessionWithDetails> {
    const session = await this.prisma.practiceSession.findUnique({
      where: { id: completePracticeDto.sessionId },
    });

    if (!session) {
      throw new NotFoundException('Practice session not found');
    }

    if (session.isCompleted) {
      throw new BadRequestException('Practice session is already completed');
    }

    // Mark session as completed
    const completedSession = await this.prisma.practiceSession.update({
      where: { id: completePracticeDto.sessionId },
      data: {
        isCompleted: true,
        endedAt: new Date(),
      },
      include: {
        questionSet: {
          include: {
            questions: {
              include: {
                choices: { orderBy: { order: 'asc' } },
                correctAnswers: true,
              },
              orderBy: { order: 'asc' },
            },
          },
        },
        answers: true,
      },
    });

    return completedSession;
  }

  async getPracticeSession(sessionId: string): Promise<PracticeSessionWithDetails | null> {
    return this.prisma.practiceSession.findUnique({
      where: { id: sessionId },
      include: {
        questionSet: {
          include: {
            questions: {
              include: {
                choices: { orderBy: { order: 'asc' } },
                correctAnswers: true,
              },
              orderBy: { order: 'asc' },
            },
          },
        },
        answers: true,
      },
    });
  }

  async getPracticeSessions(userId?: string): Promise<PracticeSession[]> {
    return this.prisma.practiceSession.findMany({
      where: userId ? { userId } : {},
      include: {
        questionSet: {
          select: {
            title: true,
            subject: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });
  }
}
