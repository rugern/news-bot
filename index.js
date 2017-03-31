'use strict';

var Botkit = require('botkit');
var firebase = require('firebase');
var Observable = require('rxjs/Rx').Observable;

var article = require('./lib/article');
var constants = require('./lib/constants');

var production = process.env.NODE_ENV !== 'development';
var controller;
var bot;
var users = {};
var articles = [];
var acpids = [];

if (!production) {
  require('dotenv').config();
}

if (!process.env.PAGE_TOKEN) {
  console.log('Error: Specify PAGE_TOKEN in environment');
  process.exit(1);
}

if (!process.env.VERIFY_TOKEN) {
  console.log('Error: Specify VERIFY_TOKEN in environment');
  process.exit(1);
}

if (!process.env.FIREBASE_API_KEY) {
  console.log('Error: Specify FIREBASE_API_KEY in environment');
  process.exit(1);
}

if (!process.env.FIREBASE_DATABASE_URL) {
  console.log('Error: Specify FIREBASE_DATABASE_URL in environment');
  process.exit(1);
}

firebase.initializeApp({
  apiKey: process.env.FIREBASE_API_KEY,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

function fetchUsers() {
  return firebase.database().ref().once('value')
    .then(function (snapshot) {
      if (snapshot.val()) {
        Object.keys(snapshot.val()).forEach(function(userid) {
          if (!users[userid]) {
            users[userid] = {};
          }
        });
      }
      return true;
    })
    .catch(function (err) {
      console.error('Failed when fetching users:', err);
    });
}
fetchUsers();

function sendArticle(article, userid) {
  var attachment = {
    type: 'template',
    payload: {
      template_type: 'generic',
      elements: [
        {
          title: article.title,
          subtitle: article.leadText,
          default_action: {
            type: 'web_url', 
            url: article.link,
          },
          buttons: [
            {
              type: 'postback',
              title: 'Kult!',
              payload: 'like'
            }, {
              type: 'postback',
              title: 'Likte den ikke',
              payload: 'dislike'
            }
          ]
        },
      ]
    }
  };
  if (article.image) {
    attachment.payload.elements[0].image_url = article.image;
  }

  if (userid) {
    bot.say({ channel: userid, attachment: attachment });
    return;
  }

  Object.keys(users).filter(function (user) {
    var wantedPublication = user.publications.length === 0 || user.publications.indexOf(article.domain) !== -1;
    var wantedTags = user.tags.length === 0 || user.tags.reduce(function (result, tag) {
      if (result) {
        return result;
      }
      return article.tags.indexOf(tag) !== -1;
    }, false);
    return wantedPublication && wantedTags;
  }).forEach(function (user) {
    bot.say({ channel: user, attachment: attachment });
  });
}

function storeArticle(article) {
  if (acpids.indexOf(article.acpid) !== -1) {
    return;
  }

  articles.push(article);
  acpids.push(article.acpid);
  while (articles.length > 100) {
    delete acpids[0];
    delete articles[0];
  }

  return article;
}

function cleanResponseList(responses) {
  return responses.text.split(' ').map(function (response) {
    response = response.trim();
    if (response.indexOf(',') !== -1) {
      response = response.slice(0, response.indexOf(','));
    }
    return response;
  });
}

function subscribe(bot, message) {
  var userid = message.channel;
  var user = {
    id: userid,
    publications: [],
    tags: [],
  };

  var endConversation = function (response, convo) {
    users[userid] = user;
    firebase.database().ref(userid).set(user)
      .then(function () {
        var reply = 'Da vil du få artikler fra ';
        reply += user.publications.length > 0 ? user.publications.join(', ') : 'alle aviser ';
        reply += ' med ';
        reply += user.tags.length > 0 ? 'temaene ' + user.tags.join(', ') : 'alle tema';

        convo.say(reply);
        convo.stop();
      })
      .catch(function (error) {
        convo.say('Oops, her er det noe rusk i maskineriet. Vennligst prøv igjen');
        console.log(error);
        convo.stop();
      });
  };

  var askTags = function (response, convo) {
    convo.ask('Er det noen tema du ønsker å følge? Skriv \'nei\' for å gå videre uten å velge', [
      {
        pattern: 'nei',
        callback: endConversation
      },
      {
        default: true,
        callback: function (response, convo) {
          user.tags = cleanResponseList(response);
          endConversation(response, convo);
        }
      }
    ]);
  };

  var askPublications = function (response, convo) {
    convo.say('Hvilke aviser vil du abonnere på?');
    convo.say(['Skriv inn navnet på avisene du ønsker slik det fremkommer i',
      'URL-en, for eksempel \'glomdalen, aasavis, ba\', eller skriv \'alle\'',
      'for å abonnere på alle aviser'].join(' '), [
        {
          pattern: 'alle',
          callback: askTags
        },
        { 
          default: true,
          callback: function (response, convo) {
            var publications = cleanResponseList(response).filter(function (domain) {
              return constants.amediaPublications.indexOf(domain) !== -1;
            });
            user.publications = publications;
            askTags(response, convo);
          }
        }
      ]);
  };

  bot.startConversation(message, askPublications);
}

function sendRandomArticle(bot, message) {
    var index = Math.floor(Math.random() * articles.length);
    var article = articles[index];
    var userid = message.channel;
    sendArticle(article, userid);
}

function unsubscribe(bot, message) {
  var userid = message.channel;
  if (users[userid]) {
    delete users[userid];
  }
  firebase.database().ref(userid).remove();
  bot.reply(message, 'Du har nå avsluttet abonnementet');
}

function initializeBot() {
  controller = Botkit.facebookbot({
    debug: true,
    access_token: process.env.PAGE_TOKEN,
    verify_token: process.env.VERIFY_TOKEN,
  });

  bot = controller.spawn({
  });

  controller.setupWebserver(process.env.PORT || 3000, function(err, webserver) {
    if (err) {
      console.error(err);
    }
    controller.createWebhookEndpoints(webserver, bot, function(internalErr) {
      if (err) {
        console.error(internalErr);
      }
    });
  });

  controller.api.messenger_profile.greeting('Hei! Jeg er en bot');
  controller.api.messenger_profile.get_started('Kom igang');
  controller.api.messenger_profile.menu([
    {
      'locale':'default',
      'composer_input_disabled':true,
      'call_to_actions':[
        {
          'title':'Gi meg en artikkel',
          'type':'postback',
          'payload':'send_article'
        },
        {
          'title':'Abonner',
          'type':'postback',
          'payload':'subscribe'
        },
        {
          'title':'Avslutt abonnement',
          'type':'postback',
          'payload':'unsubscribe'
        },
      ]
    },
  ]);

  controller.hears(['hei', 'Hei'], 'message_received', function(bot, message) {
    bot.reply(message, 'Heisann!');
  });

  controller.hears(['abonner', 'Abonner'], 'message_received', subscribe);
  controller.hears(['avslutt abo', 'Avslutt abonnement'], 'message_received', unsubscribe);
  controller.hears(['gi meg en artikkel', 'Gi meg en artikkel'], 'message_received', sendRandomArticle);

  controller.on('facebook_postback', function(bot, message) {
    switch (message.payload) {
        case 'like':
          bot.reply(message, 'Bra at du likte den :)');
          break;
        case 'dislike':
          bot.reply(message, 'Okay, skal prøve å finne noe kulere neste gang!');
          break;
        case 'send_article':
          sendRandomArticle(bot, message);
          break;
        case 'subscribe':
          subscribe(bot, message);
          break;
        case 'unsubscribe':
          unsubscribe(bot, message);
          break;
        default:
          bot.reply(message, 'Beklager, det er noe rusk i maskineriet');
          console.error('Unknown postback payload:', message.payload);
    }
  });
}

Observable.interval(10000)
  .startWith(0)
  .flatMap(function () {
    return Observable.defer(article.getArticles);
  })
  .map(function (rawData) {
    return rawData._embedded;
  })
  .flatMap(function (rawArticles) {
    return Observable.from(rawArticles);
  })
  .map(article.createArticle)
  .map(storeArticle)
  .filter(function () {
    return production;
  })
  .subscribe(sendArticle(article), function (error) {
    console.log(error);
  });

if (production) {
  initializeBot();
}
