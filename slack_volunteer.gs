function volunteer (uniqueid, channelid, userid, username){
  ///// COMMAND: /VOLUNTEER
  
  
  /// declare variables
  var globvar = globalVariables();
  
  var mention_requestCoord = globvar['MENTION_REQUESTCOORD'];
  
  var log_sheetname = globvar['LOG_SHEETNAME'];
  var tracking_sheetname = globvar['TRACKING_SHEETNAME'];
  
  var webhook_chatPostMessage = globvar['WEBHOOK_CHATPOSTMESSAGE'];
  var access_token = PropertiesService.getScriptProperties().getProperty('ACCESS_TOKEN'); // confidential Slack API access token
    
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
  
  
  
  // check that request uniqueid has been specified
  if (uniqueid == ''){
    return ContentService.createTextOutput('error: You must provide the request number present in the help request message (example: `/volunteer 9999`). '+
                                           'You appear to have not typed any number. If the issue persists, contact ' + mention_requestCoord + '.');
  }
  
  // check that uniqueid does indeed match a 4-digit string
  if (!checkUniqueID(uniqueid)){
    return ContentService.createTextOutput('error: The request number `'+uniqueid+'` does not appear to be a 4-digit number as expected. '+
                                           'Please specify a correct request number. Example: `/volunteer 1000`.');
  }
  
  // load sheet
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(tracking_sheetname);
  
  // find requested row in sheet
  var row = getRowByUniqueID(uniqueid, UNIQUEID_START_VAL, UNIQUEID_START_ROWINDEX);
  var rowvalues = sheet.getRange(row, 1, 1, tracking_sheet_ncol).getValues()[0];
  if (rowvalues[colindex_uniqueid] != uniqueid){
    if (rowvalues[colindex_uniqueid] == ''){ // uniqueid points to empty row --> suggests wrong number was entered
      return ContentService.createTextOutput('error: I couldn\'t find the request number `' + uniqueid + '`. Did you type the right number? '+
                                             'Type `/list` to list all the available requests in this channel. If the issue persists, contact ' + mention_requestCoord + '.');
    } else { // uniqueid points to non-empty row but mismatch --> this is a spreadsheet issue. suggests rows are not sorted by uniqueid.
    return ContentService.createTextOutput('error: Request number lookup failed on server end. Please notify ' + mention_requestCoord);
    }
  }
  
  // store fields as separate variables
  var channelid_true = rowvalues[colindex_channelid]; 
  var requesterName = rowvalues[colindex_requestername];
  var address = rowvalues[colindex_address];
  var slackurl = rowvalues[colindex_slacktsurl];
  var status = rowvalues[colindex_status]; 
  var volunteerID = rowvalues[colindex_volunteerID];
  var slack_ts = rowvalues[colindex_slackts];
  var contactDetails = rowvalues[colindex_phone];   // private data
  
    
  // check that request belongs to the channel from which /volunteer message was sent  
  if (channelid != channelid_true) {
    return ContentService.createTextOutput('error: The request ' + uniqueid + ' does not appear to belong to the channel you are writing from. '+
                                           'Type `/list` to list all the available requests in this channel. If the issue persists, contact ' + mention_requestCoord + '.');
  }
   
  // manage scenario where request is no longer available (status is not {"" or "Sent"} or volunteerID!='') 
  if ((status != "" && status != "Sent") || volunteerID != "") {
    if (status == "Closed"){
      return ContentService.createTextOutput('error: <' + slackurl + '|Request ' + uniqueid + '> (' + requesterName + ', ' + address + ') is closed. '+
                                             'The volunteer assigned was <@' + volunteerID + '>. Type `/list` to list all the available requests in this channel. '+
                                             'If you think there is a mistake, contact ' + mention_requestCoord + '.');
    }
    else if ((status == "Assigned" || status == "Ongoing") && volunteerID == userid){
      return ContentService.createTextOutput(':nerd_face: You are still signed up for <' + slackurl + '|request ' + uniqueid + '> (' + requesterName + ', ' + address + '). '+
                                             'The Requester\'s contact details are ' + contactDetails + ':tada:.\nWhen you are done, type `/done ' + uniqueid + '`.\n'+
                                             'To cancel your help offer, type `/cancel '+ uniqueid + '`.\nTo see this message again, type `/volunteer ' + uniqueid + '`.\n'+
                                             'If you need any help, contact ' + mention_requestCoord + '.');
    } else {
      return ContentService.createTextOutput('Sorry, <' + slackurl + '|request ' + uniqueid + '> (' + requesterName + ', ' + address + ') is not available. Its status is ' + status + '. '+
                                             'Volunteer is <@' + volunteerID + '>. Type `/list` to list all the available requests in this channel. '+
                                             'If you think there is a mistake, contact ' + mention_requestCoord + '.');
    }
  }
    
  
  // reply to slack thread to confirm volunteer sign-up (chat.postMessage method)
  var out_message = '<@' + userid + '> has volunteered. :tada:';
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
    sheet_log.getRange(row_log+1,1,1,5).setValues([[new Date(), uniqueid,'admin','confirmVolunteer',return_message]]);
    
    // return error to user
    return ContentService.createTextOutput('error: Due to a technical incident, I was unable to process your command. Can you please ask ' + mention_requestCoord + ' to sign you up manually?');
  }
  
  // write userid, username and status to sheet
  sheet.getRange(row, colindex_volunteerID+1).setValue(userid);
  sheet.getRange(row, colindex_volunteerName+1).setValue(username);
  sheet.getRange(row, colindex_status+1).setValue('Assigned');
  
  // update log sheet
  var sheet_log = spreadsheet.getSheetByName(log_sheetname);
  var row_log = sheet_log.getLastRow();
  sheet_log.getRange(row_log+1,1,2,5).setValues([[new Date(), uniqueid,userid,'slackCommand','volunteer'],
                                                 [new Date(), uniqueid,'admin','confirmVolunteer',return_message]]);
    

  return ContentService.createTextOutput(':nerd_face: Thank you for volunteering! You signed up for <' + slackurl + '|request ' + uniqueid + '> (' + requesterName + ', ' + address + '). '+
                                         'The Requester\'s contact details are ' + contactDetails + ':tada:.\nWhen you are done, type `/done ' + uniqueid + '`.\n'+
                                         'To cancel your help offer, type `/cancel '+ uniqueid + '`.\nTo see this message again, type `/volunteer ' + uniqueid + '`.\n'+
                                         'If you need any help, contact ' + mention_requestCoord + '.');
}


function volunteer2 (uniqueid, channelid, userid, username){
  var t0= Date.now();
  ///// COMMAND: /VOLUNTEER
  
  
  /// declare variables
  var globvar = globalVariables();
  var mention_requestCoord = globvar['MENTION_REQUESTCOORD'];
  
  var log_sheetname = globvar['LOG_SHEETNAME'];
  var tracking_sheetname = globvar['TRACKING_SHEETNAME'];
  
  var webhook_chatPostMessage = globvar['WEBHOOK_CHATPOSTMESSAGE'];
//  var access_token = globvar['ACCESS_TOKEN']; // confidential Slack API authentication token
  var scriptProperties = PropertiesService.getScriptProperties();
  var access_token = scriptProperties.getProperty('ACCESS_TOKEN'); // confidential Slack API access token
  
  var tracking_sheet_col_order = globvar['SHEET_COL_ORDER'];
  var tracking_sheet_ncol = tracking_sheet_col_order.length;
  var tracking_sheet_col_index = indexedObjectFromArray(tracking_sheet_col_order); // make associative object to easily get colindex from colname  
    
  var UNIQUEID_START_VAL = globvar['UNIQUEID_START_VAL'];
  var UNIQUEID_START_ROWINDEX = globvar['UNIQUEID_START_ROWINDEX'];
  
//  var colindex_uniqueid = 1; // uniqueid column index
//  var colindex_channelid = 19; // channel_id column index
//  var colindex_phone = 4; // contactDetails column index
//  var colindex_status = 14; // status column index
//  var colindex_volunteerName = 18; // volunteerName column index
//  var colindex_volunteerID = 20; // slack user_id column index
//  var colindex_slackts = 16; // slack_ts column index
//  var colindex_slacktsurl = 15;
//  var colindex_channel = 10; // channel column index
//  var colindex_requestername = 3;
//  var colindex_address = 5;
  
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
  
  var t1= Date.now();  
  
  // check that request uniqueid has been specified
  if (uniqueid == ''){
    return ContentService.createTextOutput('error: You must provide the request number present in the help request message (example: `/volunteer 9999`). '+
                                           'You appear to have not typed any number. If the issue persists, contact ' + mention_requestCoord + '.');
  }
  
  // check that uniqueid does indeed match a 4-digit string
  if (!checkUniqueID(uniqueid)){
    return ContentService.createTextOutput('error: The request number `'+uniqueid+'` does not appear to be a 4-digit number as expected. '+
                                           'Please specify a correct request number. Example: `/volunteer 1000`.');
  }  
  
  // find requested row in sheet
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(tracking_sheetname);
//  var sheetrange = sheet.getDataRange();
  var t2= Date.now();
//  var sheetvalues = sheetrange.getValues(); // get entire sheet's content
//  var row = getRowByColVal(sheetvalues,colindex_uniqueid,uniqueid);
//  if (row == undefined){
//     return ContentService.createTextOutput('error: I couldn\'t find the request number `' + uniqueid + '`. Did you type the right number?'+
//  ' Type `/list` to list all the available requests in this channel. If the issue persists, contact ' + mention_requestCoord + '.');
//  }
  var row = getRowByUniqueID(uniqueid, UNIQUEID_START_VAL, UNIQUEID_START_ROWINDEX);
//  var row = +uniqueid - 1000 +2;
  var rowvalues = sheet.getRange(row, 1, 1, tracking_sheet_ncol).getValues()[0];
  if (rowvalues[colindex_uniqueid] != uniqueid){
    return ContentService.createTextOutput(row +' '+ rowvalues[colindex_uniqueid] + ' error: Request number lookup failed on server end. Please notify ' + mention_requestCoord);
  }
  var t3= Date.now();  
  
  var channelid_true = rowvalues[colindex_channelid]; 
  var requesterName = rowvalues[colindex_requestername];
  var address = rowvalues[colindex_address];
  var slackurl = rowvalues[colindex_slacktsurl];
  var status = rowvalues[colindex_status]; 
  var volunteerID = rowvalues[colindex_volunteerID];
  var slack_ts = rowvalues[colindex_slackts];
  // get sheet private data
  var contactDetails = rowvalues[colindex_phone]; 
  
  
//  var channelid_true = sheetvalues[row][colindex_channelid-1]; 
//  var requesterName = sheetvalues[row][colindex_requestername-1];
//  var address = sheetvalues[row][colindex_address-1];
//  var slackurl = sheetvalues[row][colindex_slacktsurl-1];
//  var status = sheetvalues[row][colindex_status-1]; 
//  var volunteerID = sheetvalues[row][colindex_volunteerID-1];
//  // get sheet private data
//  var contactDetails = sheetvalues[row][colindex_phone-1];
//  var slack_ts = sheetvalues[row][colindex_slackts-1]; 
  
  
  // check that request belongs to the channel from which /volunteer message was sent   
  if (channelid != channelid_true) {
    return ContentService.createTextOutput('error: The request ' + uniqueid + ' does not appear to belong to the channel you are writing from. '+
                                           'Type `/list` to list all the available requests in this channel. If the issue persists, contact ' + mention_requestCoord + '.');
  }
    
  // manage scenario where request is no longer available (status=='Assigned'/'Ongoing'/'Closed' or volunteerID!='') 
  if (status == "Assigned" || status == "Ongoing" || status == "Closed" || volunteerID != "") {
    if (status == "Closed"){
      return ContentService.createTextOutput('error: <' + slackurl + '|Request ' + uniqueid + '> (' + requesterName + ', ' + address + ') is closed. '+
                                             'The volunteer assigned was <@' + volunteerID + '>. Type `/list` to list all the available requests in this channel. '+
                                             'If you think there is a mistake, contact ' + mention_requestCoord + '.');
    }
    if (status != "Closed" && volunteerID == userid){
      return ContentService.createTextOutput(':nerd_face: You are still signed up for <' + slackurl + '|request ' + uniqueid + '> (' + requesterName + ', ' + address + '). '+
                                             'The Requester\'s contact details are ' + contactDetails + ':tada:.\nWhen you are done, type `/done ' + uniqueid + '`.\n'+
                                             'To cancel your help offer, type `/cancel '+ uniqueid + '`.\nTo see this message again, type `/volunteer ' + uniqueid + '`.\n'+
                                             'If you need any help, contact ' + mention_requestCoord + '.');
    } else {
      return ContentService.createTextOutput('Sorry, <' + slackurl + '|request ' + uniqueid + '> (' + requesterName + ', ' + address + ') is not available. '+
                                             'Its status is ' + status + '. Volunteer is <@' + volunteerID + '>. Type `/list` to list all the available requests in this channel. '+
                                             'If you think there is a mistake, contact ' + mention_requestCoord + '.');
    }
  }
  
  var t3rep= Date.now(); 
  // reply to slack thread to confirm volunteer sign-up (chat.postMessage method)
  var formPostURL = 'https://docs.google.com/forms/u/0/d/e/1FAIpQLSd9f2_Lc7WU963MNfESLF9a4fqVqws2oK4na8XZiGHo0m3Nzg/formResponse';
  var out_message = '<@' + userid + '> has volunteered. :tada:';
  var options = {
      method: "post",
      contentType: 'application/json; charset=utf-8',
      headers: {Authorization: 'Bearer ' + access_token},
      payload: JSON.stringify({text: out_message,
                               thread_ts: slack_ts,
                               channel: channelid})
    };
//  var return_message = UrlFetchApp.fetch(formPostURL, {method:'POST', payload: {
//    "entry.845282379": uniqueid,
//    "entry.1813938681": JSON.stringify(options)}}).getContentText(); // queue to form
  var return_message = UrlFetchApp.fetch(webhook_chatPostMessage, options);
  
  
  
  var t4= Date.now();
  
  // write userid, username and status to sheet
//  sheet.getRange(row+1, colindex_volunteerID).setValue(userid);
//  sheet.getRange(row+1, colindex_volunteerName).setValue(username);
//  sheet.getRange(row+1, colindex_status).setValue('Assigned');
  sheet.getRange(row, colindex_volunteerID+1).setValue(userid);
  sheet.getRange(row, colindex_volunteerName+1).setValue(username);
  sheet.getRange(row, colindex_status+1).setValue('Assigned');
  var t4bis=Date.now();
  // update log sheet
  var sheet_log = spreadsheet.getSheetByName(log_sheetname);
  var row_log = sheet_log.getLastRow();
  sheet_log.getRange(row_log+1,1,1,5).setValues([[new Date(), uniqueid,userid,'slackCommand','volunteer']]);
  sheet_log.getRange(row_log+2,1,1,5).setValues([[new Date(), uniqueid,'admin','confirmVolunteerQueue',return_message]]);
  var t5= Date.now(); 

  return ContentService.createTextOutput(t0+' ' +t2+' ' +t3+' ' +t4+' ' +t4bis+' ' +t5 +':nerd_face: Thank you for volunteering! '+
                                         'You signed up for <' + slackurl + '|request ' + uniqueid + '> (' + requesterName + ', ' + address + '). '+
                                         'The Requester\'s contact details are ' + contactDetails + ':tada:.\nWhen you are done, type `/done ' + uniqueid + '`.\n'+
                                         'To cancel your help offer, type `/cancel '+ uniqueid + '`.\nTo see this message again, type `/volunteer ' + uniqueid + '`.\n'+
                                         'If you need any help, contact ' + mention_requestCoord + '.');
}
