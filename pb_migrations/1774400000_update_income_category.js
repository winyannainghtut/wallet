migrate((db) => {
  const collection = db.findCollectionByNameOrId("incomes");
  
  // Find the category field
  const categoryField = collection.schema.getFieldByName("category");
  
  if (categoryField && categoryField.type === "select") {
    // Convert from 'select' to 'text'
    // This perfectly preserves all existing string data in the database!
    categoryField.type = "text";
    // Clear out select-specific options
    categoryField.options = { min: null, max: null, pattern: "" };
    
    collection.schema.addField(categoryField);
    return db.saveCollection(collection);
  }
  
  return null;
}, (db) => {
  const collection = db.findCollectionByNameOrId("incomes");
  const categoryField = collection.schema.getFieldByName("category");
  
  if (categoryField && categoryField.type === "text") {
    // Revert back to select
    categoryField.type = "select";
    categoryField.options = {
      maxSelect: 1,
      values: [
        "salary",
        "bonus",
        "freelance",
        "business",
        "investment",
        "other"
      ]
    };
    
    collection.schema.addField(categoryField);
    return db.saveCollection(collection);
  }
  
  return null;
});
