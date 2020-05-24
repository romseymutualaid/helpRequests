// sheet functions

function getRowByUniqueID(uniqueid, UNIQUEID_START_VAL, UNIQUEID_START_ROWINDEX){
  var row = +uniqueid - UNIQUEID_START_VAL +UNIQUEID_START_ROWINDEX; // assumes: tracking sheet rows are sorted by contiguous increasing request-number
  return(row);
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


// slack command functions

function checkUniqueID (uniqueid){
  // check that uniqueid does indeed match a 4-digit string
  var re = new RegExp("^[0-9]{4}$"); // regexp match for user_id in mention string
  var uniqueid_re = re.exec(uniqueid); // RegExp.exec returns array. First element is matched string, following elements are matched groupings.
  if (!uniqueid_re){ // failed regex
    return false;
  }
  var uniqueid_re_match = uniqueid_re[0];
  if (uniqueid_re_match == ''){ // no match
    return false;
  } else{
    return true;
  }
}


// slack message functions

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
  var address = sheet.getRange(row, colindex_address+1).getValue();
  var requestType = sheet.getRange(row, colindex_requestType+1).getValue();
  var requestDateUnformatted = new Date (sheet.getRange(row, colindex_requestDate+1).getValue());
  var requestDate = requestDateUnformatted.getDate() + '/' + (requestDateUnformatted.getMonth() + 1) +'/'+ requestDateUnformatted.getFullYear( ); // DD/MM/YYYY
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
  ]); // this message is formatted in such a way that all user-input text is escaped (type: "plain_text"). This intends to protect against cross-site scripting attacks.
  
  var options = {
    method: "post",
    contentType: 'application/json; charset=utf-8',
    headers: {Authorization: 'Bearer ' + access_token},
    payload: JSON.stringify({blocks: out_message,
                             text: out_message_notification,
                             channel: channelid})
  };
  
  var return_message = UrlFetchApp.fetch(webhook_chatPostMessage, options).getContentText(); // Send post request to Slack chat.postMessage API   
  
  // Update sheet status and slack_ts depending on success of post return-message
  var return_params = JSON.parse(return_message);
  if (return_params.ok === true){ // message was succesfully posted to channel
    sheet.getRange(row, colindex_slackts+1).setValue(return_params.ts); // update slack ts field
    sheet.getRange(row, colindex_status+1).setValue('Sent'); // update status field
  } else{
    sheet.getRange(row, colindex_slackts+1).setValue('');
    sheet.getRange(row, colindex_status+1).setValue('FailSend');
  }
  
  // update log sheet
  var row_log = sheet_log.getLastRow();
  sheet_log.getRange(row_log+1,1,1,5).setValues([[new Date(),uniqueid,'admin',postType,return_message]]);
}



// miscelaneous functions

function indexedObjectFromArray (arr) {
  var obj={};
  for (var i=0; i < arr.length; i++){
    obj[arr[i]]=i;
  }
  return obj;
}