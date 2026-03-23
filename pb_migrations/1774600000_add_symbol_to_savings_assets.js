migrate((app) => {
  var _a;
  try {
    const collection = app.findCollectionByNameOrId("savings_assets");
    const json = JSON.parse(JSON.stringify(collection));
    const fields = json.fields || ((_a = json.schema) !== null && _a !== void 0 ? _a : []);
    const hasSymbol = fields.some((field) => field && field.name === "symbol");

    if (hasSymbol) {
      return null;
    }

    const symbolField = {
      autogeneratePattern: "",
      hidden: false,
      id: "text1774600101",
      max: 20,
      min: 0,
      name: "symbol",
      pattern: "^[A-Z0-9-]{2,20}$",
      presentable: false,
      primaryKey: false,
      required: false,
      system: false,
      type: "text",
    };

    if (json.schema) {
      symbolField.options = { min: null, max: 20, pattern: "^[A-Z0-9-]{2,20}$" };
    }

    fields.push(symbolField);
    app.importCollections([json], false);
  } catch (err) {
    console.error("Migration upgrade error:", err);
  }
}, (app) => {
  var _a;
  try {
    const collection = app.findCollectionByNameOrId("savings_assets");
    const json = JSON.parse(JSON.stringify(collection));
    const fields = json.fields || ((_a = json.schema) !== null && _a !== void 0 ? _a : []);
    const filtered = fields.filter((field) => field && field.name !== "symbol");

    if (filtered.length === fields.length) {
      return null;
    }

    if (json.fields) {
      json.fields = filtered;
    } else if (json.schema) {
      json.schema = filtered;
    }

    app.importCollections([json], false);
  } catch (err) {
    console.error("Migration downgrade error:", err);
  }
});
