if (!process.env.PAGE_TOKEN) {
  console.log('Error: Specify PAGE_TOKEN in environment')
  process.exit(1)
}

if (!process.env.VERIFY_TOKEN) {
  console.log('Error: Specify VERIFY_TOKEN in environment')
  process.exit(1)
}

var Botkit = require('botkit')
var controller = Botkit.facebookbot({
  debug: true,
  access_token: process.env.PAGE_TOKEN,
  verify_token: process.env.VERIFY_TOKEN,
})

var bot = controller.spawn({
})

controller.setupWebserver(process.env.PORT || 3000, function(err, webserver) {
  if (err) {
    console.log(err)
  }
  controller.createWebhookEndpoints(webserver, bot, function(internalErr) {
    if (err) {
      console.log(internalErr)
    }
  })
})

controller.hears(['hello', 'hi'], 'message_received', function(bot, message) {
  controller.storage.users.get(message.user, function(err, user) {
    if (user && user.name) {
      bot.reply(message, 'Hello ' + user.name + '!!')
    } else {
      bot.reply(message, 'Hello.')
    }
  })
})
