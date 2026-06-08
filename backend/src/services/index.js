/**
 * Services Index
 *
 * Central export for all SaaS platform services
 *
 * Usage:
 *   import {
 *     AIRouterService,
 *     CreditManagerService,
 *     OrderService,
 *     // ... etc
 *   } from './services/index.js';
 */

export { default as AIRouterService } from "./AIRouterService.js";
export { default as CreditManagerService } from "./CreditManagerService.js";
export { default as OrderService } from "./OrderService.js";
export { default as InvoiceService } from "./InvoiceService.js";
export { default as ReminderSchedulerService } from "./ReminderSchedulerService.js";
export { default as VoiceProcessorService } from "./VoiceProcessorService.js";
export { default as AnalyticsService } from "./AnalyticsService.js";
export { default as MultilingualService } from "./MultilingualService.js";
export { default as CustomerPreferencesService } from "./CustomerPreferencesService.js";

// Provider exports
export { default as AIProviderFactory } from "./providers/AIProviderFactory.js";
export { default as BaseAIProvider } from "./providers/BaseAIProvider.js";
export { default as LlamaProvider } from "./providers/LlamaProvider.js";
export { default as GeminiProvider } from "./providers/GeminiProvider.js";
export { default as GPTProvider } from "./providers/GPTProvider.js";
export { default as ClaudeProvider } from "./providers/ClaudeProvider.js";
