migrate((app) => {
  var _a;
  try {
    const collection = app.findCollectionByNameOrId("incomes");
    const json = JSON.parse(JSON.stringify(collection));
    const fields = json.fields || ((_a = json.schema) !== null && _a !== void 0 ? _a : []);
    const cat = fields.find(f => f.name === "category");
    if (cat && cat.type === "select") {
      cat.type = "text";
      delete cat.values;
      delete cat.maxSelect;
      if (json.schema) {
        cat.options = { min: null, max: null, pattern: "" };
      }
      app.importCollections([json], false);
    }
  } catch (err) {
    console.error("Migration upgrade error:", err);
  }
}, (app) => {
  var _a;
  try {
    const collection = app.findCollectionByNameOrId("incomes");
    const json = JSON.parse(JSON.stringify(collection));
    const fields = json.fields || ((_a = json.schema) !== null && _a !== void 0 ? _a : []);
    const cat = fields.find(f => f.name === "category");
    if (cat && cat.type === "text") {
      cat.type = "select";
      if (json.fields) {
        cat.values = ["salary", "bonus", "freelance", "business", "investment", "other"];
        cat.maxSelect = 1;
      } else if (json.schema) {
        cat.options = { maxSelect: 1, values: ["salary", "bonus", "freelance", "business", "investment", "other"] };
      }
      app.importCollections([json], false);
    }
  } catch (err) {
    console.error("Migration downgrade error:", err);
  }
});
