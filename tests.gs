function gast() {
  if ((typeof GasTap)==='undefined') { // GasT Initialization.
    eval(UrlFetchApp.fetch(
      'https://raw.githubusercontent.com/huan/gast/master/src/gas-tap-lib.js'
    ).getContentText())
  } // Class GasTap is ready for use now!
  
  var test = new GasTap();
  
  gast_test_positive_controls(test);
//  gast_test_doPost(test);
//  gast_test_slackEventAdapters(test);
  gast_test_slackEvent(test);
//  gast_test_sheetEventAdapters(test);
  gast_test_sheetEvent(test);
  gast_test_commands(test);
  
  test.finish()
}

var try_return = function(func, ...args){
  try {
    return func(...args);
  }
  catch(errObj) {
    return errObj.message;
  }
}

var try_constructor_return = function(className, ...args){
  try {
    return new className(...args);
  }
  catch(errObj) {
    return errObj.message;
  }
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
  test("throws if empty par", function(t) {
    var e = {parameter: {}};
    t.throws(doPost(e), "test throws");
  });
  
  test("returns ack if slash cmd", function(t) {
    var e = {parameter: {
      token: PropertiesService.getScriptProperties().getProperty('VERIFICATION_TOKEN'),
      team_id: globalVariables()['TEAM_ID'],
      channel_id: "",
      user_id: "",
      user_name: "",
      response_url: "",
      trigger_id: "",
      command: "/volunteer",
      text: "0000"
    }};
    t.equal(doPost(e).getContent(), commandPendingMessage(), "volunteer");
    
    e.parameter.command = "/cancel";
    t.equal(doPost(e).getContent(), commandPendingMessage(), "cancel");
    
    e.parameter.command = "/done";
    slack_invalid_triggerid_msg = "{\"ok\":false,\"error\":\"invalid_arguments\",\"response_metadata\":{\"messages\":[\"[ERROR] invalid `trigger_id` [json-pointer:\\/trigger_id]\"]}}";
    t.equal(doPost(e).getContent(),
            postToSlackModalErrorMessage(slack_invalid_triggerid_msg), "done");
    
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
    var e = {parameter: {
      payload: JSON.stringify({
        token: PropertiesService.getScriptProperties().getProperty('VERIFICATION_TOKEN'),
        team: {id: globalVariables()['TEAM_ID']},
        user: {id: ""},
        type: "view_submission",
        view: {
          callback_id: "done_modal",
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
    t.equal(doPost(e).getContent(), null, "done_modal");
  });
}

function gast_test_slackEventAdapters(test) {
}

function gast_test_slackEvent(test) {
  var token_true = PropertiesService.getScriptProperties().getProperty(
    'VERIFICATION_TOKEN');
  var teamid_true = globalVariables()['TEAM_ID'];
  var accepted_types = ['view_submission', 'command'];
  
  test("throws if auth failure", function(t) {
    t.equal(
      try_constructor_return(
        SlackEventController,
        token = "incorrect_token_placeholder",
        teamid = teamid_true,
        type = accepted_types[0],
        cmd = new VoidCommand(args = {})
      ),
      slackTokenIsIncorrectMessage("incorrect_token_placeholder"),
      "incorrect token"
    );
    
    t.equal(
      try_constructor_return(
        SlackEventController,
        token = token_true,
        teamid = "incorrect_teamid_placeholder",
        type = accepted_types[0],
        cmd = new VoidCommand(args = {})
      ),
      slackWorspaceIsIncorrectMessage(),
      "incorrect teamid"
    );
    
    t.equal(
      try_constructor_return(
        SlackEventController,
        token = token_true,
        teamid = teamid_true,
        type = "incorrect_type_placeholder",
        cmd = new VoidCommand(args = {})
      ),
      slackEventTypeIsIncorrectMessage("incorrect_type_placeholder"),
      "incorrect type"
    );
  })
  
  test("returns void if auth success and voidcommand", function(t) {
    for(var i=0; i < accepted_types.length; i++) {
      slackEvent = new SlackEventController(
        token = token_true,
        teamid = teamid_true,
        type = accepted_types[i],
        cmd = new VoidCommand(args = {})
      );
      t.ok(slackEvent.handle() === undefined, `type ${accepted_types[i]}`);
    }
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
      return this.arr2d[row - 1][column - 1];
    }
    
    setValue(value) {
      var [row, column, , ] = this.range;
      this.arr2d[row - 1][column - 1] = value;
    }
    
    getValues() {
      var [row, column, numRows, numColumns] = this.range;
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
  
  class MockSuccessMessenger {
    send() {
      return JSON.stringify({ok: true});
    }
  }
  class MockFailMessenger {
    send() {
      return JSON.stringify({ok: false});
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
        "jb", "", "Closed",
        "https://romseymutualaid.slack.com/archives/C012HGQEJMB/p1589019210000200",
        "1589019210.000200", "", "baye.james", "C012HGQEJMB", "UVDT8G78T", 13,
        "Sat May 23 2020 02:44:39 GMT+0100 (British Summer Time)", "", ""
      ],
      [
        1001, "14/04/2020 01:40:22", "test case 11", "07111222333", "1 argyle st",
        "covid symptoms", "parcel collection", "15/04/2020", "", "testsrequests-jb", "",
        "jb", "", "ToClose?",
        "https://romseymutualaid.slack.com/archives/C012HGQEJMB/p1591654103007100",
        "1591654103.007100", "", "judefbrady", "C012HGQEJMB", "UVCNQASN6", 1,
        "10/06/2020 13:57:22", "coffee required", ""
      ],
      [],
      [],
      []
    ];
  }
 
  test("statusLog command", function(t) {
    var cmd = new StatusLogCommand({
      uniqueid: 1000,
      userid: "test_userid",
      more: "new_status_val"
    });
    var msg = cmd.execute(
      new TrackingSheetWrapper(new MockSheet()),
      new LogSheetWrapper(new MockSheet())
    );
    t.deepEqual(cmd.tracking_sheet.sheet.arr2d, [[]], "no tracking sheet side-effect");
    t.deepEqual(
      cmd.log_sheet.sheet.arr2d[0].slice(1),
      [1000, "test_userid", "command", "statusManualEdit", "new_status_val"],
      "logs new status"
    );
  })
  
  test("postRequest command success", function(t) {
    var cmd = new PostRequestCommand({
      uniqueid: 1000
    });
    cmd.execute(new TrackingSheetWrapper(new MockSheet(mock_tracking_array())),
                new LogSheetWrapper(new MockSheet()),
                new MockSuccessMessenger());
    t.equal(cmd.row.uniqueid, 1000, "correct uniqueid");
    t.equal(cmd.row.requestStatus, "Sent", "status is Sent");
    t.equal(cmd.log_sheet.sheet.arr2d[0][1], 1000, "logs uniqueid");
  })
  
  test("postRequest command failure", function(t) {
    var cmd = new PostRequestCommand({
      uniqueid: 1000
    });
    cmd.execute(new TrackingSheetWrapper(new MockSheet(mock_tracking_array())),
                new LogSheetWrapper(new MockSheet()),
                new MockFailMessenger());
    t.equal(cmd.row.uniqueid, 1000, "correct uniqueid");
    t.equal(cmd.row.requestStatus, "FailSend", "status is FailSend");
    t.deepEqual(cmd.log_sheet.sheet.arr2d, [[]], "no log");
  })
    
    
}