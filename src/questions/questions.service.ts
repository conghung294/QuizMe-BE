import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAIService } from '../openai/openai.service';
import { FileProcessingService } from '../file-processing/file-processing.service';
import { GenerateQuestionsDto } from './dto/generate-questions.dto';
import { GenerateMultipleQuestionsDto } from './dto/generate-multiple-questions.dto';
import { QuestionSet, Question, Choice, CorrectAnswer } from '@prisma/client';

export interface QuestionSetWithQuestions extends QuestionSet {
  questions: (Question & {
    choices: Choice[];
    correctAnswers: CorrectAnswer[];
  })[];
}

@Injectable()
export class QuestionsService {
  constructor(
    private prisma: PrismaService,
    private openaiService: OpenAIService,
    private fileProcessingService: FileProcessingService,
  ) { }

  async generateQuestions(
    file: Express.Multer.File,
    generateQuestionsDto: GenerateQuestionsDto,
    userId?: string,
  ): Promise<QuestionSetWithQuestions> {
    // Validate and extract text from file
    this.fileProcessingService.validateFile(file);
    const rawText = await this.fileProcessingService.extractTextFromFile(file);
    const sanitizeResult = this.fileProcessingService.sanitizeText(rawText);

    // Log truncation warning if needed
    if (sanitizeResult.wasTruncated) {
      console.warn(`Text was truncated from ${sanitizeResult.originalLength} to ${sanitizeResult.truncatedLength} characters`);
    }

    // Generate questions using OpenAI
    const generatedQuestions = await this.openaiService.generateQuestions({
      content: sanitizeResult.text,
      subject: generateQuestionsDto.subject,
      questionCount: generateQuestionsDto.questionCount,
      questionType: generateQuestionsDto.questionType,
      tone: generateQuestionsDto.tone,
      difficulty: generateQuestionsDto.difficulty,
    });

    // Save to database
    const questionSet = await this.saveQuestionSet(
      generateQuestionsDto,
      file,
      sanitizeResult.text,
      generatedQuestions,
      userId,
    );

    // Add truncation info to the response
    const result = {
      ...questionSet,
      textProcessingInfo: {
        wasTruncated: sanitizeResult.wasTruncated,
        originalLength: sanitizeResult.originalLength,
        truncatedLength: sanitizeResult.truncatedLength
      }
    };

    return result;
  }

  async getQuestionSet(id: string): Promise<QuestionSetWithQuestions | null> {
    return this.prisma.questionSet.findUnique({
      where: { id },
      include: {
        questions: {
          include: {
            choices: {
              orderBy: { order: 'asc' },
            },
            correctAnswers: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async getQuestionSets(userId?: string): Promise<QuestionSet[]> {
    return this.prisma.questionSet.findMany({
      where: userId ? { userId } : {},
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteQuestionSet(id: string, userId?: string): Promise<void> {
    const whereClause = userId ? { id, userId } : { id };

    await this.prisma.questionSet.delete({
      where: whereClause,
    });
  }

  private async saveQuestionSet(
    dto: GenerateQuestionsDto,
    file: Express.Multer.File,
    content: string,
    generatedQuestions: any[],
    userId?: string,
  ): Promise<QuestionSetWithQuestions> {
    const title = dto.title || `${dto.subject} - ${new Date().toLocaleDateString('vi-VN')}`;

    return this.prisma.questionSet.create({
      data: {
        title,
        subject: dto.subject,
        tone: dto.tone,
        difficulty: dto.difficulty,
        type: dto.questionType,
        fileName: file.originalname,
        fileContent: content.substring(0, 5000), // Store first 5000 chars for reference
        userId,
        questions: {
          create: generatedQuestions.map((q, index) => ({
            content: q.question,
            explanation: q.explanation,
            type: q.type || dto.questionType, // Use question's type if available, fallback to dto.questionType
            order: index + 1,
            choices: {
              create: q.choices.map((choice: any, choiceIndex: number) => ({
                label: choice.label,
                content: choice.content,
                order: choiceIndex + 1,
              })),
            },
            correctAnswers: {
              create: q.correctAnswers.map((answer: string) => ({
                choiceLabel: answer,
              })),
            },
          })),
        },
      },
      include: {
        questions: {
          include: {
            choices: {
              orderBy: { order: 'asc' },
            },
            correctAnswers: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async generateMultipleQuestions(
    file: Express.Multer.File,
    generateMultipleQuestionsDto: GenerateMultipleQuestionsDto,
    userId?: string,
  ): Promise<QuestionSetWithQuestions> {
    // Validate and extract text from file
    this.fileProcessingService.validateFile(file);
    const rawText = await this.fileProcessingService.extractTextFromFile(file);
    const sanitizeResult = this.fileProcessingService.sanitizeText(rawText);

    // Log truncation warning if needed
    if (sanitizeResult.wasTruncated) {
      console.warn(`Text was truncated from ${sanitizeResult.originalLength} to ${sanitizeResult.truncatedLength} characters`);
    }

    // Calculate questions per type
    const questionsPerType = Math.ceil(
      generateMultipleQuestionsDto.questionCount / generateMultipleQuestionsDto.questionTypes.length
    );

    // Generate questions for each type
    const allGeneratedQuestions = [];
    for (const questionType of generateMultipleQuestionsDto.questionTypes) {
      const generatedQuestions = await this.openaiService.generateQuestions({
        content: sanitizeResult.text,
        subject: generateMultipleQuestionsDto.subject,
        questionCount: questionsPerType,
        questionType: questionType,
        tone: generateMultipleQuestionsDto.tone,
        difficulty: generateMultipleQuestionsDto.difficulty,
      });
      allGeneratedQuestions.push(...generatedQuestions);
    }

    // Validate and fix question types
    const validatedQuestions = allGeneratedQuestions.map(q => {
      // Fix MULTIPLE_RESPONSE questions
      if (q.type === 'MULTIPLE_RESPONSE' && q.correctAnswers.length < 2) {
        console.warn(`Fixing MULTIPLE_RESPONSE question with only ${q.correctAnswers.length} correct answer(s)`);
        // Auto-fix by ensuring at least 2 correct answers
        const availableLabels = ['A', 'B', 'C', 'D'].filter(label => !q.correctAnswers.includes(label));
        while (q.correctAnswers.length < 2 && availableLabels.length > 0) {
          q.correctAnswers.push(availableLabels.shift());
        }
        // Fallback if still not enough
        if (q.correctAnswers.length < 2) {
          q.correctAnswers = ['A', 'B'];
        }
      }

      // Fix COMPLETION questions
      if (q.type === 'COMPLETION' && !q.question.includes('_____')) {
        console.warn(`Fixing COMPLETION question without blank marker`);
        // Try to auto-fix by adding blank at appropriate place
        let fixedQuestion = q.question;

        // Pattern matching to insert blanks
        fixedQuestion = fixedQuestion.replace(/là\s+([^\s,\.]+)/g, 'là _____');
        fixedQuestion = fixedQuestion.replace(/bằng\s+([^\s,\.]+)/g, 'bằng _____');
        fixedQuestion = fixedQuestion.replace(/có\s+([^\s,\.]+)/g, 'có _____');

        // If no pattern matched, add blank at the end
        if (!fixedQuestion.includes('_____')) {
          fixedQuestion = fixedQuestion.replace(/\?$/, ' _____?');
          if (!fixedQuestion.includes('_____')) {
            fixedQuestion += ' _____';
          }
        }

        q.question = fixedQuestion;
      }

      return q;
    });

    // Limit to requested count
    const finalQuestions = validatedQuestions.slice(0, generateMultipleQuestionsDto.questionCount);

    // Save to database
    const questionSet = await this.saveQuestionSet(
      {
        ...generateMultipleQuestionsDto,
        questionType: generateMultipleQuestionsDto.questionTypes[0], // Use first type for compatibility
      },
      file,
      sanitizeResult.text,
      finalQuestions,
      userId,
    );

    // Add truncation info to the response
    const result = {
      ...questionSet,
      textProcessingInfo: {
        wasTruncated: sanitizeResult.wasTruncated,
        originalLength: sanitizeResult.originalLength,
        truncatedLength: sanitizeResult.truncatedLength
      }
    };

    return result;
  }
}
