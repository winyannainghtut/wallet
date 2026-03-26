migrate((app) => {
  var _a;

  try {
    const collection = app.findCollectionByNameOrId("transactions");
    const json = JSON.parse(JSON.stringify(collection));
    const fields = json.fields || ((_a = json.schema) !== null && _a !== void 0 ? _a : []);

    if (!fields.some((field) => field && field.name === "sharedGroupExpense")) {
      fields.push({
        "hidden": false,
        "id": "bool1775000101",
        "name": "sharedGroupExpense",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      });
      app.importCollections([json], false);
    }
  } catch (err) {
    console.error("Shared group expense migration error:", err);
  }
}, (app) => {
  var _a;

  try {
    const collection = app.findCollectionByNameOrId("transactions");
    const json = JSON.parse(JSON.stringify(collection));
    const fields = json.fields || ((_a = json.schema) !== null && _a !== void 0 ? _a : []);

    json.fields = fields.filter((field) => field && field.name !== "sharedGroupExpense");
    app.importCollections([json], false);
  } catch (err) {
    console.error("Shared group expense rollback error:", err);
  }
});
