function done_send_modal(args){
/// done_send_modal: Open up a slack modal so that user can provide more information about his /done instance
  
  
  /// define variables
  var globvar = globalVariables();
  var mention_requestCoord = globvar['MENTION_REQUESTCOORD'];
  var access_token = PropertiesService.getScriptProperties().getProperty('ACCESS_TOKEN'); // confidential Slack API authentication token
  
  var uniqueid = args.uniqueid;
  var channelid = args.channelid;
  var userid = args.userid;
  var response_url = args.response_url;
  var slack_trigger_id = args.trigger_id;
  
  
  // Send post request to Slack views.open API to open a modal for user  
  var cmd_metadata = JSON.stringify({
    uniqueid: uniqueid,
    channelid: channelid,
    response_url: response_url
  }); // data passed as metadata in modal, to follow up on command request once modal user submission is received 
  var out_modal = {
	"type": "modal",
	"title": {"type": "plain_text","text": "How did it go?"},
    "callback_id": "done_clarify",
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
  };
  var options = {
    method: "post",
    contentType: 'application/json; charset=utf-8',
    headers: {Authorization: 'Bearer ' + access_token},
    payload: JSON.stringify({trigger_id: slack_trigger_id,
                             view: JSON.stringify(out_modal)})
  }; 
  var return_message = UrlFetchApp.fetch('https://slack.com/api/views.open', options).getContentText();
  
  
  // check that modal sent properly 
  var return_params = JSON.parse(return_message);
  var return_ok = return_params.ok;
  if (return_ok !== true){
    return contentServerJsonReply('I failed to open the /done submission form. Can you please notify a developer? This is the error message:\n'+return_message);
  }

  return contentServerJsonReply('A request completion form will open in less than 3 seconds... if not, please type `/done '+uniqueid+'` again.');
}


function done_process_modal(args){
  /// done_process_modal: Read done modal submission. Process done command.
  
  /// declare variables
  var globvar = globalVariables();
  var access_token = PropertiesService.getScriptProperties().getProperty('ACCESS_TOKEN'); // confidential Slack API access token
  var log_sheetname = globvar['LOG_SHEETNAME'];
  
  // process done command
  var out_message = done(args);
  
  // send reply to slack user with response_url functionality
  var response_url = args.response_url;
  var options = {
    method: "post",
    contentType: 'application/json; charset=utf-8',
    headers: {Authorization: 'Bearer ' + access_token},
    payload: JSON.stringify({
      "text": out_message,
      "response_type": "ephemeral"
    })
  };
  var return_message = UrlFetchApp.fetch(response_url, options).getContentText(); // Send post request to Slack response_url  
  
  // update log sheet
  var log_sheet = new LogSheetWrapper();
  log_sheet.appendRow([new Date(), args.uniqueid, 'admin','confirmDoneUser', return_message]);
}



function done(args){
  ///// COMMAND: /DONE
  
  var uniqueid = args.uniqueid;
  var channelid = args.channelid;
  var userid = args.userid;
  
  var modalResponseVals = args.more;
  var requestNextStatus = modalResponseVals.requestNextStatus.requestNextStatusVal.selected_option.value;
  var completionLastDetails = modalResponseVals.completionLastDetails.completionLastDetailsVal.value;
  if (!completionLastDetails){
    completionLastDetails=''; // replace undefined with ''
  }
  
  /// declare variables
  var globvar = globalVariables();
  
  var mention_requestCoord = globvar['MENTION_REQUESTCOORD'];
  
  var tracking_sheet = new TrackingSheetWrapper();
  var log_sheet = new LogSheetWrapper();
    
  var webhook_chatPostMessage = globvar['WEBHOOK_CHATPOSTMESSAGE'];
  var access_token = PropertiesService.getScriptProperties().getProperty('ACCESS_TOKEN'); // confidential Slack API access token
  
  // find requested row in sheet
  var row = tracking_sheet.getRowByUniqueID(uniqueid);
  
  // check command validity
  var cmd_check = checkCommandValidity('done',row,uniqueid,userid,channelid);
  if (!cmd_check.code){ // if command check returns error status, halt function and return error message to user
    return (cmd_check.msg);
  }
    
  // reply to slack thread to confirm done instance (chat.postMessage method)
  var out_message = 'Thanks for helping out <@' + row.slackVolunteerID + '>! :nerd_face:';
  var options = {
    method: "post",
    contentType: 'application/json; charset=utf-8',
    headers: {Authorization: 'Bearer ' + access_token},
    payload: JSON.stringify({text: out_message,
                             thread_ts: row.slackTS,
                             channel: row.channelid})
  };
  // Send post request to Slack chat.postMessage API   
  var return_message = UrlFetchApp.fetch(webhook_chatPostMessage, options).getContentText();
  
  // if post request was unsuccesful, do not update tracking sheet and return error
  var return_params = JSON.parse(return_message);
  if (return_params.ok !== true){ // message was not successfully posted to channel
    
    // update log sheet
    log_sheet.appendRow([new Date(), uniqueid,'admin','confirmDone',return_message]);
    
    // return error to user
    return ('error: Due to a technical incident, I was unable to process your command. Can you please ask ' + mention_requestCoord + ' to close the request manually?');
  }
  
  // update log sheet
  log_sheet.appendRow([new Date(), uniqueid,userid,'slackCommand','done']);
  log_sheet.appendRow([new Date(), uniqueid, 'admin','confirmDone', return_message]);
  
  // update tracking sheet
  if ((requestNextStatus === '') || (requestNextStatus === 'unsure') || (requestNextStatus === 'toClose')){
    row.requestStatus = 'ToClose?';
  } else if (requestNextStatus === 'keepOpenAssigned'){
    row.requestStatus = "Assigned";
  }
  row.completionCount = +row.completionCount +1;
  row.completionLastDetails = completionLastDetails;
  row.completionLastTimestamp = new Date();
  tracking_sheet.writeRow(row);
  
  if (requestNextStatus === 'keepOpenNew'){
    cancel(args);
  }
  
  // return private message to user
  return(cmd_check.msg);
  
}