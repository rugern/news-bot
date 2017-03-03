require('dotenv').config()
const express = require('express')

const app = express()

app.get('/', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === process.env.VERIFY_TOKEN) {
      console.log("Validating webhook")
      res.status(200).send(req.query['hub.challenge'])
    } else {
      console.error("Failed validation. Make sure the validation tokens match.")
      res.sendStatus(403)          
    }  
})

app.listen(process.env.PORT, (serverError) => {
  if (serverError) {
    console.error(serverError)
    process.exit(1)
  }
  console.log('The server is now running at port', process.env.PORT)
})
