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
 * @param {boolean} as_user
 */
var postToSlack = function(payload, url, as_user=false){
  if (as_user){
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



var slackUserReply = function(payload, uniqueid, response_url){
  var return_message = postToSlack(payload, response_url);
  var log_sheet = new LogSheetWrapper();
  log_sheet.appendRow([new Date(), uniqueid, 'admin','messageUser', return_message]);
}

var slackChannelReply = function(payload, uniqueid){
  var globvar = globalVariables();
  var mention_requestCoord = globvar['MENTION_REQUESTCOORD'];
  var url = globvar['WEBHOOK_CHATPOSTMESSAGE'];
  
  var return_message = postToSlack(payload, url);
  var log_sheet = new LogSheetWrapper();
  log_sheet.appendRow([new Date(), uniqueid,'admin','messageChannel',return_message]);
  
  if (JSON.parse(return_message).ok !== true){ // message was not successfully sent
    throw new Error(postToSlackChannelErrorMessage());
  }
}

var slackModalReply = function(payload, uniqueid){
  var url = 'https://slack.com/api/views.open';
  
  var return_message = postToSlack(payload, url);
  var log_sheet = new LogSheetWrapper();
  log_sheet.appendRow([new Date(), uniqueid,'admin','messageUserModal',return_message]);
  
  if (JSON.parse(return_message).ok !== true){ // message was not successfully sent
    throw new Error(postToSlackModalErrorMessage(return_message));
  }
}