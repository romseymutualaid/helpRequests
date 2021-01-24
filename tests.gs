function gast() {
  if ((typeof GasTap)==='undefined') { // GasT Initialization.
    eval(UrlFetchApp.fetch(
      'https://raw.githubusercontent.com/huan/gast/master/src/gas-tap-lib.js'
    ).getContentText())
  } // Class GasTap is ready for use now!
  
  var test = new GasTap();
  
  gast_test_positive_controls(test);
  gast_test_doPost(test);
  gast_test_slackEventAdapters(test);
  gast_test_slackEvent(test);
//  gast_test_sheetEventAdapters(test);
  gast_test_sheetEvent(test);
  gast_test_commands(test);
  
  test.finish()
}

var try_return = function(func, ...args) {
  try {
    return func(...args);
  }
  catch(errObj) {
    return errObj.message;
  }
}

var try_constructor_return = function(className, ...args) {
  try {
    return new className(...args);
  }
  catch(errObj) {
    return errObj.message;
  }
}

var try_method_return = function(className, methodName, ...args) {
  try {
    return className[methodName](...args);
  }
  catch(errObj) {
    return errObj.message;
  }
}

var mock_slack_slashCmd_event = function(cmd="/volunteer", txt="0000",
                                         userid=globalVariables()["MOD_USERID"]) {
  return {parameter: {
    token: PropertiesService.getScriptProperties().getProperty('VERIFICATION_TOKEN'),
    api_app_id: "",
    team_id: globalVariables()['TEAM_ID'],
    team_domain: "",
    channel_id: "",
    channel_name: "",
    user_id: userid,
    user_name: "",
    response_url: "",
    trigger_id: "",
    command: cmd,
    text: txt
  }};
}

var mock_slack_modalSubmit_event = function(id="modal_done") {
  return {parameter: {
    payload: JSON.stringify({
      token: PropertiesService.getScriptProperties().getProperty('VERIFICATION_TOKEN'),
      team: {id: globalVariables()['TEAM_ID']},
      user: {id: ""},
      type: "view_submission",
      view: {
        callback_id: id,
        private_metadata: JSON.stringify({
          channelid: "", uniqueid: "0000", response_url: ""
        }),
        state: {
          values: {
            requestNextStatus: {requestNextStatusVal: {selected_option: {value: ""}}}
          }
        }
      }
    })
  }};
}

var mock_slack_shortcut_event = function(id="shortcut_app_home") {
  // see https://api.slack.com/reference/interaction-payloads/shortcuts#message_actions
  return {parameter: {
    payload: JSON.stringify({
      token: PropertiesService.getScriptProperties().getProperty('VERIFICATION_TOKEN'),
      team: {id: globalVariables()['TEAM_ID']},
      user: {id: ""},
      type: "shortcut",
      callback_id: id,
      trigger_id: ""
    })
  }};
}

var mock_slack_urlVerification_event = function() {
  // see https://api.slack.com/events/url_verification
  return {
    parameter: {},
    postData: {
      contents: JSON.stringify({
        token: PropertiesService.getScriptProperties().getProperty('VERIFICATION_TOKEN'),
        type: "url_verification",
        challenge: ""
      })
    }
  };
}

var mock_slack_homeOpened_event = function() {
  // see https://api.slack.com/events/app_home_opened
  return mock_slack_api_event({
    type: "app_home_opened",
    event_ts: "",
    ts: "",
    user: "",
    tab: "home",
    view: {},
  });
}

var mock_slack_api_event = function(event_obj) {
  // see https://api.slack.com/events-api#begin
  return {
    parameter: {},
    postData: {
      contents: JSON.stringify({
        token: PropertiesService.getScriptProperties().getProperty('VERIFICATION_TOKEN'),
        api_app_id: "",
        team_id: globalVariables()['TEAM_ID'],
        type: "event_callback",
        event: event_obj,
        event_id: "",
        event_time: 0123,
        authorizations: [{}]
      })
    }
  };
}

var mock_slack_button_event = function(id, value) {
  // see https://api.slack.com/reference/interaction-payloads/block-actions
  // https://api.slack.com/legacy/message-buttons
  return {parameter: {
    payload: JSON.stringify({
      token: PropertiesService.getScriptProperties().getProperty('VERIFICATION_TOKEN'),
      team: {id: globalVariables()['TEAM_ID']},
      channel: {id: ""},
      user: {id: "", name: ""},
      type: "block_actions",
      message: {},
      view: {},
      actions: [
        {block_id: "", action_id: id, value: value}
      ],
      trigger_id: "",
      response_url: ""
    })
  }};
}


function gast_test_positive_controls(test) {
  test('do calculation right', function (t) {
    var i = 3 + 4
    t.equal(i, 7, 'calc 3 + 4 = 7 right')
  })
  
  test('Spreadsheet exist', function (t) {
    var url = 'https://docs.google.com/spreadsheets/d/1_KRAtoDz2Pdcj9IPZI007I_gMzRyfmXf7gicgxVwYJc/edit#gid=0'
    var ss = SpreadsheetApp.openByUrl(url)
    t.ok(ss, 'open spreadsheet successful')
  })
}

function gast_test_doPost(test) {
  test("throws if empty event", function(t) {
    var e = {parameter: {}, postData: {contents : ""}};
    t.throws(doPost(e), "test throws");
  });
  
  test("returns ack if slash cmd", function(t) {
    var e = mock_slack_slashCmd_event("/volunteer", "0000");
    t.equal(doPost(e).getContent(), commandPendingMessage(), "volunteer");
    
    e.parameter.command = "/cancel";
    t.equal(doPost(e).getContent(), commandPendingMessage(), "cancel");
    
    e.parameter.command = "/done";
    slack_invalid_triggerid_msg = "{\"ok\":false,\"error\":\"invalid_arguments\",\"response_metadata\":{\"messages\":[\"[ERROR] invalid `trigger_id` [json-pointer:\\/trigger_id]\"]}}";
    t.equal(doPost(e).getContent(),
            postToSlackDoneModalErrorMessage(slack_invalid_triggerid_msg), "done");
    
    e.parameter.command = "/list";
    t.equal(doPost(e).getContent(), commandPendingMessage(), "list");
    
    e.parameter.command = "/listactive";
    t.equal(doPost(e).getContent(), commandPendingMessage(), "listactive");
    
    e.parameter.command = "/listall";
    t.equal(doPost(e).getContent(), commandPendingMessage(), "listall");
    
    e.parameter.command = "/listmine";
    t.equal(doPost(e).getContent(), commandPendingMessage(), "listmine");
    
    e.parameter.command = "/listallmine";
    t.equal(doPost(e).getContent(), commandPendingMessage(), "listallmine");
    
    e.parameter.command = "/assign";
    e.parameter.text = "0000 <@UTESTUSER123>";
    e.parameter.user_id = globalVariables()['MOD_USERID'];
    t.equal(doPost(e).getContent(), commandPendingMessage(), "assign");
  });
  
  test("returns ack if interactive message", function(t){
    var e = mock_slack_modalSubmit_event("modal_done");
    t.equal(doPost(e).getContent(), null, "modal_done");
  });
}

function gast_test_slackEventAdapters(test) {
  test("routes /assign slash cmd", function(t) {
    var e = mock_slack_slashCmd_event("/assign", "0000 <@UTESTID>");
    t.ok(createSlackEvent(e).cmd instanceof AssignCommand, "is AssignCommand");
  });
  
  test("routes /volunteer slash cmd", function(t) {
    var e = mock_slack_slashCmd_event("/volunteer", "0000");
    t.ok(createSlackEvent(e).cmd instanceof VolunteerCommand, "is VolunteerCommand");
  });
  
  test("routes /cancel slash cmd", function(t) {
    var e = mock_slack_slashCmd_event("/cancel", "0000");
    t.ok(createSlackEvent(e).cmd instanceof CancelCommand, "is CancelCommand");
  });
  
  test("routes /done slash cmd", function(t) {
    var e = mock_slack_slashCmd_event("/done", "0000");
    t.ok(createSlackEvent(e).cmd instanceof DoneSendModalCommand, "is DoneSendModalCommand");
  });
  
  test("routes /list slash cmd", function(t) {
    var e = mock_slack_slashCmd_event("/list", "0000");
    t.ok(createSlackEvent(e).cmd instanceof ListCommand, "is ListCommand");
  });
  
  test("routes /listactive slash cmd", function(t) {
    var e = mock_slack_slashCmd_event("/listactive", "0000");
    t.ok(createSlackEvent(e).cmd instanceof ListActiveCommand, "is ListActiveCommand");
  });
  
  test("routes /listall slash cmd", function(t) {
    var e = mock_slack_slashCmd_event("/listall", "0000");
    t.ok(createSlackEvent(e).cmd instanceof ListAllCommand, "is ListAllCommand");
  });
  
  test("routes /listmine slash cmd", function(t) {
    var e = mock_slack_slashCmd_event("/listmine", "0000");
    t.ok(createSlackEvent(e).cmd instanceof ListMineCommand, "is ListMineCommand");
  });
  
  test("routes /listallmine slash cmd", function(t) {
    var e = mock_slack_slashCmd_event("/listallmine", "0000");
    t.ok(createSlackEvent(e).cmd instanceof ListAllMineCommand, "is ListAllMineCommand");
  });
  
  test("routes modal_done", function(t) {
    var e = mock_slack_modalSubmit_event("modal_done");
    t.ok(createSlackEvent(e).cmd instanceof DoneCommand, "is DoneCommand");
  });
  
  test("routes shortcut_app_home", function(t) {
    var e = mock_slack_shortcut_event("shortcut_app_home");
    t.ok(createSlackEvent(e).cmd instanceof HomeShortcutCommand, "is HomeShortcutCommand");
  });
  
  test("routes url_verification", function(t) {
    var e = mock_slack_urlVerification_event();
    t.ok(createSlackEvent(e).cmd instanceof UrlVerificationCommand, "is UrlVerificationCommand");
  });
  
  test("routes app_home_opened", function(t) {
    var e = mock_slack_homeOpened_event();
    t.ok(createSlackEvent(e).cmd instanceof HomeOpenedCommand, "is HomeOpenedCommand");
  });
  
  test("routes button_volunteer", function(t) {
    var e = mock_slack_button_event("button_volunteer", "0000");
    t.ok(createSlackEvent(e).cmd instanceof VolunteerCommand, "is VolunteerCommand");
  });
  
  test("routes button_cancel", function(t) {
    var e = mock_slack_button_event("button_cancel", "0000");
    t.ok(createSlackEvent(e).cmd instanceof CancelCommand, "is CancelCommand");
  });
  
  test("routes button_done", function(t) {
    var e = mock_slack_button_event("button_done", "0000");
    t.ok(createSlackEvent(e).cmd instanceof DoneSendModalCommand, "is DoneSendModalCommand");
  });
  
}

function gast_test_slackEvent(test) {
  var token_true = PropertiesService.getScriptProperties().getProperty(
    'VERIFICATION_TOKEN');
  
  test("throws if auth failure", function(t) {
    t.equal(
      try_constructor_return(
        SlackEventController,
        token = "incorrect_token_placeholder",
        cmd = new VoidCommand(args = {})
      ),
      slackTokenIsIncorrectMessage("incorrect_token_placeholder"),
      "incorrect token"
    );
  })
  
  test("returns void if auth success and voidcommand", function(t) {
     slackEvent = new SlackEventController(
        token = token_true,
        cmd = new VoidCommand(args = {})
      );
      t.ok(slackEvent.handle() === undefined, "");
  })
}

function gast_test_sheetEventAdapters(test) {
  // test command form submit event

  // test request form submit event
  
  // test edit tracking sheet event
}

function gast_test_sheetEvent(test) {
  test("returns void if void input", function(t) {
    sheetEvent = new SheetEventController();
    t.ok(sheetEvent.handle() === undefined, "voidcommand");
    t.ok(sheetEvent.notify(undefined) === undefined, "voidmessenger");
  })
}

function gast_test_commands(test) {
  class MockSheet {
    constructor(arr2d) {
      this.arr2d = arr2d !== undefined ? arr2d : [[]];
      this.arr2d_nrows = this.arr2d.length;
      this.arr2d_ncols = this.arr2d[0].length;
    }
    
    getDataRange() {
      return this.getRange(1, 1, this.arr2d_nrows, this.arr2d_ncols);
    }
    
    getRange(row, column, numRows=1, numColumns=1) {
      return new MockRange(this.arr2d, [row, column, numRows, numColumns]);
    }
    
    appendRow(row) {
      if (this.arr2d.length == 1 && this.arr2d[0].length == 0) {
        // empty arr
        this.arr2d[0] = row;
      } else {
        this.arr2d.push(row);
      }
    }
  }
  
  class MockRange {
    constructor(arr2d, range) {
      this.arr2d = arr2d;
      this.range = (
        range !== undefined 
        ? range : [1, 1, arr2d.length, arr2d[0].length]
      );
    }
    
    getValue() {
      var [row, column, , ] = this.range;
      if (row-1 >= this.arr2d.length) return "";
      return this.arr2d[row - 1][column - 1];
    }
    
    setValue(value) {
      var [row, column, , ] = this.range;
      this.arr2d[row - 1][column - 1] = value;
    }
    
    getValues() {
      var [row, column, numRows, numColumns] = this.range;
      if (row > this.arr2d.length) return emptyStringArray(numRows, numColumns);
      return (
        this.arr2d
        .slice(row - 1, row - 1 + numRows)
        .map(i => i.slice(column - 1, column - 1 + numColumns))
      );
    }
    
    setValues(values) {
      for (var i = 0; i < numRows; i++) {
        for (var j = 0; j < numColumns; j++) {
          this.arr2d[i + row - 1][j + column - 1] = values[i][j];
        }
      }
    }
  }
  
  class MockMessenger {
    constructor(return_par) {
      this.sent = [];
      this.returned = return_par !== undefined ? return_par : {ok: true}
    }
    
    send(msg, url, subtype) {
      this.sent.push({msg: msg, url: url, subtype: subtype});
      return JSON.stringify(this.returned);
    }
  }
  
  var mock_tracking_array = function() {
    return [
      [
        "uniqueID", "time", "name", "contact", "address", "household_sit",
        "request", "date_needed", "additional_info", "channel", "general_needs",
        "coordinator_name", "slack_comments", "status", "slack_thread_url",
        "slack_thread_ts", "coordinator_comments", "volunteer", "channel_id",
        "volunteer_id", "completion_count", "completion_last_time",
        "completion_last_details", "next_date_needed"
      ],
      [
        1000, "14/04/2020 01:19:12", "test case 10", "01223 123456", "1 stockwell st",
        "high-risk", "dog walks", "14/04/2020", "", "testsrequests-jb", "shopping",
        "jb", "", "Sent",
        "https://romseymutualaid.slack.com/archives/C012HGQEJMB/p1589019210000200",
        "1589019210.000200", "", "baye.james", "C012HGQEJMB", "UVDT8G78T", 13,
        "Sat May 23 2020 02:44:39 GMT+0100 (British Summer Time)", "", ""
      ],
      [
        1001, "14/04/2020 01:40:22", "test case 11", "07111222333", "1 argyle st",
        "covid symptoms", "parcel collection", "15/04/2020", "", "testsrequests-jb", "",
        "jb", "", "Assigned",
        "https://romseymutualaid.slack.com/archives/C012HGQEJMB/p1591654103007100",
        "1591654103.007100", "", "judefbrady", "C012HGQEJMB", "UVCNQASN6", 1,
        "10/06/2020 13:57:22", "coffee required", ""
      ],
      [
        1002, "14/04/2020 01:40:22", "test case 12", "", "9A mill rd",
        "", "delivery", "16/04/2020", "", "testsrequests-jb", "",
        "jb", "", "Assigned",
        "https://romseymutualaid.slack.com/archives/C012HGQEJMB/p1591654103007100",
        "1591654103.007101", "", "judefbrady", "C012HGQEJMB", "UVCNQASN6", 9,
        "", "", ""
      ],
    ];
  }

  test("statusLog command", function(t) {
    var cmd = new StatusLogCommand({
      uniqueid: "1000",
      userid: "test_userid",
      more: {requestStatusValue: "new_status_val"}
    });
    var msg = cmd.execute(
      new TrackingSheetWrapper(new MockSheet()),
      new LogSheetWrapper(new MockSheet())
    );
    t.deepEqual(cmd.tracking_sheet.sheet.arr2d, [[]], "no tracking sheet side-effect");
    t.deepEqual(
      cmd.log_sheet.sheet.arr2d[0].slice(1),
      ["1000", "test_userid", "command", "statusManualEdit", "new_status_val"],
      "logs new status"
    );
  })
  
  test("home shortcut command success", function(t) {
    var cmd = new HomeShortcutCommand({trigger_id: "TRIGGER_ID"});
    var messenger = new MockMessenger();   
    var message_expected = appHomeShortcutModalMessage({trigger_id: "TRIGGER_ID"});
    var return_val_expected = defaultSendModalSuccessMessage();
    var return_val = cmd.execute(undefined, undefined, messenger);
    t.equal(return_val, return_val_expected, "returns success message");
    t.equal(messenger.sent[0].msg, message_expected, "correct slack modal payload");
  })
  
  test("url verification command success", function(t) {
    var cmd = new UrlVerificationCommand({more: {challenge: "secret-challenge"}});
    t.equal(cmd.execute(), "secret-challenge", "returns challenge");
  });
  
  test("home opened command success", function(t) {
    var cmd = new HomeOpenedCommand({userid: "UVCNQASN6", more: {tab: "home"}});
    var tracking_sheet = new TrackingSheetWrapper(new MockSheet(mock_tracking_array()));
    var log_sheet = new LogSheetWrapper(new MockSheet());
    var messenger = new MockMessenger();
    var rows_expected = [
      tracking_sheet.getRowByUniqueID(1001), tracking_sheet.getRowByUniqueID(1002)];
    var message_expected = appHomeMessage({userid: "UVCNQASN6"}, rows_expected);
    cmd.execute(tracking_sheet, log_sheet, messenger);
    t.deepEqual(cmd.rows.map(x => x.uniqueid), ["1001", "1002"], "correct uniqueids");
    t.equal(messenger.sent[0].msg, message_expected, "correct slack message");
  })
  
  test("postRequest command success", function(t) {
    var cmd = new PostRequestCommand({uniqueid: "1000"});
    var tracking_sheet = new TrackingSheetWrapper(new MockSheet(mock_tracking_array()));
    var log_sheet = new LogSheetWrapper(new MockSheet());
    var messenger = new MockMessenger({ok: true, ts: "new_ts"});
    var message_expected = postRequestMessage(tracking_sheet.getRowByUniqueID(1000));
    cmd.execute(tracking_sheet, log_sheet, messenger);
    t.equal(cmd.row.uniqueid, "1000", "correct uniqueid");
    t.equal(cmd.row.requestStatus, "Sent", "status is Sent");
    t.equal(cmd.row.slackTS, "new_ts", "ts is updated");
    t.equal(cmd.log_sheet.sheet.arr2d[0][1], 1000, "logs uniqueid");
    t.equal(messenger.sent[0].msg, message_expected, "correct slack message");
    t.ok(message_expected.includes("stockwell st"), "post partial address");
    t.notOk(message_expected.includes("1 stockwell st"), "do not post full address");
  })
  
  test("postRequest command failure", function(t) {
    var cmd = new PostRequestCommand({uniqueid: "1000"});
    var tracking_sheet = new TrackingSheetWrapper(new MockSheet(mock_tracking_array()));
    var log_sheet = new LogSheetWrapper(new MockSheet());
    var messenger = new MockMessenger({ok: false});
    var message_expected = postRequestMessage(tracking_sheet.getRowByUniqueID(1000));
    cmd.execute(tracking_sheet, log_sheet, messenger);
    t.equal(cmd.row.uniqueid, "1000", "correct uniqueid");
    t.equal(cmd.row.requestStatus, "FailSend", "status is FailSend");
    t.equal(cmd.row.slackTS, "", "ts is blank");
    t.deepEqual(cmd.log_sheet.sheet.arr2d, [[]], "no log");
    t.equal(messenger.sent[0].msg, message_expected, "correct slack payload");
  })
  
  test("volunteer command failure", function(t) {
    var cmd = new VolunteerCommand({uniqueid: "9999"});
    var tracking_sheet = new TrackingSheetWrapper(new MockSheet(mock_tracking_array()));
    var log_sheet = new LogSheetWrapper(new MockSheet());
    var messenger = new MockMessenger();
    t.equal(
      try_method_return(cmd, "execute", tracking_sheet, log_sheet, messenger),
      uniqueIDdoesNotExistMessage({uniqueid: "9999"}),
      "uniqueid not found"
    );
    
    var cmd = new VolunteerCommand({uniqueid: "1000", channelid: "wrong_channel"});
    t.equal(
      try_method_return(cmd, "execute", tracking_sheet, log_sheet, messenger),
      wrongChannelMessage({uniqueid: "1000"}),
      "wrong channel"
    );    
  })
  
  test("volunteer command success", function(t) {
    var cmd = new VolunteerCommand({uniqueid: "1000", channelid: "C012HGQEJMB",
                                    userid: "USERID", username: "USERNAME"});
    var tracking_sheet = new TrackingSheetWrapper(new MockSheet(mock_tracking_array()));
    var log_sheet = new LogSheetWrapper(new MockSheet());
    var messenger = new MockMessenger();
    t.equal(
      cmd.execute(tracking_sheet, log_sheet, messenger),
      volunteerSuccessMessage(cmd.row),
      "returns success message"
    );
    var messages_expected = [
      postRequestMessage(tracking_sheet.getRowByUniqueID(1000), false),
      volunteerChannelMessage(tracking_sheet.getRowByUniqueID(1000))
    ];
    t.equal(cmd.row.uniqueid, "1000", "correct uniqueid");
    t.equal(cmd.row.requestStatus, "Assigned", "status is Assigned");
    t.equal(cmd.row.slackVolunteerID, "USERID", "updates userid");
    t.equal(cmd.row.slackVolunteerName, "USERNAME", "updates username");
    t.equal(cmd.log_sheet.sheet.arr2d[0][1], 1000, "logs uniqueid");
    t.equal(messenger.sent[0].msg, messages_expected[0], "correct slack channel payload");
    t.equal(messenger.sent[1].msg, messages_expected[1], "correct slack thread payload");
  })
  
  test("cancel command success", function(t) {
    var cmd = new CancelCommand(
      {uniqueid: "1001", channelid: "C012HGQEJMB", userid: "UVCNQASN6"});
    var tracking_sheet = new TrackingSheetWrapper(new MockSheet(mock_tracking_array()));
    var log_sheet = new LogSheetWrapper(new MockSheet());
    var messenger = new MockMessenger();   
    t.equal(
      cmd.execute(tracking_sheet, log_sheet, messenger),
      cancelSuccessMessage(cmd.row, true),
      "returns success message"
    );
    var messages_expected = [
      postRequestMessage(tracking_sheet.getRowByUniqueID(1001), true),
      cancelChannelMessage(tracking_sheet.getRowByUniqueID(1001), "UVCNQASN6")
    ];
    t.equal(cmd.row.uniqueid, "1001", "correct uniqueid");
    t.equal(cmd.row.requestStatus, "Sent", "status is Sent");
    t.equal(cmd.row.slackVolunteerID, "", "removed userid");
    t.equal(cmd.row.slackVolunteerName, "", "removes username");
    t.equal(cmd.log_sheet.sheet.arr2d[0][1], 1001, "logs uniqueid");
    t.equal(messenger.sent[0].msg, messages_expected[0], "correct slack channel payload");
    t.equal(messenger.sent[1].msg, messages_expected[1], "correct slack thread payload");
  })
  
  test("done modal command success", function(t) {
    var cmd = new DoneSendModalCommand(
      {uniqueid: "1001", channelid: "C012HGQEJMB", userid: "UVCNQASN6"});
    var tracking_sheet = new TrackingSheetWrapper(new MockSheet(mock_tracking_array()));
    var log_sheet = new LogSheetWrapper(new MockSheet());
    var messenger = new MockMessenger();   
    var message_expected = doneModalMessage(
      {uniqueid: "1001", channelid: "C012HGQEJMB", userid: "UVCNQASN6"});
    var return_val_expected = doneSendModalSuccessMessage({uniqueid: "1001"});
    var return_val = cmd.execute(tracking_sheet, log_sheet, messenger);
    t.equal(return_val, return_val_expected, "returns success message");
    t.equal(messenger.sent[0].msg, message_expected, "correct slack modal payload");
  })
  
  test("done command success", function(t) {
    var cmd = new DoneCommand({
      uniqueid: "1001", channelid: "C012HGQEJMB", userid: "UVCNQASN6",
      more: {
        modalResponseValues: {
          requestNextStatus: {requestNextStatusVal: {selected_option: {value: ""}}}
        }
      }
    });
    var tracking_sheet = new TrackingSheetWrapper(new MockSheet(mock_tracking_array()));
    var log_sheet = new LogSheetWrapper(new MockSheet());
    var messenger = new MockMessenger();
    var message_expected = doneChannelMessage(tracking_sheet.getRowByUniqueID(1001));
    var return_val = cmd.execute(tracking_sheet, log_sheet, messenger);
    t.equal(return_val, doneSuccessMessage(cmd.row, true), "returns success message");
    t.equal(cmd.row.uniqueid, "1001", "correct uniqueid");
    t.equal(cmd.row.requestStatus, "ToClose?", "status is ToClose?");
    t.equal(cmd.row.completionCount, "2", "increments completion count");
    t.equal(cmd.log_sheet.sheet.arr2d[0][1], 1001, "logs uniqueid");
    t.equal(messenger.sent[0].msg, message_expected, "correct slack thread payload");
  })
  
  test("list command success", function(t) {
    var tracking_sheet = new TrackingSheetWrapper(new MockSheet(mock_tracking_array()));
    var log_sheet = new LogSheetWrapper(new MockSheet());
    
    var cmd = new ListCommand({channelid: "C012HGQEJMB", userid: "UVCNQASN6"});
    var msg = cmd.execute(tracking_sheet, log_sheet);
    t.ok(msg, "returns a message");
  })
    
}