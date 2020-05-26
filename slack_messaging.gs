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
var postToSlack = function(payload, url, scope="as_bot"){
  if (scope === "as_user"){
    var access_token = PropertiesService
                      .getScriptProperties()
                      .getProperty('ACCESS_TOKEN_USER');
  } else if (scope === "as_bot") {
    var access_token = PropertiesService
                      .getScriptProperties()
                      .getProperty('ACCESS_TOKEN');
  } else {
    // return error message with same formatting as UrlFetchApp.fetch().getContentText()
    return JSON.stringify({
      ok:false,
      msg:postToSlackScopeUndefinedMessage(scope)
    });
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


var postToSlackResponseUrl = function(payload, uniqueid, url){
  var return_message = postToSlack(payload, url);
  return return_message;
}

var postToSlackChannel = function(payload, scope="as_bot"){
  var url = globalVariables()['WEBHOOK_CHATPOSTMESSAGE'];
  var return_message = postToSlack(payload, url, scope);
  return return_message;
}

var postToSlackModal = function(payload){
  var url = 'https://slack.com/api/views.open';
  var return_message = postToSlack(payload, url);
  return return_message;
}