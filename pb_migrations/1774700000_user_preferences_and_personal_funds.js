migrate((app) => {
  var _a, _b;

  try {
    const collection = app.findCollectionByNameOrId("savings_assets");
    const json = JSON.parse(JSON.stringify(collection));
    const fields = json.fields || ((_a = json.schema) !== null && _a !== void 0 ? _a : []);
    const typeField = fields.find((field) => field && field.name === "type");
    const values = Array.isArray(typeField === null || typeField === void 0 ? void 0 : typeField.values)
      ? typeField.values
      : Array.isArray(typeField === null || typeField === void 0 ? void 0 : (_b = typeField.options) === null || _b === void 0 ? void 0 : _b.values)
        ? typeField.options.values
        : null;

    if (values && !values.includes("personal_funds")) {
      values.push("personal_funds");
      app.importCollections([json], false);
    }
  } catch (err) {
    console.error("Savings assets migration error:", err);
  }

  try {
    app.findCollectionByNameOrId("user_preferences");
  } catch {
    const snapshot = [
      {
        "createRule": "@request.auth.id != \"\"",
        "deleteRule": "user = @request.auth.id",
        "fields": [
          {
            "autogeneratePattern": "[a-z0-9]{15}",
            "hidden": false,
            "id": "text3208210256",
            "max": 15,
            "min": 15,
            "name": "id",
            "pattern": "^[a-z0-9]+$",
            "presentable": false,
            "primaryKey": true,
            "required": true,
            "system": true,
            "type": "text"
          },
          {
            "cascadeDelete": false,
            "collectionId": "_pb_users_auth_",
            "hidden": false,
            "id": "relation1774700101",
            "maxSelect": 1,
            "minSelect": 0,
            "name": "user",
            "presentable": false,
            "required": false,
            "system": false,
            "type": "relation"
          },
          {
            "autogeneratePattern": "",
            "hidden": false,
            "id": "text1774700102",
            "max": 10,
            "min": 0,
            "name": "language",
            "pattern": "",
            "presentable": false,
            "primaryKey": false,
            "required": false,
            "system": false,
            "type": "text"
          },
          {
            "autogeneratePattern": "",
            "hidden": false,
            "id": "text1774700103",
            "max": 10,
            "min": 0,
            "name": "currency",
            "pattern": "",
            "presentable": false,
            "primaryKey": false,
            "required": false,
            "system": false,
            "type": "text"
          },
          {
            "autogeneratePattern": "",
            "hidden": false,
            "id": "text1774700104",
            "max": 20,
            "min": 0,
            "name": "aiModel",
            "pattern": "",
            "presentable": false,
            "primaryKey": false,
            "required": false,
            "system": false,
            "type": "text"
          },
          {
            "autogeneratePattern": "",
            "hidden": false,
            "id": "text1774700105",
            "max": 30,
            "min": 0,
            "name": "theme",
            "pattern": "",
            "presentable": false,
            "primaryKey": false,
            "required": false,
            "system": false,
            "type": "text"
          },
          {
            "autogeneratePattern": "",
            "hidden": false,
            "id": "text1774700106",
            "max": 0,
            "min": 0,
            "name": "customCategories",
            "pattern": "",
            "presentable": false,
            "primaryKey": false,
            "required": false,
            "system": false,
            "type": "text"
          },
          {
            "autogeneratePattern": "",
            "hidden": false,
            "id": "text1774700107",
            "max": 0,
            "min": 0,
            "name": "chatHistory",
            "pattern": "",
            "presentable": false,
            "primaryKey": false,
            "required": false,
            "system": false,
            "type": "text"
          },
          {
            "hidden": false,
            "id": "autodate2990389176",
            "name": "created",
            "onCreate": true,
            "onUpdate": false,
            "presentable": false,
            "system": false,
            "type": "autodate"
          },
          {
            "hidden": false,
            "id": "autodate3332085495",
            "name": "updated",
            "onCreate": true,
            "onUpdate": true,
            "presentable": false,
            "system": false,
            "type": "autodate"
          }
        ],
        "id": "pbc_4499911004",
        "indexes": [
          "CREATE UNIQUE INDEX `idx_user_preferences_user` ON `user_preferences` (`user`)"
        ],
        "listRule": "user = @request.auth.id",
        "name": "user_preferences",
        "system": false,
        "type": "base",
        "updateRule": "user = @request.auth.id",
        "viewRule": "user = @request.auth.id"
      }
    ];

    app.importCollections(snapshot, false);
  }
}, (app) => {
  var _a, _b;

  try {
    const collection = app.findCollectionByNameOrId("savings_assets");
    const json = JSON.parse(JSON.stringify(collection));
    const fields = json.fields || ((_a = json.schema) !== null && _a !== void 0 ? _a : []);
    const typeField = fields.find((field) => field && field.name === "type");
    const values = Array.isArray(typeField === null || typeField === void 0 ? void 0 : typeField.values)
      ? typeField.values
      : Array.isArray(typeField === null || typeField === void 0 ? void 0 : (_b = typeField.options) === null || _b === void 0 ? void 0 : _b.values)
        ? typeField.options.values
        : null;

    if (values && values.includes("personal_funds")) {
      const filtered = values.filter((value) => value !== "personal_funds");
      if (typeField.values) {
        typeField.values = filtered;
      } else if (typeField.options && Array.isArray(typeField.options.values)) {
        typeField.options.values = filtered;
      }
      app.importCollections([json], false);
    }
  } catch (err) {
    console.error("Savings assets rollback error:", err);
  }

  try {
    const collection = app.findCollectionByNameOrId("user_preferences");
    app.delete(collection);
  } catch {}
});
