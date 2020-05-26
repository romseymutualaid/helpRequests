function doPost(e) { // catches slack POST requests
  try{
    var slackEvent = createSlackEventClassInstance(e);
    slackEvent.parse();
    var messageToUser = slackEvent.handle();
    return contentServerJsonReply(messageToUser);
  }
  catch(errObj){
    if (errObj instanceof TypeError  || errObj instanceof ReferenceError){
      // if a code error, throw the full error log
      throw errObj;
    }
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
    var formindex_channel = globvar['FORMINDEX_CHANNEL']; // channel form submit index
    var sheet_row_offset = globvar['SHEET_ROW_OFFSET']; // relative row offset between form response sheet and tracking sheet
    
    // retrieve relevant information from onFormSubmit trigger event
    var channel = e.values[formindex_channel];
    var row_response = e.range.rowStart; // row where submission is in response sheet
    var rowindex = row_response + sheet_row_offset; // row where submission is in tracking sheet, taking any potential row offset between sheets into account.

    if (channel && channel !== ''){ // if channel was specified in form submission, send request directly to slack channel
      var uniqueid = getUniqueIDbyRowNumber(rowindex, globvar['UNIQUEID_START_VAL'], globvar['UNIQUEID_START_ROWINDEX']);
      var args = {uniqueid:uniqueid, userid:globvar['MOD_USERID']};
      var commandWrapper = new PostRequestCommand(args);
      commandWrapper.execute_superUser();
    }
  }
}



function triggerOnEdit(e){ // this is an installed trigger. see https://developers.google.com/apps-script/guides/triggers/installable
  // this function is called when manual editing of the spreadsheet occurs. We use this trigger to detect manual changes to:
  // - the channel field of existing requests, and if so, send a message to the newly defined slack channel.
  // - the status field of existing requests, and if status is "Re-open" perform a cancel command, otherwise simply log the edit.

  /// declare variables
  var globvar = globalVariables();

  var tracking_sheet_name = globvar['TRACKING_SHEETNAME'];
  var tracking_sheet_columns = globvar['SHEET_COL_ORDER'];

  // retrieve relevant information from onEdit trigger event
  var oldValue = e.oldValue;
  var newValue = e.value;

  var rowindex = e.range.getRow(); // indexed at 1
  var colindex = e.range.getColumn() -1; // indexed at 0

  var spreadsheet = e.source;
  var sheet = spreadsheet.getActiveSheet();
  var sheetName = sheet.getName();

  //var triggerUid = e.triggerUid;
//  var user = e.user;

  // handle edits on tracking sheet
  if (sheetName===tracking_sheet_name){
    
    var uniqueid = getUniqueIDbyRowNumber(rowindex, globvar['UNIQUEID_START_VAL'], globvar['UNIQUEID_START_ROWINDEX']);

    if (tracking_sheet_columns[colindex]==='channel' && newValue!==undefined){ //handle channel edit (newValue!=undefined avoids capturing undo - i.e. Ctrl+Z - and blank cell events)

      var args = {uniqueid:uniqueid, userid:globvar['MOD_USERID']};
      var commandWrapper = new PostRequestCommand(args);
      commandWrapper.execute_superUser();
    } 
    else if (tracking_sheet_columns[colindex]==='requestStatus'){ // handle status edit
      
      if(newValue==='Re-open'){ // if "re-open", trigger the cancel function as a super-user
        var args = {uniqueid:uniqueid, userid:globvar['MOD_USERID']};
        var commandWrapper = new CancelCommand(args);
        commandWrapper.execute_superUser();
      } 
      else { // for other status changes, just log the change
        var log_sheet = new LogSheetWrapper();
        log_sheet.appendRow([new Date(), uniqueid,'admin','statusManualEdit',newValue]);
      }
    }

  }

}
