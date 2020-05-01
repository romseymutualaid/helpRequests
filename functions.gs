//****************************************
// sheet functions
//****************************************

function getRowByUniqueID(uniqueid, UNIQUEID_START_VAL, UNIQUEID_START_ROWINDEX){
  var row = +uniqueid - UNIQUEID_START_VAL +UNIQUEID_START_ROWINDEX; // assumes: tracking sheet rows are sorted by contiguous increasing request-number
  return(row);
}

//function getRowByColVal(sheetvalues, colindex, value){    
//    var row;
//    for (var i = 0; i < sheetvalues.length ; i++)
//    {
//      if (sheetvalues[i][colindex-1] == value)
//      {
//        row = i;
//        break;
//      }
//    }
//    return row; 
//}



//****************************************
// slack command functions
//****************************************

function checkUniqueID (uniqueid){
  // check that uniqueid does indeed match a 4-digit string
  var re = new RegExp("^[0-9]{4}$"); // regexp match for user_id in mention string
  var uniqueid_re = re.exec(uniqueid); // RegExp.exec returns array. First element is matched string, following elements are matched groupings.
  if (!uniqueid_re){ // failed regex
    return false;
  }
  var uniqueid_re_match = uniqueid_re[0];
  if (uniqueid_re_match == ''){ // no match
    return false;
  } else{
    return true;
  }
}


function handleSlackCommands (par){
//  handle slack slash command POST requests
  
  
  /// declare variables
  var globvar = globalVariables();
  var teamid_true =  globvar['TEAM_ID'];
  var token_true = PropertiesService.getScriptProperties().getProperty('VERIFICATION_TOKEN'); // expected verification token that accompanies slack API request   
  
  // ensure doPost request originates from our slack app - verification token method
  // note: This is not as secure as using the signed secret method (https://api.slack.com/docs/verifying-requests-from-slack) because the token is not uniquely hashed and can be intercepted. 
  // note-continued: Think of improving this in the future.
  var token = par.token;
  
  if(!token_true){ // check that token_true has been set in script properties
    return ContentService.createTextOutput('error: VERIFICATION_TOKEN is not set in script properties. The command will not run. Please contact the web app developer.');
  }
  if (token !== token_true) {
    return ContentService.createTextOutput('error: Invalid token '+token+' . The command will not run. Please contact the web app developer.');
  }
  
  // extract relevant data from message body
  var workspace = par.team_id;
  var command = par.command;
  var channelid = par.channel_id;
  var userid = par.user_id;
  var username = par.user_name;
  var args = par.text;
  var response_url = par.response_url;
  
  // check request originates from our slack workspace
  if (workspace != teamid_true){
    return ContentService.createTextOutput('error: You are sending your command from an unauthorised slack workspace.');
  }
  
  // process command field. 
  // note: Slack has a 3 second timeout on client end. This has not been an issue yet, but with database volume increase, function execution times may increase and lead to timeouts. 
  // note-continued: A fix would be to return an acknowledgement message to client directly without actually executing the function. 
  // note-continued: The function should be somehow queued for execution and par.response_url is passed as an extra argument which allows the slack acknowledgment message to be updated. 
  // note-continued : I have tried delayed function executes with time-delay triggers but that was not appropriate as time-delay triggers - upon creation - have a 1 min queue time before triggering. Too long.
  // note-continued : A workaround could be to queue commands with an automatic submission to a dedicated form (see https://stackoverflow.com/questions/54809366/how-to-send-delayed-response-slack-api-with-google-apps-script-webapp?rq=1). 
  // note-continued : The form responses must be linked to the spreadsheet. Then, the onFormSubmit installed trigger may catch the submissions and execute the relevant functions. This is faster than time-delayed triggers, but can still take several seconds. 
  // note-continued : For now I have avoided any delayed execution and optimised the function execution times to ensure that a return message arrives within the 3 second timeout window.
  if (command == '/_volunteer'){
    return volunteer(args, channelid, userid, username);      
  } else if (command == '/_volunteer2'){
    return volunteer2(args, channelid, userid, username);      
  } else if (command == '/_assign'){
    return assign(args,channelid, userid);      
  } else if (command == '/_cancel') {
    return cancel(args, channelid, userid);
  } else if (command == '/_done') {
    return ContentService.createTextOutput(done(args, channelid, userid));
  } else if (command == '/_list') {
    return list(channelid);
  }  else if (command == '/_listactive') {
    return listactive(channelid);
  } else if (command == '/_listall') {
    return listall(channelid);
  } else if (command == '/_listmine') {
    return listmine(channelid,userid);
  } else if (command == '/_listallmine') {
    return listallmine(channelid,userid);
  } else if (command == '/jb_v'){
    return volunteer(args, channelid, userid, username);      
  } else if (command == '/jb_c') {
    return cancel(args, channelid, userid);
  } else if (command == '/jb_d') {
    return ContentService.createTextOutput(done_send_modal(args, channelid, userid, response_url, par.trigger_id)); // clarify request by opening a modal in slack (with trigger_id) for user to fill
  } else {
    return ContentService.createTextOutput('error: Sorry, the `' + command + '` command is not currently supported.');
  }
}


function handleSlackInteractiveMessages (payload){
  // handle interactive message POST requests from slack

  // declare variables
  var globvar = globalVariables();
  var teamid_true =  globvar['TEAM_ID'];
  var token_true = PropertiesService.getScriptProperties().getProperty('VERIFICATION_TOKEN'); // expected verification token that accompanies slack API request     
  
  // ensure doPost request originates from our slack app - verification token method
  // note: This is not as secure as using the signed secret method (https://api.slack.com/docs/verifying-requests-from-slack) because the token is not uniquely hashed and can be intercepted. 
  // note-continued: Think of improving this in the future.
  var token = payload.token;
  if(!token_true){ // check that token_true has been set in script properties
//    return ContentService.createTextOutput('error: VERIFICATION_TOKEN is not set in script properties. The command will not run. Please contact the web app developer.');
    return ContentService.createTextOutput();
  }  
  if (token !== token_true) {
//    return ContentService.createTextOutput('error: Invalid token '+token+' . The command will not run. Please contact the web app developer.');
    return ContentService.createTextOutput();
  }
  
  
  // extract relevant data from message body
  var workspace = payload.team.id;
  var userid = payload.user.id;
//  var viewid = payload.view.id;
  
  
  // check request originates from our slack workspace
  if (workspace != teamid_true){
//    return ContentService.createTextOutput('error: You are sending your command from an unauthorised slack workspace.');
    return ContentService.createTextOutput();
  }
  
  // proceed depending on the type of interactive message received
  if (payload.type === "view_submission"){ // modal submission
    
    var view = payload.view;
    
    if (view.callback_id === "done_clarify"){ // /done modal
      done_process_modal(userid,view);   
      return ContentService.createTextOutput(); // an empty HTTP 200 OK message is required for modal to close on slack client end.
    } else {
      // modal callback_id was not recognised
      var out_message = 'I don\'t recognise the form identifier that was submitted. This is a bug, please can you notify a developer?';
      return ContentService.createTextOutput(out_message);
    }
  } else{
    // interactive element type was not recognised
    var out_message = 'I\'m not capable of reading anything else but slack modals. This is a bug, please can you notify a developer?';    
    return ContentService.createTextOutput(out_message);
  }
}



// slack message functions

function postRequest(sheet, row, tracking_sheet_col_index, webhook_chatPostMessage, access_token, postType, sheet_log){
  
  // get relevant sheet values
  var colindex_uniqueid = tracking_sheet_col_index['uniqueid'];
  var colindex_channelid = tracking_sheet_col_index['channelid']; 
  var colindex_phone = tracking_sheet_col_index['requesterContact'];
  var colindex_status = tracking_sheet_col_index['requestStatus']; 
  var colindex_volunteerName = tracking_sheet_col_index['slackVolunteerName']; 
  var colindex_volunteerID = tracking_sheet_col_index['slackVolunteerID']; 
  var colindex_slackts = tracking_sheet_col_index['slackTS']; 
  var colindex_slacktsurl = tracking_sheet_col_index['slackURL'];
  var colindex_requestername = tracking_sheet_col_index['requesterName'];
  var colindex_address = tracking_sheet_col_index['requesterAddr'];
  var colindex_requestType =  tracking_sheet_col_index['requestType'];
  var colindex_requestDate =  tracking_sheet_col_index['requestDate'];
  var colindex_requestInfo =  tracking_sheet_col_index['requestInfo'];
  var colindex_generalNeeds =  tracking_sheet_col_index['requesterGeneralNeeds'];
  
  var uniqueid = sheet.getRange(row, colindex_uniqueid+1).getValue();
  var requesterName = sheet.getRange(row, colindex_requestername+1).getValue();
  var address = sheet.getRange(row, colindex_address+1).getValue();
  var requestType = sheet.getRange(row, colindex_requestType+1).getValue();
  var requestDateUnformatted = new Date (sheet.getRange(row, colindex_requestDate+1).getValue());
  var requestDate = requestDateUnformatted.getDate() + '/' + (requestDateUnformatted.getMonth() + 1) +'/'+ requestDateUnformatted.getFullYear( ); // DD/MM/YYYY
  var requestInfo = sheet.getRange(row, colindex_requestInfo+1).getValue();
  var generalNeeds = sheet.getRange(row, colindex_generalNeeds+1).getValue();
  var channelid = sheet.getRange(row, colindex_channelid+1).getValue();
  
  // Build JSON post request
  var out_message_notification = 'A resident in your area has a request. Can you help?'; // text to display on mobile app notification
  var out_message = JSON.stringify([
	{
		"type": "section",
		"text": {
			"text": "<!channel> *A resident in your area has a request. Can you help?*\n"+
          "_Guidelines for volunteers: <https://docs.google.com/document/d/1l9tssHGzP1Zzr4TSaltlXS3x7QSF4PrGihEpBxoGUwM/edit?usp=sharing|deliveries> -"+
          " <https://docs.google.com/document/d/1TDuns8kLnbc1TCa9MZLz_uaI6CSVqb3xJvG2gc71Dy4/edit?usp=sharing|escalation> - <https://docs.google.com/document/d/1s35O51IEiZMnodyg4wiw_dVwbn7ZvCQkKu6mKsN_gvM|infection control>_",
			"type": "mrkdwn"
		},
		"fields": [
          {"type": "mrkdwn", "text": "*Requester:*"},
          {"type": "plain_text", "text": requesterName + " ("+ address +")"},
			
          {"type": "mrkdwn", "text": "*Contact details:*"},
          {"type": "mrkdwn", "text": "To volunteer, send `/volunteer "+uniqueid+"` in channel."},
          
          {"type": "mrkdwn", "text": "*Immediate request:*"},
          {"type": "plain_text", "text": requestType + " "},
          
          {"type": "mrkdwn", "text": "*Date needed:*"},
          {"type": "plain_text", "text": requestDate + " "},
          
          {"type": "mrkdwn", "text": "*Request additional info:*"},
          {"type": "plain_text","text": requestInfo + " "}
		]
	},
	{
		"type": "section",
		"fields": [
          {"type": "mrkdwn", "text": "*Prospective needs:*"},
          {"type": "plain_text", "text": generalNeeds + " "}
		]
	},
    {
      "type": "divider"
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "_Note: `/volunteer "+uniqueid+"` may occasionally fail. If so, please send the command again until you receive contact details_."
      }
    }
  ]); // this message is formatted in such a way that all user-input text is escaped (type: "plain_text"). This is intended to protect against cross-site scripting attacks.
  
  var options = {
    method: "post",
    contentType: 'application/json; charset=utf-8',
    headers: {Authorization: 'Bearer ' + access_token},
    payload: JSON.stringify({blocks: out_message,
                             text: out_message_notification,
                             channel: channelid})
  };
  
  var return_message = UrlFetchApp.fetch(webhook_chatPostMessage, options).getContentText(); // Send post request to Slack chat.postMessage API   
  
  // Update sheet status and slack_ts depending on success of post return-message
  var return_params = JSON.parse(return_message);
  if (return_params.ok === true){ // message was succesfully posted to channel
    sheet.getRange(row, colindex_slackts+1).setValue(return_params.ts); // update slack ts field
    sheet.getRange(row, colindex_status+1).setValue('Sent'); // update status field
  } else{
    sheet.getRange(row, colindex_slackts+1).setValue('');
    sheet.getRange(row, colindex_status+1).setValue('FailSend');
  }
  
  // update log sheet
  var row_log = sheet_log.getLastRow();
  sheet_log.getRange(row_log+1,1,1,5).setValues([[new Date(),uniqueid,'admin',postType,return_message]]);
}



// miscelaneous functions

function indexedObjectFromArray (arr) {
  var obj={};
  for (var i=0; i < arr.length; i++){
    obj[arr[i]]=i;
  }
  return obj;
}