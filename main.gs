function doPost(e) { // catches slack slash commands
  if (typeof e !== 'undefined') {
    
    /// declare variables
    var globvar = globalVariables();
    var teamid_true =  globvar['TEAM_ID'];
    var token_true = PropertiesService.getScriptProperties().getProperty('VERIFICATION_TOKEN'); // expected verification token that accompanies slack API request
    
    // extract message body
    var par = e.parameter;
    
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
      return done(args, channelid, userid);
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
      return done(args, channelid, userid);
    } else {
      return ContentService.createTextOutput('error: Sorry, the `' + command + '` command is not currently supported.');
    }
    
  }
}



function triggerOnFormSubmit (e){ // this is an installed trigger. see https://developers.google.com/apps-script/guides/triggers/installable
  // this function is called when manual form submission occurs. We use this trigger to detect incoming help requests, and when these already have a channel specified, are directly sent to the relevant slack channel.
  
  
  /// declare variables
  var globvar = globalVariables();
  
  var log_sheetname = globvar['LOG_SHEETNAME'];
  var tracking_sheetname = globvar['TRACKING_SHEETNAME'];
  
  var webhook_chatPostMessage = globvar['WEBHOOK_CHATPOSTMESSAGE'];
  var access_token = PropertiesService.getScriptProperties().getProperty('ACCESS_TOKEN'); // confidential Slack API access token
  
  var formindex_channel = globvar['FORMINDEX_CHANNEL']; // channel form submit index
  var sheet_row_offset = globvar['SHEET_ROW_OFFSET']; // relative row offset between form response sheet and tracking sheet
  
  var tracking_sheet_col_order = globvar['SHEET_COL_ORDER'];
  var tracking_sheet_col_index = indexedObjectFromArray(tracking_sheet_col_order); // make associative object to easily get colindex from colname  
  
  
  // retrieve relevant information from onFormSubmit trigger event
  var channel = e.values[formindex_channel];
  var row_response = e.range.rowStart; // row where submission is in response sheet
  var row = row_response + sheet_row_offset; // row where submission is in tracking sheet, taking any potential row offset between sheets into account. 
  
  if (channel !== ''){ // if channel was specified in form submission, send request directly to slack channel
    
    // call sheets
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = spreadsheet.getSheetByName(tracking_sheetname);
    var sheet_log = spreadsheet.getSheetByName(log_sheetname);
    
    // post message to slack and update sheets
    postRequest(sheet, row, tracking_sheet_col_index, webhook_chatPostMessage, access_token, 'dispatchNew', sheet_log);   
    
  }

    
}



function triggerOnEdit(e){ // this is an installed trigger. see https://developers.google.com/apps-script/guides/triggers/installable
  // this function is called when manual editing of the spreadsheet occurs. We use this trigger to detect manual changes to the channel cell of existing requests, and if so, send a message to the newly defined slack channel.
  
  
  /// declare variables
  var globvar = globalVariables();
  
  var log_sheetname = globvar['LOG_SHEETNAME'];
  var tracking_sheetname = globvar['TRACKING_SHEETNAME'];
  
  var webhook_chatPostMessage = globvar['WEBHOOK_CHATPOSTMESSAGE'];
  var access_token = PropertiesService.getScriptProperties().getProperty('ACCESS_TOKEN'); // confidential Slack API access token
  
  var tracking_sheet_col_order = globvar['SHEET_COL_ORDER'];
  var tracking_sheet_col_index = indexedObjectFromArray(tracking_sheet_col_order); // make associative object to easily get colindex from colname  
  
   var colindex_channel = tracking_sheet_col_index['channel']; // the column the edit must have occurred in
  
  // retrieve relevant information from onEdit trigger event
  var oldValue = e.oldValue;
  var newValue = e.value;
  
  var row = e.range.getRow();
  var col = e.range.getColumn();
  
  var spreadsheet = e.source;
  var sheet = spreadsheet.getActiveSheet();
  var sheetName = sheet.getName();
  
  //var triggerUid = e.triggerUid;
  //var user = e.user;
  
  
  // if channel column was modified on tracking sheet and non-empty, send request to specified channel
  if (sheetName==tracking_sheetname && col==colindex_channel+1 && newValue!=undefined){      
    
    // call log sheet
    var sheet_log = spreadsheet.getSheetByName(log_sheetname);
    
    // post message to slack and update sheets
    postRequest(sheet, row, tracking_sheet_col_index, webhook_chatPostMessage, access_token, 'dispatchUpdate', sheet_log);
       
  }
 
}
