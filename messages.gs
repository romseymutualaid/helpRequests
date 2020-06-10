// All custom messages sent to the view (slack API) are stored here.

var appHomePageDirectionsFormatted = function(linkOnly=false){
  var TEAM_ID = globalVariables()['TEAM_ID'];
  var APP_ID = globalVariables()['SLACK_APP_ID'];
  var link = `<slack:\/\/app?team=${TEAM_ID}&id=${APP_ID}&tab=home|request dashboard>`;
  if (linkOnly) return link;
  else return `${link} (Shorcut icon :zap: in message box -> Search "My requests dashboard")`;
}

var requestFormatted = function(row){
  return `<${row.slackURL}|request ${row.uniqueid}> (${row.requesterName}, ${stripStartingNumbers(row.requesterAddr)})`;
}

var requestPrivateDetailsFormatted = function(row){
  
  var householdMessage = "";
  if (row.householdSit != ""){
    householdMessage = "\nTheir household situation is: " + row.householdSit + ".\n"
  }
  
  return {
    "type": "section",
    "text": {
      "type": "plain_text",
      "text": "The requester's name is " + row.requesterName +
      ".\n Their address is: " + row.requesterAddr +
      ".\n And their contact details are: " + row.requesterContact +
      householdMessage
    }
  };
}

var requestFormattedFull = function(row){
  
  return [
    {
      "type":"divider"
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": `<${row.slackURL}|Request ${row.uniqueid}>`
      }
    },
    requestPrivateDetailsFormatted(row),
    {
      "type": "actions",
      "elements": [
        cancelButtonObject(row),
        doneButtonObject(row)
      ]
    },
    {
      "type":"divider"
    }
  ];
}

var volunteerButtonObject = function(row){
  return {
    "type": "button",
    "text": {
      "type": "plain_text",
      "text": "Volunteer",
    },
    "style": "primary",
    "action_id": "button_volunteer",
    "value": row.uniqueid,
    "confirm": {
      "title": {
        "type": "plain_text",
        "text": "Are you sure?"
      },
      "text": {
        "type": "mrkdwn",
        "text": `You are about to volunteer for ${requestFormatted(row)}.`
      },
      "confirm": {
        "type": "plain_text",
        "text": "Yes"
      },
      "deny": {
        "type": "plain_text",
        "text": "No"
      }
    }
  };
}

var cancelButtonObject = function(row){
  return {
    "type": "button",
    "text": {
      "type": "plain_text",
      "text": "I can no longer help"
    },
    "action_id": "button_cancel",
    "value": row.uniqueid
  };
}

var doneButtonObject = function(row){
  return {
    "type": "button",
    "style": "primary",
    "text": {
      "type": "plain_text",
      "text": "I have helped"
    },
    "action_id": "button_done",
    "value": row.uniqueid
  };
}

var postRequestMessage = function(row, volunteerable=true){ 
  
  var text = 'A resident in your area has a request. Can you help?'; // text to display on mobile app notification
  
  var blocks = [
	{
      "type": "section",
      "text": {
        "text": "<!channel> *A resident in your area has a request. Can you help?*\n"+
        "_Guidelines for volunteers: <https://docs.google.com/document/d/1l9tssHGzP1Zzr4TSaltlXS3x7QSF4PrGihEpBxoGUwM/edit?usp=sharing|deliveries> -"+
        " <https://docs.google.com/document/d/1TDuns8kLnbc1TCa9MZLz_uaI6CSVqb3xJvG2gc71Dy4/edit?usp=sharing|escalation> - <https://docs.google.com/document/d/1s35O51IEiZMnodyg4wiw_dVwbn7ZvCQkKu6mKsN_gvM|infection control>_",
        "type": "mrkdwn"
      }
    },
    {
      "type": "divider"
    },
    {
      "type": "section",
      "fields": [
        {"type": "mrkdwn", "text": "*Requester:*"},
        {"type": "plain_text", "text": row.requesterName + " ("+ row.requesterAddr +")"},
        
        {"type": "mrkdwn", "text": "*Contact details:*"},
        {"type": "mrkdwn", "text": "_Sent only to volunteer._"},
        
        {"type": "mrkdwn", "text": "*Immediate request:*"},
        {"type": "plain_text", "text": row.requestType + " "},
        
        {"type": "mrkdwn", "text": "*Date needed:*"},
        {"type": "plain_text", "text": formatDate(row.requestDate) + " "},
        
        {"type": "mrkdwn", "text": "*Request additional info:*"},
        {"type": "plain_text","text": row.requestInfo + " "}
      ]
    },
    {
      "type": "section",
      "fields": [
        {"type": "mrkdwn", "text": "*Prospective needs:*"},
        {"type": "plain_text", "text": row.requesterGeneralNeeds + " "},
        {"type": "mrkdwn", "text": "*Request number:*"},
        {"type": "plain_text", "text": row.uniqueid + " "}
      ]
    },
    {
      "type": "divider"
    }
  ]; // this message is formatted in such a way that all user-input text is escaped (type: "plain_text"). This is intended to protect against cross-site scripting attacks.
    
  // if the request is volunteerable, add "Volunteer" button as a last block element.
  if (volunteerable){
    blocks.push(
      {
        "type": "actions",
        "elements": [
          volunteerButtonObject(row)
        ]
      }
    );
  } else{
    blocks.push(
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*This request has been volunteered for. Find all the requests you have signed up for on your ${appHomePageDirectionsFormatted()}.*`
        }
      }
    );
  }
  
  return JSON.stringify({
    blocks: JSON.stringify(blocks),
    text: text,
    channel: row.channelid,
    ts:row.slackTS, // required for chat.postupdate
    as_user: true
  });
}

var appHomeShortcutModalMessage = function(args){
  
  var view = JSON.stringify({
    "type": "modal",
    "title": {"type": "plain_text","text": "Shortcut"},
    "blocks": [
      {
        "type": "section",
        "text":{
          "type": "mrkdwn",
          "text": appHomePageDirectionsFormatted(linkOnly=true)
        }
      }
    ]
  });
  
  return JSON.stringify({
    trigger_id: args.trigger_id,
    view: view
  });
}

var doneModalMessage = function(args){

  var cmd_metadata = JSON.stringify({
    uniqueid: args.uniqueid,
    channelid: args.channelid,
    response_url: args.response_url
  }); // data passed as metadata in modal, to follow up on command request once modal user submission is received
  
  var view = JSON.stringify({
	"type": "modal",
	"title": {"type": "plain_text","text": "How did it go?"},
    "callback_id": "modal_done",
    "private_metadata": cmd_metadata,
	"submit": {"type": "plain_text","text": "Submit"},
	"close": {"type": "plain_text","text": "Cancel"},
	"blocks": [
		{
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": ":wave: Hi <@"+args.userid+">,\n\nThanks for letting me know you have provided help for request number "+args.uniqueid+". The on-duty request coordinator has some questions, would you mind taking a few seconds to fill them in?"
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
  
  return JSON.stringify({
    trigger_id: args.trigger_id,
    view: view
  });
}

var volunteerSuccessMessage = function(row, isFirstMessage=true) {
  var mention_requestCoord = globalVariables()['MENTION_REQUESTCOORD'];

  // personalise text depending on whether this is the first time volunteer sees the message or not
  if (isFirstMessage){
    var introTxt = ":nerd_face::tada: You signed up for <" + row.slackURL + "|request " + row.uniqueid + ">."
  } else{
    var introTxt = ":nerd_face::tada: You are still signed up for <" + row.slackURL + "|request " + row.uniqueid + ">."
  }
  
  var blocks_header = [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": introTxt
      }
    }
  ];
  
  var blocks_footer = [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": `*Let me know when you have helped - or if you wish to cancel - on your ${appHomePageDirectionsFormatted()}.*`
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": `Alternatively, you can send \`/done ${row.uniqueid}\`, \`/cancel ${row.uniqueid}\` or \`/volunteer ${row.uniqueid}\` in the channel.`
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "If you need any help, please contact " + mention_requestCoord + "."
      }
    }
  ];
  
  var blocks_divider = [
    {
      "type": "divider"
    }
  ];

  // Json Template for replying to successful volunteer messages.
  return JSON.stringify({
    "response_type":"ephemeral",
    "replace_original": false,
    "blocks": [].concat(
      blocks_header,
      blocks_divider,
      [requestPrivateDetailsFormatted(row)],
      blocks_divider,
      blocks_footer
    )
  });
}

var cancelSuccessMessage = function(row){
  return textToJsonBlocks(`You just cancelled your offer for help for ${requestFormatted(row)}.
I've notified the channel.`);
}

var defaultSendModalSuccessMessage = function(){
  return textToJsonBlocks(`A popup will open in less than 3 seconds... If not, please try again.`);
}

var doneSendModalSuccessMessage = function(args){
  return textToJsonBlocks(`A request completion form will open in less than 3 seconds... If not, please type \`/done ${args.uniqueid}\` again.`);
}

var doneSuccessMessage = function(row){
  return textToJsonBlocks(
`You have confirmed your interaction with ${requestFormatted(row)}.
I've notified volunteers in the help request thread and sent
your form submission to the request coordinator on-duty.`);
}

var assignPendingMessage = function(){
  return textToJsonBlocks(`Assigning volunteer on behalf...`);
}

var volunteerChannelMessage = function(row){
  var text = `<@${row.slackVolunteerID}> has volunteered. :tada:`;
  return JSON.stringify({
    text: text,
    thread_ts: row.slackTS,
    channel: row.channelid,
  });
}

var cancelChannelMessage = function(row, oldVolunteerUserID){
  var text = `<!channel> <@${oldVolunteerUserID}> is no longer available for ${requestFormatted(row)}. Can anyone else help?`;
  var blocks = [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": text
      }
    },
    {
      "type":"actions",
      "elements":[
        volunteerButtonObject(row)
      ]
    },
  ];
  return JSON.stringify({
    text: text,
    blocks: blocks,
    thread_ts: row.slackTS,
    channel: row.channelid,
    reply_broadcast: true
  });
}

var doneChannelMessage = function(row){
  var text = `Thanks for helping out <@${row.slackVolunteerID}>! :nerd_face:`;
  return JSON.stringify({
    text: text,
    thread_ts: row.slackTS,
    channel: row.channelid
  });
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
    
var listHeaderMessage = function(commandName){
  switch (commandName) {
    case 'list':
      return 'These are the help requests in this channel still awaiting a volunteer:\n';
    case 'listactive':
      return 'These are all the active requests in this channel:\n';
    case 'listall':
      return 'These are all the requests posted in this channel:\n';
    case 'listmine':
      return 'These are the active help requests you are assigned to:\n';
    case 'listallmine':
      return 'These are all the help requests you volunteered for:\n';
    default:
      throw new Error(textToJsonBlocks(`I don't recognise the list command \`${commandName}\`. Can you please contact a developer?`));
  }
}

var slackTokenNotSetInScriptMessage = function(){
  return textToJsonBlocks('error: VERIFICATION_TOKEN is not set in script properties. The command will not run. Please contact the web app developer.');
}
                      
var slackTokenIsIncorrectMessage = function(token){
  return textToJsonBlocks(`error: Invalid token ${token}. The command will not run. Please contact the web app developer.`);
}
      
var slackWorspaceIsIncorrectMessage = function(){
  return textToJsonBlocks('error: You are sending your command from an unauthorised slack workspace.');
}

var slackEventTypeIsIncorrectMessage = function(eventType){
  return textToJsonBlocks(`error: I can't handle the event type ${eventType}.`);
}

var commandNotSupportedMessage = function(commandName){
  return textToJsonBlocks(`error: The \`${commandName}\` command is not currently supported.`);
}

var commandNotConnectedMessage = function(commandName){
  return textToJsonBlocks(`error: The \`${commandName}\` command is not properly connected on the server.
Can you please notify a developer?`);
}

var commandArgumentsAreCorruptedMessage = function(){
return textToJsonBlocks(`error: I couldn't process the arguments provided. Can you please notify a developer?`);
}

var commandAvailableOnlyToModeratorMessage = function(commandName){
  var mention_mod = globalVariables()['MENTION_REQUESTCOORD'];
  return textToJsonBlocks(`error: The \`${commandName}\` command can only be used by ${mention_mod}.`);
}

var commandPendingMessage = function(){
  return textToJsonBlocks(`Thank you for your message. I'm a poor bot so please be patient... it should take me up to a few minutes to get back to you...`);
}

var uniqueIDnotProvidedMessage = function(){
  var mention_mod = globalVariables()['MENTION_REQUESTCOORD'];
  return textToJsonBlocks(`error: You must provide the request number present in the help request message (example: \`/volunteer 9999\`).
You appear to have not typed any number. If the issue persists, contact ${mention_mod}.`);
}

var uniqueIDsyntaxIsIncorrectMessage = function(args){
  var mention_mod = globalVariables()['MENTION_REQUESTCOORD'];
  return textToJsonBlocks(`error: The request number \`${args.uniqueid}\` does not appear to be a 4-digit number as expected.
Please specify a correct request number (example: \`/volunteer 9999\`). If the issue persists, contact ${mention_mod}.`);
}

var uniqueIDdoesNotExistMessage = function(args){
  var mention_mod = globalVariables()['MENTION_REQUESTCOORD'];
  return textToJsonBlocks(
`error: I couldn't find the request number \`${args.uniqueid}\`. Did you type the right number?
Type \`/listmine\` to list the requests you are currently volunteering for in this channel.
If the issue persists, please contact ${mention_mod}.`);
}

var uniqueIDlookupIsCorruptedMessage = function(row, args){
  var mention_mod = globalVariables()['MENTION_REQUESTCOORD'];
  return textToJsonBlocks(
`error: There is a problem in the spreadsheet on the server.
You asked for request-number ${args.uniqueid}, but I found request-number ${row.uniqueid} in its place.
Please can you notify a developer and ask ${mention_mod} for assistance?`);
}

var userMentionNotProvidedMessage = function(){
  var mention_mod = globalVariables()['MENTION_REQUESTCOORD'];
  return textToJsonBlocks(`error: You must mention a user that the command applies to (example: \`/assign 9999 ${mention_mod}\`).
You appear to have not mentioned anyone. If the issue persists, contact ${mention_mod}.`);
}

var userMentionSyntaxIsIncorrectMessage = function(args){
  var mention_mod = globalVariables()['MENTION_REQUESTCOORD'];
  return textToJsonBlocks(`error: I did not recognise the user \`${args.mention.str}\` you specified. 
Please specify the user by their mention name (example: \`/assign 9999 ${mention_mod}\`). If the issue persists, contact ${mention_mod}.`);
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
Can you please do so yourself, or ask ${mention_mod} to?`);
}


var postToSlackDefaultModalErrorMessage = function(error_msg){
  return textToJsonBlocks(
`I was not able to send you a popup response. Can you please notify a developer?
This is the error message:
${error_msg}`);
}

var postToSlackDoneModalErrorMessage = function(error_msg){
  return textToJsonBlocks(
`I was not able to send you the \`/done\` submission form. Can you please notify a developer?
This is the error message:
${error_msg}`);
}

var AppHomeWrongTabErrorMessage = function(){
  return textToJsonBlocks(`I only trigger when the home tab is opened. Ignoring this request.`);
}

var appHomeMessage = function(args, rows, showArchivedRequests=false){
  
  if (showArchivedRequests){
    var header_text = listHeaderMessage('listallmine');
  } else{
    var header_text = listHeaderMessage('listmine');
  }
  
  var header_blocks = [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": header_text
      }
    }
  ];
  
  var body_blocksArray = rows
      .map(row => requestFormattedFull(row));
  var blocks = header_blocks.concat(...body_blocksArray);
  
  var view = {
    type: 'home',
    blocks: blocks
  };
  
  return JSON.stringify({
    user_id: args.userid,
    view: view
  });
}