/**
 * VoiceProcessorService.js
 *
 * Handles voice note processing:
 * - Download audio from WhatsApp
 * - Transcribe using Whisper API (placeholder)
 * - Generate summaries using AI
 * - Store transcripts for reference
 * - Support multiple audio formats
 *
 * TODO:
 * - Integrate with OpenAI Whisper API for transcription
 * - Implement audio file caching and cleanup
 * - Add support for multiple languages
 * - Implement audio quality checks
 */

import { PrismaClient, VoiceNoteStatus } from "@prisma/client";
import AIRouterService from "./AIRouterService.js";
import logger from "../utils/logger.js";

const prisma = new PrismaClient();

class VoiceProcessorService {
  /**
   * Download voice note from WhatsApp
   * @param {string} mediaUrl - WhatsApp media URL
   * @param {string} mediaId - WhatsApp media ID
   * @returns {Promise<Buffer>}
   */
  static async downloadVoiceNote(mediaUrl, mediaId) {
    try {
      // TODO: Download from WhatsApp Business API
      // Implementation:
      // const response = await fetch(mediaUrl, {
      //   headers: {
      //     'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`
      //   }
      // });
      // return await response.buffer();

      logger.info(`Voice note downloaded: ${mediaId}`);
      return null; // Placeholder
    } catch (error) {
      logger.error(`Failed to download voice note: ${error.message}`);
      throw error;
    }
  }

  /**
   * Transcribe audio file
   * @param {Buffer} audioBuffer - Audio data
   * @param {string} format - Audio format (ogg, mp4, etc)
   * @param {string} language - Language code (optional)
   * @returns {Promise<string>}
   */
  static async transcribeAudio(audioBuffer, format = "ogg", language = "en") {
    try {
      // TODO: Integrate with OpenAI Whisper API
      // Implementation:
      // const formData = new FormData();
      // formData.append('file', new Blob([audioBuffer]), `audio.${format}`);
      // formData.append('model', 'whisper-1');
      // formData.append('language', language);
      //
      // const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      //   },
      //   body: formData
      // });
      //
      // const data = await response.json();
      // return data.text;

      logger.warn("[MOCK] Voice transcription returning mock text");
      return "Mock transcription of voice message";
    } catch (error) {
      logger.error(`Transcription failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process voice note from WhatsApp
   * @param {string} businessId - Business ID
   * @param {string} customerId - Customer ID
   * @param {string} mediaId - WhatsApp media ID
   * @param {string} mediaUrl - WhatsApp media URL
   * @returns {Promise<{voiceNoteId: string, transcript: string, summary: string}>}
   */
  static async processVoiceNote(businessId, customerId, mediaId, mediaUrl) {
    try {
      logger.info(
        `Processing voice note: media_id=${mediaId} for customer ${customerId}`,
      );

      // Step 1: Create placeholder record
      const voiceNote = await prisma.voiceNote.create({
        data: {
          businessId,
          customerId,
          mediaId,
          status: VoiceNoteStatus.PROCESSING,
          durationSeconds: 0,
        },
      });

      try {
        // Step 2: Download audio
        const audioBuffer = await this.downloadVoiceNote(mediaUrl, mediaId);

        // Step 3: Transcribe
        const transcript = await this.transcribeAudio(audioBuffer, "ogg");

        // Step 4: Generate summary using AI
        const aiResult = await AIRouterService.generateResponse({
          businessId,
          taskType: "VOICE_TRANSCRIPTION",
          systemPrompt: `Provide a concise summary of the following voice message. 
          Keep it under 100 words. Highlight key points and any action items.`,
          userMessage: `Transcribed voice message:\n${transcript}`,
        });

        // Step 5: Update record with results
        const updated = await prisma.voiceNote.update({
          where: { id: voiceNote.id },
          data: {
            transcript,
            summary: aiResult.text,
            status: VoiceNoteStatus.COMPLETED,
            processingTimeMs: Date.now() - voiceNote.createdAt.getTime(),
          },
        });

        logger.info(
          `Voice note processed successfully: ${voiceNote.id}, transcript length: ${transcript.length}`,
        );

        return {
          voiceNoteId: updated.id,
          transcript: updated.transcript,
          summary: updated.summary,
        };
      } catch (error) {
        // Mark as failed
        await prisma.voiceNote.update({
          where: { id: voiceNote.id },
          data: {
            status: VoiceNoteStatus.FAILED,
            metadata: JSON.stringify({
              error: error.message,
              timestamp: new Date(),
            }),
          },
        });

        throw error;
      }
    } catch (error) {
      logger.error(`Failed to process voice note: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get voice note by ID
   * @param {string} voiceNoteId - Voice note ID
   * @returns {Promise<object>}
   */
  static async getVoiceNote(voiceNoteId) {
    try {
      return await prisma.voiceNote.findUnique({
        where: { id: voiceNoteId },
      });
    } catch (error) {
      logger.error(`Failed to get voice note: ${error.message}`);
      throw error;
    }
  }

  /**
   * List voice notes for a customer
   * @param {string} customerId - Customer ID
   * @param {object} options - Filter options
   * @returns {Promise<array>}
   */
  static async listVoiceNotes(customerId, { limit = 20, offset = 0 } = {}) {
    try {
      return await prisma.voiceNote.findMany({
        where: { customerId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      });
    } catch (error) {
      logger.error(`Failed to list voice notes: ${error.message}`);
      return [];
    }
  }

  /**
   * Delete voice note
   * @param {string} voiceNoteId - Voice note ID
   * @returns {Promise<{success: boolean}>}
   */
  static async deleteVoiceNote(voiceNoteId) {
    try {
      // TODO: Delete audio file from storage

      await prisma.voiceNote.delete({
        where: { id: voiceNoteId },
      });

      logger.info(`Voice note deleted: ${voiceNoteId}`);
      return { success: true };
    } catch (error) {
      logger.error(`Failed to delete voice note: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get voice processing analytics
   * @param {string} businessId - Business ID
   * @returns {Promise<object>}
   */
  static async getAnalytics(businessId) {
    try {
      const voiceNotes = await prisma.voiceNote.findMany({
        where: { businessId },
      });

      const stats = {
        total: voiceNotes.length,
        completed: voiceNotes.filter(
          (v) => v.status === VoiceNoteStatus.COMPLETED,
        ).length,
        processing: voiceNotes.filter(
          (v) => v.status === VoiceNoteStatus.PROCESSING,
        ).length,
        failed: voiceNotes.filter((v) => v.status === VoiceNoteStatus.FAILED)
          .length,
        totalDuration: voiceNotes.reduce(
          (sum, v) => sum + (v.durationSeconds || 0),
          0,
        ),
        averageProcessingTime:
          voiceNotes.length > 0
            ? voiceNotes.reduce(
                (sum, v) => sum + (v.processingTimeMs || 0),
                0,
              ) / voiceNotes.length
            : 0,
      };

      return stats;
    } catch (error) {
      logger.error(`Failed to get voice analytics: ${error.message}`);
      return { total: 0, completed: 0, processing: 0, failed: 0 };
    }
  }
}

export default VoiceProcessorService;
