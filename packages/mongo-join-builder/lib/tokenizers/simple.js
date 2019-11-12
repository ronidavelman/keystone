const { objMerge, getType, escapeRegExp } = require('@keystonejs/utils');
const { getRelatedListAdapterFromQueryPath } = require('./relationship-path');

const simpleTokenizer = (listAdapter, query, queryKey, path) => {
  // NOTE: We slice the last path segment off because we're interested in the
  // related list, not the field on the related list. ie, if the path is
  // ['posts', 'comments', 'author', 'name'],
  // the field is 'name', and the related list is the one at
  // ['posts', 'comments', 'author']
  const refListAdapter = getRelatedListAdapterFromQueryPath(listAdapter, path.slice(0, -1));
  const simpleQueryConditions = {
    ...objMerge(
      refListAdapter.fieldAdapters.map(fieldAdapter =>
        fieldAdapter.getQueryConditions(fieldAdapter.dbPath)
      )
    ),
  };
  return queryKey in simpleQueryConditions
    ? { matchTerm: simpleQueryConditions[queryKey](query[queryKey], query) }
    : queryKey in modifierConditions
    ? {
        postJoinPipeline: [modifierConditions[queryKey](query[queryKey], query, refListAdapter)],
      }
    : {};
};

const modifierConditions = {
  // TODO: Implement configurable search fields for lists
  $search: value => {
    if (!value || (getType(value) === 'String' && !value.trim())) {
      return undefined;
    }
    return { $match: { name: new RegExp(`${escapeRegExp(value)}`, 'i') } };
  },

  $orderBy: (value, _, listAdapter) => {
    const [orderField, orderDirection] = value.split('_');

    const mongoField = listAdapter.graphQlQueryPathToMongoField(orderField);

    return { $sort: { [mongoField]: orderDirection === 'DESC' ? -1 : 1 } };
  },
  $skip: value => (value < Infinity && value > 0 ? { $skip: value } : undefined),
  $first: value => (value < Infinity && value > 0 ? { $limit: value } : undefined),
  $count: value => ({ $count: value }),
};

module.exports = { simpleTokenizer };
