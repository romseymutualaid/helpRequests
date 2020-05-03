// Some functions for formatting and sending messages to slack.
// For more slack formating, see:
// https://api.slack.com/tools/block-kit-builder

function contentServerJsonReply(message) {
  // "ContentServer" reply as Json.
  return ContentService
         .createTextOutput(message)
         .setMimeType(ContentService.MimeType.JSON);
}


function volunteerSuccessReply(slackurl, uniqueid, requesterName, mention_requestCoord, address, contactDetails, householdSituation) {
  var householdMessage = "";
  if (householdSituation != ""){
    householdMessage = "\nTheir household situation is " + householdSituation + ".\n"
  }
  // Json Template for replying to successful volunteer messages.
  return JSON.stringify({
	"blocks": [
		{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": "You signed up for <" + slackurl + "|request " + uniqueid + "> "
			}
		},
		{
			"type": "section",
			"text": {
				"type": "plain_text",
                "text": "The requester's name is " + requesterName + 
                        ".\n Their address is: " + address + 
                        ".\n And their contact details are: " + contactDetails +
                        householdMessage
			}
		},
		{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": ":tada:. \nWhen you are done, type `/done " + uniqueid + "`"
			}
		},
		{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": "To cancel your help offer, type `/cancel " + uniqueid + "`"
			}
		},
		{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": "To see this message again, type `/volunteer " + uniqueid + "`"
			}
		},
		{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": "If you need any help, contact " + mention_requestCoord + "."
			}
		}
	]      
  });
}