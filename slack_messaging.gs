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

class Display {
  constructor(cmd){
    this.cmd = cmd;
  }
  
  write(msg){
  }
}

class VoidDisplay extends Display {
}

class AdminDisplay extends Display {
  write(msg){
    this.cmd.log_sheet.appendRow([new Date(), this.cmd.args.uniqueid,'admin','messageUserContent',msg]);
  }
}

class UserAsyncDisplay extends Display {
  write(msg){
    var response_message = postToSlack(msg, this.cmd.args.response_url);
    this.cmd.log_sheet.appendRow([new Date(), this.cmd.args.uniqueid, 'admin','messageUser', response_message]);
  }
}

class SlackChannelDisplay extends Display {
  write(msg){
    var url = globalVariables()['WEBHOOK_CHATPOSTMESSAGE'];
    var response_message = postToSlack(msg, url);
    this.cmd.log_sheet.appendRow([new Date(), this.cmd.args.uniqueid,'admin','messageChannel',response_message]);
    return response_message;
  }
}

class SlackModalDisplay extends Display {
  write(msg){
    var url = globalVariables()['WEBHOOK_CHATPOSTMODAL'];
    var response_message = postToSlack(msg, url);
    this.cmd.log_sheet.appendRow([new Date(), this.cmd.args.uniqueid,'admin','messageUserModal',response_message]);
    return response_message;
  }
}

class TrackingSheetDisplay extends Display {
  write(msg,updateTrackingSheet=true){
    if (updateTrackingSheet) this.cmd.tracking_sheet.writeRow(this.cmd.row);
    this.cmd.log_sheet.appendRow([new Date(), this.cmd.args.uniqueid,this.cmd.args.userid,msg.type,msg.subtype,msg.additionalInfo]);
  }
}