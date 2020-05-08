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


function volunteerSuccessReply(slackurl, uniqueid, requesterName, mention_requestCoord, address, contactDetails, householdSituation,isFirstMessage) {
  var householdMessage = "";
  if (householdSituation != ""){
    householdMessage = "\nTheir household situation is: " + householdSituation + ".\n"
  }

  // personalise text depending on whether this is the first time volunteer sees the message or not
  if (isFirstMessage){
    var introTxt = ":nerd_face::tada: You signed up for <" + slackurl + "|request " + uniqueid + ">."
  } else{
    var introTxt = ":nerd_face::tada: You are still signed up for <" + slackurl + "|request " + uniqueid + ">."
  }

  // Json Template for replying to successful volunteer messages.
  return JSON.stringify({
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": introTxt
      }
    },
    {
      "type": "section",
      "text": {
        "type": "plain_text",
                "text": "The requester's name is " + requesterName +
                        ".\n Their address is: " + address +
                        ".\n And their contact details are: " + contactDetails +
                        householdMessage
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "When you are done, type `/done " + uniqueid + "`"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "To cancel your help offer, type `/cancel " + uniqueid + "`"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "To see this message again, type `/volunteer " + uniqueid + "`"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "If you need any help, please contact " + mention_requestCoord + "."
      }
    }
  ]
  });
}


/**
 * Send a post request to slack.
 * @param {string} message
 * @param {sring} url
 */
var postToSlack = function(message, url){
  var access_token = PropertiesService
                     .getScriptProperties()
                     .getProperty('ACCESS_TOKEN');

  var options = {
      method: "post",
      contentType: 'application/json; charset=utf-8',
      headers: {Authorization: 'Bearer ' + access_token},
      payload: JSON.stringify(message)
  };

  return UrlFetchApp
        .fetch(url, options)
        .getContentText();
}
