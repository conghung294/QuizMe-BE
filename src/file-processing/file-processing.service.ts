import { Injectable } from '@nestjs/common';
import pdfParse from 'pdf-parse';

@Injectable()
export class FileProcessingService {
  async extractTextFromFile(file: Express.Multer.File): Promise<string> {
    const { mimetype, buffer } = file;

    try {
      if (mimetype === 'application/pdf') {
        return await this.extractTextFromPDF(buffer);
      } else if (mimetype === 'text/plain') {
        return buffer.toString('utf-8');
      } else {
        throw new Error('Unsupported file type. Only PDF and TXT files are supported.');
      }
    } catch (error) {
      console.error('Error extracting text from file:', error);
      throw new Error('Failed to extract text from file');
    }
  }

  private async extractTextFromPDF(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      console.error('Error parsing PDF:', error);
      throw new Error('Failed to parse PDF file');
    }
  }

  validateFile(file: Express.Multer.File): void {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['application/pdf', 'text/plain'];

    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error('Invalid file type. Only PDF and TXT files are allowed.');
    }

    if (file.size > maxSize) {
      throw new Error('File size too large. Maximum size is 10MB.');
    }
  }

  sanitizeText(text: string): { text: string; wasTruncated: boolean; originalLength: number; truncatedLength: number } {
    // Remove excessive whitespace and normalize
    let sanitized = text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();

    const originalLength = sanitized.length;

    // Truncate if text is too long
    const result = this.truncateText(sanitized);

    return {
      text: result.text,
      wasTruncated: result.wasTruncated,
      originalLength,
      truncatedLength: result.text.length
    };
  }

  private truncateText(text: string): { text: string; wasTruncated: boolean } {
    const MAX_CHARS = 10000; // 10K characters limit for optimal performance

    if (text.length <= MAX_CHARS) {
      return { text, wasTruncated: false };
    }

    console.warn(`Text is too long (${text.length} chars). Truncating to ${MAX_CHARS} chars.`);

    // Try to find a good breaking point (end of sentence or paragraph)
    let truncated = text.substring(0, MAX_CHARS);

    // Look for the last sentence ending within the last 20% of the truncated text
    const searchStart = Math.max(0, MAX_CHARS - Math.floor(MAX_CHARS * 0.2));
    const searchText = truncated.substring(searchStart);

    // Find the last occurrence of sentence endings
    const sentenceEndings = ['. ', '.\n', '! ', '!\n', '? ', '?\n'];
    let lastSentenceEnd = -1;

    for (const ending of sentenceEndings) {
      const index = searchText.lastIndexOf(ending);
      if (index > lastSentenceEnd) {
        lastSentenceEnd = index;
      }
    }

    if (lastSentenceEnd > -1) {
      // Cut at the end of the last complete sentence
      truncated = truncated.substring(0, searchStart + lastSentenceEnd + 1);
    }

    // If we couldn't find a good sentence break, look for paragraph breaks
    if (lastSentenceEnd === -1) {
      const paragraphBreaks = ['\n\n', '\n '];
      let lastParagraphEnd = -1;

      for (const breakPattern of paragraphBreaks) {
        const index = searchText.lastIndexOf(breakPattern);
        if (index > lastParagraphEnd) {
          lastParagraphEnd = index;
        }
      }

      if (lastParagraphEnd > -1) {
        truncated = truncated.substring(0, searchStart + lastParagraphEnd);
      }
    }

    console.log(`Text truncated from ${text.length} to ${truncated.length} characters`);
    return { text: truncated.trim(), wasTruncated: true };
  }
}
