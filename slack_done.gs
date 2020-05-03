function done_send_modal(uniqueid, channelid, userid, response_url, slack_trigger_id){
/// done_send_modal: Open up a slack modal so that user can provide more information about his /done instance
  
  
  /// define variables
  var globvar = globalVariables();
  var mention_requestCoord = globvar['MENTION_REQUESTCOORD'];
  var access_token = PropertiesService.getScriptProperties().getProperty('ACCESS_TOKEN'); // confidential Slack API authentication token
  
  
  // check that request uniqueid has been specified
  if (uniqueid == ''){
    return ('error: You must provide the request number present in the help request message (example: `/done 9999`). '+
                                           'You appear to have not typed any number. If the issue persists, contact ' + mention_requestCoord + '.');
  }
  
  // check that uniqueid does indeed match a 4-digit string
  if (!checkUniqueID(uniqueid)){
    return ('error: The request number `'+uniqueid+'` does not appear to be a 4-digit number as expected. '+
                                           'Please specify a correct request number. Example: `/done 1000`.');
  }
  
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
    return ('I failed to open the /done submission form. Can you please notify a developer? This is the error message:\n'+return_message);
  }

  return ('A request completion form will open in less than 3 seconds... if not, please type `/done '+uniqueid+'` again.');
}


function done_process_modal(userid,view){
  /// done_process_modal: Read done modal submission. Process done command.
  
  /// declare variables
  var globvar = globalVariables();
  var access_token = PropertiesService.getScriptProperties().getProperty('ACCESS_TOKEN'); // confidential Slack API access token
  var log_sheetname = globvar['LOG_SHEETNAME'];
  
  // get uniqueid/channelid/response_url from modal private_metadata 
  var cached_values = JSON.parse(view.private_metadata);
  var uniqueid = cached_values.uniqueid;
  var channelid = cached_values.channelid;
  var response_url = cached_values.response_url;
  
  // get response values in modal
  var modalResponseVals = view.state.values;
  var requestNextStatus = modalResponseVals.requestNextStatus.requestNextStatusVal.selected_option.value;
  var completionLastDetails = modalResponseVals.completionLastDetails.completionLastDetailsVal.value;
  if (!completionLastDetails){
    completionLastDetails=''; // replace undefined with ''
  }
  
  // process done command
  var out_message = done(uniqueid, channelid, userid, requestNextStatus, completionLastDetails);
  
  // send reply to slack user with response_url functionality
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
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet_log = spreadsheet.getSheetByName(log_sheetname);
  var row_log = sheet_log.getLastRow();
  sheet_log.getRange(row_log+1,1,1,5).setValues([[new Date(), uniqueid,'admin','confirmDoneUser',return_message]]);
}



function done(uniqueid, channelid, userid, requestNextStatus, completionLastDetails){
  ///// COMMAND: /DONE
    
  
  /// define variables
  var globvar = globalVariables();
  var mod_userid = globvar['MOD_USERID'];
  var mention_requestCoord = globvar['MENTION_REQUESTCOORD'];
  
  var log_sheetname = globvar['LOG_SHEETNAME'];
  var tracking_sheetname = globvar['TRACKING_SHEETNAME'];
  
  var webhook_chatPostMessage = globvar['WEBHOOK_CHATPOSTMESSAGE'];
  var access_token = PropertiesService.getScriptProperties().getProperty('ACCESS_TOKEN'); // confidential Slack API authentication token
  
  var tracking_sheet_col_order = globvar['SHEET_COL_ORDER'];
  var tracking_sheet_ncol = tracking_sheet_col_order.length;
  var tracking_sheet_col_index = indexedObjectFromArray(tracking_sheet_col_order); // make associative object to easily get colindex from colname  
  
  var UNIQUEID_START_VAL = globvar['UNIQUEID_START_VAL'];
  var UNIQUEID_START_ROWINDEX = globvar['UNIQUEID_START_ROWINDEX'];
  
  var colindex_uniqueid = tracking_sheet_col_index['uniqueid'];
  var colindex_channelid = tracking_sheet_col_index['channelid']; 
  var colindex_phone = tracking_sheet_col_index['requesterContact'];
  var colindex_status = tracking_sheet_col_index['requestStatus']; 
  var colindex_volunteerName = tracking_sheet_col_index['slackVolunteerName']; 
  var colindex_volunteerID = tracking_sheet_col_index['slackVolunteerID']; 
  var colindex_slackts = tracking_sheet_col_index['slackTS']; 
  var colindex_slacktsurl = tracking_sheet_col_index['slackURL'];
  var colindex_channel = tracking_sheet_col_index['channel']; 
  var colindex_requestername = tracking_sheet_col_index['requesterName'];
  var colindex_address = tracking_sheet_col_index['requesterAddr'];
  var colindex_completionCount = tracking_sheet_col_index['completionCount'];
  var colindex_completionLastTimestamp = tracking_sheet_col_index['completionLastTimestamp']; 
  var colindex_completionLastDetails = tracking_sheet_col_index['completionLastDetails'];  
  
  
  // check that request uniqueid has been specified
  if (uniqueid == ''){
    return ('error: You must provide the request number present in the help request message (example: `/done 9999`). '+
                                           'You appear to have not typed any number. If the issue persists, contact ' + mention_requestCoord + '.');
  }
  
  // check that uniqueid does indeed match a 4-digit string
  if (!checkUniqueID(uniqueid)){
    return ('error: The request number `'+uniqueid+'` does not appear to be a 4-digit number as expected. '+
                                           'Please specify a correct request number. Example: `/done 1000`.');
  }
  
  
  // load sheet
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(tracking_sheetname);
  
  // find requested row in sheet  
  var row = getRowByUniqueID(uniqueid, UNIQUEID_START_VAL, UNIQUEID_START_ROWINDEX);
  var rowvalues = sheet.getRange(row, 1, 1, tracking_sheet_ncol).getValues()[0];
  
  // store fields as separate variables
  var channelid_true = rowvalues[colindex_channelid]; 
  var requesterName = rowvalues[colindex_requestername];
  var address = rowvalues[colindex_address];
  var slackurl = rowvalues[colindex_slacktsurl];
  var status = rowvalues[colindex_status]; 
  var volunteerID = rowvalues[colindex_volunteerID];
  var slack_ts = rowvalues[colindex_slackts];
  var completionCount = rowvalues[colindex_completionCount];
  
  // check command validity
  var cmd_check = checkCommandValidity('done',rowvalues,uniqueid,userid,channelid);
  if (!cmd_check.code){ // if command check returns error status, halt function and return error message to user
    return(cmd_check.msg);
  }
    
  // reply to slack thread to confirm done instance (chat.postMessage method)
  var out_message = 'Thanks for helping out <@' + volunteerID + '>! :nerd_face:';
  var options = {
    method: "post",
    contentType: 'application/json; charset=utf-8',
    headers: {Authorization: 'Bearer ' + access_token},
    payload: JSON.stringify({text: out_message,
                             thread_ts: slack_ts,
                             channel: channelid})
  };
  // Send post request to Slack chat.postMessage API   
  var return_message = UrlFetchApp.fetch(webhook_chatPostMessage, options).getContentText();
  
  // if post request was unsuccesful, do not update tracking sheet and return error
  var return_params = JSON.parse(return_message);
  if (return_params.ok !== true){ // message was not successfully posted to channel
    // update log sheet
    var sheet_log = spreadsheet.getSheetByName(log_sheetname);
    var row_log = sheet_log.getLastRow();
    sheet_log.getRange(row_log+1,1,1,5).setValues([[new Date(), uniqueid,'admin','confirmDone',return_message]]);
    
    // return error to user
    return ('error: Due to a technical incident, I was unable to process your command. Can you please ask ' + mention_requestCoord + ' to close the request manually?');
  }
  
  // update log sheet
  var sheet_log = spreadsheet.getSheetByName(log_sheetname);
  var row_log = sheet_log.getLastRow();
  sheet_log.getRange(row_log+1,1,2,5).setValues([[new Date(), uniqueid,userid,'slackCommand','done'],
                                                [new Date(), uniqueid,'admin','confirmDone',return_message]]);  
  
  // update tracking sheet
  if ((requestNextStatus === '') || (requestNextStatus === 'unsure') || (requestNextStatus === 'toClose')){
    sheet.getRange(row, colindex_status+1).setValue('ToClose?');
  } else if (requestNextStatus === 'keepOpenNew'){
    cancel(uniqueid, channelid, userid);
  } else if (requestNextStatus === 'keepOpenAssigned'){
    sheet.getRange(row, colindex_status+1).setValue('Assigned');
  }
  sheet.getRange(row, colindex_completionCount+1).setValue(+completionCount+1); // increment completionCount
  sheet.getRange(row, colindex_completionLastDetails+1).setValue(completionLastDetails); // update completionLastDetails
  sheet.getRange(row, colindex_completionLastTimestamp+1).setValue(new Date()); // update completionLastTimestamp to current time
  
  return(cmd_check.msg);
  
}