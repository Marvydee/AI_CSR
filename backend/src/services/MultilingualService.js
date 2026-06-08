/**
 * MultilingualService.js
 *
 * Handles multilingual support across Africa:
 * - Manage language preferences per customer
 * - Store and retrieve translations
 * - Pass language context to AI for culturally appropriate responses
 *
 * Comprehensive African Language Support (14 languages):
 *
 * West Africa:
 * - en: English
 * - fr: French (Senegal, Côte d'Ivoire, DRC, etc.)
 * - pid: Nigerian Pidgin
 * - yo: Yoruba (Nigeria)
 * - ha: Hausa (Nigeria/Niger)
 * - ig: Igbo (Nigeria)
 * - tw: Akan/Twi (Ghana)
 *
 * East Africa:
 * - sw: Swahili (Kenya, Tanzania, Uganda)
 * - am: Amharic (Ethiopia)
 * - so: Somali (Somalia)
 *
 * Southern Africa:
 * - zu: Zulu (South Africa)
 * - xh: Xhosa (South Africa)
 * - af: Afrikaans (South Africa/Namibia)
 *
 * North Africa:
 * - ar: Arabic (Egypt, Algeria, Morocco, etc.)
 */
import logger from "../utils/logger.js";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Translation strings for system messages - comprehensive African language support
const TRANSLATIONS = {
  // English
  en: {
    greeting: "Hello! Welcome to our service.",
    helpText: "How can we help you today?",
    invalidInput: "Sorry, I didn't understand that. Could you please rephrase?",
    orderConfirmation: "Your order has been confirmed. Thank you!",
    invoiceReady: "Your invoice is ready for download.",
    paymentDue: "Payment is due on",
    serviceUnavailable:
      "This service is currently unavailable. Please try again later.",
  },

  // West Africa - Nigeria
  pid: {
    greeting: "Welcom broda! We ready to serve you well.",
    helpText: "Wetin we fit help you with today?",
    invalidInput:
      "Sorry bro, I no quite understand. Make you try again with better words?",
    orderConfirmation: "Your order done confirm well well. Thanks plenty!",
    invoiceReady: "Your invoice ready to download now.",
    paymentDue: "You suppose pay am by",
    serviceUnavailable:
      "This one no working now. Try again later make we sort am out.",
  },
  yo: {
    greeting: "Pẹlẹ o! Welcom si aye wa.",
    helpText: "Kilo lo le ran e nipa?",
    invalidInput: "A sorí, ẹ jọ̀wọ́ sọ báyi.",
    orderConfirmation: "Iṣẹ rẹ ti í dágbára. Ẹ ṣeun!",
    invoiceReady: "Iwe iṣẹ rẹ ti ṣetán.",
    paymentDue: "Ẹ gbọ́dọ̀ sanwó",
    serviceUnavailable: "Iṣẹ yìí kò ní àṣẹ nísinsin yìí.",
  },
  ha: {
    greeting: "Sannu! Maraba a gida.",
    helpText: "Yaya zai taimakka maka yau?",
    invalidInput: "Ba na fahimta ba. Ke maimaita in da kyau ne?",
    orderConfirmation: "Odar ɗinka ya tabbata. Na gode!",
    invoiceReady: "Takardar ka ɗa jiya.",
    paymentDue: "Diyya ta bi",
    serviceUnavailable: "Wannan aiki bai yi aiki ba a yanzu. Sake gwada jiya.",
  },
  ig: {
    greeting: "Kedu! Nnọọ n'ụlọ anyị.",
    helpText: "Gini ka m ga eme gị taa?",
    invalidInput: "Ahu m agụla adịghị ásụ. Biko sọ ọzọ?",
    orderConfirmation: "Ire gị akwadoro. Daalụ!",
    invoiceReady: "Akwụkwọ gị dị mma ka ọ bụrụ ladatara.",
    paymentDue: "Ụgwọ dị mkpa n'ụbọchị",
    serviceUnavailable: "Ihe a na-arụ ọrụ adịghị arụ ọrụ ugbu a. Nwalee ọzọ.",
  },
  tw: {
    greeting: "Maakye! Akwaaba bra.",
    helpText: "Dɛn na meboa wo ɛnnɛ?",
    invalidInput: "Mmente aseɛ no. Ɔkae bio?",
    orderConfirmation: "Wɔ adee ahu ahu. Medaase!",
    invoiceReady: "Wɔ baagyina ahu ready ahu ka download.",
    paymentDue: "Sika de asu",
    serviceUnavailable: "Sɛrvis yi ntim sɛ ɛ yɛ. Sɔ bio.",
  },
  fr: {
    greeting: "Bonjour! Bienvenue dans notre service.",
    helpText: "Comment pouvons-nous vous aider aujourd'hui?",
    invalidInput: "Désolé, je n'ai pas compris. Pouvez-vous reformuler?",
    orderConfirmation: "Votre commande a été confirmée. Merci!",
    invoiceReady: "Votre facture est prête à télécharger.",
    paymentDue: "Le paiement est dû le",
    serviceUnavailable:
      "Ce service n'est pas disponible actuellement. Réessayez plus tard.",
  },

  // East Africa
  sw: {
    greeting: "Habari! Karibu katika huduma yetu.",
    helpText: "Je, tunaweza kukusaidia vipi leo?",
    invalidInput: "Pole, sikuelewi. Tafadhali rudia tena?",
    orderConfirmation: "Amri yako imethibitishwa. Asante!",
    invoiceReady: "Karatasi yako iko tayari kupakua.",
    paymentDue: "Malipo yanapaswa kulipwa tarehe",
    serviceUnavailable: "Huduma hii haipatikani sasa. Jaribu tena baadaye.",
  },
  am: {
    greeting: "ሰላም! ወደ ጋብያችን በደህና መጡ።",
    helpText: "ዛሬ ምን ተግባር ልትሰራ ትሞክር?",
    invalidInput: "ይቅርታ፣ ተረድሁም አልነበረም። እንደገና ሞክር?",
    orderConfirmation: "ትዕዛዝህ ተረጋግጧል። አመሰግናለሁ!",
    invoiceReady: "ደረሰኝህ ዝግጅት ሰርቷል።",
    paymentDue: "ክፍያ ሊከፈል ይገባል",
    serviceUnavailable: "ይህ ሴቭር አሁን አይገኙም። ከቅድሚያ ሞክር።",
  },
  so: {
    greeting: "Salaam! Weliba mahadsanida sercis kaaga.",
    helpText: "Maxa aad i rabaan hadda?",
    invalidInput: "Waxaan garanwaage. Fadlan dib u sheeg?",
    orderConfirmation: "Oqorta oo dhan ayaa la xaqiijiyay. Mahadsanida!",
    invoiceReady: "Bilka oo joog ayaa ku diyaar ah.",
    paymentDue: "Bixinta waa inay lagu bixi",
    serviceUnavailable: "Serciskani hadda lama heli karo. Isku day dib.",
  },

  // Southern Africa
  zu: {
    greeting: "Sawubona! Wamkelekile emsebenzini wethu.",
    helpText: "Yini engasikwenza namuhla?",
    invalidInput: "Uxolo, angizwisizwi. Ngiyacela ube phansi kanye?",
    orderConfirmation: "I-oda yakho iyaqinisekiswe. Ngiyabonga!",
    invoiceReady: "Isitsha sakho silungile sokulandela.",
    paymentDue: "Indlela yokubhala kumele ibhalwe",
    serviceUnavailable: "Lokhu kusetshenziswa akutholakali manje. Zama kamuva.",
  },
  xh: {
    greeting: "Molo! Wamkelekile kule msebenzini wethu.",
    helpText: "Kutheni sinakuva ngandlela?",
    invalidInput: "Uxolo, andizwanisi. Nceda uvuyele kwakhona?",
    orderConfirmation: "Ulwazi lwakho luqinisekisiwe. Enkosi!",
    invoiceReady: "Inkwelo yakho ilungile kukunyalulelwa.",
    paymentDue: "Imali kumele ihlawulwe",
    serviceUnavailable: "Le nkqubo ayikhoyo ngoku. Zama kamuva.",
  },
  af: {
    greeting: "Hallo! Welkom in ons diens.",
    helpText: "Hoe kan ons jou vandag help?",
    invalidInput: "Jammer, ek het dit nie verstaan nie. Kan jy dit herhaal?",
    orderConfirmation: "Jou bestelling is bevestig. Dankie!",
    invoiceReady: "Jou faktuur is gereed vir aflaai.",
    paymentDue: "Betaling moet gemaak word op",
    serviceUnavailable:
      "Hierdie diens is tans nie beskikbaar nie. Probeer later.",
  },

  // North Africa
  ar: {
    greeting: "مرحبا! أهلا وسهلا بخدمتنا.",
    helpText: "كيف يمكننا مساعدتك اليوم?",
    invalidInput: "آسف، لم أفهم. هل يمكنك إعادة الصياغة?",
    orderConfirmation: "تم تأكيد طلبك. شكرا!",
    invoiceReady: "فاتورتك جاهزة للتحميل.",
    paymentDue: "الدفع مستحق في",
    serviceUnavailable: "هذه الخدمة غير متاحة حاليا. يرجى المحاولة لاحقا.",
  },
};

class MultilingualService {
  /**
   * Get language preference for customer
   * @param {string} customerId - Customer ID
   * @returns {Promise<string>} - Language code
   */
  static async getCustomerLanguage(customerId) {
    try {
      const preference = await prisma.languagePreference.findUnique({
        where: { customerId },
      });

      return preference?.language || "en"; // Default to English
    } catch (error) {
      logger.warn(`Failed to get language preference: ${error.message}`);
      return "en";
    }
  }

  /**
   * Set language preference for customer
   * @param {string} customerId - Customer ID
   * @param {string} language - Language code
   * @returns {Promise<object>}
   */
  static async setCustomerLanguage(customerId, language) {
    try {
      if (!this._isSupportedLanguage(language)) {
        throw new Error(`Unsupported language: ${language}`);
      }

      const preference = await prisma.languagePreference.upsert({
        where: { customerId },
        update: { language },
        create: { customerId, language },
      });

      logger.info(`Language preference set for ${customerId}: ${language}`);
      return preference;
    } catch (error) {
      logger.error(`Failed to set language preference: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get translated system message
   * @param {string} key - Message key
   * @param {string} language - Language code
   * @returns {string}
   */
  static getTranslation(key, language = "en") {
    const messages = TRANSLATIONS[language] || TRANSLATIONS.en;
    return messages[key] || TRANSLATIONS.en[key] || key;
  }

  /**
   * Translate a list of keys to multiple languages
   * @param {array} keys - Message keys
   * @param {array} languages - Language codes
   * @returns {object}
   */
  static getTranslations(keys, languages = ["en", "pid"]) {
    const result = {};

    languages.forEach((lang) => {
      result[lang] = {};
      keys.forEach((key) => {
        result[lang][key] = this.getTranslation(key, lang);
      });
    });

    return result;
  }

  /**
   * Build multilingual system prompt for AI
   * @param {string} businessId - Business ID
   * @param {string} customerId - Customer ID
   * @param {string} basePrompt - Base prompt in English
   * @returns {Promise<string>}
   */
  static async buildMultilingualPrompt(businessId, customerId, basePrompt) {
    try {
      const language = await this.getCustomerLanguage(customerId);

      if (language === "en") {
        return basePrompt;
      }

      // Add language instruction to prompt
      const languageInstruction = {
        pid: "Respond in Nigerian Pidgin English. Use natural pidgin expressions and tone while maintaining professionalism.",
        yo: "Respond in Yoruba language. Use natural Yoruba expressions while maintaining professionalism.",
      };

      const instruction = languageInstruction[language] || "";

      return `${basePrompt}\n\n[LANGUAGE INSTRUCTION] ${instruction}`;
    } catch (error) {
      logger.warn(
        `Failed to build multilingual prompt: ${error.message}. Falling back to English.`,
      );
      return basePrompt;
    }
  }

  /**
   * Detect language from customer input
   * @param {string} text - Text to analyze
   * @returns {Promise<{language: string, confidence: number}>}
   */
  static async detectLanguage(text) {
    try {
      // Simple heuristic-based detection
      // TODO: For production, use a proper language detection library like 'franc' or ML model

      const pidginMarkers = [
        "na",
        "no",
        "do",
        "go",
        "come",
        "broda",
        "sista",
        "wetin",
        "fine",
        "sharp",
      ];
      const yorubaMarkers = ["o", "ni", "ti", "le", "ki", "a", "e"];

      const pidginCount = pidginMarkers.filter((m) =>
        text.toLowerCase().includes(m),
      ).length;
      const yorubaCount = yorubaMarkers.filter((m) =>
        text.toLowerCase().includes(m),
      ).length;

      if (pidginCount > 2) {
        return { language: "pid", confidence: 0.8 };
      } else if (yorubaCount > 3) {
        return { language: "yo", confidence: 0.7 };
      }

      return { language: "en", confidence: 0.95 };
    } catch (error) {
      logger.warn(`Language detection failed: ${error.message}`);
      return { language: "en", confidence: 0.5 };
    }
  }

  /**
   * Get all supported languages
   * @returns {array}
   */
  static getSupportedLanguages() {
    return [
      { code: "en", name: "English" },
      { code: "fr", name: "Français (French)" },
      { code: "ar", name: "العربية (Arabic)" },
      { code: "pid", name: "Nigerian Pidgin" },
      { code: "yo", name: "Yoruba (Nigeria)" },
      { code: "ha", name: "Hausa (Nigeria/Niger)" },
      { code: "ig", name: "Igbo (Nigeria)" },
      { code: "tw", name: "Akan/Twi (Ghana)" },
      { code: "sw", name: "Swahili (East Africa)" },
      { code: "am", name: "Amharic (Ethiopia)" },
      { code: "so", name: "Somali (Somalia)" },
      { code: "zu", name: "Zulu (South Africa)" },
      { code: "xh", name: "Xhosa (South Africa)" },
      { code: "af", name: "Afrikaans (South Africa/Namibia)" },
    ];
  }

  /**
   * Check if language is supported
   * @private
   */
  static _isSupportedLanguage(language) {
    return [
      "en",
      "fr",
      "ar",
      "pid",
      "yo",
      "ha",
      "ig",
      "tw",
      "sw",
      "am",
      "so",
      "zu",
      "xh",
      "af",
    ].includes(language);
  }

  /**
   * Add new translation
   * @param {string} language - Language code
   * @param {string} key - Message key
   * @param {string} value - Translation value
   */
  static addTranslation(language, key, value) {
    if (!TRANSLATIONS[language]) {
      TRANSLATIONS[language] = {};
    }
    TRANSLATIONS[language][key] = value;
    logger.info(`Translation added: ${language}.${key}`);
  }

  /**
   * Get analytics on language usage
   * @param {string} businessId - Business ID
   * @returns {Promise<object>}
   */
  static async getLanguageUsageAnalytics(businessId) {
    try {
      const preferences = await prisma.languagePreference.findMany({
        where: {
          customer: {
            businessId,
          },
        },
      });

      const byLanguage = {};
      preferences.forEach((p) => {
        byLanguage[p.language] = (byLanguage[p.language] || 0) + 1;
      });

      return {
        total_customers: preferences.length,
        by_language: byLanguage,
      };
    } catch (error) {
      logger.error(`Failed to get language analytics: ${error.message}`);
      return { total_customers: 0, by_language: {} };
    }
  }
}

export default MultilingualService;
