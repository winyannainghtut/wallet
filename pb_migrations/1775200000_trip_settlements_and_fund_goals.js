migrate((app) => {
  var _a;

  try {
    app.findCollectionByNameOrId("trip_members");
  } catch {
    app.importCollections([
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
            "id": "relation1775200101",
            "maxSelect": 1,
            "minSelect": 0,
            "name": "user",
            "presentable": false,
            "required": false,
            "system": false,
            "type": "relation"
          },
          {
            "cascadeDelete": true,
            "collectionId": "pbc_3568628032",
            "hidden": false,
            "id": "relation1775200102",
            "maxSelect": 1,
            "minSelect": 0,
            "name": "trip",
            "presentable": false,
            "required": true,
            "system": false,
            "type": "relation"
          },
          {
            "autogeneratePattern": "",
            "hidden": false,
            "id": "text1775200103",
            "max": 0,
            "min": 1,
            "name": "name",
            "pattern": "",
            "presentable": false,
            "primaryKey": false,
            "required": true,
            "system": false,
            "type": "text"
          },
          {
            "hidden": false,
            "id": "bool1775200104",
            "name": "isOwner",
            "presentable": false,
            "required": false,
            "system": false,
            "type": "bool"
          },
          {
            "hidden": false,
            "id": "number1775200105",
            "max": null,
            "min": 0,
            "name": "sortOrder",
            "onlyInt": true,
            "presentable": false,
            "required": false,
            "system": false,
            "type": "number"
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
        "id": "pbc_1775200001",
        "indexes": [],
        "listRule": "user = @request.auth.id",
        "name": "trip_members",
        "system": false,
        "type": "base",
        "updateRule": "user = @request.auth.id",
        "viewRule": "user = @request.auth.id"
      }
    ], false);
  }

  try {
    app.findCollectionByNameOrId("trip_settlements");
  } catch {
    app.importCollections([
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
            "id": "relation1775200201",
            "maxSelect": 1,
            "minSelect": 0,
            "name": "user",
            "presentable": false,
            "required": false,
            "system": false,
            "type": "relation"
          },
          {
            "cascadeDelete": true,
            "collectionId": "pbc_3568628032",
            "hidden": false,
            "id": "relation1775200202",
            "maxSelect": 1,
            "minSelect": 0,
            "name": "trip",
            "presentable": false,
            "required": true,
            "system": false,
            "type": "relation"
          },
          {
            "cascadeDelete": false,
            "collectionId": "pbc_1775200001",
            "hidden": false,
            "id": "relation1775200203",
            "maxSelect": 1,
            "minSelect": 0,
            "name": "fromMemberId",
            "presentable": false,
            "required": true,
            "system": false,
            "type": "relation"
          },
          {
            "cascadeDelete": false,
            "collectionId": "pbc_1775200001",
            "hidden": false,
            "id": "relation1775200204",
            "maxSelect": 1,
            "minSelect": 0,
            "name": "toMemberId",
            "presentable": false,
            "required": true,
            "system": false,
            "type": "relation"
          },
          {
            "hidden": false,
            "id": "number1775200205",
            "max": null,
            "min": 0.01,
            "name": "amount",
            "onlyInt": false,
            "presentable": false,
            "required": true,
            "system": false,
            "type": "number"
          },
          {
            "hidden": false,
            "id": "date1775200206",
            "max": "",
            "min": "",
            "name": "date",
            "presentable": false,
            "required": true,
            "system": false,
            "type": "date"
          },
          {
            "hidden": false,
            "id": "select1775200207",
            "maxSelect": 1,
            "name": "status",
            "presentable": false,
            "required": true,
            "system": false,
            "type": "select",
            "values": [
              "planned",
              "paid"
            ]
          },
          {
            "autogeneratePattern": "",
            "hidden": false,
            "id": "text1775200208",
            "max": 0,
            "min": 0,
            "name": "note",
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
        "id": "pbc_1775200002",
        "indexes": [],
        "listRule": "user = @request.auth.id",
        "name": "trip_settlements",
        "system": false,
        "type": "base",
        "updateRule": "user = @request.auth.id",
        "viewRule": "user = @request.auth.id"
      }
    ], false);
  }

  try {
    app.findCollectionByNameOrId("fund_goals");
  } catch {
    app.importCollections([
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
            "id": "relation1775200301",
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
            "id": "text1775200302",
            "max": 0,
            "min": 1,
            "name": "name",
            "pattern": "",
            "presentable": false,
            "primaryKey": false,
            "required": true,
            "system": false,
            "type": "text"
          },
          {
            "hidden": false,
            "id": "number1775200303",
            "max": null,
            "min": 0,
            "name": "targetAmount",
            "onlyInt": false,
            "presentable": false,
            "required": true,
            "system": false,
            "type": "number"
          },
          {
            "hidden": false,
            "id": "date1775200304",
            "max": "",
            "min": "",
            "name": "targetDate",
            "presentable": false,
            "required": false,
            "system": false,
            "type": "date"
          },
          {
            "hidden": false,
            "id": "number1775200305",
            "max": null,
            "min": 0,
            "name": "monthlyContribution",
            "onlyInt": false,
            "presentable": false,
            "required": false,
            "system": false,
            "type": "number"
          },
          {
            "hidden": false,
            "id": "bool1775200306",
            "name": "includeMonthlySavings",
            "presentable": false,
            "required": false,
            "system": false,
            "type": "bool"
          },
          {
            "cascadeDelete": false,
            "collectionId": "pbc_3568628032",
            "hidden": false,
            "id": "relation1775200307",
            "maxSelect": 1,
            "minSelect": 0,
            "name": "linkedTripId",
            "presentable": false,
            "required": false,
            "system": false,
            "type": "relation"
          },
          {
            "cascadeDelete": false,
            "collectionId": "pbc_4499911003",
            "hidden": false,
            "id": "relation1775200308",
            "maxSelect": 100,
            "minSelect": 0,
            "name": "linkedAssets",
            "presentable": false,
            "required": false,
            "system": false,
            "type": "relation"
          },
          {
            "autogeneratePattern": "",
            "hidden": false,
            "id": "text1775200309",
            "max": 0,
            "min": 0,
            "name": "note",
            "pattern": "",
            "presentable": false,
            "primaryKey": false,
            "required": false,
            "system": false,
            "type": "text"
          },
          {
            "hidden": false,
            "id": "select1775200310",
            "maxSelect": 1,
            "name": "status",
            "presentable": false,
            "required": true,
            "system": false,
            "type": "select",
            "values": [
              "active",
              "completed",
              "archived"
            ]
          },
          {
            "autogeneratePattern": "",
            "hidden": false,
            "id": "text1775200311",
            "max": 32,
            "min": 0,
            "name": "color",
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
        "id": "pbc_1775200003",
        "indexes": [],
        "listRule": "user = @request.auth.id",
        "name": "fund_goals",
        "system": false,
        "type": "base",
        "updateRule": "user = @request.auth.id",
        "viewRule": "user = @request.auth.id"
      }
    ], false);
  }

  try {
    const collection = app.findCollectionByNameOrId("transactions");
    const json = JSON.parse(JSON.stringify(collection));
    const fields = json.fields || ((_a = json.schema) !== null && _a !== void 0 ? _a : []);

    if (!fields.some((field) => field && field.name === "paidByMemberId")) {
      fields.push({
        "cascadeDelete": false,
        "collectionId": "pbc_1775200001",
        "hidden": false,
        "id": "relation1775200401",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "paidByMemberId",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      });
      app.importCollections([json], false);
    }
  } catch (err) {
    console.error("Trip settlements/fund goals migration error:", err);
  }
}, (app) => {
  var _a;

  try {
    const collection = app.findCollectionByNameOrId("transactions");
    const json = JSON.parse(JSON.stringify(collection));
    const fields = json.fields || ((_a = json.schema) !== null && _a !== void 0 ? _a : []);
    json.fields = fields.filter((field) => field && field.name !== "paidByMemberId");
    app.importCollections([json], false);
  } catch (err) {
    console.error("Trip settlements/fund goals rollback field error:", err);
  }

  try {
    const collection = app.findCollectionByNameOrId("fund_goals");
    app.delete(collection);
  } catch {}

  try {
    const collection = app.findCollectionByNameOrId("trip_settlements");
    app.delete(collection);
  } catch {}

  try {
    const collection = app.findCollectionByNameOrId("trip_members");
    app.delete(collection);
  } catch {}
});
