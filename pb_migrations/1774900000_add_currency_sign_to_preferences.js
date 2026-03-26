migrate((app) => {
  var _a;

  try {
    const collection = app.findCollectionByNameOrId("user_preferences");
    const json = JSON.parse(JSON.stringify(collection));
    const fields = json.fields || ((_a = json.schema) !== null && _a !== void 0 ? _a : []);

    if (!fields.some((field) => field && field.name === "currencySign")) {
      fields.push({
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1774900101",
        "max": 8,
        "min": 0,
        "name": "currencySign",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      });
      app.importCollections([json], false);
    }
  } catch (err) {
    console.error("Currency sign migration error:", err);
  }
}, (app) => {
  var _a;

  try {
    const collection = app.findCollectionByNameOrId("user_preferences");
    const json = JSON.parse(JSON.stringify(collection));
    const fields = json.fields || ((_a = json.schema) !== null && _a !== void 0 ? _a : []);

    json.fields = fields.filter((field) => field && field.name !== "currencySign");
    app.importCollections([json], false);
  } catch (err) {
    console.error("Currency sign rollback error:", err);
  }
});
