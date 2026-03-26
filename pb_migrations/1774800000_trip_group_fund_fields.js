migrate((app) => {
  var _a;

  try {
    const collection = app.findCollectionByNameOrId("trips");
    const json = JSON.parse(JSON.stringify(collection));
    const fields = json.fields || ((_a = json.schema) !== null && _a !== void 0 ? _a : []);

    const ensureField = (name, definition) => {
      if (!fields.some((field) => field && field.name === name)) {
        fields.push(definition);
      }
    };

    ensureField("groupName", {
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text1774800101",
      "max": 255,
      "min": 0,
      "name": "groupName",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    });

    ensureField("groupSize", {
      "hidden": false,
      "id": "number1774800102",
      "max": null,
      "min": 2,
      "name": "groupSize",
      "onlyInt": true,
      "presentable": false,
      "required": false,
      "system": false,
      "type": "number"
    });

    ensureField("groupFund", {
      "hidden": false,
      "id": "number1774800103",
      "max": null,
      "min": 0,
      "name": "groupFund",
      "onlyInt": false,
      "presentable": false,
      "required": false,
      "system": false,
      "type": "number"
    });

    app.importCollections([json], false);
  } catch (err) {
    console.error("Trip group fund migration error:", err);
  }
}, (app) => {
  var _a;

  try {
    const collection = app.findCollectionByNameOrId("trips");
    const json = JSON.parse(JSON.stringify(collection));
    const fields = json.fields || ((_a = json.schema) !== null && _a !== void 0 ? _a : []);

    json.fields = fields.filter((field) => field && !["groupName", "groupSize", "groupFund"].includes(field.name));
    app.importCollections([json], false);
  } catch (err) {
    console.error("Trip group fund rollback error:", err);
  }
});
