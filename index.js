var Botkit = require('botkit');
var queryString = require('query-string');
var fetch = require('node-fetch');
var firebase = require('firebase');

var production = process.env.NODE_ENV === 'production';
var controller;
var bot;

var amediaDomains = [
  'www.aasavis.no',
  'www.amta.no',
  'www.an.no',
  'www.auraavis.no',
  'www.austagderblad.no',
  'www.avisa-valdres.no',
  'www.avisnavn.no',
  'www.ba.no',
  'www.blv.no',
  'www.budstikka.no',
  'www.bygdeposten.no',
  'www.dt.no',
  'www.eikerbladet.no',
  'www.enebakkavis.no',
  'www.f-b.no',
  'www.firda.no',
  'www.firdaposten.no',
  'www.fremover.no',
  'www.gd.no',
  'www.gjengangeren.no',
  'www.glomdalen.no',
  'www.h-avis.no',
  'www.ha-halden.no',
  'www.hadeland.no',
  'www.hamar-dagblad.no',
  'www.hardanger-folkeblad.no',
  'www.hblad.no',
  'www.helg.no',
  'www.ialta.no',
  'www.ifinnmark.no',
  'www.indre.no',
  'www.jarlsbergavis.no',
  'www.kv.no',
  'www.kvinnheringen.no',
  'www.laagendalsposten.no',
  'www.lierposten.no',
  'www.lofot-tidende.no',
  'www.lofotposten.no',
  'www.moss-avis.no',
  'www.noblad.no',
  'www.nord24.no',
  'www.norddalen.no',
  'www.nordhordland.no',
  'www.nordlys.no',
  'www.oa.no',
  'www.oblad.no',
  'www.op.no',
  'www.ostlendingen.no',
  'www.oyene.no',
  'www.pd.no',
  'www.polkaposten.no',
  'www.r-a.no',
  'www.rablad.no',
  'www.ranablad.no',
  'www.rb.no',
  'www.retten.no',
  'www.rha.no',
  'www.ringblad.no',
  'www.ringsaker-blad.no',
  'www.sa.no',
  'www.salsaposten.no',
  'www.sandeavis.no',
  'www.sb.no',
  'www.siste.no',
  'www.smaalenene.no',
  'www.svelviksposten.no',
  'www.ta.no',
  'www.tb.no',
  'www.telen.no',
  'www.tk.no',
  'www.tvedestrandsposten.no',
  'www.vest24.no',
  'www.vestbyavis.no',
  'www.vestviken24.no',
];

var base = 'https://bed.api.no/api/acpcomposer/v1.1/search/content';
var users = {};
var sentArticles = [];

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

function sendArticle(article) {
  Object.keys(users).forEach(function (userid) {
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
    bot.say({ channel: userid, attachments: [attachment] });
  });
}

function storeArticles(data) {
  data.forEach(function (article) {
    var domain = article._links.publication.title;
    var acpid = article.fields.id;

    if (sentArticles.indexOf(acpid) !== -1) {
      return;
    }

    var newArticle = {
      title: article.title,
      leadText: article.leadText,
      link: domain + article.fields.relativeUrl,
      image: getImage(article),
      tags: getTags(article),
    };

    if (production) {
      sentArticles.push(acpid);
      sendArticle(newArticle);
    }
  });

  while (sentArticles.length > 100) {
    delete sentArticles[0];
  }
}

function getArticles() {
  var queryData = {
    offset: 0,
    limit: 10,
    includeCrossPublished: true,
    sort: 'lastPublishedDate',
    types: ['story', 'feature'],
    extended: false,
    publicationDomain: amediaDomains,
  };

  var query = queryString.stringify(queryData);
  var requestUrl = base + '?' + query;
  fetch(requestUrl)
    .then(function (result) {
      return result.json();
    })
    .then(function (data) {
      storeArticles(data._embedded);
    })
    .catch(function (err) {
      console.error(err);
    });
}

function fetchUsers() {
  firebase.database().ref().once('value')
    .then(function (snapshot) {
      if (snapshot.val()) {
        snapshot.val().forEach(function (userid) {
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

setInterval(function fetchArticles() {
  fetchUsers()
    .then(function () {
      getArticles();
    })
    .catch(function (err) {
      console.error('Something happened during update interval:', err);
    });
}, 10000);
getArticles();

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

  controller.hears(['hallo', 'hei'], 'message_received', function(bot, message) {
    var userid = message.channel;
    if (!users[userid]) {
      firebase.database().ref(userid).once('value')
        .then(function (snapshot) {
          if (snapshot.val()) {
            users[userid] = snapshot.val();
          } else {
            firebase.database().ref(userid).set({ userid: userid });
            users[userid] = {};
          }
        })
        .catch(function (err) {
          console.error('Firebase error:', err);
        });
    }
    bot.reply(message, 'Heisann!');
  });

  //controller.hears(['gi meg en artikkel'], 'message_received', function(bot, message) {
    //var index = Math.floor(Math.random() * articles.length);
    //var title = titles[index];
    //var link = articles[index];
    //var image = images[index];

    //var attachment = {
      //type: 'template',
      //payload: {
        //template_type: 'generic',
        //elements: [
          //{
            //title: title,
            //image_url: image,
            //default_action: {
              //type: 'web_url', 
              //url: link,
            //},
            //buttons: [
              //{
                //type: 'postback',
                //title: 'Kult!',
                //payload: 'like'
              //}, {
                //type: 'postback',
                //title: 'Likte den ikke',
                //payload: 'dislike'
              //}
            //]
          //},
        //]
      //}
    //};
    //bot.reply(message, {attachment: attachment});
  //});

  controller.on('facebook_postback', function(bot, message) {
    if (message.payload == 'like') {
      bot.reply(message, 'Bra at du likte den :)');
    } else if (message.payload === 'dislike') {
      bot.reply(message, 'Okay, skal prøve å finne noe kulere neste gang!');
    }
  });
}

if (production) {
  initializeBot();
}
