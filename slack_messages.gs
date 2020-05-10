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


var textToJsonBlocks_jb = function(text, type="mrkdwn"){
  var blocks = [
    {
      "type": "section",
      "text": {
        "text": text,
        "type": type,
      }
    }
  ];

  return blocks;
}

/**
 * Generate a slack message JSON payload for the chat.PostMessage or the response_url method
 * @param {array} blocks: a block-formatted message
 * @param {string} text: if blocks is not specified, a text message. if blocks is specified, this is an optional fallback message (i.e. for mobile notifications)
 * @param {string} channel: if relevant, the channel.id to sent message to
 * @param {array} thread_ts: if payload is destined as a reply to an existing thread, identify the parent message by its thread_ts
 * @param {boolean} reply_broadcast: if thread_ts specified, should message also be broadcasted to channel?
 * @param {boolean} mrkdwn: should the text argument be mrkdwn formatted? (plain_text if not)
 * @param {boolean} as_user: should message be sent as a user?
 * @param {boolean} ephemeral: only if using the response_url method, should the message type be ephemeral?
 */
var makeSlackMessagePayload = function(blocks, text, channel, thread_ts, reply_broadcast=false, mrkdwn=true, as_user=false, ephemeral){
  
  // initialise payload object
  var payload = {};
  
  // add optional arguments for both chat.PostMessage and response_url methods
  if (blocks){ payload["blocks"] = blocks; }
  if (text){ payload["text"] = text; }
  if (mrkdwn) { payload["mrkdwn"] = mrkdwn; }
  
  // add optional arguments for chat.PostMessage method
  if (channel) { payload["channel"] = channel; }
  if (thread_ts) { payload["thread_ts"] = thread_ts; }
  if (reply_broadcast) { payload["reply_broadcast"] = reply_broadcast; }
  if (as_user) { payload["as_user"] = as_user; }  
  
  // add optional arguments for response_url method
  if (ephemeral){ payload["response_type"] = "ephemeral"; }

  return JSON.stringify(payload);
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
 * @param {string} payload
 * @param {sring} url
 */
var postToSlack = function(payload, url){
  
  if (payload.as_user){
    var access_token = PropertiesService.getScriptProperties().getProperty('ACCESS_TOKEN_USER');
  } else {
    var access_token = PropertiesService.getScriptProperties().getProperty('ACCESS_TOKEN');
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
