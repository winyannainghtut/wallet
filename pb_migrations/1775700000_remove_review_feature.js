const TRANSACTION_RULES_COLLECTION = {
  createRule: '@request.auth.id != ""',
  deleteRule: 'user = @request.auth.id',
  fields: [
    {
      autogeneratePattern: '[a-z0-9]{15}',
      hidden: false,
      id: 'text3208210256',
      max: 15,
      min: 15,
      name: 'id',
      pattern: '^[a-z0-9]+$',
      presentable: false,
      primaryKey: true,
      required: true,
      system: true,
      type: 'text',
    },
    {
      cascadeDelete: false,
      collectionId: '_pb_users_auth_',
      hidden: false,
      id: 'relation1775400401',
      maxSelect: 1,
      minSelect: 0,
      name: 'user',
      presentable: false,
      required: false,
      system: false,
      type: 'relation',
    },
    {
      autogeneratePattern: '',
      hidden: false,
      id: 'text1775400402',
      max: 0,
      min: 1,
      name: 'name',
      pattern: '',
      presentable: false,
      primaryKey: false,
      required: true,
      system: false,
      type: 'text',
    },
    {
      autogeneratePattern: '',
      hidden: false,
      id: 'text1775400403',
      max: 0,
      min: 1,
      name: 'matchText',
      pattern: '',
      presentable: false,
      primaryKey: false,
      required: true,
      system: false,
      type: 'text',
    },
    {
      autogeneratePattern: '',
      hidden: false,
      id: 'text1775400404',
      max: 0,
      min: 0,
      name: 'renameTo',
      pattern: '',
      presentable: false,
      primaryKey: false,
      required: false,
      system: false,
      type: 'text',
    },
    {
      autogeneratePattern: '',
      hidden: false,
      id: 'text1775400405',
      max: 0,
      min: 0,
      name: 'category',
      pattern: '',
      presentable: false,
      primaryKey: false,
      required: false,
      system: false,
      type: 'text',
    },
    {
      autogeneratePattern: '',
      hidden: false,
      id: 'text1775400406',
      max: 0,
      min: 0,
      name: 'tagsJson',
      pattern: '',
      presentable: false,
      primaryKey: false,
      required: false,
      system: false,
      type: 'text',
    },
    {
      hidden: false,
      id: 'bool1775400407',
      name: 'markReviewed',
      presentable: false,
      required: false,
      system: false,
      type: 'bool',
    },
    {
      hidden: false,
      id: 'bool1775400408',
      name: 'isActive',
      presentable: false,
      required: false,
      system: false,
      type: 'bool',
    },
    {
      hidden: false,
      id: 'autodate2990389176',
      name: 'created',
      onCreate: true,
      onUpdate: false,
      presentable: false,
      system: false,
      type: 'autodate',
    },
    {
      hidden: false,
      id: 'autodate3332085495',
      name: 'updated',
      onCreate: true,
      onUpdate: true,
      presentable: false,
      system: false,
      type: 'autodate',
    },
  ],
  id: 'pbc_1775400004',
  indexes: [],
  listRule: 'user = @request.auth.id',
  name: 'transaction_rules',
  system: false,
  type: 'base',
  updateRule: 'user = @request.auth.id',
  viewRule: 'user = @request.auth.id',
};

const REVIEW_METADATA_FIELDS = [
  {
    autogeneratePattern: '',
    hidden: false,
    id: 'text1775400701',
    max: 0,
    min: 0,
    name: 'merchantName',
    pattern: '',
    presentable: false,
    primaryKey: false,
    required: false,
    system: false,
    type: 'text',
  },
  {
    autogeneratePattern: '',
    hidden: false,
    id: 'text1775400702',
    max: 0,
    min: 0,
    name: 'tagsJson',
    pattern: '',
    presentable: false,
    primaryKey: false,
    required: false,
    system: false,
    type: 'text',
  },
  {
    hidden: false,
    id: 'select1775400703',
    maxSelect: 1,
    name: 'reviewStatus',
    presentable: false,
    required: false,
    system: false,
    type: 'select',
    values: ['pending', 'reviewed', 'ignored'],
  },
];

function getFieldArray(json) {
  if (Array.isArray(json.fields)) {
    return { key: 'fields', fields: json.fields };
  }

  const schema = Array.isArray(json.schema) ? json.schema : [];
  return { key: 'schema', fields: schema };
}

migrate((app) => {
  const removeReviewMetadataFields = (collectionName) => {
    try {
      const collection = app.findCollectionByNameOrId(collectionName);
      const json = JSON.parse(JSON.stringify(collection));
      const { key, fields } = getFieldArray(json);
      json[key] = fields.filter(
        (field) => field && !['merchantName', 'tagsJson', 'reviewStatus'].includes(field.name)
      );
      app.importCollections([json], false);
    } catch {}
  };

  const deleteCollection = (name) => {
    try {
      const collection = app.findCollectionByNameOrId(name);
      app.delete(collection);
    } catch {}
  };

  removeReviewMetadataFields('transactions');
  removeReviewMetadataFields('incomes');
  deleteCollection('transaction_rules');
}, (app) => {
  const ensureCollection = (name, collectionJson) => {
    try {
      app.findCollectionByNameOrId(name);
    } catch {
      app.importCollections([collectionJson], false);
    }
  };

  const ensureReviewMetadataFields = (collectionName) => {
    try {
      const collection = app.findCollectionByNameOrId(collectionName);
      const json = JSON.parse(JSON.stringify(collection));
      const { key, fields } = getFieldArray(json);
      const nextFields = [...fields];

      for (const field of REVIEW_METADATA_FIELDS) {
        if (!nextFields.some((candidate) => candidate && candidate.name === field.name)) {
          nextFields.push(field);
        }
      }

      json[key] = nextFields;
      app.importCollections([json], false);
    } catch {}
  };

  ensureCollection('transaction_rules', TRANSACTION_RULES_COLLECTION);
  ensureReviewMetadataFields('transactions');
  ensureReviewMetadataFields('incomes');
});
