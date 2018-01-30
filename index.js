'use strict';
const Alexa = require('alexa-sdk');
const request = require('request');
const APP_ID = "amzn1.ask.skill.b24abd0e-ee7d-42c8-ac54-be0eaed90daa";


const LAUNCH_MESSAGE = "Hello! I am your scratch chatbot. To begin, ask me anything or say connect followed by your 5-digit access code";
const LAUNCH_REPROMPT = "You did not say anything. ";
const CANCEL_MESSAGE = "Cancelled";
const STOP_MESSAGE = "Stopped";
const HELP_MESSAGE = "Hi! I'm your personal chatbot. I can answer questions about what I like, or what you like! Do you have a question for me?";
const HELP_REPROMPT_MESSAGE = "You can ask me things like what my favourite movie is.";

const BASE_URL = "https://eesh.me:6456/";

const ALEXA_ATTRIBUTES = BASE_URL + "attributes/alexa";
const USER_ATTRIBUTES = BASE_URL + "attributes/user";
const USER_MESSAGE = BASE_URL + "messages/user";
const ALEXA_LOGIN = BASE_URL + "alexa/login";
const SCRATCH_RUN = BASE_URL + "scratch/run";

const ANY_QUESTIONS_PROMPT = [
  'Do you want to ask me anything else?',
  'Do you have any other questions?',
  'Any other question?',
  'Is there anything else you want to ask me?',
  'Do you want me to do anything else?'
];


exports.handler = function(event, context, callback) {
    var alexa = Alexa.handler(event, context);
    alexa.appId = APP_ID;
    alexa.registerHandlers(handlers);
    alexa.execute();
};

const handlers = {
    'LaunchRequest': function () {
        this.response.speak(LAUNCH_MESSAGE);
        this.response.listen("Do you want to ask me anything?")
        this.emit(':responseReady');
    },
    'ConnectIntent': function () {
        var ACCESS_CODE = this.event.request.intent.slots.ACCESS_CODE.value;
        if (ACCESS_CODE == null) {
          this.response.speak(`The access code must be mentioned.`);
          this.response.shouldEndSession(true);
          this.emit(':tell');
          return;
        }
        if(ACCESS_CODE < 10000 || ACCESS_CODE > 99999) {
          this.response.speak(`The access code must be 5 digits long.`);
          this.response.shouldEndSession(true);
          this.emit(':tell');
          return;
        }
        getUserAuthToken(ACCESS_CODE, (token) => {
          if(token == null) {
            this.response.speak('Something went wrong. Try again later.');
            this.response.shouldEndSession(true);
            this.emit(":responseReady");
            return;
          }
          if(token == false) {
            this.response.speak("No user with given access code exists.");
            this.response.shouldEndSession(true);
            this.emit(":responseReady");
            return;
          }
          this.attributes.authToken = token;
          this.response.speak(`You are connected to ${ACCESS_CODE}. Ask me anything.`);
          this.response.shouldEndSession(false);
          this.emit(':responseReady');
        })
    },
    'WhatsMyAttributeIntent': function () {
        const pronoun = this.event.request.intent.slots.pronoun.value;
        const attribute = this.event.request.intent.slots.attribute.value;

        var _this = this;

        if(pronoun != "my" ) {
          getAlexaAttribute(pronoun, attribute, (response) => {
            if(response.value == null) {
              _this.response.speak("I don't know yet. " + ANY_QUESTIONS_PROMPT.randomElement());
              _this.response.listen(ANY_QUESTIONS_PROMPT.randomElement());
              _this.emit(':responseReady');
              return;
            } else {
              _this.response.speak(`"It is ${response.value}! ` + ANY_QUESTIONS_PROMPT.randomElement());
              _this.response.listen(ANY_QUESTIONS_PROMPT.randomElement());
              _this.response.shouldEndSession(false);
              _this.emit(':responseReady');
              return;
            }
          })
        } else if(pronoun == "my") {
          if(this.attributes['authToken'] == null) {
            this.response.speak("I am not sure who you are. Please connect using your access code first so I can tell you what I know.")
            this.response.shouldEndSession(true);
            this.emit(":responseReady");
            return;
          } else {
            getUserAttribute(attribute, this.attributes['authToken'], (response) => {
              if(response.value == null) {
                _this.response.speak("You haven't told me yet. " + ANY_QUESTIONS_PROMPT.randomElement());
                _this.response.listen(ANY_QUESTIONS_PROMPT.randomElement());
                _this.response.shouldEndSession(false);
                _this.emit(':responseReady');
                return;
              } else {
                _this.response.speak(`It is ${response.value}. ` + ANY_QUESTIONS_PROMPT.randomElement());
                _this.response.listen(ANY_QUESTIONS_PROMPT.randomElement());
                _this.response.shouldEndSession(false);
                _this.emit(':responseReady');
                return;
              }
            })
          }
        } else {
          this.response.speak("I am afraid I do not know. " + ANY_QUESTIONS_PROMPT.randomElement());
          this.response.listen(ANY_QUESTIONS_PROMPT.randomElement());
          this.emit(':responseReady');
          return;
        }
    },
    'MessageIntent': function() {
      if(this.attributes['authToken'] == null) {
        this.response.speak("You must connect using your access code first.");
        this.response.shouldEndSession(true);
        this.emit(":responseReady");
        return;
      } else {
        getUserMessage(this.attributes['authToken'], (response) => {
          if(response.value == null) {
            this.response.speak("You have no message. " + ANY_QUESTIONS_PROMPT.randomElement());
            this.response.listen(ANY_QUESTIONS_PROMPT.randomElement());
            this.emit(':responseReady');
          } else {
            this.response.speak(`There is a message for you. It says, ${response.value}. ` + ANY_QUESTIONS_PROMPT.randomElement());
            this.response.listen("Do you want to ask me anything else?");
            this.emit(':responseReady');
          }
        })
      }
    },
    'RunBlocksIntent': function () {
      if(this.attributes['authToken'] == null) {
        this.response.speak("You must connect using your access code first.");
        this.response.shouldEndSession(true);
        this.emit(":responseReady");
        return;
      } else {
        if(this.event.request.intent.slots.SET.value == null) {
          this.response.speak("You must mention a block set number between 1 - 3." + ANY_QUESTIONS_PROMPT.randomElement())
          this.response.listen("Please mention a block set number between 1 to 3 or ask me a question.")
          this.emit(":responseReady");
          return;
        } else if (this.event.request.intent.slots.SET.value < 1 || this.event.request.intent.slots.SET.value > 3) {
          this.response.speak("You must mention a block set number between 1 - 3. " + ANY_QUESTIONS_PROMPT.randomElement());
          this.response.listen("Please mention a block set number between 1 to 3 or ask me a question.")
          this.emit(":responseReady");
          return;
        }
        sendRunBlocksCommand(this.attributes['authToken'], this.event.request.intent.slots.SET.value, (response) => {
          if(response.success == true) {
            this.response.speak("Command sent. " + ANY_QUESTIONS_PROMPT.randomElement());
            this.response.listen(ANY_QUESTIONS_PROMPT.randomElement());
            this.emit(':responseReady');
            return;
          } else {
            this.response.speak(`${response.message}.` + ANY_QUESTIONS_PROMPT.randomElement());
            this.response.listen(ANY_QUESTIONS_PROMPT.randomElement());
            this.emit(':responseReady');
            return;
          }
        })
      }
    },
    'AMAZON.HelpIntent': function () {
        const speechOutput = HELP_MESSAGE;
        this.response.speak(speechOutput)
        this.response.listen(HELP_REPROMPT_MESSAGE)
        this.emit(':responseReady');
    },
    'AMAZON.CancelIntent': function () {
        this.response.speak(CANCEL_MESSAGE);
        this.response.shouldEndSession(true);
        this.emit(':responseReady');
    },
    'AMAZON.StopIntent': function () {
        this.response.speak('See you soon');
        this.response.shouldEndSession(true);
        this.emit(':responseReady');
    },
};

function getAlexaAttribute(pronoun, attribute, callback) {
    const query = { "pronoun": pronoun, "attribute" : attribute };
    request({ url: ALEXA_ATTRIBUTES, qs: query }, function (err, response, body) {
      if(err) {
        callback({ value: null })
        return
      }
      var res;
      try {
        res = JSON.parse(body)
      } catch(e) {
        callback({ value: null })
        return
      }
      if(res.value != null) {
        callback({ value: res.value })
      } else callback({ value: null });
      return
    })
}

function getUserAttribute(attribute, authToken, callback) {
    const query = { "attribute" : attribute };
    const headers_data = { 'authToken' : authToken };
    request({ url: USER_ATTRIBUTES, qs: query, headers: headers_data }, function (err, response, body) {
      if(err) {
        callback({ value: null })
        return
      }
      var res;
      try {
        res = JSON.parse(body)
      } catch(e) {
        callback({ value: null })
        return
      }
      callback({ value: res.value })
      return
    })
}


function getUserMessage(authToken, callback) {
    const headers_data = { 'authToken' : authToken };
    request({ url: USER_MESSAGE, headers: headers_data }, function (err, response, body) {
      if(err) {
        callback({ value: null })
        return
      }
      var res;
      try {
        res = JSON.parse(body)
      } catch(e) {
        callback({ value: null })
        return
      }
      callback({ value: res.value })
      return
    })
}

function getUserAuthToken(access_code, callback) {
  request.post({url: ALEXA_LOGIN, form: {'access_code': access_code}}, function(err,httpResponse,body) {
    if(err) {
      callback(null);
      return;
    }
    var response = JSON.parse(body);
    if(response.authToken == null) {
      callback(false);
      return;
    } else callback(response.authToken);
  });
}

function sendRunBlocksCommand(authToken, blockSet, callback) {
  request.post({url: SCRATCH_RUN, form: {'authtoken': authToken, 'blockSet': blockSet}}, function(err,httpResponse,body) {
    if(err) {
      callback({success : false});
      return;
    }
    var response = JSON.parse(body);
    if(response.success == null) {
      callback({success : false});
      return;
    } else callback({success : true});
  });
}

Array.prototype.randomElement = function () {
    return this[Math.floor(Math.random() * this.length)]
}
