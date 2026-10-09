import { createPrestashopAdapter } from "./platform.js";

export const adapter = createPrestashopAdapter({
  origin: "https://www.etiketbio.eu",
  hosts: ["www.etiketbio.eu","etiketbio.eu"],
});
