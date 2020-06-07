// Some functions for formatting and sending messages to slack.
// For more slack formating, see:
// https://api.slack.com/tools/block-kit-builder

function contentServerJsonReply(message) {
  // "ContentServer" reply as Json.
  return ContentService
         .createTextOutput(message)
         .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Create a json string in slack block format for text.
 * @param {string} text
 * @param {boolean} ephemeral
 * @param {string} type
 */
var textToJsonBlocks = function(text, ephemeral=true, type="mrkdwn"){
  var blocks = {
    "blocks": [
      {
        "type": "section",
        "text": {
          "text": text,
          "type": type,
        }
      }
    ],
  };

  if (ephemeral){
    blocks["response_type"] = "ephemeral";
  }

  return JSON.stringify(blocks);
}

/**
 * Post to slack.
 * @param {string} payload
 * @param {string} url
 */
var postToSlack = function(payload, url){
  if (JSON.parse(payload).as_user === true){
    var access_token = PropertiesService
                      .getScriptProperties()
                      .getProperty('ACCESS_TOKEN_USER');
  } else {
    var access_token = PropertiesService
                      .getScriptProperties()
                      .getProperty('ACCESS_TOKEN');
  }

  var options = {
    method: "post",
    contentType: 'application/json; charset=utf-8',
    headers: {Authorization: 'Bearer ' + access_token},
    payload: payload
  };

  return UrlFetchApp
        .fetch(url, options)
        .getContentText();
}

class SlackMessenger {
  constructor(cmd){
    this.cmd = cmd;
    this.url = null;
    this.loggerMessage={
      uniqueid:this.cmd.args.uniqueid,
      userid:'admin',
      type:'slackResponse',
      subtype:'',
      additionalInfo:''
    };
  }
  
  send(msg){
    var return_message = postToSlack(msg, this.url);
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

class SlackModalMessenger extends SlackMessenger {
  constructor(cmd){
    super(cmd);
    this.url = globalVariables()['WEBHOOK_CHATPOSTMODAL'];
    this.loggerMessage.subtype='userModal';
  }
}

