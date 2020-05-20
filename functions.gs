//****************************************
// sheet functions
//****************************************

function getUniqueIDbyRowNumber(row, UNIQUEID_START_VAL, UNIQUEID_START_ROWINDEX){
  var uniqueid = +row + UNIQUEID_START_VAL - UNIQUEID_START_ROWINDEX; // assumes: tracking sheet rows are sorted by contiguous increasing request-number
  return(uniqueid);
}

function getRowNumberByUniqueID(uniqueid, UNIQUEID_START_VAL, UNIQUEID_START_ROWINDEX){
  var row = +uniqueid - UNIQUEID_START_VAL +UNIQUEID_START_ROWINDEX; // assumes: tracking sheet rows are sorted by contiguous increasing request-number
  return(row);
}


function stripStartingNumbers(s){
  // Strip starting numbers from a string.
  // Use to remove house numbers when posting publically.
  var re = new RegExp(/^[\s\d]+/);
  return s.replace(re, "");
}


//function getRowByColVal(sheetvalues, colindex, value){
//    var row;
//    for (var i = 0; i < sheetvalues.length ; i++)
//    {
//      if (sheetvalues[i][colindex-1] == value)
//      {
//        row = i;
//        break;
//      }
//    }
//    return row;
//}



//****************************************
// slack command functions
//****************************************

function requestFormatted(slackURL, uniqueid, requesterName, requesterAddr){
  return `<${slackURL}|request ${uniqueid}> (${requesterName}, ${requesterAddr})`;
}


/**
 * Check command validity. Always returns an object of the form:
 * {code:bool, msg:string}
 * Where msg is either empty or of the form: JSON.stringify({blocks: [...]})
 * @param {*} cmd
 * @param {*} row
 * @param {*} uniqueid
 * @param {*} userid
 * @param {*} channelid
 */
function checkCommandValidity (cmd, row, uniqueid, userid, channelid){
  // checkCommandValidity: Checks the following items and returns an output.code (true or false) and output.message (string) accordingly...
  // 1. has script found the correct row in spreadsheet (i.e. uniqueid consistency)?
  // 2. is command sent from the correct channel?
  // 3. is command sent by the appropriate user?
  // 4. is command allowed given the request's current status?

//  // test inputs
//  cmd='done';
//  rowvalues=['1019',
//            '26/04/2020 18:09:42',
//            'test case 1',
//            '07 111 222 333',
//            'stockwell street',
//            'Is disabled and may be home alone',
//            'Prescription pickup',
//            '26/04/2020',
//             '',
//            'testrequests-jb',
//            'General supply shopping',
//            'jb',
//             '',
//            'ToClose?',
//            'https://romseymutualaid.slack.com/archives/C012HGQEJMB/p1587922239000500',
//            '1587922239.000500',
//             '',
//             '',
//            'C012HGQEJMB',
//             'UVDT8G78T',
//            '42',
//            '01/05/2020 19:06:54',
//            'New volunteer required to bring champagne to a Dr located firmly on the sofa.',
//            ''];
//  uniqueid='1019';
//  userid='UVDT8G78T';
//  channelid='C012HGQEJMB';


  /// define variables
  var globvar = globalVariables();
  var mod_userid = globvar['MOD_USERID'];
  var mention_mod = '<@'+mod_userid+'>';

  var request_formatted = requestFormatted(
    row.slackURL, uniqueid, row.requesterName, row.requesterAddr);

  var cmd_state_machine={ // this is the finite state machine object, which contains the return messages and codes for every possible {command,status} combination
      command:{
        "done":{
          status:{
            "Sent|FailSend|Re-open":{
              returnCode:false,
              returnMsg: textToJsonBlocks(
`error: You cannot complete ${request_formatted} because it is yet to be assigned.
Type \`/listmine\` to list the requests you are currently volunteering for in this channel.
If you think there is a mistake, please contact ${mention_mod}.`)
            },
            "Escalated|Signposted":{
              returnCode:false,
              returnMsg: textToJsonBlocks(
`error: You cannot complete ${request_formatted} because it is permanently closed.
Type \`/listmine\` to list the requests you are currently volunteering for in this channel.
If you think there is a mistake, please contact ${mention_mod}.`)
            },
            "Assigned|Ongoing|ToClose\\?|Closed":{
              returnCode:true,
              returnMsg: textToJsonBlocks(
`You have confirmed completing ${request_formatted}.
I've notified volunteers in the help request thread and sent
your form submission to the request coordinator on-duty.`)
            }
          }
        },
        "volunteer":{
          status:{
            "Sent|Re-open":{
              returnCode:true,
              returnMsg:volunteerSuccessReply(
                row.slackURL,
                row.uniqueid,
                row.requesterName,
                mention_mod,
                row.requesterAddr,
                row.requesterContact,
                row.householdSit,
                true
              )
            },
            "Assigned|Ongoing":{
              returnCode:false,
              returnMsg:volunteerSuccessReply(
                row.slackURL,
                row.uniqueid,
                row.requesterName,
                mention_mod,
                row.requesterAddr,
                row.requesterContact,
                row.householdSit,
                false
              )
            },
            "FailSend|ToClose\\?|Closed|Escalated|Signposted":{
              returnCode:false,
              returnMsg:textToJsonBlocks(
                `Sorry, ${request_formatted} is not available.
Its status is "${row.requestStatus}".
Volunteer is <@${row.slackVolunteerID}>.
Type \`/list\` to list all the available requests in this channel.
If you think there is a mistake, please contact ${mention_mod}.`)
            }
          }
        },
        "cancel":{
          status:{
            "Sent|FailSend|Re-open":{
              returnCode:false,
              returnMsg: textToJsonBlocks(
`error: You cannot cancel ${request_formatted} because it is yet to be assigned.
Type \`/listmine\` to list the requests you are currently volunteering for in this channel.
If you think there is a mistake, please contact ${mention_mod}.`)
            },
            "Escalated|Signposted|Closed":{
              returnCode:false,
              returnMsg: textToJsonBlocks(
`You were signed up on ${request_formatted} but it's now closed. We therefore won't remove you.
Type \`/listmine\` to list the requests you are currently volunteering for in this channel.
If you think there is a mistake, please contact ${mention_mod}.`)
            },
            "Assigned|Ongoing|ToClose\\?":{
              returnCode:true,
              returnMsg: textToJsonBlocks(
`You just cancelled your offer for help for ${request_formatted}.
I've notified the channel.`)
            }
          }
        }
      }
    };


  // initialise output object
  var msg='';


  // check that uniqueid of the row and the requested uniqueid match
  if (row.uniqueid != uniqueid){
    if (row.uniqueid == ''){ // uniqueid points to empty row --> suggests wrong number was entered
      msg = textToJsonBlocks(
`error: I couldn't find the request number \`${uniqueid}\`. Did you type the right number?
Type \`/listmine\` to list the requests you are currently volunteering for in this channel.
If the issue persists, please contact ${mention_mod}.`);
    } else { // uniqueid points to non-empty row but mismatch --> this is a spreadsheet issue. suggests rows are not sorted by uniqueid.
      msg = textToJsonBlocks(
`error: There is a problem in the spreadsheet on the server.
You asked for request-number ${uniqueid}, but I could only find request-number ${row.uniqueid}.
Please can you notify a developer and ask ${mention_mod} for assistance?`);
    }
        throw new Error(msg);
  }

  // check that request belongs to the channel from which command was sent
  if (channelid !== row.channelid) {
    msg = textToJsonBlocks(
`error: The request ${uniqueid} does not appear to belong to the channel you are writing from.
Type \`/listmine\` to list the requests you are currently volunteering for in this channel.
If the issue persists, please contact ${mention_mod}.`);
  throw new Error(msg);
  }

  // check that user that sent the request has the right to proceed
  if (cmd==='volunteer'){
    if (row.slackVolunteerID!=='' && userid!==row.slackVolunteerID){ // volunteerid is not blank and user that sent command does not match volunteerID
      msg = textToJsonBlocks(
`error: Your command failed because ${request_formatted} is taken by someone else (<@${row.slackVolunteerID}>).
Type \`/list\` to list all the available requests in this channel.
If you think there is a mistake, please contact ${mention_mod}.`);
      throw new Error(msg);
    }
  } else if (cmd==='cancel' || cmd==='done'){
    if (row.slackVolunteerID === '') { // no one is assigned
      msg = textToJsonBlocks(
`error: Your command failed because ${request_formatted} is yet to be assigned.
Type \`/listmine\` to list the requests you are currently volunteering for in this channel.
If you think there is a mistake, please contact ${mention_mod}.`);
      throw new Error(msg);
    } else if (row.slackVolunteerID !== '' && userid!==row.slackVolunteerID && userid!==mod_userid) { // someone else than userid is assigned, and userid is not moderator
      msg = textToJsonBlocks(
`error: Your command failed because ${request_formatted} is taken by someone else (<@${row.slackVolunteerID}>).
Type \`/listmine\` to list the requests you are currently volunteering for in this channel.
If you think there is a mistake, please contact ${mention_mod}.`);
  throw new Error(msg);
    }
  }

  // check command is compatible with request status
  var statusBranchVal;
  Object.keys(cmd_state_machine.command[cmd].status).forEach(function(key,index) { // iterate over the object properties of cmd_state_machine.command[cmd].status
    // key: the name of the object key
    var status_match = new RegExp(key).exec(row.requestStatus); // regexp match row.requestStatus with key
    if (status_match && status_match!=''){ // status matches key: this is the cmd_state_machine branch we want to take
      statusBranchVal = key;
    }
  });
  if (!statusBranchVal){ // if no branch match was found
    msg = textToJsonBlocks(
`error: There is a problem in the spreadsheet on the server.
I couldn't recognise the current status value "${row.requestStatus}" of request ${uniqueid}.
Please can you notify a developer and ask ${mention_mod} for assistance?`);
    throw new Error(msg);
  } else{
    msg = cmd_state_machine.command[cmd].status[statusBranchVal].returnMsg;
    if (!cmd_state_machine.command[cmd].status[statusBranchVal].returnCode){
      throw new Error(msg);
    }
  }

      return msg;
}


//****************************************
// slack message functions
//****************************************

function postRequest(sheet, row, tracking_sheet_col_index, webhook_chatPostMessage, access_token, postType, sheet_log){

  // get relevant sheet values
  var colindex_uniqueid = tracking_sheet_col_index['uniqueid'];
  var colindex_channelid = tracking_sheet_col_index['channelid'];
  var colindex_phone = tracking_sheet_col_index['requesterContact'];
  var colindex_status = tracking_sheet_col_index['requestStatus'];
  var colindex_volunteerName = tracking_sheet_col_index['slackVolunteerName'];
  var colindex_volunteerID = tracking_sheet_col_index['slackVolunteerID'];
  var colindex_slackts = tracking_sheet_col_index['slackTS'];
  var colindex_slacktsurl = tracking_sheet_col_index['slackURL'];
  var colindex_requestername = tracking_sheet_col_index['requesterName'];
  var colindex_address = tracking_sheet_col_index['requesterAddr'];
  var colindex_requestType =  tracking_sheet_col_index['requestType'];
  var colindex_requestDate =  tracking_sheet_col_index['requestDate'];
  var colindex_requestInfo =  tracking_sheet_col_index['requestInfo'];
  var colindex_generalNeeds =  tracking_sheet_col_index['requesterGeneralNeeds'];

  var uniqueid = sheet.getRange(row, colindex_uniqueid+1).getValue();
  var requesterName = sheet.getRange(row, colindex_requestername+1).getValue();
  var address = stripStartingNumbers(sheet.getRange(row, colindex_address+1).getValue());
  var requestType = sheet.getRange(row, colindex_requestType+1).getValue();
  var requestDate = formatDate(sheet.getRange(row, colindex_requestDate+1).getValue());
  var requestInfo = sheet.getRange(row, colindex_requestInfo+1).getValue();
  var generalNeeds = sheet.getRange(row, colindex_generalNeeds+1).getValue();
  var channelid = sheet.getRange(row, colindex_channelid+1).getValue();

  // Build JSON post request
  var out_message_notification = 'A resident in your area has a request. Can you help?'; // text to display on mobile app notification
  var out_message = JSON.stringify([
	{
		"type": "section",
		"text": {
			"text": "<!channel> *A resident in your area has a request. Can you help?*\n"+
          "_Guidelines for volunteers: <https://docs.google.com/document/d/1l9tssHGzP1Zzr4TSaltlXS3x7QSF4PrGihEpBxoGUwM/edit?usp=sharing|deliveries> -"+
          " <https://docs.google.com/document/d/1TDuns8kLnbc1TCa9MZLz_uaI6CSVqb3xJvG2gc71Dy4/edit?usp=sharing|escalation> - <https://docs.google.com/document/d/1s35O51IEiZMnodyg4wiw_dVwbn7ZvCQkKu6mKsN_gvM|infection control>_",
			"type": "mrkdwn"
		},
		"fields": [
          {"type": "mrkdwn", "text": "*Requester:*"},
          {"type": "plain_text", "text": requesterName + " ("+ address +")"},

          {"type": "mrkdwn", "text": "*Contact details:*"},
          {"type": "mrkdwn", "text": "To volunteer, send `/volunteer "+uniqueid+"` in channel."},

          {"type": "mrkdwn", "text": "*Immediate request:*"},
          {"type": "plain_text", "text": requestType + " "},

          {"type": "mrkdwn", "text": "*Date needed:*"},
          {"type": "plain_text", "text": requestDate + " "},

          {"type": "mrkdwn", "text": "*Request additional info:*"},
          {"type": "plain_text","text": requestInfo + " "}
		]
	},
	{
		"type": "section",
		"fields": [
          {"type": "mrkdwn", "text": "*Prospective needs:*"},
          {"type": "plain_text", "text": generalNeeds + " "}
		]
	},
    {
      "type": "divider"
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "_Note: `/volunteer "+uniqueid+"` may occasionally fail. If so, please send the command again until you receive contact details_."
      }
    }
  ]); // this message is formatted in such a way that all user-input text is escaped (type: "plain_text"). This is intended to protect against cross-site scripting attacks.

  var options = {
    method: "post",
    contentType: 'application/json; charset=utf-8',
    headers: {Authorization: 'Bearer ' + access_token},
    payload: JSON.stringify({blocks: out_message,
                             text: out_message_notification,
                             channel: channelid,
                             as_user: true})
  };

  var return_message = UrlFetchApp.fetch(webhook_chatPostMessage, options).getContentText(); // Send post request to Slack chat.postMessage API

  // Update sheet status and slack_ts depending on success of post return-message
  var return_params = JSON.parse(return_message);
  if (return_params.ok === true){ // message was succesfully posted to channel
    sheet.getRange(row, colindex_slackts+1).setValue(return_params.ts); // update slack ts field
    sheet.getRange(row, colindex_status+1).setValue('Sent'); // update status field
    sheet.getRange(row, colindex_volunteerID+1).setValue(''); // clear volunteerID
    sheet.getRange(row, colindex_volunteerName+1).setValue(''); // clear volunteerName
  } else{
    sheet.getRange(row, colindex_slackts+1).setValue('');
    sheet.getRange(row, colindex_status+1).setValue('FailSend');
  }

  // update log sheet
  var row_log = sheet_log.getLastRow();
  sheet_log.getRange(row_log+1,1,1,5).setValues([[new Date(),uniqueid,'admin',postType,return_message]]);
}


//****************************************
// miscelaneous functions
//****************************************

function formatDate(date) {
  if (date == "" || date === null || date === undefined) {
    return "None Given";
  } else {
    var dt = new Date(date);
    return dt.getDate() + '/' + (dt.getMonth() + 1) +'/'+ dt.getFullYear( ); // DD/MM/YYYY
  }
}

function indexedObjectFromArray (arr) {
  var obj={};
  for (var i=0; i < arr.length; i++){
    obj[arr[i]]=i;
  }
  return obj;
}