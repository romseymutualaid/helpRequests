function doPost(e) { // catches slack slash commands
  if (typeof e !== 'undefined') {
    
    // extract message body
    var par = e.parameter; 
    
    // decide the nature of the POST request
    var payload = par.payload;
    if (payload){ // if payload exists, this is a POST request from a slack interactive component
      return handleSlackInteractiveMessages(JSON.parse(payload));
    } else{ // else, this is a POST request from a slack slash command
      return handleSlackCommands(par);        
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
    // IB dev switch
    } else if (command == '/ib_v'){
      return volunteer(args, channelid, userid, username);      
    } else if (command == '/ib_c') {
      return cancel(args, channelid, userid);
    } else if (command == '/ib_d') {
      return done(args, channelid, userid);
    // Default
    } else {
      return ContentService.createTextOutput('error: Sorry, the `' + command + '` command is not currently supported.');
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
  // this function is called when manual editing of the spreadsheet occurs. We use this trigger to detect manual changes to:
  // - the channel field of existing requests, and if so, send a message to the newly defined slack channel.
  // - the status field of existing requests, and if status is "Re-open" perform a cancel command, otherwise simply log the edit.
  
  
  /// declare variables
  var globvar = globalVariables();
  
  var log_sheetname = globvar['LOG_SHEETNAME'];
  var tracking_sheetname = globvar['TRACKING_SHEETNAME'];
  
  var webhook_chatPostMessage = globvar['WEBHOOK_CHATPOSTMESSAGE'];
  var access_token = PropertiesService.getScriptProperties().getProperty('ACCESS_TOKEN'); // confidential Slack API access token
  
  var tracking_sheet_col_order = globvar['SHEET_COL_ORDER'];
  var tracking_sheet_col_index = indexedObjectFromArray(tracking_sheet_col_order); // make associative object to easily get colindex from colname  
  
  var colindex_channel = tracking_sheet_col_index['channel'];
  var colindex_status = tracking_sheet_col_index['requestStatus'];
  
  // retrieve relevant information from onEdit trigger event
  var oldValue = e.oldValue;
  var newValue = e.value;
  
  var row = e.range.getRow();
  var col = e.range.getColumn();
  
  var spreadsheet = e.source;
  var sheet = spreadsheet.getActiveSheet();
  var sheetName = sheet.getName();
  
  //var triggerUid = e.triggerUid;
  var user = e.user;
  
  
  // handle edits on tracking sheet
  if (sheetName==tracking_sheetname){ 
    
    if (col==colindex_channel+1 && newValue!=undefined){ //handle channel edit (newValue!=undefined avoids capturing undo - i.e. Ctrl+Z - and blank cell events)  
      
      // post message to slack and update sheets
      var sheet_log = spreadsheet.getSheetByName(log_sheetname);
      postRequest(sheet, row, tracking_sheet_col_index, webhook_chatPostMessage, access_token, 'dispatchUpdate', sheet_log);
      
    } else if (col==colindex_status+1){ // handle status edit
      
      if(newValue=='Re-open'){ // if "re-open", trigger the cancel function
        cancel_su(row);
        
      } else{ // for other status changes, just log the change
        // get uniqueid
        var uniqueid = getUniqueIDbyRow(row, globvar['UNIQUEID_START_VAL'], globvar['UNIQUEID_START_ROWINDEX']);
        
        // update log sheet
        var sheet_log = spreadsheet.getSheetByName(log_sheetname);
        var row_log = sheet_log.getLastRow();
        sheet_log.getRange(row_log+1,1,1,5).setValues([[new Date(), uniqueid,'admin','statusManualEdit',newValue]]);
      }
    }
       
  }
 
}
