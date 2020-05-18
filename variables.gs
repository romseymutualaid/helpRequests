//// all global variable declarations are made here

var GlobalFuncHandle = this; // this is used to call functions by name (i.e. GlobalFuncHandle[funcName]();)

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

    // Tracking sheet column order. ie: first element is col 'A', second is col 'B', ...
    // The strings need not match the actual sheet's header strings. They must match the strings called in the script functions.
    SHEET_COL_ORDER: [
      "uniqueid",
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
      "nextDateNeeded"],

    // A list of columns that can be updated via this script.
    // This is to prevent accidental overwritting of sheet columns.
    MACHINE_WRITABLE_COLS: [
      "requestStatus",
      "slackTS",
      "slackVolunteerName",
      "slackVolunteerID",
      "completionCount",
      "completionLastTimestamp",
      "completionLastDetails"],

    // A key-value object to associate slack command strings to the internal function name they should call
    SLACKCMD_TO_FUNCTIONNAME: {
      'done_modal':'done',
      '/_volunteer':'volunteer',
//      '/_volunteer2':'volunteer_debug',
      '/_assign':'assign',
      '/_cancel':'cancel',
      '/_done':'done_send_modal',
      '/_list':'list',
      '/_listactive':'listactive',
      '/_listall':'listall',
      '/_listmine':'listmine',
      '/_listallmine':'listallmine',
      '/jb_l':'list',
      '/jb_v':'volunteer',
      '/jb_c':'cancel',
      '/jb_d':'done_send_modal',
      '/jb_a':'assign',
      '/ib_v':'volunteer',
      '/ib_c':'cancel',
      '/ib_d':'done_send_modal'
    },

    // Functions that are to be processed async
    ASYNC_FUNCTIONS: [
      'volunteer',
      'assign',
      'cancel',
      'list',
      'list_active',
      'listall',
      'listmine',
      'listallmine',
      //'done_send_modal',
      'done'
    ],
    
    // Information required to make POST requests to the event form used for async responses, and handle the events it triggers
    EVENT_FORM: {
      url:'https://docs.google.com/forms/u/0/d/e/1FAIpQLSdGMwONXZ-4BOWPUGvFpu47IenfKhDIpksV-g9YSm771GiGXg/formResponse',
      entry_id:{
        fctName:'entry.1743825050',
        args:'entry.748121704'
      },
      values:["timestamp","function","args"] // structure of the event.values object sent to the onFormSubmit function
    },

      // Which method should be used for delayed reponses?
//      ASYNC_METHOD:"processFunctionAsyncWithTrigger", // time-based trigger
      ASYNC_METHOD:"processAsyncWithFormTrigger", // form-based trigger

    WEBHOOK_CHATPOSTMESSAGE: 'https://slack.com/api/chat.postMessage',
    WEBHOOK_CHATPOSTMESSAGE_EPHEMERAL: 'https://slack.com/api/chat.postEphemeral',
  };
  return globvar;
}