//// all global variable declarations are made here

function globalVariables(){
  var globvar = {
    LOG_SHEETNAME: 'log',    
    TRACKING_SHEETNAME: 'tracking',
    
    TEAM_ID: 'T0103NU4UVA',
    MENTION_REQUESTCOORD: '<@U0108S6B96X>',
    MOD_USERID: 'U0108S6B96X',
    
    FORMINDEX_CHANNEL: 8, // index of channel question in form submission json packet
    SHEET_ROW_OFFSET: 0, // *relative* row offset of trigger sheet compared to form response sheet: rowIndex_triggerSheet = rowIndex_responseSheet + SHEET_ROW_OFFSET. This is used to find the right row in trigger sheet when a new form submission occurs.
    UNIQUEID_START_VAL: 1000, // value of first uniqueid
    UNIQUEID_START_ROWINDEX: 2, // row index of first uniqueid in tracking sheet. Used for quick row lookup based on uniqueid value.
    SHEET_COL_ORDER: ["uniqueid",
                      "timestamp",
                      "requesterName",
                      "requesterContact",
                      "requesterAddr",
                      "householdSit",
                      "requestType",
                      "requestDate",
                      "requestInfo",
                      "channel",
                      "requesterGeneralNeeds",
                      "coordinatorName",
                      "commentsForSlack",
                      "requestStatus",
                      "slackURL",
                      "slackTS",
                      "commentsForCoordinator",
                      "slackVolunteerName",
                      "channelid",
                      "slackVolunteerID",
                     "completionCount",
                     "completionLastTimestamp",
                     "completionLastDetails",
                     "nextDateNeeded"], // tracking sheet column order. ie: first element is col 'A', second is col 'B', ... 
//    The strings need not match the actual sheet's header strings. They must match the strings called in the script functions.
    
    WEBHOOK_CHATPOSTMESSAGE: 'https://slack.com/api/chat.postMessage'
  };
  return globvar;
}