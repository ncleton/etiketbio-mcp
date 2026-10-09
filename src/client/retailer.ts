// Fichier généré par generate.mjs à partir de retailers/etiketbio/spec.json. Ne pas modifier ici.
export interface ScopeField { key: string; env: string; description: string; example: string; pattern?: string }
export const RETAILER: {
  id: string; slug: string; version: string; label: string; origin: string; entryUrl: string; loginUrl: string; signupUrl: string;
  platform: string; fulfillment: ReadonlyArray<"delivery" | "click_and_collect">; accountRequired: boolean;
  scopeFields: ReadonlyArray<ScopeField>;
} = {
  "id": "etiketbio",
  "slug": "etiketbio",
  "version": "0.1.1",
  "label": "Etiketbio",
  "origin": "https://www.etiketbio.eu",
  "entryUrl": "https://www.etiketbio.eu/",
  "loginUrl": "https://www.etiketbio.eu/connexion",
  "signupUrl": "https://www.etiketbio.eu/connexion?create_account=1",
  "platform": "prestashop",
  "fulfillment": [
    "delivery"
  ],
  "accountRequired": false,
  "scopeFields": []
};
