export const LOAD_ON_RISK_LABEL = 'Load on risk'

/** Shown in the tanker card caption when unchecked. */
export const LOAD_ON_RISK_DETAIL =
  'Tankers should be cleaned before each load at the producer. Check if you are requesting load without cleaning (e.g. palm then soyabean).'

/** Shown in the tanker card caption when checked. */
export const LOAD_ON_RISK_DETAIL_ACTIVE =
  'Producer may load without cleaning — waiver is included when you share this lift on WhatsApp.'

/** Standard waiver text when loading without tanker cleaning at the producer. */
export const LOAD_ON_RISK_WHATSAPP_LINES = [
  'We request the producer to load this tanker *without prior cleaning/servicing*, at our risk.',
  'The tanker may have carried a different commodity on the previous trip (e.g. palm after soyabean), increasing mix-up and contamination risk.',
  'We accept responsibility for any quality or compliance issues. Loading without cleaning may not meet food safety regulations (FSSAI / FDA).',
  'The producer / seller is not liable for issues arising from this waiver.',
] as const
