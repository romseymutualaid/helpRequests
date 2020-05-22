function doPost(e) { // catches slack POST requests
  try{
    var slackEvent = createSlackEventClassInstance(e);
    slackEvent.checkAuthenticity();
    slackEvent.checkSyntax();
    return slackEvent.handleEvent();
  }
  catch(errObj){
    return contentServerJsonReply(errObj.message);
  }
  
}


function triggerOnFormSubmit (e){ // this is an installed trigger. see https://developers.google.com/apps-script/guides/triggers/installable
  // this function is called when manual form submission occurs. We use this trigger to detect incoming help requests, and when these already have a channel specified, are directly sent to the relevant slack channel.
  
  // handle trigger depending on which form the submission originates from
  var eventForm = JSON.parse(PropertiesService.getScriptProperties().getProperty('EVENT_FORM'));

  if (e.values.length === eventForm.values.length){ // this is a submission from the event form
    handleEventFormSubmission(e.values);
  } else{


    /// declare variables
    var globvar = globalVariables();

    var log_sheetname = globvar['LOG_SHEETNAME'];
    var tracking_sheetname = globvar['TRACKING_SHEETNAME'];

    var webhook_chatPostMessage = globvar['WEBHOOK_CHATPOSTMESSAGE'];
    var access_token = PropertiesService.getScriptProperties().getProperty('ACCESS_TOKEN_USER'); // confidential Slack API access token
    var formindex_channel = globvar['FORMINDEX_CHANNEL']; // channel form submit index
    var sheet_row_offset = globvar['SHEET_ROW_OFFSET']; // relative row offset between form response sheet and tracking sheet

    var tracking_sheet_col_order = globvar['SHEET_COL_ORDER'];
    var tracking_sheet_col_index = indexedObjectFromArray(tracking_sheet_col_order); // make associative object to easily get colindex from colname

    // retrieve relevant information from onFormSubmit trigger event
    var channel = e.values[formindex_channel];
    var row_response = e.range.rowStart; // row where submission is in response sheet
    var row = row_response + sheet_row_offset; // row where submission is in tracking sheet, taking any potential row offset between sheets into account.

    if (channel && channel !== ''){ // if channel was specified in form submission, send request directly to slack channel

      // call sheets
      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = spreadsheet.getSheetByName(tracking_sheetname);
      var sheet_log = spreadsheet.getSheetByName(log_sheetname);

      // post message to slack and update sheets
      postRequest(sheet, row, tracking_sheet_col_index, webhook_chatPostMessage, access_token, 'dispatchNew', sheet_log);

    }

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
  var access_token = PropertiesService.getScriptProperties().getProperty('ACCESS_TOKEN_USER'); // confidential Slack API access token

  var tracking_sheet_col_order = globvar['SHEET_COL_ORDER'];
  var tracking_sheet_col_index = indexedObjectFromArray(tracking_sheet_col_order); // make associative object to easily get colindex from colname

  var colindex_channel = tracking_sheet_col_index['channel'];
  var colindex_status = tracking_sheet_col_index['requestStatus'];

  // retrieve relevant information from onEdit trigger event
  var oldValue = e.oldValue;
  var newValue = e.value;

  var rowindex = e.range.getRow();
  var colindex = e.range.getColumn();

  var spreadsheet = e.source;
  var sheet = spreadsheet.getActiveSheet();
  var sheetName = sheet.getName();

  //var triggerUid = e.triggerUid;
  var user = e.user;


  // handle edits on tracking sheet
  if (sheetName==tracking_sheetname){

    if (colindex==colindex_channel+1 && newValue!=undefined){ //handle channel edit (newValue!=undefined avoids capturing undo - i.e. Ctrl+Z - and blank cell events)

      // post message to slack and update sheets
      var sheet_log = spreadsheet.getSheetByName(log_sheetname);
      postRequest(sheet, rowindex, tracking_sheet_col_index, webhook_chatPostMessage, access_token, 'dispatchUpdate', sheet_log);

    } 
    else if (colindex==colindex_status+1){ // handle status edit
      
      var uniqueid = getUniqueIDbyRowNumber(rowindex, globvar['UNIQUEID_START_VAL'], globvar['UNIQUEID_START_ROWINDEX']);
      
      if(newValue=='Re-open'){ // if "re-open", trigger the cancel function as a super-user
        var args = {uniqueid:uniqueid, userid:globvar['MOD_USERID']};
        var commandWrapper = new CancelCommand(args);
        commandWrapper.getSheetData();
        commandWrapper.updateSheet();
        commandWrapper.sendSlackPayloads();
      } 
      else { // for other status changes, just log the change
        var sheet_log = spreadsheet.getSheetByName(log_sheetname);
        var row_log = sheet_log.getLastRow();
        sheet_log.getRange(row_log+1,1,1,5).setValues([[new Date(), uniqueid,'admin','statusManualEdit',newValue]]);
      }
    }

  }

}
