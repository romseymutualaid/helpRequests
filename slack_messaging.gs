// Methods and classes to return or post messages to slack API

/**
 * Encapsulate string as a JSON response
 * @param {string} message
 */
function contentServerJsonReply(message) {
  // "ContentServer" reply as Json.
  return ContentService
         .createTextOutput(message)
         .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Post to slack.
 * @param {string} payload
 * @param {string} url
 */
var postToSlack = function(payload, url) {
    
  if (JSON.parse(payload).as_user === true) {
    var access_token = PropertiesService
                      .getScriptProperties()
                      .getProperty('ACCESS_TOKEN_USER');
  } else {
    var access_token = PropertiesService
                      .getScriptProperties()
                      .getProperty('ACCESS_TOKEN');
  }

  var params = {
    method: "post",
    contentType: 'application/json; charset=utf-8',
    headers: {Authorization: 'Bearer ' + access_token},
    payload: payload
  };

  return UrlFetchApp.fetch(url, params).getContentText();  
}

var sendSlackUserAsync = function(messenger, payload) {
  return messenger.send(
    payload,
    messenger.cmd.args.response_url,
    "userAsync",
    send
  );
}

var sendSlackChannel = function(messenger, payload) {
  return messenger.send(
    payload,
    globalVariables()['WEBHOOK_CHATPOSTMESSAGE'],
    "channel"
  );
}

var sendSlackChannelUpdate = function(messenger, payload) {
  return messenger.send(
    payload,
    globalVariables()['WEBHOOK_CHATUPDATE'],
    "channelUpdate"
  );
}

var sendSlackModal = function(messenger, payload) {
  return messenger.send(
    payload,
    globalVariables()['WEBHOOK_CHATPOSTMODAL'],
    "userModal"
  );
}

var sendSlackAppHome = function(messenger, payload) {
  return messenger.send(
    payload,
    globalVariables()['WEBHOOK_VIEWPUBLISH'],
    "appHome"
  );
}

/**
 * Wrapper classes to post to specific slack API urls and log the response.
 * @param {Command} cmd
 * @param {string} msg
 */
class SlackMessenger {
  constructor(cmd){
    this.cmd = cmd;
    this.url = null;
    this.loggerMessage = {
      uniqueid: this.cmd.args.uniqueid,
      userid: 'admin',
      type: 'slackResponse',
      subtype: '',
      additionalInfo: ''
    };
  }
  
  send(msg, url, subtype){
    url = url !== undefined ? url : this.url;
    this.loggerMessage.subtype = subtype !== undefined ? subtype : this.loggerMessage.subtype;
    var return_message = postToSlack(msg, url);
    this.loggerMessage.additionalInfo = return_message;
    this.cmd.log_sheet.appendFormattedRow(this.loggerMessage);
    return return_message;
  }
}

class VoidMessenger extends SlackMessenger {
  send(msg){
  }
}

class SlackUserAsyncMessenger extends SlackMessenger {
  constructor(cmd){
    super(cmd);
    this.url = this.cmd.args.response_url;
    if (!this.url){ // if no url is specified, instantiate a VoidMessenger instead.
      return new VoidMessenger(cmd);
    }
    this.loggerMessage.subtype='userAsync';
  }
}

class SlackChannelMessenger extends SlackMessenger {
  constructor(cmd){
    super(cmd);
    this.url = globalVariables()['WEBHOOK_CHATPOSTMESSAGE'];
    this.loggerMessage.subtype='channel';
  }
}

class SlackChannelUpdateMessenger extends SlackMessenger {
  constructor(cmd){
    super(cmd);
    this.url = globalVariables()['WEBHOOK_CHATUPDATE'];
    this.loggerMessage.subtype='channelUpdate';
  }
}

class SlackModalMessenger extends SlackMessenger {
  constructor(cmd){
    super(cmd);
    this.url = globalVariables()['WEBHOOK_CHATPOSTMODAL'];
    this.loggerMessage.subtype='userModal';
  }
}

class SlackAppHomeMessenger extends SlackMessenger {
  constructor(cmd){
    super(cmd);
    this.url = globalVariables()['WEBHOOK_VIEWPUBLISH'];
    this.loggerMessage.subtype='appHome';
  }
}