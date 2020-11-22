function gast() {
  if ((typeof GasTap)==='undefined') { // GasT Initialization.
    eval(UrlFetchApp.fetch(
      'https://raw.githubusercontent.com/huan/gast/master/src/gas-tap-lib.js'
    ).getContentText())
  } // Class GasTap is ready for use now!
  
  var test = new GasTap()
  
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
      // row, colum are 1-indexed
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
      this.arr2d_nrows = this.arr2d.length;
      this.arr2d_ncols = this.arr2d[0].length;
      this.range = (
        range !== undefined 
        ? range : [1, 1, this.arr2d_nrows, this.arr2d_ncols]
      );
    }
    
    getValue() {
    }
    
    setValue(value) {
    }
    
    getValues() {
      return (
        this.arr2d
        .slice(row - 1, row - 1 + numRows)
        .map(i => i.slice(column - 1, column - 1 + numColumns))
      );
    }
    
    setValues(values) {
    }
  }
  
  test("status log command", function(t) {
    var cmd = new StatusLogCommand({
      uniqueid: 1000,
      userid: "test_userid",
      more: "new_status_val"
    });
    var msg = cmd.execute(
      new TrackingSheetWrapper(new MockSheet()),
      new LogSheetWrapper(new MockSheet())
    );
    t.ok(msg === undefined, "returns void");
    t.deepEqual(cmd.tracking_sheet.sheet.arr2d, [[]], "tracking sheet no side-effect");
    t.deepEqual(
      cmd.log_sheet.sheet.arr2d[0].slice(1, ),
      [1000, "test_userid", "command", "statusManualEdit", "new_status_val"],
      "log sheet row append"
    );
      
      
  })
}