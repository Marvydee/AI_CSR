import Joi from "joi";

const whatsappMessageSchema = Joi.object({
  entry: Joi.array()
    .items(
      Joi.object({
        changes: Joi.array()
          .items(
            Joi.object({
              value: Joi.object({
                messages: Joi.array()
                  .items(
                    Joi.object({
                      from: Joi.string().required(),
                      id: Joi.string().required(),
                      text: Joi.object({
                        body: Joi.string().max(2000).required(),
                      }).required(),
                    }),
                  )
                  .optional(),
                metadata: Joi.object({
                  phone_number_id: Joi.string().required(),
                }).required(),
                contacts: Joi.array().optional(),
              }).required(),
            }),
          )
          .required(),
      }),
    )
    .required(),
}).unknown(true);

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
});

const signupSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(120).required(),
  email: Joi.string().trim().email().required(),
  password: Joi.string()
    .min(10)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/)
    .required(),
  businessName: Joi.string().trim().min(2).max(120).required(),
});

const accountUpdateSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).optional(),
  email: Joi.string().trim().email().optional(),
  currentPassword: Joi.string().min(8).optional(),
  newPassword: Joi.string()
    .min(10)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/)
    .optional(),
})
  .custom((value, helpers) => {
    if (
      (value.currentPassword && !value.newPassword) ||
      (!value.currentPassword && value.newPassword)
    ) {
      return helpers.error("any.invalid", {
        message:
          "currentPassword and newPassword are both required to change password",
      });
    }
    return value;
  })
  .min(1)
  .required();

const draftApproveSchema = Joi.object({
  body: Joi.string().trim().min(1).max(2000).optional(),
});

const draftRejectSchema = Joi.object({
  reason: Joi.string().trim().max(300).allow("", null).optional(),
});

const businessUpdateSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  whatsappPhoneNumberId: Joi.string().trim().max(64).allow("", null).optional(),
  whatsappBusinessNumber: Joi.string()
    .trim()
    .max(32)
    .allow("", null)
    .optional(),
  customSystemPrompt: Joi.string().trim().max(6000).allow("", null).optional(),
  bankName: Joi.string().trim().max(120).allow("", null).optional(),
  bankAccountName: Joi.string().trim().max(120).allow("", null).optional(),
  bankAccountNumber: Joi.string()
    .trim()
    .pattern(/^\d{6,20}$/)
    .allow("", null)
    .optional(),
  services: Joi.array().items(Joi.string()).optional(),
  prices: Joi.object().optional(),
  faqs: Joi.array().optional(),
  toneProfile: Joi.string().max(500).optional(),
});

const productCreateSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
  sku: Joi.string().trim().max(80).allow("", null).optional(),
  description: Joi.string().trim().max(2000).allow("", null).optional(),
  category: Joi.string().trim().max(120).allow("", null).optional(),
  price: Joi.number().min(0).precision(2).required(),
  currency: Joi.string().trim().max(8).default("NGN"),
  isActive: Joi.boolean().default(true),
});

const productUpdateSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).optional(),
  sku: Joi.string().trim().max(80).allow("", null).optional(),
  description: Joi.string().trim().max(2000).allow("", null).optional(),
  category: Joi.string().trim().max(120).allow("", null).optional(),
  price: Joi.number().min(0).precision(2).optional(),
  currency: Joi.string().trim().max(8).optional(),
  isActive: Joi.boolean().optional(),
})
  .min(1)
  .required();

const productImportSchema = Joi.object({
  fileName: Joi.string().trim().max(255).required(),
  fileBase64: Joi.string().trim().min(10).required(),
});

const trainingUpdateSchema = Joi.object({
  services: Joi.array().items(Joi.string().trim()).optional(),
  prices: Joi.object().optional(),
  faqs: Joi.array()
    .items(
      Joi.alternatives().try(
        Joi.string().trim(),
        Joi.object({
          q: Joi.string().trim().required(),
          a: Joi.string().trim().required(),
        }),
      ),
    )
    .optional(),
  toneProfile: Joi.string().trim().max(500).optional(),
  businessHours: Joi.string().trim().max(200).optional(),
  location: Joi.string().trim().max(200).optional(),
  paymentMethods: Joi.array().items(Joi.string().trim()).optional(),
  escalationRule: Joi.string().trim().max(600).optional(),
  followUpEnabled: Joi.boolean().optional(),
  followUpDelayHours: Joi.number().min(1).max(168).optional(),
  followUpMessage: Joi.string().trim().max(500).optional(),
})
  .min(1)
  .required();

const onboardingUpdateSchema = Joi.object({
  completed: Joi.boolean().optional(),
  stage: Joi.string().trim().max(50).optional(),
  notes: Joi.string().trim().max(1000).allow("", null).optional(),
  checklist: Joi.object().optional(),
})
  .min(1)
  .required();

export const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      strip: true,
    });

    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join("."),
        message: d.message,
      }));
      console.warn("[Validation] Request validation failed", details);
      return res.status(400).json({ error: "Validation failed", details });
    }

    req.validatedBody = value;
    next();
  };
};

export {
  whatsappMessageSchema,
  loginSchema,
  signupSchema,
  accountUpdateSchema,
  draftApproveSchema,
  draftRejectSchema,
  businessUpdateSchema,
  productCreateSchema,
  productUpdateSchema,
  productImportSchema,
  onboardingUpdateSchema,
  trainingUpdateSchema,
};
