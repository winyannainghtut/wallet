migrate((app) => {
  const HOUSEHOLD_VIEW_RULE = '@request.auth.id != "" && (user = @request.auth.id || (@collection.household_members:access.householdId ?= id && (@collection.household_members:access.userId ?= @request.auth.id || @collection.household_members:access.email ?= @request.auth.email)))';
  const HOUSEHOLD_OWNER_RULE = '@request.auth.id != "" && (user = @request.auth.id || (@collection.household_members:owner.householdId ?= id && @collection.household_members:owner.userId ?= @request.auth.id && @collection.household_members:owner.role ?= "owner" && @collection.household_members:owner.status ?= "active"))';
  const HOUSEHOLD_MEMBER_VIEW_RULE = '@request.auth.id != "" && (user = @request.auth.id || userId = @request.auth.id || email = @request.auth.email || (@collection.household_members:access.householdId ?= householdId && (@collection.household_members:access.userId ?= @request.auth.id || @collection.household_members:access.email ?= @request.auth.email)))';
  const HOUSEHOLD_MEMBER_OWNER_RULE = '@request.auth.id != "" && (householdId.user = @request.auth.id || (@collection.household_members:owner.householdId ?= householdId && @collection.household_members:owner.userId ?= @request.auth.id && @collection.household_members:owner.role ?= "owner" && @collection.household_members:owner.status ?= "active"))';
  const HOUSEHOLD_MEMBER_CREATE_RULE = '@request.auth.id != "" && ((@collection.households.id ?= @request.body.householdId && @collection.households.user ?= @request.auth.id) || (@collection.household_members:owner.householdId ?= @request.body.householdId && @collection.household_members:owner.userId ?= @request.auth.id && @collection.household_members:owner.role ?= "owner" && @collection.household_members:owner.status ?= "active"))';
  const BUDGET_UNIQUE_INDEX = 'CREATE UNIQUE INDEX IF NOT EXISTS `idx_budgets_user_month_category_unique` ON `budgets` (`user`, `month`, `category`)';
  const HOUSEHOLD_EMAIL_INDEX = 'CREATE UNIQUE INDEX IF NOT EXISTS `idx_household_members_household_email_unique` ON `household_members` (`householdId`, LOWER(`email`))';
  const HOUSEHOLD_USER_INDEX = 'CREATE UNIQUE INDEX IF NOT EXISTS `idx_household_members_household_userid_unique` ON `household_members` (`householdId`, `userId`) WHERE `userId` != ""';

  const updateCollectionIfExists = (name, updater) => {
    try {
      const collection = app.findCollectionByNameOrId(name);
      const json = JSON.parse(JSON.stringify(collection));
      updater(json);
      app.importCollections([json], false);
    } catch {}
  };

  updateCollectionIfExists("households", (json) => {
    json.listRule = HOUSEHOLD_VIEW_RULE;
    json.viewRule = HOUSEHOLD_VIEW_RULE;
    json.updateRule = HOUSEHOLD_OWNER_RULE;
    json.deleteRule = HOUSEHOLD_OWNER_RULE;
  });

  updateCollectionIfExists("household_members", (json) => {
    const indexes = Array.isArray(json.indexes) ? json.indexes : [];
    if (!indexes.includes(HOUSEHOLD_EMAIL_INDEX)) {
      indexes.push(HOUSEHOLD_EMAIL_INDEX);
    }
    if (!indexes.includes(HOUSEHOLD_USER_INDEX)) {
      indexes.push(HOUSEHOLD_USER_INDEX);
    }

    json.indexes = indexes;
    json.listRule = HOUSEHOLD_MEMBER_VIEW_RULE;
    json.viewRule = HOUSEHOLD_MEMBER_VIEW_RULE;
    json.createRule = HOUSEHOLD_MEMBER_CREATE_RULE;
    json.updateRule = HOUSEHOLD_MEMBER_OWNER_RULE;
    json.deleteRule = HOUSEHOLD_MEMBER_OWNER_RULE;
  });

  updateCollectionIfExists("budgets", (json) => {
    const indexes = Array.isArray(json.indexes) ? json.indexes : [];
    if (!indexes.includes(BUDGET_UNIQUE_INDEX)) {
      indexes.push(BUDGET_UNIQUE_INDEX);
    }
    json.indexes = indexes;
  });
}, (app) => {
  const ORIGINAL_HOUSEHOLD_RULE = 'user = @request.auth.id';
  const ORIGINAL_HOUSEHOLD_MEMBER_RULE = 'user = @request.auth.id';
  const BUDGET_UNIQUE_INDEX = 'CREATE UNIQUE INDEX IF NOT EXISTS `idx_budgets_user_month_category_unique` ON `budgets` (`user`, `month`, `category`)';
  const HOUSEHOLD_EMAIL_INDEX = 'CREATE UNIQUE INDEX IF NOT EXISTS `idx_household_members_household_email_unique` ON `household_members` (`householdId`, LOWER(`email`))';
  const HOUSEHOLD_USER_INDEX = 'CREATE UNIQUE INDEX IF NOT EXISTS `idx_household_members_household_userid_unique` ON `household_members` (`householdId`, `userId`) WHERE `userId` != ""';

  const updateCollectionIfExists = (name, updater) => {
    try {
      const collection = app.findCollectionByNameOrId(name);
      const json = JSON.parse(JSON.stringify(collection));
      updater(json);
      app.importCollections([json], false);
    } catch {}
  };

  updateCollectionIfExists("households", (json) => {
    json.listRule = ORIGINAL_HOUSEHOLD_RULE;
    json.viewRule = ORIGINAL_HOUSEHOLD_RULE;
    json.updateRule = ORIGINAL_HOUSEHOLD_RULE;
    json.deleteRule = ORIGINAL_HOUSEHOLD_RULE;
  });

  updateCollectionIfExists("household_members", (json) => {
    const indexes = Array.isArray(json.indexes) ? json.indexes : [];
    json.indexes = indexes.filter((index) => ![HOUSEHOLD_EMAIL_INDEX, HOUSEHOLD_USER_INDEX].includes(index));
    json.listRule = ORIGINAL_HOUSEHOLD_MEMBER_RULE;
    json.viewRule = ORIGINAL_HOUSEHOLD_MEMBER_RULE;
    json.createRule = '@request.auth.id != ""';
    json.updateRule = ORIGINAL_HOUSEHOLD_MEMBER_RULE;
    json.deleteRule = ORIGINAL_HOUSEHOLD_MEMBER_RULE;
  });

  updateCollectionIfExists("budgets", (json) => {
    const indexes = Array.isArray(json.indexes) ? json.indexes : [];
    json.indexes = indexes.filter((index) => index !== BUDGET_UNIQUE_INDEX);
  });
});
