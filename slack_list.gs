function list (channelid){
  ///// COMMAND: /LIST
  
  
  /// declare variables
  var globvar = globalVariables();
  var tracking_sheetname = globvar['TRACKING_SHEETNAME'];
  
  var tracking_sheet_col_order = globvar['SHEET_COL_ORDER'];
  var tracking_sheet_col_index = indexedObjectFromArray(tracking_sheet_col_order); // make associative object to easily get colindex from colname  
  
  var colindex_uniqueid = tracking_sheet_col_index['uniqueid'];
  var colindex_channelid = tracking_sheet_col_index['channelid']; 
  var colindex_status = tracking_sheet_col_index['requestStatus']; 
  var colindex_volunteerName = tracking_sheet_col_index['slackVolunteerName']; 
  var colindex_volunteerID = tracking_sheet_col_index['slackVolunteerID']; 
  var colindex_slackts = tracking_sheet_col_index['slackTS']; 
  var colindex_slacktsurl = tracking_sheet_col_index['slackURL'];
  var colindex_requestername = tracking_sheet_col_index['requesterName'];
  var colindex_address = tracking_sheet_col_index['requesterAddr'];
  var colindex_requestType =  tracking_sheet_col_index['requestType'];

  
  var message_out = 'These are the help requests in this channel still awaiting a volunteer:\n';
  
  
  // load sheet
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tracking_sheetname);
  var sheetvalues = sheet.getDataRange().getValues(); // get entire sheet's content
  
  
  // scan through rows and append relevant information to output message  
  sheetvalues.forEach(function(row) { // append...
    if ((row[colindex_status] == '' || row[colindex_status] == 'Sent') && row[colindex_channelid] == channelid) { // ... if empty status and correct channel
      message_out += '<' + row[colindex_slacktsurl] + '|Request ' + row[colindex_uniqueid] + '>   (' + row[colindex_requestername] + '   ' + row[colindex_address] + '   ' + row[colindex_requestType] + ')\n';
    }
  });
 
  return(ContentService.createTextOutput(message_out));
}

function listactive (channelid){
  ///// COMMAND: /LISTALL
    
  
  /// declare variables
  var globvar = globalVariables();
  var tracking_sheetname = globvar['TRACKING_SHEETNAME'];
  
  var tracking_sheet_col_order = globvar['SHEET_COL_ORDER'];
  var tracking_sheet_col_index = indexedObjectFromArray(tracking_sheet_col_order); // make associative object to easily get colindex from colname  
  
  var colindex_uniqueid = tracking_sheet_col_index['uniqueid'];
  var colindex_channelid = tracking_sheet_col_index['channelid']; 
  var colindex_status = tracking_sheet_col_index['requestStatus']; 
  var colindex_volunteerName = tracking_sheet_col_index['slackVolunteerName']; 
  var colindex_volunteerID = tracking_sheet_col_index['slackVolunteerID']; 
  var colindex_slackts = tracking_sheet_col_index['slackTS']; 
  var colindex_slacktsurl = tracking_sheet_col_index['slackURL'];
  var colindex_requestername = tracking_sheet_col_index['requesterName'];
  var colindex_address = tracking_sheet_col_index['requesterAddr'];
  var colindex_requestType =  tracking_sheet_col_index['requestType'];
  
  var message_out = 'These are all the active requests in this channel:\n';
  
  // load sheet
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tracking_sheetname);
  var sheetvalues = sheet.getDataRange().getValues(); // get entire sheet's content
  
  
  // scan through rows and append relevant information to output message
  sheetvalues.forEach(function(row) {
    if ((row[colindex_status] == '' || row[colindex_status] == 'Sent' || row[colindex_status] == 'Assigned' || row[colindex_status] == 'Ongoing') && row[colindex_channelid] == channelid) { // non-closed status and correct channel
      
      if (row[colindex_status] == '' || row[colindex_status] == 'Sent'){ // perform different formatting for unassigned requests (when status field is empty)
        message_out += '<' + row[colindex_slacktsurl] + '|Request ' + row[colindex_uniqueid] + '>   Unassigned   (' + row[colindex_requestername] + '   ' + row[colindex_address] + '   ' + row[colindex_requestType] + ')\n';
      } else {
        message_out += '<' + row[colindex_slacktsurl] + '|Request ' + row[colindex_uniqueid] + '>   ' + row[colindex_status] + '   <@' + row[colindex_volunteerID] + '>   (' + row[colindex_requestername] + '   ' + row[colindex_address] + '   ' + row[colindex_requestType] + ')\n';
      }
    }
  });
 
  return(ContentService.createTextOutput(message_out));
 }

function listall (channelid){ // may want to sort the output message by status in future version
  ///// COMMAND: /LISTALL
  
  
  /// declare variables
  var globvar = globalVariables();
  var tracking_sheetname = globvar['TRACKING_SHEETNAME'];
    
  var tracking_sheet_col_order = globvar['SHEET_COL_ORDER'];
  var tracking_sheet_col_index = indexedObjectFromArray(tracking_sheet_col_order); // make associative object to easily get colindex from colname  
  
  var colindex_uniqueid = tracking_sheet_col_index['uniqueid'];
  var colindex_channelid = tracking_sheet_col_index['channelid']; 
  var colindex_status = tracking_sheet_col_index['requestStatus']; 
  var colindex_volunteerName = tracking_sheet_col_index['slackVolunteerName']; 
  var colindex_volunteerID = tracking_sheet_col_index['slackVolunteerID']; 
  var colindex_slackts = tracking_sheet_col_index['slackTS']; 
  var colindex_slacktsurl = tracking_sheet_col_index['slackURL'];
  var colindex_requestername = tracking_sheet_col_index['requesterName'];
  var colindex_address = tracking_sheet_col_index['requesterAddr'];
  var colindex_requestType =  tracking_sheet_col_index['requestType'];
  
  var message_out = 'These are all the requests that were posted in this channel:\n';
  
  
  // load sheet
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tracking_sheetname);
  var sheetvalues = sheet.getDataRange().getValues(); // get entire sheet's content
  
  
  // scan through rows and append relevant information to output message
  sheetvalues.forEach(function(row) {
    if (row[colindex_channelid] == channelid) { // correct channel 
      
      if (row[colindex_status] == '' || row[colindex_status] == 'Sent'){ // perform different formatting for unassigned requests (when status field is empty)
        message_out += '<' + row[colindex_slacktsurl] + '|Request ' + row[colindex_uniqueid] + '>   Unassigned   (' + row[colindex_requestername] + '   ' + row[colindex_address] + '   ' + row[colindex_requestType] + ')\n';
      } else {
        message_out += '<' + row[colindex_slacktsurl] + '|Request ' + row[colindex_uniqueid] + '>   ' + row[colindex_status] + '   <@' + row[colindex_volunteerID] + '>   (' + row[colindex_requestername] + '   ' + row[colindex_address] + '   ' + row[colindex_requestType] + ')\n';
      }
    }
  });
 
  return(ContentService.createTextOutput(message_out));
}


function listmine (channelid, userid){
  ///// COMMAND: /LISTMINE
  
  /// declare variables
  var globvar = globalVariables();
  var tracking_sheetname = globvar['TRACKING_SHEETNAME'];
   
  var tracking_sheet_col_order = globvar['SHEET_COL_ORDER'];
  var tracking_sheet_col_index = indexedObjectFromArray(tracking_sheet_col_order); // make associative object to easily get colindex from colname  
  
  var colindex_uniqueid = tracking_sheet_col_index['uniqueid'];
  var colindex_channelid = tracking_sheet_col_index['channelid']; 
  var colindex_status = tracking_sheet_col_index['requestStatus']; 
  var colindex_volunteerName = tracking_sheet_col_index['slackVolunteerName']; 
  var colindex_volunteerID = tracking_sheet_col_index['slackVolunteerID']; 
  var colindex_slackts = tracking_sheet_col_index['slackTS']; 
  var colindex_slacktsurl = tracking_sheet_col_index['slackURL'];
  var colindex_requestername = tracking_sheet_col_index['requesterName'];
  var colindex_address = tracking_sheet_col_index['requesterAddr'];
  var colindex_requestType =  tracking_sheet_col_index['requestType'];
  
  var message_out = 'These are the ongoing help requests you volunteered for in this channel:\n';
  
  // load sheet
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tracking_sheetname);
  var sheetvalues = sheet.getDataRange().getValues(); // get entire sheet's content
  
  
  // scan through rows and append relevant information to output message
  sheetvalues.forEach(function(row) {
    if ((row[colindex_status] == '' || row[colindex_status] == 'Sent' || row[colindex_status] == 'Assigned' || row[colindex_status] == 'Ongoing') && row[colindex_channelid] == channelid && row[colindex_volunteerID] == userid) { // non-closed status, correct channel and user
      message_out += '<' + row[colindex_slacktsurl] + '|Request ' + row[colindex_uniqueid] + '>   (' + row[colindex_requestername] + '   ' + row[colindex_address] + '   ' + row[colindex_requestType] + ')\n';
    }
  });
 
  return(ContentService.createTextOutput(message_out));
}


function listallmine (channelid, userid){
  ///// COMMAND: /LISTMINE
  
  /// declare variables
  var globvar = globalVariables();
  var tracking_sheetname = globvar['TRACKING_SHEETNAME'];
   
  var tracking_sheet_col_order = globvar['SHEET_COL_ORDER'];
  var tracking_sheet_col_index = indexedObjectFromArray(tracking_sheet_col_order); // make associative object to easily get colindex from colname  
  
  var colindex_uniqueid = tracking_sheet_col_index['uniqueid'];
  var colindex_channelid = tracking_sheet_col_index['channelid']; 
  var colindex_status = tracking_sheet_col_index['requestStatus']; 
  var colindex_volunteerName = tracking_sheet_col_index['slackVolunteerName']; 
  var colindex_volunteerID = tracking_sheet_col_index['slackVolunteerID']; 
  var colindex_slackts = tracking_sheet_col_index['slackTS']; 
  var colindex_slacktsurl = tracking_sheet_col_index['slackURL'];
  var colindex_requestername = tracking_sheet_col_index['requesterName'];
  var colindex_address = tracking_sheet_col_index['requesterAddr'];
  var colindex_requestType =  tracking_sheet_col_index['requestType'];
  
  var message_out = 'These are all the help requests (ongoing and closed) you volunteered for in this channel:\n';
  
  // load sheet
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tracking_sheetname);
  var sheetvalues = sheet.getDataRange().getValues(); // get entire sheet's content
  
  
  // scan through rows and append relevant information to output message
  sheetvalues.forEach(function(row) {
    if (row[colindex_channelid] == channelid && row[colindex_volunteerID] == userid) { // correct channel and user
      message_out += '<' + row[colindex_slacktsurl] + '|Request ' + row[colindex_uniqueid] + '>   ' + row[colindex_status] + '   (' + row[colindex_requestername] + '   ' + row[colindex_address] + '   ' + row[colindex_requestType] + ')\n';
    }
  });
 
  return(ContentService.createTextOutput(message_out));
}