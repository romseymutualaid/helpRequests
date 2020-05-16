function cancel(args){
  ///// COMMAND: /CANCEL
  var {uniqueid, channelid, userid} = args;

  /// declare variables
  var globvar = globalVariables();

  var mention_requestCoord = globvar['MENTION_REQUESTCOORD'];

  var tracking_sheet = new TrackingSheetWrapper();
  var log_sheet = new LogSheetWrapper();

  var webhook_chatPostMessage = globvar['WEBHOOK_CHATPOSTMESSAGE'];

  // find requested row in sheet
  var row = tracking_sheet.getRowByUniqueID(uniqueid);

  // check command validity
  var cmd_check = checkCommandValidity('cancel',row,uniqueid,userid,channelid);
  if (!cmd_check.code){ // if command check returns error status, halt function and return error message to user
    return cmd_check.msg;
  }


  // reply to slack thread to confirm volunteer sign-up (chat.postMessage method)
  var out_message = `<!channel> <@${row.slackVolunteerID}> is no longer available. Can anyone else volunteer? Type \`/volunteer ${uniqueid} \``;
  var payload = JSON.stringify({
    text: out_message,
    thread_ts: row.slackTS,
    reply_broadcast: true,
    channel: row.channelid});

  var return_message = postToSlack(payload, webhook_chatPostMessage);

  // if post request was unsuccesful, do not update tracking sheet and log error
  var return_params = JSON.parse(return_message);
  if (return_params.ok !== true){ // message was not successfully posted to channel
    // update log sheet
    log_sheet.appendRow([new Date(), row.uniqueid, 'admin','confirmCancel', return_message]);

    // return error to user
    return textToJsonBlocks(
`error: Due to a technical incident, I was unable to process your command.
Can you please ask ${mention_requestCoord} to remove you manually?`);
  }

  // write userid, username and status to sheet
  row.slackVolunteerID = '';
  row.slackVolunteerName = '';
  row.requestStatus = "Sent";
  tracking_sheet.writeRow(row);

  // update log sheet
  log_sheet.appendRow([new Date(), row.uniqueid,'admin','slackCommand','cancel']);
  log_sheet.appendRow([new Date(), row.uniqueid, 'admin','confirmCancel', return_message]);

  // reply privately to user
  return cmd_check.msg;

}



function cancel_su(rowindex){
  ///// COMMAND: /CANCEL_SU: cancel function as super-user (without the validity checks). This is used to cancel a request when its status is changed to "re-open" in the spreadsheet.


  /// define variables
  var globvar = globalVariables();
  var mod_userid = globvar['MOD_USERID'];
  var mention_requestCoord = globvar['MENTION_REQUESTCOORD'];

  var webhook_chatPostMessage = globvar['WEBHOOK_CHATPOSTMESSAGE'];
  var access_token = PropertiesService.getScriptProperties().getProperty('ACCESS_TOKEN'); // confidential Slack API authentication token

  var tracking_sheet = new TrackingSheetWrapper();
  var log_sheet = new LogSheetWrapper();


  // find requested row in sheet
  var row = tracking_sheet.getRowByRowNumber(rowindex);


  // reply to slack thread to confirm cancel (chat.postMessage method)
  var out_message = '<!channel> <@' + row.slackVolunteerID + '> is no longer available. Can anyone else volunteer? Type `/volunteer ' + row.uniqueid + '`.';
  var payload = JSON.stringify({
    text: out_message,
    thread_ts: row.slackTS,
    reply_broadcast: true,
    channel: row.channelid});

  var return_message = postToSlack(payload, webhook_chatPostMessage);

  // if post request was unsuccesful, do not update tracking sheet and log error
  var return_params = JSON.parse(return_message);
  if (return_params.ok !== true){ // message was not successfully posted to channel

    // update log sheet
    log_sheet.appendRow(
      [new Date(), row.uniqueid,'admin','confirmCancel',return_message]);

    // return error to user
    return textToJsonBlocks(
      `error: Due to a technical incident, I was unable to process your command.
      Can you please ask ${mention_requestCoord} to remove you manually?`);
  }

  // write userid, username and status to sheet
  row.slackVolunteerID = '';
  row.slackVolunteerName = '';
  row.requestStatus = "Sent";
  tracking_sheet.writeRow(row);

  // update log sheet
  log_sheet.appendRow([new Date(), row.uniqueid,'admin','slackCommand','cancel']);
  log_sheet.appendRow([new Date(), row.uniqueid, 'admin','confirmCancel', return_message]);

  var request_formatted = requestFormatted(
    row.slackURL, uniqueid, row.requesterName, row.requesterAddr);

  return textToJsonBlocks(
    `You just cancelled your offer for help for ${request_formatted}
    I've notified the channel in the help request thread.`);

}
