import type { Captured } from "./fake-browser.js";

export const captured: Captured = {
  "query": "tofu",
  "productUrl": "https://www.etiketbio.eu/plats-prepares/6851-soy-salade-de-lentilles-epeautre-tofu-fume-220g-3259011178919.html",
  "expected": {
    "productId": "6851:0",
    "name": "Salade lentilles épeautre tofu fumé bio Soy",
    "price": 3.4
  },
  "searchRaw": [
    {
      "id_product": "6851",
      "id_product_attribute": "0",
      "name": "Salade lentilles épeautre tofu fumé bio Soy",
      "url": "https://www.etiketbio.eu/plats-prepares/6851-soy-salade-de-lentilles-epeautre-tofu-fume-220g-3259011178919.html",
      "price": "3,40 €",
      "regular_price": null,
      "unit_price": null,
      "brand": null,
      "flags": [
        "Soy"
      ],
      "button": "enabled",
      "availability": null
    },
    {
      "id_product": "7794",
      "id_product_attribute": "0",
      "name": "Raviolis tofu/basilic 680g",
      "url": "https://www.etiketbio.eu/ravioli-bio-en-conserve/7794-prosain-raviolis-tofu-basilic-680g-3335880006529.html",
      "price": "5,80 €",
      "regular_price": null,
      "unit_price": null,
      "brand": null,
      "flags": [
        "Prosain"
      ],
      "button": "enabled",
      "availability": null
    },
    {
      "id_product": "27215",
      "id_product_attribute": "0",
      "name": "Pot - tofu celnat 250g",
      "url": "https://www.etiketbio.eu/melanges-prparations/27215-pot-tofu-celnat-250g-3273120031736.html",
      "price": "3,87 €",
      "regular_price": null,
      "unit_price": null,
      "brand": null,
      "flags": [
        "Celnat bio"
      ],
      "button": "absent",
      "availability": "https://schema.org/OutOfStock"
    }
  ],
  "productRaw": {
    "info": {
      "name": "Salade lentilles épeautre tofu fumé bio Soy",
      "sku": "3259011178919",
      "gtin": "3259011178919",
      "brand": "Soy",
      "description": "Salade de lentilles, épeautre et tofu fumé bio Soy 220 g : prête à manger, sans réchauffage ni frigo. 100 % végétale. Livraison offerte dès 19 €.",
      "price": "3.4",
      "availability": "https://schema.org/InStock"
    },
    "id_product": "6851",
    "id_product_attribute": "0",
    "data_quantity": 8,
    "button": "enabled",
    "ingredients": null,
    "nutrition": [],
    "url": "https://www.etiketbio.eu/plats-prepares/6851-soy-salade-de-lentilles-epeautre-tofu-fume-220g-3259011178919.html",
    "unit_price": null
  },
  "cartEmpty": {
    "total_text": "0,00 €",
    "products": []
  },
  "cartFilled": {
    "quantity": 2,
    "raw": {
      "total_text": "6,80 €",
      "products": [
        {
          "id_product": "6851",
          "id_product_attribute": "0",
          "name": "Salade lentilles épeautre tofu fumé bio Soy",
          "quantity": "2",
          "unit_price": 3.4,
          "line_total": 6.8,
          "available_quantity": null
        }
      ]
    }
  }
};
