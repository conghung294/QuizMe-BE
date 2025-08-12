import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QuestionType } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ParsedAIResponse } from '../types/ai-response.types';

export interface GenerateQuestionsRequest {
  content: string;
  subject: string;
  questionCount: number;
  questionType: QuestionType;
  tone?: string;
  difficulty?: string;
}

export interface GeneratedQuestion {
  question: string;
  choices: { label: string; content: string }[];
  correctAnswers: string[];
  explanation?: string;
  type: QuestionType;
}

@Injectable()
export class OpenAIService {
  private genAI: GoogleGenerativeAI;

  constructor(private configService: ConfigService) {
    this.genAI = new GoogleGenerativeAI(
      this.configService.get<string>('GEMINI_API_KEY'),
    );
  }

  async generateQuestions(
    request: GenerateQuestionsRequest,
  ): Promise<GeneratedQuestion[]> {
    const prompt = this.buildPrompt(request);

    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-pro',
      });

      const result = await model.generateContent(prompt);

      const rawText = result.response.text();
      const cleanJson = this.extractJson(rawText);

      if (!cleanJson) {
        throw new Error('Không tìm thấy JSON hợp lệ trong phản hồi AI');
      }

      const parsedResponse = JSON.parse(cleanJson) as ParsedAIResponse;

      return this.validateAndFormatQuestions(
        parsedResponse.questions,
        request.questionType,
      );
    } catch (error) {
      console.error('Error generating questions:', error);
      throw new Error('Failed to generate questions');
    }
  }

  /** Tách JSON từ chuỗi trả về của AI */
  private extractJson(text: string): string | null {
    try {
      // Loại bỏ markdown code fences
      const cleaned = text
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      // Nếu parse được ngay thì trả luôn
      JSON.parse(cleaned);
      return cleaned;
    } catch {
      // Nếu không parse được, thử regex bắt { ... }
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          JSON.parse(match[0]);
          return match[0];
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  private buildPrompt(request: GenerateQuestionsRequest): string {
    const { content, subject, questionCount, questionType, tone, difficulty } =
      request;

    let typeInstruction = '';
    let formatExample = '';

    switch (questionType) {
      case QuestionType.MULTIPLE_CHOICE:
        typeInstruction =
          'Tạo câu hỏi trắc nghiệm với 4 lựa chọn (A, B, C, D), chỉ có 1 đáp án đúng.';
        formatExample = `
        "choices": [
          {"label": "A", "content": "Nội dung đáp án A"},
          {"label": "B", "content": "Nội dung đáp án B"},
          {"label": "C", "content": "Nội dung đáp án C"},
          {"label": "D", "content": "Nội dung đáp án D"}
        ],
        "correctAnswers": ["A"]`;
        break;

      case QuestionType.TRUE_FALSE:
        typeInstruction = 'Tạo câu hỏi đúng/sai với 2 lựa chọn (Đúng, Sai).';
        formatExample = `
        "choices": [
          {"label": "True", "content": "Đúng"},
          {"label": "False", "content": "Sai"}
        ],
        "correctAnswers": ["True"]`;
        break;

      case QuestionType.MULTIPLE_RESPONSE:
        typeInstruction =
          'Tạo câu hỏi với 4 lựa chọn (A, B, C, D), BẮT BUỘC phải có ít nhất 2 đáp án đúng (2-3 đáp án). Đây là loại câu hỏi nhiều lựa chọn đúng.';
        formatExample = `
        "choices": [
          {"label": "A", "content": "Nội dung đáp án A"},
          {"label": "B", "content": "Nội dung đáp án B"},
          {"label": "C", "content": "Nội dung đáp án C"},
          {"label": "D", "content": "Nội dung đáp án D"}
        ],
        "correctAnswers": ["A", "C"]`;
        break;

      case QuestionType.MATCHING:
        typeInstruction =
          'Tạo câu hỏi ghép đôi với 4 cặp thuật ngữ-định nghĩa hoặc nguyên nhân-kết quả. Mỗi lựa chọn là một cặp ghép.';
        formatExample = `
        "choices": [
          {"label": "A", "content": "Thuật ngữ 1 - Định nghĩa 1"},
          {"label": "B", "content": "Thuật ngữ 2 - Định nghĩa 2"},
          {"label": "C", "content": "Thuật ngữ 3 - Định nghĩa 3"},
          {"label": "D", "content": "Thuật ngữ 4 - Định nghĩa 4"}
        ],
        "correctAnswers": ["A", "B", "C", "D"]`;
        break;

      case QuestionType.COMPLETION:
        typeInstruction =
          'Tạo câu hỏi điền khuyết với một câu/đoạn văn có chỗ trống được đánh dấu bằng _____ (5 dấu gạch dưới), 4 lựa chọn từ/cụm từ để điền vào chỗ trống đó.';
        formatExample = `
        "question": "Công thức tính diện tích hình tròn là S = π × _____",
        "choices": [
          {"label": "A", "content": "r"},
          {"label": "B", "content": "r²"},
          {"label": "C", "content": "2r"},
          {"label": "D", "content": "d"}
        ],
        "correctAnswers": ["B"]`;
        break;

      default:
        typeInstruction =
          'Tạo câu hỏi trắc nghiệm với 4 lựa chọn (A, B, C, D), chỉ có 1 đáp án đúng.';
        formatExample = `
        "choices": [
          {"label": "A", "content": "Nội dung đáp án A"},
          {"label": "B", "content": "Nội dung đáp án B"},
          {"label": "C", "content": "Nội dung đáp án C"},
          {"label": "D", "content": "Nội dung đáp án D"}
        ],
        "correctAnswers": ["A"]`;
    }

    return `
Bạn là một chuyên gia tạo câu hỏi trắc nghiệm.
Dựa trên nội dung sau, hãy tạo ${questionCount} câu hỏi về chủ đề "${subject}".

NỘI DUNG:
${content}

YÊU CẦU:
- ${typeInstruction}
- Độ khó: ${difficulty || 'Trung bình'}
- Giọng văn: ${tone || 'Học thuật'}
- Câu hỏi phải chính xác, rõ ràng và dựa trên nội dung đã cho
- Mỗi câu hỏi phải có giải thích ngắn gọn cho đáp án đúng (KHÔNG đề cập số trang, slide hay tài liệu cụ thể)
- Các lựa chọn sai phải hợp lý và không quá dễ loại trừ
${
  questionType === QuestionType.MULTIPLE_RESPONSE
    ? `- ĐẶC BIỆT: Với loại MULTIPLE_RESPONSE, hãy tạo câu hỏi mà có thể có nhiều đáp án đúng cùng lúc. Ví dụ: "Những đặc điểm nào sau đây là đúng về X?", "Các yếu tố nào ảnh hưởng đến Y?", "Phương pháp nào có thể được sử dụng để Z?"`
    : ''
}
${
  questionType === QuestionType.COMPLETION
    ? `- ĐẶC BIỆT: Với loại COMPLETION, câu hỏi PHẢI có chỗ trống được đánh dấu bằng _____ (5 dấu gạch dưới). Ví dụ: "Công thức tính _____ của hình tròn là S = πr²", "Phương pháp _____ được sử dụng để giải quyết vấn đề này"`
    : ''
}

⚠️ Chỉ trả về JSON hợp lệ, KHÔNG giải thích, KHÔNG thêm văn bản thừa.

ĐỊNH DẠNG JSON RESPONSE:
{
  "questions": [
    {
      "question": "Nội dung câu hỏi (với COMPLETION thì có dấu _____ để đánh dấu chỗ trống)",
      ${formatExample},
      "explanation": "Giải thích ngắn gọn lý do đáp án đúng, dựa trên khái niệm hoặc nguyên lý chính"
    }
  ]
}

LƯU Ý QUAN TRỌNG:
- MULTIPLE_CHOICE: 1 đáp án đúng duy nhất
- TRUE_FALSE: chỉ có 2 choices với label "True"/"False"
- MULTIPLE_RESPONSE: BẮT BUỘC có ít nhất 2 đáp án đúng (2-3 đáp án), correctAnswers là mảng với nhiều phần tử
- MATCHING: tất cả đáp án đều đúng (ghép đôi hoàn hảo), correctAnswers chứa tất cả labels
- COMPLETION: câu hỏi BẮT BUỘC có dấu _____ (5 dấu gạch dưới) đánh dấu chỗ trống, 1 đáp án đúng

⚠️ ĐẶC BIỆT QUAN TRỌNG:
- Với MULTIPLE_RESPONSE: correctAnswers PHẢI có ít nhất 2 phần tử!
- Với COMPLETION: question PHẢI chứa _____ (5 dấu gạch dưới)!
- Với EXPLANATION: Chỉ giải thích khái niệm/nguyên lý, KHÔNG nói "theo trang X", "slide Y", "bài giảng Z"

VÍ DỤ EXPLANATION:
✅ TốT: "Hai biến ngẫu nhiên độc lập thì không tương quan, nhưng điều ngược lại chưa chắc đúng."
❌ Xấu: "Theo nội dung bài giảng (trang 16), 'nếu hai biến ngẫu nhiên độc lập thì không tương quan...'"
`;
  }

  private validateAndFormatQuestions(
    questions: unknown[],
    questionType: QuestionType,
  ): GeneratedQuestion[] {
    return questions.map((q, index) => {
      // Type guard for question structure
      if (!this.isValidQuestionStructure(q)) {
        throw new Error(`Invalid question structure at index ${index}`);
      }

      let formattedChoices = this.validateChoices(q.choices);
      let formattedCorrectAnswers = Array.isArray(q.correctAnswers)
        ? (q.correctAnswers as string[])
        : [q.correctAnswers as string];

      // Validate and format based on question type
      switch (questionType) {
        case QuestionType.TRUE_FALSE:
          formattedChoices = [
            { label: 'True', content: 'Đúng' },
            { label: 'False', content: 'Sai' },
          ];
          // Ensure correct answer is either True or False
          if (!['True', 'False'].includes(formattedCorrectAnswers[0] ?? '')) {
            formattedCorrectAnswers = ['True']; // Default fallback
          }
          break;

        case QuestionType.MULTIPLE_CHOICE:
          // Ensure only one correct answer
          formattedCorrectAnswers = [formattedCorrectAnswers[0] ?? 'A'];
          break;

        case QuestionType.MULTIPLE_RESPONSE:
          // Ensure multiple correct answers (2-3)
          if (formattedCorrectAnswers.length < 2) {
            console.warn(
              `MULTIPLE_RESPONSE question at index ${index} has only ${formattedCorrectAnswers.length} correct answer(s). Auto-fixing by adding more correct answers.`,
            );

            // Auto-fix: If only 1 correct answer, add another one
            if (formattedCorrectAnswers.length === 1) {
              const availableLabels = ['A', 'B', 'C', 'D'].filter(
                (label) => !formattedCorrectAnswers.includes(label),
              );
              if (availableLabels.length > 0) {
                formattedCorrectAnswers.push(availableLabels[0]);
              }
            }

            // Ensure we have at least 2 correct answers
            if (formattedCorrectAnswers.length < 2) {
              formattedCorrectAnswers = ['A', 'B']; // Fallback
            }
          }

          // Ensure not more than 3 correct answers
          if (formattedCorrectAnswers.length > 3) {
            formattedCorrectAnswers = formattedCorrectAnswers.slice(0, 3);
          }
          break;

        case QuestionType.MATCHING:
          // For matching, all choices should be correct (perfect pairing)
          formattedCorrectAnswers = formattedChoices.map(
            (choice) => choice.label,
          );
          break;

        case QuestionType.COMPLETION:
          // Ensure only one correct answer for completion
          formattedCorrectAnswers = [formattedCorrectAnswers[0] ?? 'A'];

          // Validate that question contains blank marker and auto-fix if needed
          if (!q.question.includes('_____')) {
            console.warn(
              `COMPLETION question at index ${index} doesn't contain blank marker (_____). Auto-fixing...`,
            );

            // Try to auto-fix by finding a suitable place to insert blank
            // Look for common patterns where we can insert a blank
            let fixedQuestion = q.question;

            // Pattern 1: "là X" -> "là _____"
            fixedQuestion = fixedQuestion.replace(
              /là\s+([^\s,.]+)/g,
              'là _____',
            );

            // Pattern 2: "bằng X" -> "bằng _____"
            fixedQuestion = fixedQuestion.replace(
              /bằng\s+([^\s,.]+)/g,
              'bằng _____',
            );

            // Pattern 3: "có X" -> "có _____"
            fixedQuestion = fixedQuestion.replace(
              /có\s+([^\s,.]+)/g,
              'có _____',
            );

            // Pattern 4: "được gọi là X" -> "được gọi là _____"
            fixedQuestion = fixedQuestion.replace(
              /được\s+gọi\s+là\s+([^\s,.]+)/g,
              'được gọi là _____',
            );

            // If no pattern matched, add blank at the end
            if (!fixedQuestion.includes('_____')) {
              fixedQuestion = fixedQuestion.replace(/\?$/, ' _____?');
              if (!fixedQuestion.includes('_____')) {
                fixedQuestion += ' _____';
              }
            }

            // Update the question in the validated object
            (q as { question: string }).question = fixedQuestion;
          }
          break;
      }

      return {
        question: q.question,
        choices: formattedChoices,
        correctAnswers: formattedCorrectAnswers,
        explanation: q.explanation ?? '',
        type: questionType,
      };
    });
  }

  private isValidQuestionStructure(q: unknown): q is {
    question: string;
    choices: unknown[];
    correctAnswers: unknown;
    explanation?: string;
  } {
    if (typeof q !== 'object' || q === null) return false;

    const obj = q as Record<string, unknown>;
    return (
      'question' in obj &&
      'choices' in obj &&
      'correctAnswers' in obj &&
      typeof obj.question === 'string' &&
      Array.isArray(obj.choices) &&
      obj.correctAnswers !== undefined
    );
  }

  private validateChoices(
    choices: unknown[],
  ): { label: string; content: string }[] {
    return choices.map((choice, index) => {
      if (
        typeof choice === 'object' &&
        choice !== null &&
        'label' in choice &&
        'content' in choice
      ) {
        const choiceObj = choice as Record<string, unknown>;
        return {
          label:
            typeof choiceObj.label === 'string'
              ? choiceObj.label
              : typeof choiceObj.label === 'number'
                ? choiceObj.label.toString()
                : '',
          content:
            typeof choiceObj.content === 'string'
              ? choiceObj.content
              : typeof choiceObj.content === 'number'
                ? choiceObj.content.toString()
                : '',
        };
      }
      throw new Error(`Invalid choice structure at index ${index}`);
    });
  }
}
