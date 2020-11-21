function gast() {
  if ((typeof GasTap)==='undefined') { // GasT Initialization.
    eval(UrlFetchApp.fetch(
      'https://raw.githubusercontent.com/huan/gast/master/src/gas-tap-lib.js'
    ).getContentText())
  } // Class GasTap is ready for use now!
  
  var test = new GasTap()
  
  gast_test_positive_controls(test);
  gast_test_doPost(test);
//  gast_test_doTriggered(test);
  
  test.finish()
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

function gast_test_doTriggered(test) {
  // test command form submit event
  test("returns ack if command form submit", function(t){
    var e = {
      triggerUid: 0 // need to refactor so that we can pass a subclass directly
    }
  })
  // test request form submit event
  
  // test edit tracking sheet event
}