'use strict';

var queryString = require('query-string');
var fetch = require('node-fetch');

var constants = require('./constants');

var base = 'https://bed.api.no/api/acpcomposer/v1.1/search/content';

function getImage(article) {
  var relations = article._embedded.relations;
  if (relations && relations.length > 0) {
    var versions = relations[0].fields.versions;
    return versions && versions.large ? versions.large.url : undefined;
  }
  return undefined;
}

function getTags(article) {
  var tags = [];
  if (article.tags) {
    article.tags.forEach(function (tag) {
      tags.push(tag.displayName);
    });
  }
  return tags;
}

function getArticles() {
  var queryData = {
    offset: 0,
    limit: 10,
    includeCrossPublished: true,
    sort: 'lastPublishedDate',
    types: ['story', 'feature'],
    extended: false,
    publicationDomain: constants.amediaDomains,
  };

  var query = queryString.stringify(queryData);
  var requestUrl = base + '?' + query;
  return fetch(requestUrl)
    .then(function (result) {
      return result.json();
    });
}

function createArticle(raw) {
  var domain = raw._links.publication.title;
  var acpid = raw.fields.id;

  var article = {
    domain: domain,
    acpid: acpid,
    title: raw.title,
    leadText: raw.leadText,
    link: domain + raw.fields.relativeUrl,
    image: getImage(raw),
    tags: getTags(raw),
  };
  return article;
}

module.exports = {
  getArticles: getArticles,
  createArticle: createArticle,
};
