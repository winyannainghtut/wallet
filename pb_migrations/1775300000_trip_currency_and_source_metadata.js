migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("trips");
    const json = JSON.parse(JSON.stringify(collection));
    const fields = json.fields || json.schema || [];
    let didChange = false;

    if (!fields.some((field) => field && field.name === "currency")) {
      fields.push({
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1775300101",
        "max": 3,
        "min": 0,
        "name": "currency",
        "pattern": "^[A-Z]{3}$",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      });
      didChange = true;
    }

    if (!fields.some((field) => field && field.name === "exchangeRate")) {
      fields.push({
        "hidden": false,
        "id": "number1775300102",
        "max": null,
        "min": 0.000001,
        "name": "exchangeRate",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      });
      didChange = true;
    }

    if (didChange) {
      app.importCollections([json], false);
    }
  } catch (err) {
    console.error("Trip currency migration error:", err);
  }

  try {
    const collection = app.findCollectionByNameOrId("transactions");
    const json = JSON.parse(JSON.stringify(collection));
    const fields = json.fields || json.schema || [];
    let didChange = false;

    if (!fields.some((field) => field && field.name === "sourceAmount")) {
      fields.push({
        "hidden": false,
        "id": "number1775300201",
        "max": null,
        "min": 0.000001,
        "name": "sourceAmount",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      });
      didChange = true;
    }

    if (!fields.some((field) => field && field.name === "sourceCurrency")) {
      fields.push({
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1775300202",
        "max": 3,
        "min": 0,
        "name": "sourceCurrency",
        "pattern": "^[A-Z]{3}$",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      });
      didChange = true;
    }

    if (!fields.some((field) => field && field.name === "sourceExchangeRate")) {
      fields.push({
        "hidden": false,
        "id": "number1775300203",
        "max": null,
        "min": 0.000001,
        "name": "sourceExchangeRate",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      });
      didChange = true;
    }

    if (didChange) {
      app.importCollections([json], false);
    }
  } catch (err) {
    console.error("Trip source metadata migration error:", err);
  }
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("transactions");
    const json = JSON.parse(JSON.stringify(collection));
    const fields = json.fields || json.schema || [];
    json.fields = fields.filter(
      (field) => field && !["sourceAmount", "sourceCurrency", "sourceExchangeRate"].includes(field.name)
    );
    app.importCollections([json], false);
  } catch (err) {
    console.error("Trip source metadata rollback error:", err);
  }

  try {
    const collection = app.findCollectionByNameOrId("trips");
    const json = JSON.parse(JSON.stringify(collection));
    const fields = json.fields || json.schema || [];
    json.fields = fields.filter(
      (field) => field && !["currency", "exchangeRate"].includes(field.name)
    );
    app.importCollections([json], false);
  } catch (err) {
    console.error("Trip currency rollback error:", err);
  }
});
