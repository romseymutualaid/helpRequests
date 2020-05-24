function requestFormatted(row){
  return `<${row.slackURL}|request ${row.uniqueid}> (${row.requesterName}, ${stripStartingNumbers(row.requesterAddr)})`;
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

function volunteerSuccessMessage(row, isFirstMessage) {
  var mention_requestCoord = globalVariables()['MENTION_REQUESTCOORD'];
  
  var householdMessage = "";
  if (row.householdSit != ""){
    householdMessage = "\nTheir household situation is: " + row.householdSit + ".\n"
  }

  // personalise text depending on whether this is the first time volunteer sees the message or not
  if (isFirstMessage){
    var introTxt = ":nerd_face::tada: You signed up for <" + row.slackURL + "|request " + row.uniqueid + ">."
  } else{
    var introTxt = ":nerd_face::tada: You are still signed up for <" + row.slackURL + "|request " + row.uniqueid + ">."
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
                "text": "The requester's name is " + row.requesterName +
                        ".\n Their address is: " + row.requesterAddr +
                        ".\n And their contact details are: " + row.requesterContact +
                        householdMessage
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "When you are done, type `/done " + row.uniqueid + "`"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "To cancel your help offer, type `/cancel " + row.uniqueid + "`"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "To see this message again, type `/volunteer " + row.uniqueid + "`"
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

var cancelSuccessMessage = function(row){
  return textToJsonBlocks(`You just cancelled your offer for help for ${requestFormatted(row)}.
I've notified the channel.`);
}

var doneSuccessMessage = function(row){
  return textToJsonBlocks(
`You have confirmed your interaction with ${requestFormatted(row)}.
I've notified volunteers in the help request thread and sent
your form submission to the request coordinator on-duty.`);
}

var listLineMessage = function(row, printStatus=false, printVolunteer=false) {
  var msg = requestFormatted(row) + `   ${row.requestType}`;
  
  if (printStatus) msg += `   ${row.requestStatus}`;
  if (printVolunteer){
    if (row.slackVolunteerID == '') msg += `   *Unassigned*`;
    else msg += `   <@${row.slackVolunteerID}>`;
  }
  
  return msg+'\n';
}

var uniqueIDdoesNotExist = function(args){
  var mention_mod = globalVariables()['MENTION_REQUESTCOORD'];
  return textToJsonBlocks(
`error: I couldn't find the request number \`${args.uniqueid}\`. Did you type the right number?
Type \`/listmine\` to list the requests you are currently volunteering for in this channel.
If the issue persists, please contact ${mention_mod}.`);
}

var uniqueIDlookupIsCorrupted = function(row, args){
  var mention_mod = globalVariables()['MENTION_REQUESTCOORD'];
  return textToJsonBlocks(
`error: There is a problem in the spreadsheet on the server.
You asked for request-number ${args.uniqueid}, but I found request-number ${row.uniqueid} in its place.
Please can you notify a developer and ask ${mention_mod} for assistance?`);
}

var wrongChannelMessage = function(row){
  var mention_mod = globalVariables()['MENTION_REQUESTCOORD'];
  return textToJsonBlocks(
`error: The request ${row.uniqueid} does not appear to belong to the channel you are writing from.
Type \`/listmine\` to list the requests you are currently volunteering for in this channel.
If the issue persists, please contact ${mention_mod}.`);
}

var requestAssignedToOtherUserMessage = function(row){
  var mention_mod = globalVariables()['MENTION_REQUESTCOORD'];
  return textToJsonBlocks(
`error: ${requestFormatted(row)} is taken by someone else (<@${row.slackVolunteerID}>).
Type \`/list\` to list all the available requests in this channel.
If you think there is a mistake, please contact ${mention_mod}.`);
}

var requestUnassignedMessage = function(row){
  var mention_mod = globalVariables()['MENTION_REQUESTCOORD'];
  return textToJsonBlocks(
`error: ${requestFormatted(row)} is yet to be assigned.
Type \`/listmine\` to list the requests you are currently volunteering for in this channel.
If you think there is a mistake, please contact ${mention_mod}.`);
}

var requestClosedVolunteerMessage = function(row){
  var mention_mod = globalVariables()['MENTION_REQUESTCOORD'];
  return textToJsonBlocks(
`${requestFormatted(row)} is now closed. Thank you for your help!
Type \`/list\` to list all the available requests in this channel.
If you think there is a mistake, please contact ${mention_mod}.`);
}

var requestClosedCancelMessage = function(row){
  var mention_mod = globalVariables()['MENTION_REQUESTCOORD'];
  return textToJsonBlocks(
`You were signed up on ${requestFormatted(row)} but it's now closed. We therefore won't remove you.
Type \`/listmine\` to list the requests you are currently volunteering for in this channel.
If you think there is a mistake, please contact ${mention_mod}.`);
}
           
var requestClosedDoneMessage = function(row){
   var mention_mod = globalVariables()['MENTION_REQUESTCOORD'];                                                
return textToJsonBlocks(`error: You cannot complete ${requestFormatted(row)} because it is permanently closed.
Type \`/listmine\` to list the requests you are currently volunteering for in this channel.
If you think there is a mistake, please contact ${mention_mod}.`);
}
           
var requestStatusNotRecognisedMessage = function(row){
   var mention_mod = globalVariables()['MENTION_REQUESTCOORD'];                                              
   return textToJsonBlocks(
`error: There is a problem in the spreadsheet on the server.
I couldn't recognise the current status value "${row.requestStatus}" of request ${row.uniqueid}.
Please can you notify a developer and ask ${mention_mod} for assistance?`);
}



var postToSlackChannelErrorMessage = function(){
  var mention_mod = globalVariables()['MENTION_REQUESTCOORD'];  
  return textToJsonBlocks(
`error: I have processed your request, but I was unable to notify the slack channel.
Can you please do so yourself, or ask ${mention_requestCoord} to?`);
}

var postToSlackModalErrorMessage = function(error_msg){
  return textToJsonBlocks(
`I was not able to send you the \`/done\` submission form. Can you please notify a developer?
This is the error message:
${error_msg}`);
}