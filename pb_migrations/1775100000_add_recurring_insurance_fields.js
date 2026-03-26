migrate((app) => {
  var _a;

  try {
    const collection = app.findCollectionByNameOrId("savings_assets");
    const json = JSON.parse(JSON.stringify(collection));
    const fields = json.fields || ((_a = json.schema) !== null && _a !== void 0 ? _a : []);

    if (!fields.some((field) => field && field.name === "recurringMonthlyAmount")) {
      fields.push({
        "hidden": false,
        "id": "number1775100101",
        "max": null,
        "min": 0,
        "name": "recurringMonthlyAmount",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      });
    }

    if (!fields.some((field) => field && field.name === "recurringStartDate")) {
      fields.push({
        "hidden": false,
        "id": "date1775100102",
        "max": "",
        "min": "",
        "name": "recurringStartDate",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "date"
      });
    }

    app.importCollections([json], false);
  } catch (err) {
    console.error("Recurring insurance savings migration error:", err);
  }
}, (app) => {
  var _a;

  try {
    const collection = app.findCollectionByNameOrId("savings_assets");
    const json = JSON.parse(JSON.stringify(collection));
    const fields = json.fields || ((_a = json.schema) !== null && _a !== void 0 ? _a : []);

    json.fields = fields.filter((field) => field && !["recurringMonthlyAmount", "recurringStartDate"].includes(field.name));
    app.importCollections([json], false);
  } catch (err) {
    console.error("Recurring insurance savings rollback error:", err);
  }
});
