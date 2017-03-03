var Botkit = require('botkit')

if (!process.env.PAGE_TOKEN) {
  console.log('Error: Specify PAGE_TOKEN in environment')
  process.exit(1)
}

if (!process.env.VERIFY_TOKEN) {
  console.log('Error: Specify VERIFY_TOKEN in environment')
  process.exit(1)
}

var articles = [
  'https://www.ostlendingen.no/brann/nord-osterdal/tynset/brann-i-hytte-ma-bare-slangene-femte-meter-fra-vegen/s/5-69-380185',
  'https://www.nordlys.no/finn-hagen-krogh/vm-pa-ski/finland/her-sitter-hans-kristian-28-i-tromso-og-ser-lillebror-ga-norge-inn-til-vm-gull/s/5-34-583672',
  'https://www.ba.no/nyhet/naringsliv/bergen/fant-hakekors-teppe-pa-ikea/s/5-8-528196',
  'https://www.dt.no/natur-og-miljo/nyheter/hurum-kommune/skal-forbedre-utsikten-mot-sentrum-og-havna/s/5-70-54179',
  'https://www.glomdalen.no/forerkort/forerkortregler/nyhet/na-er-dato-for-nar-du-ma-bytte-forerkortet-bestemt/s/5-19-288934',
]

var images = [
  'https://g.acdn.no/obscura/API/dynamic/r1/ece5/tr_1080_810_l_f/0000/ostl/2017/3/3/14/0.jpg?chk=6D67BD',
  'https://g.acdn.no/obscura/API/dynamic/r1/ece5/tr_1080_717_l_f/0000/noly/2017/3/3/15/WebKroghBror.jpg?chk=B80860',
  'https://g.acdn.no/obscura/API/dynamic/r1/ece5/tr_1080_1145_l_f/0000/berg/2017/3/3/9/Nazi-teppe.jpg?chk=0AAB91',
  'https://g.acdn.no/obscura/API/dynamic/r1/ece5/tr_1080_720_l_f/0000/royk/2017/3/1/15/02%2Bnyh%2Bs%25C3%25A6trebakken%2Brydding.jpg?chk=13002D',
  'https://g.acdn.no/obscura/API/dynamic/r1/ece5/tr_1080_732_l_f/0000/moss/2016/3/12/8/f%25C3%25B8rerkort.jpg?chk=FA1284'
]

var titles = [
  'Brann i hytte - må bære slangene femti meter fra vegen',
  'Her sitter Hans-Kristian i Tromsø og ser lillebror gå Norge inn til VM-gull',
  'Fant hakekort-teppe på Ikea', 
  'Skal forbedre utsikten mot sentrum og havna',
  'Nå er dato for når du må bytte førerkortet bestemt'
]

var controller = Botkit.facebookbot({
  debug: true,
  access_token: process.env.PAGE_TOKEN,
  verify_token: process.env.VERIFY_TOKEN,
})
var bot = controller.spawn({
})

controller.setupWebserver(process.env.PORT || 3000, function(err, webserver) {
  if (err) {
    console.error(err)
  }
  controller.createWebhookEndpoints(webserver, bot, function(internalErr) {
    if (err) {
      console.error(internalErr)
    }
  })
})

controller.hears(['hallo', 'hei'], 'message_received', function(bot, message) {
  bot.reply(message, 'Heisann!')
})

controller.hears(['gi meg en artikkel'], 'message_received', function(bot, message) {
  var index = Math.floor(Math.random() * articles.length)
  var title = titles[index]
  var link = articles[index]
  var image = images[index]

  var attachment = {
    type: 'template',
    payload: {
      template_type: 'generic',
      elements: [
        {
          title: title,
          image_url: image,
          default_action: {
            type: 'web_url', 
            url: link,
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
  }
  bot.reply(message, {attachment: attachment})
})

controller.on('facebook_postback', function(bot, message) {
  if (message.payload == 'like') {
    bot.reply(message, 'Bra at du likte den :)')
  } else if (message.payload === 'dislike') {
    bot.reply(message, 'Okay, skal prøve å finne noe kulere neste gang!')
  }
})
