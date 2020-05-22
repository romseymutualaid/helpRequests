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



function doneModalMessage (uniqueid, userid, cmd_metadata){

  return JSON.stringify({
	"type": "modal",
	"title": {"type": "plain_text","text": "How did it go?"},
    "callback_id": "done_modal",
    "private_metadata": cmd_metadata,
	"submit": {"type": "plain_text","text": "Submit"},
	"close": {"type": "plain_text","text": "Cancel"},
	"blocks": [
		{
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": ":wave: Hi <@"+userid+">,\n\nThanks for letting me know you have provided help for request number "+uniqueid+". The on-duty request coordinator has some questions, would you mind taking a few seconds to fill them in?"
          }
		},
		{
          "type": "divider"
		},
		{
          "type": "input",
          "block_id": "requestNextStatus",
          "label": {"type": "plain_text","text": "Should this request be closed?"},
          "element": {
            "type": "radio_buttons",
            "action_id":"requestNextStatusVal",
            "options": [
              {
                "text": {"type": "plain_text","text": "Yes"},
                "value": "toClose"
              },
              {
                "text": {"type": "plain_text","text": "No, keep me assigned"},
                "value": "keepOpenAssigned"
              },
              {
                "text": {"type": "plain_text","text": "No, assign a new volunteer"},
                "value": "keepOpenNew"
              },
              {
                "text": {"type": "plain_text","text": "I don't know"},
                "value": "unsure"
              }
            ]
          }
		},
		{
          "type": "input",
          "block_id": "completionLastDetails",
          "label": {"type": "plain_text","text": "Anything else you'd like to add?"},
          "element": {"type": "plain_text_input","action_id":"completionLastDetailsVal","multiline": true},
          "optional": true
		}]
  });
}


var printRequestSummary = function(row, printStatus=false, printVolunteer=false) {
  var msg = requestFormatted(row) + `   ${row.requestType}`;
  
  if (printStatus) msg += `   ${row.requestStatus}`;
  if (printVolunteer){
    if (row.slackVolunteerID == '') msg += `   *Unassigned*`;
    else msg += `   <@${row.slackVolunteerID}>`;
  }
  
  return msg+'\n';
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
  
  if (JSON.parse(return_message).ok !== true){ // message was not successfully posted to channel
    throw new Error(textToJsonBlocks(
      `error: I have processed your request, but I was unable to notify the slack channel.
      Can you please do so yourself, or ask ${mention_requestCoord} to?`));
  }
}

var slackModalReply = function(payload, uniqueid){
  var url = 'https://slack.com/api/views.open';
  
  var return_message = postToSlack(payload, url);
  var log_sheet = new LogSheetWrapper();
  log_sheet.appendRow([new Date(), uniqueid,'admin','messageUserModal',return_message]);
  
  if (JSON.parse(return_message).ok !== true){ // message was not successfully posted to channel
    throw new Error(textToJsonBlocks(
      `I failed to open the \`/done\` submission form. Can you please notify a developer?
      This is the error message:
      ${return_message}`));
  }
}