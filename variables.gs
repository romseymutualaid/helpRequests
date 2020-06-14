// All custom global variable declarations are made here.

var GlobalFuncHandle = this; // this is used to call functions by name (i.e. GlobalFuncHandle[funcName]();)

function globalVariables(){
  var globvar = {
    LOG_SHEETNAME: 'log',
    TRACKING_SHEETNAME: 'tracking',

    SLACK_APP_ID: 'A0131GHD0TS',
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
    
    // A key-value object to associate slack command strings to the command subclass that should be instantiated
    SUBCLASS_FROM_SLACKCMD: {
      undefined:VoidCommand,
      null:VoidCommand,
      '':VoidCommand,
      'shortcut_app_home':HomeShortcutCommand,
      'app_home_opened':HomeOpenedCommand,
      'button_volunteer':VolunteerCommand,
      'button_cancel':CancelCommand,
      'button_done':DoneSendModalCommand,
      'modal_done':DoneCommand,
      '/volunteer':VolunteerCommand,
      '/assign':AssignCommand,
      '/cancel':CancelCommand,
      '/done':DoneSendModalCommand,
      '/list':ListCommand,
      '/listactive':ListActiveCommand,
      '/listall':ListAllCommand,
      '/listmine':ListMineCommand,
      '/listallmine':ListAllMineCommand,
      '/_volunteer':VolunteerCommand,
      '/_assign':AssignCommand,
      '/_cancel':CancelCommand,
      '/_done':DoneSendModalCommand,
      '/_list':ListCommand,
      '/_listactive':ListActiveCommand,
      '/_listall':ListAllCommand,
      '/_listmine':ListMineCommand,
      '/_listallmine':ListAllMineCommand,
      '/jb_l':ListCommand,
      '/jb_lac':ListActiveCommand,
      '/jb_la':ListAllCommand,
      '/jb_lm':ListMineCommand,
      '/jb_lam':ListAllMineCommand,
      '/jb_v':VolunteerCommand,
      '/jb_c':CancelCommand,
      '/jb_d':DoneSendModalCommand,
      '/jb_a':AssignCommand,
      '/ib_v':VolunteerCommand,
      '/ib_c':CancelCommand,
      '/ib_d':DoneSendModalCommand
    },
    
    // Commands that are to be processed sync
    SYNC_COMMANDS: [
      'shortcut_app_home',
      'button_done',
      '/jb_d',
      '/ib_d',
      '/_done',
      '/done'
    ],
    
      // Which method should be used for delayed reponses?
//      ASYNC_METHOD:"processAsyncWithTimeTrigger", // time-based trigger
      ASYNC_METHOD:"processAsyncWithFormTrigger", // form-based trigger

    // Slack API URLs for message sending
    WEBHOOK_CHATPOSTMESSAGE: 'https://slack.com/api/chat.postMessage',
    WEBHOOK_VIEWOPEN: 'https://slack.com/api/views.open',
    WEBHOOK_VIEWUPDATE: 'https://slack.com/api/views.update',
    WEBHOOK_CHATPOSTMESSAGE_EPHEMERAL: 'https://slack.com/api/chat.postEphemeral',
    WEBHOOK_CHATUPDATE: 'https://slack.com/api/chat.update',
    WEBHOOK_VIEWPUBLISH: 'https://slack.com/api/views.publish'
  };
  return globvar;
}