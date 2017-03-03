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
  'https://www.nordlys.no/tre-meter-hoyt-og-150-meter-bredt-snoras-stenger-vei-i-finnmark/s/5-34-583372',
  'https://www.ba.no/nyhet/naringsliv/bergen/fant-hakekors-teppe-pa-ikea/s/5-8-528196',
  'https://www.dt.no/natur-og-miljo/nyheter/hurum-kommune/skal-forbedre-utsikten-mot-sentrum-og-havna/s/5-70-54179',
  'https://www.glomdalen.no/forerkort/forerkortregler/nyhet/na-er-dato-for-nar-du-ma-bytte-forerkortet-bestemt/s/5-19-288934',
]

var controller = Botkit.facebookbot({
  debug: true,
  access_token: process.env.PAGE_TOKEN,
  verify_token: process.env.VERIFY_TOKEN,
})
var bot = controller.spawn({
})

function pickRandomArticle() {
  var index = Math.floor(Math.random() * articles.length)
  return articles[index]
}

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
  controller.storage.users.get(message.user, function(err, user) {
    bot.reply(message, 'Heisann!')
  })
})

controller.hears(['gi meg en artikkel'], 'message_received', function(bot, message) {
  controller.storage.users.get(message.user, function(err, user) {
    bot.reply(message, 'Denne tror jeg du vil like:' + pickRandomArticle())
  })
})
